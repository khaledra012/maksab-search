/**
 * PHASE 4 — Enrichment Tests
 * يغطي: enrichmentGate + businessLeadAdapter + auditEngine (deterministic logic)
 * لا يختبر: websiteEnrichment / socialEnrichment (تعتمد على external APIs)
 */
import { describe, it, expect } from "vitest";
import { checkEnrichmentEligibility } from "./enrichmentGate";
import { adaptBusinessLeadToInsert } from "./businessLeadAdapter";
import {
  computeSeoAudit,
  computeSocialAudit,
  computeConversionAudit,
  computeMarketAudit,
} from "./auditEngine";
import type { Lead } from "../../drizzle/schema";
import type { BusinessLead } from "../../shared/types/lead-intelligence";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: 1,
    companyName: "مطعم الأصالة",
    businessType: "مطاعم",
    city: "الرياض",
    district: null,
    country: "SA",
    zoneId: null,
    zoneName: null,
    verifiedPhone: "+966501234567",
    website: "https://asala-restaurant.com",
    instagramUrl: "https://instagram.com/asala",
    twitterUrl: null,
    tiktokUrl: null,
    snapchatUrl: null,
    facebookUrl: null,
    linkedinUrl: null,
    googleMapsUrl: null,
    hasWhatsapp: "unknown",
    analysisStatus: "pending",
    analysisReadyFlag: false,
    partialAnalysisFlag: false,
    analysisConfidenceScore: 0,
    missingDataFlags: [],
    deduplicationStatus: "no_duplicate",
    duplicateCandidateIds: [],
    normalizedBusinessName: "مطعم الاصاله",
    normalizedPhone: "966501234567",
    normalizedDomain: "asala-restaurant.com",
    stage: "new",
    priority: "medium",
    ownerUserId: null,
    notes: null,
    tags: [],
    customFields: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Lead;
}

// ─── enrichmentGate Tests ─────────────────────────────────────────────────────

describe("enrichmentGate", () => {
  it("should pass eligible lead with website and pending status", () => {
    const lead = makeLead();
    const result = checkEnrichmentEligibility(lead);
    expect(result.eligible).toBe(true);
  });

  it("should block lead without website", () => {
    const lead = makeLead({ website: null });
    const result = checkEnrichmentEligibility(lead);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain("no_website");
  });

  it("should block lead with empty website", () => {
    const lead = makeLead({ website: "" });
    const result = checkEnrichmentEligibility(lead);
    expect(result.eligible).toBe(false);
  });

  it("should block lead with analysisReadyFlag=true", () => {
    const lead = makeLead({ analysisReadyFlag: true });
    const result = checkEnrichmentEligibility(lead);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain("already_analysis_ready");
  });

  it("should block lead with possible_duplicate status", () => {
    const lead = makeLead({ deduplicationStatus: "possible_duplicate" });
    const result = checkEnrichmentEligibility(lead);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain("possible_duplicate");
  });

  it("should block lead with analysisStatus=analyzing", () => {
    const lead = makeLead({ analysisStatus: "analyzing" });
    const result = checkEnrichmentEligibility(lead);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain("analysis_in_progress");
  });

  it("should block lead with analysisStatus=completed", () => {
    const lead = makeLead({ analysisStatus: "completed" });
    const result = checkEnrichmentEligibility(lead);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain("analysis_already_completed");
  });

  it("should allow lead with analysisStatus=failed (retry eligible)", () => {
    const lead = makeLead({ analysisStatus: "failed" });
    const result = checkEnrichmentEligibility(lead);
    expect(result.eligible).toBe(true);
  });

  it("should return structured result with reason field always", () => {
    const lead = makeLead({ website: null });
    const result = checkEnrichmentEligibility(lead);
    expect(result).toHaveProperty("eligible");
    expect(result).toHaveProperty("reason");
    expect(typeof result.reason).toBe("string");
  });
});

// ─── businessLeadAdapter Tests ────────────────────────────────────────────────

