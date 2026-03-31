import { router, protectedProcedure } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { getDb } from "../db";
import { whatchimpSettings, whatchimpSendLog, leads } from "../../drizzle/schema";
import { eq, inArray, and, desc, gte, lt, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

const WHATCHIMP_BASE = "https://app.whatchimp.com/api/v1";
type DbClient = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type WhatchimpRuntimeSettings = typeof whatchimpSettings.$inferSelect;

function getEnvWhatchimpSettings(): WhatchimpRuntimeSettings | null {
  const apiToken = process.env.WHATCHIMP_API_TOKEN?.trim() ?? "";
  const phoneNumberId = process.env.WHATCHIMP_PHONE_NUMBER_ID?.trim() ?? "";
  const botFlowUniqueId = process.env.WHATCHIMP_BOT_FLOW_UNIQUE_ID?.trim() ?? "";

  if (!apiToken || !phoneNumberId) {
    return null;
  }

  return {
    id: 0,
    apiToken,
    phoneNumberId,
    defaultLabelId: null,
    defaultLabelName: "Environment",
    botFlowUniqueId: botFlowUniqueId || null,
    isActive: true,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}

async function getWhatchimpSettingsRowsForAdminView(
  db: DbClient
): Promise<WhatchimpRuntimeSettings[]> {
  const envSettings = getEnvWhatchimpSettings();
  if (envSettings) return [envSettings];
  const rows = await db.select().from(whatchimpSettings).limit(1);
  return rows;
}

async function getActiveWhatchimpSettingsRows(
  db: DbClient
): Promise<WhatchimpRuntimeSettings[]> {
  const envSettings = getEnvWhatchimpSettings();
  if (envSettings) return [envSettings];
  const rows = await db
    .select()
    .from(whatchimpSettings)
    .where(eq(whatchimpSettings.isActive, true))
    .limit(1);
  return rows;
}

// ─── Phone validation & normalization ───────────────────────────────────────

/** أنماط الأرقام المدعومة حسب الدولة */
const COUNTRY_PATTERNS: Record<string, { prefix: string; length: number; label: string }[]> = {
  SA: [{ prefix: "966", length: 12, label: "السعودية" }],
  AE: [{ prefix: "971", length: 12, label: "الإمارات" }],
  KW: [{ prefix: "965", length: 11, label: "الكويت" }],
  BH: [{ prefix: "973", length: 11, label: "البحرين" }],
  QA: [{ prefix: "974", length: 11, label: "قطر" }],
  OM: [{ prefix: "968", length: 11, label: "عُمان" }],
  JO: [{ prefix: "962", length: 11, label: "الأردن" }],
  EG: [{ prefix: "20",  length: 12, label: "مصر" }],
};

export type PhoneValidation = {
  raw: string;          // الرقم الأصلي
  normalized: string;   // الرقم بعد التنسيق (دولي)
  valid: boolean;       // هل الرقم صالح؟
  warning?: string;     // تحذير إن وُجد
  country?: string;     // رمز الدولة المكتشف
};

export function validateAndNormalizePhone(phone: string): PhoneValidation {
  if (!phone || !phone.trim()) {
    return { raw: phone, normalized: "", valid: false, warning: "الرقم فارغ" };
  }

  const digits = phone.replace(/\D/g, "");

  // رقم قصير جداً
  if (digits.length < 7) {
    return { raw: phone, normalized: digits, valid: false, warning: `الرقم قصير جداً (${digits.length} أرقام)` };
  }

  // رقم طويل جداً
  if (digits.length > 15) {
    return { raw: phone, normalized: digits, valid: false, warning: `الرقم طويل جداً (${digits.length} أرقام)` };
  }

  // تنسيق سعودي: 05xxxxxxxx → 9665xxxxxxxx
  let normalized = digits;
  let country: string | undefined;

  if (digits.startsWith("966")) {
    normalized = digits;
    country = "SA";
  } else if (digits.startsWith("0") && digits.length === 10) {
    // 05xxxxxxxx → 9665xxxxxxxx
    normalized = "966" + digits.slice(1);
    country = "SA";
  } else if (digits.length === 9 && digits.startsWith("5")) {
    // 5xxxxxxxx → 9665xxxxxxxx
    normalized = "966" + digits;
    country = "SA";
  } else if (digits.startsWith("971")) {
    normalized = digits; country = "AE";
  } else if (digits.startsWith("965")) {
    normalized = digits; country = "KW";
  } else if (digits.startsWith("973")) {
    normalized = digits; country = "BH";
  } else if (digits.startsWith("974")) {
    normalized = digits; country = "QA";
  } else if (digits.startsWith("968")) {
    normalized = digits; country = "OM";
  } else if (digits.startsWith("962")) {
    normalized = digits; country = "JO";
  } else if (digits.startsWith("20")) {
    normalized = digits; country = "EG";
  } else {
    // رقم غير معروف الدولة
    return {
      raw: phone,
      normalized: digits,
      valid: false,
      warning: `تنسيق الرقم غير معروف — تأكد من إضافة رمز الدولة (مثال: 9665XXXXXXXX)`,
    };
  }

  // التحقق من طول الرقم السعودي
  if (country === "SA" && normalized.length !== 12) {
    return {
      raw: phone,
      normalized,
      valid: false,
      country,
      warning: `الرقم السعودي يجب أن يكون 12 رقماً (الحالي: ${normalized.length})`,
    };
  }

  return { raw: phone, normalized, valid: true, country };
}

function normalizePhone(phone: string): string {
  return validateAndNormalizePhone(phone).normalized || phone.replace(/\D/g, "");
}

// ─── Call Whatchimp API ───────────────────────────────────────────────────────
async function whatchimpPost(
  endpoint: string,
  params: Record<string, string | number>
): Promise<{ status: string; message: unknown }> {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    body.append(k, String(v));
  }
  const res = await fetch(`${WHATCHIMP_BASE}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Whatchimp HTTP ${res.status}`);
  return res.json();
}

// ─── Lead type with all fields for Whatchimp ────────────────────────────────
type LeadForWhatchimp = {
  id: number;
  companyName: string;
  verifiedPhone: string | null;
  businessType?: string | null;
  city?: string | null;
  country?: string | null;
  district?: string | null;
  website?: string | null;
  googleMapsUrl?: string | null;
  instagramUrl?: string | null;
  twitterUrl?: string | null;
  snapchatUrl?: string | null;
  tiktokUrl?: string | null;
  facebookUrl?: string | null;
  reviewCount?: number | null;
  leadPriorityScore?: number | null;
  biggestMarketingGap?: string | null;
  suggestedSalesEntryAngle?: string | null;
  stage?: string | null;
  priority?: string | null;
  notes?: string | null;
  crNumber?: string | null;
  socialSince?: string | null;
  revenueOpportunity?: string | null;
  analysisStatus?: string | null;
  email?: string | null;
};// ─── Build professional lead brief for Whatchimp note ──────────────────────────────────────
function buildLeadBrief(lead: LeadForWhatchimp): string {
  const lines: string[] = [];

  // ─── هوية النشاط
  lines.push(`🏢 بريف عميل | نظام مكسب`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`📌 اسم النشاط: ${lead.companyName}`);
  if (lead.businessType) lines.push(`💼 نوع النشاط: ${lead.businessType}`);
  const loc = [lead.city, lead.district].filter(Boolean).join(", ");
  if (loc) lines.push(`📍 الموقع: ${loc}`);
  if (lead.crNumber) lines.push(`📄 سجل تجاري: ${lead.crNumber}`);
  if (lead.email) lines.push(`📧 الإيميل: ${lead.email}`);

  // ─── الحضور الرقمي
  const digitalPresence: string[] = [];
  if (lead.website) digitalPresence.push(`موقع: ${lead.website}`);
  if (lead.instagramUrl) digitalPresence.push(`إنستغرام`);
  if (lead.tiktokUrl) digitalPresence.push(`تيك توك`);
  if (lead.snapchatUrl) digitalPresence.push(`سناب`);
  if (lead.twitterUrl) digitalPresence.push(`تويتر`);
  if (lead.facebookUrl) digitalPresence.push(`فيسبوك`);
  if (lead.googleMapsUrl) digitalPresence.push(`خرائط جوجل`);
  if (digitalPresence.length) {
    lines.push(``);
    lines.push(`🌐 الحضور الرقمي:`);
    lines.push(digitalPresence.join(" · "));
  } else {
    lines.push(``);
    lines.push(`⚠️ لا يوجد حضور رقمي مسجّل`);
  }
  if (lead.reviewCount && lead.reviewCount > 0) {
    lines.push(`⭐ عدد التقييمات: ${lead.reviewCount}`);
  }
  if (lead.socialSince) lines.push(`📅 ظهور على السوشيال منذ: ${lead.socialSince}`);

  // ─── نتائج التحليل
  const hasAnalysis = lead.biggestMarketingGap || lead.revenueOpportunity || lead.suggestedSalesEntryAngle;
  if (hasAnalysis) {
    lines.push(``);
    lines.push(`🔍 نتائج التحليل:`);
    if (lead.biggestMarketingGap) lines.push(`⚡ أكبر ثغرة: ${lead.biggestMarketingGap}`);
    if (lead.revenueOpportunity) lines.push(`💰 فرصة الإيراد: ${lead.revenueOpportunity}`);
    if (lead.suggestedSalesEntryAngle) lines.push(`🎯 زاوية الدخول: ${lead.suggestedSalesEntryAngle}`);
  } else {
    lines.push(``);
    lines.push(`⏳ جاري التحليل التلقائي...`);
  }

  // ─── درجة الأولوية
  if (lead.leadPriorityScore != null) {
    const score = lead.leadPriorityScore;
    const stars = score >= 80 ? "⭐⭐⭐" : score >= 60 ? "⭐⭐" : "⭐";
    lines.push(``);
    lines.push(`📊 درجة الأولوية: ${score}/100 ${stars}`);
  }

  // ─── ملاحظات
  if (lead.notes) {
    lines.push(``);
    lines.push(`📝 ملاحظات: ${lead.notes}`);
  }

  lines.push(``);
  lines.push(`――――――――――――――――――――`);
  lines.push(`📱 مصدر: نظام مكسب لجمع بيانات العملاء`);
  lines.push(`🔗 maksab-sales.xyz`);

  return lines.join("\n");
}

// ─── Build custom fields object for Whatchimp ────────────────────────────────────────────────────
function buildCustomFields(lead: LeadForWhatchimp): Record<string, string> {
  const fields: Record<string, string> = {};

  // نوع النشاط التجاري
  if (lead.businessType) fields["نوع النشاط"] = lead.businessType;

  // الموقع الجغرافي
  const locationParts = [lead.city, lead.district].filter(Boolean);
  if (locationParts.length) fields["المدينة والحي"] = locationParts.join(" - ");

  // الدولة
  if (lead.country) fields["الدولة"] = lead.country === "SA" ? "المملكة العربية السعودية" : lead.country;

  // الموقع الإلكتروني — رسالة احترافية للعميل
  if (lead.website) {
    fields["الموقع الإلكتروني"] =
      `🌐 عندكم موقع إلكتروني — وهذا أساس زين للبداية.\n` +
      `رابط الموقع: ${lead.website}\n\n` +
      `بس وجود الموقع لوحده ما يكفي — السؤال الأهم: هل يجيب عملاء جدد فعلاً؟\n` +
      `هذا اللي نحللّه بالتفصيل في تقريرنا.`;
  }

  // روابط السوشيال ميديا
  if (lead.instagramUrl) fields["إنستجرام"] = lead.instagramUrl;
  if (lead.twitterUrl) fields["تويتر / X"] = lead.twitterUrl;
  if (lead.snapchatUrl) fields["سناب شات"] = lead.snapchatUrl;
  if (lead.tiktokUrl) fields["تيك توك"] = lead.tiktokUrl;
  if (lead.facebookUrl) fields["فيسبوك"] = lead.facebookUrl;

  // خرائط جوجل — رسالة احترافية للعميل
  if (lead.googleMapsUrl) {
    const reviewNote = (lead.reviewCount && lead.reviewCount > 0)
      ? `لديكم ${lead.reviewCount} تقييم على خرائط جوجل — `
      : `حضوركم على خرائط جوجل مسجّل — `;
    fields["خرائط جوجل"] =
      `📍 نشاطكم موجود على خرائط جوجل.\n` +
      `${reviewNote}يعني العملاء يقدرون يلقونكم لما يدورون.\n\n` +
      `السؤال المهم: هل الصفحة محسّنة بالصور والوصف والردود على التقييمات؟\n` +
      `هالتفاصيل هي اللي تخلّي العميل يختاركم قبل المنافس.\n` +
      `رابط الصفحة: ${lead.googleMapsUrl}`;
  } else {
    fields["خرائط جوجل"] =
      `📍 نشاطكم لحد الآن ما هو مسجّل على خرائط جوجل.\n\n` +
      `يعني العملاء اللي يدورون عن ${lead.businessType ?? "نشاطكم"} في المنطقة ما يقدرون يلقونكم.\n` +
      `تسجيل النشاط على خرائط جوجل هي أسرع طريقة تكسبون فيها عملاء جدد من المنطقة المحيطة.`;
  }

  // عدد التقييمات — يُعرض فقط إذا لم يكن هناك رابط خرائط (لتجنب التكرار)
  if (!lead.googleMapsUrl && lead.reviewCount != null && lead.reviewCount > 0) {
    fields["عدد التقييمات"] = String(lead.reviewCount);
  }

  // درجة الأولوية — رسالة استشارية مخصصة للعميل
  if (lead.leadPriorityScore != null) {
    const score = lead.leadPriorityScore;
    let priorityMsg: string;
    if (score >= 80) {
      priorityMsg =
        `🔴 بناءً على تحليلنا الشامل:\n\n` +
        `نشاطكم عنده مقومات نمو استثنائية — البيئة مهيّأة والسوق جاهز والفرصة موجودة.\n` +
        `اللي ينقص بس هو التنفيذ الصح اللي يحوّل هالإمكانات لنتائج ملموسة.`;
    } else if (score >= 60) {
      priorityMsg =
        `🟠 بناءً على تحليلنا الشامل:\n\n` +
        `نشاطكم في مرحلة زينة وعنده فرص حقيقية للتوسع.\n` +
        `التحرك السريع الحين يضمن لكم السبق قبل ما يستغلّها المنافسين.`;
    } else if (score >= 40) {
      priorityMsg =
        `🟡 بناءً على تحليلنا الشامل:\n\n` +
        `نشاطكم عنده إمكانات زينة بس تحتاج تطوير مدروس.\n` +
        `بخطة محكمة نقدر نحوّل هالإمكانات لنتائج ملموسة خلال فترة قصيرة.`;
    } else {
      priorityMsg =
        `🟢 بناءً على تحليلنا الشامل:\n\n` +
        `نشاطكم في مرحلة تأسيس ويحتاج بناء قاعدة رقمية متينة قبل أي خطوة ثانية.\n` +
        `البداية الصح تضمن لكم نتائج حقيقية من أي استثمار تسويقي.`;
    }
    fields["درجة الأولوية"] = priorityMsg;
  }

  // أكبر ثغرة تسويقية — شرح تفصيلي للعميل السعودي
  if (lead.biggestMarketingGap) {
    const gap = lead.biggestMarketingGap.trim();
    // كشف نوع الثغرة من النص
    const isSEO = /سيو|seo|محركات بحث|جوجل|ظهور/i.test(gap);
    const isSocial = /سوشيال|إنستغرام|تيك توك|سناب|تويتر|فيسبوك|منصة|محتوى/i.test(gap);
    const isMaps = /خرائط|جوجل مابس|تقييمات|موقع جغرافي/i.test(gap);
    let gapType = "";
    if (isSEO) gapType = "ظهوركم في محركات البحث (SEO)";
    else if (isSocial) gapType = "حضوركم على منصات التواصل الاجتماعي";
    else if (isMaps) gapType = "تواجدكم على خرائط جوجل";
    else gapType = "الحضور الرقمي الشامل";

    fields["أكبر ثغرة تسويقية"] =
      `⚡ تشخيص تسويقي حصري:\n\n` +
      `رصدنا ثغرة محورية في ${gapType}:\n` +
      `${gap}\n\n` +
      `هالثغرة تعني بشكل مباشر أن العملاء المحتملين ما يلقونكم لما يدورون عن ${lead.businessType ?? "خدماتكم"}.\n` +
      `سكّر هالثغرة يعني نمو ملموس في عدد العملاء اللي يجونكم بشكل عضوي.`;
  }

  // زاوية الدخول البيعية — صياغة احترافية جاهزة للعميل
  if (lead.suggestedSalesEntryAngle) {
    const angle = lead.suggestedSalesEntryAngle.trim();
    fields["زاوية الدخول البيعية"] =
      `🎯 توصية استراتيجية مخصصة:\n\n` +
      `${angle}\n\n` +
      `هذا المسار هو الأقصر والأكثر فاعلية لتحويل حضوركم الرقمي لمبيعات حقيقية.`;
  }

  // مرحلة العميل
  const stageMap: Record<string, string> = {
    new: "جديد", contacted: "تم التواصل", interested: "مهتم",
    proposal: "عرض مقدم", won: "تم الإغلاق", lost: "خسرنا",
  };
  if (lead.stage) fields["مرحلة العميل"] = stageMap[lead.stage] ?? lead.stage;

  // الأولوية
  const priorityMap: Record<string, string> = { high: "عالية", medium: "متوسطة", low: "منخفضة" };
  if (lead.priority) fields["الأولوية"] = priorityMap[lead.priority] ?? lead.priority;

  // رقم السجل التجاري
  if (lead.crNumber) fields["السجل التجاري"] = lead.crNumber;

  // الإيميل
  if (lead.email) fields["الإيميل"] = lead.email;

  // تاريخ الظهور على السوشيال
  if (lead.socialSince) fields["تاريخ الظهور على السوشيال"] = lead.socialSince;

  // ملاحظات
  if (lead.notes) fields["ملاحظات"] = lead.notes;

  // فرصة الإيراد — شرح كيفية زيادة الأرباح بدون أرقام
  if ((lead as any).revenueOpportunity) {
    const rev = ((lead as any).revenueOpportunity as string).trim();
    fields["فرصة الإيراد"] =
      `💰 بناءً على تحليلنا:\n\n` +
      `${rev}\n\n` +
      `وهالفرصة ما تحتاج ميزانية إضافية كبيرة — بس تبي لها توجيه صح للموجود عندكم أصلاً.\n` +
      `العملاء اللي حواليكم يدورون عن ${lead.businessType ?? "ما تقدمونه"} — السؤال: هل يلقونكم ولا يلقون منافسيكم؟`;
  }

  // مصدر البيانات
  fields["مصدر البيانات"] = "نظام مكسب - مجمع البيانات";

  return fields;
}

// ─── Summarize notes using LLM ────────────────────────────────────────────
async function summarizeNotes(notes: string, businessName: string, businessType?: string | null): Promise<string> {
  if (!notes || notes.trim().length < 50) return notes; // لا تلخيص للنصوص القصيرة
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `أنت مستشار تسويقي خبير. مهمتك تلخيص ملاحظات العميل في 4 أسطر بالضبط باللهجة السعودية الخليجية الاحترافية. الملخص يجب أن:
- يكون مدعوماً بالتحليل ويعكس أهم ما جاء في الملاحظات
- يخاطب العميل مباشرة (بصيغة المخاطب)
- يكون احترافياً ومقنعاً دون مبالغة
- لا يتجاوز 4 أسطر نهائياً
- لا يذكر اسم العميل في الملخص`,
        },
        {
          role: "user",
          content: `النشاط: ${businessName}${businessType ? ` (${businessType})` : ""}
الملاحظات:
${notes}

لخص هذه الملاحظات في 4 أسطر باللهجة السعودية الخليجية الاحترافية.`,
        },
      ],
    });
    const rawContent = response?.choices?.[0]?.message?.content;
    const summary = typeof rawContent === "string" ? rawContent : null;
    return summary ? `📝 ملخص الملاحظات:\n${summary.trim()}` : notes;
  } catch {
    return notes; // في حالة فشل الذكاء الاصطناعي نرجع النص الأصلي
  }
}

