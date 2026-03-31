/**
 * Conflict Detector — قواعد الحسم والتعارض لكل حقل حرج
 * ========================================================
 * يأخذ IdentityProfile ويُحدد:
 *  - هل كل حقل confirmed / candidate / conflicting / unknown
 *  - متى تتحول الـ lead إلى: stable / identity_unstable / merge_requires_review
 *
 * قواعد الحسم لكل حقل:
 * ┌─────────────────────────┬────────────────────────────────────────────────────┐
 * │ الحالة                  │ الشرط                                              │
 * ├─────────────────────────┼────────────────────────────────────────────────────┤
 * │ confirmed               │ مصادر متعددة تتفق على نفس القيمة (بعد التطبيع)    │
 * │                         │ أو مصدر واحد بثقة ≥ 0.85 (direct/verified)        │
 * ├─────────────────────────┼────────────────────────────────────────────────────┤
 * │ candidate               │ مصدر واحد بثقة < 0.85                              │
 * │                         │ أو مصادر متعددة تتفق لكن بثقة منخفضة              │
 * ├─────────────────────────┼────────────────────────────────────────────────────┤
 * │ conflicting             │ مصادر متعددة تحمل قيماً مختلفة لا يمكن التوفيق    │
 * │                         │ بينها (بعد التطبيع)                                │
 * ├─────────────────────────┼────────────────────────────────────────────────────┤
 * │ unknown                 │ لا يوجد أي مصدر                                    │
 * └─────────────────────────┴────────────────────────────────────────────────────┘
 *
 * قواعد استقرار الهوية:
 * ┌─────────────────────────┬────────────────────────────────────────────────────┐
 * │ stable                  │ لا يوجد أي حقل conflicting                         │
 * ├─────────────────────────┼────────────────────────────────────────────────────┤
 * │ identity_unstable       │ حقل حرج واحد على الأقل conflicting                 │
 * │                         │ (businessName / phone / websiteDomain)              │
 * ├─────────────────────────┼────────────────────────────────────────────────────┤
 * │ merge_requires_review   │ لا يوجد conflicting لكن ثقة منخفضة أو حقول مهمة  │
 * │                         │ بحالة candidate فقط                                │
 * └─────────────────────────┴────────────────────────────────────────────────────┘
 */

import type {
  IdentityProfile,
  IdentityIntegrityResult,
  IdentityStabilityStatus,
  FieldConflictDetail,
} from "../../shared/types/field-integrity";

// ─── الحقول الحرجة التي تُسبب identity_unstable عند التعارض ─────────────────

const CRITICAL_CONFLICT_FIELDS: Array<keyof IdentityProfile> = [
  "businessName",
  "phone",
  "websiteDomain",
];

// ─── تسميات الحقول بالعربية ───────────────────────────────────────────────────

const FIELD_LABELS: Record<keyof IdentityProfile, string> = {
  businessName: "اسم النشاط التجاري",
  phone: "رقم الهاتف",
  websiteDomain: "الموقع الإلكتروني",
  city: "المدينة",
  category: "تصنيف النشاط",
  primarySocialIdentity: "الهوية الاجتماعية",
};

// ─── الدالة الرئيسية: فحص استقرار الهوية ─────────────────────────────────────

export function checkIdentityIntegrity(profile: IdentityProfile): IdentityIntegrityResult {
  const fieldNames: Array<keyof IdentityProfile> = [
    "businessName", "phone", "websiteDomain", "city", "category", "primarySocialIdentity"
  ];

  const conflictingFields: IdentityIntegrityResult["conflictingFields"] = [];
  const missingFields: Array<keyof IdentityProfile> = [];
  const confirmedFields: Array<keyof IdentityProfile> = [];
  const candidateFields: Array<keyof IdentityProfile> = [];

  // فحص كل حقل
  for (const fieldName of fieldNames) {
    const field = profile[fieldName];

    switch (field.status) {
      case "confirmed":
        confirmedFields.push(fieldName);
        break;

      case "candidate":
        candidateFields.push(fieldName);
        break;

      case "conflicting":
        conflictingFields.push({
          fieldName,
          values: field.evidence.map(e => ({
            value: e.value,
            source: e.source,
            confidence: e.confidence,
          })),
          reason: field.reason,
        });
        break;

      case "unknown":
        missingFields.push(fieldName);
        break;
    }
  }

  // ─── تحديد حالة الاستقرار ────────────────────────────────────────────────────

  let stabilityStatus: IdentityStabilityStatus;

  // هل يوجد تعارض في حقل حرج؟
  const hasCriticalConflict = conflictingFields.some(cf =>
    CRITICAL_CONFLICT_FIELDS.includes(cf.fieldName)
  );

  // هل يوجد تعارض في أي حقل؟
  const hasAnyConflict = conflictingFields.length > 0;

  if (hasCriticalConflict || hasAnyConflict) {
    stabilityStatus = "identity_unstable";
  } else {
    // لا يوجد تعارض — هل الثقة كافية؟
    const confirmedCount = confirmedFields.length;
    const candidateCount = candidateFields.length;
    const totalKnown = confirmedCount + candidateCount;

    // إذا معظم الحقول المعروفة candidate فقط → يحتاج مراجعة
    if (totalKnown > 0 && confirmedCount === 0 && candidateCount >= 2) {
      stabilityStatus = "merge_requires_review";
    } else {
      stabilityStatus = "stable";
    }
  }

  // ─── حساب الثقة الإجمالية ────────────────────────────────────────────────────

  const overallConfidence = computeOverallConfidence(profile, stabilityStatus);

  // ─── بناء رسالة المستخدم ─────────────────────────────────────────────────────

  const userMessage = buildUserMessage(
    stabilityStatus,
    conflictingFields,
    missingFields,
    confirmedFields,
    candidateFields
  );

  return {
    status: stabilityStatus,
    profile,
    conflictingFields,
    missingFields,
    confirmedFields,
    candidateFields,
    overallConfidence,
    canProceed: stabilityStatus !== "identity_unstable",
    userMessage,
  };
}