describe("businessLeadAdapter", () => {
  function makeBusinessLead(overrides: Partial<BusinessLead> = {}): BusinessLead {
    return {
      id: "bl-1",
      businessName: "مطعم الأصالة",
      normalizedBusinessName: "مطعم الاصاله",
      category: "مطاعم",
      city: "الرياض",
      region: "نجد",
      country: "SA",
      verifiedPhones: ["+966501234567"],
      candidatePhones: ["0501234568"],
      verifiedEmails: [],
      candidateEmails: [],
      verifiedWebsite: "https://asala-restaurant.com",
      candidateWebsites: [],
      googleMapsUrl: "https://maps.google.com/?q=asala",
      socialProfiles: {
        instagram: "https://instagram.com/asala",
        x: "https://x.com/asala",
        tiktok: "https://tiktok.com/@asala",
        snapchat: undefined,
        facebook: undefined,
        linkedin: undefined,
      },
      assets: [],
      sources: ["maps"],
      confidence: 0.9,
      ...overrides,
    } as BusinessLead;
  }

  it("should map businessName to companyName", () => {
    const bl = makeBusinessLead();
    const result = adaptBusinessLeadToInsert(bl);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.insertLead.companyName).toBe("مطعم الأصالة");
    }
  });

  it("should map verifiedPhones[0] to verifiedPhone — NOT candidatePhones", () => {
    const bl = makeBusinessLead({
      verifiedPhones: ["+966501234567"],
      candidatePhones: ["0509999999"],
    });
    const result = adaptBusinessLeadToInsert(bl);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.insertLead.verifiedPhone).toBe("+966501234567");
      // candidatePhones must NOT appear in verifiedPhone
      expect(result.insertLead.verifiedPhone).not.toBe("0509999999");
    }
  });

  it("should map socialProfiles.x to twitterUrl (schema naming)", () => {
    const bl = makeBusinessLead({
      socialProfiles: {
        x: "https://x.com/asala",
        instagram: undefined,
        tiktok: undefined,
        snapchat: undefined,
        facebook: undefined,
        linkedin: undefined,
      },
    });
    const result = adaptBusinessLeadToInsert(bl);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.insertLead.twitterUrl).toBe("https://x.com/asala");
    }
  });

  it("should fail when businessName is empty", () => {
    const bl = makeBusinessLead({ businessName: "" });
    const result = adaptBusinessLeadToInsert(bl);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toBe("missing_business_name");
    }
  });

  it("should set verifiedPhone to undefined when verifiedPhones is empty", () => {
    const bl = makeBusinessLead({ verifiedPhones: [] });
    const result = adaptBusinessLeadToInsert(bl);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.insertLead.verifiedPhone).toBeUndefined();
    }
  });

  it("should map all social platforms correctly", () => {
    const bl = makeBusinessLead({
      socialProfiles: {
        instagram: "https://instagram.com/test",
        x: "https://x.com/test",
        tiktok: "https://tiktok.com/@test",
        snapchat: "https://snapchat.com/add/test",
        facebook: "https://facebook.com/test",
        linkedin: "https://linkedin.com/company/test",
      },
    });
    const result = adaptBusinessLeadToInsert(bl);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.insertLead.instagramUrl).toBe("https://instagram.com/test");
      expect(result.insertLead.twitterUrl).toBe("https://x.com/test");
      expect(result.insertLead.tiktokUrl).toBe("https://tiktok.com/@test");
      expect(result.insertLead.snapchatUrl).toBe("https://snapchat.com/add/test");
      expect(result.insertLead.facebookUrl).toBe("https://facebook.com/test");
      expect(result.insertLead.linkedinUrl).toBe("https://linkedin.com/company/test");
    }
  });
});

// ─── auditEngine — deterministic logic tests ──────────────────────────────────

