/**
 * AI Enrichment Agent
 * ====================
 * يُكمل الحقول الناقصة في نتائج البحث مباشرةً بعد الجلب وقبل الحفظ.
 *
 * المدخل:  DiscoveryCandidate[] (نتائج خام من البحث)
 * المخرج:  DiscoveryCandidate[] (نفس النتائج مع حقول مُكملة)
 *
 * ما يفعله:
 *  1. يجمع النص الخام (bio + displayName + url + snippet) لكل مرشح
 *  2. يُرسله إلى LLM مع prompt متخصص لاستخراج:
 *     - رقم الهاتف السعودي (0501234567 أو +966501234567)
 *     - الموقع الإلكتروني (https://example.com)
 *     - حسابات السوشيال (instagram/tiktok/snapchat/x/telegram)
 *     - المدينة السعودية
 *     - تصنيف النشاط التجاري
 *  3. يُدمج النتائج مع الحقول الموجودة (لا يُلغي ما هو موجود)
 *  4. يُضيف حقل aiEnriched: true للتمييز
 *
 * القواعد الصارمة:
 *  - لا يُخمّن ما لا يوجد في النص
 *  - لا يُنشئ بيانات وهمية
 *  - إذا لم يجد شيئاً → يُبقي الحقل فارغاً
 *  - يُعالج دفعات من 5 مرشحين في طلب LLM واحد لتوفير الوقت
 */

import { invokeLLM } from "../_core/llm";
import type { DiscoveryCandidate } from "../../shared/types/lead-intelligence";

// ─── أنواع ────────────────────────────────────────────────────────────────────

export interface AIEnrichmentResult {
  /** معرف المرشح الأصلي */
  candidateId: string;
  /** هل نجح الإثراء؟ */
  success: boolean;
  /** الحقول التي تم استخراجها */
  extracted: {
    phones?: string[];
    website?: string;
    instagram?: string;
    tiktok?: string;
    snapchat?: string;
    x?: string;
    telegram?: string;
    city?: string;
    category?: string;
  };
  /** سبب الفشل إن وجد */
  error?: string;
  /** وقت المعالجة بالميلي ثانية */
  processingMs: number;
}

export interface AIEnrichmentSummary {
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  fieldsExtracted: {
    phones: number;
    websites: number;
    socialHandles: number;
    cities: number;
    categories: number;
  };
  processingMs: number;
}

// ─── الـ Prompt ───────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `أنت محلل بيانات متخصص في استخراج معلومات الأعمال السعودية من النصوص.

