/**
 * Auto Search Engine — المحرك الذكي المتدرج للبحث التلقائي
 *
 * المبدأ: البحث لا يعمل كـ query واحد، بل كـ pipeline متدرج:
 *   Layer 1: SERP Google (سريع، تغطية ~35%)
 *   Layer 2: Bright Data Dataset API (مباشر داخل المنصات، +25%)
 *   Layer 3: Google Maps Places API (موثوق، +15%)
 *   Layer 4: AI-guided queries (ذكي، يبني استعلامات من النتائج السابقة)
 *
 * الأولويات:
 *   1. الحقول الأساسية أولاً: هاتف، موقع، خرائط
 *   2. المنصات الأعلى احتمالاً: إنستغرام > تيك توك > سناب > فيسبوك > تويتر
 *   3. التحقق من التشابه قبل الحفظ
 *   4. التوقف عند الكفاية أو انتهاء المسارات
 */

import { ENV } from "../_core/env";

// ===== أنواع البيانات =====

export type SearchFieldType =
  | "phone"
  | "website"
  | "googleMapsUrl"
  | "instagramUrl"
  | "tiktokUrl"
  | "snapchatUrl"
  | "facebookUrl"
  | "twitterUrl"
  | "linkedinUrl";

export type SearchLayerType = "serp" | "brightdata_dataset" | "google_maps" | "ai_guided";

export type ConfidenceLevel = "high" | "medium" | "low";

export interface SearchCandidate {
  field: SearchFieldType;
  value: string;
  confidence: ConfidenceLevel;
  confidenceScore: number; // 0-100
  source: SearchLayerType;
  sourceUrl?: string;
  matchReason: string;
  rawData?: Record<string, unknown>;
}

export interface SearchStep {
  stepId: string;
  layer: SearchLayerType;
  field: SearchFieldType;
  query: string;
  status: "pending" | "running" | "done" | "failed" | "skipped";
  startedAt?: number;
  completedAt?: number;
  candidatesFound: number;
  error?: string;
}

export interface AutoSearchSession {
  sessionId: string;
  leadId: number;
  leadName: string;
  leadCity: string;
  leadBusinessType: string;
  status: "idle" | "running" | "paused" | "completed" | "stopped";
  currentLayer: number; // 1-4
  totalSteps: number;
  completedSteps: number;
  steps: SearchStep[];
  candidates: SearchCandidate[];
  appliedFields: SearchFieldType[];
  startedAt: number;
  updatedAt: number;
  stopReason?: string;
  dataCompleteness: number; // 0-100
}

// ===== In-memory session store =====
// في الإنتاج يُستبدل بـ Redis أو DB
const activeSessions = new Map<string, AutoSearchSession>();

// ===== حساب اكتمال البيانات =====
export function computeDataCompleteness(lead: {
  verifiedPhone?: string | null;
  website?: string | null;
  googleMapsUrl?: string | null;
  instagramUrl?: string | null;
  tiktokUrl?: string | null;
  snapchatUrl?: string | null;
  facebookUrl?: string | null;
  twitterUrl?: string | null;
}): number {
  const fields = [
    lead.verifiedPhone,
    lead.website,
    lead.googleMapsUrl,
    lead.instagramUrl,
    lead.tiktokUrl,
    lead.snapchatUrl,
    lead.facebookUrl,
    lead.twitterUrl,
  ];
  const filled = fields.filter(f => f && f.trim().length > 0).length;
  return Math.round((filled / fields.length) * 100);
}

// ===== تحديد الحقول المفقودة بالأولوية =====
export function getMissingFieldsByPriority(lead: {
  verifiedPhone?: string | null;
  website?: string | null;
  googleMapsUrl?: string | null;
  instagramUrl?: string | null;
  tiktokUrl?: string | null;
  snapchatUrl?: string | null;
  facebookUrl?: string | null;
  twitterUrl?: string | null;
}): SearchFieldType[] {
  const priority: SearchFieldType[] = [
    "googleMapsUrl",   // الأعلى موثوقية
    "phone",           // أساسي للتواصل
    "website",         // يُعطي بيانات كثيرة
    "instagramUrl",    // الأعلى انتشاراً في السعودية
    "tiktokUrl",       // الثاني في السعودية
    "snapchatUrl",     // مهم في السعودية
    "facebookUrl",     // للأنشطة الأكبر
    "twitterUrl",      // أقل أولوية
  ];

  return priority.filter(field => {
    if (field === "phone") return !lead.verifiedPhone;
    if (field === "website") return !lead.website;
    if (field === "googleMapsUrl") return !lead.googleMapsUrl;
    if (field === "instagramUrl") return !lead.instagramUrl;
    if (field === "tiktokUrl") return !lead.tiktokUrl;
    if (field === "snapchatUrl") return !lead.snapchatUrl;
    if (field === "facebookUrl") return !lead.facebookUrl;
    if (field === "twitterUrl") return !lead.twitterUrl;
    return false;
  });
}

