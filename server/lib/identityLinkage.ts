/**
 * Identity Linkage Engine
 * =======================
 * خوارزمية الربط الذكي لدمج نتائج البحث من مصادر متعددة في كيان واحد موحد.
 *
 * المشكلة التي تحلها:
 *   "مطعم البركة" في فيسبوك  ===  "Al Baraka Restaurant" في Google Maps ؟
 *   @albaraka_riyadh في إنستغرام  ===  "البركة للمأكولات" في سناب شات ؟
 *
 * الحل: Weighted Fuzzy Matching بأوزان مدروسة لكل حقل:
 *   - اسم العمل (Fuse.js + string-similarity)  → وزن 35%
 *   - رقم الهاتف المؤكد (exact match)           → وزن 25%
 *   - الموقع الإلكتروني (domain match)          → وزن 20%
 *   - رابط البيو / الروابط الخارجية             → وزن 10%
 *   - المدينة والتصنيف                          → وزن 5%
 *   - الـ handle السوشيال                       → وزن 5%
 *
 * عتبة الدمج: totalScore >= 0.55 (قابلة للضبط)
 *
 * PHASE 1 CHANGES:
 *  - Updated WEIGHTS to match spec (35/25/20/10/5/5)
 *  - Changed phones → verifiedPhones / candidatePhones
 *  - Changed websites → verifiedWebsite / candidateWebsites
 *  - Updated LinkageScore.breakdown to use new field names
 *  - Added bioLinkScore and socialHandleScore
 *  - Updated BusinessLead output to use new field names
 */

import Fuse from "fuse.js";
import stringSimilarity from "string-similarity";
import type {
  DiscoveryCandidate,
  LinkageScore,
  ResolvedGroup,
  BusinessLead,
  SourceRecord,
} from "../../shared/types/lead-intelligence";
import { runGateOnGroup, isOperationAllowed } from "./identityIntegrityGate";

// ─── الأوزان (PHASE 1: محدثة لتتوافق مع المتطلبات) ───────────────────────────
const WEIGHTS = {
  name: 0.35,       // تشابه الاسم (35%)
  phone: 0.25,      // تطابق رقم الهاتف المؤكد (25%)
  website: 0.20,    // تطابق الموقع الإلكتروني (20%)
  bioLink: 0.10,    // تطابق رابط البيو / الروابط الخارجية (10%)
  cityCategory: 0.05, // المدينة والتصنيف (5%)
  socialHandle: 0.05, // الـ handle السوشيال (5%)
} as const;

/** عتبة الدمج: إذا كانت الدرجة الإجمالية >= هذه القيمة → دمج */
const MERGE_THRESHOLD = 0.70;

/** عتبة تطابق الاسم العالية (لا يكفي وحده للدمج إلا مع إشارات داعمة) */
const NAME_ONLY_THRESHOLD = 0.85;

// ─── تطبيع الاسم ──────────────────────────────────────────────────────────────

// ─── قوائم الكلمات المصنّفة ──────────────────────────────────────────────────

/** كلمات نوع النشاط — تُستخدم كـ disambiguators وليس تُحذف */
const BUSINESS_TYPE_WORDS: Record<string, string> = {
  // عربي
  "مطعم": "restaurant", "مطاعم": "restaurant",
  "مقهى": "cafe", "مقاهي": "cafe", "كافيه": "cafe", "كافيهات": "cafe",
  "محل": "shop", "محلات": "shop", "متجر": "shop", "متاجر": "shop",
  "شركة": "company", "مؤسسة": "company", "مجموعة": "group",
  "مركز": "center", "مراكز": "center",
  "حلويات": "sweets", "مخبز": "bakery", "مخابز": "bakery",
  "بوفيه": "buffet", "ملحمة": "butcher", "ملاحم": "butcher",
  "عيادة": "clinic", "عيادات": "clinic",
  "مستشفى": "hospital", "مستشفيات": "hospital",
  "صيدلية": "pharmacy",
  "خدمات": "services",
  // إنجليزي
  "restaurant": "restaurant", "restaurants": "restaurant",
  "cafe": "cafe", "cafes": "cafe", "coffee": "cafe",
  "shop": "shop", "store": "shop",
  "company": "company", "co": "company", "est": "company",
  "ltd": "company", "llc": "company",
  "group": "group", "center": "center", "centre": "center",
  "bakery": "bakery", "kitchen": "kitchen",
  "food": "food", "foods": "food",
  "grill": "grill", "grills": "grill",
  "clinic": "clinic", "hospital": "hospital", "pharmacy": "pharmacy",
};

/** كلمات المدن السعودية — تُستخدم كـ disambiguators وليس تُحذف */
const CITY_WORDS: Record<string, string> = {
  "الرياض": "riyadh", "رياض": "riyadh", "riyadh": "riyadh", "riyad": "riyadh",
  "جدة": "jeddah", "jeddah": "jeddah", "jidda": "jeddah",
  "مكة": "mecca", "مكه": "mecca", "مكة المكرمة": "mecca", "mecca": "mecca", "makkah": "mecca",
  "المدينة": "medina", "المدينة المنورة": "medina", "medina": "medina", "madinah": "medina",
  "الدمام": "dammam", "dammam": "dammam",
  "الخبر": "khobar", "khobar": "khobar",
  "الطائف": "taif", "taif": "taif",
  "تبوك": "tabuk", "tabuk": "tabuk",
  "أبها": "abha", "abha": "abha",
  "القصيم": "qassim", "بريدة": "qassim",
  "الأحساء": "ahsa", "الهفوف": "ahsa",
  "حائل": "hail", "hail": "hail",
  "نجران": "najran", "najran": "najran",
  "جازان": "jazan", "jazan": "jazan",
  "ينبع": "yanbu", "yanbu": "yanbu",
};

