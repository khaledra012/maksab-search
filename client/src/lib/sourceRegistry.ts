/**
 * Source Canonicalization Layer — Client Side
 * =============================================
 * نسخة الواجهة من Source Registry.
 * يُستخدم لتوحيد أسماء المنصات قبل إرسالها إلى الباك-إند.
 * 
 * القاعدة الصارمة:
 *   - لا يُرسَل "twitter" إلى الباك-إند — يُرسَل "x" فقط
 *   - لا يُرسَل "googleWeb" إلى الباك-إند — يُرسَل "google" فقط
 *   - أي source غير معروفة → تُسجَّل في console.warn ولا تُخفى
 */

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

const ALIAS_MAP: Record<string, CanonicalSource> = {
  // Google
  google: "google",
  googleweb: "google",
  "google-web": "google",
  "google_web": "google",
  googlewebsearch: "google",
  "google search": "google",

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
  tt: "tiktok",

  // Snapchat
  snapchat: "snapchat",
  snap: "snapchat",
  sc: "snapchat",

  // Twitter / X — الاسم الرسمي هو "x"
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
 */
export function canonicalizeSource(raw: string | undefined | null): CanonicalSource {
  if (!raw) return "unknown";
  const normalized = raw.trim().toLowerCase().replace(/\s+/g, "");
  const canonical = ALIAS_MAP[normalized];
  if (!canonical) {
    console.warn(`[sourceRegistry] Unknown platform key: "${raw}" — tagged as unknown`);
    return "unknown";
  }
  return canonical;
}

/**
 * تحويل كائن rawResults قبل إرساله إلى الباك-إند
 * يُحوّل كل مفتاح platform إلى اسمه الرسمي
 */
export function canonicalizeRawResults(
  rawResults: Record<string, Record<string, unknown>[]>
): Record<string, Record<string, unknown>[]> {
  const canonical: Record<string, Record<string, unknown>[]> = {};
  for (const [platform, results] of Object.entries(rawResults)) {
    const canonicalKey = canonicalizeSource(platform);
    if (canonicalKey === "unknown") continue; // تجاهل المنصات غير المعروفة
    if (!canonical[canonicalKey]) {
      canonical[canonicalKey] = [];
    }
    canonical[canonicalKey].push(...results);
  }
  return canonical;
}

/**
 * الحصول على اسم العرض العربي للمنصة
 */
export function getSourceDisplayName(source: CanonicalSource | string): string {
  const names: Record<string, string> = {
    google: "Google Search",
    maps: "Google Maps",
    instagram: "إنستجرام",
    tiktok: "تيك توك",
    snapchat: "سناب شات",
    x: "تويتر / X",
    facebook: "فيسبوك",
    linkedin: "لينكدإن",
    website: "موقع إلكتروني",
    unknown: "غير معروف",
  };
  return names[source] ?? source;
}
