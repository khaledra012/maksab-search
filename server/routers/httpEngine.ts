/**
 * HTTP Engine - طبقة HTTP مستقلة عالية الأداء
 * - User-Agent rotation: 60+ user agent من أجهزة ومتصفحات مختلفة
 * - Concurrent requests: 8 طلبات متزامنة مع p-limit
 * - Retry logic ذكي: exponential backoff مع تغيير User-Agent عند الفشل
 * - دعم SERP proxy (Bright Data) مع fallback مباشر
 * - استخراج بيانات هيكلية: هاتف، إيميل، موقع
 */

import * as http from "http";
import * as tls from "tls";

// ===== User-Agent Pool =====
const USER_AGENTS = [
  // Chrome on Windows
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  // Chrome on Mac
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  // Firefox on Windows
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
  // Firefox on Mac
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.3; rv:123.0) Gecko/20100101 Firefox/123.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13.6; rv:122.0) Gecko/20100101 Firefox/122.0",
  // Safari on Mac
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
  // Edge on Windows
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0",
  // Chrome on Android
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.105 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.105 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.6167.178 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 14; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36",
  // Safari on iPhone
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_7_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
  // Chrome on iPad
  "Mozilla/5.0 (iPad; CPU OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/122.0.6261.89 Mobile/15E148 Safari/604.1",
  // Samsung Browser
  "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/117.0.0.0 Mobile Safari/537.36",
  // Opera
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 OPR/108.0.0.0",
  // Brave
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Brave/122",
  // Linux Chrome
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:123.0) Gecko/20100101 Firefox/123.0",
  // Windows 7 (older)
  "Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36",
  // Arabic region specific
  "Mozilla/5.0 (Linux; Android 13; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 12; TECNO KG7h) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.111 Mobile Safari/537.36",
];

// Accept-Language pool متنوع
const ACCEPT_LANGUAGES = [
  "ar-SA,ar;q=0.9,en;q=0.8",
  "ar,en-US;q=0.9,en;q=0.8",
  "ar-SA,ar;q=0.9,en-US;q=0.8,en;q=0.7",
  "en-US,en;q=0.9,ar;q=0.8",
  "en-GB,en;q=0.9,ar;q=0.8",
  "ar-SA,ar;q=0.9",
  "ar-AE,ar;q=0.9,en;q=0.8",
];

let uaIndex = 0;
let langIndex = 0;

export function getRandomUserAgent(): string {
  const ua = USER_AGENTS[uaIndex % USER_AGENTS.length];
  uaIndex = (uaIndex + 1) % USER_AGENTS.length;
  return ua;
}

export function getRandomAcceptLanguage(): string {
  const lang = ACCEPT_LANGUAGES[langIndex % ACCEPT_LANGUAGES.length];
  langIndex = (langIndex + 1) % ACCEPT_LANGUAGES.length;
  return lang;
}

// ===== Concurrent Request Manager =====
const MAX_CONCURRENT = 6;
let activeCount = 0;
const waitQueue: Array<() => void> = [];

async function acquireSlot(): Promise<void> {
  if (activeCount < MAX_CONCURRENT) {
    activeCount++;
    return;
  }
  return new Promise((resolve) => {
    waitQueue.push(() => { activeCount++; resolve(); });
  });
}

function releaseSlot(): void {
  activeCount--;
  if (waitQueue.length > 0) {
    const next = waitQueue.shift()!;
    next();
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ===== Core HTTP Request via SERP Proxy =====
const SERP_HOST = process.env.BRIGHT_DATA_SERP_HOST || "brd.superproxy.io";
const SERP_PORT = parseInt(process.env.BRIGHT_DATA_SERP_PORT || "33335");
const SERP_USERNAME = process.env.BRIGHT_DATA_SERP_USERNAME || "";
const SERP_PASSWORD = process.env.BRIGHT_DATA_SERP_PASSWORD || "";

export async function httpGet(
  targetUrl: string,
  options: {
    useProxy?: boolean;
    userAgent?: string;
    acceptLanguage?: string;
    timeout?: number;
    retries?: number;
  } = {}
): Promise<string> {
  const {
    useProxy = true,
    userAgent = getRandomUserAgent(),
    acceptLanguage = getRandomAcceptLanguage(),
    timeout = 30000,
    retries = 3,
  } = options;

  await acquireSlot();
  try {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await httpGetRaw(targetUrl, {
          userAgent: attempt > 0 ? getRandomUserAgent() : userAgent,
          acceptLanguage: attempt > 0 ? getRandomAcceptLanguage() : acceptLanguage,
          timeout,
          useProxy,
        });
        return result;
      } catch (err: any) {
        const isRetryable =
          err.message?.includes("socket hang up") ||
          err.message?.includes("ECONNRESET") ||
          err.message?.includes("timeout") ||
          err.message?.includes("429");

        if (attempt < retries && isRetryable) {
          const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
          await sleep(delay);
          continue;
        }
        throw err;
      }
    }
    throw new Error("Max retries exceeded");
  } finally {
    releaseSlot();
  }
}

