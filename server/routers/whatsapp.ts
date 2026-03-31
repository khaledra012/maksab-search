import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { whatsappMessages, leads } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";

export const whatsappRouter = router({
  // التحقق من وجود واتساب لرقم معين
  check: protectedProcedure
    .input(z.object({
      phone: z.string(),
      leadId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      // محاكاة التحقق - يمكن تطوير هذا لاحقاً مع API واتساب حقيقي
      const hasWhatsapp = input.phone.startsWith("+966") || input.phone.startsWith("966") || input.phone.startsWith("05");
      return {
        phone: input.phone,
        hasWhatsapp,
        status: hasWhatsapp ? "yes" : "unknown" as "yes" | "no" | "unknown",
      };
    }),

  // تحديث حالة واتساب للعميل
  updateStatus: protectedProcedure
    .input(z.object({
      leadId: z.number(),
      hasWhatsapp: z.enum(["yes", "no", "unknown"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.update(leads)
        .set({ hasWhatsapp: input.hasWhatsapp })
        .where(eq(leads.id, input.leadId));

      return { success: true };
    }),

  // توليد رسالة واتساب بالذكاء الاصطناعي
  generateMessage: protectedProcedure
    .input(z.object({
      leadId: z.number(),
      companyName: z.string(),
      businessType: z.string().optional(),
      city: z.string().optional(),
      templateType: z.enum(["intro", "followup", "offer", "custom"]).default("intro"),
      customPrompt: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const prompt = input.customPrompt || `اكتب رسالة واتساب احترافية قصيرة (3-4 أسطر) لـ:
- اسم النشاط: ${input.companyName}
- نوع النشاط: ${input.businessType || "غير محدد"}
- المدينة: ${input.city || "غير محدد"}
- نوع الرسالة: ${input.templateType === "intro" ? "تعريفية" : input.templateType === "followup" ? "متابعة" : input.templateType === "offer" ? "عرض خاص" : "مخصصة"}

الرسالة يجب أن تكون باللغة العربية، مختصرة، ومقنعة.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "أنت متخصص في كتابة رسائل تسويقية احترافية للسوق السعودي." },
          { role: "user", content: prompt },
        ],
      });

      const message = response.choices[0]?.message?.content;
      const text = typeof message === "string" ? message : "";

      return { message: text };
    }),

  // تسجيل رسالة واتساب مُرسلة
  logMessage: protectedProcedure
    .input(z.object({
      leadId: z.number(),
      phone: z.string(),
      message: z.string(),
      accountId: z.string().optional(),
      status: z.enum(["sent", "failed", "pending"]).default("sent"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const result = await db.insert(whatsappMessages).values({
        leadId: input.leadId,
        phone: input.phone,
        message: input.message,
        status: input.status,
      });

      return { id: (result as any).insertId };
    }),

  // قائمة الرسائل المرسلة لعميل
  getMessages: protectedProcedure
    .input(z.object({ leadId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      return db.select().from(whatsappMessages)
        .where(eq(whatsappMessages.leadId, input.leadId))
        .orderBy(desc(whatsappMessages.sentAt))
        .limit(50);
    }),

  // تقرير الإرسال التفصيلي
  getSendingReport: protectedProcedure
    .input(z.object({ days: z.number().default(7) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { accounts: [], dailyBreakdown: [], totals: { sent: 0, received: 0, chats: 0 } };

      const messages = await db.select().from(whatsappMessages)
        .orderBy(desc(whatsappMessages.sentAt))
        .limit(500);

      return {
        accounts: [],
        dailyBreakdown: [],
        totals: { sent: messages.length, received: 0, chats: messages.length },
      };
    }),
});
