/**
 * PHASE 5 — scoring/index.ts
 * ============================
 * Orchestrates the full scoring pipeline for a single lead.
 *
 * Pipeline steps:
 *   1. fetchLead(leadId) — fresh read from DB
 *   2. runAuditEngine(leadId) — get AuditEngineResult
 *   3. detectMissingFields(lead) — get MissingFieldsResult
 *   4. computeAnalysisReadiness(missing) — get AnalysisReadinessResult
 *   5. extractOpportunities(auditResult) — get LeadOpportunity[]
 *   6. computeLeadScore(lead, opportunities, readinessState) — get LeadScore
 *   7. applyPriorityLabel(leadId, score, opportunities, manualReviewStatus) — write to DB
 *
 * Observability:
 *   - Structured log on success: [SCORING] SCORING_DONE leadId=N score=X priority=Y opportunities=Z
 *   - Structured log on skip:    [SCORING] SCORING_SKIPPED leadId=N reason=<reason>
 *   - Structured log on failure: [SCORING] SCORING_FAILED leadId=N step=<step> error=<message>
 *
 * Constraints:
 *   - MANUAL TRIGGER ONLY — not auto-wired into enrichment pipeline (PHASE 5 constraint)
 *   - Fallback: each step failure is caught individually — pipeline does not abort on partial failure
 *   - Does NOT touch: dataQualityScore, aiConfidenceScore, analysisConfidenceScore
 *   - Does NOT touch: enrichment pipeline, WhatChimp integration
 */

import { getDb } from "../db";
import { leads } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { runAuditEngine } from "../enrichment/auditEngine";
import { detectMissingFields } from "../autofill/detectMissingFields";
import { computeAnalysisReadiness } from "../autofill/computeAnalysisReadiness";
import { extractOpportunities } from "./opportunityEngine";
import { computeLeadScore } from "./leadScorer";
import { applyPriorityLabel } from "./priorityLabeler";
import type { LeadOpportunity, LeadScore } from "../../shared/types/lead-intelligence";
import type { AuditEngineResult } from "../enrichment/auditEngine";
import type { AnalysisReadinessState } from "../autofill/computeAnalysisReadiness";

// ─── Result type ──────────────────────────────────────────────────────────────

export type ScoringPipelineResult = {
  leadId: number;
  success: boolean;
  /** Steps that completed successfully */
  completedSteps: string[];
  /** Steps that failed with their errors */
  failedSteps: Array<{ step: string; error: string }>;
  /** The computed score (null if scoring step failed) */
  score: LeadScore | null;
  /** The extracted opportunities */
  opportunities: LeadOpportunity[];
  /** The readiness state used for scoring */
  readinessState: AnalysisReadinessState | null;
  /** Whether the DB was actually updated */
  dbUpdated: boolean;
  /** Reason if DB update was skipped */
  dbSkipReason?: string;
};

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * runScoringPipeline — manual trigger only
 *
 * Runs the full scoring pipeline for a lead.
 * Each step is independently error-handled — partial failures are logged but do not abort.
 * Returns a structured result with per-step observability.
 */
