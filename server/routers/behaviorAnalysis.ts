// @ts-nocheck
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { leads, searchBehaviorLogs } from "../../drizzle/schema";
import { eq, desc, sql } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";

export const behaviorAnalysisRouter = router({
  analyzeCustomer: protectedProcedure
    .input(z.object({
      leadId: z.number(),
      context: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [lead] = await db.select().from(leads).where(eq(leads.id, input.leadId)).limit(1);
      if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "العميل غير موجود" });

      const prompt = `
قم بتحليل بيانات العميل التالية وتقديم تحليل سلوكي مفصل:

اسم الشركة: ${lead.companyName}
نوع النشاط: ${lead.businessType}
المدينة: ${lead.city}
المرحلة الحالية: ${lead.stage}
الأولوية: ${lead.priority}
${input.context ? `سياق إضافي: ${input.context}` : ''}

قدم تحليلاً يشمل:
1. نمط سلوك العميل المحتمل
2. احتمالية الشراء (نسبة مئوية)
3. أفضل وقت للتواصل
4. الرسالة التسويقية المناسبة
5. التوصيات للمرحلة التالية

أجب بصيغة JSON.
      `;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "أنت محلل سلوك عملاء خبير في السوق السعودي. أجب دائماً بالعربية وبصيغة JSON." },
          { role: "user", content: prompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "behavior_analysis",
            strict: true,
            schema: {
              type: "object",
              properties: {
                behaviorPattern: { type: "string" },
                purchaseProbability: { type: "number" },
                bestContactTime: { type: "string" },
                marketingMessage: { type: "string" },
                recommendations: { type: "string" },
                riskFactors: { type: "string" },
              },
              required: ["behaviorPattern", "purchaseProbability", "bestContactTime", "marketingMessage", "recommendations", "riskFactors"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = response.choices[0]?.message?.content;
      const analysis = content ? JSON.parse(content) : {};

      return { leadId: input.leadId, analysis };
    }),

  analyzeWithRealData: protectedProcedure
    .input(z.object({
      leadId: z.number(),
      messages: z.array(z.object({
        content: z.string(),
        direction: z.enum(["in", "out"]),
        timestamp: z.number(),
      })).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [lead] = await db.select().from(leads).where(eq(leads.id, input.leadId)).limit(1);
      if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "العميل غير موجود" });

      const messagesText = input.messages?.map(m =>
        `[${m.direction === "in" ? "العميل" : "الموظف"}]: ${m.content}`
      ).join("\n") || "لا توجد رسائل";

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "أنت محلل سلوك عملاء خبير. حلل المحادثة وقدم تقييماً دقيقاً." },
          { role: "user", content: `حلل هذه المحادثة مع العميل ${lead.companyName}:\n\n${messagesText}\n\nقدم تحليلاً شاملاً بصيغة JSON.` },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "real_analysis",
            strict: true,
            schema: {
              type: "object",
              properties: {
                interestLevel: { type: "string" },
                sentiment: { type: "string" },
                keyInsights: { type: "string" },
                nextAction: { type: "string" },
                score: { type: "number" },
              },
              required: ["interestLevel", "sentiment", "keyInsights", "nextAction", "score"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = response.choices[0]?.message?.content;
      const analysis = content ? JSON.parse(content) : {};

      return { leadId: input.leadId, analysis };
    }),

  getPatterns: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];

    return db.select().from(searchBehaviorLogs)
      .orderBy(desc(searchBehaviorLogs.createdAt))
      .limit(50);
  }),
});
