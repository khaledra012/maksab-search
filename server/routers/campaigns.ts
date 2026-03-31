import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { campaigns } from "../../drizzle/schema";
import { eq, desc, sql } from "drizzle-orm";

export const campaignsRouter = router({
  stats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { total: 0, running: 0, completed: 0, draft: 0, totalSent: 0, totalReplied: 0 };

    const [total, running, completed, draft, totals] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(campaigns),
      db.select({ count: sql<number>`count(*)` }).from(campaigns).where(eq(campaigns.status, "running")),
      db.select({ count: sql<number>`count(*)` }).from(campaigns).where(eq(campaigns.status, "completed")),
      db.select({ count: sql<number>`count(*)` }).from(campaigns).where(eq(campaigns.status, "draft")),
      db.select({
        totalSent: sql<number>`SUM(totalSent)`,
        totalReplied: sql<number>`SUM(totalReplied)`,
      }).from(campaigns),
    ]);

    return {
      total: total[0]?.count ?? 0,
      running: running[0]?.count ?? 0,
      completed: completed[0]?.count ?? 0,
      draft: draft[0]?.count ?? 0,
      totalSent: totals[0]?.totalSent ?? 0,
      totalReplied: totals[0]?.totalReplied ?? 0,
    };
  }),

  list: protectedProcedure
    .input(z.object({
      status: z.enum(["draft", "running", "completed", "paused", "failed"]).optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const query = db.select().from(campaigns).orderBy(desc(campaigns.createdAt)).limit(100);
      if (input?.status) {
        return db.select().from(campaigns).where(eq(campaigns.status, input.status)).orderBy(desc(campaigns.createdAt)).limit(100);
      }
      return query;
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const result = await db.insert(campaigns).values({
        name: input.name,
        description: input.description,
        status: "draft",
        createdBy: ctx.user.id,
      });

      return { id: (result as any).insertId };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.delete(campaigns).where(eq(campaigns.id, input.id));
      return { success: true };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      description: z.string().optional(),
      status: z.enum(["draft", "running", "completed", "paused", "failed"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { id, ...data } = input;
      await db.update(campaigns).set(data).where(eq(campaigns.id, id));
      return { success: true };
    }),
});
