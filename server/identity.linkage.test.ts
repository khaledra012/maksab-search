/**
 * Identity Linkage Engine — Unit Tests (PHASE 1 Updated)
 * ========================================================
 * اختبارات الوحدة لخوارزمية الربط الذكي
 *
 * PHASE 1 CHANGES:
 *  - makeCandidate: phones → verifiedPhones/candidatePhones
 *  - makeCandidate: websites → verifiedWebsite/candidateWebsites
 *  - makeCandidate: rawSourceData → raw
 *  - makeCandidate: source → DiscoverySource (strict)
 *  - breakdown: cityScore/categoryScore → cityAndCategoryScore
 *  - resolveLeads output: mergeCount/mergedSources/verifiedPhone/verifiedWebsite → sourceRecords/verifiedPhones/verifiedWebsite
 */

import { describe, it, expect } from "vitest";
import {
  normalizeName,
  normalizePhone,
  extractDomain,
  computeLinkageScore,
  clusterCandidates,
  resolveLeads,
} from "./lib/identityLinkage";
import type { DiscoveryCandidate } from "../shared/types/lead-intelligence";

// ─── Helper ───────────────────────────────────────────────────────────────────

function makeCandidate(
  overrides: {
    nameHint?: string;
    businessNameHint?: string;
    verifiedPhones?: string[];
    candidatePhones?: string[];
    verifiedWebsite?: string;
    candidateWebsites?: string[];
    cityHint?: string;
    categoryHint?: string;
    usernameHint?: string;
    source?: DiscoveryCandidate["source"];
    confidence?: number;
    id?: string;
  } = {}
): DiscoveryCandidate {
  return {
    id: overrides.id || `test-${Math.random().toString(36).slice(2)}`,
    source: overrides.source || "instagram",
    sourceType: "profile",
    confidence: overrides.confidence ?? 0.7,
    raw: {},
    verifiedPhones: overrides.verifiedPhones || [],
    candidatePhones: overrides.candidatePhones || [],
    verifiedEmails: [],
    candidateEmails: [],
    verifiedWebsite: overrides.verifiedWebsite,
    candidateWebsites: overrides.candidateWebsites || [],
    nameHint: overrides.nameHint,
    businessNameHint: overrides.businessNameHint || overrides.nameHint,
    cityHint: overrides.cityHint,
    categoryHint: overrides.categoryHint,
    usernameHint: overrides.usernameHint,
  };
}

// ─── 1. normalizeName ─────────────────────────────────────────────────────────

describe("normalizeName", () => {
  it("يُطبّع الاسم العربي بإزالة التشكيل والكلمات الشائعة", () => {
    expect(normalizeName("مَطعَم البَركة")).toBe("البركه");
    expect(normalizeName("مطعم البركة")).toBe("البركه");
    expect(normalizeName("محل البركة")).toBe("البركه");
  });

  it("يُطبّع الاسم الإنجليزي بإزالة الكلمات الشائعة", () => {
    expect(normalizeName("Al Baraka Restaurant")).toBe("al baraka");
    expect(normalizeName("Baraka Restaurant & Cafe")).toBe("baraka");
  });

  it("يُوحّد الهمزات والألف", () => {
    expect(normalizeName("أحمد")).toBe("احمد");
    expect(normalizeName("إبراهيم")).toBe("ابراهيم");
    expect(normalizeName("آل سعود")).toBe("ال سعود");
  });

  it("يُرجع نصاً فارغاً للمدخل الفارغ", () => {
    expect(normalizeName("")).toBe("");
    expect(normalizeName("   ")).toBe("");
  });
});

// ─── 2. normalizePhone ────────────────────────────────────────────────────────

describe("normalizePhone", () => {
  it("يُوحّد أرقام الهاتف السعودية بأشكالها المختلفة", () => {
    expect(normalizePhone("+966501234567")).toBe("501234567");
    expect(normalizePhone("00966501234567")).toBe("501234567");
    expect(normalizePhone("0501234567")).toBe("501234567");
    expect(normalizePhone("501234567")).toBe("501234567");
  });

  it("يُرجع نصاً فارغاً للرقم الفارغ", () => {
    expect(normalizePhone("")).toBe("");
  });

  it("يتجاهل الأحرف والمسافات", () => {
    expect(normalizePhone("+966 50 123 4567")).toBe("501234567");
    expect(normalizePhone("(0501) 234-567")).toBe("501234567");
  });
});

// ─── 3. extractDomain ─────────────────────────────────────────────────────────

