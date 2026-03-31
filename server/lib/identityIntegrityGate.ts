/**
 * Identity Integrity Gate — بوابة سلامة الهوية
 * ================================================
 * نقطة التحكم المركزية في الـ pipeline.
 *
 * الموقع في الـ pipeline:
 *   rawResults → rawResultToCandidate → [GATE] → clusterCandidates → AI Enrichment → حفظ
 *
 * ما يتم منعه عند identity_unstable:
 *  ✗ scoring
 *  ✗ opportunities
 *  ✗ sales brief
 *  ✗ competitor analysis
 *  ✗ AI enrichment
 *  ✗ حفظ تلقائي
 *
 * ما يُسمح به دائماً:
 *  ✓ عرض النتائج الخام
 *  ✓ عرض تفاصيل التعارض
 *  ✓ المراجعة اليدوية
 *  ✓ حفظ يدوي بعد تأكيد المستخدم
 */

import type { DiscoveryCandidate } from "../../shared/types/lead-intelligence";
import type {
  IdentityIntegrityResult,
  IdentityProfile,
  PipelineGateDecision,
} from "../../shared/types/field-integrity";
import { extractIdentityProfile, mergeIdentityProfiles } from "./fieldValidator";
import { checkIdentityIntegrity, buildConflictDetails } from "./conflictDetector";

// ─── نتيجة Gate لمرشح واحد أو مجموعة مرشحين ─────────────────────────────────

export type GateResult = {
  /** معرف المرشح أو المجموعة */
  id: string;
  /** قرار الـ Gate */
  decision: PipelineGateDecision;
  /** ملف الهوية المُبنى */
  identityProfile: IdentityProfile;
  /** نتيجة فحص الهوية الكاملة */
  integrityResult: IdentityIntegrityResult;
  /** تفاصيل التعارض للعرض في الواجهة */
  conflictDetails: ReturnType<typeof buildConflictDetails>;
};

// ─── الدالة الرئيسية: فحص مرشح واحد ─────────────────────────────────────────

export function runGateOnCandidate(candidate: DiscoveryCandidate): GateResult {
  const profile = extractIdentityProfile(candidate);
  const integrityResult = checkIdentityIntegrity(profile);
  const conflictDetails = buildConflictDetails(integrityResult);

  const decision: PipelineGateDecision = {
    allowed: integrityResult.canProceed,
    blockedReason: integrityResult.canProceed ? undefined : integrityResult.userMessage,
    conflictingFields: integrityResult.conflictingFields.map(cf => cf.fieldName),
    integrityResult,
  };

  return {
    id: candidate.id,
    decision,
    identityProfile: profile,
    integrityResult,
    conflictDetails,
  };
}

// ─── الدالة الرئيسية: فحص مجموعة مرشحين (مرشحون يُعتقد أنهم نفس الكيان) ────

export function runGateOnGroup(candidates: DiscoveryCandidate[]): GateResult {
  if (candidates.length === 0) {
    throw new Error("runGateOnGroup: يجب أن تحتوي المجموعة على مرشح واحد على الأقل");
  }

  if (candidates.length === 1) {
    return runGateOnCandidate(candidates[0]);
  }

  // استخراج ملف هوية لكل مرشح
  const profiles = candidates.map(c => extractIdentityProfile(c));

  // دمج الملفات (يكتشف التعارضات)
  const mergedProfile = mergeIdentityProfiles(profiles);

  // فحص الاستقرار
  const integrityResult = checkIdentityIntegrity(mergedProfile);
  const conflictDetails = buildConflictDetails(integrityResult);

  const groupId = candidates.map(c => c.id).join("+");

  const decision: PipelineGateDecision = {
    allowed: integrityResult.canProceed,
    blockedReason: integrityResult.canProceed ? undefined : integrityResult.userMessage,
    conflictingFields: integrityResult.conflictingFields.map(cf => cf.fieldName),
    integrityResult,
  };

  return {
    id: groupId,
    decision,
    identityProfile: mergedProfile,
    integrityResult,
    conflictDetails,
  };
}

// ─── فحص دفعة من المرشحين (كل مرشح بشكل مستقل) ─────────────────────────────

export type BatchGateResult = {
  /** عدد المرشحين الذين اجتازوا الـ Gate */
  passedCount: number;
  /** عدد المرشحين الذين أُوقفوا */
  blockedCount: number;
  /** عدد المرشحين الذين يحتاجون مراجعة */
  reviewCount: number;
  /** نتائج كل مرشح */
  results: GateResult[];
  /** ملخص للعرض */
  summary: string;
};

export function runGateOnBatch(candidates: DiscoveryCandidate[]): BatchGateResult {
  const results = candidates.map(c => runGateOnCandidate(c));

  const passedCount = results.filter(r => r.integrityResult.status === "stable").length;
  const blockedCount = results.filter(r => r.integrityResult.status === "identity_unstable").length;
  const reviewCount = results.filter(r => r.integrityResult.status === "merge_requires_review").length;

  const summary = [
    `إجمالي: ${candidates.length}`,
    `مستقر: ${passedCount}`,
    blockedCount > 0 ? `متعارض: ${blockedCount}` : null,
    reviewCount > 0 ? `يحتاج مراجعة: ${reviewCount}` : null,
  ].filter(Boolean).join(" | ");

  return {
    passedCount,
    blockedCount,
    reviewCount,
    results,
    summary,
  };
}

// ─── فحص ما إذا كانت عملية محددة مسموحة ─────────────────────────────────────

export type PipelineOperation =
  | "scoring"
  | "opportunities"
  | "sales_brief"
  | "competitor_analysis"
  | "ai_enrichment"
  | "auto_save"
  | "merge";

/**
 * يفحص إذا كانت عملية محددة مسموحة بناءً على حالة الهوية
 */
export function isOperationAllowed(
  integrityResult: IdentityIntegrityResult,
  operation: PipelineOperation
): { allowed: boolean; reason: string } {
  if (integrityResult.status === "identity_unstable") {
    return {
      allowed: false,
      reason: `العملية "${getOperationLabel(operation)}" محظورة — الهوية غير مستقرة بسبب تعارض في: ${
        integrityResult.conflictingFields.map(cf => cf.fieldName).join(", ")
      }`,
    };
  }

  if (integrityResult.status === "merge_requires_review") {
    // بعض العمليات مسموحة حتى عند merge_requires_review
    const allowedForReview: PipelineOperation[] = ["ai_enrichment"];
    if (!allowedForReview.includes(operation)) {
      return {
        allowed: false,
        reason: `العملية "${getOperationLabel(operation)}" تحتاج مراجعة يدوية أولاً`,
      };
    }
  }

  return { allowed: true, reason: "الهوية مستقرة" };
}

function getOperationLabel(op: PipelineOperation): string {
  const labels: Record<PipelineOperation, string> = {
    scoring: "التقييم",
    opportunities: "استخراج الفرص",
    sales_brief: "ملخص السيلز",
    competitor_analysis: "تحليل المنافسين",
    ai_enrichment: "الإثراء بالذكاء الاصطناعي",
    auto_save: "الحفظ التلقائي",
    merge: "الدمج",
  };
  return labels[op] || op;
}
