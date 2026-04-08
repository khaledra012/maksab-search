/**
 * Bright Data SERP REST API - البحث في محركات البحث
 * الطريقة الصحيحة: REST API عبر https://api.brightdata.com/request
 * وليس HTTP/HTTPS Proxy
 *
 * PHASE 1 CHANGES:
 *  - Added import for buildGoogleSearchUrl (centralized URL builder)
 *  - Added parseGoogleResultsGeneric() — domain-free parser (fixes empty-string domainFilter bug)
 *  - Removed cr=countrySA from searchLinkedInSERP (causes 407 from SERP proxy)
 *  - Replaced inline URL strings in multiQuerySearch, searchSnapchatSERP,
 *    searchFacebookSERP, searchTwitterSERP with buildGoogleSearchUrl()
 */
import https from "https";
import { buildGoogleSearchUrl } from "../lib/googleUrlBuilder";

// ===== Bright Data SERP REST API =====
const SERP_API_KEY = process.env.BRIGHT_DATA_API_TOKEN || "";
const SERP_ZONE = process.env.BRIGHT_DATA_SERP_ZONE || "serp_api1";

// ===== Residential Proxy (للاستخدام المباشر مع المواقع غير Google) =====
const RESI_HOST = process.env.BRIGHT_DATA_RESIDENTIAL_HOST || "brd.superproxy.io";
const RESI_PORT = parseInt(process.env.BRIGHT_DATA_RESIDENTIAL_PORT || "33335");
const RESI_USERNAME = process.env.BRIGHT_DATA_RESIDENTIAL_USERNAME || "";
const RESI_PASSWORD = process.env.BRIGHT_DATA_RESIDENTIAL_PASSWORD || "";

// ===== فلتر جغرافي: مؤشرات المملكة العربية السعودية =====
const SAUDI_INDICATORS = [
  // عربي
  "السعودية", "سعودي", "سعودية", "الرياض", "جدة", "مكة", "المدينة", "الدمام",
  "الخبر", "الطائف", "تبوك", "أبها", "القصيم", "حائل", "نجران", "جازان",
  "ينبع", "خميس مشيط", "بريدة", "عرعر", "سكاكا", "الجبيل", "الأحساء",
  "المنطقة الشرقية", "الغربية", "الشمالية", "الجنوبية", "الوسطى",
  "ksa", "KSA", "saudi", "Saudi", "riyadh", "Riyadh", "jeddah", "Jeddah",
  "mecca", "Mecca", "medina", "Medina", "dammam", "Dammam",
  "المملكة", "المملكة العربية", "العربية السعودية",
  // رموز وأكواد
  "🇸🇦", "sa", "SA",
];

/**
 * يفحص إذا كان النص يحتوي على مؤشر سعودي
 * يُستخدم كفلتر ناعم (soft filter) - لا يرفض إلا إذا كان هناك مؤشر دولة أخرى
 */
function hasSaudiIndicator(text: string): boolean {
  const lower = text.toLowerCase();
  return SAUDI_INDICATORS.some(ind => lower.includes(ind.toLowerCase()));
}

/**
 * يفحص إذا كان النص يحتوي على مؤشر دولة أخرى (غير السعودية)
 * قائمة الدول العربية والخليجية المجاورة التي قد تظهر في نتائج البحث
 */
const NON_SAUDI_INDICATORS = [
  "الإمارات", "إمارات", "دبي", "أبوظبي", "الشارقة", "عجمان", "uae", "UAE", "dubai", "Dubai",
  "مصر", "القاهرة", "الإسكندرية", "egypt", "Egypt", "cairo", "Cairo",
  "الكويت", "kuwait", "Kuwait",
  "البحرين", "المنامة", "bahrain", "Bahrain",
  "قطر", "الدوحة", "qatar", "Qatar", "doha", "Doha",
  "عُمان", "مسقط", "oman", "Oman",
  "الأردن", "عمّان", "jordan", "Jordan",
  "لبنان", "بيروت", "lebanon", "Lebanon",
  "العراق", "بغداد", "iraq", "Iraq",
  "سوريا", "دمشق", "syria", "Syria",
  "المغرب", "الرباط", "morocco", "Morocco",
  "تونس", "tunisia", "Tunisia",
  "الجزائر", "algeria", "Algeria",
  "ليبيا", "طرابلس", "libya", "Libya",
  "السودان", "الخرطوم", "sudan", "Sudan",
  "اليمن", "صنعاء", "yemen", "Yemen",
  "تركيا", "إسطنبول", "turkey", "Turkey", "istanbul", "Istanbul",
  "باكستان", "pakistan", "Pakistan",
  "الهند", "india", "India",
];

function hasNonSaudiIndicator(text: string): boolean {
  const lower = text.toLowerCase();
  return NON_SAUDI_INDICATORS.some(ind => lower.includes(ind.toLowerCase()));
}

/**
 * أنماط في الـ username تدل على دولة أخرى
 * كثير من الحسابات الليبية والمصرية تحتوي على مؤشرات في الـ username
 */
