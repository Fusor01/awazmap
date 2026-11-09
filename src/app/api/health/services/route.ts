import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { synthesize } from "@/lib/gnani";

// Protected deployment check: /api/health/services?token=<HEALTH_TOKEN>
// Tests the database, Gnani text-to-speech (one tiny paid call) and Groq (free model-list call).
// Speech-to-text needs real audio, so verify it with an actual recording.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function timed(fn: () => Promise<string>) {
  const t = Date.now();
  try {
    return { ok: true, ms: Date.now() - t, detail: await fn() };
  } catch (e) {
    return { ok: false, ms: Date.now() - t, detail: e instanceof Error ? e.message.slice(0, 160) : "failed" };
  }
}

export async function GET(req: Request) {
  const expected = process.env.HEALTH_TOKEN;
  if (!expected) return new NextResponse("Not found", { status: 404 });
  if (new URL(req.url).searchParams.get("token") !== expected) return new NextResponse("Unauthorized", { status: 401 });

  const [database, gnani_tts, groq] = await Promise.all([
    timed(async () => { await prisma.$queryRaw`SELECT 1`; return "connected"; }),
    timed(async () => {
      const audio = await synthesize("ठीक है", "Nalini", "hi-IN");
      if (audio.byteLength < 1000) throw new Error("audio too small");
      return `${audio.byteLength} bytes of audio`;
    }),
    timed(async () => {
      const key = process.env.GROQ_API_KEY;
      if (!key) throw new Error("GROQ_API_KEY not set");
      const res = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return "key accepted";
    }),
  ]);
  const ok = database.ok && gnani_tts.ok && groq.ok;
  return NextResponse.json({ ok, checks: { database, gnani_tts, groq }, note: "Speech-to-text is verified by a real recording." }, { status: ok ? 200 : 503 });
}