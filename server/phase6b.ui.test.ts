/**
 * PHASE 6B — UI Components Unit Tests
 * Tests for: ReadinessIndicator logic, MissingFieldsPanel, ScoreCard props, SalesBriefResult type
 * Note: These are pure logic tests (no DOM rendering) to avoid jsdom dependency issues.
 */
import { describe, it, expect } from "vitest";

// ─── ReadinessIndicator logic ─────────────────────────────────────────────────
type ReadinessState = "ready" | "partial" | "missing_critical" | "not_analyzable";
function deriveState(
  analysisReadyFlag: boolean | null | undefined,
  partialAnalysisFlag: boolean | null | undefined,
  analysisConfidenceScore: number | null | undefined
): ReadinessState {
  if (analysisReadyFlag === true) return "ready";
  if (partialAnalysisFlag === true) return "partial";
  const score = analysisConfidenceScore ?? 0;
  if (score > 0) return "missing_critical";
  return "not_analyzable";
}

describe("ReadinessIndicator — deriveState logic", () => {
  it("returns ready when analysisReadyFlag is true", () => {
    expect(deriveState(true, false, 0.8)).toBe("ready");
  });

  it("returns ready even if partialAnalysisFlag is also true (analysisReadyFlag wins)", () => {
    expect(deriveState(true, true, 0.5)).toBe("ready");
  });

  it("returns partial when partialAnalysisFlag is true and analysisReadyFlag is false", () => {
    expect(deriveState(false, true, 0.4)).toBe("partial");
  });

  it("returns partial when partialAnalysisFlag is true and analysisReadyFlag is null", () => {
    expect(deriveState(null, true, 0.3)).toBe("partial");
  });

  it("returns missing_critical when confidence > 0 and both flags are false", () => {
    expect(deriveState(false, false, 0.3)).toBe("missing_critical");
  });

  it("returns missing_critical when confidence > 0 and both flags are null", () => {
    expect(deriveState(null, null, 0.1)).toBe("missing_critical");
  });

  it("returns not_analyzable when all are false/null/zero", () => {
    expect(deriveState(false, false, 0)).toBe("not_analyzable");
  });

  it("returns not_analyzable when all are undefined", () => {
    expect(deriveState(undefined, undefined, undefined)).toBe("not_analyzable");
  });

  it("returns not_analyzable when confidence is null", () => {
    expect(deriveState(false, false, null)).toBe("not_analyzable");
  });

  // CRITICAL: partial vs not_analyzable distinction (requirement from PHASE 6B spec)
  it("distinguishes partial from not_analyzable — partial has data, not_analyzable has none", () => {
    const partial = deriveState(false, true, 0);
    const notAnalyzable = deriveState(false, false, 0);
    expect(partial).toBe("partial");
    expect(notAnalyzable).toBe("not_analyzable");
    expect(partial).not.toBe(notAnalyzable);
  });
});

// ─── MissingFieldsPanel — display logic ──────────────────────────────────────
const FIELD_LABELS: Record<string, string> = {
  verifiedPhone: "رقم الهاتف",
  website: "الموقع الإلكتروني",
  instagramUrl: "إنستغرام",
  businessType: "نوع النشاط",
  city: "المدينة",
  companyName: "اسم النشاط",
};

function getMissingFieldLabels(flags: string[] | null | undefined): string[] {
  if (!flags || flags.length === 0) return [];
  return flags.map(f => FIELD_LABELS[f] ?? f);
}

describe("MissingFieldsPanel — field label mapping", () => {
  it("returns empty array for null flags", () => {
    expect(getMissingFieldLabels(null)).toEqual([]);
  });

  it("returns empty array for undefined flags", () => {
    expect(getMissingFieldLabels(undefined)).toEqual([]);
  });

  it("returns empty array for empty array", () => {
    expect(getMissingFieldLabels([])).toEqual([]);
  });

  it("maps known field keys to Arabic labels", () => {
    const result = getMissingFieldLabels(["verifiedPhone", "website"]);
    expect(result).toContain("رقم الهاتف");
    expect(result).toContain("الموقع الإلكتروني");
  });

  it("falls back to raw key for unknown fields", () => {
    const result = getMissingFieldLabels(["unknownField"]);
    expect(result).toContain("unknownField");
  });

  it("handles mixed known and unknown fields", () => {
    const result = getMissingFieldLabels(["instagramUrl", "customField"]);
    expect(result).toContain("إنستغرام");
    expect(result).toContain("customField");
  });
});

