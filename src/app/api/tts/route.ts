import { NextResponse } from "next/server";
import { allow } from "@/lib/rate-limit";
import { synthesize } from "@/lib/gnani";

export const runtime = "nodejs";
export const maxDuration = 30;

// Fixed phrases only: this endpoint is not an open text-to-speech proxy.
// Voices from the Timbre v2.5 catalog (Nalini = Hindi, Kaveri = English).
const PHRASES = {
  hi: { text: "आपकी शिकायत सफलतापूर्वक दर्ज हो गई है। धन्यवाद।", voice: "Nalini", language: "hi-IN" },
  en: { text: "Your complaint has been recorded successfully. Thank you.", voice: "Kaveri", language: "en-IN" },
} as const;

export async function POST(req: Request) {
  if (!allow(req, "tts", 6)) return NextResponse.json({ ok: false }, { status: 429 });
  const body = await req.json().catch(() => null);
  const p = PHRASES[body?.lang as keyof typeof PHRASES];
  if (!p) return NextResponse.json({ ok: false }, { status: 400 });
  try {
    const audio = await synthesize(p.text, p.voice, p.language);
    return new Response(audio, { headers: { "Content-Type": "audio/wav", "Cache-Control": "private, max-age=3600" } });
  } catch (e) {
    console.error("TTS failed:", e);
    return NextResponse.json({ ok: false }, { status: 502 });
  }
}
