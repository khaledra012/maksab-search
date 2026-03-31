/**
 * Profile Enricher
 * ================
 * يجلب صفحة الحساب الكاملة من Instagram / TikTok / Snapchat / Twitter
 * عبر Bright Data Residential Proxy ويستخرج:
 *   - رقم الهاتف (regex من HTML الخام)
 *   - الموقع الإلكتروني (regex من HTML الخام)
 *   - روابط المنصات المتقاطعة (crossPlatformHandles)
 *   - عدد المتابعين الحقيقي
 *   - الـ bio الكامل
 *   - عنوان العمل / المدينة
 *
 * المبدأ الصارم: الأرقام والمواقع من regex فقط — لا AI لا تخمين.
 */

import { ENV } from "../_core/env";

// ─── الأنماط ────────────────────────────────────────────────────────────────

const PHONE_REGEX = /(?:\+966|00966|0)(?:5[0-9]{8}|[1-9][0-9]{7})/g;
const URL_REGEX = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,6}\b(?:[-a-zA-Z0-9@:%_+.~#?&/=]*)/g;

const SOCIAL_DOMAINS = [
  "instagram.com", "tiktok.com", "snapchat.com", "twitter.com", "x.com",
  "facebook.com", "linkedin.com", "youtube.com", "t.me", "telegram.me",
  "wa.me", "whatsapp.com",
];

const EXCLUDED_DOMAINS = [
  "cdn.", "static.", "assets.", "img.", "images.",
  ".js", ".css", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".woff",
  "google.com", "apple.com", "microsoft.com", "cloudflare.com", "amazonaws.com",
  "w3.org", "schema.org", "openstreetmap.org", "gstatic.com", "googleapis.com",
  "fbcdn.net", "cdninstagram.com", "tiktokcdn.com",
];

// ─── أدوات مساعدة ────────────────────────────────────────────────────────────

function extractPhones(html: string): string[] {
  const matches = html.match(PHONE_REGEX) || [];
  const cleaned = Array.from(new Set(matches.map(p => {
    const digits = p.replace(/\D/g, "");
    if (digits.startsWith("966")) return "0" + digits.slice(3);
    if (digits.startsWith("00966")) return "0" + digits.slice(5);
    return digits;
  })));
  return cleaned.filter(p => p.length >= 10 && p.length <= 12);
}

function extractWebsites(html: string, excludeSocial = true): string[] {
  const matches = html.match(URL_REGEX) || [];
  return Array.from(new Set(matches))
    .filter(url => {
      const lower = url.toLowerCase();
      if (EXCLUDED_DOMAINS.some(p => lower.includes(p))) return false;
      if (excludeSocial && SOCIAL_DOMAINS.some(d => lower.includes(d))) return false;
      return url.length < 150;
    })
    .slice(0, 5);
}

function extractSocialLinks(html: string): Record<string, string> {
  const matches = html.match(URL_REGEX) || [];
  const result: Record<string, string> = {};
  for (const url of matches) {
    const lower = url.toLowerCase();
    if (lower.includes("instagram.com/") && !result.instagram) {
      const m = url.match(/instagram\.com\/([A-Za-z0-9_.]+)/);
      if (m && m[1] && !["p", "reel", "stories", "explore"].includes(m[1])) {
        result.instagram = `@${m[1]}`;
      }
    }
    if ((lower.includes("tiktok.com/@") || lower.includes("tiktok.com/")) && !result.tiktok) {
      const m = url.match(/tiktok\.com\/@([A-Za-z0-9_.]+)/);
      if (m && m[1]) result.tiktok = `@${m[1]}`;
    }
    if (lower.includes("snapchat.com/add/") && !result.snapchat) {
      const m = url.match(/snapchat\.com\/add\/([A-Za-z0-9_.]+)/);
      if (m && m[1]) result.snapchat = `@${m[1]}`;
    }
    if ((lower.includes("twitter.com/") || lower.includes("x.com/")) && !result.twitter) {
      const m = url.match(/(?:twitter|x)\.com\/([A-Za-z0-9_]+)/);
      if (m && m[1] && !["i", "home", "search", "explore"].includes(m[1])) {
        result.twitter = `@${m[1]}`;
      }
    }
    if (lower.includes("t.me/") && !result.telegram) {
      const m = url.match(/t\.me\/([A-Za-z0-9_]+)/);
      if (m && m[1]) result.telegram = `@${m[1]}`;
    }
    if (lower.includes("wa.me/") && !result.whatsapp) {
      const m = url.match(/wa\.me\/([0-9]+)/);
      if (m && m[1]) result.whatsapp = m[1];
    }
  }
  return result;
}

function extractFollowers(html: string): number | undefined {
  // أنماط شائعة لعدد المتابعين
  const patterns = [
    /["']followerCount["']\s*:\s*(\d+)/i,
    /["']followers["']\s*:\s*(\d+)/i,
    /([\d,]+)\s*(?:متابع|followers?)/i,
    /data-followers="(\d+)"/i,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) {
      const n = parseInt(m[1].replace(/,/g, ""), 10);
      if (!isNaN(n) && n > 0) return n;
    }
  }
  return undefined;
}

function extractBio(html: string, platform: string): string {
  // استخراج الـ bio من meta description أو JSON-LD
  const metaDesc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  if (metaDesc) return metaDesc[1].slice(0, 500);

  const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
  if (ogDesc) return ogDesc[1].slice(0, 500);

  return "";
}

function extractCity(html: string): string | undefined {
  const CITY_PATTERNS: Record<string, RegExp> = {
    "الرياض": /\b(?:الرياض|riyadh)\b/i,
    "جدة": /\b(?:جدة|jeddah|jiddah)\b/i,
    "مكة": /\b(?:مكة|مكه|mecca|makkah)\b/i,
    "المدينة": /\b(?:المدينة|medina|madinah)\b/i,
    "الدمام": /\b(?:الدمام|dammam)\b/i,
    "الخبر": /\b(?:الخبر|khobar)\b/i,
    "الطائف": /\b(?:الطائف|taif)\b/i,
    "أبها": /\b(?:أبها|abha)\b/i,
    "تبوك": /\b(?:تبوك|tabuk)\b/i,
  };
  for (const [city, pattern] of Object.entries(CITY_PATTERNS)) {
    if (pattern.test(html)) return city;
  }
  return undefined;
}

// ─── Bright Data Residential Proxy fetch ─────────────────────────────────────

const PROXY_HOST = process.env.BRIGHT_DATA_RESIDENTIAL_HOST || "brd.superproxy.io";
const PROXY_PORT = parseInt(process.env.BRIGHT_DATA_RESIDENTIAL_PORT || "33335");
const PROXY_USER = process.env.BRIGHT_DATA_RESIDENTIAL_USERNAME || "";
const PROXY_PASS = process.env.BRIGHT_DATA_RESIDENTIAL_PASSWORD || "";

const USER_AGENTS = [
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1",
];

async function fetchViaProxy(url: string, timeoutMs = 15000): Promise<string> {
  if (!PROXY_USER || !PROXY_PASS) {
    throw new Error("Bright Data Residential Proxy credentials not configured");
  }

  // استخدام CONNECT tunnel عبر fetch مع proxy auth header
  const proxyAuth = Buffer.from(`${PROXY_USER}:${PROXY_PASS}`).toString("base64");
  const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

  // Bright Data يدعم HTTP proxy عبر header Proxy-Authorization
  const proxyUrl = `http://${PROXY_USER}:${PROXY_PASS}@${PROXY_HOST}:${PROXY_PORT}`;

  // استخدام node-fetch مع ProxyAgent إذا كان متاحاً، وإلا نستخدم fetch مباشرة مع headers
  try {
    const { HttpsProxyAgent } = await import("https-proxy-agent");
    const agent = new HttpsProxyAgent(proxyUrl);

    const res = await fetch(url, {
      // @ts-ignore
      agent,
      headers: {
        "User-Agent": ua,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ar-SA,ar;q=0.9,en-US;q=0.8",
        "Cache-Control": "no-cache",
        "Referer": "https://www.google.com/",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (proxyErr) {
    // fallback: محاولة مباشرة بدون proxy
    console.warn(`[ProfileEnricher] Proxy fetch failed for ${url}:`, proxyErr);
    const res = await fetch(url, {
      headers: {
        "User-Agent": ua,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ar-SA,ar;q=0.9,en-US;q=0.8",
        "Cache-Control": "no-cache",
        "Referer": "https://www.google.com/",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  }
}

// ─── نوع النتيجة ──────────────────────────────────────────────────────────────

export interface EnrichedProfile {
  url: string;
  platform: string;
  username?: string;
  displayName?: string;
  bio?: string;
  phones: string[];
  websites: string[];
  crossPlatformHandles: Record<string, string>;
  followers?: number;
  city?: string;
  fetchedAt: number;
  success: boolean;
  error?: string;
}

// ─── استخراج username من URL ──────────────────────────────────────────────────

function extractUsernameFromUrl(url: string, platform: string): string | undefined {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length > 0) {
      const candidate = parts[parts.length - 1];
      // تجاهل الصفحات العامة
      if (!["explore", "reel", "p", "stories", "search", "trending", "discover"].includes(candidate)) {
        return candidate.startsWith("@") ? candidate : `@${candidate}`;
      }
    }
  } catch {}
  return undefined;
}

// ─── Instagram Profile Fetcher ────────────────────────────────────────────────

async function enrichInstagramProfile(profileUrl: string): Promise<EnrichedProfile> {
  const result: EnrichedProfile = {
    url: profileUrl,
    platform: "instagram",
    phones: [],
    websites: [],
    crossPlatformHandles: {},
    fetchedAt: Date.now(),
    success: false,
  };

  try {
    // تطبيع الـ URL
    const url = profileUrl.includes("instagram.com")
      ? profileUrl
      : `https://www.instagram.com/${profileUrl.replace(/^@/, "")}/`;

    const html = await fetchViaProxy(url);

    result.phones = extractPhones(html);
    result.websites = extractWebsites(html, true);
    result.crossPlatformHandles = extractSocialLinks(html);
    result.followers = extractFollowers(html);
    result.bio = extractBio(html, "instagram");
    result.city = extractCity(html);
    result.username = extractUsernameFromUrl(url, "instagram");

    // استخراج الاسم من og:title
    const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
    if (ogTitle) result.displayName = ogTitle[1].replace(/\s*\(@[^)]+\)/, "").trim();

    // استخراج الهاتف من الـ bio مباشرة
    if (result.bio) {
      const bioPhones = extractPhones(result.bio);
      result.phones = Array.from(new Set([...result.phones, ...bioPhones]));
    }

    result.success = true;
    console.log(`[ProfileEnricher] Instagram ${url}: phones=${result.phones.length} websites=${result.websites.length} handles=${Object.keys(result.crossPlatformHandles).length}`);
  } catch (err) {
    result.error = String(err);
    console.warn(`[ProfileEnricher] Instagram failed:`, err);
  }

  return result;
}

// ─── TikTok Profile Fetcher ───────────────────────────────────────────────────

async function enrichTikTokProfile(profileUrl: string): Promise<EnrichedProfile> {
  const result: EnrichedProfile = {
    url: profileUrl,
    platform: "tiktok",
    phones: [],
    websites: [],
    crossPlatformHandles: {},
    fetchedAt: Date.now(),
    success: false,
  };

  try {
    const url = profileUrl.includes("tiktok.com")
      ? profileUrl
      : `https://www.tiktok.com/@${profileUrl.replace(/^@/, "")}`;

    const html = await fetchViaProxy(url);

    result.phones = extractPhones(html);
    result.websites = extractWebsites(html, true);
    result.crossPlatformHandles = extractSocialLinks(html);
    result.followers = extractFollowers(html);
    result.bio = extractBio(html, "tiktok");
    result.city = extractCity(html);
    result.username = extractUsernameFromUrl(url, "tiktok");

    const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
    if (ogTitle) result.displayName = ogTitle[1].replace(/\s*\(@[^)]+\)/, "").trim();

    if (result.bio) {
      const bioPhones = extractPhones(result.bio);
      result.phones = Array.from(new Set([...result.phones, ...bioPhones]));
    }

    result.success = true;
    console.log(`[ProfileEnricher] TikTok ${url}: phones=${result.phones.length} websites=${result.websites.length} handles=${Object.keys(result.crossPlatformHandles).length}`);
  } catch (err) {
    result.error = String(err);
    console.warn(`[ProfileEnricher] TikTok failed:`, err);
  }

  return result;
}

// ─── Snapchat Profile Fetcher ─────────────────────────────────────────────────

async function enrichSnapchatProfile(profileUrl: string): Promise<EnrichedProfile> {
  const result: EnrichedProfile = {
    url: profileUrl,
    platform: "snapchat",
    phones: [],
    websites: [],
    crossPlatformHandles: {},
    fetchedAt: Date.now(),
    success: false,
  };

  try {
    const url = profileUrl.includes("snapchat.com")
      ? profileUrl
      : `https://www.snapchat.com/add/${profileUrl.replace(/^@/, "")}`;

    const html = await fetchViaProxy(url);

    result.phones = extractPhones(html);
    result.websites = extractWebsites(html, true);
    result.crossPlatformHandles = extractSocialLinks(html);
    result.bio = extractBio(html, "snapchat");
    result.city = extractCity(html);
    result.username = extractUsernameFromUrl(url, "snapchat");

    const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
    if (ogTitle) result.displayName = ogTitle[1].trim();

    if (result.bio) {
      const bioPhones = extractPhones(result.bio);
      result.phones = Array.from(new Set([...result.phones, ...bioPhones]));
    }

    result.success = true;
    console.log(`[ProfileEnricher] Snapchat ${url}: phones=${result.phones.length} websites=${result.websites.length}`);
  } catch (err) {
    result.error = String(err);
    console.warn(`[ProfileEnricher] Snapchat failed:`, err);
  }

  return result;
}

// ─── Twitter/X Profile Fetcher ────────────────────────────────────────────────

async function enrichTwitterProfile(profileUrl: string): Promise<EnrichedProfile> {
  const result: EnrichedProfile = {
    url: profileUrl,
    platform: "twitter",
    phones: [],
    websites: [],
    crossPlatformHandles: {},
    fetchedAt: Date.now(),
    success: false,
  };

  try {
    const url = profileUrl.includes("twitter.com") || profileUrl.includes("x.com")
      ? profileUrl
      : `https://x.com/${profileUrl.replace(/^@/, "")}`;

    const html = await fetchViaProxy(url);

    result.phones = extractPhones(html);
    result.websites = extractWebsites(html, true);
    result.crossPlatformHandles = extractSocialLinks(html);
    result.followers = extractFollowers(html);
    result.bio = extractBio(html, "twitter");
    result.city = extractCity(html);
    result.username = extractUsernameFromUrl(url, "twitter");

    const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
    if (ogTitle) result.displayName = ogTitle[1].replace(/\s*\(@[^)]+\)/, "").trim();

    if (result.bio) {
      const bioPhones = extractPhones(result.bio);
      result.phones = Array.from(new Set([...result.phones, ...bioPhones]));
    }

    result.success = true;
    console.log(`[ProfileEnricher] Twitter ${url}: phones=${result.phones.length} websites=${result.websites.length}`);
  } catch (err) {
    result.error = String(err);
    console.warn(`[ProfileEnricher] Twitter failed:`, err);
  }

  return result;
}

// ─── الدالة الرئيسية: تحديد المنصة وجلب البيانات ─────────────────────────────

export async function enrichProfile(url: string): Promise<EnrichedProfile> {
  const lower = url.toLowerCase();

  if (lower.includes("instagram.com") || lower.includes("instagram")) {
    return enrichInstagramProfile(url);
  }
  if (lower.includes("tiktok.com") || lower.includes("tiktok")) {
    return enrichTikTokProfile(url);
  }
  if (lower.includes("snapchat.com") || lower.includes("snapchat")) {
    return enrichSnapchatProfile(url);
  }
  if (lower.includes("twitter.com") || lower.includes("x.com")) {
    return enrichTwitterProfile(url);
  }

  // منصة غير معروفة — محاولة عامة
  return {
    url,
    platform: "unknown",
    phones: [],
    websites: [],
    crossPlatformHandles: {},
    fetchedAt: Date.now(),
    success: false,
    error: "Unknown platform",
  };
}

/**
 * إثراء مجموعة من الـ candidates بالتوازي
 * يجلب صفحة كل حساب ويضيف البيانات المستخرجة
 * مع حد أقصى للتوازي لتجنب الحظر
 */
export async function enrichCandidatesBatch(
  candidates: Array<{ url?: string; source?: string; usernameHint?: string }>,
  maxConcurrent = 3
): Promise<Map<string, EnrichedProfile>> {
  const results = new Map<string, EnrichedProfile>();

  // فلترة الـ candidates التي لديها URL صالح لمنصة سوشيال
  const toEnrich = candidates.filter(c => {
    if (!c.url) return false;
    const lower = c.url.toLowerCase();
    return (
      lower.includes("instagram.com") ||
      lower.includes("tiktok.com") ||
      lower.includes("snapchat.com") ||
      lower.includes("twitter.com") ||
      lower.includes("x.com")
    );
  });

  if (toEnrich.length === 0) return results;

  console.log(`[ProfileEnricher] Enriching ${toEnrich.length} profiles (max concurrent: ${maxConcurrent})`);

  // معالجة على دفعات
  for (let i = 0; i < toEnrich.length; i += maxConcurrent) {
    const batch = toEnrich.slice(i, i + maxConcurrent);
    const batchResults = await Promise.allSettled(
      batch.map(c => enrichProfile(c.url!))
    );

    for (let j = 0; j < batch.length; j++) {
      const candidate = batch[j];
      const settled = batchResults[j];
      if (settled.status === "fulfilled" && candidate.url) {
        results.set(candidate.url, settled.value);
      }
    }

    // تأخير بين الدفعات لتجنب الحظر
    if (i + maxConcurrent < toEnrich.length) {
      await new Promise(r => setTimeout(r, 1500 + Math.random() * 1000));
    }
  }

  console.log(`[ProfileEnricher] Done: ${results.size} profiles enriched`);
  return results;
}
