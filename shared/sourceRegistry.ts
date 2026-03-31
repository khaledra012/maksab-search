/**
 * Source Canonicalization Layer
 * ==============================
 * القاموس الموحد الوحيد لأسماء المنصات في كل النظام.
 * يُستخدم في:
 *   - SearchHub / CrossPlatformPanel (الواجهة)
 *   - rawResultToCandidate (leadIntelligence)
 *   - toDiscoverySource (leadIntelligence)
 *   - createFromMerge (leadIntelligence)
 *   - buildBusinessLeadFromGroup (identityLinkage)
 *   - socialProfiles mapping
 */

// ===== الأنواع الأساسية =====

/** الأسماء الرسمية الموحدة للمنصات */
export type CanonicalSource =
  | "google"
  | "maps"
  | "instagram"
  | "tiktok"
  | "snapchat"
  | "x"
  | "facebook"
  | "linkedin"
  | "website"
  | "unknown";

/** الأسماء البديلة المقبولة من الواجهة أو المنصات الخارجية */
type AliasSource = string;

// ===== خريطة التوحيد =====
const ALIAS_MAP: Record<AliasSource, CanonicalSource> = {
  // Google
  google: "google",
  googleweb: "google",
  "google-web": "google",
  "google_web": "google",
  googlewebsearch: "google",

  // Google Maps
  maps: "maps",
  "google-maps": "maps",
  "google_maps": "maps",
  googlemaps: "maps",
  "google maps": "maps",
  gmaps: "maps",

  // Instagram
  instagram: "instagram",
  ig: "instagram",
  insta: "instagram",

  // TikTok
  tiktok: "tiktok",
  "tik-tok": "tiktok",
  "tik_tok": "tiktok",
  tt: "tiktok",

  // Snapchat
  snapchat: "snapchat",
  snap: "snapchat",
  sc: "snapchat",

  // Twitter / X
  x: "x",
  twitter: "x",
  "twitter/x": "x",
  "x/twitter": "x",
  tw: "x",

  // Facebook
  facebook: "facebook",
  fb: "facebook",

  // LinkedIn
  linkedin: "linkedin",
  li: "linkedin",

  // Website
  website: "website",
  web: "website",
  site: "website",

  // Unknown
  unknown: "unknown",
  other: "unknown",
};

/**
 * تحويل أي اسم منصة إلى الاسم الرسمي الموحد
 * @param raw - الاسم الخام (من الواجهة أو الباك-إند)
 * @returns الاسم الرسمي الموحد
 */
export function canonicalizeSource(raw: string | undefined | null): CanonicalSource {
  if (!raw) return "unknown";
  const normalized = raw.trim().toLowerCase().replace(/\s+/g, "");
  return ALIAS_MAP[normalized] ?? "unknown";
}

/**
 * التحقق من أن المصدر هو منصة اجتماعية (وليس google/maps/website)
 */
export function isSocialPlatform(source: CanonicalSource): boolean {
  return ["instagram", "tiktok", "snapchat", "x", "facebook", "linkedin"].includes(source);
}

/**
 * الحصول على اسم العرض العربي للمنصة
 */
export function getSourceDisplayName(source: CanonicalSource): string {
  const names: Record<CanonicalSource, string> = {
    google: "Google",
    maps: "Google Maps",
    instagram: "Instagram",
    tiktok: "TikTok",
    snapchat: "Snapchat",
    x: "X (Twitter)",
    facebook: "Facebook",
    linkedin: "LinkedIn",
    website: "موقع إلكتروني",
    unknown: "غير معروف",
  };
  return names[source] ?? source;
}

/**
 * الحصول على أيقونة المنصة (emoji)
 */
export function getSourceIcon(source: CanonicalSource): string {
  const icons: Record<CanonicalSource, string> = {
    google: "🔍",
    maps: "📍",
    instagram: "📸",
    tiktok: "🎵",
    snapchat: "👻",
    x: "𝕏",
    facebook: "📘",
    linkedin: "💼",
    website: "🌐",
    unknown: "❓",
  };
  return icons[source] ?? "❓";
}

/**
 * الحصول على حقل socialProfiles المناسب للمنصة
 * يُستخدم في buildBusinessLeadFromGroup وcreateFromMerge
 */
export function getSocialFieldKey(source: CanonicalSource): string | null {
  const fieldMap: Partial<Record<CanonicalSource, string>> = {
    instagram: "instagram",
    tiktok: "tiktok",
    snapchat: "snapchat",
    x: "twitter",       // حقل DB يُسمى twitter لكن source الرسمي هو x
    facebook: "facebook",
    linkedin: "linkedin",
  };
  return fieldMap[source] ?? null;
}

/**
 * قائمة كل المنصات المدعومة للبحث
 */
export const ALL_SEARCH_PLATFORMS: CanonicalSource[] = [
  "google",
  "maps",
  "instagram",
  "tiktok",
  "snapchat",
  "x",
  "facebook",
  "linkedin",
];

/**
 * قائمة المنصات الاجتماعية فقط
 */
export const SOCIAL_PLATFORMS: CanonicalSource[] = [
  "instagram",
  "tiktok",
  "snapchat",
  "x",
  "facebook",
  "linkedin",
];
