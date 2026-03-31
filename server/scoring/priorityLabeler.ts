/**
 * PHASE 5 — priorityLabeler.ts
 * ==============================
 * Converts a LeadScore into DB-writable priority fields.
 *
 * Design principles:
 *  - Writes ONLY to: priority, primaryOpportunity, secondaryOpportunity
 *  - Does NOT touch: dataQualityScore, aiConfidenceScore, analysisConfidenceScore
 *  - Respects manual review: if manualReviewStatus === "approved", priority is NOT overwritten
 *  - Deterministic mapping: A/B → "high", C → "medium", D → "low"
 *
 * Priority mapping:
 *  A (75–100) → "high"
 *  B (50–74)  → "high"
 *  C (25–49)  → "medium"
 *  D (0–24)   → "low"
 *
 * DB fields written:
 *  - leads.priority          (enum: "high" | "medium" | "low")
 *  - leads.primaryOpportunity   (text: opportunity type string)
 *  - leads.secondaryOpportunity (text: opportunity type string | null)
 */

import type { LeadScore, LeadOpportunity } from "../../shared/types/lead-intelligence";
import { getDb } from "../db";
import { leads } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PriorityLabelResult = {
  leadId: number;
  /** Whether the DB was actually updated */
  updated: boolean;
  /** Reason if update was skipped */
  skipReason?: string;
  /** The DB priority value that was written (or would have been written) */
  dbPriority: "high" | "medium" | "low";
  /** The LeadScore priority label */
  scorePriority: LeadScore["priority"];
  /** The primary opportunity type written */
  primaryOpportunity: string | null;
  /** The secondary opportunity type written */
  secondaryOpportunity: string | null;
};

export type PriorityLabelerInput = {
  leadId: number;
  score: LeadScore;
  opportunities: LeadOpportunity[];
  /** Current manualReviewStatus from DB — if "approved", skip priority update */
  manualReviewStatus: string | null | undefined;
};

// ─── Mappers ──────────────────────────────────────────────────────────────────

/**
 * Maps LeadScore priority (A/B/C/D) to DB enum value.
 */
export function mapScorePriorityToDb(
  scorePriority: LeadScore["priority"]
): "high" | "medium" | "low" {
  switch (scorePriority) {
    case "A":
    case "B":
      return "high";
    case "C":
      return "medium";
    case "D":
      return "low";
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * applyPriorityLabel — writes scoring results to DB
 *
 * Writes:
 *  - leads.priority
 *  - leads.primaryOpportunity
 *  - leads.secondaryOpportunity
 *
 * Does NOT write:
 *  - dataQualityScore
 *  - aiConfidenceScore
 *  - analysisConfidenceScore
 *  - Any other field
 *
 * Skips update if manualReviewStatus === "approved".
 */
export async function applyPriorityLabel(
  input: PriorityLabelerInput
): Promise<PriorityLabelResult> {
  const { leadId, score, opportunities, manualReviewStatus } = input;

  const dbPriority = mapScorePriorityToDb(score.priority);
  const primaryOpportunity = opportunities[0]?.type ?? null;
  const secondaryOpportunity = opportunities[1]?.type ?? null;

  // Guard: do not overwrite manually approved leads
  if (manualReviewStatus === "approved") {
    return {
      leadId,
      updated: false,
      skipReason: "manual_review_approved",
      dbPriority,
      scorePriority: score.priority,
      primaryOpportunity,
      secondaryOpportunity,
    };
  }

  const db = await getDb();
  if (!db) {
    return {
      leadId,
      updated: false,
      skipReason: "db_unavailable",
      dbPriority,
      scorePriority: score.priority,
      primaryOpportunity,
      secondaryOpportunity,
    };
  }

  // Write priority + scoring fields
  await db
    .update(leads)
    .set({
      priority: dbPriority,
      primaryOpportunity: primaryOpportunity ?? undefined,
      secondaryOpportunity: secondaryOpportunity ?? undefined,
      // حفظ نتيجة التقييم كاملة لتبقى عند reload
      leadPriorityScore: score.value,
      scoringValue: score.value,
      scoringPriority: score.priority,
      scoringReasons: score.reasons,
      scoringBreakdown: score.breakdown as Record<string, number>,
      scoringOpportunities: opportunities.map(o => ({
        id: o.id,
        type: o.type,
        severity: o.severity,
        evidence: o.evidence,
        businessImpact: o.businessImpact,
        suggestedAction: o.suggestedAction,
      })),
      scoringRunAt: Date.now(),
    })
    .where(eq(leads.id, leadId));

  return {
    leadId,
    updated: true,
    dbPriority,
    scorePriority: score.priority,
    primaryOpportunity,
    secondaryOpportunity,
  };
}
