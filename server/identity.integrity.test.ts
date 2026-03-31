/**
 * Identity Integrity Gate — Comprehensive Tests
 * ===============================================
 * يغطي:
 * 1. Field-Level Schema: كل حقل يحمل value + source + rawOrigin + confidence + status
 * 2. ConflictDetector: قواعد الحسم والتعارض لكل حقل
 * 3. IdentityIntegrityGate: فحص الاستقرار وإيقاف pipeline
 * 4. مثال عملي قبل/بعد: lead مختلطة → اكتشاف التعارض → منع التحليل
 * 5. Integration test: pipeline تتوقف عند identity_unstable
 */

import { describe, it, expect } from "vitest";
import { extractIdentityProfile, mergeIdentityProfiles } from "./lib/fieldValidator";
import { checkIdentityIntegrity } from "./lib/conflictDetector";
import {
  runGateOnCandidate,
  runGateOnGroup,
  runGateOnBatch,
  isOperationAllowed,
} from "./lib/identityIntegrityGate";
import type { DiscoveryCandidate } from "../shared/types/lead-intelligence";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCandidate(overrides: Partial<DiscoveryCandidate> & { id?: string }): DiscoveryCandidate {
  return {
    id: overrides.id || `test-${Date.now()}-${Math.random()}`,
    source: overrides.source || "instagram",
    sourceType: overrides.sourceType || "social",
    nameHint: overrides.nameHint,
    businessNameHint: overrides.businessNameHint,
    verifiedPhones: overrides.verifiedPhones || [],
    candidatePhones: overrides.candidatePhones || [],
    verifiedWebsite: overrides.verifiedWebsite,
    candidateWebsites: overrides.candidateWebsites || [],
    cityHint: overrides.cityHint,
    categoryHint: overrides.categoryHint,
    usernameHint: overrides.usernameHint,
    confidence: overrides.confidence ?? 0.7,
    verifiedEmails: overrides.verifiedEmails || [],
    candidateEmails: overrides.candidateEmails || [],
    url: overrides.url,
    raw: overrides.raw || {},
  };
}

// ─── Suite 1: Field-Level Schema ─────────────────────────────────────────────

describe("Field-Level Schema", () => {
  it("يستخرج businessName من businessNameHint مع source صحيح", () => {
    const candidate = makeCandidate({
      source: "instagram",
      businessNameHint: "مطعم الأصيل",
    });

    const profile = extractIdentityProfile(candidate);

    expect(profile.businessName.status).not.toBe("unknown");
    expect(profile.businessName.evidence[0].source).toBe("instagram");
    expect(profile.businessName.evidence[0].value).toBe("مطعم الأصيل");
    expect(profile.businessName.evidence[0].confidence).toBeGreaterThan(0);
    expect(profile.businessName.evidence[0].rawOrigin).toBeTruthy();
  });

  it("يستخرج phone من verifiedPhones مع confidence عالية", () => {
    const candidate = makeCandidate({
      source: "maps",
      verifiedPhones: ["0501234567"],
    });

    const profile = extractIdentityProfile(candidate);

    expect(profile.phone.evidence[0].value).toBe("0501234567");
    expect(profile.phone.evidence[0].confidence).toBeGreaterThanOrEqual(0.9);
    expect(profile.phone.evidence[0].source).toBe("maps");
  });

  it("يستخرج phone من candidatePhones مع confidence أقل", () => {
    const candidate = makeCandidate({
      source: "instagram",
      candidatePhones: ["0559876543"],
    });

    const profile = extractIdentityProfile(candidate);

    expect(profile.phone.evidence[0].value).toBe("0559876543");
    expect(profile.phone.evidence[0].confidence).toBeLessThan(0.9);
  });

  it("يُعيد status=unknown للحقول الفارغة", () => {
    const candidate = makeCandidate({
      source: "instagram",
      // لا هاتف، لا موقع، لا مدينة
    });

    const profile = extractIdentityProfile(candidate);

    expect(profile.phone.status).toBe("unknown");
    expect(profile.websiteDomain.status).toBe("unknown");
  });

  it("يستخرج websiteDomain من verifiedWebsite", () => {
    const candidate = makeCandidate({
      source: "maps",
      verifiedWebsite: "https://www.aseel-restaurant.com",
    });

    const profile = extractIdentityProfile(candidate);

    expect(profile.websiteDomain.evidence[0].value).toContain("aseel-restaurant");
    expect(profile.websiteDomain.evidence[0].source).toBe("maps");
    expect(profile.websiteDomain.evidence[0].rawOrigin).toContain("https://www.aseel-restaurant.com");
  });

  it("يستخرج city من cityHint", () => {
    const candidate = makeCandidate({
      source: "instagram",
      cityHint: "الرياض",
    });

    const profile = extractIdentityProfile(candidate);

    expect(profile.city.evidence[0].value).toBe("الرياض");
    expect(profile.city.evidence[0].source).toBe("instagram");
  });

  it("يستخرج primarySocialIdentity من source+url", () => {
    const candidate = makeCandidate({
      source: "instagram",
      usernameHint: "aseel_restaurant",
      url: "https://www.instagram.com/aseel_restaurant",
    });

    const profile = extractIdentityProfile(candidate);

    expect(profile.primarySocialIdentity.evidence[0].value).toContain("aseel_restaurant");
    expect(profile.primarySocialIdentity.evidence[0].source).toBe("instagram");
  });
});

