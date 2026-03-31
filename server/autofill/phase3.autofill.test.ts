/**
 * PHASE 3 — Autofill Pipeline Tests
 *
 * Covers:
 *   - fillCoreFields: fill-only-if-empty, normalization
 *   - fillContactFields: verifiedPhone allowlist, candidatePhones in-memory only
 *   - fillDigitalAssets: source→field mapping, fill-only-if-empty, x→twitterUrl
 *   - detectMissingFields: three-tier classification
 *   - computeAnalysisReadiness: four states, confidence score formula
 */

import { describe, it, expect } from "vitest";
import { fillCoreFields } from "./fillCoreFields";
import { fillContactFields } from "./fillContactFields";
import { fillDigitalAssets } from "./fillDigitalAssets";
import { detectMissingFields } from "./detectMissingFields";
import { computeAnalysisReadiness } from "./computeAnalysisReadiness";
import type { DiscoveryCandidate } from "../../shared/types/lead-intelligence";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCandidate(overrides: Partial<DiscoveryCandidate> = {}): DiscoveryCandidate {
  return {
    id: "test-id",
    source: "maps",
    sourceType: "listing",
    verifiedPhones: [],
    candidatePhones: [],
    verifiedEmails: [],
    candidateEmails: [],
    candidateWebsites: [],
    confidence: 0.9,
    raw: {},
    ...overrides,
  };
}

// ─── fillCoreFields ───────────────────────────────────────────────────────────

describe("fillCoreFields", () => {
  it("fills companyName from businessNameHint when empty", () => {
    const result = fillCoreFields({}, makeCandidate({ businessNameHint: "مطعم الأصيل" }));
    expect(result.patch.companyName).toBe("مطعم الأصيل");
    expect(result.fieldsUpdated).toContain("companyName");
  });

  it("falls back to nameHint when businessNameHint is absent", () => {
    const result = fillCoreFields({}, makeCandidate({ nameHint: "صالون نور" }));
    expect(result.patch.companyName).toBe("صالون نور");
  });

  it("does NOT overwrite existing companyName", () => {
    const result = fillCoreFields(
      { companyName: "الاسم الأصلي" },
      makeCandidate({ businessNameHint: "اسم جديد" })
    );
    expect(result.patch.companyName).toBeUndefined();
    expect(result.fieldsUpdated).not.toContain("companyName");
  });

  it("fills businessType from categoryHint when empty", () => {
    const result = fillCoreFields({}, makeCandidate({ categoryHint: "مطعم" }));
    expect(result.patch.businessType).toBe("مطعم");
  });

  it("does NOT overwrite existing businessType", () => {
    const result = fillCoreFields(
      { businessType: "صالون" },
      makeCandidate({ categoryHint: "مطعم" })
    );
    expect(result.patch.businessType).toBeUndefined();
  });

  it("fills city and district from hints", () => {
    const result = fillCoreFields(
      {},
      makeCandidate({ cityHint: "الرياض", regionHint: "النخيل" })
    );
    expect(result.patch.city).toBe("الرياض");
    expect(result.patch.district).toBe("النخيل");
  });

  it("computes normalizedBusinessName from filled companyName", () => {
    const result = fillCoreFields({}, makeCandidate({ businessNameHint: "مطعم الأصيل" }));
    expect(result.patch.normalizedBusinessName).toBeDefined();
    expect(typeof result.patch.normalizedBusinessName).toBe("string");
  });

  it("returns empty patch when no candidate provided", () => {
    const result = fillCoreFields({ companyName: "test" }, undefined);
    expect(result.fieldsUpdated).toHaveLength(0);
    expect(Object.keys(result.patch)).toHaveLength(0);
  });
});

// ─── fillContactFields ────────────────────────────────────────────────────────