const NON_SAUDI_USERNAME_PATTERNS = [
  // ليبيا
  /libya/i, /libyan/i, /tripoli/i, /benghazi/i, /misrata/i,
  // مصر
  /egypt/i, /egyptian/i, /cairo/i, /_eg_/i, /\.eg$/i,
  // الإمارات
  /dubai/i, /uae_/i, /_uae/i, /abudhabi/i, /sharjah/i,
  // الكويت
  /kuwait/i, /_kwt/i, /kwt_/i,
  // البحرين
  /bahrain/i, /manama/i,
  // قطر
  /qatar/i, /doha/i,
  // عُمان
  /muscat/i,
  // الأردن
  /jordan/i, /amman/i,
  // لبنان
  /lebanon/i, /beirut/i,
  // العراق
  /iraq/i, /baghdad/i,
  // المغرب
  /morocco/i, /maroc/i, /casablanca/i,
  // تونس
  /tunisia/i,
  // الجزائر
  /algeria/i, /algiers/i,
  // السودان
  /sudan/i, /khartoum/i,
  // اليمن
  /yemen/i, /sanaa/i,
];

function hasNonSaudiUsername(username: string): boolean {
  return NON_SAUDI_USERNAME_PATTERNS.some(p => p.test(username));
}

/**
 * خريطة المدن السعودية: الاسم العربي → مرادفاته وأسماؤه الإنجليزية
 * تُستخدم لفلترة النتائج بناءً على المدينة المحددة في مركز البحث
 */
const CITY_ALIASES: Record<string, string[]> = {
  "الرياض": ["الرياض", "riyadh", "riyad", "riadh"],
  "جدة": ["جدة", "jeddah", "jidda", "jedda"],
  "مكة المكرمة": ["مكة", "مكة المكرمة", "mecca", "makkah", "makka"],
  "المدينة المنورة": ["المدينة", "المدينة المنورة", "medina", "madinah"],
  "الدمام": ["الدمام", "dammam"],
  "الخبر": ["الخبر", "khobar", "al khobar", "alkhobar"],
  "الطائف": ["الطائف", "taif", "ta'if"],
  "تبوك": ["تبوك", "tabuk"],
  "أبها": ["أبها", "abha"],
  "القصيم": ["القصيم", "qassim", "buraydah", "بريدة"],
  "حائل": ["حائل", "hail", "ha'il"],
  "نجران": ["نجران", "najran"],
  "جازان": ["جازان", "jizan", "jazan"],
  "الجوف": ["الجوف", "jouf", "al jouf"],
  "عرعر": ["عرعر", "arar"],
  "الأحساء": ["الأحساء", "الاحساء", "ahsa", "al ahsa", "hofuf", "الهفوف"],
  "الجبيل": ["الجبيل", "jubail", "al jubail"],
  "ينبع": ["ينبع", "yanbu"],
  "خميس مشيط": ["خميس مشيط", "khamis mushait", "khamis"],
  "الباحة": ["الباحة", "baha", "al baha"],
};

/**
 * فلتر المدينة: يستبعد النتائج التي تذكر صراحةً مدينة مختلفة عن المدينة المحددة
 * لا يستبعد النتائج التي لا تذكر أي مدينة (لأن كثيراً من الحسابات لا تذكر موقعها)
 */
export function filterByCityContext<T extends { displayName: string; bio: string; username: string }>(results: T[], targetCity: string): T[] {
  if (!targetCity || targetCity === "الكل" || targetCity === "كل المدن") return results;

  // الأسماء المقبولة للمدينة المستهدفة
  const targetAliases = CITY_ALIASES[targetCity] || [targetCity.toLowerCase()];

  // جمع أسماء المدن الأخرى (لاستبعاد النتائج التي تذكرها)
  const otherCityNames: string[] = [];
  for (const [cityName, aliases] of Object.entries(CITY_ALIASES)) {
    if (cityName !== targetCity && !targetAliases.some(a => aliases.includes(a))) {
      otherCityNames.push(...aliases);
    }
  }

  return results.filter(r => {
    const text = `${r.displayName} ${r.bio} ${r.username}`.toLowerCase();
    // إذا ذكر النص مدينة أخرى صراحةً → استبعاد
    const mentionsOtherCity = otherCityNames.some(name => text.includes(name.toLowerCase()));
    if (mentionsOtherCity) {
      console.log(`[CityFilter] Excluded (other city): ${r.username}`);
      return false;
    }
    return true;
  });
}

/**
 * فلتر جغرافي مُعزَّز: يستبعد النتائج التي تحتوي على مؤشر دولة أخرى
 * يفحص النص الكامل (displayName + bio) والـ username بشكل منفصل
 */
function filterSaudiResults<T extends { displayName: string; bio: string; username: string }>(results: T[]): T[] {
  return results.filter(r => {
    const text = `${r.displayName} ${r.bio} ${r.username}`;
    // الطبقة 1: استبعاد إذا كان هناك مؤشر دولة أخرى صريح في النص
    if (hasNonSaudiIndicator(text)) {
      console.log(`[GeoFilter] Excluded by text: ${r.username} | bio: ${r.bio.slice(0, 50)}`);
      return false;
    }
    // الطبقة 2: استبعاد إذا كان الـ username يحتوي على مؤشر دولة أخرى
    if (hasNonSaudiUsername(r.username)) {
      console.log(`[GeoFilter] Excluded by username: ${r.username}`);
      return false;
    }
    return true;
  });
}

