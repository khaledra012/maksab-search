import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { whatsappAccounts, whatsappMessages } from "../../drizzle/schema";
import { eq, asc } from "drizzle-orm";

export const wautoRouter = router({
  // حالة جميع الجلسات
  allStatus: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const accounts = await db.select().from(whatsappAccounts)
      .where(eq(whatsappAccounts.isActive, true))
      .orderBy(asc(whatsappAccounts.sortOrder));
    return accounts.map(a => ({
      accountId: a.accountId,
      label: a.label,
      phoneNumber: a.phoneNumber,
      status: "disconnected" as "connected" | "disconnected" | "qr_pending",
      qrCode: null as string | null,
      healthScore: a.healthScore,
      healthStatus: a.healthStatus,
    }));
  }),

  // حالة جلسة واحدة
  getStatus: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db.select().from(whatsappAccounts)
        .where(eq(whatsappAccounts.accountId, input.accountId))
        .limit(1);
      const a = rows[0];
      if (!a) return null;
      return {
        accountId: a.accountId,
        label: a.label,
        status: "disconnected" as "connected" | "disconnected" | "qr_pending",
        qrCode: null as string | null,
      };
    }),

  // إرسال رسالة واحدة
  sendOne: protectedProcedure
    .input(z.object({
      accountId: z.string(),
      phone: z.string(),
      message: z.string(),
      leadId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // تسجيل الرسالة في قاعدة البيانات
      if (input.leadId) {
        await db.insert(whatsappMessages).values({
          leadId: input.leadId,
          phone: input.phone,
          message: input.message,
          status: "pending",
        });
      }

      // هنا يمكن إضافة منطق الإرسال الفعلي عبر API واتساب
      return {
        success: false,
        message: "يحتاج إلى ربط API واتساب",
      };
    }),

  // بدء جلسة جديدة
  startSession: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .mutation(async () => {
      return {
        success: false,
        message: "يحتاج إلى ربط API واتساب",
        qrCode: null,
      };
    }),

  // إيقاف جلسة
  stopSession: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .mutation(async () => {
      return { success: true };
    }),

  // إعادة تشغيل جلسة
  restartSession: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .mutation(async () => {
      return {
        success: false,
        message: "يحتاج إلى ربط API واتساب",
      };
    }),
});