/** الكلمات الجغرافية العامة */
const GEO_WORDS: Record<string, string> = {
  "السعودية": "saudi", "السعودي": "saudi", "العربية": "saudi",
  "saudi": "saudi", "ksa": "saudi",
};

// ─── DisambiguationTokens ─────────────────────────────────────────────────────

export interface DisambiguationTokens {
  /** نوع النشاط المُعيَّر (restaurant, cafe, shop, ...) */
  businessType: string | null;
  /** المدينة المُعيَّرة (riyadh, jeddah, ...) */
  city: string | null;
  /** مؤشرات جغرافية أخرى */
  geoTerms: string[];
}

/**
 * استخراج رموز التمييز من اسم النشاط
 * هذه الرموز لا تُحذف من الاسم بل تُستخدم لمنع الدمج الخاطئ
 */
export function extractDisambiguationTokens(name: string): DisambiguationTokens {
  if (!name) return { businessType: null, city: null, geoTerms: [] };

  const lower = name.toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "") // إزالة التشكيل
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي");

  let businessType: string | null = null;
  let city: string | null = null;
  const geoTerms: string[] = [];

  // فحص نوع النشاط
  for (const [word, canonical] of Object.entries(BUSINESS_TYPE_WORDS)) {
    const wLower = word.toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");
    if (lower.includes(wLower)) {
      businessType = canonical;
      break;
    }
  }

  // فحص المدينة
  for (const [word, canonical] of Object.entries(CITY_WORDS)) {
    const wLower = word.toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");
    if (lower.includes(wLower)) {
      city = canonical;
      break;
    }
  }

  // فحص الكلمات الجغرافية العامة
  for (const [word, canonical] of Object.entries(GEO_WORDS)) {
    const wLower = word.toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");
    if (lower.includes(wLower) && !geoTerms.includes(canonical)) {
      geoTerms.push(canonical);
    }
  }

  return { businessType, city, geoTerms };
}

/**
 * تطبيع اسم العمل للمقارنة (canonicalName):
 * - إزالة التشكيل والهمزات
 * - توحيد الأحرف المتشابهة
 * - إزالة كلمات نوع النشاط والمدينة (تُحفظ في disambiguationTokens)
 * - تحويل إلى lowercase
 * - إزالة المسافات الزائدة والرموز
 *
 * ملاحظة: الكلمات المحذوفة هنا تُستخرج أولاً بـ extractDisambiguationTokens
 * ثم تُستخدم في منطق الدمج كـ disambiguators وليس تُهمل
 */
export function normalizeName(name: string): string {
  if (!name) return "";

  let n = name.toLowerCase().trim();

  // إزالة التشكيل العربي
  n = n.replace(/[\u064B-\u065F\u0670]/g, "");

  // توحيد الهمزات والألف
  n = n.replace(/[أإآ]/g, "ا");
  n = n.replace(/ة/g, "ه");
  n = n.replace(/ى/g, "ي");
  n = n.replace(/ؤ/g, "و");
  n = n.replace(/ئ/g, "ي");

  // إزالة كلمات نوع النشاط (بعد حفظها في disambiguationTokens)
  for (const word of Object.keys(BUSINESS_TYPE_WORDS)) {
    const wNorm = word.toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");
    n = n.split(wNorm).join(" ");
  }

  // إزالة كلمات المدن (بعد حفظها في disambiguationTokens)
  for (const word of Object.keys(CITY_WORDS)) {
    const wNorm = word.toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");
    n = n.split(wNorm).join(" ");
  }

  // إزالة الكلمات الجغرافية العامة
  for (const word of Object.keys(GEO_WORDS)) {
    const wNorm = word.toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");
    n = n.split(wNorm).join(" ");
  }

  // إزالة الرموز والأرقام والمسافات الزائدة
  n = n.replace(/[^\u0600-\u06FFa-z0-9\s]/g, " ");
  n = n.replace(/\s+/g, " ").trim();

  return n;
}

// ─── تطبيع رقم الهاتف ─────────────────────────────────────────────────────────

/**
 * تطبيع رقم الهاتف للمقارنة:
 * - إزالة كل شيء ما عدا الأرقام
 * - توحيد المقدمة السعودية (966 / 00966 / 0)
 * - إرجاع آخر 9 أرقام للمقارنة
 */
export function normalizePhone(phone: string): string {
  if (!phone) return "";

  // إزالة كل شيء ما عدا الأرقام
  let digits = phone.replace(/\D/g, "");

  // إزالة مقدمة الدولة
  if (digits.startsWith("00966")) digits = digits.slice(5);
  else if (digits.startsWith("966")) digits = digits.slice(3);
  else if (digits.startsWith("0")) digits = digits.slice(1);

  // آخر 9 أرقام للمقارنة
  return digits.slice(-9);
}

/**
 * مقارنة مجموعتين من أرقام الهاتف
 * يعيد 1 إذا تطابق أي رقمين، 0 إذا لم يتطابقا
 */
function comparePhones(phonesA: string[], phonesB: string[]): number {
  if (!phonesA.length || !phonesB.length) return 0;

  const normalizedA = phonesA.map(normalizePhone).filter(Boolean);
  const normalizedB = phonesB.map(normalizePhone).filter(Boolean);

  for (const a of normalizedA) {
    for (const b of normalizedB) {
      if (a && b && a === b) return 1;
    }
  }
  return 0;
}

// ─── تطبيع الموقع الإلكتروني ──────────────────────────────────────────────────