describe("fillContactFields", () => {
  it("fills verifiedPhone from maps source", () => {
    const result = fillContactFields(
      {},
      makeCandidate({ source: "maps", verifiedPhones: ["0501234567"] })
    );
    expect(result.patch.verifiedPhone).toBe("0501234567");
    expect(result.fieldsUpdated).toContain("verifiedPhone");
  });

  it("fills verifiedPhone from google source", () => {
    const result = fillContactFields(
      {},
      makeCandidate({ source: "google", verifiedPhones: ["0509876543"] })
    );
    expect(result.patch.verifiedPhone).toBe("0509876543");
  });

  it("fills verifiedPhone from website source", () => {
    const result = fillContactFields(
      {},
      makeCandidate({ source: "website", verifiedPhones: ["0551234567"] })
    );
    expect(result.patch.verifiedPhone).toBe("0551234567");
  });

  it("does NOT fill verifiedPhone from instagram source", () => {
    const result = fillContactFields(
      {},
      makeCandidate({ source: "instagram", verifiedPhones: ["0501234567"] })
    );
    expect(result.patch.verifiedPhone).toBeUndefined();
    expect(result.fieldsUpdated).not.toContain("verifiedPhone");
  });

  it("does NOT fill verifiedPhone from x (twitter) source", () => {
    const result = fillContactFields(
      {},
      makeCandidate({ source: "x", verifiedPhones: ["0501234567"] })
    );
    expect(result.patch.verifiedPhone).toBeUndefined();
  });

  it("does NOT fill verifiedPhone from tiktok source", () => {
    const result = fillContactFields(
      {},
      makeCandidate({ source: "tiktok", verifiedPhones: ["0501234567"] })
    );
    expect(result.patch.verifiedPhone).toBeUndefined();
  });

  it("does NOT promote candidatePhones to verifiedPhone", () => {
    const result = fillContactFields(
      {},
      makeCandidate({ source: "maps", verifiedPhones: [], candidatePhones: ["0501234567"] })
    );
    expect(result.patch.verifiedPhone).toBeUndefined();
    // candidatePhones returned in-memory only
    expect(result.candidatePhones).toContain("0501234567");
  });

  it("does NOT overwrite existing verifiedPhone", () => {
    const result = fillContactFields(
      { verifiedPhone: "0501111111" },
      makeCandidate({ source: "maps", verifiedPhones: ["0502222222"] })
    );
    expect(result.patch.verifiedPhone).toBeUndefined();
  });

  it("fills website from verifiedWebsite", () => {
    const result = fillContactFields(
      {},
      makeCandidate({ verifiedWebsite: "https://example.com" })
    );
    expect(result.patch.website).toBe("https://example.com");
    expect(result.patch.normalizedDomain).toBe("example.com");
  });

  it("does NOT overwrite existing website", () => {
    const result = fillContactFields(
      { website: "https://existing.com" },
      makeCandidate({ verifiedWebsite: "https://new.com" })
    );
    expect(result.patch.website).toBeUndefined();
  });

  it("returns candidatePhones in-memory without persisting", () => {
    const result = fillContactFields(
      {},
      makeCandidate({ candidatePhones: ["0501111111", "0502222222"] })
    );
    expect(result.candidatePhones).toEqual(["0501111111", "0502222222"]);
  });
});

// ─── fillDigitalAssets ────────────────────────────────────────────────────────

describe("fillDigitalAssets", () => {
  it("maps source 'x' to twitterUrl field (naming consistency)", () => {
    const result = fillDigitalAssets(
      {},
      makeCandidate({ source: "x", url: "https://x.com/testaccount" })
    );
    expect(result.patch.twitterUrl).toBe("https://x.com/testaccount");
    expect(result.fieldsUpdated).toContain("twitterUrl");
  });

  it("maps source 'instagram' to instagramUrl", () => {
    const result = fillDigitalAssets(
      {},
      makeCandidate({ source: "instagram", url: "https://instagram.com/testaccount" })
    );
    expect(result.patch.instagramUrl).toBe("https://instagram.com/testaccount");
  });

  it("maps source 'maps' to googleMapsUrl", () => {
    const result = fillDigitalAssets(
      {},
      makeCandidate({ source: "maps", url: "https://maps.google.com/place/test" })
    );
    expect(result.patch.googleMapsUrl).toBe("https://maps.google.com/place/test");
  });

  it("maps source 'tiktok' to tiktokUrl", () => {
    const result = fillDigitalAssets(
      {},
      makeCandidate({ source: "tiktok", url: "https://tiktok.com/@testaccount" })
    );
    expect(result.patch.tiktokUrl).toBe("https://tiktok.com/@testaccount");
  });

  it("does NOT overwrite existing twitterUrl", () => {
    const result = fillDigitalAssets(
      { twitterUrl: "https://x.com/existing" },
      makeCandidate({ source: "x", url: "https://x.com/new" })
    );
    expect(result.patch.twitterUrl).toBeUndefined();
    expect(result.fieldsUpdated).toHaveLength(0);
  });

  it("returns empty patch when candidate has no url", () => {
    const result = fillDigitalAssets({}, makeCandidate({ source: "instagram", url: undefined }));
    expect(result.fieldsUpdated).toHaveLength(0);
  });

  it("returns empty patch for unrecognized source", () => {
    const result = fillDigitalAssets(
      {},
      makeCandidate({ source: "google", url: "https://google.com" })
    );
    // google is not in SOURCE_TO_FIELD mapping
    expect(result.fieldsUpdated).toHaveLength(0);
  });
});

