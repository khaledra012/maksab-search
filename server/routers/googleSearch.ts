/**
 * Google Web Search - بحث ذكي عبر Bright Data Browser API
 *
 * ===== سياسة البيانات الصارمة =====
 * 1. لا يُسمح بأي بيانات مولّدة أو وهمية تحت أي ظرف
 * 2. رقم الهاتف: يُستخرج بـ regex من النص الخام فقط - لا من AI
 * 3. الموقع الإلكتروني: يُستخرج من روابط Google الحقيقية فقط
 * 4. الـ AI يستخرج الاسم والوصف والمعلومات النصية فقط
 * 5. إذا لم تُجلب بيانات كافية → مصفوفة فارغة (لا بيانات وهمية)
 */

import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { TRPCError } from "@trpc/server";
import puppeteer from "puppeteer-core";
import { buildGoogleSearchUrl } from "../lib/googleUrlBuilder";
import { serpRequest, parseGoogleResultsGeneric } from "./serpSearch";

// ===== Bright Data Browser API =====
const BRIGHT_DATA_WS_ENDPOINT = process.env.BRIGHT_DATA_WS_ENDPOINT || "";

function getBrightDataEndpoint(): string {
  if (BRIGHT_DATA_WS_ENDPOINT) return BRIGHT_DATA_WS_ENDPOINT;
  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message: "Bright Data غير مضبوط. يرجى إضافة BRIGHT_DATA_WS_ENDPOINT في الإعدادات.",
  });
}

async function openBrightDataBrowser() {
  const endpoint = getBrightDataEndpoint();
  try {
    const browser = await Promise.race([
      puppeteer.connect({ browserWSEndpoint: endpoint }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("انتهت مهلة الاتصال بـ Bright Data (90 ثانية) — تحقق من صحة الـ endpoint")), 90000)
      ),
    ]);
    return browser;
  } catch (err: any) {
    const msg: string = err?.message || "";
    if (msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND") || msg.includes("Failed to fetch") || msg.includes("fetch") || msg.includes("WebSocket")) {
      throw new TRPCError({
        code: "SERVICE_UNAVAILABLE",
        message: "تعذّر الاتصال بـ Bright Data — تحقق من صحة الـ BRIGHT_DATA_WS_ENDPOINT وأن الحساب نشط",
      });
    }
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `خطأ في الاتصال بـ Bright Data: ${msg}`,
    });
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ALL_CITIES_VALUE = "جميع المدن";

// ===== أنماط التحقق من البيانات =====
const PHONE_PATTERNS = [
  /(?:^|\s|[,،\|\/])\+?966\s?(?:5\d)\d{7}(?:\s|$|[,،\|\/])/g,
  /(?:^|\s|[,،\|\/])05\d{8}(?:\s|$|[,،\|\/])/g,
  /(?:^|\s|[,،\|\/])\+?971\s?5\d{8}(?:\s|$|[,،\|\/])/g,
  /واتساب[:\s]*(\+?[\d\s\-]{9,15})/gi,
  /whatsapp[:\s]*(\+?[\d\s\-]{9,15})/gi,
  /📞\s*(\+?[\d\s\-]{9,15})/g,
  /📱\s*(\+?[\d\s\-]{9,15})/g,
];

function extractPhones(text: string): string[] {
  const found = new Set<string>();
  for (const pattern of PHONE_PATTERNS) {
    const matches = Array.from(text.matchAll(pattern));
    for (const match of matches) {
      const raw = (match[1] || match[0]).replace(/[^\d+]/g, "");
      if (raw.length >= 9 && raw.length <= 15) {
        let normalized = raw;
        if (normalized.startsWith("05") && normalized.length === 10) {
          normalized = "+966" + normalized.slice(1);
        } else if (normalized.startsWith("5") && normalized.length === 9) {
          normalized = "+9665" + normalized.slice(1);
        } else if (normalized.startsWith("966") && !normalized.startsWith("+")) {
          normalized = "+" + normalized;
        }
        found.add(normalized);
      }
    }
  }
  return Array.from(found);
}