/**
 * استخراج النطاق الأساسي من URL
 * https://www.albaraka.com/menu → albaraka.com
 */
export function extractDomain(url: string): string {
  if (!url) return "";
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split("/")[0]
      .toLowerCase();
  }
}

/**
 * مقارنة موقعين إلكترونيين بالنطاق
 */
function compareWebsites(websitesA: string[], websitesB: string[]): number {
  if (!websitesA.length || !websitesB.length) return 0;

  const domainsA = websitesA.map(extractDomain).filter(Boolean);
  const domainsB = websitesB.map(extractDomain).filter(Boolean);

  for (const a of domainsA) {
    for (const b of domainsB) {
      if (a && b && a === b) return 1;
    }
  }
  return 0;
}

// ─── مقارنة الأسماء بـ Fuzzy Matching ────────────────────────────────────────

/**
 * مقارنة اسمين باستخدام خوارزميتين مدمجتين:
 * 1. string-similarity (Dice coefficient) — سريع وجيد للنصوص القصيرة
 * 2. Fuse.js — أكثر دقة للنصوص العربية والمختلطة
 *
 * يأخذ الحد الأعلى من الاثنين لتحقيق أفضل تغطية
 */
function compareNames(nameA: string, nameB: string): number {
  if (!nameA || !nameB) return 0;

  const normA = normalizeName(nameA);
  const normB = normalizeName(nameB);

  if (!normA || !normB) return 0;

  // تطابق تام بعد التطبيع
  if (normA === normB) return 1;

  // Dice coefficient (string-similarity)
  const diceScore = stringSimilarity.compareTwoStrings(normA, normB);

  // Fuse.js للبحث الأكثر دقة
  const fuse = new Fuse([normB], {
    includeScore: true,
    threshold: 1.0,
    distance: 100,
    minMatchCharLength: 2,
  });
  const fuseResults = fuse.search(normA);
  const fuseScore = fuseResults.length > 0
    ? 1 - (fuseResults[0].score ?? 1)
    : 0;

  // نأخذ الحد الأعلى
  return Math.min(Math.max(diceScore, fuseScore), 1);
}

// ─── مقارنة المدينة ───────────────────────────────────────────────────────────

const CITY_ALIASES: Record<string, string[]> = {
  "الرياض": ["الرياض", "riyadh", "riyad"],
  "جدة": ["جدة", "jeddah", "jidda"],
  "مكة": ["مكة", "مكة المكرمة", "mecca", "makkah"],
  "المدينة": ["المدينة", "المدينة المنورة", "medina", "madinah"],
  "الدمام": ["الدمام", "dammam"],
  "الخبر": ["الخبر", "khobar"],
  "الطائف": ["الطائف", "taif"],
  "تبوك": ["تبوك", "tabuk"],
  "أبها": ["أبها", "abha"],
};

function normalizeCity(city: string): string {
  if (!city) return "";
  const lower = city.toLowerCase().trim();
  for (const [canonical, aliases] of Object.entries(CITY_ALIASES)) {
    if (aliases.some(a => lower.includes(a.toLowerCase()))) {
      return canonical;
    }
  }
  return lower;
}

function compareCities(cityA?: string, cityB?: string): number {
  if (!cityA || !cityB) return 0;
  const normA = normalizeCity(cityA);
  const normB = normalizeCity(cityB);
  return normA === normB ? 1 : 0;
}

// ─── مقارنة التصنيف ───────────────────────────────────────────────────────────

function compareCategories(catA?: string, catB?: string): number {
  if (!catA || !catB) return 0;
  const normA = catA.toLowerCase().trim();
  const normB = catB.toLowerCase().trim();
  if (normA === normB) return 1;
  return stringSimilarity.compareTwoStrings(normA, normB);
}

// ─── مقارنة الـ Social Handle ─────────────────────────────────────────────────

/**
 * مقارنة أسماء المستخدمين في السوشيال ميديا
 * مثال: @albaraka_ksa vs @albaraka.ksa → تشابه عالي
 */
function compareSocialHandles(handleA?: string, handleB?: string): number {
  if (!handleA || !handleB) return 0;
  const normA = handleA.replace(/^@/, "").toLowerCase().replace(/[._-]/g, "");
  const normB = handleB.replace(/^@/, "").toLowerCase().replace(/[._-]/g, "");
  if (!normA || !normB) return 0;
  if (normA === normB) return 1;
  return stringSimilarity.compareTwoStrings(normA, normB);
}

// ─── حساب درجة الربط الإجمالية ────────────────────────────────────────────────

/**
 * حساب درجة التشابه بين مرشحين بالأوزان المرجحة
 *
 * الأوزان (PHASE 1 - محدثة):
 *   اسم العمل              35% — الأهم لأنه المعرّف الرئيسي
 *   رقم الهاتف المؤكد     25% — إذا تطابق → شبه مؤكد أنهما نفس الكيان
 *   الموقع الإلكتروني     20% — مؤشر قوي جداً
 *   رابط البيو             10% — مؤشر جيد للسوشيال
 *   المدينة والتصنيف       5% — مساعد فقط
 *   الـ handle السوشيال    5% — مساعد فقط
 */