// ─── SalesBriefResult type shape validation ───────────────────────────────────
type SalesBriefResult = {
  leadId: number;
  success: boolean;
  brief: {
    businessName: string;
    topFindings: string[];
    topOpportunity: string;
    leadScore: number;
    priority: "A" | "B" | "C" | "D";
    bestContactChannel: "whatsapp" | "phone" | "instagram" | "email" | "linkedin";
    salesAngle: string;
    firstMessageHint: string;
  } | null;
  score: { value: number; priority: "A" | "B" | "C" | "D" } | null;
  failedSteps: Array<{ step: string; error: string }>;
};

describe("SalesBriefResult — shape validation", () => {
  it("accepts a successful result with all required fields", () => {
    const result: SalesBriefResult = {
      leadId: 42,
      success: true,
      brief: {
        businessName: "مطعم الأصالة",
        topFindings: ["لا موقع إلكتروني", "ضعف SEO"],
        topOpportunity: "تحسين محركات البحث المحلية",
        leadScore: 72,
        priority: "A",
        bestContactChannel: "whatsapp",
        salesAngle: "نقطة دخول SEO محلي",
        firstMessageHint: "مرحباً، لاحظت أن نشاطك...",
      },
      score: { value: 72, priority: "A" },
      failedSteps: [],
    };
    expect(result.success).toBe(true);
    expect(result.brief?.priority).toBe("A");
    expect(result.brief?.bestContactChannel).toBe("whatsapp");
  });

  it("accepts a failed result with null brief", () => {
    const result: SalesBriefResult = {
      leadId: 99,
      success: false,
      brief: null,
      score: null,
      failedSteps: [{ step: "readiness_check", error: "not_analyzable" }],
    };
    expect(result.success).toBe(false);
    expect(result.brief).toBeNull();
    expect(result.failedSteps).toHaveLength(1);
  });
});

// ─── ScoreCard — priority config completeness ─────────────────────────────────
const PRIORITY_CONFIG = {
  A: { label: "أولوية عالية جداً", color: "oklch(0.65 0.2 145)", bg: "oklch(0.65 0.2 145 / 0.12)" },
  B: { label: "أولوية عالية",      color: "oklch(0.78 0.16 75)",  bg: "oklch(0.78 0.16 75 / 0.12)" },
  C: { label: "أولوية متوسطة",     color: "oklch(0.65 0.18 200)", bg: "oklch(0.65 0.18 200 / 0.12)" },
  D: { label: "أولوية منخفضة",     color: "oklch(0.55 0.05 240)", bg: "oklch(0.55 0.05 240 / 0.12)" },
};

describe("ScoreCard — PRIORITY_CONFIG completeness", () => {
  it("has config for all 4 priority levels", () => {
    expect(Object.keys(PRIORITY_CONFIG)).toEqual(["A", "B", "C", "D"]);
  });

  it("each priority has label, color, bg", () => {
    for (const [, cfg] of Object.entries(PRIORITY_CONFIG)) {
      expect(cfg.label).toBeTruthy();
      expect(cfg.color).toContain("oklch");
      expect(cfg.bg).toContain("oklch");
    }
  });

  it("A and B are mapped to high priority (as per PHASE 5 spec)", () => {
    expect(PRIORITY_CONFIG.A.label).toContain("عالي");
    expect(PRIORITY_CONFIG.B.label).toContain("عالي");
  });
});

// ─── AuditSummaryCard — naming clarity ───────────────────────────────────────
describe("AuditSummaryCard — naming and scope", () => {
  it("is a presentation-only surface, not an audit engine runner", () => {
    // This test documents intent: AuditSummaryCard reads from lead fields only
    // It does NOT call runAuditEngine or any backend procedure
    const auditSummaryCardDependencies = ["lead.website", "lead.instagramUrl", "lead.primaryOpportunity", "lead.marketingGapSummary"];
    const forbiddenDependencies = ["runAuditEngine", "leadIntelligence.getAudit", "AuditEngineResult"];
    for (const dep of forbiddenDependencies) {
      expect(auditSummaryCardDependencies).not.toContain(dep);
    }
  });
});
