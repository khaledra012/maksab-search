/**
 * PHASE 5 — opportunityEngine.ts
 * ================================
 * Converts AuditEngineResult into LeadOpportunity[] with explicit commercial evidence.
 *
 * Design principles:
 *  - Deterministic: same inputs always produce same outputs
 *  - Evidence-backed: every opportunity requires two corroborating conditions
 *  - Commercially meaningful: rules reflect real business gaps, not just missing fields
 *  - No AI, no external calls, no free-text generation
 *
 * Opportunity rules (8 total):
 *  1. local_seo         — title_tag AND meta_description both missing
 *  2. technical_seo     — canonical_url AND sitemap_xml both missing
 *  3. conversion_opt    — whatsapp missing BUT phone present (reachable, no conversion path)
 *  4. whatsapp_funnel   — whatsapp AND online_booking both missing (no digital conversion at all)
 *  5. landing_page      — website AND google_maps both missing (no trackable digital presence)
 *  6. social_opt        — at least 1 platform present BUT 4+ platforms missing (partial presence)
 *  7. reputation_mgmt   — google_maps missing BUT website present (business exists, not on map)
 *  8. paid_tracking     — structured_data AND og_tags both missing (no paid ads infrastructure)
 */

import type { AuditEngineResult } from "../enrichment/auditEngine";
import type { LeadOpportunity, OpportunityType } from "../../shared/types/lead-intelligence";
import { randomUUID } from "crypto";

// ─── Types ────────────────────────────────────────────────────────────────────

export type OpportunityEngineInput = {
  auditResult: AuditEngineResult;
  /** Lead ID for attaching to opportunities */
  leadId: number;
};

// ─── Rule helpers ─────────────────────────────────────────────────────────────

function hasMissing(signals: string[], ...keys: string[]): boolean {
  return keys.every(k => signals.includes(k));
}

function hasPresent(signals: string[], ...keys: string[]): boolean {
  return keys.every(k => signals.includes(k));
}

function countMissing(signals: string[], keys: string[]): number {
  return keys.filter(k => signals.includes(k)).length;
}

function countPresent(signals: string[], keys: string[]): number {
  return keys.filter(k => signals.includes(k)).length;
}

function makeOpportunity(
  leadId: number,
  type: OpportunityType,
  severity: LeadOpportunity["severity"],
  evidence: string[],
  businessImpact: string,
  suggestedAction: string
): LeadOpportunity {
  return {
    id: randomUUID(),
    leadId: String(leadId),
    type,
    severity,
    evidence,
    businessImpact,
    suggestedAction,
  };
}

// ─── Rule definitions ─────────────────────────────────────────────────────────

/**
 * Rule 1: local_seo
 * Condition: title_tag AND meta_description both missing from seoAudit
 * Commercial meaning: page is invisible to search engines — no local discovery
 */
function ruleLocalSeo(
  leadId: number,
  seo: AuditEngineResult["seoAudit"]
): LeadOpportunity | null {
  if (hasMissing(seo.missing, "title_tag", "meta_description")) {
    return makeOpportunity(
      leadId,
      "local_seo",
      "high",
      ["title_tag absent", "meta_description absent"],
      "العميل غير مرئي في نتائج البحث المحلية — لا يمكن اكتشافه عبر Google",
      "كتابة title tag ومeta description محسّنة للبحث المحلي"
    );
  }
  return null;
}

/**
 * Rule 2: technical_seo
 * Condition: canonical_url AND sitemap_xml both missing from seoAudit
 * Commercial meaning: site has no crawl infrastructure — search engines cannot index it properly
 */
function ruleTechnicalSeo(
  leadId: number,
  seo: AuditEngineResult["seoAudit"]
): LeadOpportunity | null {
  if (hasMissing(seo.missing, "canonical_url", "sitemap_xml")) {
    return makeOpportunity(
      leadId,
      "technical_seo",
      "medium",
      ["canonical_url absent", "sitemap_xml absent"],
      "الموقع لا يمتلك بنية تحتية للزحف — محركات البحث لا تفهرسه بشكل صحيح",
      "إضافة canonical URL وملف sitemap.xml لتحسين الفهرسة"
    );
  }
  return null;
}

/**
 * Rule 3: conversion_optimization
 * Condition: whatsapp missing from conversionAudit AND phone present in conversionAudit
 * Commercial meaning: customer is reachable by phone but has no WhatsApp conversion path
 */
function ruleConversionOptimization(
  leadId: number,
  conversion: AuditEngineResult["conversionAudit"]
): LeadOpportunity | null {
  if (
    hasMissing(conversion.missing, "whatsapp") &&
    hasPresent(conversion.present, "phone")
  ) {
    return makeOpportunity(
      leadId,
      "conversion_optimization",
      "high",
      ["whatsapp_button absent", "phone number present"],
      "العميل قابل للوصول هاتفياً لكن لا يوجد مسار تحويل رقمي عبر واتساب",
      "إضافة زر واتساب مباشر على الموقع وصفحات السوشيال"
    );
  }
  return null;
}

/**
 * Rule 4: whatsapp_funnel
 * Condition: whatsapp AND online_booking both missing from conversionAudit
 * Commercial meaning: no digital conversion path whatsoever — all leads are lost
 */
