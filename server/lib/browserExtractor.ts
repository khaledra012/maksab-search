/**
 * browserExtractor.ts
 * =====================
 * Layer 1 of Browser Verification Agent
 *
 * مسؤولية هذه الطبقة:
 *   - فتح الروابط المحددة فقط (لا تصفح حر)
 *   - استخراج أدلة الهوية من الصفحات ذات الصلة فقط
 *   - إرجاع raw evidence بدون تفسير أو قرار
 *
 * قواعد صارمة:
 *   - ممنوع التخمين أو ملء بيانات ناقصة
 *   - ممنوع اتخاذ أي قرار دمج
 *   - ممنوع الكتابة في قاعدة البيانات
 *   - كل معلومة غير مؤكدة تُوسم بـ unconfirmed
 */

import { HttpsProxyAgent } from "https-proxy-agent";

// ===== Types =====

export interface RawPageEvidence {
  url: string;
  source: string;
  fetchedAt: string;
  /** الاسم الظاهر في الصفحة — من title أو h1 أو og:title */
  visibleName: string | null;
  /** أرقام الهاتف المستخرجة — مباشرة من النص أو schema */
  phones: string[];
  /** عناوين البريد الإلكتروني */
  emails: string[];
  /** النطاقات المذكورة في الصفحة */
  domains: string[];
  /** روابط السوشيال المذكورة */
  socialLinks: string[];
  /** إشارات المدينة */
  cityHints: string[];
  /** إشارات الفئة أو النشاط */
  categoryHints: string[];
  /** روابط واتساب أو تواصل مباشر */
  contactLinks: string[];
  /** بيانات schema.org / JSON-LD / og tags */
  structuredData: Record<string, unknown>;
  /** هل فشل الجلب؟ */
  fetchError: string | null;
  /** هل البيانات موثوقة؟ */
  confidence: "high" | "medium" | "low" | "failed";
}

// ===== Constants =====

