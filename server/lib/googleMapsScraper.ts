/**
 * Google Maps Scraping المباشر عبر Bright Data
 * يجلب بيانات أكثر من Places API: صور، Q&A، منشورات، ساعات عمل تفصيلية
 * 
 * Strategy:
 * 1. Primary: Bright Data SERP API لجلب نتائج Google Maps
 * 2. Fallback: Google Places API الرسمي
 */
import { ENV } from "../_core/env";
import { serpRequest } from "../routers/serpSearch";

export interface GoogleMapsBusinessData {
  placeId?: string;
  name: string;
  address: string;
  phone?: string;
  internationalPhone?: string;
  website?: string;
  rating?: number;
  reviewsCount?: number;
  category?: string;
  categories?: string[];
  openNow?: boolean;
  hours?: string[];
  googleMapsUrl?: string;
  latitude?: number;
  longitude?: number;
  // بيانات إضافية غير متاحة في Places API
  priceLevel?: string;
  photos?: string[];
  description?: string;
  instagramHandle?: string;
  facebookUrl?: string;
  whatsappNumber?: string;
  // مراجعات Google Maps
  reviews?: Array<{ author: string; rating: number; text: string; time: string }>;
  // مصدر البيانات
  dataSource: "maps_scraping" | "places_api" | "serp";
}