// ─── Send one lead to Whatchimp ───────────────────────────────────────────────
async function sendLeadToWhatchimp(
  settings: typeof whatchimpSettings.$inferSelect,
  lead: LeadForWhatchimp,
  batchId?: string,
  userId?: number
): Promise<{ success: boolean; phone: string; waMessageId?: string; error?: string }> {
  const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  const rawPhone = lead.verifiedPhone;

  if (!rawPhone) {
    await db.insert(whatchimpSendLog).values({
      leadId: lead.id,
      leadName: lead.companyName,
      phone: "",
      status: "skipped",
      errorMessage: "لا يوجد رقم هاتف",
      batchId,
      sentByUserId: userId,
    });
    return { success: false, phone: "", error: "لا يوجد رقم هاتف" };
  }

  const phone = normalizePhone(rawPhone);

  try {
    // 1. Create subscriber
    // NOTE: subscriber/create uses camelCase params (phoneNumberID, phoneNumber, name)
    // unlike other endpoints which use snake_case. See Whatchimp API docs.
    const subRes = await whatchimpPost("/whatsapp/subscriber/create", {
      apiToken: settings.apiToken,
      phoneNumberID: settings.phoneNumberId,
      phoneNumber: phone,
      name: lead.companyName,
    });

    // 2. Assign custom fields with lead data (non-fatal)
    try {
      // تلخيص الملاحظات بالذكاء الاصطناعي إن وجدت
      const leadWithSummarizedNotes = { ...lead };
      if (lead.notes && lead.notes.trim().length >= 50) {
        leadWithSummarizedNotes.notes = await summarizeNotes(lead.notes, lead.companyName, lead.businessType);
      }
      const customFields = buildCustomFields(leadWithSummarizedNotes);
      if (Object.keys(customFields).length > 0) {
        await whatchimpPost("/whatsapp/subscriber/chat/assign-custom-fields", {
          apiToken: settings.apiToken,
          phone_number_id: settings.phoneNumberId,
          phone_number: phone,
          custom_fields: JSON.stringify(customFields),
        });
      }
    } catch { /* non-fatal */ }

    // 3. Assign label if configured (non-fatal)
    if (settings.defaultLabelId) {
      try {
        await whatchimpPost("/whatsapp/subscriber/chat/assign-labels", {
          apiToken: settings.apiToken,
          phone_number_id: settings.phoneNumberId,
          phone_number: phone,
          label_ids: String(settings.defaultLabelId),
        });
      } catch { /* non-fatal */ }
    }

    // 4. Add note with lead info (non-fatal)
    try {
      await whatchimpPost("/whatsapp/subscriber/chat/add-notes", {
        apiToken: settings.apiToken,
        phone_number_id: settings.phoneNumberId,
        phone_number: phone,
        note_text: buildLeadBrief(lead),
      });
    } catch { /* non-fatal */ }

    const waMessageId = typeof subRes.message === "string" ? subRes.message : undefined;

    await db.insert(whatchimpSendLog).values({
      leadId: lead.id,
      leadName: lead.companyName,
      phone,
      status: "success",
      waMessageId,
      batchId,
      sentByUserId: userId,
    });

    return { success: true, phone, waMessageId };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "خطأ غير معروف";
    await db.insert(whatchimpSendLog).values({
      leadId: lead.id,
      leadName: lead.companyName,
      phone,
      status: "failed",
      errorMessage,
      batchId,
      sentByUserId: userId,
    });
    return { success: false, phone, error: errorMessage };
  }
}

