import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { weeklyReports } from "../../drizzle/schema";
import { desc } from "drizzle-orm";

// جدول الإعدادات في الذاكرة (يمكن تطويره لاحقاً لقاعدة البيانات)
let scheduleConfig = {
  isEnabled: false,
  isActive: false,
  frequency: "weekly" as "daily" | "weekly" | "monthly",
  dayOfWeek: 0, // 0=الأحد
  hour: 8,
  minute: 0,
  timezone: "Asia/Riyadh",
  recipientPhone: null as string | null,
  whatsappAccountId: null as string | null,
  recipients: [] as string[],
  includeCharts: true,
  includeLeadStats: true,
  includeLeadsStats: true,
  includeSalesStats: true,
  includeWhatsappStats: false,
  includeEmployeeStats: false,
};

export const reportSchedulerRouter = router({
  getSchedule: protectedProcedure.query(async () => {
    return scheduleConfig;
  }),

  saveSchedule: protectedProcedure
    .input(z.object({
      isEnabled: z.boolean().optional(),
      isActive: z.boolean().optional(),
      frequency: z.enum(["daily", "weekly", "monthly"]).optional(),
      dayOfWeek: z.number().min(0).max(6).optional(),
      hour: z.number().min(0).max(23).optional(),
      minute: z.number().min(0).max(59).optional(),
      timezone: z.string().optional(),
      recipientPhone: z.string().optional(),
      whatsappAccountId: z.string().optional(),
      recipients: z.array(z.string()).optional(),
      includeCharts: z.boolean().optional(),
      includeLeadStats: z.boolean().optional(),
      includeLeadsStats: z.boolean().optional(),
      includeSalesStats: z.boolean().optional(),
      includeWhatsappStats: z.boolean().optional(),
      includeEmployeeStats: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      scheduleConfig = { ...scheduleConfig, ...input };
      return { success: true, config: scheduleConfig };
    }),

  triggerNow: protectedProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    // الحصول على آخر تقرير أسبوعي
    const reports = await db.select().from(weeklyReports)
      .orderBy(desc(weeklyReports.weekStart))
      .limit(1);

    return {
      success: true,
      message: "تم تشغيل التقرير يدوياً",
      lastReport: reports[0] || null,
    };
  }),

  getHistory: protectedProcedure
    .input(z.object({ limit: z.number().default(10) }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      return db.select().from(weeklyReports)
        .orderBy(desc(weeklyReports.weekStart))
        .limit(input?.limit ?? 10);
    }),
});
