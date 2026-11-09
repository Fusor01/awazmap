"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, Crosshair, Keyboard, Loader2, RotateCcw, Send, Volume2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge, severityTone } from "@/components/ui/badge";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { VoiceRecorder } from "./voice-recorder";
import { createComplaint } from "@/app/report/actions";
import { blobToWav16k } from "@/lib/wav";
import { computeSeverity } from "@/lib/severity";
import type { Extraction } from "@/lib/extract";
import {
  CATEGORIES, CATEGORY_LABELS, DURATION_UNITS, cn, durationToDays, label,
  type CategoryKey, type DurationUnit,
} from "@/lib/utils";

type Stage = "capture" | "transcribing" | "extracting" | "review";
type Coords = { lat: number; lng: number; acc: number };

const STT_LANGS = [
  { code: "hi-IN", name: "Hindi (हिन्दी)" },
  { code: "en-IN", name: "English / Hinglish (Latin script)" },
] as const;

async function postJson(url: string, body: unknown) {
  try {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return { res, data: await res.json().catch(() => null) };
  } catch {
    return { res: null, data: null };
  }
}

export function ReportForm() {
  const [stage, setStage] = useState<Stage>("capture");
  const [sttLang, setSttLang] = useState<"hi-IN" | "en-IN">("hi-IN");
  const [error, setError] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [extractFailedFor, setExtractFailedFor] = useState<string | null>(null);
  const wavRef = useRef<Blob | null>(null);

  const [showTyped, setShowTyped] = useState(false);
  const [typed, setTyped] = useState("");
  const [transcript, setTranscript] = useState("");
  const [source, setSource] = useState<"VOICE" | "TEXT">("VOICE");

  // Editable, AI-prefilled fields
  const [category, setCategory] = useState<CategoryKey>("OTHER");
  const [description, setDescription] = useState("");
  const [durValue, setDurValue] = useState("");
  const [durUnit, setDurUnit] = useState<DurationUnit>("days");
  const [danger, setDanger] = useState(false);
  const [many, setMany] = useState(false);
  const [previous, setPrevious] = useState<"yes" | "no" | "unknown">("unknown");
  const [language, setLanguage] = useState<string>("Hindi");
  const [address, setAddress] = useState("");

  const [coords, setCoords] = useState<Coords | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [locConfirmed, setLocConfirmed] = useState(false);

  const [saved, setSaved] = useState<string | null>(null);
  const [community, setCommunity] = useState<{ reportCount: number; created: boolean } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [speaking, setSpeaking] = useState(false);
  const [ttsFailed, setTtsFailed] = useState(false);

  const busy = stage === "transcribing" || stage === "extracting";
  const durNum = durValue.trim() === "" ? null : Number(durValue);
  const durValid = durNum === null || (Number.isFinite(durNum) && durNum > 0 && durNum <= 1000);
  const prevBool = previous === "yes" ? true : previous === "no" ? false : null;

  const sev = useMemo(
    () => computeSeverity({
      category, durationDays: durValid ? durationToDays(durNum, durUnit) : null,
      dangerToLife: danger, affectsMany: many, previousComplaint: prevBool,
    }),
    [category, durNum, durUnit, durValid, danger, many, prevBool]
  );

  function applyExtraction(e: Extraction) {
    setCategory(e.category);
    setDescription(e.description);
    setDurValue(e.durationValue ? String(e.durationValue) : "");
    setDurUnit(e.durationUnit ?? "days");
    setDanger(e.dangerToLife);
    setMany(e.affectsMany);
    setPrevious(e.previousComplaint === true ? "yes" : e.previousComplaint === false ? "no" : "unknown");
    setLanguage(e.language);
    setAddress(e.locationText);
  }

  async function runExtraction(text: string) {
    setStage("extracting");
    setError(null);
    const { res, data } = await postJson("/api/extract", { transcript: text });
    if (res?.ok && data?.ok) {
      applyExtraction(data.extraction as Extraction);
      setExtractFailedFor(null);
      setStage("review");
    } else {
      setError(data?.error ?? "Couldn't reach the AI service. You can fill in the details yourself.");
      setExtractFailedFor(text);
      setStage("capture");
    }
  }

  function fillManually(text: string) {
    applyExtraction({
      category: "OTHER", description: text.slice(0, 500), locationText: "", durationValue: null,
      durationUnit: null, language: sttLang === "hi-IN" ? "Hindi" : "English",
      previousComplaint: null, dangerToLife: false, affectsMany: false,
    });
    setError(null);
    setExtractFailedFor(null);
    setStage("review");
  }

  async function sendAudio(wav: Blob) {
    setStage("transcribing");
    setError(null);
    setCanRetry(false);
    const fd = new FormData();
    fd.append("audio", wav, "recording.wav");
    fd.append("language", sttLang);
    let data: any = null;
    let ok = false;
    try {
      const res = await fetch("/api/transcribe", { method: "POST", body: fd });
      data = await res.json().catch(() => null);
      ok = res.ok && data?.ok;
    } catch {}
    if (!ok) {
      setError(data?.error ?? "Couldn't reach the server. Check your connection and try again.");
      setCanRetry(true);
      setStage("capture");
      return;
    }
    setTranscript(data.transcript);
    setSource("VOICE");
    await runExtraction(data.transcript);
  }

  async function handleRecorded(blob: Blob) {
    setStage("transcribing");
    setError(null);
    try {
      const wav = await blobToWav16k(blob);
      wavRef.current = wav;
      await sendAudio(wav);
    } catch {
      setError("We couldn't process that recording. Please record again or type your complaint.");
      setStage("capture");
    }
  }

  function resetAll() {
    wavRef.current = null;
    setTranscript(""); setError(null); setCanRetry(false); setExtractFailedFor(null);
    setStage("capture"); setCoords(null); setLocConfirmed(false); setAddress("");
  }

  async function submitTyped() {
    const text = typed.trim();
    if (text.length < 5) return setError("Please type at least a few words.");
    setTranscript(text);
    setSource("TEXT");
    await runExtraction(text);
  }

  function locate() {
    setLocError(null);
    setLocConfirmed(false);
    if (!navigator.geolocation) return setLocError("Location isn't available in this browser.");
    navigator.geolocation.getCurrentPosition(
      (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy) }),
      () => setLocError("Couldn't get your location. Please allow location access."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!durValid) return setSubmitError("Duration must be a positive number.");
    if (!coords) return setSubmitError("Please capture your location first.");
    startTransition(async () => {
      const res = await createComplaint({
        transcript, source, category, description, language,
        durationValue: durNum, durationUnit: durNum ? durUnit : null,
        dangerToLife: danger, affectsMany: many, previousComplaint: prevBool,
        address, latitude: coords.lat, longitude: coords.lng, locationConfirmed: locConfirmed,
      });
      if (res.ok) { setSaved(res.id); setCommunity(res.community); }
      else setSubmitError(res.error);
    });
  }

  async function playConfirmation() {
    setSpeaking(true);
    setTtsFailed(false);
    try {
      const res = await fetch("/api/tts", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ lang: language === "English" ? "en" : "hi" }),
      });
      if (!res.ok) throw new Error();
      const url = URL.createObjectURL(await res.blob());
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch {
      setTtsFailed(true);
    } finally {
      setSpeaking(false);
    }
  }

  if (saved) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
          <CheckCircle2 className="h-12 w-12 text-success" aria-hidden />
          <h2 className="text-xl font-semibold">Your report was submitted</h2>
          {community && (
            <p role="status" className="max-w-sm rounded-md bg-muted p-3 text-sm">
              {community.created
                ? `Community Signal: your report and ${community.reportCount - 1} similar nearby report(s) now form a community incident.`
                : `Community Signal: your report joined a community incident with ${community.reportCount} reports.`}
            </p>
          )}
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link href={`/report/${saved}`} className={cn(buttonVariants({ variant: "accent" }))}>View saved report</Link>
            <Button variant="outline" onClick={playConfirmation} disabled={speaking}>
              {speaking ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Volume2 className="h-4 w-4" aria-hidden />}
              Hear confirmation
            </Button>
          </div>
          {ttsFailed && <p role="alert" className="text-sm text-muted-foreground">Spoken confirmation isn't available right now.</p>}
          <Button variant="ghost" onClick={() => { setSaved(null); setCommunity(null); resetAll(); setTyped(""); }}>Submit another report</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle>1. Speak your complaint</CardTitle>
          <CardDescription>Up to 30 seconds. Say what the problem is, where, and for how long.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <Label htmlFor="stt-lang">Language you will speak</Label>
            <Select id="stt-lang" value={sttLang} disabled={busy || stage === "review"} onChange={(e) => setSttLang(e.target.value as "hi-IN" | "en-IN")}>
              {STT_LANGS.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
            </Select>
          </div>
          <VoiceRecorder onRecorded={handleRecorded} onReset={resetAll} disabled={busy} />

          {stage === "transcribing" && <p role="status" className="flex items-center justify-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Transcribing your voice…</p>}
          {stage === "extracting" && <p role="status" className="flex items-center justify-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Reading your complaint…</p>}

          {error && (
            <div role="alert" className="flex flex-col gap-2 rounded-md bg-red-100 p-3 text-sm text-red-900">
              <p>{error}</p>
              <div className="flex flex-wrap gap-2">
                {canRetry && wavRef.current && (
                  <Button type="button" size="sm" variant="outline" onClick={() => sendAudio(wavRef.current!)}>
                    <RotateCcw className="h-4 w-4" aria-hidden /> Try again
                  </Button>
                )}
                {extractFailedFor && (
                  <Button type="button" size="sm" variant="outline" onClick={() => fillManually(extractFailedFor)}>Continue and fill in manually</Button>
                )}
              </div>
            </div>
          )}

          {stage !== "review" && (
            <div className="border-t pt-3">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowTyped((v) => !v)} aria-expanded={showTyped}>
                <Keyboard className="h-4 w-4" aria-hidden /> Can't use voice? Type instead
              </Button>
              {showTyped && (
                <div className="mt-3 flex flex-col gap-3">
                  <Label htmlFor="typed">Describe the problem</Label>
                  <Textarea id="typed" value={typed} onChange={(e) => setTyped(e.target.value)} maxLength={2000} disabled={busy}
                    placeholder="e.g. पिछले तीन दिन से हमारे मोहल्ले में पानी नहीं आ रहा…" />
                  <Button type="button" variant="outline" onClick={submitTyped} disabled={busy}>Analyze my complaint</Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {stage === "review" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>2. What we heard</CardTitle>
              <CardDescription>{source === "VOICE" ? "Original transcript from your voice (not editable)." : "The text you typed."}</CardDescription>
            </CardHeader>
            <CardContent>
              <blockquote className="whitespace-pre-wrap rounded-md bg-muted p-3 text-base" lang={sttLang === "hi-IN" ? "hi" : "en"}>{transcript}</blockquote>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3. Check the details</CardTitle>
              <CardDescription>AI filled this in from your words. Fix anything that's wrong.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div>
                <Label htmlFor="category">Category</Label>
                <Select id="category" value={category} onChange={(e) => setCategory(e.target.value as CategoryKey)}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                </Select>
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} minLength={10} maxLength={500} required />
              </div>
              <div>
                <Label htmlFor="dur-value">How long has this been going on? (optional)</Label>
                <div className="flex gap-2">
                  <Input id="dur-value" type="number" inputMode="decimal" min="0" step="any" className="w-28" value={durValue} onChange={(e) => setDurValue(e.target.value)} />
                  <Select aria-label="Duration unit" value={durUnit} onChange={(e) => setDurUnit(e.target.value as DurationUnit)}>
                    {DURATION_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </Select>
                </div>
                {!durValid && <p role="alert" className="mt-1 text-sm text-destructive">Enter a positive number.</p>}
              </div>
              <div>
                <Label htmlFor="previous">Have you reported this before?</Label>
                <Select id="previous" value={previous} onChange={(e) => setPrevious(e.target.value as typeof previous)}>
                  <option value="unknown">Not sure / not mentioned</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </Select>
              </div>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-medium">Does this apply?</legend>
                <label className="flex items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5" checked={danger} onChange={(e) => setDanger(e.target.checked)} /> Immediate danger to people (live wire, open manhole, flooding, fire…)</label>
                <label className="flex items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5" checked={many} onChange={(e) => setMany(e.target.checked)} /> Affects many people (street, colony, area)</label>
              </fieldset>

              <div className="rounded-md border p-3" aria-live="polite">
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  Priority: <Badge tone={severityTone(sev.severity)}>{label(sev.severity)}</Badge>
                </p>
                {sev.reasons.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No priority factors selected.</p>
                ) : (
                  <ul className="list-disc pl-5 text-sm text-muted-foreground">{sev.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
                )}
                <p className="mt-2 text-xs text-muted-foreground">Set by fixed rules from the details above, not by AI.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>4. Confirm location</CardTitle>
              <CardDescription>Your device location is used only to place this report on the map.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div>
                <Label htmlFor="address">Landmark or locality (optional)</Label>
                <Input id="address" value={address} maxLength={300} onChange={(e) => setAddress(e.target.value)} placeholder="Near City Hospital, Sector 5" />
                {address && <p className="mt-1 text-xs text-muted-foreground">Taken from your words. Please check it is correct.</p>}
              </div>
              <Button type="button" variant="outline" onClick={locate}>
                <Crosshair className="h-4 w-4" aria-hidden /> {coords ? "Update my location" : "Use my current location"}
              </Button>
              {coords && (
                <div role="status" className="rounded-md bg-muted p-3 text-sm">
                  <p>Location captured: <span className="font-mono">{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</span> (±{coords.acc} m)</p>
                  {coords.acc > 100 && <p className="mt-1 text-warning">Low accuracy. Move outdoors and tap "Update my location".</p>}
                </div>
              )}
              {locError && <p role="alert" className="text-sm text-destructive">{locError}</p>}
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" className="mt-0.5 h-5 w-5" disabled={!coords} checked={locConfirmed} onChange={(e) => setLocConfirmed(e.target.checked)} />
                I confirm the problem is at or near this location.
              </label>
            </CardContent>
          </Card>

          {submitError && <p role="alert" className="rounded-md bg-red-100 p-3 text-sm text-red-900">{submitError}</p>}
          <Button type="submit" size="lg" variant="accent" disabled={pending || !coords || !locConfirmed}>
            {pending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Send className="h-5 w-5" aria-hidden />}
            {pending ? "Submitting…" : "Submit report"}
          </Button>
        </>
      )}
    </form>
  );
}