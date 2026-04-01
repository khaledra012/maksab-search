/**
 * البحث في منصات التواصل الاجتماعي: TikTok, Snapchat, Telegram
 *
 * ===== سياسة البيانات الصارمة =====
 * 1. لا يُسمح بأي بيانات مولّدة أو وهمية تحت أي ظرف
 * 2. رقم الهاتف: يُستخرج بـ regex من النص الخام فقط - لا من AI
 * 3. الموقع الإلكتروني: يُستخرج بـ regex من النص الخام فقط - لا من AI
 * 4. الـ AI يستخرج الاسم والبيو والمعلومات النصية فقط
 * 5. إذا لم تُجلب بيانات كافية → مصفوفة فارغة (لا بيانات وهمية)
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { TRPCError } from "@trpc/server";
import { searchTikTokSERP, searchSnapchatSERP, searchInstagramSERP, searchTwitterSERP, searchLinkedInSERP, searchFacebookSERP, filterByCityContext } from "./serpSearch";



// ===== أنماط التحقق من البيانات =====
/** نمط أرقام الهواتف السعودية والخليجية الحقيقية */
const PHONE_REGEX = /(?:\+966|00966|0)(?:5[0-9]{8}|[1-9][0-9]{7})/g;
/** نمط URLs الحقيقية */
const URL_REGEX = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,6}\b(?:[-a-zA-Z0-9@:%_+.~#?&/=]*)/g;

/**
 * استخراج أرقام الهواتف الحقيقية من النص الخام بـ regex
 * لا يعتمد على AI إطلاقاً
 */
function extractRealPhones(rawHtml: string): string[] {
  const matches = rawHtml.match(PHONE_REGEX) || [];
  const cleaned = Array.from(new Set(matches.map(p => {
    const digits = p.replace(/\D/g, "");
    // تطبيع: إزالة 966 أو 00966 من البداية
    if (digits.startsWith("966")) return "0" + digits.slice(3);
    if (digits.startsWith("00966")) return "0" + digits.slice(5);
    return digits;
  })));
  return cleaned.filter(p => p.length >= 10 && p.length <= 12);
}

/**
 * استخراج URLs الحقيقية من النص الخام بـ regex
 * يستبعد CDN والصور وملفات JS/CSS
 */
function extractRealWebsites(rawHtml: string): string[] {
  const matches = rawHtml.match(URL_REGEX) || [];
  const EXCLUDED_PATTERNS = [
    "cdn.", "static.", "assets.", "img.", "images.",
    ".js", ".css", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".woff",
    "tiktok.com", "snapchat.com", "t.me", "telegram.org", "tgstat.com",
    "google.com", "facebook.com", "twitter.com", "youtube.com",
    "apple.com", "microsoft.com", "cloudflare.com", "amazonaws.com",
    "w3.org", "schema.org", "openstreetmap.org",
  ];
  return Array.from(new Set(matches))
    .filter(url => {
      const lower = url.toLowerCase();
      return !EXCLUDED_PATTERNS.some(p => lower.includes(p)) && url.length < 100;
    })
    .slice(0, 3);
}

// ===== أدوات محاكاة البشر =====
function parseCompactCount(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 0 ? Math.round(value) : undefined;
  }
  if (typeof value !== "string") return undefined;

  const normalized = value.replace(/[،\s]/g, "").trim();
  if (!normalized) return undefined;

  const match = normalized.match(/^([\d.,]+)([KMB])?$/i);
  if (!match) return undefined;

  const base = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(base) || base <= 0) return undefined;

  const suffix = (match[2] || "").toUpperCase();
  const multiplier = suffix === "B" ? 1_000_000_000 : suffix === "M" ? 1_000_000 : suffix === "K" ? 1_000 : 1;
  return Math.round(base * multiplier);
}

function extractFollowersFromText(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value !== "string" || !value.trim()) continue;
    const match = value.match(/([\d.,]+)\s*([KMB])?\s*(?:followers?|متابع(?:ين)?|subscriber(?:s)?|مشترك(?:ين)?)/i);
    const parsed = parseCompactCount(match ? `${match[1]}${match[2] || ""}` : value);
    if (parsed) return parsed;
  }
  return undefined;
}

function pickFollowersCount(result: any, ...textFallbacks: unknown[]): number | undefined {
  const directFields = [
    result?.followers,
    result?.followersCount,
    result?.follower_count,
    result?.followers_count,
    result?.subscribers,
    result?.subscriberCount,
    result?.subscribersCount,
  ];

  for (const field of directFields) {
    const parsed = parseCompactCount(field);
    if (parsed) return parsed;
  }

  return extractFollowersFromText(...textFallbacks);
}

