import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { leads } from "../../drizzle/schema";
import { isNotNull, desc, eq, lte } from "drizzle-orm";

export const followUpRouter = router({
  // العملاء الذين يحتاجون متابعة (nextFollowup أقل من أو يساوي الوقت الحالي)
  getFollowUpNeeded: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];

    const now = Date.now();
    const allLeads = await db.select().from(leads)
      .where(isNotNull(leads.nextFollowup))
      .orderBy(leads.nextFollowup)
      .limit(100);

    return allLeads.filter(l => l.nextFollowup && l.nextFollowup <= now);
  }),

  // إحصائيات المتابعة
  getFollowUpStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { overdue: 0, today: 0, upcoming: 0, total: 0 };

    const now = Date.now();
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const todayEndMs = todayEnd.getTime();
    const weekEndMs = now + 7 * 24 * 60 * 60 * 1000;

    const allFollowUps = await db.select({
      nextFollowup: leads.nextFollowup,
    }).from(leads).where(isNotNull(leads.nextFollowup));

    const overdue = allFollowUps.filter(l => l.nextFollowup && l.nextFollowup < now).length;
    const today = allFollowUps.filter(l => l.nextFollowup && l.nextFollowup >= now && l.nextFollowup <= todayEndMs).length;
    const upcoming = allFollowUps.filter(l => l.nextFollowup && l.nextFollowup > todayEndMs && l.nextFollowup <= weekEndMs).length;
    const total = allFollowUps.length;

    return { overdue, today, upcoming, total };
  }),

  // تحديث تاريخ المتابعة
  updateFollowUpDate: protectedProcedure
    .input(z.object({
      leadId: z.number(),
      followUpDate: z.number().nullable(), // timestamp in ms
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };

      await db.update(leads)
        .set({ nextFollowup: input.followUpDate })
        .where(eq(leads.id, input.leadId));

      return { success: true };
    }),

  // تأجيل المتابعة
  snoozeFollowUp: protectedProcedure
    .input(z.object({
      leadId: z.number(),
      days: z.number().default(1),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };

      const newDate = Date.now() + input.days * 24 * 60 * 60 * 1000;

      await db.update(leads)
        .set({ nextFollowup: newDate })
        .where(eq(leads.id, input.leadId));

      return { success: true, newDate };
    }),
});
