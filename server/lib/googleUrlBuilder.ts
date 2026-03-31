/**
 * Google URL Builder - مركزي لجميع المنصات
 * ==========================================
 * PHASE 1: توحيد بناء Google Search URLs في مكان واحد
 * بدلاً من تكرار نفس المنطق في كل router.
 *
 * المشكلة التي يحلها:
 *   - كل router يبني URL بطريقة مختلفة (بعضها يضيف cr=countrySA، بعضها لا)
 *   - cr=countrySA يُسبب 407 من SERP proxy → يجب حذفه
 *   - hl=ar&gl=sa هي المعلمات الصحيحة للسوق السعودي
 *
 * الاستخدام:
 *   import { buildGoogleSearchUrl, buildSiteSearchUrl } from "../lib/googleUrlBuilder";
 *
 *   // بحث عام
 *   const url = buildGoogleSearchUrl("مطاعم الرياض");
 *
 *   // بحث مقيد بموقع
 *   const url = buildSiteSearchUrl("instagram.com", "مطعم البركة", "الرياض");
 */

// ─── الإعدادات الافتراضية ─────────────────────────────────────────────────────

/** معلمات Google الافتراضية للسوق السعودي */
const DEFAULT_GOOGLE_PARAMS = {
  hl: "ar",   // اللغة: عربي
  gl: "sa",   // الدولة: السعودية
  num: "20",  // عدد النتائج
  // ملاحظة: cr=countrySA يُسبب 407 من SERP proxy → لا نستخدمه
};

/** قاعدة Google Search */
const GOOGLE_SEARCH_BASE = "https://www.google.com/search";

// ─── ترجمة الكلمات العربية الشائعة ───────────────────────────────────────────

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

export function translateToEnglish(text: string): string {
  let result = text;
  for (const [ar, en] of Object.entries(AR_TO_EN)) {
    result = result.replace(new RegExp(ar, "g"), en);
  }
  return result.trim();
}

// ─── الأنواع ───────────────────────────────────────────────────────────────────────────────────────

/** خيارات بناء Google Search URL */
export interface GoogleSearchUrlOptions {
  /** الاستعلام النصي */
  query: string;
  /** عدد النتائج (افتراضي: 20) */
  num?: number;
  /** اللغة (افتراضي: ar) */
  hl?: string;
  /** الدولة (افتراضي: sa) */
  gl?: string;
  /** رقم الصفحة — يُحوَّل إلى start (افتراضي: 1) */
  page?: number;
}

// ─── بناء Google Search URL ───────────────────────────────────────────────────────────────────────────────────────
/**
 * بناء Google Search URL مع المعلمات الافتراضية للسوق السعودي
 * @param options - خيارات إضافية
 * @returns URL كامل جاهز للإرسال إلى SERP API
 *
 * @example
 * buildGoogleSearchUrl("مطاعم الرياض")
 * // → "https://www.google.com/search?q=...&num=20&hl=ar&gl=sa"
 */
/**
 * بناء Google Search URL موحد للسوق السعودي.
 *
 * يقبل شكلين:
 *   buildGoogleSearchUrl({ query: "..." })           ← موصى به (PHASE 1)
 *   buildGoogleSearchUrl("...", { num: 10 })          ← متوافق مع الكود القديم
 *
 * ملاحظة: لا نضيف cr=countrySA — يُسبب 407 من Bright Data SERP proxy.
 */
export function buildGoogleSearchUrl(
  queryOrOptions: string | GoogleSearchUrlOptions,
  legacyOptions: {
    num?: number;
    hl?: string;
    gl?: string;
    tbm?: string;
  } = {}
): string {
  // دعم الشكلين: options object أو string
  let query: string;
  let num: number;
  let hl: string;
  let gl: string;
  let page: number;

  if (typeof queryOrOptions === "string") {
    // الشكل القديم: buildGoogleSearchUrl("query", { num: 10 })
    query = queryOrOptions;
    num = legacyOptions.num ?? parseInt(DEFAULT_GOOGLE_PARAMS.num);
    hl = legacyOptions.hl ?? DEFAULT_GOOGLE_PARAMS.hl;
    gl = legacyOptions.gl ?? DEFAULT_GOOGLE_PARAMS.gl;
    page = 1;
  } else {
    // الشكل الجديد: buildGoogleSearchUrl({ query: "...", num: 10 })
    query = queryOrOptions.query;
    num = queryOrOptions.num ?? parseInt(DEFAULT_GOOGLE_PARAMS.num);
    hl = queryOrOptions.hl ?? DEFAULT_GOOGLE_PARAMS.hl;
    gl = queryOrOptions.gl ?? DEFAULT_GOOGLE_PARAMS.gl;
    page = queryOrOptions.page ?? 1;
  }

  const params = new URLSearchParams({
    q: query,
    num: String(num),
    hl,
    gl,
  });

  if (page > 1) {
    params.set("start", String((page - 1) * num));
  }

  return `${GOOGLE_SEARCH_BASE}?${params.toString()}`;
}

/**
 * بناء Google Site Search URL لمنصة محددة
 *
 * @param site - النطاق المستهدف (مثل "instagram.com")
 * @param query - كلمة البحث
 * @param location - المدينة (اختياري)
 * @param options - خيارات إضافية
 *
 * @example
 * buildSiteSearchUrl("instagram.com", "مطعم البركة", "الرياض")
 * // → "https://www.google.com/search?q=site:instagram.com+"مطعم البركة الرياض"&..."
 */