// أنماط استبعاد المواقع غير التجارية
const EXCLUDED_DOMAINS = [
  "google.com", "youtube.com", "facebook.com", "twitter.com", "instagram.com",
  "tiktok.com", "snapchat.com", "linkedin.com", "wikipedia.org", "wikimedia.org",
  "amazon.com", "amazon.sa", "noon.com", "jarir.com", "extra.com",
  "government.sa", "gov.sa", "moi.gov.sa", "moh.gov.sa",
  "w3.org", "schema.org", "cloudflare.com", "amazonaws.com",
  "gstatic.com", "googleapis.com", "googletagmanager.com",
];

function extractWebsites(urls: string[]): string[] {
  return Array.from(new Set(urls))
    .filter(url => {
      const lower = url.toLowerCase();
      return !EXCLUDED_DOMAINS.some(d => lower.includes(d)) && url.length < 150;
    })
    .slice(0, 5);
}

// ===== واجهة النتيجة =====
export interface GoogleSearchResult {
  id: string;
  name: string;
  description: string;
  url: string;
  displayUrl: string;
  phone: string;
  availablePhones: string[];
  availableWebsites: string[];
  businessType: string;
  city: string;
  relevanceScore: number;
  dataSource: string;
  isLeadCandidate: boolean;
  socialLinks: {
    instagram?: string;
    twitter?: string;
    snapchat?: string;
    tiktok?: string;
  };
}