// ===== User-Agent Pool (30+ agents) =====
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.3; rv:123.0) Gecko/20100101 Firefox/123.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0",
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.105 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.105 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.6167.178 Mobile Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:123.0) Gecko/20100101 Firefox/123.0",
  "Mozilla/5.0 (Linux; Android 13; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36",
  "Mozilla/5.0 (iPad; CPU OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/122.0.6261.89 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/117.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 OPR/108.0.0.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (Linux; Android 12; TECNO KG7h) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.111 Mobile Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Linux; Android 14; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
];

const ACCEPT_LANGUAGES = [
  "ar-SA,ar;q=0.9,en;q=0.8",
  "ar,en-US;q=0.9,en;q=0.8",
  "ar-SA,ar;q=0.9,en-US;q=0.8,en;q=0.7",
  "en-US,en;q=0.9,ar;q=0.8",
  "ar-AE,ar;q=0.9,en;q=0.8",
];

let uaIndex = 0;
function nextUserAgent(): string {
  const ua = USER_AGENTS[uaIndex % USER_AGENTS.length];
  uaIndex = (uaIndex + 1) % USER_AGENTS.length;
  return ua;
}
function nextAcceptLanguage(): string {
  return ACCEPT_LANGUAGES[Math.floor(Math.random() * ACCEPT_LANGUAGES.length)];
}

// ===== Concurrency Manager: 6 طلبات متزامنة =====
const MAX_CONCURRENT = 6;
let activeRequests = 0;
const waitQueue: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  if (activeRequests < MAX_CONCURRENT) {
    activeRequests++;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    waitQueue.push(() => { activeRequests++; resolve(); });
  });
}

function releaseSlot(): void {
  activeRequests--;
  if (waitQueue.length > 0) {
    const next = waitQueue.shift()!;
    next();
  }
}