export function computeLinkageScore(
  a: DiscoveryCandidate,
  b: DiscoveryCandidate
): LinkageScore {
  // ─ جمع أرقام الهاتف (verifiedPhones + candidatePhones) ─
  const phonesA = [...(a.verifiedPhones || []), ...(a.candidatePhones || [])];
  const phonesB = [...(b.verifiedPhones || []), ...(b.candidatePhones || [])];

  // ─ جمع المواقع (verifiedWebsite + candidateWebsites) ─
  const websitesA = [
    ...(a.verifiedWebsite ? [a.verifiedWebsite] : []),
    ...(a.candidateWebsites || []),
  ];
  const websitesB = [
    ...(b.verifiedWebsite ? [b.verifiedWebsite] : []),
    ...(b.candidateWebsites || []),
  ];

  // ─ حساب درجة كل حقل ─
  const nameScore = compareNames(
    a.businessNameHint || a.nameHint || "",
    b.businessNameHint || b.nameHint || ""
  );

  const phoneScore = comparePhones(phonesA, phonesB);
  const websiteScore = compareWebsites(websitesA, websitesB);

  // bioLink: نستخدم verifiedWebsite كـ bio link للسوشيال
  const bioLinkScore = compareWebsites(
    a.verifiedWebsite ? [a.verifiedWebsite] : [],
    b.verifiedWebsite ? [b.verifiedWebsite] : []
  );

  // cityAndCategory: متوسط المدينة والتصنيف
  const cityScore = compareCities(a.cityHint, b.cityHint);
  const categoryScore = compareCategories(a.categoryHint, b.categoryHint);
  const cityAndCategoryScore = (cityScore + categoryScore) / 2;

  // socialHandle
  const socialHandleScore = compareSocialHandles(a.usernameHint, b.usernameHint);

  // ─── cross-platform username matching ───
  // إذا كان username أ يظهر في crossPlatformHandles لـ ب أو العكس
  const crossHandlesA = (a.raw as Record<string, unknown>)?.crossPlatformHandles as Record<string, string> | undefined;
  const crossHandlesB = (b.raw as Record<string, unknown>)?.crossPlatformHandles as Record<string, string> | undefined;
  let crossPlatformScore = 0;
  let crossPlatformReason = "";

  // فحص إذا كان username أ موجوداً في crossHandles ب أو العكس
  const usernameA = (a.usernameHint || "").replace(/^@/, "").toLowerCase().replace(/[._-]/g, "");
  const usernameB = (b.usernameHint || "").replace(/^@/, "").toLowerCase().replace(/[._-]/g, "");

  if (crossHandlesB && usernameA) {
    for (const [platform, handle] of Object.entries(crossHandlesB)) {
      const normHandle = handle.replace(/^@/, "").toLowerCase().replace(/[._-]/g, "");
      if (normHandle && (usernameA === normHandle || stringSimilarity.compareTwoStrings(usernameA, normHandle) > 0.85)) {
        crossPlatformScore = 0.9;
        crossPlatformReason = `username أ (${usernameA}) موجود في bio ب كـ ${platform}`;
        break;
      }
    }
  }
  if (!crossPlatformScore && crossHandlesA && usernameB) {
    for (const [platform, handle] of Object.entries(crossHandlesA)) {
      const normHandle = handle.replace(/^@/, "").toLowerCase().replace(/[._-]/g, "");
      if (normHandle && (usernameB === normHandle || stringSimilarity.compareTwoStrings(usernameB, normHandle) > 0.85)) {
        crossPlatformScore = 0.9;
        crossPlatformReason = `username ب (${usernameB}) موجود في bio أ كـ ${platform}`;
        break;
      }
    }
  }

  // ─── username متطابق عبر منصتين مختلفتين ───
  // إذا كان username متطابقاً والمصدران مختلفان → إشارة قوية جداً
  const differentSources = a.source !== b.source;
  const usernameMatchAcrossPlatforms =
    differentSources &&
    socialHandleScore >= 0.85 &&
    (a.usernameHint?.length || 0) >= 4 &&
    (b.usernameHint?.length || 0) >= 4;

  // ─ الدرجة الإجمالية المرجحة ─
  const totalScore =
    nameScore * WEIGHTS.name +
    phoneScore * WEIGHTS.phone +
    websiteScore * WEIGHTS.website +
    bioLinkScore * WEIGHTS.bioLink +
    cityAndCategoryScore * WEIGHTS.cityCategory +
    socialHandleScore * WEIGHTS.socialHandle;

  // ─ الإشارات المتطابقة ─
  const matchedSignals: string[] = [];
  if (phoneScore === 1) matchedSignals.push("phone");
  if (websiteScore === 1) matchedSignals.push("website");
  if (bioLinkScore === 1) matchedSignals.push("bioLink");
  if (nameScore >= 0.8) matchedSignals.push("name");
  if (cityScore === 1) matchedSignals.push("city");
  if (categoryScore >= 0.8) matchedSignals.push("category");
  if (socialHandleScore >= 0.8) matchedSignals.push("socialHandle");
  if (crossPlatformScore >= 0.9) matchedSignals.push("crossPlatformHandle");
  if (usernameMatchAcrossPlatforms) matchedSignals.push("usernameAcrossPlatforms");

  // ─── فحص disambiguationTokens: منع الدمج عند تعارض المدينة أو نوع النشاط ───
  const nameA = a.businessNameHint || a.nameHint || "";
  const nameB = b.businessNameHint || b.nameHint || "";
  const disambigA = extractDisambiguationTokens(nameA);
  const disambigB = extractDisambiguationTokens(nameB);

  // إذا كانت المدينة مذكورة في الاسمين وهي مختلفة → رفض الدمج قطعياً
  const cityConflict =
    disambigA.city !== null &&
    disambigB.city !== null &&
    disambigA.city !== disambigB.city;

  // إذا كان نوع النشاط مذكوراً في الاسمين وهو مختلف → رفض الدمج
  const businessTypeConflict =
    disambigA.businessType !== null &&
    disambigB.businessType !== null &&
    disambigA.businessType !== disambigB.businessType;

  // ─ منطق الدمج الذكي ─
  let shouldMerge = false;
  let reason = "";

  // الرفض القاطع بسبب تعارض المدينة في الاسم (حتى لو تطابق الهاتف)
  if (cityConflict && phoneScore < 1 && websiteScore < 1) {
    shouldMerge = false;
    reason = `تعارض المدينة في الاسم: ${disambigA.city} ≠ ${disambigB.city} — رفض الدمج`;
  } else if (businessTypeConflict && nameScore < 0.95 && phoneScore < 1 && websiteScore < 1) {
    // نوع النشاط مختلف + الاسم غير متطابق تماماً + لا هاتف ولا موقع مشترك
    shouldMerge = false;
    reason = `تعارض نوع النشاط: ${disambigA.businessType} ≠ ${disambigB.businessType} — رفض الدمج`;
  } else if (phoneScore === 1) {
    // تطابق رقم الهاتف وحده كافٍ → دمج مؤكد
    shouldMerge = true;
    reason = "تطابق رقم الهاتف";
  } else if (websiteScore === 1) {
    // تطابق الموقع الإلكتروني وحده كافٍ → دمج مؤكد
    shouldMerge = true;
    reason = "تطابق الموقع الإلكتروني";
  } else if (bioLinkScore === 1) {
    // تطابق رابط البيو وحده كافٍ → دمج
    shouldMerge = true;
    reason = "تطابق رابط البيو";
  } else if (crossPlatformScore >= 0.9) {
    // username موجود في bio المنصة الأخرى → دمج مؤكد
    shouldMerge = true;
    reason = crossPlatformReason;
  } else if (usernameMatchAcrossPlatforms) {
    // نفس username عبر منصتين مختلفتين → دمج مرجح
    shouldMerge = true;
    reason = `نفس username (${a.usernameHint}) عبر ${a.source} و ${b.source}`;
  } else if (nameScore >= NAME_ONLY_THRESHOLD && cityScore === 1 && differentSources) {
    // اسم متطابق جداً (85%+) + نفس المدينة + منصتان مختلفتان → دمج مرجح
    shouldMerge = true;
    reason = `اسم متطابق جداً (${(nameScore * 100).toFixed(0)}%) في نفس المدينة عبر ${a.source} و ${b.source}`;
  } else if (nameScore >= 0.85 && phoneScore === 1) {
    // اسم متطابق جداً + هاتف مطابق → دمج مؤكد
    shouldMerge = true;
    reason = `اسم متطابق (${(nameScore * 100).toFixed(0)}%) مع هاتف مطابق`;
  } else if (totalScore >= MERGE_THRESHOLD) {
    // الدرجة الإجمالية كافية للدمج
    shouldMerge = true;
    reason = `الدرجة الإجمالية المرجحة: ${(totalScore * 100).toFixed(0)}%`;
  } else {
    reason = `درجة منخفضة (${(totalScore * 100).toFixed(0)}%) — كيانان مختلفان`;
  }

  return {
    candidateA: a,
    candidateB: b,
    totalScore,
    shouldMerge,
    breakdown: {
      nameScore,
      phoneScore,
      websiteScore,
      bioLinkScore,
      cityAndCategoryScore,
      socialHandleScore,
    },
    matchedSignals,
    reason,
  };
}

