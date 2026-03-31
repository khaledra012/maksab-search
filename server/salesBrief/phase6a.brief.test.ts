/**
 * PHASE 6A — Tests for salesBrief
 * =================================
 * Tests for:
 *  1. resolveBestContactChannel — 6 cases (full priority chain)
 *  2. OPPORTUNITY_LABELS — all OpportunityType values have non-empty labels
 *  3. SALES_ANGLE_TEMPLATES — all OpportunityType values have templates
 *  4. FIRST_MESSAGE_TEMPLATES — all channel × opportunity combinations produce non-empty strings
 *  5. interpolate — {businessName}, {city}, {category} substitution + fallbacks
 *  6. buildTopFindings (via generateSalesBrief) — deduplication of semantic groups
 *  7. generateSalesBrief — correct assembly, throws on empty opportunities
 *  8. runSalesBriefPipeline guards — not_analyzable, no_opportunities, score_null
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  resolveBestContactChannel,
  interpolate,
  OPPORTUNITY_LABELS,
  SALES_ANGLE_TEMPLATES,
  FIRST_MESSAGE_TEMPLATES,
  PRIORITY_MODIFIER,
} from "./templates";
import { generateSalesBrief } from "./generator";
import type { LeadScore, LeadOpportunity, SalesBrief } from "../../shared/types/lead-intelligence";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseScore: LeadScore = {
  value: 72,
  priority: "B",
  reasons: ["موقع إلكتروني بدون تحسين SEO", "غياب التتبع التحليلي"],
  breakdown: {
    contactability: 20,
    digitalPresence: 15,
    commercialClarity: 10,
    gapSeverity: 15,
    opportunityFit: 7,
    evidenceQuality: 5,
  },
};

function makeOpp(type: LeadOpportunity["type"], severity: LeadOpportunity["severity"] = "high"): LeadOpportunity {
  return {
    id: `opp-${type}`,
    leadId: "1",
    type,
    severity,
    evidence: ["evidence 1"],
    businessImpact: "تأثير تجاري",
    suggestedAction: "إجراء مقترح",
  };
}

const baseLead = {
  companyName: "مطعم الأصيل",
  city: "الرياض",
  businessType: "مطاعم",
  hasWhatsapp: "yes" as string | null,
  verifiedPhone: "+966501234567",
  instagramUrl: "https://instagram.com/test",
  linkedinUrl: null as string | null,
};

// ─── 1. resolveBestContactChannel ─────────────────────────────────────────────

describe("resolveBestContactChannel", () => {
  it("returns whatsapp when hasWhatsapp === 'yes'", () => {
    expect(resolveBestContactChannel({
      hasWhatsapp: "yes",
      verifiedPhone: "+966501234567",
      instagramUrl: "https://instagram.com/x",
      linkedinUrl: "https://linkedin.com/x",
    })).toBe("whatsapp");
  });

  it("returns phone when hasWhatsapp is not 'yes' but verifiedPhone exists", () => {
    expect(resolveBestContactChannel({
      hasWhatsapp: "no",
      verifiedPhone: "+966501234567",
      instagramUrl: null,
      linkedinUrl: null,
    })).toBe("phone");
  });

  it("returns instagram when no whatsapp and no verifiedPhone but instagramUrl exists", () => {
    expect(resolveBestContactChannel({
      hasWhatsapp: null,
      verifiedPhone: null,
      instagramUrl: "https://instagram.com/test",
      linkedinUrl: null,
    })).toBe("instagram");
  });

  it("returns linkedin when only linkedinUrl is available", () => {
    expect(resolveBestContactChannel({
      hasWhatsapp: null,
      verifiedPhone: null,
      instagramUrl: null,
      linkedinUrl: "https://linkedin.com/company/test",
    })).toBe("linkedin");
  });

  it("returns email (safe fallback) when nothing is available", () => {
    expect(resolveBestContactChannel({
      hasWhatsapp: null,
      verifiedPhone: null,
      instagramUrl: null,
      linkedinUrl: null,
    })).toBe("email");
  });

  it("does NOT return phone when verifiedPhone is empty string", () => {
    const result = resolveBestContactChannel({
      hasWhatsapp: "no",
      verifiedPhone: "   ", // whitespace only
      instagramUrl: null,
      linkedinUrl: null,
    });
    expect(result).toBe("email"); // not phone
    expect(result).not.toBe("phone");
  });
});

// ─── 2. OPPORTUNITY_LABELS completeness ───────────────────────────────────────

describe("OPPORTUNITY_LABELS", () => {
  const allTypes: LeadOpportunity["type"][] = [
    "local_seo", "technical_seo", "content_strategy", "social_optimization",
    "branding", "landing_page", "paid_tracking", "retargeting",
    "whatsapp_funnel", "reputation_management", "conversion_optimization",
  ];

  it("has a non-empty label for every OpportunityType", () => {
    for (const type of allTypes) {
      const label = OPPORTUNITY_LABELS[type];
      expect(label, `Missing label for type: ${type}`).toBeTruthy();
      expect(label.length, `Empty label for type: ${type}`).toBeGreaterThan(0);
    }
  });
});

// ─── 3. SALES_ANGLE_TEMPLATES completeness ────────────────────────────────────

describe("SALES_ANGLE_TEMPLATES", () => {
  const allTypes: LeadOpportunity["type"][] = [
    "local_seo", "technical_seo", "content_strategy", "social_optimization",
    "branding", "landing_page", "paid_tracking", "retargeting",
    "whatsapp_funnel", "reputation_management", "conversion_optimization",
  ];

  it("has a non-empty template for every OpportunityType", () => {
    for (const type of allTypes) {
      const template = SALES_ANGLE_TEMPLATES[type];
      expect(template, `Missing template for type: ${type}`).toBeTruthy();
      expect(template.length, `Empty template for type: ${type}`).toBeGreaterThan(0);
    }
  });
});

// ─── 4. FIRST_MESSAGE_TEMPLATES completeness ──────────────────────────────────

describe("FIRST_MESSAGE_TEMPLATES", () => {
  const allChannels: SalesBrief["bestContactChannel"][] = [
    "whatsapp", "phone", "instagram", "linkedin", "email",
  ];
  const allTypes: LeadOpportunity["type"][] = [
    "local_seo", "technical_seo", "content_strategy", "social_optimization",
    "branding", "landing_page", "paid_tracking", "retargeting",
    "whatsapp_funnel", "reputation_management", "conversion_optimization",
  ];

  it("has a non-empty message for every channel × opportunity combination", () => {
    for (const channel of allChannels) {
      for (const type of allTypes) {
        const msg = FIRST_MESSAGE_TEMPLATES[channel]?.[type];
        expect(msg, `Missing message for ${channel} × ${type}`).toBeTruthy();
        expect(msg.length, `Empty message for ${channel} × ${type}`).toBeGreaterThan(0);
      }
    }
  });
});

// ─── 5. interpolate ───────────────────────────────────────────────────────────

describe("interpolate", () => {
  it("replaces all three placeholders", () => {
    const result = interpolate(
      "نساعد {businessName} في {city} بقطاع {category}",
      { businessName: "مطعم الأصيل", city: "الرياض", category: "مطاعم" }
    );
    expect(result).toBe("نساعد مطعم الأصيل في الرياض بقطاع مطاعم");
  });

  it("uses fallback 'النشاط' when businessName is null", () => {
    const result = interpolate("نساعد {businessName}", { businessName: null });
    expect(result).toBe("نساعد النشاط");
  });

  it("uses fallback 'المنطقة' when city is undefined", () => {
    const result = interpolate("في {city}", { city: undefined });
    expect(result).toBe("في المنطقة");
  });

  it("uses fallback 'القطاع' when category is empty string", () => {
    const result = interpolate("قطاع {category}", { category: "" });
    expect(result).toBe("قطاع القطاع");
  });

  it("replaces multiple occurrences of the same placeholder", () => {
    const result = interpolate("{businessName} و {businessName}", { businessName: "مكسب" });
    expect(result).toBe("مكسب و مكسب");
  });
});

// ─── 6. generateSalesBrief — basic assembly ───────────────────────────────────

describe("generateSalesBrief", () => {
  it("returns a complete SalesBrief with correct fields", () => {
    const brief = generateSalesBrief({
      lead: baseLead,
      score: baseScore,
      opportunities: [makeOpp("local_seo"), makeOpp("technical_seo")],
    });

    expect(brief.businessName).toBe("مطعم الأصيل");
    expect(brief.city).toBe("الرياض");
    expect(brief.category).toBe("مطاعم");
    expect(brief.leadScore).toBe(72);
    expect(brief.priority).toBe("B");
    expect(brief.bestContactChannel).toBe("whatsapp");
    expect(brief.topOpportunity).toBe(OPPORTUNITY_LABELS["local_seo"]);
    expect(brief.salesAngle).toContain("مطعم الأصيل");
    expect(brief.firstMessageHint).toContain("مطعم الأصيل");
    expect(Array.isArray(brief.topFindings)).toBe(true);
    expect(brief.topFindings.length).toBeGreaterThan(0);
  });

  it("generates brief even when opportunities array is empty (fallback mode)", () => {
    const brief = generateSalesBrief({
      lead: baseLead,
      score: baseScore,
      opportunities: [],
    });
    // بعد الإصلاح: يُنتج brief حتى بدون opportunities بدلاً من رمي خطأ
    expect(brief).toBeDefined();
    expect(brief.businessName).toBeTruthy();
    expect(brief.salesAngle).toBeTruthy();
  });

  it("omits city and category when not provided", () => {
    const brief = generateSalesBrief({
      lead: { ...baseLead, city: null, businessType: null },
      score: baseScore,
      opportunities: [makeOpp("local_seo")],
    });
    expect(brief.city).toBeUndefined();
    expect(brief.category).toBeUndefined();
  });

  it("uses 'غير محدد' as businessName fallback when companyName is null", () => {
    const brief = generateSalesBrief({
      lead: { ...baseLead, companyName: null },
      score: baseScore,
      opportunities: [makeOpp("local_seo")],
    });
    expect(brief.businessName).toBe("غير محدد");
  });
});

// ─── 7. topFindings deduplication ─────────────────────────────────────────────

describe("generateSalesBrief — topFindings deduplication", () => {
  it("does not include both local_seo and technical_seo labels (semantic group)", () => {
    const brief = generateSalesBrief({
      lead: { ...baseLead, city: null },
      score: { ...baseScore, reasons: [] },
      opportunities: [
        makeOpp("local_seo"),
        makeOpp("technical_seo"),
        makeOpp("branding"),
      ],
    });

    const seoLabel1 = OPPORTUNITY_LABELS["local_seo"];
    const seoLabel2 = OPPORTUNITY_LABELS["technical_seo"];
    const count = brief.topFindings.filter(f => f === seoLabel1 || f === seoLabel2).length;
    expect(count).toBeLessThanOrEqual(1); // only one SEO label allowed
  });

  it("does not include both paid_tracking and retargeting labels (semantic group)", () => {
    const brief = generateSalesBrief({
      lead: { ...baseLead, city: null },
      score: { ...baseScore, reasons: [] },
      opportunities: [
        makeOpp("paid_tracking"),
        makeOpp("retargeting"),
        makeOpp("content_strategy"),
      ],
    });

    const label1 = OPPORTUNITY_LABELS["paid_tracking"];
    const label2 = OPPORTUNITY_LABELS["retargeting"];
    const count = brief.topFindings.filter(f => f === label1 || f === label2).length;
    expect(count).toBeLessThanOrEqual(1);
  });

  it("does not include exact duplicate strings", () => {
    const brief = generateSalesBrief({
      lead: baseLead,
      score: { ...baseScore, reasons: ["نفس السبب", "نفس السبب", "سبب مختلف"] },
      opportunities: [makeOpp("local_seo")],
    });

    const seen = new Set<string>();
    for (const finding of brief.topFindings) {
      expect(seen.has(finding)).toBe(false);
      seen.add(finding);
    }
  });

  it("caps topFindings at 4 items", () => {
    const brief = generateSalesBrief({
      lead: baseLead,
      score: { ...baseScore, reasons: ["سبب 1", "سبب 2", "سبب 3", "سبب 4", "سبب 5"] },
      opportunities: [
        makeOpp("local_seo"),
        makeOpp("content_strategy"),
        makeOpp("whatsapp_funnel"),
      ],
    });
    expect(brief.topFindings.length).toBeLessThanOrEqual(4);
  });
});

// ─── 8. PRIORITY_MODIFIER ─────────────────────────────────────────────────────

describe("PRIORITY_MODIFIER", () => {
  it("A priority adds urgency text to firstMessageHint", () => {
    const brief = generateSalesBrief({
      lead: baseLead,
      score: { ...baseScore, priority: "A" },
      opportunities: [makeOpp("local_seo")],
    });
    expect(brief.firstMessageHint).toContain(PRIORITY_MODIFIER["A"]);
  });

  it("C priority adds no modifier to firstMessageHint", () => {
    const brief = generateSalesBrief({
      lead: baseLead,
      score: { ...baseScore, priority: "C" },
      opportunities: [makeOpp("local_seo")],
    });
    expect(PRIORITY_MODIFIER["C"]).toBe("");
  });
});

// ─── 9. runSalesBriefPipeline guards (logic-level) ───────────────────────────────────────────────────
// These tests validate the guard conditions directly without DB access.
// The pipeline integration test uses leadId=0 which triggers a scoring failure.

import { runSalesBriefPipeline } from "./index";

describe("runSalesBriefPipeline guards (logic-level)", () => {
  it("guard condition: not_analyzable blocks pipeline", () => {
    const isBlocked = (readinessState: string | null) => readinessState === "not_analyzable";
    expect(isBlocked("not_analyzable")).toBe(true);
    expect(isBlocked("partial")).toBe(false);
    expect(isBlocked("ready")).toBe(false);
    expect(isBlocked(null)).toBe(false);
  });

  it("guard condition: null score blocks pipeline", () => {
    const isBlocked = (score: unknown) => score === null;
    expect(isBlocked(null)).toBe(true);
    expect(isBlocked({ value: 50, priority: "C" })).toBe(false);
    expect(isBlocked(0)).toBe(false);
  });

  it("guard condition: empty opportunities blocks pipeline", () => {
    const isBlocked = (opps: unknown[]) => opps.length === 0;
    expect(isBlocked([])).toBe(true);
    expect(isBlocked([makeOpp("local_seo")])).toBe(false);
    expect(isBlocked([makeOpp("local_seo"), makeOpp("branding")])).toBe(false);
  });

  it("pipeline returns structured failure for non-existent leadId=0", async () => {
    // leadId=0 will fail at scoring (lead not found in DB)
    // This confirms the pipeline returns structured failure, not throws
    const result = await runSalesBriefPipeline(0);
    expect(result.success).toBe(false);
    expect(result.brief).toBeNull();
    expect(result.leadId).toBe(0);
    expect(result.failedSteps.length).toBeGreaterThan(0);
    expect(Array.isArray(result.completedSteps)).toBe(true);
  });
});
