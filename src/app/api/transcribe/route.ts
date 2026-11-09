import { NextResponse } from "next/server";
import { allow } from "@/lib/rate-limit";
import { citizenMessage, transcribe } from "@/lib/gnani";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 3 * 1024 * 1024; // 29 s of 16 kHz mono WAV is ~0.9 MB

const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
  if (!allow(req, "transcribe", 8)) return fail("Too many requests. Please wait a minute.", 429);

  let form: FormData;
  try { form = await req.formData(); } catch { return fail("Invalid upload.", 400); }

  const audio = form.get("audio");
  const language = form.get("language");
  if (!(audio instanceof File)) return fail("No audio received.", 400);
  if (language !== "hi-IN" && language !== "en-IN") return fail("Unsupported language.", 400);
  if (audio.size < 1000) return fail("The recording was empty. Please try again.", 400);
  if (audio.size > MAX_BYTES) return fail("That recording is too large. Keep it under 30 seconds.", 413);

  // Verify it is really a WAV (RIFF....WAVE) rather than trusting the client's MIME type.
  const head = new Uint8Array(await audio.slice(0, 12).arrayBuffer());
  const ascii = (a: number, b: number) => String.fromCharCode(...head.slice(a, b));
  if (ascii(0, 4) !== "RIFF" || ascii(8, 12) !== "WAVE") return fail("Unsupported audio format.", 415);

  try {
    const { transcript } = await transcribe(new Blob([await audio.arrayBuffer()], { type: "audio/wav" }), language);
    if (!transcript) return fail("We couldn't hear any speech. Please speak closer to the microphone and try again.", 422);
    return NextResponse.json({ ok: true, transcript });
  } catch (e) {
    console.error("Transcription failed:", e);
    return fail(citizenMessage(e), 502);
  }
}