// ─── Browser Verification Agent Constants ────────────────────────────────────
/** الحد الأدنى لمنطقة الرمادي — أقل من هذا لا يستحق التحقق */
const GREY_ZONE_MIN = 0.60;
/** الحد الأقصى لمنطقة الرمادي — فوق هذا يُدمج مباشرة */
const GREY_ZONE_MAX = 0.84;

// ─── خوارزمية التجميع (Clustering) ───────────────────────────────────────────

/**
 * تجميع المرشحين المتشابهين في مجموعات (كيانات موحدة)
 * باستخدام Union-Find (Disjoint Set Union) للكفاءة
 *
 * للحالات الرمادية (score 0.60-0.84): يُستدعى Browser Verification Agent
 * لاستخراج أدلة إضافية من صفحات الحسابات الفعلية.
 */
export async function clusterCandidatesAsync(
  candidates: DiscoveryCandidate[]
): Promise<ResolvedGroup[]> {
  const n = candidates.length;
  if (n === 0) return [];
  if (n === 1) {
    return [{
      primary: candidates[0],
      duplicates: [],
      mergeConfidence: candidates[0].confidence,
      sources: [candidates[0].source],
    }];
  }
  // Union-Find
  const parent = Array.from({ length: n }, (_, i) => i);
  const rank = new Array(n).fill(0);

  function find(x: number): number {
    if (parent[x] !== x) parent[x] = find(parent[x]);
    return parent[x];
  }

  function union(x: number, y: number): void {
    const px = find(x);
    const py = find(y);
    if (px === py) return;
    if (rank[px] < rank[py]) parent[px] = py;
    else if (rank[px] > rank[py]) parent[py] = px;
    else { parent[py] = px; rank[px]++; }
  }

  // حساب درجات التشابه لكل زوج مع Browser Verification للحالات الرمادية
  const greyZonePairs: Array<{ i: number; j: number; score: number }> = [];

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const linkage = computeLinkageScore(candidates[i], candidates[j]);
      if (linkage.shouldMerge) {
        union(i, j);
      } else if (linkage.totalScore >= GREY_ZONE_MIN && linkage.totalScore < GREY_ZONE_MAX) {
        // منطقة رمادية — نحتاج تحقق إضافي
        greyZonePairs.push({ i, j, score: linkage.totalScore });
      }
    }
  }

  // معالجة الحالات الرمادية عبر Browser Verification Agent
  if (greyZonePairs.length > 0) {
    try {
      const { verifyIdentityPair } = await import("./verificationLayer.js");
      // نعالج أقصى 5 أزواج لتجنب التأخير الزائد
      const pairsToVerify = greyZonePairs.slice(0, 5);
      await Promise.allSettled(
        pairsToVerify.map(async ({ i, j, score }) => {
          const a = candidates[i];
          const b = candidates[j];
          const urlA = a.verifiedWebsite || (a.candidateWebsites?.[0]) || "";
          const urlB = b.verifiedWebsite || (b.candidateWebsites?.[0]) || "";
          if (!urlA || !urlB) return;
          const caseId = `${a.source}:${a.usernameHint || i}_vs_${b.source}:${b.usernameHint || j}`;
          const result = await verifyIdentityPair(urlA, a.source, urlB, b.source, score, caseId);
          if (result.decision === "merge_confirmed" || result.decision === "merge_suggested") {
            union(i, j);
            // إثراء الكاندييت بالبيانات الجديدة إذا وُجدت
            if (result.shouldEnrich) {
              const enriched = result.enrichedData;
              if (enriched.phones.length > 0) {
                candidates[i].candidatePhones = [
                  ...(candidates[i].candidatePhones || []),
                  ...enriched.phones,
                ];
              }
              if (enriched.cities.length > 0 && !candidates[i].cityHint) {
                candidates[i].cityHint = enriched.cities[0];
              }
            }
          }
        })
      );
    } catch (err) {
      // Browser Verification فشل — نتجاهله ونكمل بالنتائج الحالية
      console.warn("[IdentityLinkage] Browser Verification failed:", err);
    }
  }
  // بناء المجموعات
  const groups: Map<number, number[]> = new Map();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(i);
  }

  // تحويل المجموعات إلى ResolvedGroup
  const result: ResolvedGroup[] = [];

  for (const [, memberIndices] of Array.from(groups.entries())) {
    const members = memberIndices.map(i => candidates[i]);

    const sorted = [...members].sort((a, b) => b.confidence - a.confidence);
    const primary = sorted[0];
    const duplicates = sorted.slice(1);

    const avgConfidence = members.reduce((sum, m) => sum + m.confidence, 0) / members.length;
    const sources = Array.from(new Set(members.map((m: DiscoveryCandidate) => m.source)));

    result.push({
      primary,
      duplicates,
      mergeConfidence: avgConfidence,
      sources,
    });
  }

  // ترتيب النتائج: المجموعات الأكبر أولاً
  result.sort((a, b) => b.sources.length - a.sources.length);

  return result;
}

