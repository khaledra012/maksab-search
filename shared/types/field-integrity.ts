/**
 * Field Integrity Types — Identity Integrity Gate
 * =================================================
 * كل حقل حرج يحمل: value + source + rawOrigin + confidence + status
 *
 * الحقول الحرجة الستة:
 *  1. businessName       — اسم النشاط التجاري
 *  2. phone              — رقم الهاتف
 *  3. websiteDomain      — الموقع الإلكتروني / الدومين
 *  4. city               — المدينة
 *  5. category           — تصنيف النشاط
 *  6. primarySocialIdentity — الهوية الاجتماعية الأساسية (username)
 *
 * حالات الحقل:
 *  confirmed   — جميع المصادر تتفق على نفس القيمة (أو مصدر واحد عالي الثقة ≥0.85)
 *  candidate   — مصدر واحد فقط يحمل القيمة (ثقة < 0.85)
 *  conflicting — مصادر متعددة تحمل قيماً مختلفة لا يمكن التوفيق بينها
 *  unknown     — لا يوجد أي مصدر
 *
 * حالات الهوية:
 *  stable               — جميع الحقول الحرجة إما confirmed أو candidate أو unknown
 *  identity_unstable    — حقل حرج واحد على الأقل conflicting
 *  merge_requires_review — الدمج ممكن لكن يحتاج مراجعة يدوية (ثقة منخفضة)
 */

import type { DiscoverySource } from "./lead-intelligence";

// ─── Field Status ─────────────────────────────────────────────────────────────

/** حالة الحقل الحرج */
export type FieldStatus =
  | "confirmed"    // متفق عليه من جميع المصادر أو مصدر واحد عالي الثقة
  | "candidate"    // مصدر واحد فقط أو ثقة منخفضة
  | "conflicting"  // تعارض بين مصادر متعددة
  | "unknown";     // لا توجد بيانات

// ─── Field Evidence ───────────────────────────────────────────────────────────

/** دليل واحد على قيمة الحقل من مصدر محدد */
export type FieldEvidence = {
  /** القيمة المستخرجة */
  value: string;
  /** المنصة التي جاءت منها */
  source: DiscoverySource | "unknown";
  /** النص الخام الذي استُخرجت منه القيمة */
  rawOrigin: string;
  /** درجة الثقة في هذه القيمة (0-1) */
  confidence: number;
  /** طريقة الاستخراج */
  extractionMethod: "direct" | "regex" | "inferred" | "ai";
};

// ─── Critical Field ───────────────────────────────────────────────────────────

/** حقل حرج مع جميع أدلته وحالته النهائية */
export type CriticalField = {
  /** الحالة النهائية للحقل بعد تحليل جميع الأدلة */
  status: FieldStatus;
  /** القيمة المختارة (أعلى ثقة أو المتفق عليها) */
  resolvedValue: string | null;
  /** جميع الأدلة من جميع المصادر */
  evidence: FieldEvidence[];
  /** سبب الحالة (خصوصاً عند conflicting) */
  reason: string;
};

// ─── Identity Profile ─────────────────────────────────────────────────────────

/**
 * ملف الهوية الكامل لكيان ما — يُبنى من مرشح واحد أو مجموعة مرشحين
 * يحتوي على الحقول الحرجة الستة مع أدلتها
 */
export type IdentityProfile = {
  /** اسم النشاط التجاري */
  businessName: CriticalField;
  /** رقم الهاتف */
  phone: CriticalField;
  /** الموقع الإلكتروني / الدومين */
  websiteDomain: CriticalField;
  /** المدينة */
  city: CriticalField;
  /** تصنيف النشاط */
  category: CriticalField;
  /** الهوية الاجتماعية الأساسية (username على المنصة الرئيسية) */
  primarySocialIdentity: CriticalField;
};

// ─── Identity Stability ───────────────────────────────────────────────────────

/** حالة استقرار الهوية */
export type IdentityStabilityStatus =
  | "stable"               // جاهز للتحليل والإثراء والحفظ
  | "identity_unstable"    // يوجد تعارض — يجب إيقاف كل العمليات
  | "merge_requires_review"; // الدمج ممكن لكن يحتاج مراجعة يدوية

/** نتيجة فحص استقرار الهوية */
export type IdentityIntegrityResult = {
  /** حالة الاستقرار النهائية */
  status: IdentityStabilityStatus;
  /** ملف الهوية الكامل */
  profile: IdentityProfile;
  /** الحقول المتعارضة (إن وجدت) */
  conflictingFields: Array<{
    fieldName: keyof IdentityProfile;
    values: Array<{ value: string; source: string; confidence: number }>;
    reason: string;
  }>;
  /** الحقول الناقصة (unknown) */
  missingFields: Array<keyof IdentityProfile>;
  /** الحقول المؤكدة */
  confirmedFields: Array<keyof IdentityProfile>;
  /** الحقول المرشحة (candidate) */
  candidateFields: Array<keyof IdentityProfile>;
  /** درجة الثقة الإجمالية في الهوية (0-1) */
  overallConfidence: number;
  /** هل يمكن المتابعة للتحليل؟ */
  canProceed: boolean;
  /** رسالة للمستخدم */
  userMessage: string;
};

// ─── Pipeline Gate Decision ───────────────────────────────────────────────────

/**
 * قرار الـ Gate لكل عملية في الـ pipeline
 * يُستخدم لإيقاف العمليات عند عدم استقرار الهوية
 */
export type PipelineGateDecision = {
  /** هل يُسمح بالمتابعة؟ */
  allowed: boolean;
  /** سبب المنع (إن وجد) */
  blockedReason?: string;
  /** الحقول المتعارضة التي سببت المنع */
  conflictingFields?: string[];
  /** نتيجة فحص الهوية الكاملة */
  integrityResult: IdentityIntegrityResult;
};

// ─── Field Conflict Detail ────────────────────────────────────────────────────

/** تفاصيل التعارض لعرضها للمستخدم */
export type FieldConflictDetail = {
  fieldName: string;
  fieldLabel: string;
  values: Array<{
    value: string;
    source: string;
    sourceLabel: string;
    confidence: number;
    rawOrigin: string;
  }>;
  severity: "critical" | "warning";
};