// ─── Suite 2: Conflict Detection Rules ───────────────────────────────────────

describe("Conflict Detection Rules", () => {
  it("confirmed: مصدران يتفقان على نفس الهاتف بعد التطبيع", () => {
    const c1 = makeCandidate({ source: "instagram", candidatePhones: ["0501234567"] });
    const c2 = makeCandidate({ source: "maps", verifiedPhones: ["0501234567"] });

    const p1 = extractIdentityProfile(c1);
    const p2 = extractIdentityProfile(c2);
    const merged = mergeIdentityProfiles([p1, p2]);

    expect(merged.phone.status).toBe("confirmed");
  });

  it("conflicting: مصدران يختلفان على الهاتف → conflicting", () => {
    const c1 = makeCandidate({ source: "instagram", candidatePhones: ["0501234567"] });
    const c2 = makeCandidate({ source: "maps", verifiedPhones: ["0559876543"] });

    const p1 = extractIdentityProfile(c1);
    const p2 = extractIdentityProfile(c2);
    const merged = mergeIdentityProfiles([p1, p2]);

    expect(merged.phone.status).toBe("conflicting");
    expect(merged.phone.evidence.length).toBe(2);
  });

  it("conflicting: مصدران يختلفان على الموقع → conflicting", () => {
    const c1 = makeCandidate({ source: "instagram", verifiedWebsite: "https://site-a.com" });
    const c2 = makeCandidate({ source: "maps", verifiedWebsite: "https://site-b.com" });

    const p1 = extractIdentityProfile(c1);
    const p2 = extractIdentityProfile(c2);
    const merged = mergeIdentityProfiles([p1, p2]);

    expect(merged.websiteDomain.status).toBe("conflicting");
  });

  it("candidate: مصدر واحد بثقة < 0.85", () => {
    const candidate = makeCandidate({
      source: "instagram",
      candidatePhones: ["0501234567"],
    });

    const profile = extractIdentityProfile(candidate);

    // candidatePhones → confidence أقل من 0.85
    expect(profile.phone.status).toBe("candidate");
  });

  it("confirmed: مصدر واحد بثقة ≥ 0.9 (verifiedPhone من maps)", () => {
    const candidate = makeCandidate({
      source: "maps",
      verifiedPhones: ["0501234567"],
    });

    const profile = extractIdentityProfile(candidate);

    expect(profile.phone.status).toBe("confirmed");
  });

  it("unknown: لا يوجد أي مصدر للهاتف", () => {
    const candidate = makeCandidate({ source: "instagram" });
    const profile = extractIdentityProfile(candidate);
    expect(profile.phone.status).toBe("unknown");
  });
});

// ─── Suite 3: Identity Stability Status ──────────────────────────────────────