const humanDelay = (min = 1000, max = 3000) =>
  new Promise(r => setTimeout(r, min + Math.random() * (max - min)));

const randomUserAgent = () => {
  const agents = [
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.6045.193 Mobile Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  ];
  return agents[Math.floor(Math.random() * agents.length)];
};

/** جلب صفحة مع headers تحاكي المتصفح - يُرجع HTML الخام للـ regex */
async function fetchLikeHuman(url: string, extraHeaders?: Record<string, string>): Promise<string> {
  await humanDelay(800, 2500);
  const res = await fetch(url, {
    headers: {
      "User-Agent": randomUserAgent(),
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "ar-SA,ar;q=0.9,en-US;q=0.8,en;q=0.7",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Upgrade-Insecure-Requests": "1",
      "Referer": "https://www.google.com/",
      ...extraHeaders,
    },
    signal: AbortSignal.timeout(20000),
  });
  // إرجاع HTML الخام (لاستخراج الأرقام والمواقع بـ regex)
  return await res.text();
}

/** تنظيف HTML للـ AI (نص قابل للقراءة) */
function cleanHtmlForAI(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000);
}

/**
 * استخراج بيانات الأعمال من HTML حقيقي مجلوب من الصفحة.
 *
 * ===== المنهجية الصارمة =====
 * - الأرقام: regex من HTML الخام → لا يخطئ ولا يخترع
 * - المواقع: regex من HTML الخام → لا يخطئ ولا يخترع
 * - الأسماء والبيو: AI يستخرج من النص المنظف
 * - AI ممنوع من إدخال phone أو website
 */
async function extractBusinessesFromRealText(rawHtml: string, platform: string, keyword: string) {
  if (!rawHtml || rawHtml.length < 100) return [];

  // ===== الخطوة 1: استخراج الأرقام والمواقع من HTML الخام (regex - لا AI) =====
  const realPhones = extractRealPhones(rawHtml);
  const realWebsites = extractRealWebsites(rawHtml);

  // ===== الخطوة 2: تنظيف HTML للـ AI =====
  const cleanText = cleanHtmlForAI(rawHtml);
  if (cleanText.length < 50) return [];

  // ===== الخطوة 3: AI يستخرج الأسماء والمعلومات النصية فقط =====
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `أنت محلل استخباراتي دقيق متخصص في السوق السعودي. مهمتك استخراج أسماء الأعمال التجارية السعودية فقط.

قواعد صارمة لا استثناء فيها:
1. استخرج فقط الأعمال التجارية السعودية فقط - استخرج: الاسم، اسم المستخدم، البيو، عدد المتابعين، نوع النشاط، المدينة
2. استبعد فوراً أي نشاط خارج المملكة العربية السعودية (مصر، الإمارات، الكويت، قطر، البحرين، عُمان، الأردن، لبنان، العراق، سوريا، تركيا، باكستان، الهند، وغيرها)
3. حقل phone: اتركه فارغاً "" دائماً بدون استثناء
4. حقل website: اتركه فارغاً "" دائماً بدون استثناء
5. إذا لم تجد أي نشاط تجاري سعودي واضح → أرجع results: []
6. لا تخترع أي بيانات أو تتخيل أي معلومات
7. الحد الأقصى 15 نتيجة سعودية`,
      },
      {
        role: "user",
        content: `استخرج الأنشطة التجارية الموجودة فعلاً في هذا النص من ${platform} (البحث عن "${keyword}"):\n\n${cleanText}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "social_businesses",
        strict: true,
        schema: {
          type: "object",
          properties: {
            results: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  username: { type: "string" },
                  bio: { type: "string" },
                  followers: { type: "string" },
                  businessType: { type: "string" },
                  phone: { type: "string" },
                  website: { type: "string" },
                  city: { type: "string" },
                  profileUrl: { type: "string" },
                  engagementLevel: { type: "string" },
                },
                required: ["name", "username", "bio", "followers", "businessType", "phone", "website", "city", "profileUrl", "engagementLevel"],
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

  try {
    const parsed = JSON.parse(response.choices[0].message.content as string);
    const aiResults = (parsed.results || []).filter((r: any) =>
      r.name && r.name.trim() !== "" && r.username && r.username.trim() !== ""
    );

    // ===== الخطوة 4: دمج الأرقام والمواقع الحقيقية (من regex) مع نتائج AI =====
    // phone و website تأتي من regex فقط - لا من AI
    return aiResults.map((r: any) => ({
      ...r,
      phone: "",       // فارغ دائماً - المستخدم يتحقق يدوياً
      website: "",     // فارغ دائماً - المستخدم يتحقق يدوياً
      // أرقام وروابط حقيقية مستخرجة بـ regex للمستخدم ليختار منها
      availablePhones: realPhones,
      availableWebsites: realWebsites,
      dataSource: "real_page_extraction",
    }));
  } catch {
    return [];
  }
}

/** توليد هاشتاقات ذكية للبحث */
async function generateSearchHashtags(keyword: string, city: string, platform: string): Promise<string[]> {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `أنت خبير في التسويق الرقمي السعودي ومتخصص في منصة ${platform}. أنشئ هاشتاقات فعّالة للبحث عن أنشطة تجارية.`,
      },
      {
        role: "user",
        content: `أنشئ 8 هاشتاقات للبحث عن "${keyword}" في "${city}" على منصة ${platform}. أرجع JSON فقط.`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "hashtags",
        strict: true,
        schema: {
          type: "object",
          properties: { hashtags: { type: "array", items: { type: "string" } } },
          required: ["hashtags"],
          additionalProperties: false,
        },
      },
    },
  });
  try {
    const parsed = JSON.parse(response.choices[0].message.content as string);
    return parsed.hashtags || [];
  } catch {
    return [`${keyword}_${city}`, `${keyword}السعودية`, `${city}`, `${keyword}`];
  }
}

// ===== Instagram Search - SERP API (Bright Data) =====
async function searchInstagram(keyword: string, city: string): Promise<any[]> {
  try {
    const serpResults = await searchInstagramSERP(keyword, city);
    if (serpResults.length > 0) {
      console.log(`[Instagram SERP] Found ${serpResults.length} results`);
      return serpResults.map((r: any) => ({
        name: r.displayName || r.title || "",
        username: r.username || "",
        bio: r.description || r.snippet || r.bio || "",
        followers: pickFollowersCount(r, r.description, r.snippet, r.bio, r.title, r.displayName),
        businessType: "",
        phone: r.phone || "",
        website: "",
        city: city,
        profileUrl: r.profileUrl || r.url || r.link || `https://instagram.com/${r.username}`,
        engagementLevel: "normal",
        availablePhones: r.phone ? [r.phone] : [],
        availableWebsites: [],
        dataSource: "instagram_serp",
        verified: false,
      }));
    }
  } catch (err) {
    console.warn("[Instagram] SERP API failed:", err);
  }
  return [];
}

