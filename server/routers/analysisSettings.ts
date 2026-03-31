import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { analysisSettings } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export const analysisSettingsRouter = router({
  // جلب إعدادات المستخدم الحالي
  get: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const [settings] = await db
      .select()
      .from(analysisSettings)
      .where(eq(analysisSettings.userId, ctx.user.id))
      .limit(1);

    if (!settings) {
      // إنشاء إعدادات افتراضية
      await db.insert(analysisSettings).values({
        userId: ctx.user.id,
        salesGoalMonthly: 50,
        primarySector: "general",
        communicationStyle: "professional",
        salesApproach: "sa_arabic",
        reportLanguage: "arabic",
        autoAnalyzeOnAdd: true,
        priorityThreshold: 7,
        updatedAt: Date.now(),
      });
      const [newSettings] = await db
        .select()
        .from(analysisSettings)
        .where(eq(analysisSettings.userId, ctx.user.id))
        .limit(1);
      return newSettings ?? null;
    }
    return settings;
  }),

  // حفظ الإعدادات
  save: protectedProcedure
    .input(
      z.object({
        salesGoalMonthly: z.number().min(1).max(10000).optional(),
        primarySector: z.string().optional(),
        communicationStyle: z.enum(["professional", "friendly", "direct", "formal"]).optional(),
        targetCities: z.string().optional(),
        salesApproach: z.enum(["sa_arabic", "gulf_arabic", "msa_formal", "english"]).optional(),
        reportLanguage: z.enum(["arabic", "english", "bilingual"]).optional(),
        autoAnalyzeOnAdd: z.boolean().optional(),
        priorityThreshold: z.number().min(1).max(10).optional(),
        customInstructions: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const existing = await db
        .select({ id: analysisSettings.id })
        .from(analysisSettings)
        .where(eq(analysisSettings.userId, ctx.user.id))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(analysisSettings)
          .set({ ...input, updatedAt: Date.now() })
          .where(eq(analysisSettings.userId, ctx.user.id));
      } else {
        await db.insert(analysisSettings).values({
          userId: ctx.user.id,
          ...input,
          updatedAt: Date.now(),
        });
      }
      return { success: true };
    }),

  // جلب الإعدادات كـ context للـ LLM
  getLLMContext: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const [settings] = await db
      .select()
      .from(analysisSettings)
      .where(eq(analysisSettings.userId, ctx.user.id))
      .limit(1);

    if (!settings) {
      return {
        salesGoalMonthly: 50,
        primarySector: "general",
        communicationStyle: "professional",
        salesApproach: "sa_arabic",
        reportLanguage: "arabic",
        priorityThreshold: 7,
        customInstructions: null,
        targetCities: null,
      };
    }

    return {
      salesGoalMonthly: settings.salesGoalMonthly,
      primarySector: settings.primarySector,
      communicationStyle: settings.communicationStyle,
      salesApproach: settings.salesApproach,
      reportLanguage: settings.reportLanguage,
      priorityThreshold: settings.priorityThreshold,
      customInstructions: settings.customInstructions,
      targetCities: settings.targetCities,
    };
  }),
});
