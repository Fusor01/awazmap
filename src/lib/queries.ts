import { prisma } from "@/lib/prisma";

export type SourceFilter = "ALL" | "REAL" | "DEMO";
export const parseSource = (v?: string): SourceFilter => (v === "REAL" || v === "DEMO" ? v : "ALL");

const demoWhere = (s: SourceFilter) => (s === "REAL" ? { isDemo: false } : s === "DEMO" ? { isDemo: true } : {});

export async function getAdminData(source: SourceFilter = "ALL") {
  try {
    const w = demoWhere(source);
    const open = { status: { not: "RESOLVED" } } as const;

    const [
      totalComplaints, unresolvedComplaints, newComplaints, activeIncidents, resolvedIncidents,
      highPriority, recentComplaints, incidents, byCategory, byAddress,
    ] = await Promise.all([
      prisma.complaint.count({ where: w }),
      prisma.complaint.count({ where: { ...w, ...open } }),
      prisma.complaint.count({ where: { ...w, status: "NEW" } }),
      prisma.incident.count({ where: { ...w, ...open } }),
      prisma.incident.count({ where: { ...w, status: "RESOLVED" } }),
      prisma.complaint.count({ where: { ...w, ...open, severity: { in: ["HIGH", "CRITICAL"] } } }),
      prisma.complaint.findMany({ where: w, orderBy: { createdAt: "desc" }, take: 10 }),
      prisma.incident.findMany({ where: w, orderBy: { latestReportedAt: "desc" }, take: 10 }),
      prisma.complaint.groupBy({ by: ["category"], where: w, _count: { _all: true } }),
      prisma.complaint.groupBy({ by: ["address"], where: w, _count: { _all: true } }),
    ]);

    const categories = byCategory
      .map((r) => ({ category: r.category as string, count: r._count._all }))
      .sort((a, b) => b.count - a.count);

    // Localities are free text, so merge case/spacing variants. Same place typed differently still counts separately.
    const merged = new Map<string, { name: string; count: number }>();
    for (const r of byAddress) {
      const name = r.address?.trim() || "Not provided";
      const key = name.toLowerCase();
      const cur = merged.get(key);
      if (cur) cur.count += r._count._all;
      else merged.set(key, { name, count: r._count._all });
    }
    const localities = [...merged.values()].sort((a, b) => b.count - a.count).slice(0, 8);

    return {
      ok: true as const, source, totalComplaints, unresolvedComplaints, newComplaints, activeIncidents,
      resolvedIncidents, highPriority, recentComplaints, incidents, categories, localities,
    };
  } catch (e) {
    console.error("Database query failed:", e);
    return { ok: false as const };
  }
}