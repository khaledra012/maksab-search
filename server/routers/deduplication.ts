/**
 * Deduplication & Data Normalization Router
 * روتر تنظيف البيانات واكتشاف التكرار
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { leads } from "../../drizzle/schema";
import { eq, ne } from "drizzle-orm";
import {
  normalizeLeadData,
  findDuplicateCandidates,
  calculateDataQualityScore,
  normalizePhone,
  normalizeDomain,
  normalizeBusinessName,
} from "../lib/dataNormalization";

export const deduplicationRouter = router({
  // ===== فحص ما قبل الحفظ (Pre-Save Review) =====
  // يُستخدم من نافذة المراجعة اليدوية قبل إضافة عميل جديد
  preSaveCheck: protectedProcedure
    .input(z.object({
      companyName: z.string().min(1),
      verifiedPhone: z.string().optional(),
      website: z.string().optional(),
      businessType: z.string().optional(),
      city: z.string().optional(),
      instagramUrl: z.string().optional(),
      twitterUrl: z.string().optional(),
      snapchatUrl: z.string().optional(),
      tiktokUrl: z.string().optional(),
      facebookUrl: z.string().optional(),
      googleMapsUrl: z.string().optional(),
      reviewCount: z.number().optional(),
      notes: z.string().optional(),
      threshold: z.number().default(55),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // حساب البيانات المُطبَّعة
      const normalized = normalizeLeadData({
        companyName: input.companyName,
        verifiedPhone: input.verifiedPhone,
        website: input.website,
        businessType: input.businessType,
      });

      // حساب درجة جودة البيانات
      const qualityScore = calculateDataQualityScore({
        companyName: input.companyName,
        verifiedPhone: input.verifiedPhone,
        website: input.website,
        city: input.city,
        businessType: input.businessType,
        instagramUrl: input.instagramUrl,
        twitterUrl: input.twitterUrl,
        snapchatUrl: input.snapchatUrl,
        tiktokUrl: input.tiktokUrl,
        facebookUrl: input.facebookUrl,
        googleMapsUrl: input.googleMapsUrl,
        reviewCount: input.reviewCount,
        notes: input.notes,
      });

      // جلب العملاء الموجودين للمقارنة
      const candidates = await db.select({
        id: leads.id,
        companyName: leads.companyName,
        normalizedBusinessName: leads.normalizedBusinessName,
        normalizedPhone: leads.normalizedPhone,
        normalizedDomain: leads.normalizedDomain,
        city: leads.city,
        businessType: leads.businessType,
        verifiedPhone: leads.verifiedPhone,
        website: leads.website,
        instagramUrl: leads.instagramUrl,
      }).from(leads).limit(1000);

      // البحث عن التكرارات
      const duplicates = findDuplicateCandidates(
        {
          id: -1, // مؤقت
          companyName: input.companyName,
          normalizedBusinessName: normalized.normalizedBusinessName,
          normalizedPhone: normalized.normalizedPhone,
          normalizedDomain: normalized.normalizedDomain,
          city: input.city,
        },
        candidates,
        input.threshold
      );

      // جلب تفاصيل العملاء المكررين
      const duplicateDetails = await Promise.all(
        duplicates.slice(0, 5).map(async (dup) => {
          const [existing] = await db.select({
            id: leads.id,
            companyName: leads.companyName,
            city: leads.city,
            businessType: leads.businessType,
            verifiedPhone: leads.verifiedPhone,
            website: leads.website,
            instagramUrl: leads.instagramUrl,
            dataQualityScore: leads.dataQualityScore,
          }).from(leads).where(eq(leads.id, dup.candidateId));
          return {
            ...dup,
            existing: existing || null,
          };
        })
      );

      // تحديد مستوى الخطر
      const topScore = duplicates[0]?.confidenceScore ?? 0;
      const riskLevel = topScore >= 85 ? "high" : topScore >= 60 ? "medium" : "low";

      return {
        qualityScore,
        normalized,
        duplicates: duplicateDetails,
        riskLevel,
        hasDuplicates: duplicates.length > 0,
        suggestions: buildSuggestions(qualityScore, duplicates.length, input),
      };
    }),

  // تطبيع بيانات عميل واحد وحفظها
  normalizeLead: protectedProcedure
    .input(z.object({ leadId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [lead] = await db.select().from(leads).where(eq(leads.id, input.leadId));
      if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "العميل غير موجود" });

      const normalized = normalizeLeadData({
        companyName: lead.companyName,
        verifiedPhone: lead.verifiedPhone,
        website: lead.website,
        businessType: lead.businessType,
      });

      const qualityScore = calculateDataQualityScore({
        companyName: lead.companyName,
        verifiedPhone: lead.verifiedPhone,
        website: lead.website,
        city: lead.city,
        businessType: lead.businessType,
        instagramUrl: lead.instagramUrl,
        twitterUrl: lead.twitterUrl,
        snapchatUrl: lead.snapchatUrl,
        tiktokUrl: lead.tiktokUrl,
        facebookUrl: lead.facebookUrl,
        googleMapsUrl: lead.googleMapsUrl,
        reviewCount: lead.reviewCount,
        notes: lead.notes,
      });

      await db.update(leads)
        .set({
          normalizedBusinessName: normalized.normalizedBusinessName,
          normalizedPhone: normalized.normalizedPhone,
          normalizedDomain: normalized.normalizedDomain,
          sectorMain: normalized.sectorMain,
          dataQualityScore: qualityScore,
        })
        .where(eq(leads.id, input.leadId));

      return { success: true, normalized, qualityScore };
    }),

  // اكتشاف التكرار لعميل واحد
  findDuplicates: protectedProcedure
    .input(z.object({
      leadId: z.number(),
      threshold: z.number().default(60),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [lead] = await db.select({
        id: leads.id,
        companyName: leads.companyName,
        normalizedBusinessName: leads.normalizedBusinessName,
        normalizedPhone: leads.normalizedPhone,
        normalizedDomain: leads.normalizedDomain,
        city: leads.city,
      }).from(leads).where(eq(leads.id, input.leadId));

      if (!lead) throw new TRPCError({ code: "NOT_FOUND" });

      const candidates = await db.select({
        id: leads.id,
        companyName: leads.companyName,
        normalizedBusinessName: leads.normalizedBusinessName,
        normalizedPhone: leads.normalizedPhone,
        normalizedDomain: leads.normalizedDomain,
        city: leads.city,
      }).from(leads)
        .where(ne(leads.id, input.leadId))
        .limit(500);

      const duplicates = findDuplicateCandidates(lead, candidates, input.threshold);

      if (duplicates.length > 0) {
        const topDuplicate = duplicates[0];
        await db.update(leads)
          .set({
            deduplicationStatus: topDuplicate.confidenceScore >= 85 ? "confirmed_duplicate" : "possible_duplicate",
            duplicateConfidenceScore: topDuplicate.confidenceScore,
            duplicateCandidateIds: duplicates.map(d => d.candidateId),
          })
          .where(eq(leads.id, input.leadId));
      } else {
        await db.update(leads)
          .set({
            deduplicationStatus: "no_duplicate",
            duplicateConfidenceScore: 0,
            duplicateCandidateIds: [],
          })
          .where(eq(leads.id, input.leadId));
      }

      return { duplicates, total: duplicates.length };
    }),

  // اكتشاف التكرار لجميع العملاء (bulk scan)
  runBulkDeduplication: protectedProcedure
    .input(z.object({ threshold: z.number().default(60) }).optional())
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const allLeads = await db.select({
        id: leads.id,
        companyName: leads.companyName,
        normalizedBusinessName: leads.normalizedBusinessName,
        normalizedPhone: leads.normalizedPhone,
        normalizedDomain: leads.normalizedDomain,
        city: leads.city,
      }).from(leads).limit(1000);

      const threshold = input?.threshold ?? 60;
      let duplicatesFound = 0;

      for (const lead of allLeads) {
        const others = allLeads.filter(l => l.id !== lead.id);
        const dupes = findDuplicateCandidates(lead, others, threshold);
        if (dupes.length > 0) {
          const top = dupes[0];
          await db.update(leads)
            .set({
              deduplicationStatus: top.confidenceScore >= 85 ? "confirmed_duplicate" : "possible_duplicate",
              duplicateConfidenceScore: top.confidenceScore,
              duplicateCandidateIds: dupes.map(d => d.candidateId),
            })
            .where(eq(leads.id, lead.id));
          duplicatesFound++;
        } else {
          await db.update(leads)
            .set({ deduplicationStatus: "no_duplicate" })
            .where(eq(leads.id, lead.id));
        }
      }

      return { success: true, total: allLeads.length, duplicatesFound };
    }),

  // تأكيد الدمج يدوياً
  confirmMerge: protectedProcedure
    .input(z.object({
      sourceLeadId: z.number(),
      targetLeadId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.update(leads)
        .set({ deduplicationStatus: "merged_manually" })
        .where(eq(leads.id, input.sourceLeadId));

      return { success: true };
    }),

  // إحصائيات جودة البيانات
  getQualityStats: protectedProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return {
        total: 0, highQuality: 0, mediumQuality: 0, lowQuality: 0,
        duplicates: 0, unchecked: 0, avgScore: 0,
      };

      const allLeads = await db.select({
        dataQualityScore: leads.dataQualityScore,
        deduplicationStatus: leads.deduplicationStatus,
      }).from(leads);

      const total = allLeads.length;
      const highQuality = allLeads.filter(l => (l.dataQualityScore ?? 0) >= 70).length;
      const mediumQuality = allLeads.filter(l => (l.dataQualityScore ?? 0) >= 40 && (l.dataQualityScore ?? 0) < 70).length;
      const lowQuality = allLeads.filter(l => (l.dataQualityScore ?? 0) < 40).length;
      const duplicates = allLeads.filter(l => l.deduplicationStatus === "possible_duplicate" || l.deduplicationStatus === "confirmed_duplicate").length;
      const unchecked = allLeads.filter(l => l.deduplicationStatus === "unchecked").length;
      const avgScore = total > 0
        ? Math.round(allLeads.reduce((s, l) => s + (l.dataQualityScore ?? 0), 0) / total)
        : 0;

      return { total, highQuality, mediumQuality, lowQuality, duplicates, unchecked, avgScore };
    }),
});

// ===== Helper Functions =====
function buildSuggestions(
  qualityScore: number,
  duplicateCount: number,
  input: { verifiedPhone?: string; website?: string; instagramUrl?: string; city?: string }
): string[] {
  const suggestions: string[] = [];
  if (!input.verifiedPhone) suggestions.push("أضف رقم الهاتف لرفع جودة البيانات (+25 نقطة)");
  if (!input.website && !input.instagramUrl) suggestions.push("أضف موقع إلكتروني أو حساب سوشيال ميديا (+15 نقطة)");
  if (!input.city) suggestions.push("حدد المدينة لتحسين دقة البحث (+10 نقطة)");
  if (duplicateCount > 0) suggestions.push(`تحقق من ${duplicateCount} عميل مشابه قبل الحفظ لتجنب التكرار`);
  if (qualityScore < 40) suggestions.push("جودة البيانات منخفضة — أضف معلومات إضافية لتحسين التحليل");
  return suggestions;
}
