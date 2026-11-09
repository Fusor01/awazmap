import type { CategoryKey } from "@/lib/utils";

export type SeverityKey = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type SeveritySignals = {
  category: CategoryKey;
  durationDays: number | null;
  dangerToLife: boolean;
  affectsMany: boolean;
  previousComplaint: boolean | null;
};

const ESSENTIAL: CategoryKey[] = ["WATER", "ELECTRICITY", "SANITATION"];

/**
 * Transparent, deterministic severity rules (no AI involved).
 * Points: danger to life +5 · essential service +1 · ongoing 1-2 days +1,
 * 3-6 days +2, 7+ days +3 · affects many people +1 · already reported +1.
 * Score: >=5 CRITICAL, 3-4 HIGH, 2 MEDIUM, otherwise LOW.
 * Runs in the browser (live preview) and again on the server at submit.
 */
export function computeSeverity(s: SeveritySignals) {
  let score = 0;
  const reasons: string[] = [];
  const add = (pts: number, why: string) => {
    score += pts;
    reasons.push(`${why} (+${pts})`);
  };

  if (s.dangerToLife) add(5, "Immediate danger to people");
  if (ESSENTIAL.includes(s.category)) add(1, "Essential service affected");
  if (s.durationDays !== null) {
    if (s.durationDays >= 7) add(3, `Ongoing for ${s.durationDays} days`);
    else if (s.durationDays >= 3) add(2, `Ongoing for ${s.durationDays} days`);
    else if (s.durationDays >= 1) add(1, `Ongoing for ${s.durationDays} day${s.durationDays > 1 ? "s" : ""}`);
  }
  if (s.affectsMany) add(1, "Affects many people");
  if (s.previousComplaint === true) add(1, "Already reported before");

  const severity: SeverityKey = score >= 5 ? "CRITICAL" : score >= 3 ? "HIGH" : score >= 2 ? "MEDIUM" : "LOW";
  return { severity, score, reasons };
}