// ===== TikTok Search - SERP API (Bright Data) أولاً =====
async function searchTikTok(keyword: string, city: string): Promise<any[]> {
  // المحاولة الأولى: Bright Data SERP API (الأسرع والأكثر موثوقية)
  try {
    const serpResults = await searchTikTokSERP(keyword, city);
    if (serpResults.length > 0) {
      console.log(`[TikTok SERP] Found ${serpResults.length} results`);
      return serpResults.map((r: any) => ({
        name: r.displayName || r.title || "",
        username: r.username || "",
        bio: r.description || r.snippet || "",
        followers: pickFollowersCount(r, r.description, r.snippet, r.bio, r.title, r.displayName),
        businessType: "",
        phone: r.phone || "",
        website: "",
        city: city,
        profileUrl: r.profileUrl || r.link || "",
        engagementLevel: "normal",
        availablePhones: r.phone ? [r.phone] : [],
        availableWebsites: [],
        dataSource: "tiktok_serp",
        verified: false,
      }));
    }
  } catch (err) {
    console.warn("[TikTok] SERP API failed, falling back to puppeteer:", err);
  }

  return [];
}

// ===== Snapchat Search - SERP API (Bright Data) أولاً =====
async function searchSnapchat(keyword: string, city: string): Promise<any[]> {
  // المحاولة الأولى: Bright Data SERP API (الأسرع والأكثر موثوقية)
  try {
    const serpResults = await searchSnapchatSERP(keyword, city);
    if (serpResults.length > 0) {
      console.log(`[Snapchat SERP] Found ${serpResults.length} results`);
      return serpResults.map((r: any) => ({
        name: r.displayName || r.title || "",
        username: r.username || "",
        bio: r.description || r.snippet || "",
        followers: pickFollowersCount(r, r.description, r.snippet, r.bio, r.title, r.displayName),
        businessType: "",
        phone: r.phone || "",
        website: "",
        city: city,
        profileUrl: r.profileUrl || r.link || "",
        engagementLevel: "normal",
        availablePhones: r.phone ? [r.phone] : [],
        availableWebsites: [],
        dataSource: "snapchat_serp",
        verified: false,
      }));
    }
  } catch (err) {
    console.warn("[Snapchat] SERP API failed, falling back to puppeteer:", err);
  }

  return [];
}

