/**
 * Sector Analysis Router - روتر التحليل القطاعي
 * يستخدم محرك التحليل القطاعي مع Dynamic Prompts
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { leads } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import {
  buildSectorAnalysisPrompt,
  parseSectorAnalysisResponse,
  detectSectorFromBusinessType,
  type Sector,
  type AnalysisLanguageMode,
} from "../lib/sectorAnalysisEngine";

const SectorSchema = z.enum(["restaurants", "medical", "ecommerce", "digital_products", "general"]);
const LanguageModeSchema = z.enum(["msa_formal", "saudi_sales_tone", "arabic_sales_brief"]);

// Helper to extract string content from LLM response
function extractContent(content: string | any[]): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const textItem = content.find((c: any) => c.type === "text");
    return textItem?.text || "";
  }
  return "";
}

export const sectorAnalysisRouter = router({
  // تحليل عميل واحد بالقطاع المحدد
  analyzeByLead: protectedProcedure
    .input(z.object({
      leadId: z.number(),
      languageMode: LanguageModeSchema.default("saudi_sales_tone"),
      forceResector: SectorSchema.optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [lead] = await db.select().from(leads).where(eq(leads.id, input.leadId));
      if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "العميل غير موجود" });

      const sector: Sector = input.forceResector
        || (lead.sectorMain as Sector | null)
        || detectSectorFromBusinessType(lead.businessType);

      const prompt = buildSectorAnalysisPrompt({
        companyName: lead.companyName,
        businessType: lead.businessType,
        city: lead.city,
        sector,
        languageMode: input.languageMode as AnalysisLanguageMode,
        hasWebsite: !!lead.website,
        hasInstagram: !!lead.instagramUrl,
        hasTwitter: !!lead.twitterUrl,
        hasSnapchat: !!lead.snapchatUrl,
        hasTiktok: !!lead.tiktokUrl,
        hasFacebook: !!lead.facebookUrl,
        hasGoogleMaps: !!lead.googleMapsUrl,
        reviewCount: lead.reviewCount,
        notes: lead.notes,
      });

      await db.update(leads)
        .set({ analysisStatus: "analyzing" as const })
        .where(eq(leads.id, input.leadId));

      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "أنت محلل تسويق رقمي استراتيجي. أجب بـ JSON فقط دون أي نص إضافي." },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" } as any,
        });

        const rawContent = extractContent(response.choices[0]?.message?.content || "");
        const analysis = parseSectorAnalysisResponse(rawContent);

        if (!analysis) {
          await db.update(leads)
            .set({ analysisStatus: "failed" as const })
            .where(eq(leads.id, input.leadId));
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "فشل تحليل الاستجابة" });
        }

        await db.update(leads)
          .set({
            sectorMain: sector,
            analysisStatus: "completed" as const,
            analysisLanguageMode: input.languageMode,
            leadPriorityScore: analysis.leadPriorityScore,
            aiConfidenceScore: analysis.confidenceScore,
            lastAnalyzedAt: Date.now(),
            marketingGapSummary: analysis.marketingGapSummary,
            competitivePosition: analysis.competitivePosition,
            primaryOpportunity: analysis.primaryOpportunity,
            secondaryOpportunity: analysis.secondaryOpportunity,
            urgencyLevel: analysis.urgencyLevel as "high" | "medium" | "low",
            recommendedServices: analysis.recommendedServices,
            salesEntryAngle: analysis.salesEntryAngle,
            iceBreaker: analysis.iceBreaker,
            sectorInsights: analysis.sectorInsights,
            benchmarkComparison: analysis.benchmarkComparison,
            marketingOpportunitiesSummary: analysis.marketingOpportunitiesSummary,
            growthDevelopmentPlan: analysis.growthDevelopmentPlan,
          })
          .where(eq(leads.id, input.leadId));

        return { success: true, leadId: input.leadId, sector, analysis };
      } catch (err) {
        await db.update(leads)
          .set({ analysisStatus: "failed" as const })
          .where(eq(leads.id, input.leadId));
        throw err;
      }
    }),

  // تحليل سريع بدون حفظ (للمعاينة)
  previewAnalysis: protectedProcedure
    .input(z.object({
      companyName: z.string().min(1),
      businessType: z.string().optional(),
      city: z.string().optional(),
      sector: SectorSchema.optional(),
      languageMode: LanguageModeSchema.default("saudi_sales_tone"),
      hasWebsite: z.boolean().optional(),
      hasInstagram: z.boolean().optional(),
      hasTwitter: z.boolean().optional(),
      hasSnapchat: z.boolean().optional(),
      hasTiktok: z.boolean().optional(),
      hasFacebook: z.boolean().optional(),
      hasGoogleMaps: z.boolean().optional(),
      reviewCount: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const sector: Sector = input.sector
        || detectSectorFromBusinessType(input.businessType);

      const prompt = buildSectorAnalysisPrompt({
        ...input,
        sector,
        languageMode: input.languageMode as AnalysisLanguageMode,
      });

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "أنت محلل تسويق رقمي استراتيجي. أجب بـ JSON فقط." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" } as any,
      });

      const rawContent = extractContent(response.choices[0]?.message?.content || "");
      const analysis = parseSectorAnalysisResponse(rawContent);

      if (!analysis) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "فشل التحليل" });
      }

      return { sector, analysis };
    }),

  // إعادة التحليل بوضع لغوي مختلف
  reanalyzeWithMode: protectedProcedure
    .input(z.object({
      leadId: z.number(),
      languageMode: LanguageModeSchema,
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [lead] = await db.select().from(leads).where(eq(leads.id, input.leadId));
      if (!lead) throw new TRPCError({ code: "NOT_FOUND" });

      const sector: Sector = (lead.sectorMain as Sector | null)
        || detectSectorFromBusinessType(lead.businessType);

      const prompt = buildSectorAnalysisPrompt({
        companyName: lead.companyName,
        businessType: lead.businessType,
        city: lead.city,
        sector,
        languageMode: input.languageMode as AnalysisLanguageMode,
        hasWebsite: !!lead.website,
        hasInstagram: !!lead.instagramUrl,
        hasTwitter: !!lead.twitterUrl,
        hasSnapchat: !!lead.snapchatUrl,
        hasTiktok: !!lead.tiktokUrl,
        hasFacebook: !!lead.facebookUrl,
        hasGoogleMaps: !!lead.googleMapsUrl,
        reviewCount: lead.reviewCount,
        notes: lead.notes,
      });

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "أنت محلل تسويق رقمي. أجب بـ JSON فقط." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" } as any,
      });

      const rawContent = extractContent(response.choices[0]?.message?.content || "");
      const analysis = parseSectorAnalysisResponse(rawContent);

      if (!analysis) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.update(leads)
        .set({
          analysisLanguageMode: input.languageMode,
          leadPriorityScore: analysis.leadPriorityScore,
          aiConfidenceScore: analysis.confidenceScore,
          lastAnalyzedAt: Date.now(),
          marketingGapSummary: analysis.marketingGapSummary,
          competitivePosition: analysis.competitivePosition,
          primaryOpportunity: analysis.primaryOpportunity,
          secondaryOpportunity: analysis.secondaryOpportunity,
          urgencyLevel: analysis.urgencyLevel as "high" | "medium" | "low",
          recommendedServices: analysis.recommendedServices,
          salesEntryAngle: analysis.salesEntryAngle,
          iceBreaker: analysis.iceBreaker,
          sectorInsights: analysis.sectorInsights,
          benchmarkComparison: analysis.benchmarkComparison,
          marketingOpportunitiesSummary: analysis.marketingOpportunitiesSummary,
          growthDevelopmentPlan: analysis.growthDevelopmentPlan,
        })
        .where(eq(leads.id, input.leadId));

      return { success: true, analysis, languageMode: input.languageMode };
    }),

  // جلب نتائج التحليل لعميل
  getAnalysis: protectedProcedure
    .input(z.object({ leadId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const [lead] = await db.select({
        id: leads.id,
        sectorMain: leads.sectorMain,
        analysisStatus: leads.analysisStatus,
        analysisLanguageMode: leads.analysisLanguageMode,
        marketingGapSummary: leads.marketingGapSummary,
        competitivePosition: leads.competitivePosition,
        primaryOpportunity: leads.primaryOpportunity,
        secondaryOpportunity: leads.secondaryOpportunity,
        urgencyLevel: leads.urgencyLevel,
        recommendedServices: leads.recommendedServices,
        salesEntryAngle: leads.salesEntryAngle,
        iceBreaker: leads.iceBreaker,
        sectorInsights: leads.sectorInsights,
        benchmarkComparison: leads.benchmarkComparison,
        marketingOpportunitiesSummary: leads.marketingOpportunitiesSummary,
        growthDevelopmentPlan: leads.growthDevelopmentPlan,
        leadPriorityScore: leads.leadPriorityScore,
        aiConfidenceScore: leads.aiConfidenceScore,
        lastAnalyzedAt: leads.lastAnalyzedAt,
      }).from(leads).where(eq(leads.id, input.leadId));

      return lead || null;
    }),
});