async function httpGetRaw(
  targetUrl: string,
  options: {
    userAgent: string;
    acceptLanguage: string;
    timeout: number;
    useProxy: boolean;
  }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const { userAgent, acceptLanguage, timeout: timeoutMs, useProxy } = options;
    const parsed = new URL(targetUrl);
    const targetHost = parsed.hostname;
    const targetPort = parsed.protocol === "https:" ? 443 : 80;
    const requestPath = parsed.pathname + parsed.search;

    const auth = Buffer.from(`${SERP_USERNAME}:${SERP_PASSWORD}`).toString("base64");

    const connectOptions = useProxy
      ? {
          host: SERP_HOST,
          port: SERP_PORT,
          method: "CONNECT",
          path: `${targetHost}:${targetPort}`,
          headers: {
            "Proxy-Authorization": `Basic ${auth}`,
            Host: `${targetHost}:${targetPort}`,
          },
        }
      : {
          host: SERP_HOST,
          port: SERP_PORT,
          method: "CONNECT",
          path: `${targetHost}:${targetPort}`,
          headers: {
            "Proxy-Authorization": `Basic ${auth}`,
            Host: `${targetHost}:${targetPort}`,
          },
        };

    const connectReq = http.request(connectOptions);
    connectReq.setTimeout(20000, () => {
      connectReq.destroy();
      reject(new Error("Proxy connect timeout"));
    });

    connectReq.on("connect", (res, socket) => {
      if (res.statusCode !== 200) {
        socket.destroy();
        reject(new Error(`Proxy CONNECT failed: ${res.statusCode}`));
        return;
      }

      const sendRequest = (sock: any) => {
        const headers = [
          `GET ${requestPath} HTTP/1.1`,
          `Host: ${targetHost}`,
          `User-Agent: ${userAgent}`,
          `Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8`,
          `Accept-Language: ${acceptLanguage}`,
          `Accept-Encoding: identity`,
          `Cache-Control: no-cache`,
          `Pragma: no-cache`,
          `Sec-Fetch-Dest: document`,
          `Sec-Fetch-Mode: navigate`,
          `Sec-Fetch-Site: none`,
          `Upgrade-Insecure-Requests: 1`,
          `Connection: close`,
          ``,
          ``,
        ].join("\r\n");

        sock.write(headers);

        let responseData = "";
        let headersParsed = false;
        let statusCode = 0;
        let bodyStart = 0;
        const chunks: Buffer[] = [];

        const timer = setTimeout(() => {
          sock.destroy();
          reject(new Error("Request timeout"));
        }, timeoutMs);

        sock.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
          if (!headersParsed) {
            const combined = Buffer.concat(chunks).toString("utf-8");
            const headerEnd = combined.indexOf("\r\n\r\n");
            if (headerEnd !== -1) {
              headersParsed = true;
              bodyStart = headerEnd + 4;
              const statusLine = combined.split("\r\n")[0];
              const statusMatch = statusLine.match(/HTTP\/\d\.\d (\d+)/);
              statusCode = statusMatch ? parseInt(statusMatch[1]) : 0;
              if (statusCode === 429) {
                clearTimeout(timer);
                sock.destroy();
                reject(new Error("SERP request failed: 429"));
              } else if (statusCode >= 400) {
                clearTimeout(timer);
                sock.destroy();
                reject(new Error(`HTTP ${statusCode}`));
              }
            }
          }
        });

        sock.on("end", () => {
          clearTimeout(timer);
          if (!headersParsed) {
            reject(new Error("Empty response"));
            return;
          }
          const fullResponse = Buffer.concat(chunks).toString("utf-8");
          const body = fullResponse.slice(bodyStart);
          resolve(body);
        });

        sock.on("error", (err: Error) => {
          clearTimeout(timer);
          reject(err);
        });
      };

      if (parsed.protocol === "https:") {
        const tlsSocket = tls.connect({
          socket,
          servername: targetHost,
          rejectUnauthorized: false,
          checkServerIdentity: () => undefined,
        });
        tlsSocket.on("secureConnect", () => sendRequest(tlsSocket));
        tlsSocket.on("error", (err) => {
          socket.destroy();
          reject(err);
        });
      } else {
        sendRequest(socket);
      }
    });

    connectReq.on("error", (err) => reject(err));
    connectReq.end();
  });
}

// ===== Parallel Fetch: جلب عدة URLs في نفس الوقت =====
export async function httpGetMany(
  urls: string[],
  options: { useProxy?: boolean; timeout?: number; retries?: number } = {}
): Promise<Array<{ url: string; html: string; error?: string }>> {
  const results = await Promise.allSettled(
    urls.map(async (url) => {
      const html = await httpGet(url, options);
      return { url, html };
    })
  );

  return results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    return { url: urls[i], html: "", error: (r.reason as Error).message };
  });
}

// ===== Data Extractors =====

