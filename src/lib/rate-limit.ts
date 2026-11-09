// Best-effort per-IP limiter. In-memory, so it is per server instance (fine for a prototype).
const hits = new Map<string, number[]>();

export function allow(req: Request, bucket: string, max = 10, windowMs = 60_000) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) return false;
  recent.push(now);
  hits.set(key, recent);
  return true;
}
