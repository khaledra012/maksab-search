/**
 * missingFieldsSearch.ts
 * ===========================
 * البحث المخصص على النواقص: يكتشف الحقول المفقودة لعميل محدد
 * ثم يبحث عنها تلقائياً عبر SERP API ويعيد النتائج للمراجعة.
 *
 * الحقول التي يبحث عنها:
 *  - instagramUrl   → searchInstagramSERP
 *  - tiktokUrl      → searchTikTokSERP
 *  - snapchatUrl    → searchSnapchatSERP
 *  - twitterUrl     → searchTwitterSERP
 *  - facebookUrl    → searchFacebookSERP
 *  - website        → parseGoogleResultsGeneric (بحث Google عام)
 *  - googleMapsUrl  → Google Maps Text Search API
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getLeadById, updateLead } from "../db";
import {
  searchInstagramSERP,
  searchTikTokSERP,
  searchSnapchatSERP,
  searchTwitterSERP,
  searchFacebookSERP,
  serpRequest,
  parseGoogleResultsGeneric,
} from "./serpSearch";
import { buildGoogleSearchUrl } from "../lib/googleUrlBuilder";

// ===== أنواع النتائج =====
export interface MissingFieldResult {
  field: string;          // اسم الحقل (instagramUrl, website, ...)
  label: string;          // تسمية عربية
  candidates: Array<{
    url: string;
    displayName: string;
    username?: string;
    bio?: string;
    confidence: "high" | "medium" | "low";
    source: string;
  }>;
  status: "found" | "not_found" | "error";
  errorMessage?: string;
}

// ===== خريطة الحقول =====
const FIELD_LABELS: Record<string, string> = {
  instagramUrl: "حساب إنستغرام",
  tiktokUrl: "حساب تيك توك",
  snapchatUrl: "حساب سناب شات",
  twitterUrl: "حساب تويتر/X",
  facebookUrl: "حساب فيسبوك",
  website: "الموقع الإلكتروني",
  googleMapsUrl: "خرائط Google",
};

// ===== حساب درجة الثقة =====
function scoreConfidence(
  displayName: string,
  bio: string,
  companyName: string,
  businessType: string,
  city: string,
): "high" | "medium" | "low" {
  const haystack = `${displayName} ${bio}`.toLowerCase();
  const nameWords = companyName.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const cityLower = city.toLowerCase();
  const btLower = businessType.toLowerCase();

  let score = 0;
  // تطابق الاسم
  const matchedNameWords = nameWords.filter(w => haystack.includes(w));
  if (matchedNameWords.length >= 2) score += 3;
  else if (matchedNameWords.length === 1) score += 1;
  // تطابق المدينة
  if (haystack.includes(cityLower) || haystack.includes("الرياض") || haystack.includes("جدة")) score += 1;
  // تطابق نوع النشاط
  const btWords = btLower.split(/\s+/).filter(w => w.length > 2);
  if (btWords.some(w => haystack.includes(w))) score += 1;

  if (score >= 4) return "high";
  if (score >= 2) return "medium";
  return "low";
}

// ===== البحث عن إنستغرام =====
async function searchInstagram(companyName: string, city: string, businessType: string): Promise<MissingFieldResult> {
  try {
    const results = await searchInstagramSERP(companyName, city);
    if (results.length === 0) return { field: "instagramUrl", label: FIELD_LABELS.instagramUrl, candidates: [], status: "not_found" };
    const candidates = results.slice(0, 5).map(r => ({
      url: r.url || `https://instagram.com/${r.username}`,
      displayName: r.displayName || r.username,
      username: r.username,
      bio: r.bio || "",
      confidence: scoreConfidence(r.displayName || "", r.bio || "", companyName, businessType, city),
      source: "Instagram SERP",
    }));
    return { field: "instagramUrl", label: FIELD_LABELS.instagramUrl, candidates, status: "found" };
  } catch (err: any) {
    return { field: "instagramUrl", label: FIELD_LABELS.instagramUrl, candidates: [], status: "error", errorMessage: err.message };
  }
}

// ===== البحث عن تيك توك =====
async function searchTikTok(companyName: string, city: string, businessType: string): Promise<MissingFieldResult> {
  try {
    const results = await searchTikTokSERP(companyName, city);
    if (results.length === 0) return { field: "tiktokUrl", label: FIELD_LABELS.tiktokUrl, candidates: [], status: "not_found" };
    const candidates = results.slice(0, 5).map(r => ({
      url: r.url || `https://tiktok.com/@${r.username}`,
      displayName: r.displayName || r.username,
      username: r.username,
      bio: r.bio || "",
      confidence: scoreConfidence(r.displayName || "", r.bio || "", companyName, businessType, city),
      source: "TikTok SERP",
    }));
    return { field: "tiktokUrl", label: FIELD_LABELS.tiktokUrl, candidates, status: "found" };
  } catch (err: any) {
    return { field: "tiktokUrl", label: FIELD_LABELS.tiktokUrl, candidates: [], status: "error", errorMessage: err.message };
  }
}

// ===== البحث عن سناب شات =====
async function searchSnapchat(companyName: string, city: string, businessType: string): Promise<MissingFieldResult> {
  try {
    const results = await searchSnapchatSERP(companyName, city);
    if (results.length === 0) return { field: "snapchatUrl", label: FIELD_LABELS.snapchatUrl, candidates: [], status: "not_found" };
    const candidates = results.slice(0, 5).map(r => ({
      url: r.url || `https://snapchat.com/add/${r.username}`,
      displayName: r.displayName || r.username,
      username: r.username,
      bio: r.bio || "",
      confidence: scoreConfidence(r.displayName || "", r.bio || "", companyName, businessType, city),
      source: "Snapchat SERP",
    }));
    return { field: "snapchatUrl", label: FIELD_LABELS.snapchatUrl, candidates, status: "found" };
  } catch (err: any) {
    return { field: "snapchatUrl", label: FIELD_LABELS.snapchatUrl, candidates: [], status: "error", errorMessage: err.message };
  }
}

// ===== البحث عن تويتر/X =====
async function searchTwitter(companyName: string, city: string, businessType: string): Promise<MissingFieldResult> {
  try {
    const results = await searchTwitterSERP(companyName, city);
    if (results.length === 0) return { field: "twitterUrl", label: FIELD_LABELS.twitterUrl, candidates: [], status: "not_found" };
    const candidates = results.slice(0, 5).map(r => ({
      url: r.url || `https://x.com/${r.username}`,
      displayName: r.displayName || r.username,
      username: r.username,
      bio: r.bio || "",
      confidence: scoreConfidence(r.displayName || "", r.bio || "", companyName, businessType, city),
      source: "Twitter/X SERP",
    }));
    return { field: "twitterUrl", label: FIELD_LABELS.twitterUrl, candidates, status: "found" };
  } catch (err: any) {
    return { field: "twitterUrl", label: FIELD_LABELS.twitterUrl, candidates: [], status: "error", errorMessage: err.message };
  }
}

// ===== البحث عن فيسبوك =====
async function searchFacebook(companyName: string, city: string, businessType: string): Promise<MissingFieldResult> {
  try {
    const results = await searchFacebookSERP(companyName, city);
    if (results.length === 0) return { field: "facebookUrl", label: FIELD_LABELS.facebookUrl, candidates: [], status: "not_found" };
    const candidates = results.slice(0, 5).map(r => ({
      url: r.url || `https://facebook.com/${r.username}`,
      displayName: r.displayName || r.username,
      username: r.username,
      bio: r.bio || "",
      confidence: scoreConfidence(r.displayName || "", r.bio || "", companyName, businessType, city),
      source: "Facebook SERP",
    }));
    return { field: "facebookUrl", label: FIELD_LABELS.facebookUrl, candidates, status: "found" };
  } catch (err: any) {
    return { field: "facebookUrl", label: FIELD_LABELS.facebookUrl, candidates: [], status: "error", errorMessage: err.message };
  }
}

// ===== البحث عن الموقع الإلكتروني =====
async function searchWebsite(companyName: string, city: string, businessType: string): Promise<MissingFieldResult> {
  try {
    const query = `${companyName} ${city} موقع رسمي`;
    const url = buildGoogleSearchUrl({ query });
    const html = await serpRequest(url);
    const results = parseGoogleResultsGeneric(html);
    // تصفية المواقع الاجتماعية والحكومية
    const EXCLUDED = ["instagram.com", "tiktok.com", "snapchat.com", "twitter.com", "x.com",
      "facebook.com", "youtube.com", "linkedin.com", "google.com", "wikipedia.org",
      "gov.sa", "government.sa", "amazon.com", "noon.com"];
    const filtered = results.filter(r => {
      const lower = (r.url || "").toLowerCase();
      return !EXCLUDED.some(d => lower.includes(d));
    });
    if (filtered.length === 0) return { field: "website", label: FIELD_LABELS.website, candidates: [], status: "not_found" };
    const candidates = filtered.slice(0, 5).map(r => ({
      url: r.url,
      displayName: r.displayName || r.url,
      bio: r.bio || "",
      confidence: scoreConfidence(r.displayName || "", r.bio || "", companyName, businessType, city),
      source: "Google SERP",
    }));
    return { field: "website", label: FIELD_LABELS.website, candidates, status: "found" };
  } catch (err: any) {
    return { field: "website", label: FIELD_LABELS.website, candidates: [], status: "error", errorMessage: err.message };
  }
}

// ===== البحث عن خرائط Google =====
async function searchGoogleMaps(companyName: string, city: string, businessType: string): Promise<MissingFieldResult> {
  try {
    const { makeRequest } = await import("../_core/map");
    const searchQuery = `${companyName} في ${city} السعودية`;
    const data = await makeRequest<{
      results: Array<{
        place_id: string;
        name: string;
        formatted_address?: string;
        rating?: number;
        user_ratings_total?: number;
      }>;
      status: string;
    }>("/maps/api/place/textsearch/json", {
      query: searchQuery,
      language: "ar",
      region: "SA",
    });
    if (!data.results || data.results.length === 0) {
      return { field: "googleMapsUrl", label: FIELD_LABELS.googleMapsUrl, candidates: [], status: "not_found" };
    }
    const candidates = data.results.slice(0, 5).map(r => {
      const mapsUrl = `https://www.google.com/maps/place/?q=place_id:${r.place_id}`;
      return {
        url: mapsUrl,
        displayName: r.name,
        bio: r.formatted_address || "",
        confidence: scoreConfidence(r.name, r.formatted_address || "", companyName, businessType, city),
        source: "Google Maps",
      };
    });
    return { field: "googleMapsUrl", label: FIELD_LABELS.googleMapsUrl, candidates, status: "found" };
  } catch (err: any) {
    return { field: "googleMapsUrl", label: FIELD_LABELS.googleMapsUrl, candidates: [], status: "error", errorMessage: err.message };
  }
}

// ===== خريطة الدوال =====
const SEARCH_FUNCTIONS: Record<string, (name: string, city: string, bt: string) => Promise<MissingFieldResult>> = {
  instagramUrl: searchInstagram,
  tiktokUrl: searchTikTok,
  snapchatUrl: searchSnapchat,
  twitterUrl: searchTwitter,
  facebookUrl: searchFacebook,
  website: searchWebsite,
  googleMapsUrl: searchGoogleMaps,
};

// ===== الحقول التي يمكن البحث عنها =====
const SEARCHABLE_FIELDS = Object.keys(SEARCH_FUNCTIONS);

// ===== Router =====
export const missingFieldsSearchRouter = router({
  /**
   * searchMissingFields
   * يكتشف الحقول المفقودة لعميل محدد ويبحث عنها تلقائياً.
   * يمكن تحديد حقول معينة أو ترك الأمر للاكتشاف التلقائي.
   */
  searchMissingFields: protectedProcedure
    .input(z.object({
      leadId: z.number(),
      // حقول محددة للبحث (اختياري — إذا لم تُحدَّد يبحث عن كل الناقص)
      fields: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      const lead = await getLeadById(input.leadId);
      if (!lead) {
        throw new TRPCError({ code: "NOT_FOUND", message: "العميل غير موجود" });
      }

      const companyName = lead.companyName || "";
      const city = lead.city || "الرياض";
      const businessType = lead.businessType || "";

      if (!companyName) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "اسم النشاط مطلوب للبحث عن النواقص",
        });
      }

      // تحديد الحقول المفقودة
      const missingFields: string[] = [];
      if (!lead.instagramUrl) missingFields.push("instagramUrl");
      if (!lead.tiktokUrl) missingFields.push("tiktokUrl");
      if (!lead.snapchatUrl) missingFields.push("snapchatUrl");
      if (!lead.twitterUrl) missingFields.push("twitterUrl");
      if (!lead.facebookUrl) missingFields.push("facebookUrl");
      if (!lead.website) missingFields.push("website");
      if (!lead.googleMapsUrl) missingFields.push("googleMapsUrl");

      // تطبيق الفلتر إذا حُدِّدت حقول معينة
      const fieldsToSearch = input.fields
        ? input.fields.filter(f => missingFields.includes(f) && SEARCHABLE_FIELDS.includes(f))
        : missingFields.filter(f => SEARCHABLE_FIELDS.includes(f));

      if (fieldsToSearch.length === 0) {
        return {
          leadId: input.leadId,
          companyName,
          city,
          businessType,
          results: [] as MissingFieldResult[],
          totalMissing: missingFields.length,
          totalSearched: 0,
          message: missingFields.length === 0
            ? "جميع البيانات متوفرة — لا يوجد ما يُبحث عنه"
            : "لا توجد حقول قابلة للبحث في القائمة المحددة",
        };
      }

      // تشغيل البحث بشكل متوازٍ مع تأخير بشري بين الطلبات
      const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
      const results: MissingFieldResult[] = [];

      for (let i = 0; i < fieldsToSearch.length; i++) {
        const field = fieldsToSearch[i];
        const fn = SEARCH_FUNCTIONS[field];
        if (!fn) continue;
        if (i > 0) await sleep(600 + Math.random() * 400); // تأخير بشري
        const result = await fn(companyName, city, businessType);
        results.push(result);
      }

      return {
        leadId: input.leadId,
        companyName,
        city,
        businessType,
        results,
        totalMissing: missingFields.length,
        totalSearched: fieldsToSearch.length,
        message: `تم البحث عن ${fieldsToSearch.length} حقل من أصل ${missingFields.length} ناقص`,
      };
    }),

  /**
   * applyMissingFieldResult
   * يحفظ نتيجة مختارة لحقل معين في قاعدة البيانات.
   */
  applyMissingFieldResult: protectedProcedure
    .input(z.object({
      leadId: z.number(),
      field: z.string(),
      value: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const lead = await getLeadById(input.leadId);
      if (!lead) {
        throw new TRPCError({ code: "NOT_FOUND", message: "العميل غير موجود" });
      }

      const allowedFields = [
        "instagramUrl", "tiktokUrl", "snapchatUrl", "twitterUrl",
        "facebookUrl", "website", "googleMapsUrl",
      ];
      if (!allowedFields.includes(input.field)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `الحقل "${input.field}" غير مسموح بتعديله` });
      }

      await updateLead(input.leadId, { [input.field]: input.value } as any);
      return { success: true, field: input.field, value: input.value };
    }),
});