// ===== Smart Cache: لا يخزن النتائج الفارغة =====
const cache = new Map<string, { data: string; expiresAt: number; resultCount: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 دقيقة للنتائج الجيدة
const EMPTY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 دقائق فقط للنتائج الفارغة

function getCached(key: string): string | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: string, resultCount: number): void {
  const ttl = resultCount > 0 ? CACHE_TTL_MS : EMPTY_CACHE_TTL_MS;
  cache.set(key, { data, expiresAt: Date.now() + ttl, resultCount });
  // تنظيف cache القديم إذا تجاوز 500 مدخل
  if (cache.size > 500) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ===== Core SERP Request: Bright Data REST API =====
// الطريقة الصحيحة: POST إلى https://api.brightdata.com/request
// وليس HTTP/HTTPS proxy
async function serpRequestRaw(targetUrl: string): Promise<string> {
  if (!SERP_API_KEY) {
    throw new Error("BRIGHT_DATA_API_TOKEN not configured");
  }

  const body = JSON.stringify({
    zone: SERP_ZONE,
    url: targetUrl,
    format: "raw",
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.brightdata.com",
      port: 443,
      path: "/request",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERP_API_KEY}`,
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res: any) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        const responseBody = Buffer.concat(chunks).toString("utf-8");
        if (res.statusCode === 401 || res.statusCode === 403) {
          reject(new Error(`SERP API auth failed: ${res.statusCode} - check BRIGHT_DATA_API_TOKEN`));
          return;
        }
        if (res.statusCode === 429) {
          reject(new Error("SERP API rate limit: 429 Too Many Requests"));
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`SERP API error: ${res.statusCode} - ${responseBody.slice(0, 200)}`));
          return;
        }
        if (responseBody.length < 100) {
          reject(new Error("Empty response from SERP API"));
          return;
        }
        resolve(responseBody);
      });
    });

    req.setTimeout(90000, () => {
      req.destroy();
      reject(new Error("SERP API request timeout"));
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ===== serpRequest مع retry =====
export async function serpRequest(url: string, maxRetries = 3): Promise<string> {
  const cacheKey = url;
  const cached = getCached(cacheKey);
  if (cached) {
    console.log(`[SERP] Cache hit: ${url.slice(0, 80)}`);
    return cached;
  }

  await acquireSlot();
  try {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await serpRequestRaw(url);
        const resultCount = (result.match(/href="https?:\/\//g) || []).length;
        setCache(cacheKey, result, resultCount);
        console.log(`[SERP] ✅ Got ${resultCount} links from: ${url.slice(0, 80)}`);
        return result;
      } catch (err: any) {
        lastError = err;
        const isRetryable =
          err.message?.includes("timeout") ||
          err.message?.includes("429") ||
          err.message?.includes("ECONNRESET");

        if (attempt < maxRetries && isRetryable) {
          const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
          console.warn(`[SERP] Attempt ${attempt}/${maxRetries} failed (${err.message}), retry in ${Math.round(delay)}ms...`);
          await sleep(delay);
        } else if (!isRetryable) {
          throw err;
        }
      }
    }

    throw lastError || new Error("SERP request failed after retries");
  } finally {
    releaseSlot();
  }
}

// ===== Residential Proxy Request =====
// الآن يستخدم SERP REST API أيضاً (لأن الـ Residential يحجب Google)
export async function residentialRequest(url: string, maxRetries = 3): Promise<string> {
  // نستخدم SERP API كـ fallback لأنه يعمل مع جميع المواقع
  return serpRequest(url, maxRetries);
}

// ===== ترجمة الكلمات العربية الشائعة للإنجليزية =====
const AR_TO_EN: Record<string, string> = {
  "مطعم": "restaurant", "مطاعم": "restaurants",
  "كافيه": "cafe", "كافيهات": "cafes", "قهوة": "coffee",
  "صالون": "salon", "صالونات": "salons",
  "عيادة": "clinic", "عيادات": "clinics",
  "متجر": "store", "محل": "shop", "محلات": "shops",
  "فندق": "hotel", "فنادق": "hotels",
  "شركة": "company", "مؤسسة": "company",
  "جيم": "gym", "نادي": "club",
  "مدرسة": "school", "أكاديمية": "academy",
  "الرياض": "riyadh", "جدة": "jeddah", "مكة": "mecca",
  "الدمام": "dammam", "الخبر": "khobar", "المدينة": "medina",
  "السعودية": "saudi", "سعودي": "saudi",
};

function translateToEnglish(text: string): string {
  let result = text;
  for (const [ar, en] of Object.entries(AR_TO_EN)) {
    result = result.replace(new RegExp(ar, "g"), en);
  }
  return result.trim();
}

// ===== دالة مساعدة: توليد استعلامات متعددة =====
// ملاحظة مهمة: site:instagram.com + نص عربي = 0 نتائج في Google
// الحل: استخدام site: أولاً لأنه يعطي نتائج مباشرة من المنصة
function buildQueryVariants(query: string, location: string | undefined, site: string): string[] {
  const loc = location || "";
  // دمج المدينة مع الكلمة المفتاحية لتكون متكاملة في الاستعلام المُرسَل لـ Bright Data
  const combinedAr = loc ? `"${query} ${loc}"` : `"${query} السعودية"`;
  const combinedArLoose = loc ? `${query} ${loc}` : `${query} السعودية`;
  const locEn = loc ? `${translateToEnglish(loc)} Saudi Arabia` : "Saudi Arabia";
  const queryEn = translateToEnglish(query);
  const combinedEn = loc ? `"${queryEn} ${translateToEnglish(loc)}"` : `"${queryEn} Saudi Arabia"`;
  const combinedEnLoose = loc ? `${queryEn} ${translateToEnglish(loc)} saudi` : `${queryEn} Saudi Arabia`;
  const platformName = site.replace(".com", "").replace(".net", "");
  // الاستعلام المدمج: الكلمة + المدينة كوحدة واحدة تمنع Google من تجاهل الموقع الجغرافي
  return [
    // الأولوية القصوى: site: + كلمة + مدينة مدمجتان (عربي)
    `site:${site} ${combinedAr}`,
    `site:${site} ${combinedArLoose}`,
    // site: + كلمة + مدينة مدمجتان (إنجليزي)
    `site:${site} ${combinedEn}`,
    `site:${site} ${combinedEnLoose}`,
    // بدون site: كـ fallback - كلمة + مدينة مدمجتان
    `${platformName} ${combinedArLoose}`,
    `${platformName} ${combinedEnLoose}`,
    `${combinedArLoose} ${platformName}`,
    `${combinedEnLoose} ${platformName} account`,
  ];
}

// ===== بحث متعدد الاستعلامات مع دمج النتائج =====
async function multiQuerySearch(
  site: string,
  query: string,
  location: string | undefined,
  label: string,
  useResidential = false,
  limit = 20,
  page = 1
): Promise<Array<{ username: string; displayName: string; bio: string; url: string }>> {
  const variants = buildQueryVariants(query, location, site);
  const seen = new Set<string>();
  const allResults: Array<{ username: string; displayName: string; bio: string; url: string }> = [];

  const fetchHtml = async (q: string): Promise<string> => {
    // ملاحظة: cr=countrySA يسبب 407 من SERP proxy - تم حذفه
    const url = buildGoogleSearchUrl({ query: q, page });
    if (useResidential && RESI_USERNAME) {
      try {
        return await residentialRequest(url);
      } catch (err: any) {
        console.warn(`[${label}] Residential failed, fallback to SERP: ${err.message}`);
        return await serpRequest(url);
      }
    }
    return await serpRequest(url);
  };

  // تشغيل الاستعلامات بشكل تسلسلي مع delay بين كل طلب لتجنب socket hang up
  // الـ SERP proxy يفشل عند الطلبات المتزامنة
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  for (let i = 0; i < variants.length; i++) {
    const q = variants[i];
    try {
      if (i > 0) await sleep(800); // delay 800ms بين كل طلب
      const html = await fetchHtml(q);
      const parsed = parseGoogleResultsPublic(html, site);
      for (const r of parsed) {
        if (!seen.has(r.username)) {
          seen.add(r.username);
          allResults.push(r);
        }
      }
      if (allResults.length >= limit) break;
    } catch (err: any) {
      console.warn(`[${label}] query failed: ${q} - ${err.message}`);
    }
  }

  // فلتر جغرافي: استبعاد النتائج التي تحتوي على مؤشر دولة أخرى
  const filtered = filterSaudiResults(allResults);
  console.log(`[${label}] Total unique results: ${allResults.length}, after geo-filter: ${filtered.length}`);
  return filtered.slice(0, limit);
}

// ===== البحث في Google عن حسابات Instagram =====
export async function searchInstagramSERP(query: string, location?: string, limit = 20): Promise<Array<{
  username: string; displayName: string; bio: string; url: string;
}>> {
  return multiQuerySearch("instagram.com", query, location, "Instagram SERP", false, limit);
}

// ===== البحث في Google عن حسابات TikTok =====
export async function searchTikTokSERP(query: string, location?: string, limit = 20, page = 1): Promise<Array<{
  username: string; displayName: string; bio: string; url: string;
}>> {
  return multiQuerySearch("tiktok.com", query, location, "TikTok SERP", false, limit, page);
}

// ===== البحث في Google عن حسابات Snapchat =====
export async function searchSnapchatSERP(query: string, location?: string, limit = 20): Promise<Array<{
  username: string; displayName: string; bio: string; url: string;
}>> {
  const extractSnapchatHandlesFromText = (text: string): string[] => {
    const handles = new Set<string>();
    const patterns = [
      /(?:snapchat|سناب\s*شات|سناب|snap)[\s:：\-–—@]{0,4}([a-zA-Z0-9._-]{3,30})/gi,
      /(?:username|user|handle)[\s:：\-–—@]{0,4}([a-zA-Z0-9._-]{3,30})/gi,
    ];

    for (const pattern of patterns) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        const handle = (match[1] || "").trim().replace(/^@+/, "");
        if (!handle || handle.length < 3) continue;
        if (/^\d+$/.test(handle)) continue;
        handles.add(handle);
      }
    }

    return Array.from(handles);
  };

  const loc = location || "";
  const locAr = loc ? `${loc} السعودية` : "السعودية";
  const locEn = loc ? `${loc} Saudi Arabia` : "Saudi Arabia";
  const queryEn = translateToEnglish(query);
  const genericVariants = buildQueryVariants(query, location, "snapchat.com");
  const variants = Array.from(new Set([
    `site:snapchat.com/add "${query} ${locAr}"`,
    `site:snapchat.com/add ${query} ${locAr}`,
    `site:snapchat.com/add ${query} ${loc || "الرياض"}`,
    `site:snapchat.com/add "${queryEn} ${locEn}"`,
    `site:snapchat.com/add ${queryEn} ${locEn}`,
    `site:snapchat.com/add ${queryEn} ${loc || "riyadh"}`,
    `site:snapchat.com ${query} ${locAr}`,
    `site:snapchat.com ${queryEn} ${locEn}`,
    `snapchat ${query} ${locAr}`,
    `snapchat ${queryEn} ${locEn}`,
    `سناب ${query} ${locAr}`,
    `سناب شات ${query} ${locAr}`,
    `site:snapchat.com/add ${query}`,
    `site:snapchat.com/add ${queryEn}`,
    `site:snapchat.com ${query}`,
    `site:snapchat.com ${queryEn}`,
    ...genericVariants,
  ]));
  const seen = new Set<string>();
  const allResults: Array<{ username: string; displayName: string; bio: string; url: string }> = [];
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
  const targetCollectionLimit = Math.max(limit * 6, 60);

  for (let i = 0; i < variants.length; i++) {
    const q = variants[i];
    try {
      if (i > 0) await sleep(800);
      // بدون cr=countrySA لأنه يُسبب 407 من SERP proxy
      const url = buildGoogleSearchUrl({ query: q });
      const html = await serpRequest(url);
      // استخدام parseGoogleResultsPublic للاستخراج الصحيح
      const parsed = parseGoogleResultsPublic(html, "snapchat.com");
      for (const r of parsed) {
        if (r.username && !seen.has(r.username)) {
          seen.add(r.username);
          allResults.push(r);
        }
      }

      const genericParsed = parseGoogleResultsGeneric(html);
      for (const item of genericParsed) {
        const text = `${item.displayName || ""} ${item.bio || ""} ${item.url || ""}`;
        const handles = extractSnapchatHandlesFromText(text);
        for (const handle of handles) {
          const normalizedHandle = handle.toLowerCase();
          if (!normalizedHandle || seen.has(normalizedHandle)) continue;
          if (hasNonSaudiUsername(normalizedHandle)) continue;
          seen.add(normalizedHandle);
          allResults.push({
            username: handle,
            displayName: item.displayName || handle,
            bio: item.bio || "",
            url: `https://www.snapchat.com/add/${handle}`,
          });
        }
      }

      if (allResults.length >= targetCollectionLimit) break;
    } catch (err: any) {
      console.warn(`[Snapchat SERP] query failed: ${q} - ${err.message}`);
    }
  }

  const geoFiltered = filterSaudiResults(allResults);
  const cityFiltered = loc ? filterByCityContext(geoFiltered, loc) : geoFiltered;

  let finalResults = geoFiltered;
  if (loc) {
    if (cityFiltered.length >= limit) {
      finalResults = cityFiltered;
    } else if (cityFiltered.length > 0) {
      const seenUsernames = new Set(cityFiltered.map((item) => item.username));
      const geoFallback = geoFiltered.filter((item) => !seenUsernames.has(item.username));
      finalResults = [...cityFiltered, ...geoFallback];
    }
  }

  if (finalResults.length < limit) {
    const seenUsernames = new Set(finalResults.map((item) => item.username));
    const rawFallback = allResults.filter((item) => !seenUsernames.has(item.username));
    finalResults = [...finalResults, ...rawFallback];
  }

  console.log(`[Snapchat SERP] Total unique results: ${allResults.length}, after geo/city filter: ${finalResults.length}`);
  return finalResults.slice(0, limit);
}