// ─── detectMissingFields ──────────────────────────────────────────────────────

describe("detectMissingFields", () => {
  it("detects all critical fields as missing when lead is empty", () => {
    const result = detectMissingFields({});
    expect(result.criticalMissing).toContain("verifiedPhone");
    expect(result.criticalMissing).toContain("companyName");
    expect(result.criticalMissing).toContain("city");
  });

  it("detects important fields as missing", () => {
    const result = detectMissingFields({ companyName: "test", verifiedPhone: "050", city: "الرياض" });
    expect(result.importantMissing).toContain("website");
    expect(result.importantMissing).toContain("instagramUrl");
    expect(result.importantMissing).toContain("businessType");
  });

  it("does not flag present fields as missing", () => {
    const result = detectMissingFields({
      companyName: "test",
      verifiedPhone: "0501234567",
      city: "الرياض",
      website: "https://example.com",
      instagramUrl: "https://instagram.com/test",
      businessType: "مطعم",
    });
    expect(result.criticalMissing).toHaveLength(0);
    expect(result.importantMissing).toHaveLength(0);
  });

  it("missingDataFlags contains critical + important only (not optional)", () => {
    const result = detectMissingFields({});
    const allFlags = result.missingDataFlags;
    // optional fields should NOT be in missingDataFlags
    expect(allFlags).not.toContain("district");
    expect(allFlags).not.toContain("tiktokUrl");
    expect(allFlags).not.toContain("facebookUrl");
  });
});

// ─── computeAnalysisReadiness ─────────────────────────────────────────────────

describe("computeAnalysisReadiness", () => {
  it("returns ready_for_analysis when no critical and <2 important missing", () => {
    const missing = { criticalMissing: [], importantMissing: ["website"], optionalMissing: [], missingDataFlags: ["website"] as any };
    const result = computeAnalysisReadiness(missing);
    expect(result.state).toBe("ready_for_analysis");
    expect(result.analysisReadyFlag).toBe(true);
    expect(result.partialAnalysisFlag).toBe(false);
  });

  it("returns partially_analyzable when no critical but >=2 important missing", () => {
    const missing = { criticalMissing: [], importantMissing: ["website", "instagramUrl"], optionalMissing: [], missingDataFlags: ["website", "instagramUrl"] as any };
    const result = computeAnalysisReadiness(missing);
    expect(result.state).toBe("partially_analyzable");
    expect(result.analysisReadyFlag).toBe(false);
    expect(result.partialAnalysisFlag).toBe(true);
  });

  it("returns missing_critical_data when 1 critical missing", () => {
    const missing = { criticalMissing: ["verifiedPhone"], importantMissing: [], optionalMissing: [], missingDataFlags: ["verifiedPhone"] as any };
    const result = computeAnalysisReadiness(missing);
    expect(result.state).toBe("missing_critical_data");
  });

  it("returns not_analyzable when >=3 critical missing", () => {
    const missing = { criticalMissing: ["verifiedPhone", "companyName", "city"], importantMissing: [], optionalMissing: [], missingDataFlags: ["verifiedPhone", "companyName", "city"] as any };
    const result = computeAnalysisReadiness(missing);
    expect(result.state).toBe("not_analyzable");
  });

  it("confidenceScore is between 0 and 1", () => {
    const missing = { criticalMissing: ["verifiedPhone", "companyName", "city"], importantMissing: ["website", "instagramUrl", "businessType"], optionalMissing: [], missingDataFlags: [] as any };
    const result = computeAnalysisReadiness(missing);
    expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
    expect(result.confidenceScore).toBeLessThanOrEqual(1);
  });

  it("confidenceScore is 1 when nothing is missing", () => {
    const missing = { criticalMissing: [], importantMissing: [], optionalMissing: [], missingDataFlags: [] as any };
    const result = computeAnalysisReadiness(missing);
    expect(result.confidenceScore).toBe(1);
  });

  it("confidenceScore is a simple derivative — not a scoring model", () => {
    // Adding more critical missing should decrease score
    const few = { criticalMissing: ["verifiedPhone"], importantMissing: [], optionalMissing: [], missingDataFlags: [] as any };
    const many = { criticalMissing: ["verifiedPhone", "companyName", "city"], importantMissing: ["website"], optionalMissing: [], missingDataFlags: [] as any };
    expect(computeAnalysisReadiness(few).confidenceScore).toBeGreaterThan(computeAnalysisReadiness(many).confidenceScore);
  });
});
