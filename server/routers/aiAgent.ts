/**
 * AI Agent Router - وكيل ذكاء اصطناعي يعمل كموظف بشري
 * يبحث، يحلل، يقيّم، يقترح، ويتابع تلقائياً
 * بروتوكول مكسب-تدوين: استخبارات استراتيجية للسوق السعودي
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { getDb } from "../db";
import { leads, agentTasks, agentLogs } from "../../drizzle/schema";
import { eq, desc, and, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

// ===== Types =====
const AgentTaskTypeSchema = z.enum([
  "prospect_research",    // بحث عن عملاء محتملين جدد
  "lead_qualification",   // تأهيل وتقييم عميل موجود
  "competitor_analysis",  // تحليل المنافسين لعميل
  "outreach_draft",       // صياغة رسائل تواصل
  "market_scan",          // مسح السوق في قطاع معين
  "follow_up_plan",       // خطة متابعة عملاء
  "data_enrichment",      // إثراء بيانات عملاء ناقصة
]);

const AgentStatusSchema = z.enum([
  "pending", "running", "completed", "failed", "paused"
]);

// ===== Agent Core Engine =====
async function runAgentStep(
  taskType: string,
  context: Record<string, unknown>,
  previousSteps: Array<{ step: string; result: string }> = []
): Promise<{ step: string; result: string; nextAction: string; confidence: number }> {
  
  const previousContext = previousSteps.length > 0
    ? `\n\nالخطوات السابقة:\n${previousSteps.map(s => `- ${s.step}: ${s.result}`).join("\n")}`
    : "";

  const systemPrompt = `أنت وكيل ذكاء اصطناعي متخصص في استخبارات السوق السعودي.
تعمل كمستشار استراتيجي أول تحت بروتوكول مكسب-تدوين.
مهمتك: دمج منطق التسويق مع الصرامة المالية لإنتاج قرارات مبنية على بيانات موثّقة.

قواعد عملك:
1. ترجم كل طلب إلى هدفه التجاري أولاً
2. تحدّ الافتراضات الضعيفة وأزل الإشارات منخفضة الثقة
3. تحقق من التوافق مع السوق السعودي
4. فضّل الأدلة الموثّقة على التخمين
5. إذا كانت البيانات ضعيفة، خفّض مستوى الثقة بدلاً من التخمين

أجب بـ JSON فقط.`;

  const userPrompt = `نوع المهمة: ${taskType}
السياق: ${JSON.stringify(context, null, 2)}${previousContext}

قم بتنفيذ الخطوة التالية المنطقية وأجب بـ JSON بهذا الشكل:
{
  "step": "اسم الخطوة المنفذة",
  "result": "نتيجة تفصيلية للخطوة",
  "insights": ["رؤية 1", "رؤية 2"],
  "nextAction": "الإجراء التالي المقترح",
  "confidence": 0.85,
  "recommendations": ["توصية 1", "توصية 2"],
  "redFlags": ["تحذير 1"] 
}`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" } as any,
  });

  const content = typeof response.choices[0].message.content === "string"
    ? response.choices[0].message.content
    : JSON.stringify(response.choices[0].message.content);

  try {
    return JSON.parse(content);
  } catch {
    return {
      step: "تحليل",
      result: content,
      nextAction: "مراجعة النتائج",
      confidence: 0.5,
    };
  }
}

// ===== Prospect Research Engine =====
async function runProspectResearch(params: {
  businessType: string;
  city: string;
  targetCount: number;
  criteria?: string;
}): Promise<{ prospects: Array<{ name: string; reasoning: string; score: number; searchQuery: string }> }> {
  
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `أنت خبير في البحث عن العملاء المحتملين في السوق السعودي.
مهمتك: توليد قائمة بحثية استراتيجية لإيجاد عملاء محتملين حقيقيين.
أجب بـ JSON فقط.`,
      },
      {
        role: "user",
        content: `ابحث عن عملاء محتملين بهذه المعايير:
- نوع النشاط: ${params.businessType}
- المدينة: ${params.city}
- العدد المطلوب: ${params.targetCount}
${params.criteria ? `- معايير إضافية: ${params.criteria}` : ""}

أنتج قائمة بحثية بـ JSON:
{
  "searchStrategy": "استراتيجية البحث المقترحة",
  "searchQueries": ["استعلام بحث 1", "استعلام بحث 2"],
  "targetProfile": "وصف العميل المثالي",
  "qualificationCriteria": ["معيار 1", "معيار 2"],
  "estimatedMarketSize": "تقدير حجم السوق",
  "topPlatforms": ["المنصة 1", "المنصة 2"],
  "seasonalFactors": "العوامل الموسمية المؤثرة"
}`,
      },
    ],
    response_format: { type: "json_object" } as any,
  });

  const content = typeof response.choices[0].message.content === "string"
    ? response.choices[0].message.content
    : JSON.stringify(response.choices[0].message.content);

  try {
    return JSON.parse(content);
  } catch {
    return { prospects: [] };
  }
}

// ===== Lead Qualification Engine =====
async function qualifyLead(lead: {
  companyName: string;
  businessType?: string | null;
  city?: string | null;
  website?: string | null;
  instagramUrl?: string | null;
  reviewCount?: number | null;
  notes?: string | null;
}): Promise<{
  score: number;
  tier: "A" | "B" | "C" | "D";
  reasoning: string;
  strengths: string[];
  weaknesses: string[];
  recommendedService: string;
  estimatedDealSize: string;
  approachStrategy: string;
}> {
  
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `أنت مستشار مبيعات استراتيجي متخصص في السوق السعودي.
قيّم العميل المحتمل وصنّفه بدقة. أجب بـ JSON فقط.`,
      },
      {
        role: "user",
        content: `قيّم هذا العميل المحتمل:
الاسم: ${lead.companyName}
النشاط: ${lead.businessType || "غير محدد"}
المدينة: ${lead.city || "غير محددة"}
موقع إلكتروني: ${lead.website ? "نعم" : "لا"}
إنستغرام: ${lead.instagramUrl ? "نعم" : "لا"}
عدد المراجعات: ${lead.reviewCount || 0}
ملاحظات: ${lead.notes || "لا يوجد"}

أجب بـ JSON:
{
  "score": 85,
  "tier": "A",
  "reasoning": "سبب التقييم",
  "strengths": ["نقطة قوة 1"],
  "weaknesses": ["نقطة ضعف 1"],
  "recommendedService": "الخدمة المناسبة",
  "estimatedDealSize": "تقدير حجم الصفقة",
  "approachStrategy": "استراتيجية التواصل",
  "bestTimeToContact": "أفضل وقت للتواصل",
  "redFlags": []
}`,
      },
    ],
    response_format: { type: "json_object" } as any,
  });

  const content = typeof response.choices[0].message.content === "string"
    ? response.choices[0].message.content
    : JSON.stringify(response.choices[0].message.content);

  try {
    return JSON.parse(content);
  } catch {
    return {
      score: 50,
      tier: "C",
      reasoning: "تعذّر التقييم",
      strengths: [],
      weaknesses: [],
      recommendedService: "غير محدد",
      estimatedDealSize: "غير محدد",
      approachStrategy: "تواصل مباشر",
    };
  }
}

// ===== Outreach Draft Engine =====
async function draftOutreach(params: {
  leadName: string;
  businessType: string;
  city: string;
  opportunity: string;
  channel: "whatsapp" | "email" | "instagram_dm" | "linkedin";
  tone: "formal" | "casual" | "sales";
}): Promise<{ subject?: string; message: string; followUp: string; callToAction: string }> {
  
  const channelLabels: Record<string, string> = {
    whatsapp: "واتساب",
    email: "بريد إلكتروني",
    instagram_dm: "رسالة إنستغرام",
    linkedin: "رسالة لينكد إن",
  };

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `أنت كاتب محتوى تسويقي متخصص في السوق السعودي.
اكتب رسائل تواصل احترافية وفعّالة. أجب بـ JSON فقط.`,
      },
      {
        role: "user",
        content: `اكتب رسالة تواصل لـ:
العميل: ${params.leadName}
النشاط: ${params.businessType}
المدينة: ${params.city}
الفرصة: ${params.opportunity}
القناة: ${channelLabels[params.channel]}
النبرة: ${params.tone === "formal" ? "رسمية" : params.tone === "casual" ? "ودية" : "مبيعات"}

أجب بـ JSON:
{
  "subject": "عنوان الرسالة (للبريد فقط)",
  "message": "نص الرسالة الكاملة",
  "followUp": "رسالة المتابعة بعد 3 أيام",
  "callToAction": "الإجراء المطلوب من العميل",
  "estimatedResponseRate": "تقدير نسبة الرد"
}`,
      },
    ],
    response_format: { type: "json_object" } as any,
  });

  const content = typeof response.choices[0].message.content === "string"
    ? response.choices[0].message.content
    : JSON.stringify(response.choices[0].message.content);

  try {
    return JSON.parse(content);
  } catch {
    return {
      message: content,
      followUp: "",
      callToAction: "تواصل معنا",
    };
  }
}

// ===== Router =====
export const aiAgentRouter = router({

  // تشغيل مهمة Agent جديدة
  runTask: protectedProcedure
    .input(z.object({
      taskType: AgentTaskTypeSchema,
      context: z.record(z.string(), z.unknown()),
      leadIds: z.array(z.number()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // إنشاء مهمة جديدة
      const insertResult = await db.insert(agentTasks).values({
        userId: ctx.user.id,
        taskType: input.taskType,
        status: "running",
        context: input.context,
        leadIds: input.leadIds || [],
        startedAt: Date.now(),
      });
      const taskId = (insertResult as any).insertId as number;
      const task = { id: taskId };

      try {
        let result: Record<string, unknown> = {};

        switch (input.taskType) {
          case "prospect_research": {
            const ctx2 = input.context as {
              businessType?: string;
              city?: string;
              targetCount?: number;
              criteria?: string;
            };
            result = await runProspectResearch({
              businessType: ctx2.businessType || "عام",
              city: ctx2.city || "الرياض",
              targetCount: ctx2.targetCount || 10,
              criteria: ctx2.criteria,
            });
            break;
          }

          case "lead_qualification": {
            if (!input.leadIds?.length) throw new TRPCError({ code: "BAD_REQUEST", message: "يجب تحديد عملاء للتقييم" });
            const leadsData = await db.select().from(leads).where(inArray(leads.id, input.leadIds as number[]));
            const qualifications = await Promise.all(
              leadsData.map(lead => qualifyLead(lead))
            );
            result = { qualifications: leadsData.map((l, i) => ({ lead: l.companyName, ...qualifications[i] })) };
            break;
          }

          case "outreach_draft": {
            const ctx3 = input.context as {
              leadName?: string;
              businessType?: string;
              city?: string;
              opportunity?: string;
              channel?: "whatsapp" | "email" | "instagram_dm" | "linkedin";
              tone?: "formal" | "casual" | "sales";
            };
            result = await draftOutreach({
              leadName: ctx3.leadName || "العميل",
              businessType: ctx3.businessType || "عام",
              city: ctx3.city || "الرياض",
              opportunity: ctx3.opportunity || "تحسين الحضور الرقمي",
              channel: ctx3.channel || "whatsapp",
              tone: ctx3.tone || "sales",
            });
            break;
          }

          default: {
            const stepResult = await runAgentStep(input.taskType, input.context);
            result = stepResult;
          }
        }

        // تحديث حالة المهمة
        await db.update(agentTasks)
          .set({
            status: "completed",
            result: JSON.stringify(result),
            completedAt: Date.now(),
          })
          .where(eq(agentTasks.id, task.id));

        // تسجيل في logs
        await db.insert(agentLogs).values({
          taskId: task.id,
          userId: ctx.user.id,
          action: `completed_${input.taskType}`,
          details: JSON.stringify({ taskType: input.taskType, resultKeys: Object.keys(result) }),
          timestamp: Date.now(),
        });

        return { taskId: task.id, status: "completed", result };

      } catch (error) {
        await db.update(agentTasks)
          .set({ status: "failed", completedAt: Date.now() })
          .where(eq(agentTasks.id, task.id));
        throw error;
      }
    }),

  // تأهيل عميل واحد بسرعة
  qualifyLead: protectedProcedure
    .input(z.object({
      leadId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [lead] = await db.select().from(leads).where(eq(leads.id, input.leadId));
      if (!lead) throw new TRPCError({ code: "NOT_FOUND" });
      const qualification = await qualifyLead(lead);
      // حفظ النتيجة في lead
      await db.update(leads)
        .set({
          aiConfidenceScore: qualification.score,
          urgencyLevel: (qualification.tier === "A" ? "high" : qualification.tier === "B" ? "high" : "medium") as "high" | "medium" | "low",
          primaryOpportunity: qualification.recommendedService,
          salesEntryAngle: qualification.approachStrategy,
        })
        .where(eq(leads.id, input.leadId));
      return qualification;
    }),

  // صياغة رسالة تواصل لعميل
  draftOutreach: protectedProcedure
    .input(z.object({
      leadId: z.number(),
      channel: z.enum(["whatsapp", "email", "instagram_dm", "linkedin"]).default("whatsapp"),
      tone: z.enum(["formal", "casual", "sales"]).default("sales"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [lead] = await db.select().from(leads).where(eq(leads.id, input.leadId));
      if (!lead) throw new TRPCError({ code: "NOT_FOUND" });
      return draftOutreach({
        leadName: lead.companyName,
        businessType: lead.businessType || "عام",
        city: lead.city || "الرياض",
        opportunity: lead.primaryOpportunity || lead.biggestMarketingGap || "تحسين الحضور الرقمي",
        channel: input.channel,
        tone: input.tone,
      });
    }),

  // بحث استراتيجي عن عملاء محتملين
  prospectResearch: protectedProcedure
    .input(z.object({
      businessType: z.string().min(1),
      city: z.string().min(1),
      targetCount: z.number().min(1).max(50).default(10),
      criteria: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return runProspectResearch(input);
    }),

  // تحليل متعدد الخطوات (multi-step agent)
  runMultiStep: protectedProcedure
    .input(z.object({
      taskType: AgentTaskTypeSchema,
      context: z.record(z.string(), z.unknown()),
      maxSteps: z.number().min(1).max(5).default(3),
    }))
    .mutation(async ({ input }) => {
      const steps: Array<{ step: string; result: string }> = [];
      
      for (let i = 0; i < input.maxSteps; i++) {
        const stepResult = await runAgentStep(input.taskType, input.context, steps);
        steps.push({ step: stepResult.step, result: stepResult.result });
        
        // إذا اكتملت المهمة
        if (stepResult.nextAction === "completed" || stepResult.confidence > 0.9) {
          break;
        }
      }

      return { steps, finalResult: steps[steps.length - 1] };
    }),

  // الحصول على سجل المهام
  getTasks: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select()
        .from(agentTasks)
        .where(eq(agentTasks.userId, ctx.user.id))
        .orderBy(desc(agentTasks.startedAt))
        .limit(input.limit);
    }),

  // الحصول على نتيجة مهمة
  getTaskResult: protectedProcedure
    .input(z.object({ taskId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [task] = await db.select()
        .from(agentTasks)
        .where(and(eq(agentTasks.id, input.taskId), eq(agentTasks.userId, ctx.user.id)));
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });
      return {
        ...task,
        result: task.result ? JSON.parse(task.result as string) : null,
        context: task.context ? JSON.parse(task.context as string) : null,
      };
    }),
});