مهمتك: استخراج المعلومات التالية من النص المُعطى لكل نشاط تجاري:
1. رقم الهاتف السعودي (يبدأ بـ 05 أو +9665 أو 009665)
2. الموقع الإلكتروني (https://...)
3. حسابات السوشيال ميديا (instagram/tiktok/snapchat/x/telegram)
4. المدينة السعودية (الرياض/جدة/مكة/المدينة/الدمام/الخبر/الطائف/أبها/تبوك...)
5. تصنيف النشاط التجاري (مطعم/ملحمة/محل ملابس/صالون/...)

القواعد الصارمة:
- استخرج فقط ما هو موجود صراحةً في النص
- لا تُخمّن أو تُنشئ بيانات
- إذا لم تجد المعلومة → اتركها null
- أرقام الهاتف: تطبيع إلى صيغة 05XXXXXXXX (10 أرقام)
- حسابات السوشيال: استخرج username فقط بدون @ أو رابط كامل

أرجع JSON بالشكل التالي لكل نشاط:
{
  "id": "معرف النشاط",
  "phones": ["05XXXXXXXX"] أو [],
  "website": "https://..." أو null,
  "instagram": "username" أو null,
  "tiktok": "username" أو null,
  "snapchat": "username" أو null,
  "x": "username" أو null,
  "telegram": "username" أو null,
  "city": "اسم المدينة" أو null,
  "category": "تصنيف النشاط" أو null
}`;

// ─── تجميع النص الخام لمرشح واحد ─────────────────────────────────────────────

function buildCandidateText(candidate: DiscoveryCandidate): string {
  const parts: string[] = [];

  if (candidate.nameHint) parts.push(`الاسم: ${candidate.nameHint}`);
  if (candidate.businessNameHint && candidate.businessNameHint !== candidate.nameHint) {
    parts.push(`اسم العمل: ${candidate.businessNameHint}`);
  }
  if (candidate.usernameHint) parts.push(`المستخدم: ${candidate.usernameHint}`);
  if (candidate.url) parts.push(`الرابط: ${candidate.url}`);
  if (candidate.categoryHint) parts.push(`التصنيف: ${candidate.categoryHint}`);
  if (candidate.cityHint) parts.push(`المدينة: ${candidate.cityHint}`);

  // النص الخام من المصدر
  const raw = candidate.raw as Record<string, unknown> | null;
  if (raw) {
    if (raw.bio) parts.push(`البيو: ${String(raw.bio).slice(0, 500)}`);
    if (raw.description) parts.push(`الوصف: ${String(raw.description).slice(0, 300)}`);
    if (raw.snippet) parts.push(`المقتطف: ${String(raw.snippet).slice(0, 300)}`);
    if (raw.address) parts.push(`العنوان: ${String(raw.address)}`);
    if (raw.phone) parts.push(`هاتف مباشر: ${String(raw.phone)}`);
    if (raw.website) parts.push(`موقع مباشر: ${String(raw.website)}`);
  }

  return parts.join("\n");
}

// ─── تطبيع رقم الهاتف ────────────────────────────────────────────────────────

function normalizePhoneNumber(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("966") && digits.length === 12) {
    return "0" + digits.slice(3);
  }
  if (digits.startsWith("00966") && digits.length === 14) {
    return "0" + digits.slice(5);
  }
  if (digits.startsWith("05") && digits.length === 10) {
    return digits;
  }
  if (digits.startsWith("5") && digits.length === 9) {
    return "0" + digits;
  }
  return null;
}

// ─── معالجة دفعة واحدة من المرشحين ──────────────────────────────────────────

async function enrichBatch(
  batch: DiscoveryCandidate[]
): Promise<AIEnrichmentResult[]> {
  const startMs = Date.now();

  // بناء النص المُرسل للـ LLM
  const batchText = batch
    .map((c, i) => `--- نشاط ${i + 1} (id: ${c.id}) ---\n${buildCandidateText(c)}`)
    .join("\n\n");

  const userMessage = `استخرج المعلومات من الأنشطة التالية وأرجع JSON array:\n\n${batchText}`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "enrichment_results",
          strict: true,
          schema: {
            type: "object",
            properties: {
              results: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    phones: { type: "array", items: { type: "string" } },
                    website: { anyOf: [{ type: "string" }, { type: "null" }] },
                    instagram: { anyOf: [{ type: "string" }, { type: "null" }] },
                    tiktok: { anyOf: [{ type: "string" }, { type: "null" }] },
                    snapchat: { anyOf: [{ type: "string" }, { type: "null" }] },
                    x: { anyOf: [{ type: "string" }, { type: "null" }] },
                    telegram: { anyOf: [{ type: "string" }, { type: "null" }] },
                    city: { anyOf: [{ type: "string" }, { type: "null" }] },
                    category: { anyOf: [{ type: "string" }, { type: "null" }] },
                  },
                  required: ["id", "phones", "website", "instagram", "tiktok", "snapchat", "x", "telegram", "city", "category"],
                  additionalProperties: false,
                },
              },
            },
            required: ["results"],
            additionalProperties: false,
          },
        },
      },
    });

    const rawContent = response.choices?.[0]?.message?.content;
    if (!rawContent) throw new Error("LLM returned empty response");
    const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);

    const parsed = JSON.parse(content) as {
      results: Array<{
        id: string;
        phones: string[];
        website: string | null;
        instagram: string | null;
        tiktok: string | null;
        snapchat: string | null;
        x: string | null;
        telegram: string | null;
        city: string | null;
        category: string | null;
      }>;
    };

    const processingMs = Date.now() - startMs;

    return parsed.results.map((r) => ({
      candidateId: r.id,
      success: true,
      extracted: {
        phones: r.phones
          .map(normalizePhoneNumber)
          .filter((p): p is string => p !== null),
        website: r.website || undefined,
        instagram: r.instagram || undefined,
        tiktok: r.tiktok || undefined,
        snapchat: r.snapchat || undefined,
        x: r.x || undefined,
        telegram: r.telegram || undefined,
        city: r.city || undefined,
        category: r.category || undefined,
      },
      processingMs,
    }));
  } catch (err) {
    const processingMs = Date.now() - startMs;
    // عند الفشل → نُرجع نتائج فارغة لكل مرشح في الدفعة
    return batch.map((c) => ({
      candidateId: c.id,
      success: false,
      extracted: {},
      error: err instanceof Error ? err.message : String(err),
      processingMs,
    }));
  }
}

// ─── الدالة الرئيسية: إثراء دفعة من المرشحين ─────────────────────────────────

/**
 * يُثري مجموعة من المرشحين بالذكاء الاصطناعي.
 * يُعدّل المرشحين في مكانهم (in-place) ويُرجع ملخص الإثراء.
 *
 * @param candidates - المرشحون المراد إثراؤهم
 * @param batchSize - حجم الدفعة لكل طلب LLM (افتراضي: 5)
 * @returns ملخص الإثراء
 */
export async function enrichCandidatesWithAI(
  candidates: DiscoveryCandidate[],
  batchSize = 5
): Promise<AIEnrichmentSummary> {
  const startMs = Date.now();

  // تصفية المرشحين الذين يحتاجون إثراء (لديهم نص كافٍ)
  const needsEnrichment = candidates.filter((c) => {
    const hasText =
      (c.nameHint && c.nameHint.length > 2) ||
      (c.businessNameHint && c.businessNameHint.length > 2) ||
      (c.raw as Record<string, unknown>)?.bio ||
      (c.raw as Record<string, unknown>)?.description ||
      (c.raw as Record<string, unknown>)?.snippet;
    return hasText;
  });

  if (needsEnrichment.length === 0) {
    return {
      totalProcessed: 0,
      successCount: 0,
      failureCount: 0,
      fieldsExtracted: { phones: 0, websites: 0, socialHandles: 0, cities: 0, categories: 0 },
      processingMs: 0,
    };
  }

  // تقسيم إلى دفعات
  const batches: DiscoveryCandidate[][] = [];
  for (let i = 0; i < needsEnrichment.length; i += batchSize) {
    batches.push(needsEnrichment.slice(i, i + batchSize));
  }

  // معالجة الدفعات بالتوازي (حد أقصى 3 طلبات متزامنة)
  const MAX_CONCURRENT = 3;
  const allResults: AIEnrichmentResult[] = [];

  for (let i = 0; i < batches.length; i += MAX_CONCURRENT) {
    const concurrentBatches = batches.slice(i, i + MAX_CONCURRENT);
    const batchResults = await Promise.all(concurrentBatches.map(enrichBatch));
    allResults.push(...batchResults.flat());
  }

  // بناء خريطة النتائج
  const resultMap = new Map<string, AIEnrichmentResult>();
  for (const result of allResults) {
    resultMap.set(result.candidateId, result);
  }

  // تطبيق النتائج على المرشحين (in-place)
  let successCount = 0;
  let failureCount = 0;
  const fieldsExtracted = { phones: 0, websites: 0, socialHandles: 0, cities: 0, categories: 0 };

  for (const candidate of needsEnrichment) {
    const result = resultMap.get(candidate.id);
    if (!result) continue;

    if (!result.success) {
      failureCount++;
      continue;
    }

    successCount++;
    const { extracted } = result;

    // ─── دمج الهواتف ───────────────────────────────────────────────────
    if (extracted.phones && extracted.phones.length > 0) {
      const newPhones = extracted.phones.filter(
        (p) => !candidate.verifiedPhones.includes(p) && !candidate.candidatePhones.includes(p)
      );
      if (newPhones.length > 0) {
        candidate.candidatePhones = [...candidate.candidatePhones, ...newPhones];
        fieldsExtracted.phones += newPhones.length;
      }
    }

    // ─── دمج الموقع الإلكتروني ────────────────────────────────────────
    if (extracted.website && !candidate.verifiedWebsite) {
      candidate.verifiedWebsite = extracted.website;
      fieldsExtracted.websites++;
    }

    // ─── دمج المدينة ──────────────────────────────────────────────────
    if (extracted.city && !candidate.cityHint) {
      candidate.cityHint = extracted.city;
      fieldsExtracted.cities++;
    }

    // ─── دمج التصنيف ──────────────────────────────────────────────────
    if (extracted.category && !candidate.categoryHint) {
      candidate.categoryHint = extracted.category;
      fieldsExtracted.categories++;
    }

    // ─── دمج حسابات السوشيال في raw ──────────────────────────────────
    const socialHandles: Record<string, string> = {};
    if (extracted.instagram) socialHandles.instagram = extracted.instagram;
    if (extracted.tiktok) socialHandles.tiktok = extracted.tiktok;
    if (extracted.snapchat) socialHandles.snapchat = extracted.snapchat;
    if (extracted.x) socialHandles.x = extracted.x;
    if (extracted.telegram) socialHandles.telegram = extracted.telegram;

    if (Object.keys(socialHandles).length > 0) {
      const existingHandles =
        ((candidate.raw as Record<string, unknown>)?.crossPlatformHandles as Record<string, string>) || {};
      candidate.raw = {
        ...(candidate.raw as Record<string, unknown> || {}),
        crossPlatformHandles: { ...socialHandles, ...existingHandles },
        aiEnriched: true,
      };
      fieldsExtracted.socialHandles += Object.keys(socialHandles).length;
    } else {
      // نُضيف علامة aiEnriched حتى لو لم نجد سوشيال
      candidate.raw = {
        ...(candidate.raw as Record<string, unknown> || {}),
        aiEnriched: true,
      };
    }
  }

  return {
    totalProcessed: needsEnrichment.length,
    successCount,
    failureCount,
    fieldsExtracted,
    processingMs: Date.now() - startMs,
  };
}

// ─── دالة مساعدة: إثراء مرشح واحد ───────────────────────────────────────────

export async function enrichSingleCandidate(
  candidate: DiscoveryCandidate
): Promise<AIEnrichmentResult> {
  const results = await enrichBatch([candidate]);
  return results[0];
}