// ===== بحث Google عبر Bright Data =====
async function scrapeGoogleSearch(query: string, page = 1): Promise<{
  items: Array<{ title: string; link: string; snippet: string; displayLink: string }>;
  rawHtmlText: string;
}> {
  const browser = await openBrightDataBrowser();
  const items: Array<{ title: string; link: string; snippet: string; displayLink: string }> = [];
  let rawHtmlText = "";

  try {
    const tab = await browser.newPage();

    // User-Agent بشري
    await tab.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
    );

    // ملاحظة: Bright Data يحظر تعديل Accept header
    // نستخدم Accept-Language فقط عبر evaluate لتعيين اللغة
    await tab.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'language', { get: () => 'ar-SA' });
      Object.defineProperty(navigator, 'languages', { get: () => ['ar-SA', 'ar', 'en-US'] });
    });

    // بناء رابط Google Search
    const start = (page - 1) * 10;
    const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=ar&gl=SA&num=10${start > 0 ? `&start=${start}` : ""}`;

    // محاولة أولى: domcontentloaded (أسرع)
    try {
      await tab.goto(googleUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    } catch (gotoErr: any) {
      // محاولة ثانية: networkidle2 مع timeout أطول
      console.warn("[Google Bright Data] domcontentloaded timeout, retrying with networkidle2...");
      await tab.goto(googleUrl, { waitUntil: "networkidle2", timeout: 90000 });
    }
    await sleep(1500 + Math.random() * 1000);

    // استخراج النتائج من صفحة Google
    const extracted = await tab.evaluate(() => {
      const results: Array<{ title: string; link: string; snippet: string; displayLink: string }> = [];

      // نتائج Google العضوية
      const resultDivs = document.querySelectorAll("div.g, div[data-sokoban-container], div.MjjYud > div");

      resultDivs.forEach((div) => {
        const titleEl = div.querySelector("h3");
        const linkEl = div.querySelector("a[href]") as HTMLAnchorElement | null;
        const snippetEl = div.querySelector(".VwiC3b, .lEBKkf, span[data-ved]");

        if (titleEl && linkEl) {
          const href = linkEl.href || "";
          // تجاهل روابط Google الداخلية
          if (href.startsWith("http") && !href.includes("google.com/search") && !href.includes("accounts.google")) {
            const displayLink = new URL(href).hostname.replace("www.", "");
            results.push({
              title: titleEl.textContent?.trim() || "",
              link: href,
              snippet: snippetEl?.textContent?.trim() || "",
              displayLink,
            });
          }
        }
      });

      return results;
    });

    // استخراج النص الكامل للصفحة لاستخراج أرقام الهواتف
    rawHtmlText = await tab.evaluate(() => document.body.innerText || "");

    items.push(...extracted.filter(r => r.title && r.link));

    await tab.close();
  } catch (err: any) {
    console.error("[Google Bright Data] Error:", err.message);
    throw new Error(`فشل البحث في Google عبر Bright Data: ${err.message}`);
  } finally {
    await browser.close();
  }

  return { items, rawHtmlText };
}

function normalizeGoogleSearchCity(city: string): string {
  const normalized = city.trim();
  return normalized === ALL_CITIES_VALUE ? "" : normalized;
}

function buildGoogleSearchQuery(
  keyword: string,
  city: string,
  searchType: "businesses" | "general"
): {
  query: string;
  analysisCity: string;
} {
  const normalizedCity = normalizeGoogleSearchCity(city);
  const query =
    searchType === "businesses"
      ? [keyword, normalizedCity, "السعودية"].filter(Boolean).join(" ")
      : [keyword, normalizedCity].filter(Boolean).join(" ");

  return {
    query,
    analysisCity: normalizedCity || "السعودية",
  };
}

async function runGoogleSerpFallback(
  query: string,
  page = 1
): Promise<{
  items: Array<{ title: string; link: string; snippet: string; displayLink: string }>;
  rawHtmlText: string;
}> {
  const googleUrl = buildGoogleSearchUrl({ query, hl: "ar", gl: "sa", num: 10, page });
  const serpHtml = await serpRequest(googleUrl);
  const serpResults = parseGoogleResultsGeneric(serpHtml);

  const items = serpResults
    .map((r: any) => ({
      title: r.displayName || "",
      link: r.url || "",
      snippet: r.bio || "",
      displayLink: (() => {
        try {
          return new URL(r.url || "").hostname.replace("www.", "");
        } catch {
          return "";
        }
      })(),
    }))
    .filter((r: any) => r.title && r.link);

  return { items, rawHtmlText: serpHtml };
}

// ===== دالة البحث الرئيسية =====
export async function searchGoogleWeb(
  keyword: string,
  city: string,
  searchType: "businesses" | "general" = "businesses",
  page = 1
): Promise<{
  results: GoogleSearchResult[];
  rawCount: number;
  query: string;
  totalResults?: string;
}> {
  const { query, analysisCity } = buildGoogleSearchQuery(keyword, city, searchType);

  let items: Array<{ title: string; link: string; snippet: string; displayLink: string }> = [];
  let rawHtmlText = "";

  try {
    const scraped = await scrapeGoogleSearch(query, page);
    items = scraped.items;
    rawHtmlText = scraped.rawHtmlText;
    if (items.length === 0) {
      console.warn("[Google Search] Browser returned 0 results, trying SERP fallback");
      const fallback = await runGoogleSerpFallback(query, page);
      items = fallback.items;
      rawHtmlText = fallback.rawHtmlText;
    }
  } catch (puppeteerErr: any) {
    // ─── Fallback: SERP REST API ─────────────────────────────────────────────
    console.warn("[Google Search] Puppeteer failed, falling back to SERP REST API:", puppeteerErr.message);
    try {
      const fallback = await runGoogleSerpFallback(query, page);
      items = fallback.items;
      rawHtmlText = fallback.rawHtmlText;
      console.log(`[Google Search] SERP fallback returned ${items.length} results`);
    } catch (serpErr: any) {
      throw new Error(
        `[Google Search] Browser failed: ${puppeteerErr.message || "unknown error"} | SERP fallback failed: ${serpErr.message || "unknown error"}`
      );
      // كلا الطريقتين فشلتا — أرجع الخطأ الأصلي
      throw new Error(puppeteerErr.message || "فشل في البحث عبر Bright Data");
    }
  }

  if (items.length === 0) {
    return { results: [], rawCount: 0, query };
  }

  // استخراج أرقام الهواتف من النص الكامل
  const allText = rawHtmlText + " " + items.map(i => `${i.title} ${i.snippet}`).join(" ");
  const realPhones = extractPhones(allText);
  const realWebsites = extractWebsites(items.map(i => i.link));

  // تحليل النتائج بالـ AI
  const resultsText = items
    .map((r, i) => `[${i + 1}] العنوان: ${r.title}\nالرابط: ${r.link}\nالمقتطف: ${r.snippet}`)
    .join("\n\n");

  return await analyzeWithAI(resultsText, keyword, analysisCity, realPhones, realWebsites, query, items);
}

async function analyzeWithAI(
  text: string,
  keyword: string,
  city: string,
  realPhones: string[],
  realWebsites: string[],
  query: string,
  rawItems: Array<{ title: string; link: string; snippet: string; displayLink: string }>
): Promise<{ results: GoogleSearchResult[]; rawCount: number; query: string; totalResults?: string }> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `أنت محلل استخباراتي تجاري متخصص في السوق السعودي.
مهمتك: تحليل نتائج بحث Google واستخراج الأنشطة التجارية الحقيقية.