// ===== حساب درجة الثقة =====
export function computeConfidence(
  candidateName: string,
  candidateBio: string,
  leadName: string,
  leadCity: string,
  leadBusinessType: string
): { level: ConfidenceLevel; score: number; reason: string } {
  let score = 0;
  const reasons: string[] = [];

  const normalize = (s: string) => s.toLowerCase().replace(/[\s\-_]/g, "");
  const normLead = normalize(leadName);
  const normCandidate = normalize(candidateName);
  const normBio = normalize(candidateBio || "");
  const normCity = normalize(leadCity);
  const normType = normalize(leadBusinessType);

  // تطابق الاسم
  if (normCandidate === normLead) {
    score += 40;
    reasons.push("تطابق كامل في الاسم");
  } else if (normCandidate.includes(normLead) || normLead.includes(normCandidate)) {
    score += 25;
    reasons.push("تطابق جزئي في الاسم");
  } else {
    // تطابق كلمات
    const leadWords = leadName.split(/\s+/).filter(w => w.length > 2);
    const matchedWords = leadWords.filter(w => normCandidate.includes(normalize(w)));
    if (matchedWords.length >= 2) {
      score += 15;
      reasons.push(`تطابق ${matchedWords.length} كلمات`);
    } else if (matchedWords.length === 1) {
      score += 5;
      reasons.push("تطابق كلمة واحدة");
    }
  }

  // المدينة في الـ bio
  if (normBio.includes(normCity)) {
    score += 20;
    reasons.push("المدينة مذكورة في الوصف");
  }

  // نوع النشاط في الـ bio
  const typeWords = leadBusinessType.split(/[\s,،]+/).filter(w => w.length > 2);
  const matchedTypeWords = typeWords.filter(w => normBio.includes(normalize(w)));
  if (matchedTypeWords.length > 0) {
    score += 15;
    reasons.push("نوع النشاط مذكور في الوصف");
  }

  // حساب تجاري
  if (normBio.includes("business") || normBio.includes("تجاري") || normBio.includes("خدمات")) {
    score += 10;
    reasons.push("حساب تجاري");
  }

  // اسم المدينة في اسم الحساب
  if (normCandidate.includes(normCity)) {
    score += 10;
    reasons.push("المدينة في اسم الحساب");
  }

  const level: ConfidenceLevel = score >= 60 ? "high" : score >= 35 ? "medium" : "low";
  return { level, score, reason: reasons.join(" · ") || "تطابق محدود" };
}

// ===== بناء استعلامات SERP =====
function buildSerpQueries(
  leadName: string,
  leadCity: string,
  leadBusinessType: string,
  field: SearchFieldType
): string[] {
  const queries: string[] = [];

  switch (field) {
    case "instagramUrl":
      queries.push(`"${leadName}" "${leadCity}" site:instagram.com`);
      queries.push(`${leadName} ${leadCity} instagram`);
      queries.push(`${leadBusinessType} "${leadName}" instagram.com`);
      break;
    case "tiktokUrl":
      queries.push(`"${leadName}" site:tiktok.com`);
      queries.push(`${leadName} ${leadCity} tiktok`);
      break;
    case "snapchatUrl":
      queries.push(`"${leadName}" site:snapchat.com`);
      queries.push(`${leadName} ${leadCity} snapchat`);
      break;
    case "facebookUrl":
      queries.push(`"${leadName}" site:facebook.com`);
      queries.push(`${leadName} ${leadCity} facebook`);
      break;
    case "twitterUrl":
      queries.push(`"${leadName}" site:twitter.com OR site:x.com`);
      break;
    case "website":
      queries.push(`"${leadName}" "${leadCity}" موقع رسمي`);
      queries.push(`${leadName} ${leadBusinessType} ${leadCity} site`);
      break;
    case "googleMapsUrl":
      queries.push(`"${leadName}" "${leadCity}" خرائط google`);
      queries.push(`${leadName} ${leadCity} google maps`);
      break;
    case "phone":
      queries.push(`"${leadName}" "${leadCity}" هاتف OR تواصل OR جوال`);
      queries.push(`${leadName} ${leadCity} phone contact`);
      break;
    default:
      queries.push(`"${leadName}" "${leadCity}"`);
  }

  return queries;
}