/**
 * نسخة synchronous من clusterCandidates — لا تُشغّل Browser Verification
 * مستخدمة للتوافق مع الكود القديم والاختبارات
 */
export function clusterCandidates(
  candidates: DiscoveryCandidate[]
): ResolvedGroup[] {
  const n = candidates.length;
  if (n === 0) return [];
  if (n === 1) {
    return [{
      primary: candidates[0],
      duplicates: [],
      mergeConfidence: candidates[0].confidence,
      sources: [candidates[0].source],
    }];
  }

  const parent = Array.from({ length: n }, (_, i) => i);
  const rank = new Array(n).fill(0);

  function find(x: number): number {
    if (parent[x] !== x) parent[x] = find(parent[x]);
    return parent[x];
  }

  function union(x: number, y: number): void {
    const px = find(x);
    const py = find(y);
    if (px === py) return;
    if (rank[px] < rank[py]) parent[px] = py;
    else if (rank[px] > rank[py]) parent[py] = px;
    else { parent[py] = px; rank[px]++; }
  }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const linkage = computeLinkageScore(candidates[i], candidates[j]);
      if (linkage.shouldMerge) union(i, j);
    }
  }

  const groups: Map<number, number[]> = new Map();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(i);
  }

  const result: ResolvedGroup[] = [];
  for (const [, memberIndices] of Array.from(groups.entries())) {
    const members = memberIndices.map(i => candidates[i]);
    const sorted = [...members].sort((a, b) => b.confidence - a.confidence);
    const primary = sorted[0];
    const duplicates = sorted.slice(1);
    const avgConfidence = members.reduce((sum, m) => sum + m.confidence, 0) / members.length;
    const sources = Array.from(new Set(members.map((m: DiscoveryCandidate) => m.source)));
    result.push({ primary, duplicates, mergeConfidence: avgConfidence, sources });
  }
  result.sort((a, b) => b.sources.length - a.sources.length);
  return result;
}

// ─── بناء BusinessLead من مجموعة ─────────────────────────────────────────────────

/**
 * تحويل مجموعة مرشحين مدموجين إلى BusinessLead موحد
 * PHASE 1: تحديث الحقول لتتوافق مع الأنواع الجديدة
 */
