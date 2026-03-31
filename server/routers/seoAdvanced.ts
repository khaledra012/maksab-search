/**
 * SEO Advanced Router
 * تشغيل تحليل SEO المتقدم وحفظه في قاعدة البيانات
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { runSeoAdvancedAnalysis } from "../lib/seoAdvancedAnalysis";
import { getDb } from "../db";
import { seoAdvancedAnalysis } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

export const seoAdvancedRouter = router({
  // تشغيل تحليل SEO المتقدم
  analyze: protectedProcedure
    .input(z.object({
      leadId: z.number(),
      url: z.string().url(),
      companyName: z.string(),
      businessType: z.string(),
      city: z.string().optional(),
      additionalNotes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });

      try {
        const report = await runSeoAdvancedAnalysis({
          url: input.url,
          companyName: input.companyName,
          businessType: input.businessType,
          city: input.city ?? "",
          additionalNotes: input.additionalNotes,
        });

        // حفظ النتائج في قاعدة البيانات
        await db.insert(seoAdvancedAnalysis).values({
          leadId: input.leadId,
          url: input.url,
          topKeywords: report.topKeywords,
          missingKeywords: report.missingKeywords,
          keywordOpportunities: report.keywordOpportunities,
          estimatedBacklinks: report.estimatedBacklinks,
          backlinkQuality: report.backlinkQuality,
          topReferringDomains: report.topReferringDomains,
          backlinkGaps: report.backlinkGaps,
          competitors: report.competitors,
          competitorGaps: report.competitorGaps,
          competitiveAdvantages: report.competitiveAdvantages,
          searchRankings: report.searchRankings,
          brandMentions: report.brandMentions,
          localSeoScore: report.localSeoScore,
          overallSeoHealth: report.overallSeoHealth,
          seoSummary: report.seoSummary,
          priorityActions: report.priorityActions,
        });

        return { success: true, report };
      } catch (error) {
        console.error("[seoAdvanced.analyze] Error:", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "فشل تحليل SEO المتقدم" });
      }
    }),

  // جلب آخر تحليل SEO لعميل
  getLatest: protectedProcedure
    .input(z.object({ leadId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const rows = await db
        .select()
        .from(seoAdvancedAnalysis)
        .where(eq(seoAdvancedAnalysis.leadId, input.leadId))
        .orderBy(desc(seoAdvancedAnalysis.analyzedAt))
        .limit(1);

      return rows[0] ?? null;
    }),
});