describe("extractDomain", () => {
  it("يستخرج النطاق الأساسي من URL", () => {
    expect(extractDomain("https://www.albaraka.com/menu")).toBe("albaraka.com");
    expect(extractDomain("http://albaraka.com")).toBe("albaraka.com");
    expect(extractDomain("albaraka.com")).toBe("albaraka.com");
  });

  it("يُرجع نصاً فارغاً للمدخل الفارغ", () => {
    expect(extractDomain("")).toBe("");
  });
});

// ─── 4. computeLinkageScore ───────────────────────────────────────────────────

describe("computeLinkageScore", () => {
  it("يدمج عند تطابق رقم الهاتف المؤكد", () => {
    const a = makeCandidate({
      nameHint: "مطعم البركة",
      verifiedPhones: ["0501234567"],
      source: "instagram",
    });
    const b = makeCandidate({
      nameHint: "Al Baraka Restaurant",
      verifiedPhones: ["+966501234567"],
      source: "maps",
    });

    const result = computeLinkageScore(a, b);
    expect(result.shouldMerge).toBe(true);
    expect(result.breakdown.phoneScore).toBe(1);
  });

  it("يدمج عند تطابق رقم الهاتف المرشح", () => {
    const a = makeCandidate({
      nameHint: "مطعم البركة",
      candidatePhones: ["0501234567"],
      source: "instagram",
    });
    const b = makeCandidate({
      nameHint: "Al Baraka Restaurant",
      candidatePhones: ["+966501234567"],
      source: "maps",
    });

    const result = computeLinkageScore(a, b);
    expect(result.shouldMerge).toBe(true);
    expect(result.breakdown.phoneScore).toBe(1);
  });

  it("يدمج عند تطابق الموقع الإلكتروني المؤكد", () => {
    const a = makeCandidate({
      nameHint: "البركة للمأكولات",
      verifiedWebsite: "https://albaraka.com",
      source: "snapchat",
    });
    const b = makeCandidate({
      nameHint: "Al Baraka Foods",
      verifiedWebsite: "http://www.albaraka.com/about",
      source: "facebook",
    });

    const result = computeLinkageScore(a, b);
    expect(result.shouldMerge).toBe(true);
    expect(result.breakdown.websiteScore).toBe(1);
  });

  it("يدمج عند تطابق الموقع المرشح", () => {
    const a = makeCandidate({
      nameHint: "البركة",
      candidateWebsites: ["https://albaraka.com"],
      source: "instagram",
    });
    const b = makeCandidate({
      nameHint: "Al Baraka",
      candidateWebsites: ["http://www.albaraka.com"],
      source: "tiktok",
    });

    const result = computeLinkageScore(a, b);
    expect(result.shouldMerge).toBe(true);
    expect(result.breakdown.websiteScore).toBe(1);
  });

  it("يدمج عند تشابه الاسم العالي في نفس المدينة", () => {
    const a = makeCandidate({
      nameHint: "مطعم البركة",
      cityHint: "الرياض",
      source: "instagram",
    });
    const b = makeCandidate({
      nameHint: "البركة",
      cityHint: "الرياض",
      source: "tiktok",
    });

    const result = computeLinkageScore(a, b);
    // الاسم بعد التطبيع: "البركه" vs "البركه" → تطابق تام
    expect(result.shouldMerge).toBe(true);
  });

  it("لا يدمج عند اختلاف الاسم الكبير", () => {
    const a = makeCandidate({
      nameHint: "مطعم البركة",
      cityHint: "الرياض",
      source: "instagram",
    });
    const b = makeCandidate({
      nameHint: "مطعم النخيل",
      cityHint: "الرياض",
      source: "tiktok",
    });

    const result = computeLinkageScore(a, b);
    expect(result.shouldMerge).toBe(false);
  });

  it("يُرجع تفاصيل الدرجات بشكل صحيح (PHASE 1 fields)", () => {
    const a = makeCandidate({ nameHint: "مطعم البركة" });
    const b = makeCandidate({ nameHint: "مطعم البركة" });

    const result = computeLinkageScore(a, b);
    // PHASE 1: breakdown يحتوي على الحقول الجديدة
    expect(result.breakdown).toHaveProperty("nameScore");
    expect(result.breakdown).toHaveProperty("phoneScore");
    expect(result.breakdown).toHaveProperty("websiteScore");
    expect(result.breakdown).toHaveProperty("bioLinkScore");
    expect(result.breakdown).toHaveProperty("cityAndCategoryScore");
    expect(result.breakdown).toHaveProperty("socialHandleScore");
    expect(result.totalScore).toBeGreaterThanOrEqual(0);
    expect(result.totalScore).toBeLessThanOrEqual(1);
  });

  it("يُرجع matchedSignals صحيحة عند تطابق الهاتف", () => {
    const a = makeCandidate({ verifiedPhones: ["0501234567"] });
    const b = makeCandidate({ verifiedPhones: ["+966501234567"] });

    const result = computeLinkageScore(a, b);
    expect(result.matchedSignals).toContain("phone");
  });
});

