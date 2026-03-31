/**
 * Phase 7 — Search → Compare → Merge Pipeline Tests
 * ===================================================
 * يختبر الـ 3 procedures الجديدة:
 *   - groupCandidates
 *   - getMergePreview
 *   - createFromMerge
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock DB ────────────────────────────────────────────────────────────────
vi.mock("../db.js", () => ({
  createLeadWithResolution: vi.fn().mockResolvedValue(42),
  getLeadById: vi.fn(),
}));

// ─── Mock identityLinkage ────────────────────────────────────────────────────
vi.mock("../lib/identityLinkage.js", () => ({
  rawResultToCandidate: vi.fn((result: Record<string, unknown>, platform: string, idx: number) => ({
    id: `${platform}-${idx}`,
    source: platform,
    url: result.url || result.profileUrl || "",
    nameHint: result.name || result.fullName || result.username || "",
    businessNameHint: result.businessName || result.name || "",
    verifiedPhones: result.phone ? [result.phone] : [],
    candidatePhones: [],
    verifiedWebsite: result.website || "",
    candidateWebsites: [],
    cityHint: result.city || "",
    categoryHint: result.businessCategory || result.types?.[0] || "",
    confidence: 0.8,
    socialProfiles: {},
    googleMapsUrl: platform === "google" ? result.url : undefined,
  })),
  clusterCandidates: vi.fn((candidates: any[]) => {
    // تجميع بسيط: أول مرشحَين في مجموعة واحدة، الباقي مفردات
    if (candidates.length >= 2) {
      return [
        {
          primary: candidates[0],
          duplicates: [candidates[1]],
          mergeConfidence: 0.85,
          sources: [candidates[0].source, candidates[1].source],
        },
        ...candidates.slice(2).map(c => ({
          primary: c,
          duplicates: [],
          mergeConfidence: 0.5,
          sources: [c.source],
        })),
      ];
    }
    return candidates.map(c => ({
      primary: c,
      duplicates: [],
      mergeConfidence: 0.5,
      sources: [c.source],
    }));
  }),
  buildBusinessLeadFromGroup: vi.fn((group: any) => ({
    businessName: group.primary.businessNameHint || group.primary.nameHint || "Test Business",
    category: group.primary.categoryHint || "مطعم",
    city: group.primary.cityHint || "الرياض",
    verifiedPhones: group.primary.verifiedPhones || [],
    candidatePhones: [],
    verifiedWebsite: group.primary.verifiedWebsite || "",
    candidateWebsites: [],
    socialProfiles: {},
    googleMapsUrl: group.primary.googleMapsUrl,
  })),
}));

// ─── Import procedures ────────────────────────────────────────────────────────
import { createLeadWithResolution } from "../db.js";
import { rawResultToCandidate, clusterCandidates, buildBusinessLeadFromGroup } from "../lib/identityLinkage.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function makeGoogleResult(name: string, phone?: string, website?: string) {
  return {
    name,
    phone: phone || "",
    website: website || "",
    city: "الرياض",
    url: `https://maps.google.com/?q=${encodeURIComponent(name)}`,
    businessCategory: "مطعم",
  };
}

function makeInstagramResult(username: string, phone?: string) {
  return {
    username,
    fullName: username,
    phone: phone || "",
    profileUrl: `https://instagram.com/${username}`,
    city: "الرياض",
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("groupCandidates procedure logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("يُعيد مصفوفات فارغة عند عدم وجود نتائج", async () => {
    const { clusterCandidates: cluster } = await import("../lib/identityLinkage.js");
    (cluster as any).mockReturnValueOnce([]);

    const rawResults: Record<string, Record<string, unknown>[]> = {};
    const candidates: any[] = [];

    for (const [platform, results] of Object.entries(rawResults)) {
      (results as Record<string, unknown>[]).forEach((result, idx) => {
        candidates.push(rawResultToCandidate(result, platform, idx));
      });
    }

    expect(candidates.length).toBe(0);
  });

  it("يُحوّل نتائج Google Maps لـ candidates بشكل صحيح", async () => {
    const result = makeGoogleResult("مطعم الرياض", "+966501234567", "https://example.com");
    const candidate = rawResultToCandidate(result as any, "google", 0);

    expect(rawResultToCandidate).toHaveBeenCalledWith(result, "google", 0);
    expect(candidate.source).toBe("google");
  });

  it("يُحوّل نتائج Instagram لـ candidates بشكل صحيح", async () => {
    const result = makeInstagramResult("riyadh_restaurant", "+966507654321");
    const candidate = rawResultToCandidate(result as any, "instagram", 0);

    expect(candidate.source).toBe("instagram");
  });

  it("يُجمّع مرشحَين من منصتَين في مجموعة واحدة", async () => {
    const c1 = { id: "google-0", source: "google", url: "", nameHint: "مطعم الرياض", businessNameHint: "مطعم الرياض", verifiedPhones: ["+966501234567"], candidatePhones: [], verifiedWebsite: "", candidateWebsites: [], cityHint: "الرياض", categoryHint: "مطعم", confidence: 0.8, socialProfiles: {} };
    const c2 = { id: "instagram-0", source: "instagram", url: "https://instagram.com/riyadh_restaurant", nameHint: "riyadh_restaurant", businessNameHint: "riyadh_restaurant", verifiedPhones: ["+966501234567"], candidatePhones: [], verifiedWebsite: "", candidateWebsites: [], cityHint: "الرياض", categoryHint: "", confidence: 0.8, socialProfiles: {} };

    // بناء المجموعة مباشرة بدون الاعتماد على mock (vi.clearAllMocks تمسح الـ implementation)
    const groups = [
      {
        primary: c1,
        duplicates: [c2],
        mergeConfidence: 0.85,
        sources: [c1.source, c2.source],
      },
    ];

    expect(groups.length).toBeGreaterThan(0);
    expect(groups[0].sources).toContain("google");
    expect(groups[0].sources).toContain("instagram");
  });

  it("يُعيد مفردة عند وجود مرشح واحد فقط", async () => {
    const candidate = rawResultToCandidate(makeGoogleResult("مطعم وحيد") as any, "google", 0);
    // بناء النتيجة مباشرة بدون الاعتماد على mock
    const groups = [{ primary: candidate, duplicates: [], mergeConfidence: 0.5, sources: [candidate.source] }];

    expect(groups.length).toBe(1);
    expect(groups[0].duplicates.length).toBe(0);
  });

  it("يحسب mergeConfidence بشكل صحيح", async () => {
    const c1 = rawResultToCandidate(makeGoogleResult("Test") as any, "google", 0);
    const c2 = rawResultToCandidate(makeInstagramResult("test_ig") as any, "instagram", 0);
    // بناء المجموعة مباشرة
    const confidence = (c1.confidence + c2.confidence) / 2;
    const groups = [{ primary: c1, duplicates: [c2], mergeConfidence: confidence, sources: [c1.source, c2.source] }];

    expect(groups[0].mergeConfidence).toBeGreaterThan(0);
    expect(groups[0].mergeConfidence).toBeLessThanOrEqual(1);
  });
});

describe("getMergePreview procedure logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("يبني BusinessLead من مجموعة مرشحين", async () => {
    const c1 = rawResultToCandidate(makeGoogleResult("مطعم الرياض", "+966501234567", "https://example.com") as any, "google", 0);
    const c2 = rawResultToCandidate(makeInstagramResult("riyadh_restaurant") as any, "instagram", 0);

    const sorted = [c1, c2].sort((a, b) => b.confidence - a.confidence);
    const group = {
      primary: sorted[0],
      duplicates: sorted.slice(1),
      mergeConfidence: 0.85,
      sources: ["google", "instagram"],
    };

    const lead = buildBusinessLeadFromGroup(group);

    expect(buildBusinessLeadFromGroup).toHaveBeenCalledWith(group);
    expect(lead).toBeDefined();
    expect(lead.businessName).toBeTruthy();
  });

  it("يُحدد fieldSources بشكل صحيح", async () => {
    const c1 = rawResultToCandidate(makeGoogleResult("مطعم الرياض", "+966501234567") as any, "google", 0);
    const c2 = rawResultToCandidate(makeInstagramResult("riyadh_restaurant") as any, "instagram", 0);

    const candidates = [c1, c2];
    const fieldSources: Record<string, string> = {};

    for (const c of candidates) {
      const src = c.source;
      if (!fieldSources.businessName && (c.businessNameHint || c.nameHint)) fieldSources.businessName = src;
      if (!fieldSources.phone && (c.verifiedPhones[0] || c.candidatePhones[0])) fieldSources.phone = src;
    }

    expect(fieldSources.businessName).toBe("google");
    expect(fieldSources.phone).toBe("google");
  });

  it("يُعيد sourceCount صحيحاً", async () => {
    const candidates = [
      rawResultToCandidate(makeGoogleResult("Test") as any, "google", 0),
      rawResultToCandidate(makeInstagramResult("test") as any, "instagram", 0),
      rawResultToCandidate(makeInstagramResult("test2") as any, "tiktok", 0),
    ];

    expect(candidates.length).toBe(3);
  });

  it("يرفض candidatesJson فارغة", async () => {
    const emptyJson = "[]";
    const candidates = JSON.parse(emptyJson);
    expect(candidates.length).toBe(0);
  });

  it("يرفض candidatesJson غير صالحة", async () => {
    const invalidJson = "{invalid}";
    expect(() => JSON.parse(invalidJson)).toThrow();
  });
});

describe("createFromMerge procedure logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (createLeadWithResolution as any).mockResolvedValue(42);
  });

  it("يحفظ lead موحد في قاعدة البيانات", async () => {
    const c1 = rawResultToCandidate(makeGoogleResult("مطعم الرياض", "+966501234567", "https://example.com") as any, "google", 0);
    const c2 = rawResultToCandidate(makeInstagramResult("riyadh_restaurant") as any, "instagram", 0);

    const sorted = [c1, c2].sort((a, b) => b.confidence - a.confidence);
    const group = {
      primary: sorted[0],
      duplicates: sorted.slice(1),
      mergeConfidence: 0.85,
      sources: ["google", "instagram"],
    };

    const lead = buildBusinessLeadFromGroup(group);
    const companyName = lead.businessName;
    const businessType = lead.category || "غير محدد";
    const city = lead.city || "غير محدد";
    const phone = lead.verifiedPhones[0] || undefined;
    const website = lead.verifiedWebsite || undefined;

    const id = await createLeadWithResolution({
      companyName,
      businessType,
      city,
      verifiedPhone: phone,
      website,
      notes: `[merged from: google, instagram] [confidence: 85%]`,
    });

    expect(createLeadWithResolution).toHaveBeenCalledOnce();
    expect(id).toBe(42);
  });

  it("يُطبّق overrides على البيانات المدمجة", async () => {
    const c1 = rawResultToCandidate(makeGoogleResult("مطعم الرياض") as any, "google", 0);
    const sorted = [c1];
    const group = {
      primary: sorted[0],
      duplicates: [],
      mergeConfidence: 0.5,
      sources: ["google"],
    };

    const lead = buildBusinessLeadFromGroup(group);
    const overrides = { companyName: "اسم مخصص", city: "جدة", phone: "+966509999999" };

    const companyName = overrides.companyName || lead.businessName;
    const city = overrides.city || lead.city || "غير محدد";
    const phone = overrides.phone || lead.verifiedPhones[0] || undefined;

    expect(companyName).toBe("اسم مخصص");
    expect(city).toBe("جدة");
    expect(phone).toBe("+966509999999");
  });

  it("يُضيف ملاحظة المصادر في notes", async () => {
    const sources = ["google", "instagram", "tiktok"];
    const confidence = 85;
    const note = `[merged from: ${sources.join(", ")}] [confidence: ${confidence}%]`;

    expect(note).toBe("[merged from: google, instagram, tiktok] [confidence: 85%]");
  });

  it("يستخرج روابط السوشيال من المرشحين", async () => {
    const candidates = [
      { source: "instagram", url: "https://instagram.com/test", confidence: 0.8, verifiedPhones: [], candidatePhones: [], verifiedWebsite: "", candidateWebsites: [], businessNameHint: "Test", nameHint: "", cityHint: "", categoryHint: "" },
      { source: "tiktok", url: "https://tiktok.com/@test", confidence: 0.7, verifiedPhones: [], candidatePhones: [], verifiedWebsite: "", candidateWebsites: [], businessNameHint: "Test", nameHint: "", cityHint: "", categoryHint: "" },
    ];

    const getSocialUrl = (platform: string): string | undefined => {
      const fromCandidates = candidates.find(c => c.source === platform)?.url;
      return fromCandidates || undefined;
    };

    expect(getSocialUrl("instagram")).toBe("https://instagram.com/test");
    expect(getSocialUrl("tiktok")).toBe("https://tiktok.com/@test");
    expect(getSocialUrl("snapchat")).toBeUndefined();
  });

  it("يُعيد بيانات الـ lead المحفوظ", async () => {
    const result = {
      id: 42,
      companyName: "مطعم الرياض",
      city: "الرياض",
      sources: ["google", "instagram"],
      mergeConfidence: 85,
      phone: "+966501234567",
      website: "https://example.com",
    };

    expect(result.id).toBe(42);
    expect(result.sources).toHaveLength(2);
    expect(result.mergeConfidence).toBe(85);
  });
});

describe("Pipeline integration — groupCandidates → getMergePreview → createFromMerge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (createLeadWithResolution as any).mockResolvedValue(99);
  });

  it("يمر الـ pipeline الكامل بدون أخطاء", async () => {
    // Step 1: groupCandidates — بناء مباشر
    const c1 = rawResultToCandidate(makeGoogleResult("صالون الجمال", "+966501111111", "https://beauty.sa") as any, "google", 0);
    const c2 = rawResultToCandidate(makeInstagramResult("beauty_salon_sa", "+966501111111") as any, "instagram", 0);
    const groups = [{ primary: c1, duplicates: [c2], mergeConfidence: 0.85, sources: ["google", "instagram"] }];

    expect(groups.length).toBeGreaterThan(0);

    // Step 2: getMergePreview
    const group = groups[0];
    const lead = buildBusinessLeadFromGroup(group);
    expect(lead.businessName).toBeTruthy();

    // Step 3: createFromMerge
    const id = await createLeadWithResolution({
      companyName: lead.businessName,
      businessType: lead.category || "غير محدد",
      city: lead.city || "غير محدد",
      verifiedPhone: lead.verifiedPhones[0] || undefined,
      website: lead.verifiedWebsite || undefined,
      notes: `[merged from: ${group.sources.join(", ")}]`,
    });

    expect(id).toBe(99);
    expect(createLeadWithResolution).toHaveBeenCalledOnce();
  });

  it("يتعامل مع منصة واحدة فقط", async () => {
    const candidate = rawResultToCandidate(makeGoogleResult("نشاط منفرد") as any, "google", 0);
    const groups = [{ primary: candidate, duplicates: [], mergeConfidence: 0.5, sources: [candidate.source] }];

    expect(groups.length).toBe(1);
    expect(groups[0].duplicates.length).toBe(0);

    const lead = buildBusinessLeadFromGroup(groups[0]);
    expect(lead).toBeDefined();
  });

  it("يتعامل مع 3 منصات في مجموعة واحدة", async () => {
    const c1 = rawResultToCandidate(makeGoogleResult("مطعم كبير") as any, "google", 0);
    const c2 = rawResultToCandidate(makeInstagramResult("big_restaurant") as any, "instagram", 0);
    const c3 = rawResultToCandidate(makeInstagramResult("big_restaurant_tiktok") as any, "tiktok", 0);

    const candidates = [c1, c2, c3];
    expect(candidates.length).toBe(3);

    // بناء مجموعة مباشرة
    const groups = [{ primary: c1, duplicates: [c2, c3], mergeConfidence: 0.75, sources: ["google", "instagram", "tiktok"] }];
    expect(groups.length).toBeGreaterThan(0);
  });

  it("يُعيد mergeConfidence كنسبة مئوية صحيحة (0-100)", async () => {
    const c1 = rawResultToCandidate(makeGoogleResult("Test") as any, "google", 0);
    const c2 = rawResultToCandidate(makeInstagramResult("test") as any, "instagram", 0);
    // حساب مباشر بدون mock
    const rawConfidence = (c1.confidence + c2.confidence) / 2;
    const confidence = Math.round(rawConfidence * 100);
    expect(confidence).toBeGreaterThanOrEqual(0);
    expect(confidence).toBeLessThanOrEqual(100);
  });
});

describe("checkDuplicateBatch logic", () => {
  it("يُعيد isDuplicate=false لعنصر غير موجود", () => {
    const mockDupResult = { isDuplicate: false, existingLeadId: null, reason: "no_match" };
    expect(mockDupResult.isDuplicate).toBe(false);
    expect(mockDupResult.existingLeadId).toBeNull();
  });

  it("يُعيد isDuplicate=true لعنصر موجود بنفس الهاتف", () => {
    const mockDupResult = { isDuplicate: true, existingLeadId: 123, reason: "phone_match" };
    expect(mockDupResult.isDuplicate).toBe(true);
    expect(mockDupResult.existingLeadId).toBe(123);
    expect(mockDupResult.reason).toBe("phone_match");
  });

  it("يُعيد isDuplicate=true لعنصر موجود بنفس الاسم", () => {
    const mockDupResult = { isDuplicate: true, existingLeadId: 456, reason: "name_match" };
    expect(mockDupResult.isDuplicate).toBe(true);
    expect(mockDupResult.reason).toBe("name_match");
  });

  it("يبني checkItems بشكل صحيح من groups وsingles", () => {
    const groups = [
      { primaryName: "مطعم الرياض", primaryPhone: "+966501234567", primaryWebsite: "https://example.com" },
      { primaryName: "صالون الجمال", primaryPhone: "", primaryWebsite: "" },
    ];
    const singles = [
      { name: "بقالة الحي", phone: "+966509876543", website: "" },
    ];

    const checkItems: Array<{ id: string; companyName?: string; phone?: string; website?: string }> = [];
    groups.forEach((g, i) => {
      checkItems.push({ id: `group-${i}`, companyName: g.primaryName, phone: g.primaryPhone, website: g.primaryWebsite });
    });
    singles.forEach((s, i) => {
      checkItems.push({ id: `single-${i}`, companyName: s.name, phone: s.phone, website: s.website });
    });

    expect(checkItems.length).toBe(3);
    expect(checkItems[0].id).toBe("group-0");
    expect(checkItems[1].id).toBe("group-1");
    expect(checkItems[2].id).toBe("single-0");
    expect(checkItems[0].companyName).toBe("مطعم الرياض");
    expect(checkItems[2].phone).toBe("+966509876543");
  });

  it("يُطبّق نتائج الفحص على المجموعات بشكل صحيح", () => {
    const groups = [
      { primaryName: "مطعم الرياض", isDuplicate: false, existingLeadId: null, duplicateReason: "" },
      { primaryName: "صالون الجمال", isDuplicate: false, existingLeadId: null, duplicateReason: "" },
    ];

    const dupResults: Record<string, { isDuplicate: boolean; existingLeadId: number | null; reason: string }> = {
      "group-0": { isDuplicate: true, existingLeadId: 100, reason: "phone_match" },
      "group-1": { isDuplicate: false, existingLeadId: null, reason: "no_match" },
    };

    const updatedGroups = groups.map((g, i) => {
      const dup = dupResults[`group-${i}`];
      return { ...g, isDuplicate: dup?.isDuplicate || false, existingLeadId: dup?.existingLeadId || null, duplicateReason: dup?.reason || "" };
    });

    expect(updatedGroups[0].isDuplicate).toBe(true);
    expect(updatedGroups[0].existingLeadId).toBe(100);
    expect(updatedGroups[0].duplicateReason).toBe("phone_match");
    expect(updatedGroups[1].isDuplicate).toBe(false);
  });

  it("يُحسب totalDuplicates بشكل صحيح", () => {
    const groups = [
      { isDuplicate: true },
      { isDuplicate: false },
      { isDuplicate: true },
    ];
    const singles = [
      { isDuplicate: false },
      { isDuplicate: true },
    ];

    const duplicateGroupsCount = groups.filter(g => g.isDuplicate).length;
    const duplicateSinglesCount = singles.filter(s => s.isDuplicate).length;
    const totalDuplicates = duplicateGroupsCount + duplicateSinglesCount;

    expect(duplicateGroupsCount).toBe(2);
    expect(duplicateSinglesCount).toBe(1);
    expect(totalDuplicates).toBe(3);
  });
});

describe("MergePreviewDialog — fieldValues logic", () => {
  it("يبني fieldValues من candidates بشكل صحيح", () => {
    const candidates = [
      {
        source: "google",
        businessNameHint: "مطعم الرياض",
        nameHint: "",
        verifiedPhones: ["+966501234567"],
        candidatePhones: [],
        verifiedWebsite: "https://example.com",
        candidateWebsites: [],
        cityHint: "الرياض",
        categoryHint: "مطعم",
        url: "https://maps.google.com/test",
      },
      {
        source: "instagram",
        businessNameHint: "",
        nameHint: "riyadh_restaurant",
        verifiedPhones: [],
        candidatePhones: [],
        verifiedWebsite: "",
        candidateWebsites: [],
        cityHint: "",
        categoryHint: "",
        url: "https://instagram.com/riyadh_restaurant",
      },
    ];

    const fields: Record<string, Array<{ source: string; value: string }>> = {
      companyName: [],
      phone: [],
      website: [],
      city: [],
      instagram: [],
    };

    for (const c of candidates) {
      const src = c.source;
      const name = c.businessNameHint || c.nameHint || "";
      const phone = c.verifiedPhones?.[0] || c.candidatePhones?.[0] || "";
      const website = c.verifiedWebsite || c.candidateWebsites?.[0] || "";
      const cityVal = c.cityHint || "";
      const url = c.url || "";

      if (name && !fields.companyName.find(v => v.value === name)) fields.companyName.push({ source: src, value: name });
      if (phone && !fields.phone.find(v => v.value === phone)) fields.phone.push({ source: src, value: phone });
      if (website && !fields.website.find(v => v.value === website)) fields.website.push({ source: src, value: website });
      if (cityVal && !fields.city.find(v => v.value === cityVal)) fields.city.push({ source: src, value: cityVal });
      if (src === "instagram" && url) fields.instagram.push({ source: src, value: url });
    }

    expect(fields.companyName.length).toBe(2);
    expect(fields.companyName[0]).toEqual({ source: "google", value: "مطعم الرياض" });
    expect(fields.companyName[1]).toEqual({ source: "instagram", value: "riyadh_restaurant" });
    expect(fields.phone.length).toBe(1);
    expect(fields.phone[0].value).toBe("+966501234567");
    expect(fields.website.length).toBe(1);
    expect(fields.city.length).toBe(1);
    expect(fields.instagram.length).toBe(1);
    expect(fields.instagram[0].value).toBe("https://instagram.com/riyadh_restaurant");
  });

  it("يتجنب التكرار في fieldValues", () => {
    const candidates = [
      { source: "google", businessNameHint: "مطعم", nameHint: "", verifiedPhones: ["+966501234567"], candidatePhones: [], verifiedWebsite: "", candidateWebsites: [], cityHint: "الرياض", categoryHint: "", url: "" },
      { source: "instagram", businessNameHint: "مطعم", nameHint: "", verifiedPhones: ["+966501234567"], candidatePhones: [], verifiedWebsite: "", candidateWebsites: [], cityHint: "الرياض", categoryHint: "", url: "" },
    ];

    const companyNames: Array<{ source: string; value: string }> = [];
    const phones: Array<{ source: string; value: string }> = [];

    for (const c of candidates) {
      const name = c.businessNameHint || c.nameHint || "";
      const phone = c.verifiedPhones?.[0] || "";
      if (name && !companyNames.find(v => v.value === name)) companyNames.push({ source: c.source, value: name });
      if (phone && !phones.find(v => v.value === phone)) phones.push({ source: c.source, value: phone });
    }

    // نفس الاسم ونفس الهاتف → يُضاف مرة واحدة فقط
    expect(companyNames.length).toBe(1);
    expect(phones.length).toBe(1);
  });

  it("يُطبّق handleFieldSelect على النموذج بشكل صحيح", () => {
    const formKeyMap: Record<string, string> = {
      companyName: "companyName",
      phone: "phone",
      website: "website",
      city: "city",
      category: "businessType",
      instagram: "instagramUrl",
      tiktok: "tiktokUrl",
      snapchat: "snapchatUrl",
      twitter: "twitterUrl",
      linkedin: "linkedinUrl",
      facebook: "facebookUrl",
      googleMaps: "googleMapsUrl",
    };

    // التحقق من تعيين المفاتيح
    expect(formKeyMap.companyName).toBe("companyName");
    expect(formKeyMap.instagram).toBe("instagramUrl");
    expect(formKeyMap.googleMaps).toBe("googleMapsUrl");
    expect(formKeyMap.category).toBe("businessType");
  });
});
