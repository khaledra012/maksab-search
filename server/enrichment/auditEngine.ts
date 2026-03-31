/**
 * PHASE 4 — Audit Engine
 * يقرأ من DB بعد اكتمال enrichment وينتج audit objects منظمة.
 * بدون AI، بدون scoring — فقط { present[], missing[], confidence }.
 */
import { getDb } from "../db";
import { websiteAnalyses, socialAnalyses, leads } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuditSignal = {
  present: string[];
  missing: string[];
  confidence: "high" | "medium" | "low";
};

export type AuditEngineResult = {
  seoAudit: AuditSignal;
  socialAudit: AuditSignal;
  conversionAudit: AuditSignal;
  marketAudit: AuditSignal;
};

// ─── Pure compute types (for testing and direct use) ─────────────────────────

export type SeoAuditInput = {
  title: string | null;
  metaDescription: string | null;
  h1Tags: string[];
  canonicalUrl: string | null;
  robotsTxt: boolean;
  sitemapXml: boolean;
  structuredData: boolean;
  mobileOptimized: boolean;
  pageSpeedScore: number | null;
  httpsEnabled: boolean;
};

export type SocialAuditInput = {
  instagramUrl: string | null;
  twitterUrl: string | null;
  tiktokUrl: string | null;
  snapchatUrl: string | null;
  facebookUrl: string | null;
  linkedinUrl: string | null;
  instagramFollowers: number | null;
  tiktokFollowers: number | null;
};

export type ConversionAuditInput = {
  verifiedPhone: string | null;
  website: string | null;
  googleMapsUrl: string | null;
  hasWhatsapp: string | null;
};

export type MarketAuditInput = {
  city: string | null;
  district: string | null;
  businessType: string | null;
  country: string | null;
};

export type PureAuditSignal = {
  present: string[];
  missing: string[];
  confidence: number; // 0..1
};

/**
 * computeSeoAudit — pure function for deterministic SEO audit
 * Takes structured input, returns { present[], missing[], confidence: 0..1 }
 */
export function computeSeoAudit(input: SeoAuditInput): PureAuditSignal {
  const present: string[] = [];
  const missing: string[] = [];
  const total = 10;

  input.title ? present.push("title") : missing.push("title");
  input.metaDescription ? present.push("meta_description") : missing.push("meta_description");
  input.h1Tags.length > 0 ? present.push("h1_heading") : missing.push("h1_heading");
  input.canonicalUrl ? present.push("canonical_url") : missing.push("canonical_url");
  input.robotsTxt ? present.push("robots_txt") : missing.push("robots_txt");
  input.sitemapXml ? present.push("sitemap_xml") : missing.push("sitemap_xml");
  input.structuredData ? present.push("structured_data") : missing.push("structured_data");
  input.mobileOptimized ? present.push("mobile_optimized") : missing.push("mobile_optimized");
  input.pageSpeedScore !== null ? present.push("pagespeed_score") : missing.push("pagespeed_score");
  input.httpsEnabled ? present.push("https_enabled") : missing.push("https_enabled");

  return { present, missing, confidence: present.length / total };
}

/**
 * computeSocialAudit — pure function for deterministic social audit
 */
export function computeSocialAudit(input: SocialAuditInput): PureAuditSignal {
  const present: string[] = [];
  const missing: string[] = [];
  const platforms = [
    { key: "instagram", url: input.instagramUrl },
    { key: "twitter", url: input.twitterUrl },
    { key: "tiktok", url: input.tiktokUrl },
    { key: "snapchat", url: input.snapchatUrl },
    { key: "facebook", url: input.facebookUrl },
    { key: "linkedin", url: input.linkedinUrl },
  ];
  const total = platforms.length;

  for (const p of platforms) {
    p.url ? present.push(p.key) : missing.push(p.key);
  }

  return { present, missing, confidence: present.length / total };
}

/**
 * computeConversionAudit — pure function for deterministic conversion audit
 */
export function computeConversionAudit(input: ConversionAuditInput): PureAuditSignal {
  const present: string[] = [];
  const missing: string[] = [];
  const total = 4;

  input.verifiedPhone ? present.push("phone") : missing.push("phone");
  input.website ? present.push("website") : missing.push("website");
  input.googleMapsUrl ? present.push("google_maps") : missing.push("google_maps");
  input.hasWhatsapp === "yes" ? present.push("whatsapp") : missing.push("whatsapp");

  return { present, missing, confidence: present.length / total };
}

/**
 * computeMarketAudit — pure function for deterministic market audit
 */
export function computeMarketAudit(input: MarketAuditInput): PureAuditSignal {
  const present: string[] = [];
  const missing: string[] = [];
  const total = 4;

  input.city ? present.push("city") : missing.push("city");
  input.district ? present.push("district") : missing.push("district");
  input.businessType ? present.push("businessType") : missing.push("businessType");
  input.country ? present.push("country") : missing.push("country");

  return { present, missing, confidence: present.length / total };
}

// ─── SEO Audit (DB-based) ─────────────────────────────────────────────────────

