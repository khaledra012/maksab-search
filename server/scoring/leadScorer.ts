/**
 * PHASE 5 — leadScorer.ts
 * ========================
 * Computes a deterministic LeadScore from 6 weighted dimensions.
 *
 * Design principles:
 *  - Fully deterministic: same inputs always produce same score
 *  - No AI, no external calls, no free-text generation
 *  - Transparent formula: each dimension is independently computable and auditable
 *  - Does NOT write to dataQualityScore — that field is reserved for data completeness logic
 *  - Does NOT write to aiConfidenceScore — that field is reserved for AI-generated analysis
 *
 * Score dimensions (total weight = 100%):
 *  1. contactability    (25%) — verifiedPhone + hasWhatsapp + website
 *  2. digitalPresence   (20%) — social platforms present + website
 *  3. commercialClarity (15%) — companyName + city + businessType + googleMapsUrl
 *  4. gapSeverity       (20%) — high-severity opportunities as proportion of max (4)
 *  5. opportunityFit    (10%) — total opportunities as proportion of max (8)
 *  6. evidenceQuality   (10%) — readinessState mapped to 0..1
 *
 * Final value: weighted sum × 100, clamped to [0, 100], rounded to integer.
 */

import type { LeadScore } from "../../shared/types/lead-intelligence";
import type { LeadOpportunity } from "../../shared/types/lead-intelligence";
import type { AnalysisReadinessState } from "../autofill/computeAnalysisReadiness";

// ─── Input type ───────────────────────────────────────────────────────────────

export type LeadScorerInput = {
  /** Lead fields needed for scoring */
  lead: {
    verifiedPhone: string | null | undefined;
    hasWhatsapp: string | null | undefined;
    website: string | null | undefined;
    instagramUrl: string | null | undefined;
    twitterUrl: string | null | undefined;
    tiktokUrl: string | null | undefined;
    snapchatUrl: string | null | undefined;
    facebookUrl: string | null | undefined;
    linkedinUrl: string | null | undefined;
    companyName: string | null | undefined;
    city: string | null | undefined;
    businessType: string | null | undefined;
    googleMapsUrl: string | null | undefined;
  };
  /** Opportunities extracted by opportunityEngine */
  opportunities: LeadOpportunity[];
  /** Readiness state from computeAnalysisReadiness */
  readinessState: AnalysisReadinessState;
};

// ─── Weights ──────────────────────────────────────────────────────────────────

const WEIGHTS = {
  contactability: 0.25,
  digitalPresence: 0.20,
  commercialClarity: 0.15,
  gapSeverity: 0.20,
  opportunityFit: 0.10,
  evidenceQuality: 0.10,
} as const;

const MAX_HIGH_SEVERITY_OPPORTUNITIES = 4;
const MAX_TOTAL_OPPORTUNITIES = 8;
const SOCIAL_PLATFORMS = ["instagramUrl", "twitterUrl", "tiktokUrl", "snapchatUrl", "facebookUrl", "linkedinUrl"] as const;

// ─── Dimension calculators ────────────────────────────────────────────────────

/**
 * contactability (25%)
 * Measures how reachable the business is.
 * - verifiedPhone present: +0.40
 * - hasWhatsapp === "yes": +0.40
 * - website present: +0.20
 */
function computeContactability(lead: LeadScorerInput["lead"]): number {
  let score = 0;
  if (lead.verifiedPhone) score += 0.40;
  if (lead.hasWhatsapp === "yes") score += 0.40;
  if (lead.website) score += 0.20;
  return Math.min(score, 1);
}

/**
 * digitalPresence (20%)
 * Measures the breadth of digital footprint.
 * - Each social platform present: +1/7 (6 platforms + website)
 * - website present: +1/7
 */
function computeDigitalPresence(lead: LeadScorerInput["lead"]): number {
  const total = SOCIAL_PLATFORMS.length + 1; // +1 for website
  let count = 0;
  for (const platform of SOCIAL_PLATFORMS) {
    if (lead[platform]) count++;
  }
  if (lead.website) count++;
  return count / total;
}

/**
 * commercialClarity (15%)
 * Measures how well-defined the business identity is.
 * - companyName present: +0.25
 * - city present: +0.25
 * - businessType present: +0.25
 * - googleMapsUrl present: +0.25
 */
function computeCommercialClarity(lead: LeadScorerInput["lead"]): number {
  let score = 0;
  if (lead.companyName) score += 0.25;
  if (lead.city) score += 0.25;
  if (lead.businessType) score += 0.25;
  if (lead.googleMapsUrl) score += 0.25;
  return Math.min(score, 1);
}

