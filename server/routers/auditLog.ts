import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { auditLogs } from "../../drizzle/schema";
import { desc, eq, and, gte, lte, like, sql } from "drizzle-orm";

export const auditLogRouter = router({
  getAll: protectedProcedure
    .input(z.object({
      page: z.number().default(1),
      limit: z.number().default(50),
      userId: z.number().optional(),
      action: z.string().optional(),
      dateFrom: z.number().optional(),
      dateTo: z.number().optional(),
      search: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { logs: [], total: 0 };

      const page = input?.page ?? 1;
      const limit = input?.limit ?? 50;
      const offset = (page - 1) * limit;

      const conditions = [];
      if (input?.userId) conditions.push(eq(auditLogs.userId, input.userId));
      if (input?.action) conditions.push(eq(auditLogs.action, input.action));
      if (input?.dateFrom) conditions.push(gte(auditLogs.createdAt, new Date(input.dateFrom)));
      if (input?.dateTo) conditions.push(lte(auditLogs.createdAt, new Date(input.dateTo)));
      if (input?.search) conditions.push(like(auditLogs.details, `%${input.search}%`));

      const query = db.select().from(auditLogs);
      if (conditions.length > 0) query.where(and(...conditions));

      const [logs, countResult] = await Promise.all([
        db.select().from(auditLogs)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(desc(auditLogs.createdAt))
          .limit(limit)
          .offset(offset),
        db.select({ count: sql<number>`count(*)` }).from(auditLogs)
          .where(conditions.length > 0 ? and(...conditions) : undefined),
      ]);

      return { logs, total: countResult[0]?.count ?? 0 };
    }),

  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { total: 0, today: 0, thisWeek: 0, byAction: [] };

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [total, today, thisWeek, byAction] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(auditLogs),
      db.select({ count: sql<number>`count(*)` }).from(auditLogs).where(gte(auditLogs.createdAt, todayStart)),
      db.select({ count: sql<number>`count(*)` }).from(auditLogs).where(gte(auditLogs.createdAt, weekStart)),
      db.select({ action: auditLogs.action, count: sql<number>`count(*)` })
        .from(auditLogs)
        .groupBy(auditLogs.action)
        .orderBy(desc(sql<number>`count(*)`))
        .limit(10),
    ]);

    return {
      total: total[0]?.count ?? 0,
      today: today[0]?.count ?? 0,
      thisWeek: thisWeek[0]?.count ?? 0,
      byAction,
    };
  }),

  log: protectedProcedure
    .input(z.object({
      action: z.string(),
      entityType: z.string().optional(),
      entityId: z.number().optional(),
      details: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { success: false };

      await db.insert(auditLogs).values({
        userId: ctx.user.id,
        userName: ctx.user.name || undefined,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ? String(input.entityId) : undefined,
        details: input.details ? { note: input.details } : undefined,
      });

      return { success: true };
    }),
});