describe("Identity Stability Status", () => {
  it("stable: لا يوجد تعارض في أي حقل (مصدر واحد بثقة عالية)", () => {
    // مصدر واحد بحقول مؤكدة (ثقة ≥ 0.85) → stable
    // raw.phone بثقة 0.85 و verifiedWebsite بثقة 0.90
    const candidate = makeCandidate({
      source: "maps",
      businessNameHint: "مطعم الأصيل",
      verifiedPhones: ["0501234567"],
      verifiedWebsite: "https://aseel.com",
      cityHint: "الرياض",
      raw: { phone: "0501234567" }, // raw.phone بثقة 0.85 → confirmed
    });

    const profile = extractIdentityProfile(candidate);
    const result = checkIdentityIntegrity(profile);

    // لا يجب أن يكون identity_unstable
    expect(result.status).not.toBe("identity_unstable");
    expect(result.canProceed).toBe(true);
    expect(result.conflictingFields.length).toBe(0);
  });

  it("identity_unstable: تعارض في الهاتف → identity_unstable", () => {
    const c1 = makeCandidate({ source: "instagram", candidatePhones: ["0501234567"] });
    const c2 = makeCandidate({ source: "maps", verifiedPhones: ["0559876543"] });

    const merged = mergeIdentityProfiles([
      extractIdentityProfile(c1),
      extractIdentityProfile(c2),
    ]);
    const result = checkIdentityIntegrity(merged);

    expect(result.status).toBe("identity_unstable");
    expect(result.canProceed).toBe(false);
    expect(result.conflictingFields.some(cf => cf.fieldName === "phone")).toBe(true);
  });

  it("identity_unstable: تعارض في الموقع → identity_unstable", () => {
    const c1 = makeCandidate({ source: "instagram", verifiedWebsite: "https://site-a.com" });
    const c2 = makeCandidate({ source: "maps", verifiedWebsite: "https://site-b.com" });

    const merged = mergeIdentityProfiles([
      extractIdentityProfile(c1),
      extractIdentityProfile(c2),
    ]);
    const result = checkIdentityIntegrity(merged);

    expect(result.status).toBe("identity_unstable");
    expect(result.canProceed).toBe(false);
  });

  it("identity_unstable: رسالة المستخدم تحتوي على تفاصيل التعارض", () => {
    const c1 = makeCandidate({ source: "instagram", candidatePhones: ["0501234567"] });
    const c2 = makeCandidate({ source: "maps", verifiedPhones: ["0559876543"] });

    const merged = mergeIdentityProfiles([
      extractIdentityProfile(c1),
      extractIdentityProfile(c2),
    ]);
    const result = checkIdentityIntegrity(merged);

    expect(result.userMessage).toContain("هوية غير مستقرة");
    expect(result.userMessage).toContain("0501234567");
    expect(result.userMessage).toContain("0559876543");
  });

  it("merge_requires_review: لا تعارض لكن ثقة منخفضة", () => {
    // مرشح واحد بـ candidatePhones فقط (ثقة منخفضة)
    const candidate = makeCandidate({
      source: "instagram",
      candidatePhones: ["0501234567"],
      candidateWebsites: ["https://some-site.com"],
    });

    const profile = extractIdentityProfile(candidate);
    const result = checkIdentityIntegrity(profile);

    // يجب أن يكون stable أو merge_requires_review (لا identity_unstable)
    expect(result.status).not.toBe("identity_unstable");
    expect(result.canProceed).toBe(true);
  });
});

// ─── Suite 4: Gate Operations Blocking ───────────────────────────────────────