// ─── حساب الثقة الإجمالية ────────────────────────────────────────────────────

function computeOverallConfidence(
  profile: IdentityProfile,
  stability: IdentityStabilityStatus
): number {
  if (stability === "identity_unstable") return 0;

  const fieldWeights: Record<keyof IdentityProfile, number> = {
    businessName: 0.30,
    phone: 0.25,
    websiteDomain: 0.20,
    city: 0.10,
    category: 0.10,
    primarySocialIdentity: 0.05,
  };

  let totalWeight = 0;
  let weightedScore = 0;

  for (const [fieldName, weight] of Object.entries(fieldWeights) as Array<[keyof IdentityProfile, number]>) {
    const field = profile[fieldName];
    totalWeight += weight;

    switch (field.status) {
      case "confirmed":
        weightedScore += weight * 1.0;
        break;
      case "candidate": {
        const bestConfidence = field.evidence.length > 0
          ? Math.max(...field.evidence.map(e => e.confidence))
          : 0;
        weightedScore += weight * bestConfidence;
        break;
      }
      case "conflicting":
        weightedScore += 0; // تعارض = صفر
        break;
      case "unknown":
        weightedScore += 0; // غياب = صفر
        break;
    }
  }

  return totalWeight > 0 ? Math.round((weightedScore / totalWeight) * 100) / 100 : 0;
}

// ─── بناء رسالة المستخدم ─────────────────────────────────────────────────────

function buildUserMessage(
  status: IdentityStabilityStatus,
  conflictingFields: IdentityIntegrityResult["conflictingFields"],
  missingFields: Array<keyof IdentityProfile>,
  confirmedFields: Array<keyof IdentityProfile>,
  candidateFields: Array<keyof IdentityProfile>
): string {
  switch (status) {
    case "stable": {
      const parts: string[] = [];
      if (confirmedFields.length > 0) {
        parts.push(`${confirmedFields.length} حقل مؤكد`);
      }
      if (candidateFields.length > 0) {
        parts.push(`${candidateFields.length} حقل مرشح`);
      }
      if (missingFields.length > 0) {
        parts.push(`${missingFields.length} حقل ناقص`);
      }
      return `الهوية مستقرة — ${parts.join(", ")}`;
    }

    case "identity_unstable": {
      const conflictLines = conflictingFields.map(cf => {
        const valuesList = cf.values
          .map(v => `${v.value} (${v.source})`)
          .join(" ≠ ");
        return `• ${FIELD_LABELS[cf.fieldName]}: ${valuesList}`;
      });
      return [
        "⚠️ هوية غير مستقرة — يوجد تعارض في الحقول التالية:",
        ...conflictLines,
        "يرجى مراجعة هذا الكيان يدوياً قبل الحفظ أو التحليل.",
      ].join("\n");
    }

    case "merge_requires_review": {
      return [
        "⚡ الهوية تحتاج مراجعة — معظم الحقول مرشحة (ثقة منخفضة)",
        `الحقول المرشحة: ${candidateFields.map(f => FIELD_LABELS[f]).join(", ")}`,
        "يُنصح بالمراجعة اليدوية قبل الحفظ.",
      ].join("\n");
    }
  }
}

// ─── بناء تفاصيل التعارض للعرض في الواجهة ───────────────────────────────────

export function buildConflictDetails(
  result: IdentityIntegrityResult
): FieldConflictDetail[] {
  return result.conflictingFields.map(cf => ({
    fieldName: cf.fieldName,
    fieldLabel: FIELD_LABELS[cf.fieldName],
    values: cf.values.map(v => ({
      value: v.value,
      source: v.source,
      sourceLabel: getSourceLabel(v.source),
      confidence: v.confidence,
      rawOrigin: result.profile[cf.fieldName].evidence
        .find(e => e.source === v.source && e.value === v.value)
        ?.rawOrigin || "",
    })),
    severity: CRITICAL_CONFLICT_FIELDS.includes(cf.fieldName) ? "critical" : "warning",
  }));
}

// ─── Helper: تسمية المصدر بالعربية ───────────────────────────────────────────

function getSourceLabel(source: string): string {
  const labels: Record<string, string> = {
    google: "جوجل",
    maps: "خرائط جوجل",
    instagram: "إنستجرام",
    tiktok: "تيك توك",
    snapchat: "سناب شات",
    x: "إكس (تويتر)",
    facebook: "فيسبوك",
    linkedin: "لينكد إن",
    telegram: "تيليجرام",
    website: "الموقع الإلكتروني",
    unknown: "غير معروف",
  };
  return labels[source] || source;
}