قواعد صارمة:
1. استخرج فقط الأنشطة التجارية الحقيقية (مطاعم، محلات، شركات، عيادات، إلخ)
2. حقل phone: اتركه فارغاً "" دائماً - الأرقام تأتي من مصدر منفصل
3. حقل website: استخرجه من الرابط الفعلي فقط إذا كان موقع الشركة
4. isLeadCandidate: true إذا كان نشاطاً تجارياً يحتاج خدمات تسويق
5. relevanceScore: من 1-10 بناءً على مدى ملاءمة النشاط للبحث
6. لا تخترع أي بيانات
7. الحد الأقصى 10 نتائج`,
        },
        {
          role: "user",
          content: `حلّل نتائج Google لـ "${keyword}" في "${city}" واستخرج الأنشطة التجارية:\n\n${text.slice(0, 8000)}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "google_search_results",
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
                    description: { type: "string" },
                    url: { type: "string" },
                    displayUrl: { type: "string" },
                    phone: { type: "string" },
                    businessType: { type: "string" },
                    city: { type: "string" },
                    relevanceScore: { type: "number" },
                    isLeadCandidate: { type: "boolean" },
                    instagramUrl: { type: "string" },
                    twitterUrl: { type: "string" },
                    snapchatUrl: { type: "string" },
                    tiktokUrl: { type: "string" },
                  },
                  required: ["name", "description", "url", "displayUrl", "phone", "businessType", "city", "relevanceScore", "isLeadCandidate", "instagramUrl", "twitterUrl", "snapchatUrl", "tiktokUrl"],
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

    const parsed = JSON.parse(response.choices[0].message.content as string);
    const aiResults = (parsed.results || []).filter((r: any) => r.name && r.name.trim() !== "");

    const finalResults: GoogleSearchResult[] = aiResults.map((r: any, idx: number) => ({
      id: `google-${Date.now()}-${idx}`,
      name: r.name,
      description: r.description || "",
      url: r.url || rawItems[idx]?.link || "",
      displayUrl: r.displayUrl || rawItems[idx]?.displayLink || "",
      phone: "",
      availablePhones: realPhones,
      availableWebsites: realWebsites,
      businessType: r.businessType || "غير محدد",
      city: r.city || city,
      relevanceScore: Math.min(10, Math.max(1, r.relevanceScore || 5)),
      dataSource: "google_bright_data",
      isLeadCandidate: r.isLeadCandidate ?? true,
      socialLinks: {
        instagram: r.instagramUrl || undefined,
        twitter: r.twitterUrl || undefined,
        snapchat: r.snapchatUrl || undefined,
        tiktok: r.tiktokUrl || undefined,
      },
    }));

    return {
      results: finalResults,
      rawCount: rawItems.length,
      query,
    };
  } catch (err) {
    console.error("[Google Search] AI analysis error:", err);
    // fallback: إرجاع النتائج الخام بدون تحليل AI
    const fallbackResults: GoogleSearchResult[] = rawItems.map((item, idx) => ({
      id: `google-${Date.now()}-${idx}`,
      name: item.title,
      description: item.snippet,
      url: item.link,
      displayUrl: item.displayLink,
      phone: "",
      availablePhones: realPhones,
      availableWebsites: realWebsites,
      businessType: "غير محدد",
      city,
      relevanceScore: 5,
      dataSource: "google_bright_data",
      isLeadCandidate: true,
      socialLinks: {},
    }));
    return { results: fallbackResults, rawCount: rawItems.length, query };
  }
}