// ===== البحث في Google عن حسابات LinkedIn =====
export async function searchLinkedInSERP(query: string, location?: string, limit = 20): Promise<Array<{
  username: string; displayName: string; bio: string; url: string;
}>> {
  const loc = location || "";
  const locAr = loc ? `${loc} السعودية` : "السعودية";
  const locEn = loc ? `${translateToEnglish(loc)} Saudi Arabia` : "Saudi Arabia";
  const queryEn = translateToEnglish(query);
  const variants = [
    `site:linkedin.com/company ${query} ${locAr}`,
    `site:linkedin.com/company ${queryEn} ${locEn}`,
    `site:linkedin.com/company ${queryEn} ${translateToEnglish(loc || "riyadh")}`,
    `site:linkedin.com/in ${query} ${locAr}`,
    `site:linkedin.com/in ${queryEn} ${locEn}`,
    `site:linkedin.com ${query} Saudi Arabia`,
    `site:linkedin.com ${queryEn} ${locEn}`,
    `linkedin company ${queryEn} ${locEn}`,
  ];
  const seen = new Set<string>();
  const allResults: Array<{ username: string; displayName: string; bio: string; url: string }> = [];

  const fetchBatch = variants.map(async (q) => {
    try {
      // PHASE 1 FIX: removed cr=countrySA — causes 407 from Bright Data SERP proxy
      const url = buildGoogleSearchUrl({ query: q });
      const html = await serpRequest(url);
      return parseGoogleResultsPublic(html, "linkedin.com");
    } catch (err: any) {
      console.warn(`[LinkedIn SERP] failed: ${q} - ${err.message}`);
      return [];
    }
  });

  const results = await Promise.all(fetchBatch);
  for (const batch of results) {
    for (const r of batch) {
      if (!seen.has(r.username)) { seen.add(r.username); allResults.push(r); }
    }
  }
  return allResults.slice(0, limit);
}

