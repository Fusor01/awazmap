import { prisma } from "@/lib/prisma";

export type MapComplaint = {
  id: string; lat: number; lng: number; category: string; severity: string | null;
  summary: string; address: string | null; createdAt: string; status: string;
  isDemo: boolean; incidentId: string | null;
};
export type MapMember = {
  id: string; summary: string; createdAt: string; severity: string | null;
  distanceM: number; textScore: number; isDemo: boolean;
};
export type MapIncident = {
  id: string; title: string; lat: number; lng: number; category: string; severity: string;
  severityReasons: string[]; address: string | null; reportCount: number; status: string;
  firstReportedAt: string; latestReportedAt: string; isDemo: boolean; members: MapMember[];
};

export async function getMapData(): Promise<
  { ok: true; complaints: MapComplaint[]; incidents: MapIncident[] } | { ok: false }
> {
  try {
    const [complaints, incidents] = await Promise.all([
      prisma.complaint.findMany({
        where: { latitude: { not: null }, longitude: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 2000,
        include: { report: { select: { incidentId: true } } },
      }),
      prisma.incident.findMany({
        orderBy: { latestReportedAt: "desc" },
        take: 500,
        include: {
          reports: {
            orderBy: { complaint: { createdAt: "asc" } },
            include: { complaint: { select: { id: true, summary: true, transcript: true, createdAt: true, severity: true, isDemo: true } } },
          },
        },
      }),
    ]);
    return {
      ok: true,
      complaints: complaints.map((c) => ({
        id: c.id, lat: c.latitude!, lng: c.longitude!, category: c.category, severity: c.severity,
        summary: c.summary ?? c.transcript, address: c.address, createdAt: c.createdAt.toISOString(),
        status: c.status, isDemo: c.isDemo, incidentId: c.report?.incidentId ?? null,
      })),
      incidents: incidents.map((i) => ({
        id: i.id, title: i.title, lat: i.latitude, lng: i.longitude, category: i.category, severity: i.severity,
        severityReasons: i.severityReasons, address: i.address, reportCount: i.reportCount, status: i.status,
        firstReportedAt: i.firstReportedAt.toISOString(), latestReportedAt: i.latestReportedAt.toISOString(),
        isDemo: i.isDemo,
        members: i.reports.map((r) => ({
          id: r.complaint.id, summary: r.complaint.summary ?? r.complaint.transcript,
          createdAt: r.complaint.createdAt.toISOString(), severity: r.complaint.severity,
          distanceM: r.distanceM, textScore: r.textScore, isDemo: r.complaint.isDemo,
        })),
      })),
    };
  } catch (e) {
    console.error("getMapData failed:", e);
    return { ok: false };
  }
}