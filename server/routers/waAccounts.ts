import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { whatsappAccounts } from "../../drizzle/schema";
import { eq, desc, asc } from "drizzle-orm";

export const waAccountsRouter = router({
  listAccounts: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(whatsappAccounts).orderBy(asc(whatsappAccounts.sortOrder));
  }),

  getAccount: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db.select().from(whatsappAccounts)
        .where(eq(whatsappAccounts.accountId, input.accountId))
        .limit(1);
      return rows[0] || null;
    }),

  createAccount: protectedProcedure
    .input(z.object({
      accountId: z.string().min(1),
      label: z.string().min(1),
      phoneNumber: z.string().min(1),
      role: z.enum(["bulk_sender", "human_handoff", "both"]).default("bulk_sender"),
      assignedEmployee: z.string().optional(),
      accountType: z.enum(["collection", "sales", "analysis", "followup"]).default("collection"),
      notes: z.string().optional(),
      maxDailyMessages: z.number().default(200),
      minIntervalSeconds: z.number().default(30),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const result = await db.insert(whatsappAccounts).values({
        accountId: input.accountId,
        label: input.label,
        phoneNumber: input.phoneNumber,
        role: input.role,
        assignedEmployee: input.assignedEmployee,
        accountType: input.accountType,
        notes: input.notes,
        maxDailyMessages: input.maxDailyMessages,
        minIntervalSeconds: input.minIntervalSeconds,
        isActive: true,
      });

      return { id: (result as any).insertId };
    }),

  updateAccount: protectedProcedure
    .input(z.object({
      accountId: z.string(),
      label: z.string().optional(),
      phoneNumber: z.string().optional(),
      role: z.enum(["bulk_sender", "human_handoff", "both"]).optional(),
      assignedEmployee: z.string().optional(),
      isActive: z.boolean().optional(),
      maxDailyMessages: z.number().optional(),
      minIntervalSeconds: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { accountId, ...data } = input;
      await db.update(whatsappAccounts)
        .set(data as any)
        .where(eq(whatsappAccounts.accountId, accountId));

      return { success: true };
    }),

  deleteAccount: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.delete(whatsappAccounts)
        .where(eq(whatsappAccounts.accountId, input.accountId));

      return { success: true };
    }),

  allStatus: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const accounts = await db.select().from(whatsappAccounts)
      .where(eq(whatsappAccounts.isActive, true))
      .orderBy(asc(whatsappAccounts.sortOrder));
    return accounts.map(a => ({
      ...a,
      status: "disconnected" as const,
      qrCode: null,
    }));
  }),
});