// ===== Twitter/X Search - SERP API =====
async function searchTwitter(keyword: string, city: string): Promise<any[]> {
  try {
    const serpResults = await searchTwitterSERP(keyword, city);
    if (serpResults.length > 0) {
      console.log(`[Twitter SERP] Found ${serpResults.length} results`);
      return serpResults.map((r: any) => ({
        name: r.displayName || r.username || "",
        username: r.username || "",
        bio: r.bio || "",
        followers: pickFollowersCount(r, r.bio, r.description, r.snippet, r.title, r.displayName),
        businessType: "",
        phone: "",
        website: "",
        city: city,
        profileUrl: r.url || `https://x.com/${r.username}`,
        engagementLevel: "normal",
        availablePhones: [],
        availableWebsites: [],
        dataSource: "twitter_serp",
        verified: false,
      }));
    }
  } catch (err) {
    console.warn("[Twitter] SERP API failed:", err);
  }
  return [];
}

// ===== LinkedIn Search - SERP API =====
async function searchLinkedIn(keyword: string, city: string): Promise<any[]> {
  try {
    const serpResults = await searchLinkedInSERP(keyword, city);
    if (serpResults.length > 0) {
      console.log(`[LinkedIn SERP] Found ${serpResults.length} results`);
      return serpResults.map((r: any) => ({
        name: r.displayName || r.username || "",
        username: r.username || "",
        bio: r.bio || "",
        followers: pickFollowersCount(r, r.bio, r.description, r.snippet, r.title, r.displayName),
        businessType: "",
        phone: "",
        website: "",
        city: city,
        profileUrl: r.url || `https://linkedin.com/company/${r.username}`,
        engagementLevel: "normal",
        availablePhones: [],
        availableWebsites: [],
        dataSource: "linkedin_serp",
        verified: false,
      }));
    }
  } catch (err) {
    console.warn("[LinkedIn] SERP API failed:", err);
  }
  return [];
}

// ===== Facebook Search - SERP API =====
async function searchFacebook(keyword: string, city: string): Promise<any[]> {
  try {
    const serpResults = await searchFacebookSERP(keyword, city);
    if (serpResults.length > 0) {
      console.log(`[Facebook SERP] Found ${serpResults.length} results`);
      return serpResults.map((r: any) => ({
        name: r.displayName || r.username || "",
        username: r.username || "",
        bio: r.bio || "",
        followers: pickFollowersCount(r, r.bio, r.description, r.snippet, r.title, r.displayName),
        businessType: "",
        phone: "",
        website: "",
        city: city,
        profileUrl: r.url || `https://facebook.com/${r.username}`,
        engagementLevel: "normal",
        availablePhones: [],
        availableWebsites: [],
        dataSource: "facebook_serp",
        verified: false,
      }));
    }
  } catch (err) {
    console.warn("[Facebook] SERP API failed:", err);
  }
  return [];
}

// ===== Telegram Search =====
async function searchTelegram(keyword: string, city: string): Promise<any[]> {
  const queries = [`${keyword} ${city}`, `${keyword} السعودية`, `${keyword}`];
  let combinedRawHtml = "";
  for (const q of queries) {
    try {
      const url = `https://t.me/s/${encodeURIComponent(q.replace(/\s+/g, ""))}`;
      const html = await fetchLikeHuman(url, { "Referer": "https://t.me/" });
      combinedRawHtml += " " + html;
      await humanDelay(1000, 2000);
    } catch { /* تجاهل */ }
  }
  try {
    const tgstatUrl = `https://tgstat.com/search?q=${encodeURIComponent(keyword + " " + city)}&type=channel`;
    const html = await fetchLikeHuman(tgstatUrl, { "Referer": "https://tgstat.com/" });
    combinedRawHtml += " " + html;
  } catch { /* تجاهل */ }
  if (combinedRawHtml.trim().length < 100) return [];
  return extractBusinessesFromRealText(combinedRawHtml, "Telegram", keyword + " " + city);
}

