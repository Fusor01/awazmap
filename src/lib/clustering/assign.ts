// Database side of Community Signal. Never deletes or hides complaints: it only adds
// IncidentReport links, flips a complaint's status to LINKED, and refreshes incident aggregates.
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { categoryLabel } from "../utils";
import { CLUSTER_CONFIG as C, isClusterable } from "./config";
import { boundingBox, centroid, distanceMeters } from "./geo";
import { textSimilarity } from "./similarity";
import { daysOutside, rollupSeverity, withinThresholds } from "./engine";

type Tx = Prisma.TransactionClient;
const DAY_MS = 86_400_000;

export type AssignResult = {
  action: "skipped" | "standalone" | "joined" | "created";
  incidentId?: string;
  reportCount?: number;
  reason?: string;
};

function mostCommon(values: (string | null | undefined)[]): string | null {
  const counts = new Map<string, number>();
  for (const v of values) { const t = v?.trim(); if (t) counts.set(t, (counts.get(t) ?? 0) + 1); }
  let best: string | null = null, n = 0;
  for (const [k, c] of counts) if (c > n) { best = k; n = c; }
  return best;
}

/** Recompute count, first/latest time, centre, severity and locality from the linked complaints. */
async function refreshIncident(tx: Tx, incidentId: string) {
  const links = await tx.incidentReport.findMany({
    where: { incidentId },
    select: { complaint: { select: { latitude: true, longitude: true, createdAt: true, severity: true, address: true } } },
  });
  const cs = links.map((l) => l.complaint);
  const pts = cs.filter((c) => c.latitude !== null && c.longitude !== null).map((c) => ({ lat: c.latitude!, lng: c.longitude! }));
  const centre = pts.length ? centroid(pts) : null;
  const times = cs.map((c) => c.createdAt.getTime());
  const roll = rollupSeverity(cs.map((c) => c.severity), cs.length);
  const current = await tx.incident.findUnique({ where: { id: incidentId }, select: { address: true } });

  await tx.incident.update({
    where: { id: incidentId },
    data: {
      reportCount: cs.length,
      firstReportedAt: new Date(Math.min(...times)),
      latestReportedAt: new Date(Math.max(...times)),
      severity: roll.severity,
      severityReasons: roll.reasons,
      address: current?.address ?? mostCommon(cs.map((c) => c.address)),
      ...(centre ? { latitude: centre.lat, longitude: centre.lng } : {}),
    },
  });
  return cs.length;
}

/**
 * Decide where one saved complaint belongs. Order of decisions:
 *  1. Join an existing open incident (same category, within radius of its centre, inside the time window,
 *     text similar to at least one linked report).
 *  2. Otherwise, if enough unlinked complaints satisfy the same tests against this complaint, create an incident.
 *  3. Otherwise stay standalone. Standalone complaints are still shown on the map.
 * Runs inside one transaction with an advisory lock so two simultaneous reports cannot create duplicate incidents.
 */