// ===== Layer 1: SERP Search =====
async function searchViaSERP(
  query: string,
  field: SearchFieldType,
  leadName: string,
  leadCity: string,
  leadBusinessType: string
): Promise<SearchCandidate[]> {
  try {
    const apiToken = ENV.brightDataApiToken;
    const serpZone = ENV.brightDataSerpZone || "serp_api1";

    if (!apiToken) {
      return [];
    }

    const targetUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=5&hl=ar&gl=sa`;

    const response = await fetch("https://api.brightdata.com/request", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiToken}`,
      },
      body: JSON.stringify({
        zone: serpZone,
        url: targetUrl,
        format: "raw",
      }),
      signal: AbortSignal.timeout(35000),
    });

    if (!response.ok) return [];

    const html = await response.text();
    const candidates: SearchCandidate[] = [];

    // استخراج روابط السوشيال ميديا من HTML
    const platformPatterns: Record<SearchFieldType, RegExp> = {
      instagramUrl: /https?:\/\/(?:www\.)?instagram\.com\/([a-zA-Z0-9._]+)\/?/g,
      tiktokUrl: /https?:\/\/(?:www\.)?tiktok\.com\/@([a-zA-Z0-9._]+)\/?/g,
      snapchatUrl: /https?:\/\/(?:www\.)?snapchat\.com\/add\/([a-zA-Z0-9._]+)\/?/g,
      facebookUrl: /https?:\/\/(?:www\.)?facebook\.com\/([a-zA-Z0-9._]+)\/?/g,
      twitterUrl: /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/([a-zA-Z0-9._]+)\/?/g,
      website: /https?:\/\/(?!(?:www\.)?(?:google|instagram|tiktok|snapchat|facebook|twitter|x)\.com)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\/?/g,
      googleMapsUrl: /https?:\/\/(?:maps\.google\.com|www\.google\.com\/maps)[^\s"<>]*/g,
      phone: /(?:\+966|0096|966)?[- ]?(?:05|5)[0-9]{8}/g,
      linkedinUrl: /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/([a-zA-Z0-9._-]+)\/?/g,
    };

    const pattern = platformPatterns[field];
    if (!pattern) return [];

    const matchesArr: string[] = [];
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(html)) !== null) {
      if (!matchesArr.includes(match[0])) matchesArr.push(match[0]);
    }

    for (const url of matchesArr) {
      // تجاهل الروابط العامة
      if (url.includes("/explore/") || url.includes("/p/") || url.includes("/reel/")) continue;

      const username = url.split("/").filter(Boolean).pop() || "";
      const { level, score, reason } = computeConfidence(
        username, "", leadName, leadCity, leadBusinessType
      );

      if (score >= 5) { // حد أدنى
        candidates.push({
          field,
          value: url,
          confidence: level,
          confidenceScore: score,
          source: "serp",
          sourceUrl: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
          matchReason: reason,
        });
      }
    }

    return candidates;
  } catch {
    return [];
  }
}

// ===== Layer 2: Bright Data Dataset API =====
async function searchViaBrightData(
  leadName: string,
  leadCity: string,
  leadBusinessType: string,
  field: SearchFieldType
): Promise<SearchCandidate[]> {
  try {
    const apiKey = ENV.brightDataApiToken;
    if (!apiKey) return [];

    // فقط إنستغرام متاح حالياً عبر Keyword Search
    if (field !== "instagramUrl") return [];

    const { searchInstagramByKeyword } = await import("./brightDataInstagram");
    const keyword = `${leadName} ${leadCity}`;
    const result = await searchInstagramByKeyword(keyword, leadCity, 10);

    if (!result.success || result.results.length === 0) return [];

    return result.results.map(profile => {
      const { level, score, reason } = computeConfidence(
        profile.full_name || profile.username,
        profile.biography || "",
        leadName,
        leadCity,
        leadBusinessType
      );

      return {
        field: "instagramUrl" as SearchFieldType,
        value: profile.profile_url || `https://www.instagram.com/${profile.username}/`,
        confidence: level,
        confidenceScore: score,
        source: "brightdata_dataset" as SearchLayerType,
        matchReason: reason,
        rawData: {
          username: profile.username,
          followers: profile.followers,
          bio: profile.biography,
          isBusinessAccount: profile.is_business_account,
          businessCategory: profile.business_category,
        },
      };
    }).filter(c => c.confidenceScore >= 10);
  } catch {
    return [];
  }
}