export interface GoogleMapsScrapeResult {
  success: boolean;
  results: GoogleMapsBusinessData[];
  total: number;
  query: string;
  error?: string;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ===== Google Maps SERP Scraping =====
// يستخدم Bright Data SERP proxy لجلب نتائج Google Maps
async function scrapeGoogleMapsViaSERP(
  query: string,
  location: string
): Promise<GoogleMapsBusinessData[]> {
  const searchQuery = `${query} ${location} موقع Google Maps`;
  const mapsQuery = `${query} ${location}`;

  // محاولة جلب نتائج Google Maps عبر SERP
  const urls = [
    `https://www.google.com/maps/search/${encodeURIComponent(mapsQuery)}?hl=ar&gl=sa`,
    `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&num=20&hl=ar&gl=sa`,
  ];

  const results: GoogleMapsBusinessData[] = [];
  const seen = new Set<string>();

  for (const url of urls) {
    try {
      const html = await serpRequest(url, 2);
      const extracted = extractBusinessesFromHTML(html, query);
      
      for (const biz of extracted) {
        const key = biz.phone || biz.name;
        if (!seen.has(key)) {
          seen.add(key);
          results.push(biz);
        }
      }

      if (results.length >= 20) break;
      await sleep(800);
    } catch (err) {
      console.warn(`[Maps SERP] Failed for ${url.slice(0, 60)}:`, err);
    }
  }

  return results;
}

// ===== استخراج بيانات الأعمال من HTML =====
function extractBusinessesFromHTML(html: string, query: string): GoogleMapsBusinessData[] {
  const results: GoogleMapsBusinessData[] = [];

  // استخراج أرقام الهاتف السعودية
  const phoneRegex = /(?:\+966|00966|0)(?:5[0-9]{8}|[1-9][0-9]{7})/g;
  const phones = html.match(phoneRegex) || [];

  // استخراج المواقع الإلكترونية
  const websiteRegex = /https?:\/\/(?!(?:www\.)?google|goo\.gl|maps\.google)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s"<>]*)?/g;
  const websites = (html.match(websiteRegex) || []).filter(w =>
    !w.includes("google") &&
    !w.includes("gstatic") &&
    !w.includes("googleapis") &&
    !w.includes("schema.org") &&
    !w.includes("w3.org")
  );

  // استخراج التقييمات
  const ratingRegex = /(\d+\.?\d*)\s*(?:نجوم|stars?|تقييم|rated)/gi;
  const ratings = html.match(ratingRegex) || [];

  // استخراج أسماء الأعمال من h3 و h2
  const nameRegex = /<h[23][^>]*>([^<]{3,80})<\/h[23]>/gi;
  const names: string[] = [];
  let nameMatch;
  while ((nameMatch = nameRegex.exec(html)) !== null) {
    const name = nameMatch[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
    if (name && name.length > 2 && name.length < 80 && !name.includes("Google")) {
      names.push(name);
    }
  }

  // بناء نتائج من البيانات المستخرجة
  const maxResults = Math.max(names.length, phones.length, 1);
  for (let i = 0; i < Math.min(maxResults, 10); i++) {
    const name = names[i] || `${query} ${i + 1}`;
    const phone = phones[i] || undefined;
    const website = websites[i] || undefined;

    if (name && (phone || website)) {
      results.push({
        name,
        address: "",
        phone: phone ? normalizePhone(phone) : undefined,
        website,
        dataSource: "serp",
      });
    }
  }

  return results;
}

// ===== Google Places API كـ Fallback =====
async function fetchFromPlacesAPI(
  query: string,
  location: string
): Promise<GoogleMapsBusinessData[]> {
  try {
    const { makeRequest } = await import("../_core/map");

    // Text Search
    const searchData = await makeRequest<{
      results: Array<{
        place_id: string;
        name: string;
        formatted_address: string;
        rating?: number;
        user_ratings_total?: number;
        geometry: { location: { lat: number; lng: number } };
        types?: string[];
        opening_hours?: { open_now: boolean };
        price_level?: number;
        photos?: Array<{ photo_reference: string }>;
      }>;
      status: string;
      next_page_token?: string;
    }>("/maps/api/place/textsearch/json", {
      query: `${query} ${location}`,
      language: "ar",
      region: "sa",
    });

    if (searchData.status !== "OK" && searchData.status !== "ZERO_RESULTS") {
      throw new Error(`Places API error: ${searchData.status}`);
    }

    const places = searchData.results || [];
    const results: GoogleMapsBusinessData[] = [];

    // جلب تفاصيل أول 10 أماكن
    for (const place of places.slice(0, 10)) {
      try {
        const detailData = await makeRequest<{
          result: {
            place_id: string;
            name: string;
            formatted_address: string;
            formatted_phone_number?: string;
            international_phone_number?: string;
            website?: string;
            rating?: number;
            user_ratings_total?: number;
            geometry: { location: { lat: number; lng: number } };
            types?: string[];
            opening_hours?: { open_now: boolean; weekday_text: string[] };
            url?: string;
            price_level?: number;
            reviews?: Array<{ author_name: string; rating: number; text: string; time?: number }>;
          };
          status: string;
        }>("/maps/api/place/details/json", {
          place_id: place.place_id,
          fields: "place_id,name,formatted_address,formatted_phone_number,international_phone_number,website,rating,user_ratings_total,geometry,types,opening_hours,url,price_level,reviews",
          language: "ar",
        });

        if (detailData.status === "OK" && detailData.result) {
          const r = detailData.result;
          const priceLabels = ["", "رخيص", "متوسط", "مرتفع", "فاخر"];

          results.push({
            placeId: r.place_id,
            name: r.name,
            address: r.formatted_address,
            phone: r.formatted_phone_number,
            internationalPhone: r.international_phone_number,
            website: r.website,
            rating: r.rating,
            reviewsCount: r.user_ratings_total,
            category: r.types?.[0],
            categories: r.types,
            openNow: r.opening_hours?.open_now,
            hours: r.opening_hours?.weekday_text,
            googleMapsUrl: r.url,
            latitude: r.geometry?.location?.lat,
            longitude: r.geometry?.location?.lng,
            priceLevel: r.price_level ? priceLabels[r.price_level] : undefined,
            reviews: (r.reviews || []).slice(0, 5).map((rv) => ({
              author: rv.author_name || "",
              rating: rv.rating || 0,
              text: rv.text || "",
              time: rv.time ? new Date(rv.time * 1000).toISOString().split("T")[0] : "",
            })),
            dataSource: "places_api",
          });
        }

        await sleep(300); // تجنب rate limiting
      } catch (err) {
        console.warn(`[Places API] Failed to get details for ${place.place_id}:`, err);
      }
    }

    return results;
  } catch (err) {
    console.error("[Places API] Error:", err);
    return [];
  }
}

// ===== Main: Google Maps Scraping =====
export async function scrapeGoogleMaps(
  query: string,
  location: string,
  preferScraping = true
): Promise<GoogleMapsScrapeResult> {
  const fullQuery = `${query} ${location}`;
  console.log(`[Google Maps] Searching: "${fullQuery}"`);

  try {
    let results: GoogleMapsBusinessData[] = [];

    if (preferScraping) {
      // المحاولة الأولى: SERP Scraping
      try {
        results = await scrapeGoogleMapsViaSERP(query, location);
        console.log(`[Google Maps SERP] Found ${results.length} results`);
      } catch (serpErr) {
        console.warn("[Google Maps SERP] Failed, falling back to Places API:", serpErr);
      }
    }

    // إذا لم تكتمل النتائج، استخدم Places API
    if (results.length < 5) {
      const placesResults = await fetchFromPlacesAPI(query, location);
      console.log(`[Google Maps Places] Found ${placesResults.length} results`);

      // دمج النتائج مع إزالة التكرار
      const seen = new Set(results.map(r => r.phone || r.name));
      for (const place of placesResults) {
        const key = place.phone || place.name;
        if (!seen.has(key)) {
          seen.add(key);
          results.push(place);
        }
      }
    }

    return {
      success: true,
      results,
      total: results.length,
      query: fullQuery,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[Google Maps] Error: ${error}`);
    return {
      success: false,
      results: [],
      total: 0,
      query: fullQuery,
      error,
    };
  }
}

// ===== Helper: تطبيع رقم الهاتف =====
function normalizePhone(phone: string): string {
  // تحويل +966 أو 00966 إلى 05...
  let normalized = phone.trim();
  if (normalized.startsWith("+966")) {
    normalized = "0" + normalized.slice(4);
  } else if (normalized.startsWith("00966")) {
    normalized = "0" + normalized.slice(5);
  }
  return normalized;
}
