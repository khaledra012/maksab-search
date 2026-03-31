/**
 * PHASE 4 — Enrichment Orchestrator
 * يُشغَّل بشكل non-blocking بعد createLeadWithResolution().
 * الترتيب: Gate → Website → Social → Audit → Readiness Recompute
 *
 * القاعدة:
 * - لا يحجب الإدراج أبداً
 * - structured logging في كل خطوة
 * - readiness تُحسب من DB بعد الكتابة (ليس من snapshot)
 */
import { checkEnrichmentEligibility } from "./enrichmentGate";
import { runWebsiteEnrichment } from "./websiteEnrichment";
import { runSocialEnrichment } from "./socialEnrichment";
import { runAuditEngine } from "./auditEngine";
import { getDb } from "../db";
import { leads } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { runAutofill } from "../autofill/index";
import type { Lead } from "../../drizzle/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

export type EnrichmentPipelineResult = {
  leadId: number;
  gateResult: "eligible" | "ineligible";
  gateReason?: string;
  websiteEnriched: boolean;
  socialEnriched: boolean;
  platformsEnriched: string[];
  auditCompleted: boolean;
  readinessRecomputed: boolean;
  errors: string[];
};

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export async function runEnrichmentPipeline(
  lead: Lead
): Promise<EnrichmentPipelineResult> {
  const result: EnrichmentPipelineResult = {
    leadId: lead.id,
    gateResult: "ineligible",
    websiteEnriched: false,
    socialEnriched: false,
    platformsEnriched: [],
    auditCompleted: false,
    readinessRecomputed: false,
    errors: [],
  };

  // ─── Step 1: Gate ─────────────────────────────────────────────────────────
  const gate = checkEnrichmentEligibility(lead);
  if (!gate.eligible) {
    result.gateResult = "ineligible";
    result.gateReason = gate.reason;
    console.log(
      `[enrichment] GATE_BLOCKED leadId=${lead.id} reason=${gate.reason}`
    );
    return result;
  }

  result.gateResult = "eligible";
  console.log(`[enrichment] GATE_PASSED leadId=${lead.id}`);

  const db = await getDb();
  if (!db) {
    result.errors.push("db_unavailable");
    console.error(`[enrichment] DB_UNAVAILABLE leadId=${lead.id}`);
    return result;
  }

  // تحديث analysisStatus → "analyzing"
  await db
    .update(leads)
    .set({ analysisStatus: "analyzing" })
    .where(eq(leads.id, lead.id));

  // ─── Step 2: Website Enrichment ───────────────────────────────────────────
  if (lead.website) {
    const webResult = await runWebsiteEnrichment(lead).catch((err) => ({
      success: false as const,
      reason: `unexpected: ${err instanceof Error ? err.message : String(err)}`,
    }));

    if (webResult.success) {
      result.websiteEnriched = true;
      console.log(
        `[enrichment] WEBSITE_ENRICHED leadId=${lead.id} analysisId=${webResult.websiteAnalysisId}`
      );
    } else {
      result.errors.push(`website: ${webResult.reason}`);
      console.warn(
        `[enrichment] WEBSITE_FAILED leadId=${lead.id} reason=${webResult.reason}`
      );
    }
  }

  // ─── Step 3: Social Enrichment ────────────────────────────────────────────
  const socialResult = await runSocialEnrichment(lead).catch((err) => ({
    success: false as const,
    reason: `unexpected: ${err instanceof Error ? err.message : String(err)}`,
  }));

  if (socialResult.success) {
    result.socialEnriched = true;
    result.platformsEnriched = socialResult.platformsEnriched;
    console.log(
      `[enrichment] SOCIAL_ENRICHED leadId=${lead.id} platforms=${socialResult.platformsEnriched.join(",")}`
    );
  } else {
    result.errors.push(`social: ${socialResult.reason}`);
    console.warn(
      `[enrichment] SOCIAL_FAILED leadId=${lead.id} reason=${socialResult.reason}`
    );
  }

  // ─── Step 4: Audit Engine (يقرأ من DB — ليس من snapshot) ─────────────────
  const auditResult = await runAuditEngine(lead.id).catch((err) => {
    result.errors.push(`audit: ${err instanceof Error ? err.message : String(err)}`);
    console.error(`[enrichment] AUDIT_FAILED leadId=${lead.id}`, err);
    return null;
  });

  if (auditResult) {
    result.auditCompleted = true;
    console.log(
      `[enrichment] AUDIT_COMPLETED leadId=${lead.id}` +
      ` seo_present=${auditResult.seoAudit.present.length}` +
      ` social_present=${auditResult.socialAudit.present.length}`
    );
  }

  // ─── Step 5: Readiness Recompute (يقرأ lead من DB بعد الكتابة) ───────────
  const [freshLead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, lead.id))
    .limit(1);

  if (freshLead) {
    await runAutofill(freshLead.id).catch((err) => {
      result.errors.push(`readiness: ${err instanceof Error ? err.message : String(err)}`);
      console.error(`[enrichment] READINESS_FAILED leadId=${lead.id}`, err);
    });
    result.readinessRecomputed = true;
    console.log(`[enrichment] READINESS_RECOMPUTED leadId=${lead.id}`);
  }

  // ─── Step 6: تحديث analysisStatus النهائي ────────────────────────────────
  const finalStatus =
    result.errors.length === 0 ? "completed" : "failed";

  await db
    .update(leads)
    .set({ analysisStatus: finalStatus })
    .where(eq(leads.id, lead.id));

  console.log(
    `[enrichment] PIPELINE_DONE leadId=${lead.id} status=${finalStatus}` +
    ` errors=${result.errors.length}`
  );

  return result;
}
