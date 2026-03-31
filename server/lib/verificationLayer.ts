/**
 * verificationLayer.ts
 * =====================
 * Layer 3 of Browser Verification Agent
 *
 * مسؤولية هذه الطبقة:
 *   - استقبال NormalizedEvidence من evidenceNormalizer
 *   - اتخاذ قرار الدمج بناءً على قواعد صارمة
 *   - إنتاج VerificationResult JSON منظم
 *   - تحديث LinkageScore بناءً على الأدلة
 *
 * قواعد صارمة:
 *   - القرار يُبنى على الأدلة فقط — لا تخمين
 *   - التعارض القوي يمنع الدمج حتى لو كانت هناك أدلة داعمة
 *   - كل قرار يُوثَّق بأسباب واضحة
 *   - لا كتابة في قاعدة البيانات
 */

import type { NormalizedEvidence, EvidenceItem } from "./evidenceNormalizer.js";

// ===== Types =====

export type VerificationDecision =
  | "merge_confirmed"      // أدلة قوية كافية → دمج مؤكد
  | "merge_suggested"      // أدلة معتدلة → يُقترح الدمج
  | "needs_review"         // أدلة متعارضة أو غير كافية → مراجعة يدوية
  | "reject_merge"         // تعارض قوي → رفض الدمج
  | "insufficient_data";   // لا توجد بيانات كافية

export interface VerificationResult {
  caseId: string;
  decision: VerificationDecision;
  /** الدرجة المحدّثة بعد التحقق (0.0 - 1.0) */
  updatedScore: number;
  /** الدرجة الأصلية قبل التحقق */
  originalScore: number;
  /** أسباب القرار */
  reasons: string[];
  /** الأدلة الداعمة الرئيسية */
  keyEvidence: EvidenceItem[];
  /** الأدلة المتعارضة إن وجدت */
  conflicts: EvidenceItem[];
  /** البيانات المستخرجة الجديدة لإثراء الكاندييت */
  enrichedData: {
    phones: string[];
    emails: string[];
    domains: string[];
    cities: string[];
    socialLinks: string[];
    contactLinks: string[];
  };
  /** هل يجب تحديث الكاندييت بالبيانات الجديدة؟ */
  shouldEnrich: boolean;
  /** وقت التحقق */
  verifiedAt: string;
  /** ملخص نصي للقرار */
  summary: string;
}

// ===== Decision Logic =====

/**
 * قواعد القرار:
 *
 * merge_confirmed:
 *   - هاتف مشترك واحد على الأقل (strong evidence)
 *   - أو: نطاق مشترك + اسم متشابه
 *   - أو: cross-link مباشر بين المصدرين
 *   - بدون تعارض قوي
 *
 * merge_suggested:
 *   - مدينة مشتركة + اسم متشابه
 *   - أو: أدلة معتدلة متعددة (2+) بدون تعارض
 *
 * needs_review:
 *   - أدلة داعمة وتعارض في نفس الوقت
 *   - أو: أدلة غير كافية
 *
 * reject_merge:
 *   - هاتفان مختلفان من مصدرين موثوقين
 *   - أو: نطاقان مختلفان تماماً
 *
 * insufficient_data:
 *   - معظم المصادر فشلت في الجلب
 *   - أو: لا توجد أدلة من أي نوع
 */
function makeDecision(
  evidence: NormalizedEvidence,
  originalScore: number
): { decision: VerificationDecision; updatedScore: number; reasons: string[] } {
  const reasons: string[] = [];
  const { supportingEvidence, conflictingEvidence, strongEvidenceCount, hasConflict, sufficientEvidence } = evidence;

  // حالة: بيانات غير كافية
  const failedCount = evidence.entities.filter(e => e.fetchConfidence === "failed").length;
  if (failedCount === evidence.entities.length) {
    return {
      decision: "insufficient_data",
      updatedScore: originalScore,
      reasons: ["جميع المصادر فشلت في الجلب — لا يمكن التحقق"],
    };
  }

  if (!sufficientEvidence && supportingEvidence.length === 0) {
    return {
      decision: "insufficient_data",
      updatedScore: originalScore * 0.9,
      reasons: ["لا توجد أدلة كافية للتحقق من الهوية"],
    };
  }

  // حالة: رفض الدمج — تعارض قوي في الهاتف
  const phoneConflicts = conflictingEvidence.filter(e => e.type === "phone" && e.strength === "strong");
  if (phoneConflicts.length > 0) {
    reasons.push(...phoneConflicts.map(e => e.description));
    return {
      decision: "reject_merge",
      updatedScore: Math.min(originalScore * 0.5, 0.40),
      reasons,
    };
  }

  // حالة: دمج مؤكد — هاتف مشترك
  const sharedPhones = supportingEvidence.filter(e => e.type === "phone" && e.strength === "strong");
  if (sharedPhones.length > 0 && !hasConflict) {
    reasons.push(...sharedPhones.map(e => e.description));
    return {
      decision: "merge_confirmed",
      updatedScore: Math.min(originalScore + 0.25, 0.98),
      reasons,
    };
  }

  // حالة: دمج مؤكد — cross-link مباشر
  const crossLinks = supportingEvidence.filter(e => e.type === "cross_link" && e.strength === "strong");
  if (crossLinks.length > 0 && !hasConflict) {
    reasons.push(...crossLinks.map(e => e.description));
    return {
      decision: "merge_confirmed",
      updatedScore: Math.min(originalScore + 0.20, 0.95),
      reasons,
    };
  }

  // حالة: دمج مؤكد — نطاق مشترك + اسم متشابه
  const sharedDomains = supportingEvidence.filter(e => e.type === "domain" && e.strength === "strong");
  const sharedNames = supportingEvidence.filter(e => e.type === "name");
  if (sharedDomains.length > 0 && sharedNames.length > 0 && !hasConflict) {
    reasons.push(...sharedDomains.map(e => e.description));
    reasons.push(...sharedNames.map(e => e.description));
    return {
      decision: "merge_confirmed",
      updatedScore: Math.min(originalScore + 0.15, 0.92),
      reasons,
    };
  }

  // حالة: يُقترح الدمج — أدلة معتدلة
  const moderateEvidence = supportingEvidence.filter(e => e.strength === "moderate");
  if (moderateEvidence.length >= 2 && !hasConflict) {
    reasons.push(...moderateEvidence.slice(0, 3).map(e => e.description));
    return {
      decision: "merge_suggested",
      updatedScore: Math.min(originalScore + 0.10, 0.85),
      reasons,
    };
  }

  // حالة: مراجعة — أدلة داعمة وتعارض
  if (supportingEvidence.length > 0 && hasConflict) {
    reasons.push("توجد أدلة داعمة ومتعارضة في آنٍ واحد — يحتاج مراجعة يدوية");
    reasons.push(...conflictingEvidence.map(e => e.description));
    return {
      decision: "needs_review",
      updatedScore: originalScore,
      reasons,
    };
  }

  // حالة: مراجعة — أدلة ضعيفة
  if (supportingEvidence.length === 1) {
    reasons.push("دليل داعم واحد فقط — غير كافٍ للتأكيد");
    return {
      decision: "needs_review",
      updatedScore: originalScore + 0.05,
      reasons,
    };
  }

  return {
    decision: "insufficient_data",
    updatedScore: originalScore,
    reasons: ["لم تُنتج الأدلة قراراً واضحاً"],
  };
}

