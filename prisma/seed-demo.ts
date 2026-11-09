// SIMULATED DEMONSTRATION DATA. Every row is flagged isDemo=true and labelled "(simulated)" in its locality.
// Complaints are fed through the real clustering engine in chronological order, so the incidents you see
// are produced by the algorithm, not hard-coded. Re-running replaces earlier demo rows only.
//
// Usage:  npm run db:seed-demo
// Optional: DEMO_CENTER_LAT / DEMO_CENTER_LNG in .env to place the demo around your own city (default: New Delhi).
import { prisma } from "../src/lib/prisma";
import { assignComplaint } from "../src/lib/clustering/assign";
import { computeSeverity } from "../src/lib/severity";
import { offsetPoint } from "../src/lib/clustering/geo";

type Cat = "ROADS" | "WATER" | "SANITATION" | "ELECTRICITY" | "SAFETY" | "TRANSPORT" | "OTHER";
type Item = {
  label?: string; // set on control cases that should NOT form an incident
  category: Cat; text: string; place: string;
  east: number; north: number; hoursAgo: number; durationDays: number | null; many: boolean;
};

const CENTER = {
  lat: Number(process.env.DEMO_CENTER_LAT ?? 28.6139),
  lng: Number(process.env.DEMO_CENTER_LNG ?? 77.209),
};

function rng(seed: number) { // deterministic, so every run produces the same demo
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(1234);
const jitter = (m: number) => (rand() * 2 - 1) * m;

const GARBAGE = [
  "Garbage piled up and not collected for several days",
  "Large pile of trash next to the bin, strong smell",
  "Waste dumped openly, attracting stray dogs",
  "Municipal garbage truck has not come this week",
  "Overflowing dustbin with scattered rubbish",
  "Uncollected garbage causing a bad smell",
  "Rubbish heap growing near the corner, not cleared",
];
const WATER = [
  "No water supply for three days",
  "Tap water has not come since two days",
  "Water pipeline supply stopped in our block",
  "Drinking water unavailable, families affected",
];
const POTHOLE = [
  "Large pothole on the main road causing accidents",
  "Deep potholes damaging vehicles",
  "Road damaged with a big pothole near the junction",
  "Dangerous pothole, two-wheelers are slipping",
  "Broken road surface with several potholes",
];

const items: Item[] = [];
for (let i = 0; i < 14; i++) {
  items.push({ category: "SANITATION", text: GARBAGE[i % GARBAGE.length], place: "Demo Colony A", east: jitter(110), north: jitter(110), hoursAgo: 6 + i * 8 + jitter(3), durationDays: 2 + (i % 4), many: true });
}
for (let i = 0; i < 8; i++) {
  items.push({ category: "WATER", text: WATER[i % WATER.length], place: "Demo Nagar B", east: 1200 + jitter(90), north: 600 + jitter(90), hoursAgo: 5 + i * 7 + jitter(2), durationDays: 2 + (i % 3), many: true });
}
for (let i = 0; i < 5; i++) {
  items.push({ category: "ROADS", text: POTHOLE[i], place: "Demo Road C", east: -900 - 125 + i * 62.5, north: 400 + jitter(15), hoursAgo: 10 + i * 20 + jitter(3), durationDays: 5, many: false });
}
// ---- controls: these must NOT join the incidents above ----
items.push(
  { label: "CONTROL different category, same spot", category: "WATER", text: "No water supply since yesterday", place: "Demo Colony A", east: 10, north: 5, hoursAgo: 30, durationDays: 1, many: false },
  { label: "CONTROL same category, different problem (sewage vs garbage)", category: "SANITATION", text: "Sewage drain overflowing onto the lane", place: "Demo Colony A", east: 40, north: -30, hoursAgo: 48, durationDays: 2, many: false },
  { label: "CONTROL same problem, 400 m away (outside 300 m radius)", category: "SANITATION", text: "Garbage not cleared near the park", place: "Demo Colony A annex", east: 400, north: 0, hoursAgo: 20, durationDays: 3, many: false },
  { label: "CONTROL same problem, same spot, 40 days earlier (outside time window)", category: "SANITATION", text: "Garbage dumped and not collected", place: "Demo Colony A", east: 30, north: 10, hoursAgo: 24 * 40, durationDays: 3, many: false },
  { label: "CONTROL far away, only 2 reports (below minimum of 3)", category: "SANITATION", text: "Garbage not being collected in our lane", place: "Demo Enclave D", east: 2500, north: -1800, hoursAgo: 15, durationDays: 2, many: false },
  { label: "CONTROL far away, only 2 reports (below minimum of 3)", category: "SANITATION", text: "Waste pile outside the school gate", place: "Demo Enclave D", east: 2530, north: -1820, hoursAgo: 12, durationDays: 2, many: false },
);

async function main() {
  await prisma.incident.deleteMany({ where: { isDemo: true } }); // links cascade
  await prisma.complaint.deleteMany({ where: { isDemo: true } });

  const now = Date.now();
  const ordered = [...items].sort((a, b) => b.hoursAgo - a.hoursAgo); // oldest first, like real arrival order
  const outcomes: { item: Item; action: string; reason?: string }[] = [];

  for (const it of ordered) {
    const p = offsetPoint(CENTER, it.east, it.north);
    const sev = computeSeverity({ category: it.category, durationDays: it.durationDays, dangerToLife: false, affectsMany: it.many, previousComplaint: null });
    const c = await prisma.complaint.create({
      data: {
        transcript: it.text, summary: it.text, source: "TEXT", category: it.category,
        severity: sev.severity, severityReasons: sev.reasons, language: "English",
        address: `${it.place} (simulated)`, latitude: p.lat, longitude: p.lng,
        durationDays: it.durationDays, durationText: it.durationDays ? `${it.durationDays} days` : null,
        status: "NEW", isDemo: true, createdAt: new Date(now - it.hoursAgo * 3_600_000),
      },
    });
    const r = await assignComplaint(c.id);
    outcomes.push({ item: it, action: r.action, reason: r.reason });
  }

  const incidents = await prisma.incident.findMany({ where: { isDemo: true }, orderBy: { reportCount: "desc" } });
  console.log(`\nSimulated demo data loaded: ${items.length} complaints.\n`);
  console.log("Incidents formed by the clustering engine:");
  for (const i of incidents) console.log(`  - ${i.title}: ${i.reportCount} reports (${i.severity})`);
  console.log("\nControl cases (each should stay standalone):");
  for (const o of outcomes.filter((x) => x.item.label)) {
    console.log(`  ${o.action === "standalone" ? "OK  " : "WARN"} ${o.item.label} -> ${o.action}${o.reason ? ` (${o.reason})` : ""}`);
  }
  console.log("\nExpected: incidents of 14 (garbage), 8 (water), 5 (potholes); all controls standalone.");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());