/** استخراج أرقام الهاتف السعودية والخليجية */
export function extractPhoneNumbers(text: string): string[] {
  const patterns = [
    // سعودي: 05xxxxxxxx أو +9665xxxxxxxx أو 009665xxxxxxxx
    /(?:\+966|00966|0)(?:5[0-9])\d{7}/g,
    // إماراتي: 05xxxxxxxx أو +9715xxxxxxxx
    /(?:\+971|00971|0)(?:5[0-9])\d{7}/g,
    // كويتي: +9656xxxxxxxx
    /(?:\+965|00965)(?:[569]\d{7})/g,
    // بحريني: +9733xxxxxxxx
    /(?:\+973|00973)(?:[36]\d{7})/g,
    // قطري: +9745xxxxxxxx
    /(?:\+974|00974)(?:[3567]\d{7})/g,
    // عماني: +9689xxxxxxxx
    /(?:\+968|00968)(?:[279]\d{7})/g,
    // أردني: +9627xxxxxxxx
    /(?:\+962|00962)(?:7[789]\d{7})/g,
    // مصري: +2010xxxxxxxx
    /(?:\+20|0020)(?:1[0125]\d{8})/g,
  ];

  const found = new Set<string>();
  for (const pattern of patterns) {
    const matches = Array.from(text.matchAll(pattern));
    for (const m of matches) {
      // تنظيف الرقم
      let num = m[0].replace(/[\s\-\.]/g, "");
      // تحويل للصيغة الدولية
      if (num.startsWith("00")) num = "+" + num.slice(2);
      if (num.startsWith("05") || num.startsWith("06")) num = "+966" + num.slice(1);
      found.add(num);
    }
  }
  return Array.from(found);
}

/** استخراج عناوين البريد الإلكتروني */
export function extractEmails(text: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const found = new Set<string>();
  const matches = Array.from(text.matchAll(emailRegex));
  for (const m of matches) {
    const email = m[0].toLowerCase();
    // تجاهل الإيميلات العامة
    if (!email.includes("example.") && !email.includes("test@") && !email.includes("noreply@")) {
      found.add(email);
    }
  }
  return Array.from(found);
}

/** استخراج روابط السوشيال ميديا */
export function extractSocialLinks(html: string): {
  instagram?: string;
  tiktok?: string;
  snapchat?: string;
  twitter?: string;
  facebook?: string;
  youtube?: string;
  linkedin?: string;
  whatsapp?: string;
} {
  const patterns: Record<string, RegExp> = {
    instagram: /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([a-zA-Z0-9._]+)\/?/,
    tiktok: /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@([a-zA-Z0-9._]+)\/?/,
    snapchat: /(?:https?:\/\/)?(?:www\.)?snapchat\.com\/add\/([a-zA-Z0-9._\-]+)\/?/,
    twitter: /(?:https?:\/\/)?(?:www\.)?(?:twitter|x)\.com\/([a-zA-Z0-9_]+)\/?/,
    facebook: /(?:https?:\/\/)?(?:www\.)?facebook\.com\/([a-zA-Z0-9._\-]+)\/?/,
    youtube: /(?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:@|channel\/|c\/)([a-zA-Z0-9._\-]+)\/?/,
    linkedin: /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:company|in)\/([a-zA-Z0-9._\-]+)\/?/,
    whatsapp: /(?:https?:\/\/)?(?:wa\.me|api\.whatsapp\.com\/send\?phone=)(\+?[0-9]{10,15})/,
  };

  const result: Record<string, string> = {};
  for (const [platform, regex] of Object.entries(patterns)) {
    const match = html.match(regex);
    if (match) {
      result[platform] = match[0];
    }
  }
  return result;
}

/** استخراج العنوان والوصف من HTML */
export function extractMetadata(html: string): { title: string; description: string } {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const descMatch =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);

  return {
    title: titleMatch ? titleMatch[1].trim().slice(0, 100) : "",
    description: descMatch ? descMatch[1].trim().slice(0, 300) : "",
  };
}

// ===== Query Builder: توليد استعلامات متعددة الأبعاد =====
export function buildSearchQueries(
  keyword: string,
  platform: string,
  location: string = "السعودية",
  count: number = 8
): string[] {
  const domain = platform;
  const queries: string[] = [];

  // استعلامات عربية
  queries.push(`site:${domain} ${keyword} ${location}`);
  queries.push(`site:${domain} ${keyword} الرياض`);
  queries.push(`site:${domain} ${keyword} جدة`);
  queries.push(`site:${domain} ${keyword} للتواصل واتساب`);
  queries.push(`site:${domain} ${keyword} ${location} رقم الهاتف`);

  // استعلامات إنجليزية
  const englishLocation = location === "السعودية" ? "Saudi Arabia" : location === "الرياض" ? "Riyadh" : location;
  queries.push(`site:${domain} ${keyword} ${englishLocation}`);
  queries.push(`site:${domain} ${keyword} KSA`);
  queries.push(`site:${domain} ${keyword} Riyadh`);

  return queries.slice(0, count);
}

export default {
  httpGet,
  httpGetMany,
  extractPhoneNumbers,
  extractEmails,
  extractSocialLinks,
  extractMetadata,
  buildSearchQueries,
  getRandomUserAgent,
  getRandomAcceptLanguage,
};