// ===== البحث في Google عن صفحات Facebook =====
export async function searchFacebookSERP(query: string, location?: string, limit = 20): Promise<Array<{
  username: string; displayName: string; bio: string; url: string;
}>> {
  const loc = location || "";
  const locAr = loc ? `${loc} السعودية` : "السعودية";
  const locEn = loc ? `${loc} Saudi Arabia` : "Saudi Arabia";
  const queryEn = translateToEnglish(query);
  const variants = [
    `site:facebook.com ${query} ${locAr}`,
    `site:facebook.com ${query} ${loc || "الرياض"}`,
    `site:facebook.com/pages ${query} ${locAr}`,
    `site:facebook.com ${queryEn} ${locEn}`,
    `facebook ${query} ${locAr} صفحة`,
    `facebook.com ${query} ${locAr}`,
  ];
  const seen = new Set<string>();
  const allResults: Array<{ username: string; displayName: string; bio: string; url: string }> = [];
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  for (let i = 0; i < variants.length; i++) {
    const q = variants[i];
    try {
      if (i > 0) await sleep(800);
      const url = buildGoogleSearchUrl({ query: q });
      const html = await serpRequest(url);
      const parsed = parseGoogleResultsPublic(html, "facebook.com");
      for (const r of parsed) {
        if (!seen.has(r.username)) { seen.add(r.username); allResults.push(r); }
      }
      if (allResults.length >= limit) break;
    } catch (err: any) {
      console.warn(`[Facebook SERP] query failed: ${q} - ${err.message}`);
    }
  }

  console.log(`[Facebook SERP] Total unique results: ${allResults.length}`);
  return allResults.slice(0, limit);
}

// ===== البحث في Google عن حسابات Twitter/X =====
export async function searchTwitterSERP(query: string, location?: string, limit = 20): Promise<Array<{
  username: string; displayName: string; bio: string; url: string;
}>> {
  const loc = location || "";
  const locAr = loc ? `${loc} السعودية` : "السعودية";
  const locEn = loc ? `${loc} Saudi Arabia` : "Saudi Arabia";
  const queryEn = translateToEnglish(query);
  // تويتر/X: نستخدم x.com لأن Google تفهرسه أفضل من twitter.com
  const variants = [
    `site:x.com ${query} ${locAr}`,
    `site:x.com ${query} ${loc || "الرياض"}`,
    `site:x.com ${queryEn} ${locEn}`,
    `site:twitter.com ${query} ${locAr}`,
    `x.com ${query} ${locAr} حساب`,
    `twitter ${query} ${locAr} حساب`,
  ];
  const seen = new Set<string>();
  const allResults: Array<{ username: string; displayName: string; bio: string; url: string }> = [];
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  for (let i = 0; i < variants.length; i++) {
    const q = variants[i];
    try {
      if (i > 0) await sleep(800);
      const url = buildGoogleSearchUrl({ query: q });
      const html = await serpRequest(url);
      // نحاول كلا النمطين: twitter.com و x.com
      const parsedX = parseGoogleResultsPublic(html, "x.com");
      const parsedT = parseGoogleResultsPublic(html, "twitter.com");
      for (const r of [...parsedX, ...parsedT]) {
        if (!seen.has(r.username)) { seen.add(r.username); allResults.push(r); }
      }
      if (allResults.length >= limit) break;
    } catch (err: any) {
      console.warn(`[Twitter SERP] query failed: ${q} - ${err.message}`);
    }
  }

  console.log(`[Twitter SERP] Total unique results: ${allResults.length}`);
  return allResults.slice(0, limit);
}

