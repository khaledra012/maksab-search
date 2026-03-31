// @ts-nocheck
/**
 * إعدادات الذكاء الاصطناعي: دعم OpenAI مع Gemini المباشر من السيرفر
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { aiSettings } from "../../drizzle/schema";

const providerSchema = z.enum(["openai", "gemini", "builtin"]);
type SupportedAiProvider = z.infer<typeof providerSchema>;

const normalizeProviderForClient = (provider: string | null | undefined) =>
  provider === "builtin" ? "gemini" : provider ?? "gemini";

const normalizeProviderForStorage = (provider: SupportedAiProvider) =>
  provider === "gemini" ? "builtin" : provider;

// ===== مساعد: استدعاء OpenAI مباشرة =====
async function callOpenAI({
  apiKey,
  model,
  systemPrompt,
  userMessage,
  temperature,
  maxTokens,
}: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userMessage: string;
  temperature: number;
  maxTokens: number;
}): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as any)?.error?.message || `OpenAI error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

// ===== مساعد: استدعاء Gemini =====
async function callGemini({
  apiKey,
  model,
  systemPrompt,
  userMessage,
}: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userMessage: string;
}): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userMessage }] }],
      }),
    }
  );
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as any)?.error?.message || `Gemini error: ${response.status}`);
  }
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// ===== مساعد: استدعاء Claude =====
async function callClaude({
  apiKey,
  model,
  systemPrompt,
  userMessage,
  maxTokens,
}: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userMessage: string;
  maxTokens: number;
}): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as any)?.error?.message || `Claude error: ${response.status}`);
  }
  const data = await response.json();
  return data.content?.[0]?.text || "";
}

// ===== مساعد: استدعاء Groq =====
async function callGroq({
  apiKey,
  model,
  systemPrompt,
  userMessage,
  temperature,
  maxTokens,
}: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userMessage: string;
  temperature: number;
  maxTokens: number;
}): Promise<string> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature,
      max_tokens: maxTokens,
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as any)?.error?.message || `Groq error: ${response.status}`);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

export const aiSettingsRouter = router({
  // ===== جلب الإعدادات =====
  getSettings: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;
    const [settings] = await db.select().from(aiSettings).limit(1);
    if (!settings) return null;
    return {
      ...settings,
      provider: normalizeProviderForClient(settings.provider),
      openaiApiKey: settings.openaiApiKey ? `sk-...${settings.openaiApiKey.slice(-4)}` : null,
      hasApiKey: !!settings.openaiApiKey,
    };
  }),

  // ===== حفظ الإعدادات =====
  saveSettings: protectedProcedure
    .input(z.object({
      provider: providerSchema.default("gemini"),
      openaiApiKey: z.string().optional(),
      openaiModel: z.string().default("gpt-4o-mini"),
      systemPrompt: z.string().optional(),
      analysisStyle: z.enum(["balanced", "aggressive", "conservative", "detailed"]).optional(),
      analysisPrompt: z.string().optional(),
      brandTone: z.enum(["professional", "friendly", "formal", "casual"]).optional(),
      countryContext: z.enum(["saudi", "gulf", "arabic", "international"]).optional(),
      temperature: z.number().min(0).max(2).default(0.7),
      maxTokens: z.number().min(50).max(4000).default(500),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [existing] = await db.select().from(aiSettings).limit(1);

      const updateData: Record<string, unknown> = {
        provider: normalizeProviderForStorage(input.provider),
        openaiModel: input.openaiModel,
        systemPrompt: input.systemPrompt ?? null,
        temperature: input.temperature,
        maxTokens: input.maxTokens,
        analysisStyle: input.analysisStyle ?? "balanced",
        analysisPrompt: input.analysisPrompt ?? null,
        brandTone: input.brandTone ?? "professional",
        countryContext: input.countryContext ?? "saudi",
      };

      // تحديث API Keys فقط إذا أُرسلت قيم جديدة
      if (input.openaiApiKey && input.openaiApiKey.startsWith("sk-")) {
        updateData.openaiApiKey = input.openaiApiKey;
      }

      if (existing) {
        await db.update(aiSettings).set(updateData).where(eq(aiSettings.id, existing.id));
      } else {
        await db.insert(aiSettings).values({ ...updateData } as any);
      }

      return { success: true };
    }),

  // ===== اختبار الاتصال =====
  testConnection: protectedProcedure
    .input(z.object({
      provider: providerSchema.default("gemini"),
      apiKey: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [settings] = await db.select().from(aiSettings).limit(1);
      const normalizedProvider = normalizeProviderForClient(input.provider);
      const testMessage = "مرحباً، هذا اختبار اتصال. رد بجملة قصيرة باللغة العربية.";
      const systemPrompt = "أنت مساعد مفيد.";

      try {
        let reply = "";

        if (normalizedProvider === "openai") {
          const apiKey = input.apiKey || settings?.openaiApiKey;
          if (!apiKey) throw new Error("لم يتم إدخال OpenAI API Key");
          reply = await callOpenAI({
            apiKey,
            model: settings?.openaiModel || "gpt-4o-mini",
            systemPrompt,
            userMessage: testMessage,
            temperature: 0.7,
            maxTokens: 100,
          });
        } else if (input.apiKey) {
          const apiKey = input.apiKey;
          if (!apiKey) throw new Error("لم يتم إدخال Gemini API Key");
          reply = await callGemini({
            apiKey,
            model: "gemini-1.5-flash",
            systemPrompt,
            userMessage: testMessage,
          });
        } else if (input.provider === "claude") {
          const apiKey = input.apiKey || (settings as any)?.claudeApiKey;
          if (!apiKey) throw new Error("لم يتم إدخال Claude API Key");
          reply = await callClaude({
            apiKey,
            model: (settings as any)?.claudeModel || "claude-3-haiku-20240307",
            systemPrompt,
            userMessage: testMessage,
            maxTokens: 100,
          });
        } else if (input.provider === "groq") {
          const apiKey = input.apiKey || (settings as any)?.groqApiKey;
          if (!apiKey) throw new Error("لم يتم إدخال Groq API Key");
          reply = await callGroq({
            apiKey,
            model: (settings as any)?.groqModel || "llama-3.1-8b-instant",
            systemPrompt,
            userMessage: testMessage,
            temperature: 0.7,
            maxTokens: 100,
          });
        } else {
          // Gemini عبر مفتاح السيرفر المعرّف في env
          const { invokeLLM } = await import("../_core/llm");
          const resp = await invokeLLM({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: testMessage },
            ],
          });
          reply = resp.choices?.[0]?.message?.content || "";
        }

        return { success: true, provider: normalizedProvider, reply };
      } catch (e: any) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: e.message || "فشل الاتصال",
        });
      }
    }),
});