const PHONE_REGEX = /(?:\+966|00966|0)?(?:5\d{8}|[2-9]\d{7})/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const DOMAIN_REGEX = /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9\-]+\.[a-zA-Z]{2,})(?:\/[^\s"'<>]*)?/g;
const SOCIAL_DOMAINS = ["instagram.com", "tiktok.com", "snapchat.com", "x.com", "twitter.com", "facebook.com", "linkedin.com", "youtube.com"];
const WHATSAPP_REGEX = /(?:wa\.me|whatsapp\.com\/send|api\.whatsapp\.com)[^\s"'<>]*/g;

const CITY_KEYWORDS: Record<string, string> = {
  "الرياض": "Riyadh", "riyadh": "Riyadh",
  "جدة": "Jeddah", "jeddah": "Jeddah",
  "مكة": "Makkah", "mecca": "Makkah",
  "المدينة": "Madinah", "medina": "Madinah",
  "الدمام": "Dammam", "dammam": "Dammam",
  "الخبر": "Khobar", "khobar": "Khobar",
  "الطائف": "Taif", "taif": "Taif",
  "أبها": "Abha", "abha": "Abha",
  "تبوك": "Tabuk", "tabuk": "Tabuk",
  "بريدة": "Buraidah", "buraidah": "Buraidah",
};

// ===== Proxy Setup =====

const PROXY_HOST = process.env.BRIGHT_DATA_RESIDENTIAL_HOST || "brd.superproxy.io";
const PROXY_PORT = process.env.BRIGHT_DATA_RESIDENTIAL_PORT || "33335";
const PROXY_USER = process.env.BRIGHT_DATA_RESIDENTIAL_USERNAME || "";
const PROXY_PASS = process.env.BRIGHT_DATA_RESIDENTIAL_PASSWORD || "";

function buildProxyAgent(): HttpsProxyAgent<string> | null {
  if (!PROXY_USER || !PROXY_PASS) return null;
  const proxyUrl = `http://${PROXY_USER}:${PROXY_PASS}@${PROXY_HOST}:${PROXY_PORT}`;
  return new HttpsProxyAgent(proxyUrl);
}

// ===== HTML Parsers =====

function extractPhones(text: string): string[] {
  const matches = text.match(PHONE_REGEX) || [];
  return Array.from(new Set(matches.map(p => p.replace(/\s/g, "").trim())));
}

function extractEmails(text: string): string[] {
  const matches = text.match(EMAIL_REGEX) || [];
  return Array.from(new Set(matches.filter(e => !e.includes("example.com") && !e.includes("test."))));
}

function extractSocialLinks(html: string): string[] {
  const links: string[] = [];
  const hrefRegex = /href=["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = hrefRegex.exec(html)) !== null) {
    const href = m[1];
    if (SOCIAL_DOMAINS.some(d => href.includes(d))) {
      links.push(href.split("?")[0].trim());
    }
  }
  return Array.from(new Set(links));
}

function extractDomains(html: string, pageUrl: string): string[] {
  const domains: string[] = [];
  const pageHost = (() => {
    try { return new URL(pageUrl).hostname.replace("www.", ""); } catch { return ""; }
  })();

  const matchesArr = Array.from(html.matchAll(DOMAIN_REGEX));
  for (const m of matchesArr) {
    const domain = m[1].toLowerCase();
    if (
      domain.length > 4 &&
      !SOCIAL_DOMAINS.some(s => domain.includes(s.replace(".com", ""))) &&
      !domain.includes("google") &&
      !domain.includes("apple") &&
      !domain.includes("gstatic") &&
      domain !== pageHost
    ) {
      domains.push(domain);
    }
  }
  return Array.from(new Set(domains)).slice(0, 5);
}

function extractCityHints(text: string): string[] {
  const found: string[] = [];
  const lower = text.toLowerCase();
  for (const [keyword, canonical] of Object.entries(CITY_KEYWORDS)) {
    if (lower.includes(keyword.toLowerCase()) && !found.includes(canonical)) {
      found.push(canonical);
    }
  }
  return found;
}

function extractContactLinks(html: string): string[] {
  const links: string[] = [];
  const waMatches = html.match(WHATSAPP_REGEX) || [];
  links.push(...waMatches.map(l => `https://${l}`));

  const telRegex = /href=["'](tel:[^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = telRegex.exec(html)) !== null) {
    links.push(m[1]);
  }
  return Array.from(new Set(links));
}

function extractStructuredData(html: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // JSON-LD
  const jsonLdRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  const schemas: unknown[] = [];
  while ((m = jsonLdRegex.exec(html)) !== null) {
    try {
      schemas.push(JSON.parse(m[1]));
    } catch {}
  }
  if (schemas.length > 0) result.jsonLd = schemas;

  // OG tags
  const ogRegex = /<meta[^>]+property=["'](og:[^"']+)["'][^>]+content=["']([^"']+)["'][^>]*>/gi;
  const og: Record<string, string> = {};
  while ((m = ogRegex.exec(html)) !== null) {
    og[m[1]] = m[2];
  }
  if (Object.keys(og).length > 0) result.og = og;

  // title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) result.title = titleMatch[1].trim();

  return result;
}

function extractVisibleName(html: string): string | null {
  // og:title أولاً
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  if (ogTitle) return ogTitle[1].trim();

  // h1
  const h1 = html.match(/<h1[^>]*>([^<]{3,80})<\/h1>/i);
  if (h1) return h1[1].replace(/<[^>]+>/g, "").trim();

  // title
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (title) return title[1].split("|")[0].split("-")[0].trim();

  return null;
}

// ===== Main Extractor =====

const FETCH_TIMEOUT_MS = 20_000;

async function fetchPage(url: string, agent: HttpsProxyAgent<string> | null): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const options: RequestInit & { agent?: unknown } = {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        "Accept-Language": "ar-SA,ar;q=0.9,en;q=0.8",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    };
    if (agent) (options as any).agent = agent;

    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * استخراج أدلة الهوية من رابط واحد
 * لا يُستدعى إلا على روابط محددة مسبقاً من النظام
 */
export async function extractEvidenceFromUrl(
  url: string,
  source: string
): Promise<RawPageEvidence> {
  const agent = buildProxyAgent();
  const base: RawPageEvidence = {
    url,
    source,
    fetchedAt: new Date().toISOString(),
    visibleName: null,
    phones: [],
    emails: [],
    domains: [],
    socialLinks: [],
    cityHints: [],
    categoryHints: [],
    contactLinks: [],
    structuredData: {},
    fetchError: null,
    confidence: "low",
  };

  try {
    const html = await fetchPage(url, agent);
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

    base.visibleName = extractVisibleName(html);
    base.phones = extractPhones(text);
    base.emails = extractEmails(text);
    base.domains = extractDomains(html, url);
    base.socialLinks = extractSocialLinks(html);
    base.cityHints = extractCityHints(text);
    base.contactLinks = extractContactLinks(html);
    base.structuredData = extractStructuredData(html);

    // تقدير الثقة بناءً على كمية الأدلة
    const evidenceCount = base.phones.length + base.emails.length + base.domains.length + base.socialLinks.length;
    base.confidence = evidenceCount >= 3 ? "high" : evidenceCount >= 1 ? "medium" : "low";

  } catch (err: unknown) {
    base.fetchError = err instanceof Error ? err.message : String(err);
    base.confidence = "failed";
  }

  return base;
}

/**
 * استخراج أدلة من قائمة روابط بشكل متوازٍ (مع حد أقصى)
 * يُستدعى فقط على الروابط المعطاة من النظام — لا تصفح حر
 */
export async function extractEvidenceBatch(
  entries: Array<{ url: string; source: string }>
): Promise<RawPageEvidence[]> {
  // حد أقصى 6 روابط لمنع الإفراط في الطلبات
  const limited = entries.slice(0, 6);

  const results = await Promise.allSettled(
    limited.map(e => extractEvidenceFromUrl(e.url, e.source))
  );

  return results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    return {
      url: limited[i].url,
      source: limited[i].source,
      fetchedAt: new Date().toISOString(),
      visibleName: null,
      phones: [],
      emails: [],
      domains: [],
      socialLinks: [],
      cityHints: [],
      categoryHints: [],
      contactLinks: [],
      structuredData: {},
      fetchError: r.reason?.message || "unknown error",
      confidence: "failed" as const,
    };
  });
}