// ===== تحليل نتائج Google HTML =====
// Google الحديث يُشفّر الروابط في JSON مضمّن أو يضعها في نصوص - نستخدم regex عام

/**
 * parseGoogleResultsGeneric — PHASE 1 FIX
 * ==========================================
 * Parser مستقل لنتائج Google العامة (بدون domain filter).
 *
 * المشكلة التي يحلها:
 *   parseGoogleResultsPublic(html, "") كانت تُرجع [] دائماً لأن
 *   الـ else branch يُرجع [] عند domainFilter فارغ.
 *
 * هذا الـ parser يستخرج:
 *   - displayName (من h3)
 *   - bio (من وصف النتيجة)
 *   - url (الرابط المباشر)
 *   - candidatePhones[] — أرقام مستخرجة من النص (ليست verified)
 *
 * تحذير: الأرقام هنا candidatePhones لأنها مستخرجة من نص الصفحة
 * وليس من حقل هاتف مباشر — لا تُعامَل كـ verifiedPhones.
 */
export function parseGoogleResultsGeneric(html: string): Array<{
  displayName: string;
  bio: string;
  url: string;
  candidatePhones: string[];
}> {
  const results: Array<{ displayName: string; bio: string; url: string; candidatePhones: string[] }> = [];
  const seen = new Set<string>();

  // نمط استخراج الروابط من Google HTML
  // يدعم: href="/url?q=https://..." و href="https://..."
  const linkRegex = /href="(?:\/url\?q=)?(https?:\/\/[^"&\s]{10,200})(?:"|&)/g;

  // نطاقات مستبعدة (مواقع عامة غير تجارية)
  const EXCLUDED_DOMAINS = [
    "google.com", "google.sa", "youtube.com", "wikipedia.org", "wikimedia.org",
    "gstatic.com", "googleapis.com", "googletagmanager.com",
    "w3.org", "schema.org", "cloudflare.com", "amazonaws.com",
    "accounts.google", "maps.google", "play.google",
    "webcache.googleusercontent.com",
  ];

  // نمط أرقام الهاتف السعودية
  const PHONE_REGEX = /(?:\+966|00966|0)(?:5[0-9]{8}|[1-9][0-9]{7})/g;

  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const rawUrl = match[1];
    let url: string;
    try {
      url = decodeURIComponent(rawUrl.split("&")[0]);
    } catch {
      url = rawUrl.split("&")[0];
    }

    const lowerUrl = url.toLowerCase();
    if (EXCLUDED_DOMAINS.some(d => lowerUrl.includes(d))) continue;
    if (lowerUrl.startsWith("https://www.google.com/") || lowerUrl.startsWith("https://google.com/")) continue;
    if (url.length < 15 || url.length > 200) continue;
    if (seen.has(url)) continue;
    seen.add(url);

    // استخراج السياق المحيط بالرابط
    const pos = match.index;
    const contextStart = Math.max(0, pos - 600);
    const contextEnd = Math.min(html.length, pos + 600);
    const context = html.slice(contextStart, contextEnd);

    // استخراج العنوان من h3
    let displayName = "";
    const h3Match = context.match(/<h3[^>]*>([\s\S]*?)<\/h3>/);
    if (h3Match) {
      displayName = h3Match[1].replace(/<[^>]+>/g, "").trim().slice(0, 120);
    }
    if (!displayName) continue; // نتجاهل النتائج بدون عنوان

    // استخراج الوصف
    let bio = "";
    const descPatterns = [
      /class="[^"]*VwiC3b[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div)>/,
      /class="[^"]*s3v9rd[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div)>/,
      /class="[^"]*lEBKkf[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div)>/,
      /class="[^"]*yDYNvb[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div)>/,
      /class="[^"]*IsZvec[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div)>/,
      /class="[^"]*fzUZNc[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div)>/,
      /class="[^"]*lyLwlc[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div)>/,
    ];
    for (const pattern of descPatterns) {
      const descMatch = context.match(pattern);
      if (descMatch) {
        bio = descMatch[1].replace(/<[^>]+>/g, "").trim().slice(0, 300);
        if (bio && bio.length > 10) break;
      }
    }

    // استخراج أرقام الهاتف كـ candidatePhones (ليست verified)
    const textForPhones = `${displayName} ${bio}`;
    const rawPhones = Array.from(new Set(textForPhones.match(PHONE_REGEX) || []));
    const candidatePhones = rawPhones.map(p => {
      const digits = p.replace(/\D/g, "");
      if (digits.startsWith("966")) return digits;
      if (digits.startsWith("0") && digits.length === 10) return "966" + digits.slice(1);
      if (digits.startsWith("5") && digits.length === 9) return "966" + digits;
      return digits;
    });

    results.push({ displayName, bio, url, candidatePhones });
    if (results.length >= 30) break;
  }

  return results;
}