// ===== Router =====
export const socialSearchRouter = router({
  searchInstagram: protectedProcedure
    .input(z.object({ keyword: z.string().min(1), city: z.string().default("الرياض") }))
    .mutation(async ({ input }) => {
      try {
        const raw = await searchInstagram(input.keyword, input.city);
        const results = filterByCityContext(raw, input.city);
        console.log(`[Instagram] ${raw.length} raw → ${results.length} after city filter (${input.city})`);
        return { results, platform: "Instagram", total: results.length };
      } catch (err: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err.message });
      }
    }),

  searchTikTok: protectedProcedure
    .input(z.object({ keyword: z.string().min(1), city: z.string().default("الرياض") }))
    .mutation(async ({ input }) => {
      try {
        const raw = await searchTikTok(input.keyword, input.city);
        const results = filterByCityContext(raw, input.city);
        console.log(`[TikTok] ${raw.length} raw → ${results.length} after city filter (${input.city})`);
        return { results, platform: "TikTok", total: results.length };
      } catch (err: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err.message });
      }
    }),

  searchSnapchat: protectedProcedure
    .input(z.object({ keyword: z.string().min(1), city: z.string().default("الرياض") }))
    .mutation(async ({ input }) => {
      try {
        const raw = await searchSnapchat(input.keyword, input.city);
        const results = filterByCityContext(raw, input.city);
        console.log(`[Snapchat] ${raw.length} raw → ${results.length} after city filter (${input.city})`);
        return { results, platform: "Snapchat", total: results.length };
      } catch (err: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err.message });
      }
    }),

  searchTwitter: protectedProcedure
    .input(z.object({ keyword: z.string().min(1), city: z.string().default("الرياض") }))
    .mutation(async ({ input }) => {
      try {
        const raw = await searchTwitter(input.keyword, input.city);
        const results = filterByCityContext(raw, input.city);
        console.log(`[Twitter] ${raw.length} raw → ${results.length} after city filter (${input.city})`);
        return { results, platform: "Twitter", total: results.length };
      } catch (err: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err.message });
      }
    }),

  searchLinkedIn: protectedProcedure
    .input(z.object({ keyword: z.string().min(1), city: z.string().default("الرياض") }))
    .mutation(async ({ input }) => {
      try {
        const raw = await searchLinkedIn(input.keyword, input.city);
        const results = filterByCityContext(raw, input.city);
        console.log(`[LinkedIn] ${raw.length} raw → ${results.length} after city filter (${input.city})`);
        return { results, platform: "LinkedIn", total: results.length };
      } catch (err: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err.message });
      }
    }),

  searchFacebook: protectedProcedure
    .input(z.object({ keyword: z.string().min(1), city: z.string().default("الرياض") }))
    .mutation(async ({ input }) => {
      try {
        const raw = await searchFacebook(input.keyword, input.city);
        const results = filterByCityContext(raw, input.city);
        console.log(`[Facebook] ${raw.length} raw → ${results.length} after city filter (${input.city})`);
        return { results, platform: "Facebook", total: results.length };
      } catch (err: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err.message });
      }
    }),

  searchTelegram: protectedProcedure
    .input(z.object({ keyword: z.string().min(1), city: z.string().default("الرياض") }))
    .mutation(async ({ input }) => {
      try {
        const results = await searchTelegram(input.keyword, input.city);
        return { results, platform: "Telegram", total: results.length };
      } catch (err: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err.message });
      }
    }),

  searchAllPlatforms: protectedProcedure
    .input(z.object({
      keyword: z.string().min(1),
      city: z.string().default("الرياض"),
      platforms: z.array(z.enum(["tiktok", "snapchat", "telegram"])).default(["tiktok", "snapchat", "telegram"]),
    }))
    .mutation(async ({ input }) => {
      const promises: Promise<{ platform: string; results: any[] }>[] = [];
      if (input.platforms.includes("tiktok"))
        promises.push(searchTikTok(input.keyword, input.city).then(r => ({ platform: "TikTok", results: r })).catch(() => ({ platform: "TikTok", results: [] })));
      if (input.platforms.includes("snapchat"))
        promises.push(searchSnapchat(input.keyword, input.city).then(r => ({ platform: "Snapchat", results: r })).catch(() => ({ platform: "Snapchat", results: [] })));
      if (input.platforms.includes("telegram"))
        promises.push(searchTelegram(input.keyword, input.city).then(r => ({ platform: "Telegram", results: r })).catch(() => ({ platform: "Telegram", results: [] })));
      const allResults = await Promise.all(promises);
      const combined = allResults.flatMap(r => r.results.map((item: any) => ({ ...item, platform: r.platform })));
      return { results: combined, byPlatform: allResults, total: combined.length };
    }),

  suggestSocialHashtags: protectedProcedure
    .input(z.object({
      keyword: z.string().min(1),
      city: z.string().default("الرياض"),
      platform: z.string().default("all"),
    }))
    .mutation(async ({ input }) => {
      const hashtags = await generateSearchHashtags(input.keyword, input.city, input.platform);
      return { hashtags };
    }),
});
