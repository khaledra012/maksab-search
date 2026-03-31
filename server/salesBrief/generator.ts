/**
 * PHASE 6A — salesBrief/generator.ts
 * =====================================
 * Pure, synchronous SalesBrief generator.
 * Zero external dependencies. Zero LLM calls. Zero DB access.
 *
 * Design principles:
 *  - Fully deterministic: same inputs always produce same outputs
 *  - Synchronous: no async, no latency
 *  - topFindings deduplication: semantically similar findings are collapsed
 *  - bestContactChannel: phone is NEVER used unless verifiedPhone is confirmed
 *  - Safe fallback: email is the final fallback when no channel is confirmed
 */
import type {
  LeadScore,
  LeadOpportunity,
  SalesBrief,
} from "../../shared/types/lead-intelligence";
import {
  OPPORTUNITY_LABELS,
  SALES_ANGLE_TEMPLATES,
  FIRST_MESSAGE_TEMPLATES,
  PRIORITY_MODIFIER,
  resolveBestContactChannel,
  interpolate,
  type ContactChannelInput,
} from "./templates";

// ─── Input type ───────────────────────────────────────────────────────────────
export type SalesBriefGeneratorInput = {
  lead: {
    companyName: string | null | undefined;
    city: string | null | undefined;
    businessType: string | null | undefined;
    hasWhatsapp: string | null | undefined;
    verifiedPhone: string | null | undefined;
    instagramUrl: string | null | undefined;
    linkedinUrl: string | null | undefined;
  };
  score: LeadScore;
  opportunities: LeadOpportunity[];
};

// ─── topFindings deduplication ────────────────────────────────────────────────
/**
 * Semantic similarity groups — opportunity types that are too similar to appear
 * together in topFindings. Only the first encountered type in each group is kept.
 *
 * Groups:
 *  - SEO group:        local_seo, technical_seo (both are "SEO" to the client)
 *  - Paid group:       paid_tracking, retargeting (both are "ads" to the client)
 *  - Social group:     social_optimization, branding (both are "presence")
 */
const SEMANTIC_GROUPS: OpportunityType[][] = [
  ["local_seo", "technical_seo"],
  ["paid_tracking", "retargeting"],
  ["social_optimization", "branding"],
];

type OpportunityType = LeadOpportunity["type"];

/**
 * Deduplicates a list of finding strings by removing semantically redundant entries.
 * Also removes exact string duplicates.
 *
 * Strategy:
 *  1. Build findings from score.reasons + opportunity labels
 *  2. Track which semantic group has already been represented
 *  3. Skip any finding whose opportunity type belongs to an already-represented group
 *  4. Cap at maxFindings
 */
function buildTopFindings(
  scoreReasons: string[],
  opportunities: LeadOpportunity[],
  maxFindings = 4
): string[] {
  const findings: string[] = [];
  const seen = new Set<string>();
  const representedGroups = new Set<number>();

  // Helper: find which semantic group index an opportunity type belongs to (-1 if none)
  function groupIndexOf(type: OpportunityType): number {
    return SEMANTIC_GROUPS.findIndex((g) => g.includes(type));
  }

  // Step 1: Add score reasons first (they are already deduplicated by leadScorer)
  for (const reason of scoreReasons) {
    if (findings.length >= maxFindings) break;
    const normalized = reason.trim();
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      findings.push(normalized);
    }
  }

  // Step 2: Add opportunity labels, skipping semantic duplicates
  for (const opp of opportunities) {
    if (findings.length >= maxFindings) break;
    const label = OPPORTUNITY_LABELS[opp.type];
    if (!label) continue;

    // Check semantic group
    const groupIdx = groupIndexOf(opp.type);
    if (groupIdx !== -1 && representedGroups.has(groupIdx)) {
      // This semantic group is already represented — skip
      continue;
    }

    // Check exact duplicate
    if (seen.has(label)) continue;

    seen.add(label);
    if (groupIdx !== -1) representedGroups.add(groupIdx);
    findings.push(label);
  }

  return findings;
}

