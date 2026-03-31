import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { activationSettings, activationMessages } from "../../drizzle/schema";
import { desc, sql, eq } from "drizzle-orm";

export const activationRouter = router({
  getSettings: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select().from(activationSettings).limit(1);
    return rows[0] || null;
  }),

  getStats: protectedProcedure
    .input(z.object({ days: z.number().default(7) }).optional())
    .query(async () => {
      const db = await getDb();
      if (!db) return { total: 0, sent: 0, failed: 0, pending: 0, isRunning: false, today: 0, success: 0, recentMessages: [] };

      const messages = await db.select({
        status: activationMessages.status,
        count: sql<number>`count(*)`,
      }).from(activationMessages)
        .groupBy(activationMessages.status);

      const total = messages.reduce((s, m) => s + m.count, 0);
      const sent = messages.find(m => m.status === "sent")?.count ?? 0;
      const failed = messages.find(m => m.status === "failed")?.count ?? 0;
      const pending = messages.find(m => m.status === "pending")?.count ?? 0;

      // آخر 10 رسائل
      const recentMessages = await db.select().from(activationMessages)
        .orderBy(desc(activationMessages.sentAt))
        .limit(10);

      // رسائل اليوم
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayMessages = await db.select().from(activationMessages)
        .where(sql`${activationMessages.sentAt} >= ${todayStart}`);

      return {
        total,
        sent,
        failed,
        pending,
        isRunning: pending > 0,
        today: todayMessages.length,
        success: sent,
        recentMessages,
      };
    }),

  saveSettings: protectedProcedure
    .input(z.object({
      isActive: z.boolean().optional(),
      minDelaySeconds: z.number().optional(),
      maxDelaySeconds: z.number().optional(),
      messagesPerDay: z.number().optional(),
      startHour: z.number().optional(),
      endHour: z.number().optional(),
      useAI: z.boolean().optional(),
      messageStyle: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const existing = await db.select().from(activationSettings).limit(1);
      if (existing.length > 0) {
        await db.update(activationSettings).set(input as any);
      } else {
        await db.insert(activationSettings).values(input as any);
      }

      return { success: true };
    }),

  sendNow: protectedProcedure
    .input(z.object({
      fromAccountId: z.string().optional(),
      toAccountId: z.string().optional(),
      message: z.string().optional(),
    }).optional())
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.insert(activationMessages).values({
        fromAccountId: input?.fromAccountId ?? "system",
        toAccountId: input?.toAccountId ?? "system",
        message: input?.message ?? "رسالة تنشيط",
        status: "pending",
      } as any);

      return { success: true, message: "تم إضافة الرسالة إلى قائمة الانتظار" };
    }),

  clearLog: protectedProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    await db.delete(activationMessages);
    return { success: true };
  }),

  getLog: protectedProcedure
    .input(z.object({ limit: z.number().default(50) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(activationMessages)
        .orderBy(desc(activationMessages.sentAt))
        .limit(input.limit);
    }),
});