export function parseGoogleResultsPublic(html: string, domainFilter: string): Array<{
  username: string; displayName: string; bio: string; url: string;
}> {
  const results: Array<{ username: string; displayName: string; bio: string; url: string }> = [];
  const seen = new Set<string>();

  const blacklist = new Set([
    "explore", "p", "reel", "reels", "stories", "accounts", "hashtag", "tv",
    "search", "login", "signup", "about", "help", "legal", "privacy", "terms",
    "intent", "share", "home", "notifications", "messages", "add", "web",
    "discover", "trending", "live", "map", "maps", "places", "directory",
    "business", "ads", "developers", "pages", "groups", "events", "marketplace",
    "watch", "gaming", "fundraisers", "jobs", "news", "photos", "videos",
    "friends", "memories", "saved", "settings", "profile", "people",
    "_n", "_u", "tagged", "saved", "highlights", "igtv",
  ]);

  // استخراج الـ usernames مباشرة من HTML بـ regex عام
  // هذا يعمل مع Google HTML الحديث الذي يُشفّر الروابط
  let usernameRegex: RegExp;
  let urlBuilder: (username: string) => string;

  // ملاحظة: Google HTML يستخدم &amp; بدلاً من & لذا يجب دعمها في الـ regex
  // النمط: instagram.com/username/ أو instagram.com/username&amp; أو instagram.com/username"
  if (domainFilter === "instagram.com") {
    usernameRegex = /instagram\.com\/([a-zA-Z0-9._]{3,30})(?:\/|\?|\\|"|\s|&|>|<|\n|\r|$)/g;
    urlBuilder = (u) => `https://www.instagram.com/${u}/`;
  } else if (domainFilter === "tiktok.com") {
    usernameRegex = /tiktok\.com\/@([a-zA-Z0-9._]{3,30})(?:\/|\?|\\|"|\s|&|>|<|\n|\r|$)/g;
    urlBuilder = (u) => `https://www.tiktok.com/@${u}`;
  } else if (domainFilter === "snapchat.com") {
    usernameRegex = /snapchat\.com\/(?:add\/)?([a-zA-Z0-9._-]{3,30})(?:\/|\?|\\|"|\s|&|>|<|\n|\r|$)/g;
    urlBuilder = (u) => `https://www.snapchat.com/add/${u}`;
  } else if (domainFilter === "linkedin.com") {
    usernameRegex = /linkedin\.com\/(?:company|in)\/([a-zA-Z0-9._-]{3,50})(?:\/|\?|\\|"|\s|&|>|<|\n|\r|$)/g;
    urlBuilder = (u) => `https://www.linkedin.com/company/${u}`;
  } else if (domainFilter === "twitter.com" || domainFilter === "x.com") {
    usernameRegex = /(?:twitter|x)\.com\/([a-zA-Z0-9_]{3,30})(?:\/|\?|\\|"|\s|&|>|<|\n|\r|$)/g;
    urlBuilder = (u) => `https://x.com/${u}`;
  } else if (domainFilter === "facebook.com") {
    usernameRegex = /facebook\.com\/(?:pages\/)?([a-zA-Z0-9._-]{3,50})(?:\/|\?|\\|"|\s|&|>|<|\n|\r|$)/g;
    urlBuilder = (u) => `https://www.facebook.com/${u}`;
  } else {
    return [];
  }

  let match;
  while ((match = usernameRegex.exec(html)) !== null) {
    const username = match[1];
    if (!username || username.length < 3) continue;
    if (blacklist.has(username.toLowerCase())) continue;
    if (seen.has(username)) continue;
    // تجاهل الأرقام فقط (ليست usernames)
    if (/^\d+$/.test(username)) continue;
    seen.add(username);

    const url = urlBuilder(username);

    // استخراج السياق المحيط
    const pos = match.index;
    const contextStart = Math.max(0, pos - 800);
    const contextEnd = Math.min(html.length, pos + 800);
    const context = html.slice(contextStart, contextEnd);

    // استخراج العنوان من h3
    let displayName = username;
    const h3Match = context.match(/<h3[^>]*>([\s\S]*?)<\/h3>/);
    if (h3Match) {
      const rawTitle = h3Match[1].replace(/<[^>]+>/g, "").trim();
      if (rawTitle && rawTitle.length > 2) {
        const atMatch = rawTitle.match(/^(.+?)\s*[@(]/);
        displayName = atMatch ? atMatch[1].trim() : rawTitle.slice(0, 80);
      }
    }

    // استخراج الوصف - أنماط متعددة لـ Google HTML الحديث
    let bio = "";
    const descPatterns = [
      /class="[^"]*VwiC3b[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div)>/,
      /class="[^"]*s3v9rd[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div)>/,
      /class="[^"]*lEBKkf[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div)>/,
      /class="[^"]*yDYNvb[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div)>/,
      /class="[^"]*IsZvec[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div)>/,
      /class="[^"]*st[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div)>/,
      /class="[^"]*fzUZNc[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div)>/,
      /class="[^"]*lyLwlc[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div)>/,
    ];
    for (const pattern of descPatterns) {
      const descMatch = context.match(pattern);
      if (descMatch) {
        bio = descMatch[1].replace(/<[^>]+>/g, "").trim().slice(0, 300);
        if (bio && bio.length > 10) break;
      }
    }

    results.push({ username, displayName, bio, url });
    if (results.length >= 60) break;
  }

  return results;
}
