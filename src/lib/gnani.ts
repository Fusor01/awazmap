// Server-only Gnani client. Endpoints/params verified against https://docs.gnani.ai
// STT: POST https://api.vachana.ai/stt/v3 (multipart, header X-API-Key-ID, default model = Prisma v2.5)
// TTS: POST https://api.vachana.ai/api/v1/tts/inference (JSON, model "timbre-v2.5", returns binary audio)
const BASE = "https://api.vachana.ai";

export class GnaniError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

function key() {
  const k = process.env.GNANI_API_KEY;
  if (!k) throw new GnaniError(500, "NOT_CONFIGURED", "GNANI_API_KEY is not set");
  return k;
}

async function toError(res: Response) {
  // Gnani uses three error shapes: {error:{type,message}}, {detail:{error_code,message}}, {message}
  let body: any = null;
  try { body = await res.json(); } catch {}
  const code = body?.error?.type ?? body?.detail?.error_code ?? body?.code ?? `HTTP_${res.status}`;
  const msg = body?.error?.message ?? body?.detail?.message ?? body?.message ?? res.statusText;
  return new GnaniError(res.status, String(code), String(msg));
}

export async function transcribe(wav: Blob, languageCode: "hi-IN" | "en-IN") {
  const fd = new FormData();
  fd.append("audio_file", wav, "recording.wav");
  fd.append("language_code", languageCode); // format omitted => verbatim (raw spoken form)
  const res = await fetch(`${BASE}/stt/v3`, {
    method: "POST",
    headers: { "X-API-Key-ID": key() },
    body: fd,
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw await toError(res);
  const data = await res.json();
  return { transcript: String(data?.transcript ?? "").trim(), model: String(data?.model ?? "prisma-v2.5") };
}

export async function synthesize(text: string, voice: string, language: "hi-IN" | "en-IN") {
  const res = await fetch(`${BASE}/api/v1/tts/inference`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key-ID": key() },
    body: JSON.stringify({
      text, voice, model: "timbre-v2.5", language, speed: 1.0,
      audio_config: { sample_rate: 24000, num_channels: 1, sample_width: 2, encoding: "linear_pcm", container: "wav" },
    }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw await toError(res);
  return res.arrayBuffer();
}

/** Citizen-safe message for a Gnani failure (details are logged server-side only). */
export function citizenMessage(e: unknown) {
  if (e instanceof GnaniError) {
    if (e.code === "MAX_AUDIO_DURATION_EXCEEDED") return "That recording is too long. Please keep it under 30 seconds.";
    if (e.code === "EMPTY_AUDIO" || e.code === "AUDIO_CONVERSION_ERROR") return "We couldn't read that recording. Please record again.";
    if (e.status === 429) return "The speech service is busy. Please wait a few seconds and try again.";
  }
  if (e instanceof DOMException && e.name === "TimeoutError") return "The speech service took too long. Please try again.";
  return "The speech service is unavailable right now. You can type your complaint instead.";
}