export function buildSiteSearchUrl(
  site: string,
  query: string,
  location?: string,
  options: { num?: number; quoted?: boolean } = {}
): string {
  const loc = location || "";
  const locStr = loc ? ` ${loc}` : " السعودية";
  const q = options.quoted
    ? `site:${site} "${query}${locStr}"`
    : `site:${site} ${query}${locStr}`;

  return buildGoogleSearchUrl(q, { num: options.num });
}

// ─── توليد استعلامات متعددة لمنصة ────────────────────────────────────────────

/**
 * توليد استعلامات متعددة لمنصة محددة
 * يُستخدم في multiQuerySearch لتغطية أكبر
 *
 * @param site - النطاق (مثل "instagram.com")
 * @param query - كلمة البحث
 * @param location - المدينة
 * @returns قائمة URLs جاهزة للإرسال إلى SERP API
 */
export function buildSiteSearchVariants(
  site: string,
  query: string,
  location?: string
): string[] {
  const loc = location || "";
  const combinedAr = loc ? `"${query} ${loc}"` : `"${query} السعودية"`;
  const combinedArLoose = loc ? `${query} ${loc}` : `${query} السعودية`;
  const locEn = loc ? `${translateToEnglish(loc)} Saudi Arabia` : "Saudi Arabia";
  const queryEn = translateToEnglish(query);
  const combinedEn = loc ? `"${queryEn} ${translateToEnglish(loc)}"` : `"${queryEn} Saudi Arabia"`;
  const combinedEnLoose = loc ? `${queryEn} ${translateToEnglish(loc)} saudi` : `${queryEn} Saudi Arabia`;
  const platformName = site.replace(".com", "").replace(".net", "");

  const queries = [
    `site:${site} ${combinedAr}`,
    `site:${site} ${combinedArLoose}`,
    `site:${site} ${combinedEn}`,
    `site:${site} ${combinedEnLoose}`,
    `${platformName} ${combinedArLoose}`,
    `${platformName} ${combinedEnLoose}`,
    `${combinedArLoose} ${platformName}`,
    `${combinedEnLoose} ${platformName} account`,
  ];

  return queries.map(q => buildGoogleSearchUrl(q));
}

// ─── استخراج username من URL ──────────────────────────────────────────────────

/**
 * استخراج username من URL المنصة
 *
 * @example
 * extractUsernameFromUrl("https://www.instagram.com/albaraka_ksa/")
 * // → "albaraka_ksa"
 */
export function extractUsernameFromUrl(url: string): string | null {
  if (!url) return null;

  try {
    const u = new URL(url);
    const hostname = u.hostname.replace(/^www\./, "");
    const pathParts = u.pathname.split("/").filter(Boolean);

    if (hostname.includes("instagram.com")) {
      return pathParts[0] || null;
    }
    if (hostname.includes("tiktok.com")) {
      const part = pathParts.find(p => p.startsWith("@"));
      return part ? part.slice(1) : (pathParts[0] || null);
    }
    if (hostname.includes("snapchat.com")) {
      // snapchat.com/add/username
      const addIdx = pathParts.indexOf("add");
      return addIdx >= 0 ? (pathParts[addIdx + 1] || null) : (pathParts[0] || null);
    }
    if (hostname.includes("linkedin.com")) {
      const companyIdx = pathParts.indexOf("company");
      const inIdx = pathParts.indexOf("in");
      if (companyIdx >= 0) return pathParts[companyIdx + 1] || null;
      if (inIdx >= 0) return pathParts[inIdx + 1] || null;
      return pathParts[0] || null;
    }
    if (hostname.includes("twitter.com") || hostname.includes("x.com")) {
      return pathParts[0] || null;
    }
    if (hostname.includes("facebook.com")) {
      const pagesIdx = pathParts.indexOf("pages");
      return pagesIdx >= 0 ? (pathParts[pagesIdx + 1] || null) : (pathParts[0] || null);
    }
  } catch {
    // URL غير صالح
  }

  return null;
}

// ─── بناء Profile URL من username ────────────────────────────────────────────

/**
 * بناء Profile URL من username ونوع المنصة
 *
 * @example
 * buildProfileUrl("instagram", "albaraka_ksa")
 * // → "https://www.instagram.com/albaraka_ksa/"
 */
export function buildProfileUrl(platform: string, username: string): string {
  const cleanUsername = username.replace(/^@/, "");

  switch (platform.toLowerCase()) {
    case "instagram":
      return `https://www.instagram.com/${cleanUsername}/`;
    case "tiktok":
      return `https://www.tiktok.com/@${cleanUsername}`;
    case "snapchat":
      return `https://www.snapchat.com/add/${cleanUsername}`;
    case "linkedin":
      return `https://www.linkedin.com/company/${cleanUsername}`;
    case "twitter":
    case "x":
      return `https://x.com/${cleanUsername}`;
    case "facebook":
      return `https://www.facebook.com/${cleanUsername}`;
    default:
      return `https://${platform}.com/${cleanUsername}`;
  }
}