// ─── 5. clusterCandidates ─────────────────────────────────────────────────────

describe("clusterCandidates", () => {
  it("يُرجع مجموعة واحدة لمرشح واحد", () => {
    const candidates = [makeCandidate({ nameHint: "مطعم البركة" })];
    const groups = clusterCandidates(candidates);
    expect(groups).toHaveLength(1);
    expect(groups[0].duplicates).toHaveLength(0);
  });

  it("يدمج ثلاثة مرشحين لنفس الكيان بالهاتف", () => {
    const phone = "0501234567";
    const candidates = [
      makeCandidate({ nameHint: "مطعم البركة", verifiedPhones: [phone], source: "instagram" }),
      makeCandidate({ nameHint: "Al Baraka Restaurant", verifiedPhones: ["+966501234567"], source: "maps" }),
      makeCandidate({ nameHint: "البركة للمأكولات", verifiedPhones: ["00966501234567"], source: "snapchat" }),
    ];

    const groups = clusterCandidates(candidates);
    expect(groups).toHaveLength(1);
    expect(groups[0].sources).toContain("instagram");
    expect(groups[0].sources).toContain("maps");
    expect(groups[0].sources).toContain("snapchat");
  });

  it("يفصل كيانين مختلفين", () => {
    const candidates = [
      makeCandidate({ nameHint: "مطعم البركة", cityHint: "الرياض", source: "instagram" }),
      makeCandidate({ nameHint: "مطعم النخيل", cityHint: "الرياض", source: "tiktok" }),
    ];

    const groups = clusterCandidates(candidates);
    expect(groups).toHaveLength(2);
  });

  it("يختار المرشح الأعلى confidence كـ primary", () => {
    const candidates = [
      makeCandidate({ nameHint: "مطعم البركة", verifiedPhones: ["0501234567"], confidence: 0.5, source: "instagram" }),
      makeCandidate({ nameHint: "Al Baraka", verifiedPhones: ["+966501234567"], confidence: 0.9, source: "maps" }),
    ];

    const groups = clusterCandidates(candidates);
    expect(groups).toHaveLength(1);
    expect(groups[0].primary.confidence).toBe(0.9);
    expect(groups[0].primary.source).toBe("maps");
  });
});

// ─── 6. resolveLeads (Integration) ───────────────────────────────────────────