// ===== البحث المتعمق في موقع محدد عبر Bright Data =====
export async function deepSearchWebsite(url: string, keyword: string): Promise<{
  phones: string[];
  emails: string[];
  socialLinks: Record<string, string>;
  description: string;
}> {
  // محاولة أولى: Bright Data Browser
  try {
    const browser = await openBrightDataBrowser();
    try {
      const tab = await browser.newPage();
      await tab.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
      );
      await tab.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
      await sleep(1000);

      const html = await tab.evaluate(() => document.body.innerHTML || "");
      const text = await tab.evaluate(() => document.body.innerText || "");
      await tab.close();
      await browser.close();

      const phones = extractPhones(text);
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const emails = Array.from(new Set(text.match(emailRegex) || []))
        .filter(e => !e.includes("example.com") && !e.includes("test.com"))
        .slice(0, 3);

      const socialLinks: Record<string, string> = {};
      const instagramMatch = html.match(/instagram\.com\/([a-zA-Z0-9._]+)/);
      if (instagramMatch) socialLinks.instagram = `https://instagram.com/${instagramMatch[1]}`;
      const twitterMatch = html.match(/twitter\.com\/([a-zA-Z0-9_]+)/);
      if (twitterMatch) socialLinks.twitter = `https://twitter.com/${twitterMatch[1]}`;
      const snapchatMatch = html.match(/snapchat\.com\/add\/([a-zA-Z0-9._-]+)/);
      if (snapchatMatch) socialLinks.snapchat = `https://snapchat.com/add/${snapchatMatch[1]}`;
      const tiktokMatch = html.match(/tiktok\.com\/@([a-zA-Z0-9._]+)/);
      if (tiktokMatch) socialLinks.tiktok = `https://tiktok.com/@${tiktokMatch[1]}`;

      const metaDescMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i);
      const description = metaDescMatch?.[1] || "";

      return { phones, emails, socialLinks, description };
    } catch (innerErr) {
      await browser.close();
      throw innerErr;
    }
  } catch {
    // fallback: fetch مباشر
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "ar-SA,ar;q=0.9,en-US;q=0.8",
        },
        signal: AbortSignal.timeout(15000),
      });

      const html = await response.text();
      const phones = extractPhones(html);
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const emails = Array.from(new Set(html.match(emailRegex) || []))
        .filter(e => !e.includes("example.com") && !e.includes("test.com"))
        .slice(0, 3);

      const socialLinks: Record<string, string> = {};
      const instagramMatch = html.match(/instagram\.com\/([a-zA-Z0-9._]+)/);
      if (instagramMatch) socialLinks.instagram = `https://instagram.com/${instagramMatch[1]}`;
      const twitterMatch = html.match(/twitter\.com\/([a-zA-Z0-9_]+)/);
      if (twitterMatch) socialLinks.twitter = `https://twitter.com/${twitterMatch[1]}`;
      const snapchatMatch = html.match(/snapchat\.com\/add\/([a-zA-Z0-9._-]+)/);
      if (snapchatMatch) socialLinks.snapchat = `https://snapchat.com/add/${snapchatMatch[1]}`;
      const tiktokMatch = html.match(/tiktok\.com\/@([a-zA-Z0-9._]+)/);
      if (tiktokMatch) socialLinks.tiktok = `https://tiktok.com/@${tiktokMatch[1]}`;

      const metaDescMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i);
      const description = metaDescMatch?.[1] || "";

      return { phones, emails, socialLinks, description };
    } catch {
      return { phones: [], emails: [], socialLinks: {}, description: "" };
    }
  }
}

// ===== Router =====
export const googleSearchRouter = router({
  // البحث في Google Web عبر Bright Data Browser API
  searchWeb: protectedProcedure
    .input(z.object({
      keyword: z.string().min(1),
      city: z.string().default("الرياض"),
      searchType: z.enum(["businesses", "general"]).default("businesses"),
      page: z.number().default(1),
    }))
    .mutation(async ({ input }) => {
      try {
        const result = await searchGoogleWeb(input.keyword, input.city, input.searchType, input.page);
        return result;
      } catch (err: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err.message });
      }
    }),

  // البحث المتعمق في موقع محدد
  deepSearchSite: protectedProcedure
    .input(z.object({
      url: z.string().url(),
      keyword: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      try {
        const result = await deepSearchWebsite(input.url, input.keyword);
        return result;
      } catch (err: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err.message });
      }
    }),

  // تحقق من حالة Bright Data
  checkApiStatus: protectedProcedure
    .query(async () => {
      const hasBrightData = !!BRIGHT_DATA_WS_ENDPOINT;
      return {
        brightDataConfigured: hasBrightData,
        method: "bright_data_browser",
        status: hasBrightData ? "جاهز" : "يحتاج إعداد BRIGHT_DATA_WS_ENDPOINT",
        dailyLimit: "غير محدود (يعتمد على رصيد Bright Data)",
        note: "يستخدم Bright Data Browser API لتجنب الحجب",
      };
    }),
});