/**
 * تجميع البيانات المستخرجة من جميع المصادر لإثراء الكاندييت
 */
function collectEnrichedData(evidence: NormalizedEvidence): VerificationResult["enrichedData"] {
  const phones = new Set<string>();
  const emails = new Set<string>();
  const domains = new Set<string>();
  const cities = new Set<string>();
  const socialLinks = new Set<string>();
  const contactLinks = new Set<string>();

  for (const entity of evidence.entities) {
    if (entity.fetchConfidence === "failed") continue;
    entity.phones.forEach(p => phones.add(p));
    entity.emails.forEach(e => emails.add(e));
    entity.domains.forEach(d => domains.add(d));
    entity.cities.forEach(c => cities.add(c));
    entity.socialLinks.forEach(l => socialLinks.add(l));
    entity.contactLinks.forEach(l => contactLinks.add(l));
  }

  return {
    phones: Array.from(phones),
    emails: Array.from(emails),
    domains: Array.from(domains),
    cities: Array.from(cities),
    socialLinks: Array.from(socialLinks),
    contactLinks: Array.from(contactLinks),
  };
}

/**
 * الدالة الرئيسية: تحويل NormalizedEvidence إلى VerificationResult
 */
export function runVerification(
  evidence: NormalizedEvidence,
  originalScore: number
): VerificationResult {
  const { decision, updatedScore, reasons } = makeDecision(evidence, originalScore);

  const enrichedData = collectEnrichedData(evidence);
  const shouldEnrich = (
    enrichedData.phones.length > 0 ||
    enrichedData.domains.length > 0 ||
    enrichedData.cities.length > 0
  );

  const keyEvidence = evidence.supportingEvidence.filter(e => e.strength === "strong").slice(0, 5);
  const conflicts = evidence.conflictingEvidence.slice(0, 3);

  const summaryMap: Record<VerificationDecision, string> = {
    merge_confirmed: `✅ دمج مؤكد — ${reasons[0] || "أدلة قوية"}`,
    merge_suggested: `🔶 يُقترح الدمج — ${reasons[0] || "أدلة معتدلة"}`,
    needs_review: `⚠️ يحتاج مراجعة — ${reasons[0] || "أدلة متعارضة"}`,
    reject_merge: `❌ رفض الدمج — ${reasons[0] || "تعارض قوي"}`,
    insufficient_data: `❓ بيانات غير كافية — ${reasons[0] || "لا يمكن التحقق"}`,
  };

  return {
    caseId: evidence.caseId,
    decision,
    updatedScore,
    originalScore,
    reasons,
    keyEvidence,
    conflicts,
    enrichedData,
    shouldEnrich,
    verifiedAt: new Date().toISOString(),
    summary: summaryMap[decision],
  };
}

/**
 * Pipeline كامل: من روابط خام إلى VerificationResult
 * يُستدعى من identityLinkage.ts للحالات الرمادية فقط
 */
export async function verifyIdentityPair(
  urlA: string,
  sourceA: string,
  urlB: string,
  sourceB: string,
  originalScore: number,
  caseId: string
): Promise<VerificationResult> {
  const { extractEvidenceBatch } = await import("./browserExtractor.js");
  const { normalizeEvidence } = await import("./evidenceNormalizer.js");

  const rawEntities = await extractEvidenceBatch([
    { url: urlA, source: sourceA },
    { url: urlB, source: sourceB },
  ]);

  const normalized = normalizeEvidence(rawEntities, caseId);
  return runVerification(normalized, originalScore);
}
