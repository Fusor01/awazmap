"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Status = "idle" | "recording" | "recorded" | "denied" | "unsupported";

const STATUS_TEXT: Record<Status, string> = {
  idle: "Tap the microphone and describe the problem",
  recording: "Recording… tap to stop",
  recorded: "Recording captured",
  denied: "Microphone access was blocked. Allow it in your browser settings, or type your complaint instead.",
  unsupported: "Recording isn't supported in this browser. Please type your complaint instead.",
};

// Gnani's REST endpoint accepts at most 30 s of audio.
const MAX_SECONDS = 29;

export function VoiceRecorder({
  onRecorded, onReset, disabled,
}: { onRecorded: (blob: Blob) => void; onReset: () => void; disabled?: boolean }) {
  const [status, setStatus] = useState<Status>("idle");
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsed = useRef(0);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);

  async function start() {
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: rec.mimeType });
        setAudioUrl(URL.createObjectURL(blob));
        setStatus("recorded");
        onRecorded(blob);
      };
      rec.start();
      recorder.current = rec;
      elapsed.current = 0;
      setSeconds(0);
      setStatus("recording");
      timer.current = setInterval(() => {
        elapsed.current += 1;
        setSeconds(elapsed.current);
        if (elapsed.current >= MAX_SECONDS) stop();
      }, 1000);
    } catch {
      setStatus("denied");
    }
  }

  function stop() {
    if (timer.current) clearInterval(timer.current);
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  function reset() {
    setAudioUrl(null);
    setSeconds(0);
    setStatus("idle");
    onReset();
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const recording = status === "recording";

  return (
    <div className="flex flex-col items-center gap-4 py-2">
      <button
        type="button"
        onClick={recording ? stop : start}
        disabled={disabled || status === "recorded"}
        aria-label={recording ? "Stop recording" : "Start recording"}
        aria-pressed={recording}
        aria-describedby="recorder-status"
        className={cn(
          "grid h-28 w-28 place-items-center rounded-full text-white shadow-lg transition-transform active:scale-95 disabled:opacity-50",
          recording ? "animate-pulse bg-destructive" : "bg-accent hover:bg-accent/90"
        )}
      >
        {recording ? <Square className="h-10 w-10" aria-hidden /> : <Mic className="h-12 w-12" aria-hidden />}
      </button>
      <p id="recorder-status" role="status" aria-live="polite" className="text-center text-sm font-medium">{STATUS_TEXT[status]}</p>
      {(recording || status === "recorded") && (
        <p className="font-mono text-2xl tabular-nums" aria-label="Recording duration">
          {mm}:{ss} <span className="text-sm text-muted-foreground">/ 00:{MAX_SECONDS}</span>
        </p>
      )}
      {status === "recorded" && audioUrl && (
        <div className="flex w-full flex-col items-center gap-3">
          <audio controls src={audioUrl} className="w-full max-w-sm" />
          <Button type="button" variant="outline" size="sm" onClick={reset} disabled={disabled}>
            <RotateCcw className="h-4 w-4" aria-hidden /> Record again
          </Button>
        </div>
      )}
    </div>
  );
}