// ─── Main export ──────────────────────────────────────────────────────────────
/**
 * generateSalesBrief — pure synchronous function
 *
 * Produces a fully populated SalesBrief from lead data, score, and opportunities.
 * Throws if opportunities array is empty (caller must guard before calling).
 */
/**
 * Builds a fallback opportunity list from score breakdown when no real opportunities exist.
 * Uses the weakest dimension to suggest the most impactful service.
 */
function buildFallbackOpportunities(score: LeadScore): LeadOpportunity[] {
  const breakdown = score.breakdown;
  // اختر أضعف بُعد لتحديد الفرصة الافتراضية
  const dims = Object.entries(breakdown) as [string, number][];
  dims.sort((a, b) => a[1] - b[1]);
  const weakest = dims[0]?.[0] ?? "digitalPresence";

  const typeMap: Record<string, LeadOpportunity["type"]> = {
    contactability: "whatsapp_funnel",
    digitalPresence: "social_optimization",
    commercialClarity: "local_seo",
    gapSeverity: "conversion_optimization",
    opportunityFit: "landing_page",
    evidenceQuality: "reputation_management",
  };

  const type: LeadOpportunity["type"] = typeMap[weakest] ?? "social_optimization";
  return [{
    id: "fallback-0",
    leadId: "0",
    type,
    severity: "medium",
    evidence: ["score-based fallback"],
    businessImpact: "تحسين الأداء العام للنشاط التجاري",
    suggestedAction: "مراجعة الحضور الرقمي وتحديد أولويات التحسين",
  }];
}

export function generateSalesBrief(input: SalesBriefGeneratorInput): SalesBrief {
  const { lead, score } = input;
  // إذا كانت opportunities فارغة نستخدم fallback بدلاً من الرفض
  const opportunities = input.opportunities.length > 0
    ? input.opportunities
    : buildFallbackOpportunities(score);

  // ── 1. Resolve bestContactChannel ─────────────────────────────────────────
  const channelInput: ContactChannelInput = {
    hasWhatsapp: lead.hasWhatsapp,
    verifiedPhone: lead.verifiedPhone,
    instagramUrl: lead.instagramUrl,
    linkedinUrl: lead.linkedinUrl,
  };
  const bestContactChannel = resolveBestContactChannel(channelInput);

  // ── 2. Resolve topOpportunity ──────────────────────────────────────────────
  const primaryOpportunityType = opportunities[0].type;
  const topOpportunity = OPPORTUNITY_LABELS[primaryOpportunityType];

  // ── 3. Build topFindings (deduplicated) ────────────────────────────────────
  const topFindings = buildTopFindings(score.reasons, opportunities, 4);

  // ── 4. Build salesAngle ────────────────────────────────────────────────────
  const salesAngleTemplate = SALES_ANGLE_TEMPLATES[primaryOpportunityType];
  const salesAngle = interpolate(salesAngleTemplate, {
    businessName: lead.companyName,
    city: lead.city,
    category: lead.businessType,
  });

  // ── 5. Build firstMessageHint ──────────────────────────────────────────────
  const messageTemplate = FIRST_MESSAGE_TEMPLATES[bestContactChannel][primaryOpportunityType];
  const baseMessage = interpolate(messageTemplate, {
    businessName: lead.companyName,
    city: lead.city,
    category: lead.businessType,
  });
  const firstMessageHint = baseMessage + PRIORITY_MODIFIER[score.priority];

  // ── 6. Assemble SalesBrief ─────────────────────────────────────────────────
  const brief: SalesBrief = {
    businessName: lead.companyName?.trim() || "غير محدد",
    leadScore: score.value,
    priority: score.priority,
    topOpportunity,
    topFindings,
    bestContactChannel,
    salesAngle,
    firstMessageHint,
  };

  // Optional fields — only include if present
  if (lead.city?.trim()) brief.city = lead.city.trim();
  if (lead.businessType?.trim()) brief.category = lead.businessType.trim();

  return brief;
}