export async function runScoringPipeline(leadId: number): Promise<ScoringPipelineResult> {
  const completedSteps: string[] = [];
  const failedSteps: Array<{ step: string; error: string }> = [];

  let score: LeadScore | null = null;
  let opportunities: LeadOpportunity[] = [];
  let readinessState: AnalysisReadinessState | null = null;
  let dbUpdated = false;
  let dbSkipReason: string | undefined;

  // ── Step 1: Fetch lead ────────────────────────────────────────────────────
  let lead: Record<string, unknown> | null = null;
  try {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const rows = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
    if (!rows.length) throw new Error(`Lead not found: ${leadId}`);
    lead = rows[0] as Record<string, unknown>;
    completedSteps.push("fetch_lead");
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    failedSteps.push({ step: "fetch_lead", error });
    console.error(`[SCORING] SCORING_FAILED leadId=${leadId} step=fetch_lead error=${error}`);
    return {
      leadId,
      success: false,
      completedSteps,
      failedSteps,
      score: null,
      opportunities: [],
      readinessState: null,
      dbUpdated: false,
      dbSkipReason: "lead_fetch_failed",
    };
  }

  // ── Step 2: Run audit engine ──────────────────────────────────────────────
  let auditResult: AuditEngineResult | null = null;
  try {
    auditResult = await runAuditEngine(leadId);
    completedSteps.push("audit_engine");
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    failedSteps.push({ step: "audit_engine", error });
    console.error(`[SCORING] SCORING_FAILED leadId=${leadId} step=audit_engine error=${error}`);
    // Continue with empty audit — scoring will still run with reduced quality
    auditResult = {
      seoAudit: { present: [], missing: [], confidence: "low" },
      socialAudit: { present: [], missing: [], confidence: "low" },
      conversionAudit: { present: [], missing: [], confidence: "low" },
      marketAudit: { present: [], missing: [], confidence: "low" },
    };
  }

  // ── Step 3: Detect missing fields ─────────────────────────────────────────
  let missingResult = null;
  try {
    missingResult = detectMissingFields(lead as Parameters<typeof detectMissingFields>[0]);
    completedSteps.push("detect_missing_fields");
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    failedSteps.push({ step: "detect_missing_fields", error });
    console.error(`[SCORING] SCORING_FAILED leadId=${leadId} step=detect_missing_fields error=${error}`);
    missingResult = {
      criticalMissing: [] as never[],
      importantMissing: [] as never[],
      optionalMissing: [] as never[],
      missingDataFlags: [] as never[],
    };
  }

  // ── Step 4: Compute readiness ─────────────────────────────────────────────
  let readinessResult = null;
  try {
    readinessResult = computeAnalysisReadiness(missingResult);
    readinessState = readinessResult.state;
    completedSteps.push("compute_readiness");
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    failedSteps.push({ step: "compute_readiness", error });
    console.error(`[SCORING] SCORING_FAILED leadId=${leadId} step=compute_readiness error=${error}`);
    readinessState = "not_analyzable";
  }

  // ── Step 5: Extract opportunities ─────────────────────────────────────────
  try {
    opportunities = extractOpportunities({ auditResult, leadId });
    completedSteps.push("extract_opportunities");
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    failedSteps.push({ step: "extract_opportunities", error });
    console.error(`[SCORING] SCORING_FAILED leadId=${leadId} step=extract_opportunities error=${error}`);
    opportunities = [];
  }

  // ── Step 6: Compute lead score ────────────────────────────────────────────
  try {
    score = computeLeadScore({
      lead: {
        verifiedPhone: lead.verifiedPhone as string | null,
        hasWhatsapp: lead.hasWhatsapp as string | null,
        website: lead.website as string | null,
        instagramUrl: lead.instagramUrl as string | null,
        twitterUrl: lead.twitterUrl as string | null,
        tiktokUrl: lead.tiktokUrl as string | null,
        snapchatUrl: lead.snapchatUrl as string | null,
        facebookUrl: lead.facebookUrl as string | null,
        linkedinUrl: lead.linkedinUrl as string | null,
        companyName: lead.companyName as string | null,
        city: lead.city as string | null,
        businessType: lead.businessType as string | null,
        googleMapsUrl: lead.googleMapsUrl as string | null,
      },
      opportunities,
      readinessState: readinessState ?? "not_analyzable",
    });
    completedSteps.push("compute_score");
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    failedSteps.push({ step: "compute_score", error });
    console.error(`[SCORING] SCORING_FAILED leadId=${leadId} step=compute_score error=${error}`);
    score = null;
  }

  // ── Step 7: Apply priority label ──────────────────────────────────────────
  if (score !== null) {
    try {
      const labelResult = await applyPriorityLabel({
        leadId,
        score,
        opportunities,
        manualReviewStatus: lead.manualReviewStatus as string | null,
      });
      dbUpdated = labelResult.updated;
      dbSkipReason = labelResult.skipReason;
      completedSteps.push("apply_priority_label");
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      failedSteps.push({ step: "apply_priority_label", error });
      console.error(`[SCORING] SCORING_FAILED leadId=${leadId} step=apply_priority_label error=${error}`);
    }
  }

  const success = failedSteps.length === 0;

  if (success) {
    console.log(
      `[SCORING] SCORING_DONE leadId=${leadId} score=${score?.value ?? "n/a"} priority=${score?.priority ?? "n/a"} opportunities=${opportunities.length} dbUpdated=${dbUpdated}`
    );
  } else {
    console.warn(
      `[SCORING] SCORING_PARTIAL leadId=${leadId} completedSteps=${completedSteps.length} failedSteps=${failedSteps.length}`
    );
  }

  return {
    leadId,
    success,
    completedSteps,
    failedSteps,
    score,
    opportunities,
    readinessState,
    dbUpdated,
    dbSkipReason,
  };
}