export function buildBusinessLeadFromGroup(
  group: ResolvedGroup,
  id?: string
): BusinessLead {
  const all = [group.primary, ...group.duplicates];
  const now = new Date().toISOString();

  // ─ اسم العمل: من المرشح الأعلى ثقة ─
  const businessName =
    group.primary.businessNameHint ||
    group.primary.nameHint ||
    "عمل تجاري غير معروف";

  // ─ جمع أرقام الهاتف المؤكدة من جميع المصادر ─
  const allVerifiedPhones = all.flatMap((c: DiscoveryCandidate) => c.verifiedPhones || []);
  const allCandidatePhones = all.flatMap((c: DiscoveryCandidate) => c.candidatePhones || []);
  const uniqueVerifiedPhones = Array.from(new Set(allVerifiedPhones.map(normalizePhone))).filter(Boolean);
  const uniqueCandidatePhones = Array.from(
    new Set(allCandidatePhones.map(normalizePhone))
  ).filter(p => p && !uniqueVerifiedPhones.includes(p));

  // ─ جمع البريد الإلكتروني ─
  const allVerifiedEmails = all.flatMap((c: DiscoveryCandidate) => c.verifiedEmails || []);
  const allCandidateEmails = all.flatMap((c: DiscoveryCandidate) => c.candidateEmails || []);
  const uniqueVerifiedEmails = Array.from(new Set(allVerifiedEmails)).filter(Boolean);
  const uniqueCandidateEmails = Array.from(
    new Set(allCandidateEmails)
  ).filter(e => e && !uniqueVerifiedEmails.includes(e));

  // ─ الموقع الإلكتروني المؤكد ─
  const verifiedWebsites = all
    .map((c: DiscoveryCandidate) => c.verifiedWebsite)
    .filter(Boolean) as string[];
  const candidateWebsites = all.flatMap((c: DiscoveryCandidate) => c.candidateWebsites || []);
  const verifiedWebsite = verifiedWebsites[0];
  const uniqueCandidateWebsites = Array.from(
    new Set(candidateWebsites.map(extractDomain))
  ).filter(d => d && (!verifiedWebsite || extractDomain(verifiedWebsite) !== d));

  // ─ أفضل مدينة: الأكثر تكراراً ─
  const cityCounts: Record<string, number> = {};
  for (const c of all) {
    if (c.cityHint) {
      const norm = normalizeCity(c.cityHint);
      cityCounts[norm] = (cityCounts[norm] || 0) + 1;
    }
  }
  const bestCity = Object.entries(cityCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  // ─ أفضل تصنيف: الأكثر تكراراً ─
  const catCounts: Record<string, number> = {};
  for (const c of all) {
    if (c.categoryHint) {
      catCounts[c.categoryHint] = (catCounts[c.categoryHint] || 0) + 1;
    }
  }
  const bestCategory = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  // ─ بناء SourceRecords ─
  const sourceRecords: SourceRecord[] = all.map((c, idx) => ({
    id: `${c.source}-${idx}-${Date.now()}`,
    source: c.source,
    sourceType: c.sourceType,
    url: c.url,
    confidence: c.confidence,
    raw: c.raw,
  }));

  // ─ بناء socialProfiles ─
  const socialProfiles: BusinessLead["socialProfiles"] = {};
  for (const c of all) {
    if (c.url && c.source !== "google" && c.source !== "maps" && c.source !== "website") {
      const src = c.source as keyof BusinessLead["socialProfiles"];
      if (!socialProfiles[src]) {
        socialProfiles[src] = c.url;
      }
    }
  }

  return {
    id: id || crypto.randomUUID(),
    businessName,
    normalizedBusinessName: normalizeName(businessName),
    category: bestCategory,
    city: bestCity,
    verifiedPhones: uniqueVerifiedPhones,
    candidatePhones: uniqueCandidatePhones,
    verifiedEmails: uniqueVerifiedEmails,
    candidateEmails: uniqueCandidateEmails,
    verifiedWebsite,
    candidateWebsites: uniqueCandidateWebsites,
    socialProfiles,
    sourceRecords,
    assets: [],
    opportunities: [],
    status: "resolved",
    createdAt: now,
    updatedAt: now,
  };
}

// ─── فحص وجود مُعرّف قوي مشترك بين المرشحين ────────────────────────────────────

/**
 * يفحص إذا كان هناك مُعرّف قوي مشترك (هاتف أو موقع) بين مرشحين اثنين على الأقل.
 * إذا كان كذلك، الدمج مسموح حتى لو كان الاسم مختلفاً — لأن الهاتف/الموقع يُثبت الهوية بشكل قاطع.
 */
function hasCommonStrongIdentifier(candidates: DiscoveryCandidate[]): boolean {
  if (candidates.length < 2) return false;

  // جمع أرقام الهاتف المؤكدة لكل مرشح
  const phoneSets = candidates.map(c => {
    const phones = [...(c.verifiedPhones || []), ...(c.candidatePhones || [])];
    return new Set(phones.map(p => normalizePhone(p)).filter(Boolean));
  });

  // فحص وجود هاتف مشترك بين أي مرشحين اثنين
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      for (const phone of Array.from(phoneSets[i])) {
        if (phone && phoneSets[j].has(phone)) return true;
      }
    }
  }

  // جمع المواقع لكل مرشح
  const domainSets = candidates.map(c => {
    const sites = [
      ...(c.verifiedWebsite ? [c.verifiedWebsite] : []),
      ...(c.candidateWebsites || []),
    ];
    return new Set(sites.map(s => extractDomain(s)).filter(Boolean));
  });

  // فحص وجود موقع مشترك
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      for (const domain of Array.from(domainSets[i])) {
        if (domain && domainSets[j].has(domain)) return true;
      }
    }
  }

  return false;
}

