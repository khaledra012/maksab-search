import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { weeklyReports, leads, reminders, reportSchedules } from "../../drizzle/schema";
import { desc, eq, gte, lte, sql, and } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";

export const weeklyReportsRouter = router({
  list: protectedProcedure
    .input(z.object({ limit: z.number().default(10) }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(weeklyReports)
        .orderBy(desc(weeklyReports.weekStart))
        .limit(input?.limit || 10);
    }),

  getLatest: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;
    const [report] = await db.select().from(weeklyReports)
      .orderBy(desc(weeklyReports.weekStart))
      .limit(1);
    return report || null;
  }),

  generate: protectedProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay()); // بداية الأسبوع (الأحد)
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const [totalLeads, newLeads, hotLeads] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(leads),
      db.select({ count: sql<number>`count(*)` }).from(leads).where(gte(leads.createdAt, weekStart)),
      db.select({ count: sql<number>`count(*)` }).from(leads).where(eq(leads.priority, "high")),
    ]);

    const totalCount = totalLeads[0]?.count ?? 0;
    const newCount = newLeads[0]?.count ?? 0;
    const hotCount = hotLeads[0]?.count ?? 0;

    // إنشاء ملخص بالذكاء الاصطناعي
    const summaryResponse = await invokeLLM({
      messages: [
        { role: "system", content: "أنت مدير مبيعات خبير. قدم ملخصاً أسبوعياً احترافياً." },
        { role: "user", content: `ملخص الأسبوع:\n- إجمالي العملاء: ${totalCount}\n- عملاء جدد هذا الأسبوع: ${newCount}\n- عملاء ذوو أولوية عالية: ${hotCount}\n\nقدم ملخصاً موجزاً ومفيداً.` },
      ],
    });

    const summaryText = String(summaryResponse.choices[0]?.message?.content || "لا يمكن إنشاء الملخص");

    const result = await db.insert(weeklyReports).values({
      weekStart,
      weekEnd,
      totalLeads: totalCount,
      newLeads: newCount,
      hotLeads: hotCount,
      messagesSent: 0,
      messagesReceived: 0,
      analyzedLeads: 0,
      completedReminders: 0,
      pendingReminders: 0,
      summaryText,
      sentViaWhatsapp: false,
    });

    return { id: (result as any).insertId, summaryText };
  }),

  getSchedule: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;
    const [schedule] = await db.select().from(reportSchedules).limit(1);
    return schedule || { isEnabled: false, dayOfWeek: 0, hour: 8, minute: 0, timezone: "Asia/Riyadh" };
  }),

  saveSchedule: protectedProcedure
    .input(z.object({
      isEnabled: z.boolean(),
      dayOfWeek: z.number().min(0).max(6),
      hour: z.number().min(0).max(23),
      minute: z.number().min(0).max(59),
      timezone: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [existing] = await db.select().from(reportSchedules).limit(1);
      if (existing) {
        await db.update(reportSchedules).set({
          isEnabled: input.isEnabled,
          dayOfWeek: input.dayOfWeek,
          hour: input.hour,
          minute: input.minute,
          timezone: input.timezone || "Asia/Riyadh",
        }).where(eq(reportSchedules.id, existing.id));
      } else {
        await db.insert(reportSchedules).values({
          isEnabled: input.isEnabled,
          dayOfWeek: input.dayOfWeek,
          hour: input.hour,
          minute: input.minute,
          timezone: input.timezone || "Asia/Riyadh",
        });
      }

      return { success: true };
    }),
});
