/**
 * PHASE 4 — Enrichment Gate
 * يحدد أهلية lead للـ enrichment قبل تشغيل أي pipeline مكلف.
 * كل الشروط يجب أن تتحقق معاً.
 */
import type { Lead } from "../../drizzle/schema";

export type GateResult =
  | { eligible: true }
  | { eligible: false; reason: string };

/**
 * الشروط الأربعة للأهلية:
 * 1. website موجود — لا enrichment بدون أصل رقمي
 * 2. analysisReadyFlag === false — لا إعادة تشغيل على lead مكتمل
 * 3. deduplicationStatus !== "possible_duplicate" — لا enrichment على هوية مشكوك فيها
 * 4. analysisStatus ليس "analyzing" أو "completed" — لا تشغيل مزدوج
 */
export function checkEnrichmentEligibility(lead: Lead): GateResult {
  if (!lead.website || lead.website.trim() === "") {
    return { eligible: false, reason: "no_website" };
  }

  if (lead.analysisReadyFlag === true) {
    return { eligible: false, reason: "already_analysis_ready" };
  }

  if (lead.deduplicationStatus === "possible_duplicate") {
    return { eligible: false, reason: "possible_duplicate_identity" };
  }

  if (lead.analysisStatus === "analyzing") {
    return { eligible: false, reason: "analysis_in_progress" };
  }

  if (lead.analysisStatus === "completed") {
    return { eligible: false, reason: "analysis_already_completed" };
  }

  return { eligible: true };
}