// ===== Layer 3: Google Maps Places API =====
async function searchViaGoogleMaps(
  leadName: string,
  leadCity: string,
  leadBusinessType: string,
  field: SearchFieldType
): Promise<SearchCandidate[]> {
  try {
    const { makeRequest } = await import("../_core/map");

    // البحث عن النشاط في Google Maps
    const searchQuery = `${leadName} ${leadCity} السعودية`;
    const data = await makeRequest<{
      results: Array<{
        place_id: string;
        name: string;
        formatted_address: string;
        geometry: { location: { lat: number; lng: number } };
        rating?: number;
        user_ratings_total?: number;
      }>;
      status: string;
    }>("/maps/api/place/textsearch/json", {
      query: searchQuery,
      language: "ar",
      region: "SA",
    });

    if (data.status !== "OK" || !data.results?.length) return [];

    const candidates: SearchCandidate[] = [];

    // جلب تفاصيل أفضل نتيجة
    const topPlace = data.results[0];
    const { level, score, reason } = computeConfidence(
      topPlace.name, topPlace.formatted_address,
      leadName, leadCity, leadBusinessType
    );

    if (score < 10) return [];

    // جلب التفاصيل الكاملة
    const details = await makeRequest<{
      result: {
        place_id: string;
        name: string;
        formatted_phone_number?: string;
        international_phone_number?: string;
        website?: string;
        url?: string;
      };
      status: string;
    }>("/maps/api/place/details/json", {
      place_id: topPlace.place_id,
      fields: "place_id,name,formatted_phone_number,international_phone_number,website,url",
      language: "ar",
    });

    if (details.status !== "OK") return [];

    const placeDetails = details.result;

    // إضافة Google Maps URL
    if (field === "googleMapsUrl" && placeDetails.url) {
      candidates.push({
        field: "googleMapsUrl",
        value: placeDetails.url,
        confidence: level,
        confidenceScore: score,
        source: "google_maps",
        matchReason: reason + " (Google Maps)",
      });
    }

    // إضافة الموقع الإلكتروني
    if (field === "website" && placeDetails.website) {
      candidates.push({
        field: "website",
        value: placeDetails.website,
        confidence: level,
        confidenceScore: score,
        source: "google_maps",
        matchReason: reason + " (من Google Business Profile)",
      });
    }

    // إضافة رقم الهاتف
    if (field === "phone" && (placeDetails.international_phone_number || placeDetails.formatted_phone_number)) {
      const phone = placeDetails.international_phone_number || placeDetails.formatted_phone_number || "";
      candidates.push({
        field: "phone",
        value: phone.replace(/\s/g, ""),
        confidence: level,
        confidenceScore: score,
        source: "google_maps",
        matchReason: reason + " (من Google Business Profile)",
      });
    }

    return candidates;
  } catch {
    return [];
  }
}

// ===== Layer 4: AI-Guided Search =====
async function searchViaAI(
  leadName: string,
  leadCity: string,
  leadBusinessType: string,
  field: SearchFieldType,
  previousCandidates: SearchCandidate[]
): Promise<SearchCandidate[]> {
  try {
    const { invokeLLM } = await import("../_core/llm");

    // بناء سياق من النتائج السابقة
    const context = previousCandidates.length > 0
      ? `النتائج السابقة: ${previousCandidates.map(c => `${c.value} (${c.confidenceScore}%)`).join(", ")}`
      : "لم تُعثر على نتائج في الطبقات السابقة";

    const fieldNames: Record<SearchFieldType, string> = {
      instagramUrl: "حساب إنستغرام",
      tiktokUrl: "حساب تيك توك",
      snapchatUrl: "حساب سناب شات",
      facebookUrl: "صفحة فيسبوك",
      twitterUrl: "حساب تويتر",
      website: "الموقع الإلكتروني",
      googleMapsUrl: "رابط Google Maps",
      phone: "رقم الهاتف",
      linkedinUrl: "صفحة LinkedIn",
    };

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `أنت محلل بيانات متخصص في البحث عن الأنشطة التجارية السعودية. 
          مهمتك: اقترح استعلامات بحث دقيقة للعثور على ${fieldNames[field]} للنشاط التجاري المحدد.
          أجب بـ JSON فقط: { "queries": ["استعلام1", "استعلام2"], "reasoning": "سبب الاقتراح" }`,
        },
        {
          role: "user",
          content: `النشاط: ${leadName}
النوع: ${leadBusinessType}
المدينة: ${leadCity}
${context}
اقترح 2-3 استعلامات بحث مختلفة للعثور على ${fieldNames[field]}.`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "search_queries",
          strict: true,
          schema: {
            type: "object",
            properties: {
              queries: { type: "array", items: { type: "string" } },
              reasoning: { type: "string" },
            },
            required: ["queries", "reasoning"],
            additionalProperties: false,
          },
        },
      },
    });

    const rawContent = response.choices?.[0]?.message?.content;
    const content = typeof rawContent === "string" ? rawContent : null;
    if (!content) return [];

    const parsed = JSON.parse(content) as { queries: string[]; reasoning: string };

    // تنفيذ الاستعلامات المقترحة عبر SERP
    const allCandidates: SearchCandidate[] = [];
    for (const query of parsed.queries.slice(0, 2)) {
      const results = await searchViaSERP(query, field, leadName, leadCity, leadBusinessType);
      allCandidates.push(...results);
    }

    return allCandidates;
  } catch {
    return [];
  }
}