describe("auditEngine — computeSeoAudit", () => {
  it("should mark title as present when provided", () => {
    const audit = computeSeoAudit({
      title: "مطعم الأصالة",
      metaDescription: null,
      h1Tags: [],
      canonicalUrl: null,
      robotsTxt: false,
      sitemapXml: false,
      structuredData: false,
      mobileOptimized: false,
      pageSpeedScore: null,
      httpsEnabled: false,
    });
    expect(audit.present).toContain("title");
  });

  it("should mark title as missing when null", () => {
    const audit = computeSeoAudit({
      title: null,
      metaDescription: null,
      h1Tags: [],
      canonicalUrl: null,
      robotsTxt: false,
      sitemapXml: false,
      structuredData: false,
      mobileOptimized: false,
      pageSpeedScore: null,
      httpsEnabled: false,
    });
    expect(audit.missing).toContain("title");
  });

  it("should include confidence between 0 and 1", () => {
    const audit = computeSeoAudit({
      title: "Test",
      metaDescription: "desc",
      h1Tags: ["h1"],
      canonicalUrl: "https://test.com",
      robotsTxt: true,
      sitemapXml: true,
      structuredData: true,
      mobileOptimized: true,
      pageSpeedScore: 90,
      httpsEnabled: true,
    });
    expect(audit.confidence).toBeGreaterThanOrEqual(0);
    expect(audit.confidence).toBeLessThanOrEqual(1);
  });

  it("should have confidence=0 when all fields missing", () => {
    const audit = computeSeoAudit({
      title: null,
      metaDescription: null,
      h1Tags: [],
      canonicalUrl: null,
      robotsTxt: false,
      sitemapXml: false,
      structuredData: false,
      mobileOptimized: false,
      pageSpeedScore: null,
      httpsEnabled: false,
    });
    expect(audit.confidence).toBe(0);
  });
});

describe("auditEngine — computeSocialAudit", () => {
  it("should mark instagram as present when url provided", () => {
    const audit = computeSocialAudit({
      instagramUrl: "https://instagram.com/test",
      twitterUrl: null,
      tiktokUrl: null,
      snapchatUrl: null,
      facebookUrl: null,
      linkedinUrl: null,
      instagramFollowers: null,
      tiktokFollowers: null,
    });
    expect(audit.present).toContain("instagram");
    expect(audit.missing).not.toContain("instagram");
  });

  it("should mark all platforms as missing when none provided", () => {
    const audit = computeSocialAudit({
      instagramUrl: null,
      twitterUrl: null,
      tiktokUrl: null,
      snapchatUrl: null,
      facebookUrl: null,
      linkedinUrl: null,
      instagramFollowers: null,
      tiktokFollowers: null,
    });
    expect(audit.missing.length).toBeGreaterThan(0);
    expect(audit.confidence).toBe(0);
  });
});

describe("auditEngine — computeConversionAudit", () => {
  it("should mark phone as present when verifiedPhone provided", () => {
    const audit = computeConversionAudit({
      verifiedPhone: "+966501234567",
      website: "https://test.com",
      googleMapsUrl: null,
      hasWhatsapp: "unknown",
    });
    expect(audit.present).toContain("phone");
  });

  it("should mark phone as missing when verifiedPhone null", () => {
    const audit = computeConversionAudit({
      verifiedPhone: null,
      website: null,
      googleMapsUrl: null,
      hasWhatsapp: "unknown",
    });
    expect(audit.missing).toContain("phone");
  });
});

describe("auditEngine — computeMarketAudit", () => {
  it("should mark city as present when provided", () => {
    const audit = computeMarketAudit({
      city: "الرياض",
      district: null,
      businessType: "مطاعم",
      country: "SA",
    });
    expect(audit.present).toContain("city");
    expect(audit.present).toContain("businessType");
  });

  it("should mark district as missing when null", () => {
    const audit = computeMarketAudit({
      city: "الرياض",
      district: null,
      businessType: "مطاعم",
      country: "SA",
    });
    expect(audit.missing).toContain("district");
  });
});
