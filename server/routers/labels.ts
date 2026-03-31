import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { conversationLabels } from "../../drizzle/schema";
import { eq, desc, sql } from "drizzle-orm";

export const labelsRouter = router({
  getAll: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(conversationLabels).orderBy(desc(conversationLabels.createdAt));
  }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      color: z.string().optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const result = await db.insert(conversationLabels).values({
        name: input.name,
        color: input.color || "#3B82F6",
        description: input.description,
        createdBy: ctx.user.id,
      });

      return { id: (result as any).insertId };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      color: z.string().optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { id, ...data } = input;
      await db.update(conversationLabels).set(data).where(eq(conversationLabels.id, id));
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.delete(conversationLabels).where(eq(conversationLabels.id, input.id));
      return { success: true };
    }),
});
