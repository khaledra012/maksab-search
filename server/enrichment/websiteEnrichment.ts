/**
 * PHASE 4 — Website Enrichment
 * Wrapper خفيف حول gatherWebsiteIntelligence() يُخزّن النتيجة في websiteAnalyses.
 * لا يكتب في جدول leads مباشرة — يكتب في websiteAnalyses فقط.
 */
import { getDb } from "../db";
import { websiteAnalyses } from "../../drizzle/schema";
import type { Lead } from "../../drizzle/schema";
import {
  gatherWebsiteIntelligence,
  type WebsiteIntelligenceReport,
} from "../lib/websiteIntelligence";

export type WebsiteEnrichmentResult =
  | { success: true; websiteAnalysisId: number; report: WebsiteIntelligenceReport }
  | { success: false; reason: string };

export async function runWebsiteEnrichment(
  lead: Lead
): Promise<WebsiteEnrichmentResult> {
  if (!lead.website) {
    return { success: false, reason: "no_website_field" };
  }

  const db = await getDb();
  if (!db) {
    return { success: false, reason: "db_unavailable" };
  }

  let report: WebsiteIntelligenceReport;
  try {
    report = await gatherWebsiteIntelligence(lead.website);
  } catch (err) {
    return {
      success: false,
      reason: `website_intelligence_failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // حفظ النتيجة في websiteAnalyses
  const seo = report.seo;
  const ps = report.pagespeed;

  const [inserted] = await db.insert(websiteAnalyses).values({
    leadId: lead.id,
    url: lead.website,
    hasWebsite: true,
    loadSpeedScore: ps.performanceScore ?? undefined,
    mobileExperienceScore: ps.mobilePerformanceScore ?? undefined,
    seoScore: ps.seoScore ?? undefined,
    hasOnlineBooking: seo.hasBooking,
    hasPaymentOptions: seo.hasEcommerce,
    technicalGaps: [],
    contentGaps: [],
    rawAnalysis: JSON.stringify({ seo, pagespeed: ps }),
    analyzedAt: new Date(),
  });

  // استرجاع الـ id المُدرَج
  const [row] = await db
    .select({ id: websiteAnalyses.id })
    .from(websiteAnalyses)
    .orderBy(websiteAnalyses.id)
    .limit(1)
    .offset(0);

  // نستخدم insertId من الـ result مباشرة
  const insertId = (inserted as unknown as { insertId?: number })?.insertId ?? 0;

  return { success: true, websiteAnalysisId: insertId, report };
}