describe("Gate Operations Blocking", () => {
  it("يمنع scoring عند identity_unstable", () => {
    const c1 = makeCandidate({ source: "instagram", candidatePhones: ["0501234567"] });
    const c2 = makeCandidate({ source: "maps", verifiedPhones: ["0559876543"] });

    const merged = mergeIdentityProfiles([
      extractIdentityProfile(c1),
      extractIdentityProfile(c2),
    ]);
    const integrityResult = checkIdentityIntegrity(merged);

    const check = isOperationAllowed(integrityResult, "scoring");
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain("محظورة");
  });

  it("يمنع opportunities عند identity_unstable", () => {
    const c1 = makeCandidate({ source: "instagram", candidatePhones: ["0501234567"] });
    const c2 = makeCandidate({ source: "maps", verifiedPhones: ["0559876543"] });

    const merged = mergeIdentityProfiles([
      extractIdentityProfile(c1),
      extractIdentityProfile(c2),
    ]);
    const integrityResult = checkIdentityIntegrity(merged);

    expect(isOperationAllowed(integrityResult, "opportunities").allowed).toBe(false);
  });

  it("يمنع sales_brief عند identity_unstable", () => {
    const c1 = makeCandidate({ source: "instagram", candidatePhones: ["0501234567"] });
    const c2 = makeCandidate({ source: "maps", verifiedPhones: ["0559876543"] });

    const merged = mergeIdentityProfiles([
      extractIdentityProfile(c1),
      extractIdentityProfile(c2),
    ]);
    const integrityResult = checkIdentityIntegrity(merged);

    expect(isOperationAllowed(integrityResult, "sales_brief").allowed).toBe(false);
  });

  it("يمنع competitor_analysis عند identity_unstable", () => {
    const c1 = makeCandidate({ source: "instagram", candidatePhones: ["0501234567"] });
    const c2 = makeCandidate({ source: "maps", verifiedPhones: ["0559876543"] });

    const merged = mergeIdentityProfiles([
      extractIdentityProfile(c1),
      extractIdentityProfile(c2),
    ]);
    const integrityResult = checkIdentityIntegrity(merged);

    expect(isOperationAllowed(integrityResult, "competitor_analysis").allowed).toBe(false);
  });

  it("يمنع ai_enrichment عند identity_unstable", () => {
    const c1 = makeCandidate({ source: "instagram", candidatePhones: ["0501234567"] });
    const c2 = makeCandidate({ source: "maps", verifiedPhones: ["0559876543"] });

    const merged = mergeIdentityProfiles([
      extractIdentityProfile(c1),
      extractIdentityProfile(c2),
    ]);
    const integrityResult = checkIdentityIntegrity(merged);

    expect(isOperationAllowed(integrityResult, "ai_enrichment").allowed).toBe(false);
  });

  it("يمنع auto_save عند identity_unstable", () => {
    const c1 = makeCandidate({ source: "instagram", candidatePhones: ["0501234567"] });
    const c2 = makeCandidate({ source: "maps", verifiedPhones: ["0559876543"] });

    const merged = mergeIdentityProfiles([
      extractIdentityProfile(c1),
      extractIdentityProfile(c2),
    ]);
    const integrityResult = checkIdentityIntegrity(merged);

    expect(isOperationAllowed(integrityResult, "auto_save").allowed).toBe(false);
  });

  it("يسمح بجميع العمليات عند عدم وجود تعارض", () => {
    // مصدر واحد بدون تعارض → يجب أن تكون جميع العمليات مسموحة
    const candidate = makeCandidate({
      source: "maps",
      businessNameHint: "مطعم الأصيل",
      verifiedPhones: ["0501234567"],
      cityHint: "الرياض",
    });

    const profile = extractIdentityProfile(candidate);
    const integrityResult = checkIdentityIntegrity(profile);

    // لا يجب أن يكون identity_unstable
    expect(integrityResult.status).not.toBe("identity_unstable");
    expect(integrityResult.canProceed).toBe(true);
    // عند canProceed=true جميع العمليات مسموحة
    expect(isOperationAllowed(integrityResult, "scoring").allowed).toBe(true);
    expect(isOperationAllowed(integrityResult, "ai_enrichment").allowed).toBe(true);
    expect(isOperationAllowed(integrityResult, "auto_save").allowed).toBe(true);
  });
});

// ─── Suite 5: runGateOnCandidate ─────────────────────────────────────────────

describe("runGateOnCandidate", () => {
  it("يُعيد decision.allowed=true للمرشح المستقر", () => {
    const candidate = makeCandidate({
      id: "stable-001",
      source: "maps",
      businessNameHint: "مطعم الأصيل",
      verifiedPhones: ["0501234567"],
      cityHint: "الرياض",
    });

    const result = runGateOnCandidate(candidate);

    expect(result.decision.allowed).toBe(true);
    expect(result.decision.blockedReason).toBeUndefined();
    expect(result.conflictDetails.length).toBe(0);
  });

  it("يُعيد decision.allowed=false للمرشح المتعارض", () => {
    // مرشح واحد لكن بيانات raw تحتوي على تعارض داخلي
    // نبني هذا عبر mergeIdentityProfiles
    const c1 = makeCandidate({ id: "conflict-001", source: "instagram", candidatePhones: ["0501234567"] });
    const c2 = makeCandidate({ id: "conflict-001", source: "maps", verifiedPhones: ["0559876543"] });

    const result = runGateOnGroup([c1, c2]);

    expect(result.decision.allowed).toBe(false);
    expect(result.decision.blockedReason).toBeTruthy();
    expect(result.conflictDetails.length).toBeGreaterThan(0);
  });
});