function ruleWhatsappFunnel(
  leadId: number,
  conversion: AuditEngineResult["conversionAudit"]
): LeadOpportunity | null {
  if (hasMissing(conversion.missing, "whatsapp", "online_booking")) {
    return makeOpportunity(
      leadId,
      "whatsapp_funnel",
      "high",
      ["whatsapp_button absent", "online_booking absent"],
      "لا يوجد أي مسار تحويل رقمي — العملاء المحتملون يُفقدون بدون قناة تواصل فورية",
      "بناء funnel واتساب مع رابط مباشر وردود تلقائية"
    );
  }
  return null;
}

/**
 * Rule 5: landing_page
 * Condition: website AND google_maps both missing from conversionAudit
 * Commercial meaning: business has no trackable digital presence at all
 */
function ruleLandingPage(
  leadId: number,
  conversion: AuditEngineResult["conversionAudit"]
): LeadOpportunity | null {
  if (hasMissing(conversion.missing, "website", "google_maps")) {
    return makeOpportunity(
      leadId,
      "landing_page",
      "high",
      ["website absent", "google_maps absent"],
      "النشاط التجاري غير موجود رقمياً — لا موقع ولا خريطة قابلة للتتبع",
      "إنشاء landing page أساسية مع تسجيل في Google My Business"
    );
  }
  return null;
}

/**
 * Rule 6: social_optimization
 * Condition: at least 1 platform present AND 4+ platforms missing from socialAudit
 * Commercial meaning: partial presence exists but significant expansion opportunity remains
 * Note: requires existing presence — not triggered for businesses with zero social footprint
 */
function ruleSocialOptimization(
  leadId: number,
  social: AuditEngineResult["socialAudit"]
): LeadOpportunity | null {
  const ALL_PLATFORMS = ["instagram", "twitter", "tiktok", "snapchat", "facebook"];
  const presentCount = countPresent(social.present, ALL_PLATFORMS);
  const missingCount = countMissing(social.missing, ALL_PLATFORMS);

  if (presentCount >= 1 && missingCount >= 4) {
    return makeOpportunity(
      leadId,
      "social_optimization",
      "medium",
      [
        `${presentCount} platform(s) active`,
        `${missingCount} major platform(s) absent`,
      ],
      "النشاط التجاري حاضر على منصة واحدة فقط — فرصة توسع كبيرة في المنصات الأخرى",
      "توسيع الحضور الرقمي على المنصات الغائبة بمحتوى مناسب لكل منصة"
    );
  }
  return null;
}

/**
 * Rule 7: reputation_management
 * Condition: google_maps missing from conversionAudit AND website present in conversionAudit
 * Commercial meaning: business has a website but is not listed on Google Maps — missing local trust signals
 */
function ruleReputationManagement(
  leadId: number,
  conversion: AuditEngineResult["conversionAudit"]
): LeadOpportunity | null {
  if (
    hasMissing(conversion.missing, "google_maps") &&
    hasPresent(conversion.present, "website")
  ) {
    return makeOpportunity(
      leadId,
      "reputation_management",
      "medium",
      ["google_maps absent", "website present"],
      "النشاط التجاري لديه موقع إلكتروني لكنه غير مُدرج على خرائط Google — يفقد ثقة العملاء المحليين",
      "تسجيل النشاط في Google My Business وتفعيل إدارة التقييمات"
    );
  }
  return null;
}

/**
 * Rule 8: paid_tracking
 * Condition: og_tags AND structured_data both missing from seoAudit
 * Commercial meaning: no paid ads infrastructure — cannot run retargeting or structured campaigns
 */
function rulePaidTracking(
  leadId: number,
  seo: AuditEngineResult["seoAudit"]
): LeadOpportunity | null {
  if (hasMissing(seo.missing, "og_tags", "structured_data")) {
    return makeOpportunity(
      leadId,
      "paid_tracking",
      "low",
      ["og_tags absent", "structured_data absent"],
      "لا توجد بنية تحتية للإعلانات المدفوعة — الإعلانات الرقمية ستكون غير فعّالة",
      "إضافة Open Graph tags وبيانات Schema.org لتمكين الإعلانات المستهدفة"
    );
  }
  return null;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * extractOpportunities — pure function
 * Applies all 8 rules to the audit result and returns matched opportunities.
 * Sorted by severity: high → medium → low.
 */
export function extractOpportunities(input: OpportunityEngineInput): LeadOpportunity[] {
  const { auditResult, leadId } = input;
  const { seoAudit, socialAudit, conversionAudit } = auditResult;

  const candidates: Array<LeadOpportunity | null> = [
    ruleLocalSeo(leadId, seoAudit),
    ruleTechnicalSeo(leadId, seoAudit),
    ruleConversionOptimization(leadId, conversionAudit),
    ruleWhatsappFunnel(leadId, conversionAudit),
    ruleLandingPage(leadId, conversionAudit),
    ruleSocialOptimization(leadId, socialAudit),
    ruleReputationManagement(leadId, conversionAudit),
    rulePaidTracking(leadId, seoAudit),
  ];

  const SEVERITY_ORDER: Record<LeadOpportunity["severity"], number> = {
    high: 0,
    medium: 1,
    low: 2,
  };

  return candidates
    .filter((o): o is LeadOpportunity => o !== null)
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
