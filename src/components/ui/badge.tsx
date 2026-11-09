import * as React from "react";
import { cn } from "@/lib/utils";

const tones = {
  neutral: "bg-muted text-foreground",
  info: "bg-blue-100 text-blue-900",
  success: "bg-green-100 text-green-900",
  warning: "bg-amber-100 text-amber-900",
  danger: "bg-red-100 text-red-900",
};

export function Badge({
  tone = "neutral", className, ...p
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone], className)} {...p} />
  );
}

export const severityTone = (s?: string | null) =>
  s === "CRITICAL" || s === "HIGH" ? "danger" : s === "MEDIUM" ? "warning" : s === "LOW" ? "success" : "neutral";