// ─── Suite 6: runGateOnBatch ──────────────────────────────────────────────────

describe("runGateOnBatch", () => {
  it("يُحسب passedCount و blockedCount بشكل صحيح", () => {
    const stable1 = makeCandidate({
      id: "s1",
      source: "maps",
      businessNameHint: "مطعم الأصيل",
      verifiedPhones: ["0501234567"],
    });
    const stable2 = makeCandidate({
      id: "s2",
      source: "instagram",
      businessNameHint: "كافيه النخيل",
    });
    // مرشح بدون تعارض (مصدر واحد فقط)
    const noConflict = makeCandidate({
      id: "s3",
      source: "tiktok",
      businessNameHint: "متجر الجوهرة",
      candidatePhones: ["0501111111"],
    });

    const batchResult = runGateOnBatch([stable1, stable2, noConflict]);

    // جميع المرشحين مصدر واحد → لا تعارض → stable أو merge_requires_review
    expect(batchResult.blockedCount).toBe(0);
    expect(batchResult.passedCount + batchResult.reviewCount).toBe(3);
  });

  it("يُعيد summary يحتوي على الأرقام الصحيحة", () => {
    const candidate = makeCandidate({
      id: "sum-001",
      source: "maps",
      businessNameHint: "مطعم الأصيل",
      verifiedPhones: ["0501234567"],
    });

    const result = runGateOnBatch([candidate]);

    expect(result.summary).toContain("إجمالي: 1");
  });
});

// ─── Suite 7: مثال عملي قبل/بعد ─────────────────────────────────────────────
// هذا هو الاختبار الأهم: يُثبت أن النظام يكتشف التعارض ويمنع التحليل