function buildSeoAudit(wa: Record<string, unknown> | null): AuditSignal {
  if (!wa) {
    // عند عدم وجود موقع — كل مفاتيح SEO مفقودة (rules 1,2,8 تحتاج هذه المفاتيح)
    return {
      present: [],
      missing: ["title_tag", "meta_description", "canonical_url", "sitemap_xml", "og_tags", "structured_data", "robots_meta", "h1_heading", "ssl_certificate"],
      confidence: "low",
    };
  }

  const raw = wa.rawAnalysis ? JSON.parse(wa.rawAnalysis as string) : {};
  const seo = raw.seo ?? {};

  const present: string[] = [];
  const missing: string[] = [];

  // Title
  seo.title ? present.push("title_tag") : missing.push("title_tag");
  // Meta description
  seo.metaDescription ? present.push("meta_description") : missing.push("meta_description");
  // Canonical
  seo.canonicalUrl ? present.push("canonical_url") : missing.push("canonical_url");
  // Robots meta
  seo.robotsMeta ? present.push("robots_meta") : missing.push("robots_meta");
  // H1
  seo.h1Tags?.length > 0 ? present.push("h1_heading") : missing.push("h1_heading");
  // SSL
  seo.hasSSL ? present.push("ssl_certificate") : missing.push("ssl_certificate");
  // OG tags
  seo.ogTitle ? present.push("og_tags") : missing.push("og_tags");

  const confidence: AuditSignal["confidence"] =
    present.length + missing.length >= 5 ? "high" : "medium";

  return { present, missing, confidence };
}

// ─── Social Audit ─────────────────────────────────────────────────────────────

function buildSocialAudit(
  socialRows: Array<{ platform: string; hasAccount: boolean | null; followersCount: number | null; engagementRate: number | null }>
): AuditSignal {
  const allPlatforms = ["instagram", "twitter", "tiktok", "snapchat", "facebook"];
  const present: string[] = [];
  const missing: string[] = [];

  const foundPlatforms = new Set(socialRows.filter(r => r.hasAccount).map(r => r.platform));

  for (const p of allPlatforms) {
    foundPlatforms.has(p) ? present.push(p) : missing.push(p);
  }

  // إضافة engagement signals
  const igRow = socialRows.find(r => r.platform === "instagram");
  if (igRow?.engagementRate && igRow.engagementRate > 1) {
    present.push("instagram_engagement_above_1pct");
  }

  const confidence: AuditSignal["confidence"] =
    socialRows.length >= 2 ? "high" : socialRows.length === 1 ? "medium" : "low";

  return { present, missing, confidence };
}

// ─── Conversion Audit ─────────────────────────────────────────────────────────

function buildConversionAudit(wa: Record<string, unknown> | null, lead: Record<string, unknown>): AuditSignal {
  const present: string[] = [];
  const missing: string[] = [];

  // ── Lead-level signals — keys must match opportunityEngine rule lookups ────────────────
  (lead.verifiedPhone as string | null) ? present.push("phone") : missing.push("phone");
  (lead.website as string | null) ? present.push("website") : missing.push("website");
  (lead.googleMapsUrl as string | null) ? present.push("google_maps") : missing.push("google_maps");
  (lead.hasWhatsapp as string | null) === "yes" ? present.push("whatsapp") : missing.push("whatsapp");

  // ── Website-level signals (only when website analysis exists) ──────────────────
  if (wa) {
    const raw = wa.rawAnalysis ? JSON.parse(wa.rawAnalysis as string) : {};
    const seo = raw.seo ?? {};
    seo.hasBooking ? present.push("online_booking") : missing.push("online_booking");
    seo.hasEcommerce ? present.push("ecommerce_payment") : missing.push("ecommerce_payment");
    seo.hasSSL ? present.push("ssl_secure") : missing.push("ssl_secure");
  } else {
    missing.push("online_booking", "ecommerce_payment", "ssl_secure");
  }

  const confidence: AuditSignal["confidence"] = wa ? "high" : "low";

  return { present, missing, confidence };
}

// ─── Market Audit ─────────────────────────────────────────────────────────────

function buildMarketAudit(
  lead: Record<string, unknown>,
  socialCount: number
): AuditSignal {
  const present: string[] = [];
  const missing: string[] = [];

  lead.city ? present.push("city_known") : missing.push("city_known");
  lead.businessType ? present.push("business_type_known") : missing.push("business_type_known");
  lead.socialSince ? present.push("social_since_known") : missing.push("social_since_known");
  lead.website ? present.push("website_present") : missing.push("website_present");

  if (socialCount >= 3) present.push("multi_platform_presence");
  else if (socialCount >= 1) present.push("single_platform_presence");
  else missing.push("social_presence");

  const confidence: AuditSignal["confidence"] =
    present.length >= 3 ? "high" : present.length >= 1 ? "medium" : "low";

  return { present, missing, confidence };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function runAuditEngine(leadId: number): Promise<AuditEngineResult> {
  const db = await getDb();
  if (!db) {
    const empty: AuditSignal = { present: [], missing: [], confidence: "low" };
    return { seoAudit: empty, socialAudit: empty, conversionAudit: empty, marketAudit: empty };
  }

  // قراءة من DB بعد اكتمال enrichment (ليس من الذاكرة)
  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);

  const [latestWebsite] = await db
    .select()
    .from(websiteAnalyses)
    .where(eq(websiteAnalyses.leadId, leadId))
    .orderBy(desc(websiteAnalyses.analyzedAt))
    .limit(1);

  const socialRows = await db
    .select({
      platform: socialAnalyses.platform,
      hasAccount: socialAnalyses.hasAccount,
      followersCount: socialAnalyses.followersCount,
      engagementRate: socialAnalyses.engagementRate,
    })
    .from(socialAnalyses)
    .where(eq(socialAnalyses.leadId, leadId));

  const wa = latestWebsite as Record<string, unknown> | undefined ?? null;
  const leadRecord = lead as Record<string, unknown> | undefined ?? {};

  return {
    seoAudit: buildSeoAudit(wa),
    socialAudit: buildSocialAudit(socialRows),
    conversionAudit: buildConversionAudit(wa, leadRecord),
    marketAudit: buildMarketAudit(leadRecord, socialRows.length),
  };
}
