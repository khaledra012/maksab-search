/**
 * Auto Search Router — واجهة tRPC لمحرك البحث التلقائي المتدرج
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  createSearchSession,
  runAutoSearchSession,
  stopSearchSession,
  pauseSearchSession,
  getSearchSession,
  getLeadSessions,
  computeDataCompleteness,
  getMissingFieldsByPriority,
  type SearchFieldType,
} from "../lib/autoSearchEngine";
import { getLeadById, updateLead } from "../db";

export const autoSearchRouter = router({
  // ===== إنشاء جلسة بحث جديدة وتشغيلها =====
  start: protectedProcedure
    .input(z.object({
      leadId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const lead = await getLeadById(input.leadId);
      if (!lead) {
        throw new TRPCError({ code: "NOT_FOUND", message: "العميل غير موجود" });
      }

      // التحقق من وجود البيانات الأساسية
      if (!lead.companyName || !lead.city || !lead.businessType) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "يجب توفر اسم النشاط والمدينة ونوع النشاط قبل البحث التلقائي",
        });
      }

      // إنشاء الجلسة
      const session = createSearchSession({
        id: lead.id,
        companyName: lead.companyName,
        city: lead.city,
        businessType: lead.businessType,
        verifiedPhone: lead.verifiedPhone,
        website: lead.website,
        googleMapsUrl: lead.googleMapsUrl,
        instagramUrl: lead.instagramUrl,
        tiktokUrl: lead.tiktokUrl,
        snapchatUrl: (lead as any).snapchatUrl,
        facebookUrl: (lead as any).facebookUrl,
        twitterUrl: lead.twitterUrl,
      });

      // تشغيل الجلسة في الخلفية (non-blocking)
      runAutoSearchSession(session.sessionId).catch(err => {
        console.error(`[AutoSearch] Session ${session.sessionId} failed:`, err);
      });

      return {
        sessionId: session.sessionId,
        totalSteps: session.totalSteps,
        missingFields: session.steps.map(s => s.field).filter((v, i, a) => a.indexOf(v) === i),
        message: `بدأ البحث التلقائي — ${session.totalSteps} خطوة لـ ${session.steps.map(s => s.field).filter((v, i, a) => a.indexOf(v) === i).length} حقل مفقود`,
      };
    }),

  // ===== جلب حالة الجلسة (polling) =====
  getStatus: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
    }))
    .query(async ({ input }) => {
      const session = getSearchSession(input.sessionId);
      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "الجلسة غير موجودة" });
      }
      return session;
    }),

  // ===== جلب جميع جلسات عميل =====
  getLeadSessions: protectedProcedure
    .input(z.object({
      leadId: z.number(),
    }))
    .query(async ({ input }) => {
      return getLeadSessions(input.leadId);
    }),

  // ===== إيقاف الجلسة =====
  stop: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
    }))
    .mutation(async ({ input }) => {
      const stopped = stopSearchSession(input.sessionId);
      return { success: stopped };
    }),

  // ===== إيقاف مؤقت =====
  pause: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
    }))
    .mutation(async ({ input }) => {
      const paused = pauseSearchSession(input.sessionId);
      return { success: paused };
    }),

  // ===== تطبيق مرشح (حفظ قيمة في بيانات العميل) =====
  applyCandidate: protectedProcedure
    .input(z.object({
      leadId: z.number(),
      sessionId: z.string(),
      field: z.enum([
        "phone", "website", "googleMapsUrl", "instagramUrl",
        "tiktokUrl", "snapchatUrl", "facebookUrl", "twitterUrl", "linkedinUrl"
      ]),
      value: z.string(),
    }))
    .mutation(async ({ input }) => {
      const lead = await getLeadById(input.leadId);
      if (!lead) {
        throw new TRPCError({ code: "NOT_FOUND", message: "العميل غير موجود" });
      }

      // تحديث الحقل المناسب
      const updateData: Record<string, string> = {};
      if (input.field === "phone") {
        updateData.verifiedPhone = input.value;
      } else {
        updateData[input.field] = input.value;
      }

      await updateLead(input.leadId, updateData);

      // تحديث الجلسة
      const session = getSearchSession(input.sessionId);
      if (session && !session.appliedFields.includes(input.field as SearchFieldType)) {
        session.appliedFields.push(input.field as SearchFieldType);
      }

      return { success: true, field: input.field, value: input.value };
    }),

  // ===== رفض مرشح (تجاهله) =====
  rejectCandidate: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
      field: z.string(),
      value: z.string(),
    }))
    .mutation(async ({ input }) => {
      const session = getSearchSession(input.sessionId);
      if (!session) return { success: false };

      // إزالة المرشح من القائمة
      const idx = session.candidates.findIndex(
        c => c.field === input.field && c.value === input.value
      );
      if (idx !== -1) {
        session.candidates.splice(idx, 1);
      }

      return { success: true };
    }),

  // ===== حساب اكتمال بيانات عميل =====
  getDataCompleteness: protectedProcedure
    .input(z.object({ leadId: z.number() }))
    .query(async ({ input }) => {
      const lead = await getLeadById(input.leadId);
      if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "العميل غير موجود" });

      const completeness = computeDataCompleteness({
        verifiedPhone: lead.verifiedPhone,
        website: lead.website,
        googleMapsUrl: lead.googleMapsUrl,
        instagramUrl: lead.instagramUrl,
        tiktokUrl: lead.tiktokUrl,
        snapchatUrl: (lead as any).snapchatUrl,
        facebookUrl: (lead as any).facebookUrl,
        twitterUrl: lead.twitterUrl,
      });

      const missingFields = getMissingFieldsByPriority({
        verifiedPhone: lead.verifiedPhone,
        website: lead.website,
        googleMapsUrl: lead.googleMapsUrl,
        instagramUrl: lead.instagramUrl,
        tiktokUrl: lead.tiktokUrl,
        snapchatUrl: (lead as any).snapchatUrl,
        facebookUrl: (lead as any).facebookUrl,
        twitterUrl: lead.twitterUrl,
      });

      return { completeness, missingFields, total: 8, filled: Math.round(completeness * 8 / 100) };
    }),
});