// ===== إنشاء session جديد =====
export function createSearchSession(lead: {
  id: number;
  companyName: string;
  city: string;
  businessType: string;
  verifiedPhone?: string | null;
  website?: string | null;
  googleMapsUrl?: string | null;
  instagramUrl?: string | null;
  tiktokUrl?: string | null;
  snapchatUrl?: string | null;
  facebookUrl?: string | null;
  twitterUrl?: string | null;
}): AutoSearchSession {
  const sessionId = `auto_${lead.id}_${Date.now()}`;
  const missingFields = getMissingFieldsByPriority(lead);

  // بناء خطوات البحث
  const steps: SearchStep[] = [];
  for (const field of missingFields) {
    // Layer 1: SERP
    const serpQueries = buildSerpQueries(lead.companyName, lead.city, lead.businessType, field);
    steps.push({
      stepId: `${field}_serp`,
      layer: "serp",
      field,
      query: serpQueries[0],
      status: "pending",
      candidatesFound: 0,
    });

    // Layer 2: Bright Data (فقط للإنستغرام)
    if (field === "instagramUrl") {
      steps.push({
        stepId: `${field}_brightdata`,
        layer: "brightdata_dataset",
        field,
        query: `${lead.companyName} ${lead.city}`,
        status: "pending",
        candidatesFound: 0,
      });
    }

    // Layer 3: Google Maps (للهاتف والموقع والخرائط)
    if (["phone", "website", "googleMapsUrl"].includes(field)) {
      steps.push({
        stepId: `${field}_maps`,
        layer: "google_maps",
        field,
        query: `${lead.companyName} ${lead.city}`,
        status: "pending",
        candidatesFound: 0,
      });
    }
  }

  const session: AutoSearchSession = {
    sessionId,
    leadId: lead.id,
    leadName: lead.companyName,
    leadCity: lead.city,
    leadBusinessType: lead.businessType,
    status: "idle",
    currentLayer: 1,
    totalSteps: steps.length,
    completedSteps: 0,
    steps,
    candidates: [],
    appliedFields: [],
    startedAt: Date.now(),
    updatedAt: Date.now(),
    dataCompleteness: computeDataCompleteness(lead),
  };

  activeSessions.set(sessionId, session);
  return session;
}

// ===== تشغيل خطوة واحدة =====
async function runStep(
  session: AutoSearchSession,
  step: SearchStep
): Promise<SearchCandidate[]> {
  step.status = "running";
  step.startedAt = Date.now();

  try {
    let candidates: SearchCandidate[] = [];

    switch (step.layer) {
      case "serp":
        candidates = await searchViaSERP(
          step.query, step.field,
          session.leadName, session.leadCity, session.leadBusinessType
        );
        break;
      case "brightdata_dataset":
        candidates = await searchViaBrightData(
          session.leadName, session.leadCity, session.leadBusinessType, step.field
        );
        break;
      case "google_maps":
        candidates = await searchViaGoogleMaps(
          session.leadName, session.leadCity, session.leadBusinessType, step.field
        );
        break;
      case "ai_guided":
        candidates = await searchViaAI(
          session.leadName, session.leadCity, session.leadBusinessType,
          step.field, session.candidates.filter(c => c.field === step.field)
        );
        break;
    }

    step.status = "done";
    step.completedAt = Date.now();
    step.candidatesFound = candidates.length;
    return candidates;
  } catch (err) {
    step.status = "failed";
    step.completedAt = Date.now();
    step.error = err instanceof Error ? err.message : String(err);
    return [];
  }
}