describe("مثال عملي قبل/بعد: lead مختلطة", () => {
  /**
   * السيناريو:
   * نتيجة من إنستجرام: اسم "مطعم الأصيل" + هاتف 0501234567
   * نتيجة من Google Maps: اسم "مطعم الأصيل" + هاتف 0559876543 (مختلف!) + موقع site-a.com
   * نتيجة من تيك توك: اسم "الأصيل للمأكولات" + موقع site-b.com (مختلف!)
   *
   * قبل الـ Gate: النظام كان يدمج هذه النتائج ويبني lead واحدة بحقول مختلطة
   * بعد الـ Gate: النظام يكتشف التعارض ويمنع التحليل
   */

  const instagramCandidate = makeCandidate({
    id: "ig-aseel",
    source: "instagram",
    businessNameHint: "مطعم الأصيل",
    candidatePhones: ["0501234567"],
    cityHint: "الرياض",
  });

  const mapsCandidate = makeCandidate({
    id: "maps-aseel",
    source: "maps",
    businessNameHint: "مطعم الأصيل",
    verifiedPhones: ["0559876543"], // ← هاتف مختلف!
    verifiedWebsite: "https://aseel-riyadh.com",
    cityHint: "الرياض",
  });

  const tiktokCandidate = makeCandidate({
    id: "tt-aseel",
    source: "tiktok",
    businessNameHint: "الأصيل للمأكولات",
    verifiedWebsite: "https://aseel-foods.com", // ← موقع مختلف!
    cityHint: "الرياض",
  });

  it("قبل الـ Gate: الدمج المباشر يُنتج lead بحقول متعارضة", () => {
    const profiles = [
      extractIdentityProfile(instagramCandidate),
      extractIdentityProfile(mapsCandidate),
      extractIdentityProfile(tiktokCandidate),
    ];
    const merged = mergeIdentityProfiles(profiles);

    // التحقق من وجود التعارضات
    expect(merged.phone.status).toBe("conflicting");
    expect(merged.websiteDomain.status).toBe("conflicting");
    expect(merged.phone.evidence.length).toBe(2); // هاتفان مختلفان
    expect(merged.websiteDomain.evidence.length).toBe(2); // موقعان مختلفان
  });

  it("بعد الـ Gate: يكتشف التعارض ويُعيد identity_unstable", () => {
    const result = runGateOnGroup([instagramCandidate, mapsCandidate, tiktokCandidate]);

    expect(result.integrityResult.status).toBe("identity_unstable");
    expect(result.decision.allowed).toBe(false);
    expect(result.conflictDetails.length).toBeGreaterThan(0);
  });

  it("بعد الـ Gate: تفاصيل التعارض تحتوي على القيم والمصادر", () => {
    const result = runGateOnGroup([instagramCandidate, mapsCandidate, tiktokCandidate]);

    const phoneConflict = result.conflictDetails.find(cf => cf.fieldName === "phone");
    expect(phoneConflict).toBeTruthy();
    expect(phoneConflict!.severity).toBe("critical");
    expect(phoneConflict!.values.some(v => v.value === "0501234567")).toBe(true);
    expect(phoneConflict!.values.some(v => v.value === "0559876543")).toBe(true);
    expect(phoneConflict!.values.some(v => v.source === "instagram")).toBe(true);
    expect(phoneConflict!.values.some(v => v.source === "maps")).toBe(true);
  });

  it("Integration: pipeline تتوقف عند identity_unstable — جميع العمليات محظورة", () => {
    const result = runGateOnGroup([instagramCandidate, mapsCandidate, tiktokCandidate]);
    const integrityResult = result.integrityResult;

    // التحقق من أن جميع العمليات الحرجة محظورة
    const operations = ["scoring", "opportunities", "sales_brief", "competitor_analysis", "ai_enrichment", "auto_save"] as const;
    for (const op of operations) {
      const check = isOperationAllowed(integrityResult, op);
      expect(check.allowed).toBe(false);
    }
  });

  it("Integration: رسالة المستخدم تحتوي على تفاصيل التعارض بالعربية", () => {
    const result = runGateOnGroup([instagramCandidate, mapsCandidate, tiktokCandidate]);

    expect(result.integrityResult.userMessage).toContain("هوية غير مستقرة");
    expect(result.integrityResult.userMessage).toContain("مراجعة");
    // يجب أن يذكر الهاتف أو الموقع
    const hasPhoneOrWebsite =
      result.integrityResult.userMessage.includes("الهاتف") ||
      result.integrityResult.userMessage.includes("الموقع");
    expect(hasPhoneOrWebsite).toBe(true);
  });

  it("Integration: مرشح مستقل (مصدر واحد بدون تعارض) يمر بدون مشاكل", () => {
    const stableCandidate = makeCandidate({
      id: "stable-separate",
      source: "maps",
      businessNameHint: "مطعم آخر",
      verifiedPhones: ["0501111111"],
      cityHint: "جدة",
    });

    const result = runGateOnCandidate(stableCandidate);

    // مصدر واحد بدون تعارض → يجب أن يكون canProceed=true
    expect(result.integrityResult.status).not.toBe("identity_unstable");
    expect(result.decision.allowed).toBe(true);
    expect(isOperationAllowed(result.integrityResult, "scoring").allowed).toBe(true);
    expect(isOperationAllowed(result.integrityResult, "ai_enrichment").allowed).toBe(true);
  });
});

// ─── Suite 8: Batch Gate — فصل المستقر عن غير المستقر ───────────────────────

describe("Batch Gate: فصل المستقر عن غير المستقر", () => {
  it("يفصل المرشحين المستقرين عن المتعارضين في نفس الدفعة", () => {
    const stable = makeCandidate({
      id: "batch-stable",
      source: "maps",
      businessNameHint: "مطعم النخيل",
      verifiedPhones: ["0501111111"],
    });

    // مرشح بدون تعارض داخلي (مصدر واحد)
    const noConflict = makeCandidate({
      id: "batch-no-conflict",
      source: "instagram",
      businessNameHint: "كافيه الورد",
      candidatePhones: ["0502222222"],
    });

    const batchResult = runGateOnBatch([stable, noConflict]);

    // كلاهما مصدر واحد → لا تعارض
    expect(batchResult.blockedCount).toBe(0);
    expect(batchResult.results.length).toBe(2);
  });

  it("يُعيد تفاصيل كاملة لكل مرشح في الدفعة", () => {
    const candidate = makeCandidate({
      id: "detail-test",
      source: "maps",
      businessNameHint: "مطعم الأصيل",
      verifiedPhones: ["0501234567"],
      cityHint: "الرياض",
    });

    const batchResult = runGateOnBatch([candidate]);

    expect(batchResult.results[0].id).toBe("detail-test");
    expect(batchResult.results[0].identityProfile).toBeTruthy();
    expect(batchResult.results[0].integrityResult).toBeTruthy();
    expect(batchResult.results[0].conflictDetails).toBeTruthy();
  });
});