/**
 * الدالة الرئيسية لمعالجة قائمة المرشحين الخام وتحويلها إلى كيانات موحدة
 * @param candidates - قائمة المرشحين الخام من جميع المصادر
 * @returns قائمة BusinessLead موحدة بدون تكرار
 *
 * @example
 * const candidates: DiscoveryCandidate[] = [
 *   {
 *     id: "1", source: "instagram", sourceType: "profile",
 *     nameHint: "مطعم البركة", cityHint: "الرياض",
 *     verifiedPhones: [], candidatePhones: [],
 *     verifiedEmails: [], candidateEmails: [],
 *     candidateWebsites: [], confidence: 0.7, raw: {}
 *   },
 *   {
 *     id: "2", source: "maps", sourceType: "listing",
 *     nameHint: "Al Baraka Restaurant", cityHint: "الرياض",
 *     verifiedPhones: ["0501234567"], candidatePhones: [],
 *     verifiedEmails: [], candidateEmails: [],
 *     candidateWebsites: [], confidence: 0.9, raw: {}
 *   },
 * ];
 * const leads = resolveLeads(candidates);
 * // → [ { businessName: "Al Baraka Restaurant", mergedSources: ["instagram", "maps"], ... } ]
 */
export function resolveLeads(candidates: DiscoveryCandidate[]): BusinessLead[] {
  if (!candidates.length) return [];

  // 1. تجميع المرشحين المتشابهين
  const groups = clusterCandidates(candidates);

  // 2. بناء BusinessLead من كل مجموعة — بعد فحص Identity Integrity Gate
  const leads: BusinessLead[] = [];
  let blockedCount = 0;

  for (const group of groups) {
    const allCandidates = [group.primary, ...group.duplicates];

    // ─── Identity Integrity Gate ───
    const gateResult = runGateOnGroup(allCandidates);

    // إذا كان هناك مُعرّف قوي مشترك (هاتف أو موقع) بين جميع المرشحين → الدمج مسموح حتى لو كان الاسم مختلفاً
    const hasSharedStrongIdentifier = hasCommonStrongIdentifier(allCandidates);
    const mergeAllowed = hasSharedStrongIdentifier
      ? { allowed: true, reason: "مُعرّف قوي مشترك (هاتف/موقع)" }
      : isOperationAllowed(gateResult.integrityResult, "merge");

    if (!mergeAllowed.allowed) {
      // هوية غير مستقرة → لا دمج، كل مرشح يصبح lead مستقل
      blockedCount++;
      console.warn(
        `[IdentityLinkage] Gate منع دمج مجموعة (${allCandidates.length} مرشح): ${mergeAllowed.reason}`
      );
      // كل مرشح يصبح lead مستقل بدلاً من دمجهم
      for (const candidate of allCandidates) {
        const singleGroup: ResolvedGroup = { primary: candidate, duplicates: [], mergeConfidence: 0, sources: [candidate.source] };
        const lead = buildBusinessLeadFromGroup(singleGroup);
        // علّم الليد بأن هويته غير مستقرة
        lead.status = "identity_unstable";
        (lead as Record<string, unknown>)["identityGateReason"] = mergeAllowed.reason;
        leads.push(lead);
      }
      continue;
    }

    // هوية مستقرة → اكمل الدمج
    const lead = buildBusinessLeadFromGroup(group);
    leads.push(lead);
  }

  console.log(
    `[IdentityLinkage] ${candidates.length} candidates → ${leads.length} unique leads ` +
    `(${candidates.length - leads.length} duplicates merged, ${blockedCount} groups blocked by Gate)`
  );

  return leads;
}

// ─── أدوات مساعدة للتشخيص ────────────────────────────────────────────────────

/**
 * تشخيص سبب دمج/عدم دمج مرشحين
 * مفيد للـ debugging وفهم قرارات الخوارزمية
 */
export function explainLinkage(
  a: DiscoveryCandidate,
  b: DiscoveryCandidate
): string {
  const score = computeLinkageScore(a, b);
  const { breakdown } = score;

  const lines = [
    `=== مقارنة المرشحين ===`,
    `A: "${a.businessNameHint || a.nameHint}" (${a.source})`,
    `B: "${b.businessNameHint || b.nameHint}" (${b.source})`,
    ``,
    `الدرجات:`,
    `  الاسم:          ${(breakdown.nameScore * 100).toFixed(1)}% × 35% = ${(breakdown.nameScore * WEIGHTS.name * 100).toFixed(1)}%`,
    `  الهاتف:         ${(breakdown.phoneScore * 100).toFixed(1)}% × 25% = ${(breakdown.phoneScore * WEIGHTS.phone * 100).toFixed(1)}%`,
    `  الموقع:         ${(breakdown.websiteScore * 100).toFixed(1)}% × 20% = ${(breakdown.websiteScore * WEIGHTS.website * 100).toFixed(1)}%`,
    `  رابط البيو:     ${(breakdown.bioLinkScore * 100).toFixed(1)}% × 10% = ${(breakdown.bioLinkScore * WEIGHTS.bioLink * 100).toFixed(1)}%`,
    `  المدينة/التصنيف:${(breakdown.cityAndCategoryScore * 100).toFixed(1)}% × 5%  = ${(breakdown.cityAndCategoryScore * WEIGHTS.cityCategory * 100).toFixed(1)}%`,
    `  الـ Handle:     ${(breakdown.socialHandleScore * 100).toFixed(1)}% × 5%  = ${(breakdown.socialHandleScore * WEIGHTS.socialHandle * 100).toFixed(1)}%`,
    ``,
    `الإجمالي: ${(score.totalScore * 100).toFixed(1)}%`,
    `الإشارات المتطابقة: ${score.matchedSignals.join(", ") || "لا يوجد"}`,
    `القرار: ${score.shouldMerge ? "✅ دمج" : "❌ كيانان مختلفان"}`,
    `السبب: ${score.reason}`,
  ];

  return lines.join("\n");
}

// ─── دالة مساعدة: normalizeCity (exported للاستخدام الخارجي) ─────────────────
export { normalizeCity };
