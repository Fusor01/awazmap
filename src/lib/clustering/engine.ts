// Pure decision helpers (no database), so the rules are easy to read and test.
import { CLUSTER_CONFIG as C } from "./config";

export const SEVERITY_ORDER = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type SeverityName = (typeof SEVERITY_ORDER)[number];

const rank = (s?: string | null) => Math.max(0, SEVERITY_ORDER.indexOf((s ?? "LOW") as SeverityName));

/** Incident severity: highest linked report, raised to HIGH at 10+ reports and CRITICAL at 25+. */
export function rollupSeverity(severities: (string | null | undefined)[], count: number) {
  let r = severities.reduce((m, s) => Math.max(m, rank(s)), 0);
  const reasons = [`Highest severity among linked reports: ${SEVERITY_ORDER[r]}`];
  if (count >= C.severityEscalation.criticalAt && r < 3) {
    r = 3;
    reasons.push(`${count} supporting reports (${C.severityEscalation.criticalAt}+) raise it to CRITICAL`);
  } else if (count >= C.severityEscalation.highAt && r < 2) {
    r = 2;
    reasons.push(`${count} supporting reports (${C.severityEscalation.highAt}+) raise it to HIGH`);
  }
  return { severity: SEVERITY_ORDER[r] as SeverityName, reasons };
}

/** Days between a report time and an incident's [first, latest] span (0 if inside it). */
export function daysOutside(at: Date, first: Date, latest: Date): number {
  const t = at.getTime();
  const ms = t < first.getTime() ? first.getTime() - t : t > latest.getTime() ? t - latest.getTime() : 0;
  return ms / 86_400_000;
}

/** The single yes/no rule for "may these be related?". Category is checked by the caller. */
export function withinThresholds(m: { distanceM: number; daysApart: number; textScore: number }) {
  return m.distanceM <= C.radiusMeters && m.daysApart <= C.windowDays && m.textScore >= C.minTextSimilarity;
}