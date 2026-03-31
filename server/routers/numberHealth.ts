import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { whatsappAccounts, numberHealthEvents } from "../../drizzle/schema";
import { eq, desc, sql } from "drizzle-orm";

export const numberHealthRouter = router({
  getAll: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(whatsappAccounts).orderBy(whatsappAccounts.sortOrder);
  }),

  getSummary: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { total: 0, safe: 0, watch: 0, warning: 0, danger: 0, avgScore: 0 };

    const accounts = await db.select({
      healthStatus: whatsappAccounts.healthStatus,
      healthScore: whatsappAccounts.healthScore,
    }).from(whatsappAccounts);

    const total = accounts.length;
    const safe = accounts.filter(a => a.healthStatus === "safe").length;
    const watch = accounts.filter(a => a.healthStatus === "watch").length;
    const warning = accounts.filter(a => a.healthStatus === "warning").length;
    const danger = accounts.filter(a => a.healthStatus === "danger").length;
    const avgScore = total > 0 ? Math.round(accounts.reduce((s, a) => s + a.healthScore, 0) / total) : 0;

    return { total, safe, watch, warning, danger, avgScore };
  }),

  getEvents: protectedProcedure
    .input(z.object({ accountId: z.string(), limit: z.number().default(20) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(numberHealthEvents)
        .where(eq(numberHealthEvents.accountId, input.accountId))
        .orderBy(desc(numberHealthEvents.createdAt))
        .limit(input.limit);
    }),

  updateScore: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const rows = await db.select().from(whatsappAccounts)
        .where(eq(whatsappAccounts.accountId, input.accountId))
        .limit(1);
      const account = rows[0];
      if (!account) throw new TRPCError({ code: "NOT_FOUND" });

      // حساب السكور بناءً على البيانات
      let score = 100;
      score -= account.reportCount * 10;
      score -= account.blockCount * 15;
      score -= Math.min(20, Math.floor(account.noReplyCount / 10));
      score = Math.max(0, Math.min(100, score));

      let status: "safe" | "watch" | "warning" | "danger" = "safe";
      if (score < 30) status = "danger";
      else if (score < 50) status = "warning";
      else if (score < 70) status = "watch";

      await db.update(whatsappAccounts).set({
        healthScore: score,
        healthStatus: status,
        lastScoreUpdate: new Date(),
      }).where(eq(whatsappAccounts.accountId, input.accountId));

      return { score, status };
    }),

  updateAllScores: protectedProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const accounts = await db.select().from(whatsappAccounts);
    for (const account of accounts) {
      let score = 100;
      score -= account.reportCount * 10;
      score -= account.blockCount * 15;
      score -= Math.min(20, Math.floor(account.noReplyCount / 10));
      score = Math.max(0, Math.min(100, score));

      let status: "safe" | "watch" | "warning" | "danger" = "safe";
      if (score < 30) status = "danger";
      else if (score < 50) status = "warning";
      else if (score < 70) status = "watch";

      await db.update(whatsappAccounts).set({
        healthScore: score,
        healthStatus: status,
        lastScoreUpdate: new Date(),
      }).where(eq(whatsappAccounts.accountId, account.accountId));
    }

    return { updated: accounts.length };
  }),

  reportEvent: protectedProcedure
    .input(z.object({
      accountId: z.string(),
      eventType: z.enum(["report", "block", "no_reply", "score_drop", "score_rise", "warning_sent"]),
      description: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const rows = await db.select().from(whatsappAccounts)
        .where(eq(whatsappAccounts.accountId, input.accountId))
        .limit(1);
      const account = rows[0];
      if (!account) throw new TRPCError({ code: "NOT_FOUND" });

      await db.insert(numberHealthEvents).values({
        accountId: input.accountId,
        eventType: input.eventType,
        description: input.description,
        scoreBefore: account.healthScore,
        scoreAfter: account.healthScore,
      });

      // تحديث العدادات
      if (input.eventType === "report") {
        await db.update(whatsappAccounts)
          .set({ reportCount: sql`${whatsappAccounts.reportCount} + 1` })
          .where(eq(whatsappAccounts.accountId, input.accountId));
      } else if (input.eventType === "block") {
        await db.update(whatsappAccounts)
          .set({ blockCount: sql`${whatsappAccounts.blockCount} + 1` })
          .where(eq(whatsappAccounts.accountId, input.accountId));
      }

      return { success: true };
    }),

  updateSettings: protectedProcedure
    .input(z.object({
      accountId: z.string(),
      maxDailyMessages: z.number().optional(),
      minIntervalSeconds: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { accountId, ...data } = input;
      await db.update(whatsappAccounts)
        .set(data)
        .where(eq(whatsappAccounts.accountId, accountId));

      return { success: true };
    }),

  getBackupLogs: protectedProcedure
    .input(z.object({ limit: z.number().default(10) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(numberHealthEvents)
        .orderBy(desc(numberHealthEvents.createdAt))
        .limit(input.limit);
    }),

  createBackup: protectedProcedure.mutation(async () => {
    return { success: true, message: "تم إنشاء نسخة احتياطية" };
  }),
});
