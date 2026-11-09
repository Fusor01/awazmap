"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { CATEGORIES, DURATION_UNITS, durationText, durationToDays } from "@/lib/utils";
import { computeSeverity } from "@/lib/severity";
import { assignComplaint } from "@/lib/clustering/assign";

export type CommunityInfo = { reportCount: number; created: boolean } | null;
export type SubmitResult = { ok: true; id: string; community: CommunityInfo } | { ok: false; error: string };

const Input = z.object({
  transcript: z.string().trim().min(5, "The original complaint text is missing.").max(2000),
  source: z.enum(["VOICE", "TEXT"]),
  category: z.enum(CATEGORIES),
  description: z.string().trim().min(10, "Please describe the problem in at least 10 characters.").max(500),
  language: z.string().trim().max(20).nullable(),
  durationValue: z.number().positive().max(1000).nullable(),
  durationUnit: z.enum(DURATION_UNITS).nullable(),
  dangerToLife: z.boolean(),
  affectsMany: z.boolean(),
  previousComplaint: z.boolean().nullable(),
  address: z.string().trim().max(300),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  locationConfirmed: z.literal(true, { errorMap: () => ({ message: "Please confirm the location before submitting." }) }),
});

export async function createComplaint(raw: unknown): Promise<SubmitResult> {
  const parsed = Input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid submission." };
  const d = parsed.data;

  // Severity is always recomputed on the server from the final, citizen-edited values.
  const durationDays = durationToDays(d.durationValue, d.durationUnit);
  const sev = computeSeverity({
    category: d.category, durationDays, dangerToLife: d.dangerToLife,
    affectsMany: d.affectsMany, previousComplaint: d.previousComplaint,
  });

  try {
    const c = await prisma.complaint.create({
      data: {
        transcript: d.transcript,
        source: d.source,
        summary: d.description,
        category: d.category,
        severity: sev.severity,
        severityReasons: sev.reasons,
        language: d.language,
        durationText: durationText(d.durationValue, d.durationUnit),
        durationDays,
        previousComplaint: d.previousComplaint,
        address: d.address || null,
        latitude: d.latitude,
        longitude: d.longitude,
      },
    });
    // Community Signal: group with related complaints. The complaint is already saved, so a failure here must not fail the submission.
    let community: CommunityInfo = null;
    try {
      const r = await assignComplaint(c.id);
      if ((r.action === "joined" || r.action === "created") && r.reportCount) {
        community = { reportCount: r.reportCount, created: r.action === "created" };
      }
    } catch (e) {
      console.error("Community clustering failed (complaint is saved):", e);
    }
    return { ok: true, id: c.id, community };
  } catch (e) {
    console.error("createComplaint failed:", e);
    return { ok: false, error: "Could not save your report. Please try again." };
  }
}