// ─── Export for internal use (called after analysis completes) ──────────────
export async function sendLeadToWhatchimpInternal(
  settings: typeof whatchimpSettings.$inferSelect,
  lead: LeadForWhatchimp
): Promise<{ success: boolean; phone: string; error?: string }> {
  return sendLeadToWhatchimp(settings, lead, undefined, undefined);
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const whatchimpRouter = router({

  // ── Get settings (admin only) ──────────────────────────────────────────────
  getSettings: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const rows = await getWhatchimpSettingsRowsForAdminView(db);
    const s = rows[0];
    if (!s) return null;
    return {
      ...s,
      apiToken: s.apiToken.slice(0, 8) + "••••••••••••••••••••••",
    };
  }),

  // ── Save / update settings (admin only) ───────────────────────────────────
  saveSettings: protectedProcedure
    .input(z.object({
      apiToken: z.string().min(1), // __KEEP__ = keep existing token
      phoneNumberId: z.string().min(5),
      defaultLabelId: z.number().optional(),
      defaultLabelName: z.string().optional(),
      botFlowUniqueId: z.string().optional(),  // Bot Flow ID لإرسال PDF
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const existing = await db.select().from(whatchimpSettings).limit(1);
      if (existing.length > 0) {
        // If __KEEP__ is sent, don't overwrite the stored token
        if (input.apiToken !== "__KEEP__") {
          await db.update(whatchimpSettings)
            .set({
              apiToken: input.apiToken,
              phoneNumberId: input.phoneNumberId,
              defaultLabelId: input.defaultLabelId ?? null,
              defaultLabelName: input.defaultLabelName ?? null,
              botFlowUniqueId: input.botFlowUniqueId ?? null,
              isActive: true,
            })
            .where(eq(whatchimpSettings.id, existing[0].id));
        } else {
          // Only update non-token fields
          await db.update(whatchimpSettings)
            .set({
              phoneNumberId: input.phoneNumberId,
              defaultLabelId: input.defaultLabelId ?? null,
              defaultLabelName: input.defaultLabelName ?? null,
              botFlowUniqueId: input.botFlowUniqueId ?? null,
              isActive: true,
            })
            .where(eq(whatchimpSettings.id, existing[0].id));
        }
      } else {
        if (input.apiToken === "__KEEP__") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "يجب إدخال API Token" });
        }
        await db.insert(whatchimpSettings).values({
          apiToken: input.apiToken,
          phoneNumberId: input.phoneNumberId,
          defaultLabelId: input.defaultLabelId ?? null,
          defaultLabelName: input.defaultLabelName ?? null,
          botFlowUniqueId: input.botFlowUniqueId ?? null,
          isActive: true,
        });
      }
      return { success: true };
    }),

  // ── Get labels from Whatchimp ──────────────────────────────────────────────
  getLabels: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const rows = await getActiveWhatchimpSettingsRows(db);
    const settings = rows[0];
    if (!settings) throw new TRPCError({ code: "NOT_FOUND", message: "لم يتم ربط Whatchimp بعد" });
    const res = await whatchimpPost("/whatsapp/label/list", {
      apiToken: settings.apiToken,
      phone_number_id: settings.phoneNumberId,
    });
    if (res.status !== "1") throw new TRPCError({ code: "BAD_REQUEST", message: "فشل جلب التصنيفات" });
    return res.message as Array<{ id: number; label_name: string; status: string }>;
  }),

  // ── Test connection ────────────────────────────────────────────────────────
  testConnection: protectedProcedure
    .input(z.object({
      apiToken: z.string(),
      phoneNumberId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      try {
        const res = await whatchimpPost("/whatsapp/label/list", {
          apiToken: input.apiToken,
          phone_number_id: input.phoneNumberId,
        });
        return {
          success: res.status === "1",
          message: res.status === "1" ? "الاتصال ناجح ✓" : "فشل الاتصال",
        };
      } catch {
        return { success: false, message: "فشل الاتصال بـ Whatchimp" };
      }
    }),

  // ── Send single lead ───────────────────────────────────────────────────────
  sendLead: protectedProcedure
    .input(z.object({ leadId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const settingsRows = await getActiveWhatchimpSettingsRows(db);
      const settings = settingsRows[0];
      if (!settings) throw new TRPCError({ code: "NOT_FOUND", message: "لم يتم ربط Whatchimp بعد. تواصل مع الأدمن." });

      const leadRows = await db.select({
        id: leads.id,
        companyName: leads.companyName,
        verifiedPhone: leads.verifiedPhone,
        businessType: leads.businessType,
        city: leads.city,
        country: leads.country,
        district: leads.district,
        website: leads.website,
        googleMapsUrl: leads.googleMapsUrl,
        instagramUrl: leads.instagramUrl,
        twitterUrl: leads.twitterUrl,
        snapchatUrl: leads.snapchatUrl,
        tiktokUrl: leads.tiktokUrl,
        facebookUrl: leads.facebookUrl,
        reviewCount: leads.reviewCount,
        leadPriorityScore: leads.leadPriorityScore,
        biggestMarketingGap: leads.biggestMarketingGap,
        suggestedSalesEntryAngle: leads.suggestedSalesEntryAngle,
        stage: leads.stage,
        priority: leads.priority,
        notes: leads.notes,
        crNumber: leads.crNumber,
        socialSince: leads.socialSince,
        email: leads.email,
        analysisStatus: leads.analysisStatus,
      }).from(leads).where(eq(leads.id, input.leadId)).limit(1);

      if (!leadRows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "العميل غير موجود" });

      return sendLeadToWhatchimp(settings, leadRows[0], undefined, ctx.user.id);
    }),

  // ── Bulk send ──────────────────────────────────────────────────────────────
  sendBulk: protectedProcedure
    .input(z.object({
      leadIds: z.array(z.number()).min(1).max(5000),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const settingsRows = await getActiveWhatchimpSettingsRows(db);
      const settings = settingsRows[0];
      if (!settings) throw new TRPCError({ code: "NOT_FOUND", message: "لم يتم ربط Whatchimp بعد. تواصل مع الأدمن." });

      const batchId = `batch_${Date.now()}_${ctx.user.id}`;

      const leadsData = await db.select({
        id: leads.id,
        companyName: leads.companyName,
        verifiedPhone: leads.verifiedPhone,
        businessType: leads.businessType,
        city: leads.city,
        country: leads.country,
        district: leads.district,
        website: leads.website,
        googleMapsUrl: leads.googleMapsUrl,
        instagramUrl: leads.instagramUrl,
        twitterUrl: leads.twitterUrl,
        snapchatUrl: leads.snapchatUrl,
        tiktokUrl: leads.tiktokUrl,
        facebookUrl: leads.facebookUrl,
        reviewCount: leads.reviewCount,
        leadPriorityScore: leads.leadPriorityScore,
        biggestMarketingGap: leads.biggestMarketingGap,
        suggestedSalesEntryAngle: leads.suggestedSalesEntryAngle,
        stage: leads.stage,
        priority: leads.priority,
        notes: leads.notes,
        crNumber: leads.crNumber,
        socialSince: leads.socialSince,
        email: leads.email,
        analysisStatus: leads.analysisStatus,
      }).from(leads).where(inArray(leads.id, input.leadIds));

      let success = 0, failed = 0, skipped = 0;
      const errors: Array<{ leadId: number; name: string; error: string }> = [];

      for (const lead of leadsData) {
        const result = await sendLeadToWhatchimp(settings, lead, batchId, ctx.user.id);
        if (result.success) success++;
        else if (!lead.verifiedPhone) skipped++;
        else {
          failed++;
          errors.push({ leadId: lead.id, name: lead.companyName, error: result.error ?? "خطأ" });
        }
        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 200));
      }

      return { batchId, total: leadsData.length, success, failed, skipped, errors };
    }),

  // ── Get send history ──────────────────────────────────────────────────────
  getSendHistory: protectedProcedure
    .input(z.object({
      leadId: z.number().optional(),
      limit: z.number().default(50),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const conditions = input.leadId ? [eq(whatchimpSendLog.leadId, input.leadId)] : [];
      return db.select().from(whatchimpSendLog)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(whatchimpSendLog.sentAt))
        .limit(input.limit);
    }),

  // ── Check if settings exist (for UI) ─────────────────────────────────────────────────────
  isConfigured: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const rows = await getActiveWhatchimpSettingsRows(db);
    return { configured: rows.length > 0 };
  }),

  // ── Weekly send stats for dashboard ─────────────────────────────────────────────────────
  getWeeklyStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const now = new Date();
    const startOfThisWeek = new Date(now);
    startOfThisWeek.setDate(now.getDate() - now.getDay());
    startOfThisWeek.setHours(0, 0, 0, 0);

    const startOfLastWeek = new Date(startOfThisWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

    const [thisWeekRows, lastWeekRows, totalRows] = await Promise.all([
      db.select({ count: sql<number>`count(DISTINCT lead_id)` })
        .from(whatchimpSendLog)
        .where(and(eq(whatchimpSendLog.status, "success"), gte(whatchimpSendLog.sentAt, startOfThisWeek))),
      db.select({ count: sql<number>`count(DISTINCT lead_id)` })
        .from(whatchimpSendLog)
        .where(and(
          eq(whatchimpSendLog.status, "success"),
          gte(whatchimpSendLog.sentAt, startOfLastWeek),
          lt(whatchimpSendLog.sentAt, startOfThisWeek)
        )),
      db.select({ count: sql<number>`count(DISTINCT lead_id)` })
        .from(whatchimpSendLog)
        .where(eq(whatchimpSendLog.status, "success")),
    ]);

    const thisWeek = Number(thisWeekRows[0]?.count ?? 0);
    const lastWeek = Number(lastWeekRows[0]?.count ?? 0);
    const total = Number(totalRows[0]?.count ?? 0);
    const growth = lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : (thisWeek > 0 ? 100 : 0);

    return { thisWeek, lastWeek, total, growth };
  }),

  // ── Get Templates List ─────────────────────────────────────────────────────
  getTemplates: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const settings = await getActiveWhatchimpSettingsRows(db);
    if (!settings[0]) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Whatchimp غير مربوط" });
    const { apiToken, phoneNumberId } = settings[0];
    const data = await whatchimpPost("/whatsapp/template/list", { apiToken, phone_number_id: phoneNumberId });
    const templates = Array.isArray(data.message) ? data.message : [];
    return templates.map((t: Record<string, unknown>) => {
      let rawName = "";
      let rawCategory = "";
      let language = "ar";
      try {
        const raw = JSON.parse((t.raw_data as string) || "{}");
        rawName = raw.mixed_template_name || "";
        rawCategory = raw.mixed_template_category || "";
        language = raw.locale || "ar";
      } catch {}
      const vars = t.variable_map ? JSON.parse(t.variable_map as string) : {};
      const bodyVars: string[] = vars.body ? Object.values(vars.body) : [];
      return {
        id: t.id as number,
        name: rawName || String(t.id),
        category: rawCategory,
        status: t.status as string,
        language,
        buttonType: t.button_type as string,
        variables: bodyVars,
      };
    });
  }),

  // ── Send Template Message (single lead) ───────────────────────────────────
  // ── Test Template (no lead required) ─────────────────────────────────────
  testTemplate: protectedProcedure
    .input(z.object({
      phone: z.string().min(10),
      templateName: z.string(),
      languageCode: z.string().default("ar"),
      variables: z.record(z.string(), z.string()).optional(),
      headerDocumentUrl: z.string().url().optional(),      // رابط PDF كـ header مرفق
      headerDocumentFilename: z.string().optional(),       // اسم الملف في واتساب
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const settings = await getActiveWhatchimpSettingsRows(db);
      if (!settings[0]) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Whatchimp غير مربوط" });
      const { apiToken, phoneNumberId } = settings[0];
      const phone = normalizePhone(input.phone);
      const sendParams: Record<string, string | number> = {
        apiToken,
        phone_number_id: phoneNumberId,
        phone_number: phone,
        template_name: input.templateName,
        language_code: input.languageCode,
        ...(input.variables ?? {}),
      };
      // إرسال PDF كـ header document مرفق (يتطلب template من نوع Documentation)
      if (input.headerDocumentUrl) {
        sendParams["header_document_url"] = input.headerDocumentUrl;
        if (input.headerDocumentFilename) {
          sendParams["header_document_filename"] = input.headerDocumentFilename;
        }
      }
      const result = await whatchimpPost("/whatsapp/send", sendParams);
      const success = String(result.status) === "1";
      return {
        success,
        message: String(result.message ?? ""),
        rawStatus: result.status,
        sentTo: phone,
        templateName: input.templateName,
        variablesUsed: input.variables ?? {},
        withDocument: !!input.headerDocumentUrl,
      };
    }),

  sendTemplateMessage: protectedProcedure
    .input(z.object({
      leadId: z.number(),
      templateName: z.string(),
      languageCode: z.string().default("ar"),
      pdfUrl: z.string().url().optional(),                  // رابط PDF كـ variable1 (نص)
      headerDocumentUrl: z.string().url().optional(),       // رابط PDF كـ header مرفق فعلي
      headerDocumentFilename: z.string().optional(),        // اسم الملف في واتساب
      variables: z.record(z.string(), z.string()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const settings = await getActiveWhatchimpSettingsRows(db);
      if (!settings[0]) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Whatchimp غير مربوط" });
      const { apiToken, phoneNumberId } = settings[0];

      const leadRows = await db.select().from(leads).where(eq(leads.id, input.leadId)).limit(1);
      if (!leadRows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "العميل غير موجود" });
      const lead = leadRows[0];
      if (!lead.verifiedPhone) throw new TRPCError({ code: "BAD_REQUEST", message: "لا يوجد رقم هاتف للعميل" });

      const phone = normalizePhone(lead.verifiedPhone);

      // Build send params — pass pdfUrl as variable1 in template body
      const sendParams: Record<string, string | number> = {
        apiToken,
        phone_number_id: phoneNumberId,
        phone_number: phone,
        template_name: input.templateName,
        language_code: input.languageCode,
      };
      // دمج المتغيرات المخصصة
      if (input.variables) {
        Object.assign(sendParams, input.variables);
      }
      // رابط PDF كـ variable1 (نص في جسم الرسالة)
      if (input.pdfUrl) {
        sendParams["variable1"] = input.pdfUrl;
      }
      // رابط PDF كـ header document مرفق فعلي (يتطلب template من نوع Documentation)
      if (input.headerDocumentUrl) {
        sendParams["header_document_url"] = input.headerDocumentUrl;
        if (input.headerDocumentFilename) {
          sendParams["header_document_filename"] = input.headerDocumentFilename;
        }
      }

      // Send template message
      const result = await whatchimpPost("/whatsapp/send", sendParams);

      const success = String(result.status) === "1";

      // Log the send
      await db.insert(whatchimpSendLog).values({
        leadId: input.leadId,
        phone,
        leadName: lead.companyName,
        batchId: `tmpl_${Date.now()}`,
        status: success ? "success" : "failed",
        errorMessage: success ? null : String(result.message ?? "فشل الإرسال"),
      });

      if (!success) throw new TRPCError({ code: "BAD_REQUEST", message: String(result.message ?? "فشل إرسال الرسالة") });
      return { success: true, withPdf: !!input.pdfUrl, withDocument: !!input.headerDocumentUrl };
    }),

  // ── Bulk Send Template Messages ────────────────────────────────────────────
  bulkSendTemplate: protectedProcedure
    .input(z.object({
      leadIds: z.array(z.number()).min(1),
      templateName: z.string(),
      languageCode: z.string().default("ar"),
      headerDocumentUrl: z.string().url().optional(),      // رابط PDF مرفق لجميع العملاء
      headerDocumentFilename: z.string().optional(),
      variables: z.record(z.string(), z.string()).optional(), // متغيرات مشتركة
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const settings = await getActiveWhatchimpSettingsRows(db);
      if (!settings[0]) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Whatchimp غير مربوط" });
      const { apiToken, phoneNumberId } = settings[0];

      const leadRows = await db.select().from(leads).where(inArray(leads.id, input.leadIds));
      const batchId = `bulk_tmpl_${Date.now()}`;
      let sent = 0;
      let skipped = 0;

      for (const lead of leadRows) {
        if (!lead.verifiedPhone) { skipped++; continue; }
        const phone = normalizePhone(lead.verifiedPhone);
        try {
          const bulkParams: Record<string, string | number> = {
            apiToken,
            phone_number_id: phoneNumberId,
            phone_number: phone,
            template_name: input.templateName,
            language_code: input.languageCode,
            ...(input.variables ?? {}),
          };
          if (input.headerDocumentUrl) {
            bulkParams["header_document_url"] = input.headerDocumentUrl;
            if (input.headerDocumentFilename) {
              bulkParams["header_document_filename"] = input.headerDocumentFilename;
            }
          }
          const result = await whatchimpPost("/whatsapp/send", bulkParams);
          const success = String(result.status) === "1";
          await db.insert(whatchimpSendLog).values({
            leadId: lead.id,
            phone,
            leadName: lead.companyName,
            batchId,
            status: success ? "success" : "failed",
            errorMessage: success ? null : String(result.message ?? "فشل"),
          });
          if (success) sent++; else skipped++;
        } catch {
          skipped++;
        }
        // تأخير بسيط بين الرسائل
        await new Promise(r => setTimeout(r, 500));
      }

      return { sent, skipped, total: leadRows.length };
    }),

  // ─── إرسال جهة الاتصال مع البريف إلى Whatchimp ───────────────────────────────────────────
  /**
   * sendBriefAsContact
   * يُنشئ جهة الاتصال (subscriber) في Whatchimp ويُضيف نص البريف كـ note + custom fields.
   */
  sendBriefAsContact: protectedProcedure
    .input(z.object({
      leadId: z.number().int().positive(),
      brief: z.object({
        topOpportunity: z.string(),
        salesAngle: z.string(),
        firstMessageHint: z.string(),
        priority: z.enum(["A", "B", "C", "D"]),
        leadScore: z.number(),
        bestContactChannel: z.string(),
      }),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // جلب إعدادات Whatchimp
      const settingsRows = await getActiveWhatchimpSettingsRows(db);
      if (!settingsRows[0]) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Whatchimp غير مربوط — يرجى ربط الحساب من صفحة واتساب",
        });
      }
      const { apiToken, phoneNumberId } = settingsRows[0];

      // جلب بيانات العميل
      const leadRows = await db
        .select({
          id: leads.id,
          companyName: leads.companyName,
          verifiedPhone: leads.verifiedPhone,
          businessType: leads.businessType,
          city: leads.city,
          website: leads.website,
          instagramUrl: leads.instagramUrl,
          twitterUrl: leads.twitterUrl,
          snapchatUrl: leads.snapchatUrl,
          tiktokUrl: leads.tiktokUrl,
          facebookUrl: leads.facebookUrl,
          googleMapsUrl: leads.googleMapsUrl,
        })
        .from(leads)
        .where(eq(leads.id, input.leadId))
        .limit(1);

      if (!leadRows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "العميل غير موجود" });
      const lead = leadRows[0];

      if (!lead.verifiedPhone) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "لا يوجد رقم هاتف لهذا العميل" });
      }

      const phone = normalizePhone(lead.verifiedPhone);

      // 1. إنشاء جهة الاتصال (subscriber) في Whatchimp
      const subRes = await whatchimpPost("/whatsapp/subscriber/create", {
        apiToken,
        phoneNumberID: phoneNumberId,
        phoneNumber: phone,
        name: lead.companyName,
      });

      // 2. إضافة البيانات + ملخص البريف كـ custom fields (non-fatal)
      try {
        const customFields: Record<string, string> = {};
        if (lead.businessType) customFields["نوع النشاط"] = lead.businessType;
        if (lead.city) customFields["المدينة"] = lead.city;
        if (lead.website) customFields["الموقع الإلكتروني"] = lead.website;
        if (lead.instagramUrl) customFields["إنستغرام"] = lead.instagramUrl;
        if (lead.twitterUrl) customFields["تويتر/X"] = lead.twitterUrl;
        if (lead.snapchatUrl) customFields["سناب شات"] = lead.snapchatUrl;
        if (lead.tiktokUrl) customFields["تيك توك"] = lead.tiktokUrl;
        if (lead.facebookUrl) customFields["فيسبوك"] = lead.facebookUrl;
        if (lead.googleMapsUrl) customFields["خرائط Google"] = lead.googleMapsUrl;
        customFields["درجة التحليل"] = `${input.brief.leadScore}/100 (أولوية ${input.brief.priority})`;
        customFields["أفضل قناة تواصل"] = input.brief.bestContactChannel;
        customFields["أبرز فرصة"] = input.brief.topOpportunity;

        if (Object.keys(customFields).length > 0) {
          await whatchimpPost("/whatsapp/subscriber/chat/assign-custom-fields", {
            apiToken,
            phone_number_id: phoneNumberId,
            phone_number: phone,
            custom_fields: JSON.stringify(customFields),
          });
        }
      } catch { /* non-fatal */ }

      // 3. إضافة البريف كاملاً كـ note
      const briefNote = [
        `\uD83D\uDCCA ملخص التحليل التسويقي — ${lead.companyName}`,
        ``,
        `\uD83C\uDFAF أبرز فرصة: ${input.brief.topOpportunity}`,
        `\uD83D\uDCA1 زاوية الدخول: ${input.brief.salesAngle}`,
        ``,
        `\uD83D\uDCDD مقترح الرسالة الأولى:`,
        input.brief.firstMessageHint,
        ``,
        `\u2B50 الدرجة: ${input.brief.leadScore}/100 | الأولوية: ${input.brief.priority} | القناة المثلى: ${input.brief.bestContactChannel}`,
        ``,
        `— نظام مكسب للعملاء`,
      ].join("\n");

      try {
        await whatchimpPost("/whatsapp/subscriber/chat/add-notes", {
          apiToken,
          phone_number_id: phoneNumberId,
          phone_number: phone,
          note_text: briefNote,
        });
      } catch { /* non-fatal */ }

      // 4. تسجيل العملية
      const waMessageId = typeof subRes.message === "string" ? subRes.message : undefined;
      await db.insert(whatchimpSendLog).values({
        leadId: input.leadId,
        leadName: lead.companyName,
        phone,
        status: "success",
        waMessageId,
        batchId: `brief_${Date.now()}`,
        sentByUserId: ctx.user.id,
      });

      return { success: true, phone, waMessageId };
    }),

  // ─── إرسال تقرير PDF عبر Bot Flow (خطوتان: حقن Custom Field + trigger-bot) ───────────────
  sendPdfViaBot: protectedProcedure
    .input(z.object({
      leadId: z.number().int().positive(),
      pdfUrl: z.string().url(),           // رابط PDF المباشر
      botFlowUniqueId: z.string().optional(), // يُستخدم إذا لم يكن محفوظاً في الإعدادات
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // جلب الإعدادات
      const settingsRows = await getActiveWhatchimpSettingsRows(db);
      if (!settingsRows[0]) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Whatchimp غير مربوط" });
      const { apiToken, phoneNumberId, botFlowUniqueId: savedFlowId } = settingsRows[0];

      const flowId = input.botFlowUniqueId ?? savedFlowId;
      if (!flowId) throw new TRPCError({
        code: "BAD_REQUEST",
        message: "لم يتم تحديد Bot Flow ID. أضفه في إعدادات Whatchimp أو مرره مباشرة."
      });

      // جلب بيانات العميل
      const leadRows = await db.select({
        id: leads.id,
        companyName: leads.companyName,
        verifiedPhone: leads.verifiedPhone,
      }).from(leads).where(eq(leads.id, input.leadId)).limit(1);
      if (!leadRows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "العميل غير موجود" });
      const lead = leadRows[0];
      if (!lead.verifiedPhone) throw new TRPCError({ code: "BAD_REQUEST", message: "لا يوجد رقم هاتف للعميل" });

      const phone = normalizePhone(lead.verifiedPhone);

      // ── الخطوة 1: حقن رابط PDF في Custom Fields ──────────────────────────────
      try {
        await whatchimpPost("/whatsapp/subscriber/chat/assign-custom-fields", {
          apiToken,
          phone_number_id: phoneNumberId,
          phone_number: phone,
          custom_fields: JSON.stringify({ pdf_report_link: input.pdfUrl }),
        });
      } catch (err) {
        // non-fatal: نكمل حتى لو فشل حقن الـ Custom Field
        console.warn("[sendPdfViaBot] assign-custom-fields failed:", err);
      }

      // ── الخطوة 2: إطلاق Bot Flow ──────────────────────────────────────────────
      const triggerRes = await whatchimpPost("/whatsapp/trigger-bot", {
        apiToken,
        phone_number_id: phoneNumberId,
        phone_number: phone,
        bot_flow_unique_id: flowId,
      });

      const success = String(triggerRes.status) === "1";

      // تسجيل العملية
      await db.insert(whatchimpSendLog).values({
        leadId: input.leadId,
        leadName: lead.companyName,
        phone,
        status: success ? "success" : "failed",
        errorMessage: success ? null : String(triggerRes.message ?? "فشل trigger-bot"),
        batchId: `pdf_bot_${Date.now()}`,
        sentByUserId: ctx.user.id,
      });

      if (!success) throw new TRPCError({
        code: "BAD_REQUEST",
        message: String(triggerRes.message ?? "فشل إطلاق Bot Flow")
      });

      return { success: true, phone, pdfUrl: input.pdfUrl, flowId };
    }),

  // ─── إرسال تقرير PDF جماعي عبر Bot Flow ─────────────────────────────────────
  bulkSendPdfViaBot: protectedProcedure
    .input(z.object({
      leadIds: z.array(z.number()).min(1).max(1000),
      botFlowUniqueId: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const settingsRows = await getActiveWhatchimpSettingsRows(db);
      if (!settingsRows[0]) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Whatchimp غير مربوط" });
      const { apiToken, phoneNumberId, botFlowUniqueId: savedFlowId } = settingsRows[0];

      const flowId = input.botFlowUniqueId ?? savedFlowId;
      if (!flowId) throw new TRPCError({
        code: "BAD_REQUEST",
        message: "لم يتم تحديد Bot Flow ID"
      });

      const leadsData = await db.select({
        id: leads.id,
        companyName: leads.companyName,
        verifiedPhone: leads.verifiedPhone,
        pdfFileUrl: leads.pdfFileUrl,
      }).from(leads).where(inArray(leads.id, input.leadIds));

      let sent = 0, skipped = 0, failed = 0;
      const errors: Array<{ leadId: number; name: string; error: string }> = [];

      for (const lead of leadsData) {
        if (!lead.verifiedPhone) { skipped++; continue; }
        if (!lead.pdfFileUrl) { skipped++; continue; }  // لا يوجد تقرير PDF

        const phone = normalizePhone(lead.verifiedPhone);

        try {
          // الخطوة 1: حقن رابط PDF
          try {
            await whatchimpPost("/whatsapp/subscriber/chat/assign-custom-fields", {
              apiToken,
              phone_number_id: phoneNumberId,
              phone_number: phone,
              custom_fields: JSON.stringify({ pdf_report_link: lead.pdfFileUrl }),
            });
          } catch { /* non-fatal */ }

          // الخطوة 2: إطلاق Bot Flow
          const triggerRes = await whatchimpPost("/whatsapp/trigger-bot", {
            apiToken,
            phone_number_id: phoneNumberId,
            phone_number: phone,
            bot_flow_unique_id: flowId,
          });

          const success = String(triggerRes.status) === "1";
          await db.insert(whatchimpSendLog).values({
            leadId: lead.id,
            leadName: lead.companyName,
            phone,
            status: success ? "success" : "failed",
            errorMessage: success ? null : String(triggerRes.message ?? "فشل"),
            batchId: `bulk_pdf_${Date.now()}`,
            sentByUserId: ctx.user.id,
          });

          if (success) sent++;
          else { failed++; errors.push({ leadId: lead.id, name: lead.companyName, error: String(triggerRes.message ?? "فشل") }); }
        } catch (err) {
          failed++;
          errors.push({ leadId: lead.id, name: lead.companyName, error: err instanceof Error ? err.message : "خطأ" });
        }

        await new Promise(r => setTimeout(r, 300));
      }

      return { sent, skipped, failed, total: leadsData.length, errors };
    }),

  // ─── التحقق من صحة أرقام الواتساب لقائمة من العملاء ───────────────────────────────────────
  validatePhones: protectedProcedure
    .input(z.object({ leadIds: z.array(z.number()) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
      const leadRows = await db
        .select({
          id: leads.id,
          companyName: leads.companyName,
          verifiedPhone: leads.verifiedPhone,
        })
        .from(leads)
        .where(inArray(leads.id, input.leadIds));

      return leadRows.map((lead) => {
        const phone = lead.verifiedPhone ?? "";
        const validation = validateAndNormalizePhone(phone);
        return {
          leadId: lead.id,
          companyName: lead.companyName,
          rawPhone: phone,
          normalizedPhone: validation.normalized,
          valid: validation.valid,
          warning: validation.warning ?? null,
          country: validation.country ?? null,
        };
      });
    }),
});