/**
 * gapSeverity (20%)
 * Measures the commercial urgency of identified gaps.
 * Higher score = more high-severity opportunities = more urgent need for services.
 * Capped at MAX_HIGH_SEVERITY_OPPORTUNITIES (4).
 */
function computeGapSeverity(opportunities: LeadOpportunity[]): number {
  const highCount = opportunities.filter(o => o.severity === "high").length;
  return Math.min(highCount / MAX_HIGH_SEVERITY_OPPORTUNITIES, 1);
}

/**
 * opportunityFit (10%)
 * Measures how many service opportunities exist.
 * More opportunities = more potential revenue from this lead.
 * Capped at MAX_TOTAL_OPPORTUNITIES (8).
 */
function computeOpportunityFit(opportunities: LeadOpportunity[]): number {
  return Math.min(opportunities.length / MAX_TOTAL_OPPORTUNITIES, 1);
}

/**
 * evidenceQuality (10%)
 * Maps readiness state to a confidence multiplier.
 * Reflects how reliable the scoring evidence is.
 */
function computeEvidenceQuality(readinessState: AnalysisReadinessState): number {
  const stateMap: Record<AnalysisReadinessState, number> = {
    ready_for_analysis: 1.0,
    partially_analyzable: 0.6,
    missing_critical_data: 0.3,
    not_analyzable: 0.0,
  };
  return stateMap[readinessState] ?? 0;
}

// ─── Reason builder ───────────────────────────────────────────────────────────

function buildReasons(
  breakdown: LeadScore["breakdown"],
  opportunities: LeadOpportunity[]
): string[] {
  const reasons: string[] = [];

  if (breakdown.contactability >= 0.8) {
    reasons.push("قابلية تواصل عالية — هاتف + واتساب متاحان");
  } else if (breakdown.contactability <= 0.2) {
    reasons.push("قابلية تواصل منخفضة — لا هاتف ولا واتساب");
  }

  if (breakdown.digitalPresence >= 0.7) {
    reasons.push("حضور رقمي قوي على منصات متعددة");
  } else if (breakdown.digitalPresence <= 0.2) {
    reasons.push("حضور رقمي ضعيف — فرصة توسع كبيرة");
  }

  if (breakdown.gapSeverity >= 0.75) {
    reasons.push("فجوات تسويقية حرجة متعددة — أولوية عالية للتدخل");
  }

  if (opportunities.length === 0) {
    reasons.push("لا فرص واضحة — البيانات غير كافية للتحليل");
  } else {
    const highCount = opportunities.filter(o => o.severity === "high").length;
    if (highCount > 0) {
      reasons.push(`${highCount} فرصة عالية الأولوية مُكتشفة`);
    }
  }

  if (breakdown.evidenceQuality < 0.4) {
    reasons.push("جودة الأدلة منخفضة — النتيجة تقريبية");
  }

  return reasons;
}

// ─── Priority mapper ──────────────────────────────────────────────────────────

function mapToPriority(value: number): LeadScore["priority"] {
  if (value >= 75) return "A";
  if (value >= 50) return "B";
  if (value >= 25) return "C";
  return "D";
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * computeLeadScore — pure function
 * Takes lead data, opportunities, and readiness state.
 * Returns a fully populated LeadScore with breakdown and reasons.
 */
export function computeLeadScore(input: LeadScorerInput): LeadScore {
  const { lead, opportunities, readinessState } = input;

  const breakdown = {
    contactability: computeContactability(lead),
    digitalPresence: computeDigitalPresence(lead),
    commercialClarity: computeCommercialClarity(lead),
    gapSeverity: computeGapSeverity(opportunities),
    opportunityFit: computeOpportunityFit(opportunities),
    evidenceQuality: computeEvidenceQuality(readinessState),
  };

  // Weighted sum
  const rawScore =
    breakdown.contactability * WEIGHTS.contactability +
    breakdown.digitalPresence * WEIGHTS.digitalPresence +
    breakdown.commercialClarity * WEIGHTS.commercialClarity +
    breakdown.gapSeverity * WEIGHTS.gapSeverity +
    breakdown.opportunityFit * WEIGHTS.opportunityFit +
    breakdown.evidenceQuality * WEIGHTS.evidenceQuality;

  const value = Math.round(Math.min(Math.max(rawScore * 100, 0), 100));
  const priority = mapToPriority(value);
  const reasons = buildReasons(breakdown, opportunities);

  return { value, priority, reasons, breakdown };
}
