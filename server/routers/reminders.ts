import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { reminders, leads } from "../../drizzle/schema";
import { eq, and, desc, asc, gte, lte, lt, sql } from "drizzle-orm";

export const remindersRouter = router({
  list: protectedProcedure
    .input(z.object({
      status: z.enum(["pending", "done", "snoozed", "cancelled"]).optional(),
      leadId: z.number().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const conditions = [];
      if (input?.status) conditions.push(eq(reminders.status, input.status));
      if (input?.leadId) conditions.push(eq(reminders.leadId, input.leadId));

      return db.select().from(reminders)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(asc(reminders.dueDate))
        .limit(200);
    }),

  stats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { total: 0, pending: 0, overdue: 0, doneToday: 0 };

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [total, pending, overdue, doneToday] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(reminders),
      db.select({ count: sql<number>`count(*)` }).from(reminders).where(eq(reminders.status, "pending")),
      db.select({ count: sql<number>`count(*)` }).from(reminders).where(
        and(eq(reminders.status, "pending"), lt(reminders.dueDate, now))
      ),
      db.select({ count: sql<number>`count(*)` }).from(reminders).where(
        and(eq(reminders.status, "done"), gte(reminders.updatedAt, todayStart))
      ),
    ]);

    return {
      total: total[0]?.count ?? 0,
      pending: pending[0]?.count ?? 0,
      overdue: overdue[0]?.count ?? 0,
      doneToday: doneToday[0]?.count ?? 0,
    };
  }),

  overdue: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];

    return db.select().from(reminders)
      .where(and(eq(reminders.status, "pending"), lt(reminders.dueDate, new Date())))
      .orderBy(asc(reminders.dueDate))
      .limit(50);
  }),

  upcoming: protectedProcedure
    .input(z.object({ daysAhead: z.number().default(3) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const now = new Date();
      const future = new Date(now.getTime() + input.daysAhead * 24 * 60 * 60 * 1000);

      return db.select().from(reminders)
        .where(and(
          eq(reminders.status, "pending"),
          gte(reminders.dueDate, now),
          lte(reminders.dueDate, future)
        ))
        .orderBy(asc(reminders.dueDate))
        .limit(50);
    }),

  create: protectedProcedure
    .input(z.object({
      leadId: z.number(),
      leadName: z.string().min(1),
      leadPhone: z.string().optional(),
      leadCity: z.string().optional(),
      leadBusinessType: z.string().optional(),
      title: z.string().min(1),
      notes: z.string().optional(),
      dueAt: z.number(), // Unix timestamp ms
      reminderType: z.enum(["follow_up", "call", "message", "meeting", "custom"]).optional(),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
      assignedTo: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const result = await db.insert(reminders).values({
        leadId: input.leadId,
        leadName: input.leadName,
        leadPhone: input.leadPhone,
        leadCity: input.leadCity,
        leadBusinessType: input.leadBusinessType,
        title: input.title,
        notes: input.notes,
        dueDate: new Date(input.dueAt),
        reminderType: input.reminderType || "follow_up",
        priority: input.priority || "medium",
        assignedTo: input.assignedTo,
        createdBy: ctx.user.id,
        status: "pending",
      });

      return { id: (result as any).insertId };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      notes: z.string().optional(),
      dueAt: z.number().optional(),
      status: z.enum(["pending", "done", "snoozed", "cancelled"]).optional(),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { id, dueAt, ...rest } = input;
      await db.update(reminders).set({
        ...rest,
        ...(dueAt ? { dueDate: new Date(dueAt) } : {}),
        ...(rest.status === "done" ? { completedAt: new Date() } : {}),
      }).where(eq(reminders.id, id));

      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.delete(reminders).where(eq(reminders.id, input.id));
      return { success: true };
    }),

  autoCreateForUnfollowed: protectedProcedure
    .input(z.object({ daysWithoutContact: z.number().default(7) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const cutoff = new Date(Date.now() - input.daysWithoutContact * 24 * 60 * 60 * 1000);
      const staleLeads = await db.select({
        id: leads.id,
        companyName: leads.companyName,
        verifiedPhone: leads.verifiedPhone,
        city: leads.city,
        businessType: leads.businessType,
      })
        .from(leads)
        .where(and(
          lte(leads.updatedAt, cutoff),
          eq(leads.stage, "contacted")
        ))
        .limit(50);

      let created = 0;
      for (const lead of staleLeads) {
        await db.insert(reminders).values({
          leadId: lead.id,
          leadName: lead.companyName,
          leadPhone: lead.verifiedPhone || undefined,
          leadCity: lead.city,
          leadBusinessType: lead.businessType,
          title: `متابعة: ${lead.companyName}`,
          notes: `لم يتم التواصل منذ ${input.daysWithoutContact} أيام`,
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
          reminderType: "follow_up",
          priority: "medium",
          createdBy: ctx.user.id,
          status: "pending",
        }).catch(() => {});
        created++;
      }

      return { created };
    }),
});
