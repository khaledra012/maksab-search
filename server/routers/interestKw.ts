// @ts-nocheck
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { interestKeywords, aiTrainingExamples } from "../../drizzle/schema";
import { eq, desc, sql, inArray } from "drizzle-orm";

export const interestKwRouter = router({
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(interestKeywords).orderBy(desc(interestKeywords.createdAt));
  }),

  stats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { total: 0, active: 0, inactive: 0 };

    const [total, active] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(interestKeywords),
      db.select({ count: sql<number>`count(*)` }).from(interestKeywords).where(eq(interestKeywords.isActive, true)),
    ]);

    const totalCount = total[0]?.count ?? 0;
    const activeCount = active[0]?.count ?? 0;

    return {
      total: totalCount,
      active: activeCount,
      inactive: totalCount - activeCount,
    };
  }),

  listTrainingExamples: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(aiTrainingExamples).orderBy(desc(aiTrainingExamples.createdAt)).limit(100);
  }),

  addTrainingExample: protectedProcedure
    .input(z.object({
      input: z.string().min(1),
      output: z.string().min(1),
      category: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const result = await db.insert(aiTrainingExamples).values({
        input: input.input,
        output: input.output,
        category: input.category || "general",
      });
      return { id: (result as any).insertId };
    }),

  deleteTrainingExample: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(aiTrainingExamples).where(eq(aiTrainingExamples.id, input.id));
      return { success: true };
    }),

  add: protectedProcedure
    .input(z.object({
      keyword: z.string().min(1),
      category: z.string().optional(),
      weight: z.number().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const result = await db.insert(interestKeywords).values({
        keyword: input.keyword,
        category: input.category || "general",
        weight: input.weight || 1,
        isActive: input.isActive !== false,
      });

      return { id: (result as any).insertId };
    }),

  updateFull: protectedProcedure
    .input(z.object({
      id: z.number(),
      keyword: z.string().optional(),
      category: z.string().optional(),
      weight: z.number().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { id, ...data } = input;
      await db.update(interestKeywords).set(data).where(eq(interestKeywords.id, id));
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.delete(interestKeywords).where(eq(interestKeywords.id, input.id));
      return { success: true };
    }),

  bulkToggle: protectedProcedure
    .input(z.object({
      ids: z.array(z.number()),
      isActive: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.update(interestKeywords)
        .set({ isActive: input.isActive })
        .where(inArray(interestKeywords.id, input.ids));

      return { success: true, count: input.ids.length };
    }),

  resetDefaults: protectedProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    await db.update(interestKeywords).set({ isActive: true });
    return { success: true };
  }),

  importKeywords: protectedProcedure
    .input(z.object({
      keywords: z.array(z.object({
        keyword: z.string(),
        category: z.string().optional(),
        weight: z.number().optional(),
      })),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      let added = 0;
      for (const kw of input.keywords) {
        await db.insert(interestKeywords).values({
          keyword: kw.keyword,
          category: kw.category || "imported",
          weight: kw.weight || 1,
          isActive: true,
        }).catch(() => {}); // تجاهل المكررات
        added++;
      }

      return { added };
    }),
});
