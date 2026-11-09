import { NextResponse } from "next/server";
import { allow } from "@/lib/rate-limit";
import { extractComplaint } from "@/lib/extract";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  if (!allow(req, "extract", 12)) {
    return NextResponse.json({ ok: false, error: "Too many requests. Please wait a minute." }, { status: 429 });
  }
  const body = await req.json().catch(() => null);
  const transcript = typeof body?.transcript === "string" ? body.transcript.trim() : "";
  if (transcript.length < 5 || transcript.length > 2000) {
    return NextResponse.json({ ok: false, error: "Complaint text must be 5-2000 characters." }, { status: 400 });
  }
  const result = await extractComplaint(transcript);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