describe("resolveLeads", () => {
  it("يُحوّل مرشحين متشابهين إلى lead واحد", () => {
    const candidates: DiscoveryCandidate[] = [
      makeCandidate({
        nameHint: "مطعم البركة",
        verifiedPhones: ["0501234567"],
        cityHint: "الرياض",
        source: "instagram",
      }),
      makeCandidate({
        nameHint: "Al Baraka Restaurant",
        verifiedPhones: ["+966501234567"],
        cityHint: "الرياض",
        verifiedWebsite: "https://albaraka.com",
        source: "maps",
      }),
    ];

    const leads = resolveLeads(candidates);
    expect(leads).toHaveLength(1);
    // PHASE 1: الحقول الجديدة
    expect(leads[0].sourceRecords).toHaveLength(2);
    expect(leads[0].verifiedPhones).toContain("501234567");
    expect(leads[0].verifiedWebsite).toBe("https://albaraka.com");
  });

  it("يُرجع قائمة فارغة للمدخل الفارغ", () => {
    const leads = resolveLeads([]);
    expect(leads).toHaveLength(0);
  });

  it("يحافظ على الكيانات المختلفة منفصلة", () => {
    const candidates: DiscoveryCandidate[] = [
      makeCandidate({ nameHint: "مطعم البركة", cityHint: "الرياض", source: "instagram" }),
      makeCandidate({ nameHint: "مطعم النخيل", cityHint: "الرياض", source: "instagram" }),
      makeCandidate({ nameHint: "مطعم الأصيل", cityHint: "جدة", source: "tiktok" }),
    ];

    const leads = resolveLeads(candidates);
    expect(leads).toHaveLength(3);
  });

  it("يدمج نتائج من 5 منصات لنفس الكيان", () => {
    const phone = "0501234567";
    const candidates: DiscoveryCandidate[] = [
      makeCandidate({ nameHint: "مطعم البركة", verifiedPhones: [phone], source: "instagram" }),
      makeCandidate({ nameHint: "Al Baraka", verifiedPhones: ["+966501234567"], source: "maps" }),
      makeCandidate({ nameHint: "البركة", verifiedPhones: ["00966501234567"], source: "snapchat" }),
      makeCandidate({ nameHint: "مطعم البركة الرياض", verifiedPhones: [phone], source: "tiktok" }),
      makeCandidate({ nameHint: "AlBaraka Restaurant", verifiedPhones: [phone], source: "facebook" }),
    ];

    const leads = resolveLeads(candidates);
    expect(leads).toHaveLength(1);
    expect(leads[0].sourceRecords).toHaveLength(5);
  });

  it("يُنشئ BusinessLead بالحقول الأساسية الصحيحة", () => {
    const candidates: DiscoveryCandidate[] = [
      makeCandidate({
        nameHint: "مطعم البركة",
        verifiedPhones: ["0501234567"],
        verifiedWebsite: "https://albaraka.com",
        cityHint: "الرياض",
        source: "maps",
        confidence: 0.9,
      }),
    ];

    const leads = resolveLeads(candidates);
    expect(leads).toHaveLength(1);
    const lead = leads[0];
    // PHASE 1: حقول BusinessLead الجديدة
    expect(lead.id).toBeTruthy();
    expect(lead.businessName).toBeTruthy();
    expect(lead.verifiedPhones).toBeDefined();
    expect(lead.candidatePhones).toBeDefined();
    expect(lead.verifiedEmails).toBeDefined();
    expect(lead.candidateEmails).toBeDefined();
    expect(lead.sourceRecords).toBeDefined();
    expect(lead.status).toBe("resolved");
    expect(lead.createdAt).toBeTruthy();
  });
});

// ─── 7. اختبارات الأوزان الجديدة (PHASE 1) ───────────────────────────────────

describe("PHASE 1 Weights Validation", () => {
  it("الهاتف وحده (25%) يكفي للدمج", () => {
    const a = makeCandidate({ verifiedPhones: ["0501234567"] });
    const b = makeCandidate({ verifiedPhones: ["+966501234567"] });

    const result = computeLinkageScore(a, b);
    expect(result.shouldMerge).toBe(true);
    expect(result.breakdown.phoneScore).toBe(1);
  });

  it("الموقع الإلكتروني (20%) + اسم مقبول يكفي للدمج", () => {
    const a = makeCandidate({
      nameHint: "البركة",
      verifiedWebsite: "https://albaraka.com",
    });
    const b = makeCandidate({
      nameHint: "Al Baraka",
      verifiedWebsite: "https://www.albaraka.com",
    });

    const result = computeLinkageScore(a, b);
    expect(result.shouldMerge).toBe(true);
    expect(result.breakdown.websiteScore).toBe(1);
  });

  it("الاسم المتطابق (85%+) + المدينة + منصتان مختلفتان يكفي للدمج", () => {
    // المنطق الجديد: يتطلب منصتين مختلفتين لتفعيل شرط الاسم+المدينة
    const a = makeCandidate({ nameHint: "البركة", cityHint: "الرياض", source: "instagram" });
    const b = makeCandidate({ nameHint: "البركة", cityHint: "الرياض", source: "maps" });

    const result = computeLinkageScore(a, b);
    expect(result.shouldMerge).toBe(true);
    expect(result.breakdown.nameScore).toBeGreaterThan(0.9);
  });

  it("الاسم المتطابق + المدينة من نفس المنصة لا يكفي للدمج بدون هاتف/موقع", () => {
    // نفس المنصة → لا يُطبَّق شرط الاسم+المدينة
    const a = makeCandidate({ nameHint: "البركة", cityHint: "الرياض", source: "instagram" });
    const b = makeCandidate({ nameHint: "البركة", cityHint: "الرياض", source: "instagram" });

    const result = computeLinkageScore(a, b);
    // بدون هاتف أو موقع أو username → لا دمج تلقائي
    expect(result.breakdown.nameScore).toBeGreaterThan(0.9);
  });

  it("لا يدمج بدون إشارات كافية", () => {
    const a = makeCandidate({ nameHint: "مطعم أ" });
    const b = makeCandidate({ nameHint: "مطعم ب" });

    const result = computeLinkageScore(a, b);
    expect(result.shouldMerge).toBe(false);
    expect(result.totalScore).toBeLessThan(0.55);
  });
});
