/**
 * PHASE 6A — salesBrief/index.ts
 * ================================
 * Orchestrates the Sales Brief pipeline for a single lead.
 *
 * Pipeline:
 *   1. runScoringPipeline(leadId)  — fetch lead + audit + score + opportunities
 *   2. Guards: readinessState, opportunities, score
 *   3. generateSalesBrief(...)     — pure synchronous generation
 *
 * Constraints:
 *   - STATELESS: no DB writes, no persistence
 *   - MANUAL TRIGGER ONLY: not auto-wired into any pipeline
 *   - Returns structured result with completedSteps / failedSteps for observability
 */
import { runScoringPipeline } from "../scoring/index";
import { generateSalesBrief } from "./generator";
import type { SalesBrief, LeadScore, LeadOpportunity } from "../../shared/types/lead-intelligence";
import type { AnalysisReadinessState } from "../autofill/computeAnalysisReadiness";

// ─── Result type ──────────────────────────────────────────────────────────────
export type SalesBriefPipelineResult = {
  leadId: number;
  success: boolean;
  brief: SalesBrief | null;
  score: LeadScore | null;
  opportunities: LeadOpportunity[];
  readinessState: AnalysisReadinessState | null;
  completedSteps: string[];
  failedSteps: Array<{ step: string; error: string }>;
};

// ─── Main export ──────────────────────────────────────────────────────────────
/**
 * runSalesBriefPipeline — manual trigger only
 *
 * Runs scoring pipeline then generates a SalesBrief deterministically.
 * Does NOT write to DB.
 * Throws a structured TRPCError-compatible error on guard failures.
 */
export async function runSalesBriefPipeline(
  leadId: number
): Promise<SalesBriefPipelineResult> {
  const completedSteps: string[] = [];
  const failedSteps: Array<{ step: string; error: string }> = [];

  // ── Step 1: Run scoring pipeline ──────────────────────────────────────────
  let scoringResult: Awaited<ReturnType<typeof runScoringPipeline>>;
  try {
    scoringResult = await runScoringPipeline(leadId);
    completedSteps.push("scoring_pipeline");
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    failedSteps.push({ step: "scoring_pipeline", error });
    console.error(`[SALES_BRIEF] PIPELINE_FAILED leadId=${leadId} step=scoring_pipeline error=${error}`);
    return {
      leadId,
      success: false,
      brief: null,
      score: null,
      opportunities: [],
      readinessState: null,
      completedSteps,
      failedSteps,
    };
  }

  const { score, opportunities, readinessState } = scoringResult;

  // ── Guard 1: readinessState ───────────────────────────────────────────────
  if (readinessState === "not_analyzable") {
    const error = "not_analyzable: lead does not have sufficient data for analysis";
    failedSteps.push({ step: "readiness_check", error });
    console.warn(`[SALES_BRIEF] PIPELINE_BLOCKED leadId=${leadId} reason=not_analyzable`);
    return {
      leadId,
      success: false,
      brief: null,
      score,
      opportunities,
      readinessState,
      completedSteps,
      failedSteps,
    };
  }
  completedSteps.push("readiness_check");

  // ── Guard 2: score must exist ─────────────────────────────────────────────
  if (score === null) {
    const error = "scoring_failed: score is null after pipeline";
    failedSteps.push({ step: "score_check", error });
    console.warn(`[SALES_BRIEF] PIPELINE_BLOCKED leadId=${leadId} reason=score_null`);
    return {
      leadId,
      success: false,
      brief: null,
      score: null,
      opportunities,
      readinessState,
      completedSteps,
      failedSteps,
    };
  }
  completedSteps.push("score_check");

  // ── Guard 3: opportunities check (non-blocking) ─────────────────────────────
  // لا نوقف الـ pipeline إذا كانت opportunities فارغة —
  // الـ generator سيستخدم fallback opportunity بناءً على الـ score
  if (opportunities.length === 0) {
    console.warn(`[SALES_BRIEF] NO_OPPORTUNITIES leadId=${leadId} — using score-based fallback`);
  }
  completedSteps.push("opportunities_check");

  // ── Step 2: Generate SalesBrief ───────────────────────────────────────────
  // We need lead fields for generation — re-use what scoring already fetched
  // via the scoring pipeline. Since runScoringPipeline doesn't expose the raw lead,
  // we pass the minimal fields available from the scoring result context.
  // The lead fields are fetched fresh inside runScoringPipeline, so we call
  // a lightweight DB read here for the generator input fields only.
  let brief: SalesBrief | null = null;
  try {
    const { getDb } = await import("../db");
    const { leads } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");

    const db = await getDb();
    if (!db) throw new Error("DB not available for lead fields");

    const rows = await db
      .select({
        companyName: leads.companyName,
        city: leads.city,
        businessType: leads.businessType,
        hasWhatsapp: leads.hasWhatsapp,
        verifiedPhone: leads.verifiedPhone,
        instagramUrl: leads.instagramUrl,
        linkedinUrl: leads.linkedinUrl,
      })
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);

    if (!rows.length) throw new Error(`Lead not found: ${leadId}`);
    const leadFields = rows[0];

    brief = generateSalesBrief({
      lead: leadFields,
      score,
      opportunities,
    });
    completedSteps.push("generate_brief");
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    failedSteps.push({ step: "generate_brief", error });
    console.error(`[SALES_BRIEF] PIPELINE_FAILED leadId=${leadId} step=generate_brief error=${error}`);
    return {
      leadId,
      success: false,
      brief: null,
      score,
      opportunities,
      readinessState,
      completedSteps,
      failedSteps,
    };
  }

  console.log(
    `[SALES_BRIEF] PIPELINE_DONE leadId=${leadId} priority=${score.priority} score=${score.value} channel=${brief.bestContactChannel} topOpp=${brief.topOpportunity}`
  );

  return {
    leadId,
    success: true,
    brief,
    score,
    opportunities,
    readinessState,
    completedSteps,
    failedSteps,
  };
}

// Re-export generator for direct use in tests
export { generateSalesBrief } from "./generator";
export type { SalesBriefGeneratorInput } from "./generator";