export async function assignComplaint(complaintId: string): Promise<AssignResult> {
  return prisma.$transaction<AssignResult>(
    async (tx): Promise<AssignResult> => {
      await tx.$queryRawUnsafe("SELECT 1 AS ok FROM (SELECT pg_advisory_xact_lock(7301)) AS t");

      const c = await tx.complaint.findUnique({ where: { id: complaintId }, include: { report: true } });
      if (!c) return { action: "skipped", reason: "complaint not found" };
      if (c.report) return { action: "skipped", reason: "already linked" };
      if (c.latitude === null || c.longitude === null) return { action: "skipped", reason: "no coordinates" };
      if (!isClusterable(c.category)) return { action: "standalone", reason: "category is not clustered" };

      const me = { lat: c.latitude, lng: c.longitude };
      const myText = c.summary ?? c.transcript;
      const box = boundingBox(me, C.radiusMeters);
      const windowMs = C.windowDays * DAY_MS;
      const from = new Date(c.createdAt.getTime() - windowMs);
      const to = new Date(c.createdAt.getTime() + windowMs);

      // ---- 1. Try to join an existing incident ----
      const incidents = await tx.incident.findMany({
        where: {
          category: c.category,
          status: { not: "RESOLVED" },
          isDemo: c.isDemo,
          latitude: { gte: box.minLat, lte: box.maxLat },
          longitude: { gte: box.minLng, lte: box.maxLng },
          firstReportedAt: { lte: to },
          latestReportedAt: { gte: from },
        },
        include: { reports: { select: { complaint: { select: { summary: true, transcript: true } } } } },
      });

      let best: { id: string; distanceM: number; textScore: number } | null = null;
      for (const inc of incidents) {
        const distanceM = distanceMeters(me, { lat: inc.latitude, lng: inc.longitude });
        const textScore = Math.max(0, ...inc.reports.map((r) => textSimilarity(myText, r.complaint.summary ?? r.complaint.transcript)));
        const daysApart = daysOutside(c.createdAt, inc.firstReportedAt, inc.latestReportedAt);
        if (!withinThresholds({ distanceM, daysApart, textScore })) continue;
        if (!best || textScore > best.textScore || (textScore === best.textScore && distanceM < best.distanceM)) {
          best = { id: inc.id, distanceM, textScore };
        }
      }
      if (best) {
        await tx.incidentReport.create({
          data: { incidentId: best.id, complaintId: c.id, distanceM: Math.round(best.distanceM), textScore: best.textScore },
        });
        await tx.complaint.update({ where: { id: c.id }, data: { status: "LINKED" } });
        const reportCount = await refreshIncident(tx, best.id);
        return { action: "joined", incidentId: best.id, reportCount };
      }

      // ---- 2. Try to form a new incident from unlinked complaints ----
      const peers = await tx.complaint.findMany({
        where: {
          id: { not: c.id },
          category: c.category,
          status: "NEW",
          isDemo: c.isDemo,
          latitude: { gte: box.minLat, lte: box.maxLat },
          longitude: { gte: box.minLng, lte: box.maxLng },
          createdAt: { gte: from, lte: to },
        },
        select: { id: true, latitude: true, longitude: true, summary: true, transcript: true, address: true, createdAt: true },
      });
      const hits: { id: string; distanceM: number; textScore: number; address: string | null }[] = [];
      for (const p of peers) {
        if (p.latitude === null || p.longitude === null) continue;
        const distanceM = distanceMeters(me, { lat: p.latitude, lng: p.longitude });
        const textScore = textSimilarity(myText, p.summary ?? p.transcript);
        const daysApart = Math.abs(p.createdAt.getTime() - c.createdAt.getTime()) / DAY_MS;
        if (withinThresholds({ distanceM, daysApart, textScore })) hits.push({ id: p.id, distanceM, textScore, address: p.address });
      }

      if (hits.length + 1 >= C.minReportsToForm) {
        const locality = mostCommon([c.address, ...hits.map((h) => h.address)]);
        const incident = await tx.incident.create({
          data: {
            title: `${categoryLabel(c.category)}: community reports${locality ? ` near ${locality}` : ""}`,
            category: c.category,
            status: "OPEN",
            address: locality,
            latitude: me.lat,
            longitude: me.lng,
            firstReportedAt: c.createdAt,
            latestReportedAt: c.createdAt,
            isDemo: c.isDemo,
          },
        });
        await tx.incidentReport.createMany({
          data: [
            { incidentId: incident.id, complaintId: c.id, distanceM: 0, textScore: 1 },
            ...hits.map((h) => ({ incidentId: incident.id, complaintId: h.id, distanceM: Math.round(h.distanceM), textScore: h.textScore })),
          ],
        });
        await tx.complaint.updateMany({ where: { id: { in: [c.id, ...hits.map((h) => h.id)] } }, data: { status: "LINKED" } });
        const reportCount = await refreshIncident(tx, incident.id);
        return { action: "created", incidentId: incident.id, reportCount };
      }

      return {
        action: "standalone",
        reason: `${hits.length + 1} related report(s) nearby, ${C.minReportsToForm} needed to form an incident`,
      };
    },
    { timeout: 20_000, maxWait: 10_000 }
  );
}