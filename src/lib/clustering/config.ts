// Community Signal thresholds. Every clustering decision is made from these numbers (no hidden rules).
export const CLUSTER_CONFIG = {
  /** A complaint may join an incident only if it is within this distance of the incident's centre. */
  radiusMeters: 300,
  /** ...and was reported within this many days of the incident's first/last report. */
  windowDays: 14,
  /** ...and its text is at least this similar (0-1) to a report already in the incident. */
  minTextSimilarity: 0.3,
  /** A new incident is only created when at least this many related complaints exist. */
  minReportsToForm: 3,
  /** "OTHER" is too vague to group safely, so it is never clustered. */
  clusterableCategories: ["ROADS", "WATER", "SANITATION", "ELECTRICITY", "SAFETY", "TRANSPORT"],
  /** Incident severity = highest linked report, raised by volume. */
  severityEscalation: { highAt: 10, criticalAt: 25 },
} as const;

export const isClusterable = (category: string) =>
  (CLUSTER_CONFIG.clusterableCategories as readonly string[]).includes(category);