// ===== تشغيل الجلسة الكاملة =====
export async function runAutoSearchSession(
  sessionId: string,
  onProgress?: (session: AutoSearchSession) => void
): Promise<AutoSearchSession> {
  const session = activeSessions.get(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);

  session.status = "running";
  session.updatedAt = Date.now();

  for (const step of session.steps) {
    // التحقق من إيقاف الجلسة
    const current = activeSessions.get(sessionId);
    if (!current || current.status === "stopped" || current.status === "paused") {
      session.status = current?.status || "stopped";
      break;
    }

    // تخطي الخطوات المكتملة
    if (step.status === "done" || step.status === "skipped") {
      session.completedSteps++;
      continue;
    }

    // التحقق: هل الحقل تم إيجاده بثقة عالية؟
    const fieldAlreadyFound = session.candidates.some(
      c => c.field === step.field && c.confidence === "high"
    );
    if (fieldAlreadyFound) {
      step.status = "skipped";
      session.completedSteps++;
      onProgress?.(session);
      continue;
    }

    // تشغيل الخطوة
    const candidates = await runStep(session, step);

    // إضافة المرشحين الجدد (تجنب التكرار)
    for (const candidate of candidates) {
      const isDuplicate = session.candidates.some(
        c => c.field === candidate.field && c.value === candidate.value
      );
      if (!isDuplicate) {
        session.candidates.push(candidate);
      }
    }

    session.completedSteps++;
    session.updatedAt = Date.now();
    onProgress?.(session);

    // تأخير بسيط لتجنب rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  // تحديد سبب الإيقاف
  if (session.status === "running") {
    const allFieldsFound = getMissingFieldsByPriority({
      verifiedPhone: session.appliedFields.includes("phone") ? "found" : null,
      website: session.appliedFields.includes("website") ? "found" : null,
      googleMapsUrl: session.appliedFields.includes("googleMapsUrl") ? "found" : null,
      instagramUrl: session.appliedFields.includes("instagramUrl") ? "found" : null,
      tiktokUrl: session.appliedFields.includes("tiktokUrl") ? "found" : null,
      snapchatUrl: session.appliedFields.includes("snapchatUrl") ? "found" : null,
      facebookUrl: session.appliedFields.includes("facebookUrl") ? "found" : null,
      twitterUrl: session.appliedFields.includes("twitterUrl") ? "found" : null,
    }).length === 0;

    session.status = "completed";
    session.stopReason = allFieldsFound
      ? "تم العثور على جميع البيانات المطلوبة"
      : "تم استنفاد جميع مسارات البحث المتاحة";
  }

  session.updatedAt = Date.now();
  activeSessions.set(sessionId, session);
  return session;
}

// ===== إيقاف الجلسة =====
export function stopSearchSession(sessionId: string): boolean {
  const session = activeSessions.get(sessionId);
  if (!session) return false;
  session.status = "stopped";
  session.stopReason = "أوقفه المستخدم";
  session.updatedAt = Date.now();
  activeSessions.set(sessionId, session);
  return true;
}

// ===== إيقاف مؤقت =====
export function pauseSearchSession(sessionId: string): boolean {
  const session = activeSessions.get(sessionId);
  if (!session || session.status !== "running") return false;
  session.status = "paused";
  session.updatedAt = Date.now();
  activeSessions.set(sessionId, session);
  return true;
}

// ===== جلب حالة الجلسة =====
export function getSearchSession(sessionId: string): AutoSearchSession | null {
  return activeSessions.get(sessionId) || null;
}

// ===== جلب جميع جلسات عميل =====
export function getLeadSessions(leadId: number): AutoSearchSession[] {
  const allSessions: AutoSearchSession[] = [];
  activeSessions.forEach((s) => allSessions.push(s));
  return allSessions
    .filter(s => s.leadId === leadId)
    .sort((a, b) => b.startedAt - a.startedAt);
}

// ===== تنظيف الجلسات القديمة =====
export function cleanupOldSessions(maxAgeMs = 24 * 60 * 60 * 1000): void {
  const cutoff = Date.now() - maxAgeMs;
  const toDelete: string[] = [];
  activeSessions.forEach((session, id) => {
    if (session.updatedAt < cutoff) toDelete.push(id);
  });
  for (const id of toDelete) {
    activeSessions.delete(id);
  }
}
