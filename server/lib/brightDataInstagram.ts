/**
 * Bright Data Dataset API - Instagram Profiles
 * يستخدم Web Scraper API الرسمي لجلب بيانات إنستغرام بشكل موثوق
 * 
 * Flow:
 * 1. Trigger: POST /datasets/v3/trigger?dataset_id=gd_l1vikfch901nx3by4
 * 2. Returns: snapshot_id
 * 3. Poll: GET /datasets/v3/snapshot/{snapshot_id}?format=json
 * 4. Returns: full Instagram profile data
 */

import { ENV } from "../_core/env";

// ===== Instagram Dataset ID =====
// gd_l1vikfch901nx3by4 = Instagram Profiles Scraper
const INSTAGRAM_DATASET_ID = "gd_l1vikfch901nx3by4";
const BRIGHT_DATA_API_BASE = "https://api.brightdata.com";

// ===== Types =====
export interface InstagramDatasetProfile {
  // Profile basics
  username: string;
  full_name: string;
  biography: string;
  profile_url: string;
  profile_image_link: string;

  // Metrics
  followers: number;
  following: number;
  posts_count: number;
  avg_engagement: number;

  // Account type
  is_verified: boolean;
  is_business_account: boolean;
  is_professional_account: boolean;
  account_type?: string;

  // Business info
  business_category?: string;
  business_email?: string;
  business_phone?: string;
  website?: string;

  // Recent posts
  posts?: Array<{
    url: string;
    description: string;
    likes: number;
    comments: number;
    timestamp: string;
    image_url?: string;
  }>;

  // Raw data
  input?: { url: string };
  error?: string;
}

export interface InstagramDatasetResult {
  success: boolean;
  profile?: InstagramDatasetProfile;
  snapshotId?: string;
  error?: string;
  usedDatasetApi: boolean;
}

// ===== Helper: HTTP Request =====
async function brightDataRequest(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  timeoutMs = 90000
): Promise<unknown> {
  const apiKey = ENV.brightDataApiToken;
  if (!apiKey) {
    throw new Error("BRIGHT_DATA_API_TOKEN not configured");
  }

  const url = `${BRIGHT_DATA_API_BASE}${path}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Bright Data API error ${response.status}: ${errorText}`);
    }

    const text = await response.text();
    if (!text.trim()) return null;

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// ===== Step 1: Trigger Collection =====
async function triggerInstagramCollection(profileUrl: string): Promise<string> {
  // تنظيف الرابط
  const cleanUrl = normalizeInstagramUrl(profileUrl);

  const result = await brightDataRequest(
    "POST",
    `/datasets/v3/trigger?dataset_id=${INSTAGRAM_DATASET_ID}&format=json&uncompressed_webhook=true`,
    [{ url: cleanUrl }]
  ) as { snapshot_id: string };

  if (!result?.snapshot_id) {
    throw new Error("No snapshot_id returned from Bright Data trigger");
  }

  console.log(`[BD Instagram] Triggered collection for ${cleanUrl}, snapshot: ${result.snapshot_id}`);
  return result.snapshot_id;
}

// ===== Step 2: Poll for Results =====
async function pollInstagramSnapshot(
  snapshotId: string,
  maxWaitMs = 120000,
  pollIntervalMs = 5000
): Promise<InstagramDatasetProfile[]> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const result = await brightDataRequest(
        "GET",
        `/datasets/v3/snapshot/${snapshotId}?format=json`,
        undefined,
        20000
      );

      // إذا كانت النتيجة array، فالبيانات جاهزة
      if (Array.isArray(result) && result.length > 0) {
        console.log(`[BD Instagram] Snapshot ${snapshotId} ready with ${result.length} records`);
        return result as InstagramDatasetProfile[];
      }

      // إذا كانت object مع status
      if (result && typeof result === "object" && !Array.isArray(result)) {
        const status = (result as any).status;
        if (status === "running" || status === "pending" || status === "initializing") {
          console.log(`[BD Instagram] Snapshot ${snapshotId} status: ${status}, waiting...`);
          await sleep(pollIntervalMs);
          continue;
        }
        if (status === "failed") {
          throw new Error(`Snapshot ${snapshotId} failed: ${JSON.stringify(result)}`);
        }
      }

      // إذا كانت string (NDJSON)
      if (typeof result === "string" && result.trim()) {
        const lines = result.trim().split("\n").filter(l => l.trim());
        const profiles = lines.map(line => {
          try { return JSON.parse(line); } catch { return null; }
        }).filter(Boolean);
        if (profiles.length > 0) return profiles as InstagramDatasetProfile[];
      }

      // انتظر وحاول مجدداً
      await sleep(pollIntervalMs);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      // إذا كان الخطأ "not ready" فانتظر
      if (errMsg.includes("not ready") || errMsg.includes("processing") || errMsg.includes("404")) {
        await sleep(pollIntervalMs);
        continue;
      }
      throw err;
    }
  }

  throw new Error(`Snapshot ${snapshotId} timed out after ${maxWaitMs / 1000}s`);
}

// ===== Main: Fetch Instagram Profile via Dataset API =====
export async function fetchInstagramViaDatasetAPI(
  profileUrl: string
): Promise<InstagramDatasetResult> {
  try {
    // الخطوة 1: Trigger
    const snapshotId = await triggerInstagramCollection(profileUrl);

    // الخطوة 2: Poll
    const profiles = await pollInstagramSnapshot(snapshotId);

    if (!profiles || profiles.length === 0) {
      return {
        success: false,
        snapshotId,
        error: "No data returned from Dataset API",
        usedDatasetApi: true,
      };
    }

    const profile = profiles[0];

    return {
      success: true,
      profile,
      snapshotId,
      usedDatasetApi: true,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[BD Instagram Dataset API] Error: ${error}`);
    return {
      success: false,
      error,
      usedDatasetApi: true,
    };
  }
}

// ===== Format for LLM =====
export function formatInstagramDataForLLM(profile: InstagramDatasetProfile): string {
  const parts: string[] = [
    `=== بيانات إنستغرام الحقيقية (Bright Data Dataset API) ===`,
    `الاسم الكامل: ${profile.full_name || profile.username}`,
    `اسم المستخدم: @${profile.username}`,
    `البيو: ${profile.biography || "لا يوجد"}`,
    `المتابعون: ${(profile.followers || 0).toLocaleString("ar-SA")}`,
    `يتابع: ${(profile.following || 0).toLocaleString("ar-SA")}`,
    `عدد المنشورات: ${(profile.posts_count || 0).toLocaleString("ar-SA")}`,
    `متوسط التفاعل: ${profile.avg_engagement ? `${(profile.avg_engagement * 100).toFixed(2)}%` : "غير محدد"}`,
    `موثّق: ${profile.is_verified ? "نعم ✓" : "لا"}`,
    `حساب تجاري: ${profile.is_business_account ? "نعم" : "لا"}`,
  ];

  if (profile.business_category) {
    parts.push(`الفئة التجارية: ${profile.business_category}`);
  }
  if (profile.business_email) {
    parts.push(`البريد الإلكتروني: ${profile.business_email}`);
  }
  if (profile.business_phone) {
    parts.push(`رقم الهاتف: ${profile.business_phone}`);
  }
  if (profile.website) {
    parts.push(`الموقع الإلكتروني: ${profile.website}`);
  }

  if (profile.posts && profile.posts.length > 0) {
    const recentPosts = profile.posts.slice(0, 3);
    parts.push(`\nآخر ${recentPosts.length} منشورات:`);
    recentPosts.forEach((post, i) => {
      parts.push(`  ${i + 1}. ${post.description?.slice(0, 100) || "بدون وصف"} (إعجابات: ${post.likes || 0}, تعليقات: ${post.comments || 0})`);
    });
  }

  parts.push(`=== نهاية البيانات الحقيقية ===`);
  return parts.join("\n");
}

// ===== Helpers =====
function normalizeInstagramUrl(input: string): string {
  // إذا كان username فقط (بدون http)
  if (!input.startsWith("http")) {
    const username = input.replace(/^@/, "").trim();
    return `https://www.instagram.com/${username}/`;
  }

  // تنظيف الرابط
  try {
    const url = new URL(input);
    // التأكد من أنه instagram.com
    if (!url.hostname.includes("instagram.com")) {
      const username = input.replace(/^@/, "").trim();
      return `https://www.instagram.com/${username}/`;
    }
    return url.href;
  } catch {
    const username = input.replace(/^@/, "").trim();
    return `https://www.instagram.com/${username}/`;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ===== Keyword Search: البحث في إنستغرام بكلمة مفتاحية =====
// يستخدم dataset_id مخصص للبحث بكلمة مفتاحية بدلاً من URL محدد
// dataset_id: gd_lyclm2p67xgu9o5v0 = Instagram Keyword Search
const INSTAGRAM_KEYWORD_DATASET_ID = "gd_lyclm2p67xgu9o5v0";

export interface InstagramSearchResult {
  username: string;
  full_name: string;
  biography: string;
  profile_url: string;
  followers: number;
  posts_count: number;
  is_verified: boolean;
  is_business_account: boolean;
  business_category?: string;
  business_email?: string;
  business_phone?: string;
  website?: string;
  avg_engagement?: number;
  profile_image_link?: string;
}

export interface InstagramKeywordSearchResult {
  success: boolean;
  results: InstagramSearchResult[];
  total: number;
  keyword: string;
  error?: string;
}

/**
 * البحث في إنستغرام بكلمة مفتاحية عبر Bright Data Dataset API
 * يجلب حسابات تجارية مرتبطة بالكلمة المفتاحية والموقع
 */
export async function searchInstagramByKeyword(
  keyword: string,
  location?: string,
  limit = 20
): Promise<InstagramKeywordSearchResult> {
  const searchQuery = location ? `${keyword} ${location}` : keyword;

  try {
    // المحاولة الأولى: Dataset Keyword Search API
    const apiKey = ENV.brightDataApiToken;
    if (!apiKey) {
      throw new Error("BRIGHT_DATA_API_TOKEN not configured");
    }

    console.log(`[BD Instagram Search] Searching for: "${searchQuery}"`);

    // Trigger keyword search
    const triggerRes = await fetch(
      `${BRIGHT_DATA_API_BASE}/datasets/v3/trigger?dataset_id=${INSTAGRAM_KEYWORD_DATASET_ID}&format=json`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([{ keyword: searchQuery, count: limit }]),
        signal: AbortSignal.timeout(90000),
      }
    );

    if (!triggerRes.ok) {
      const errText = await triggerRes.text();
      throw new Error(`Trigger failed: ${triggerRes.status} - ${errText}`);
    }

    const triggerData = await triggerRes.json() as { snapshot_id: string };
    const snapshotId = triggerData.snapshot_id;

    if (!snapshotId) {
      throw new Error("No snapshot_id returned");
    }

    console.log(`[BD Instagram Search] Snapshot: ${snapshotId}`);

    // Poll for results (max 90 seconds)
    const profiles = await pollInstagramSnapshot(snapshotId, 90000, 5000);

    const results: InstagramSearchResult[] = profiles
      .filter(p => p.username && !p.error)
      .slice(0, limit)
      .map(p => ({
        username: p.username,
        full_name: p.full_name || p.username,
        biography: p.biography || "",
        profile_url: p.profile_url || `https://www.instagram.com/${p.username}/`,
        followers: p.followers || 0,
        posts_count: p.posts_count || 0,
        is_verified: p.is_verified || false,
        is_business_account: p.is_business_account || false,
        business_category: p.business_category,
        business_email: p.business_email,
        business_phone: p.business_phone,
        website: p.website,
        avg_engagement: p.avg_engagement,
        profile_image_link: p.profile_image_link,
      }));

    return {
      success: true,
      results,
      total: results.length,
      keyword: searchQuery,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[BD Instagram Search] Error: ${error}`);

    // Fallback: إرجاع نتيجة فارغة مع رسالة الخطأ
    return {
      success: false,
      results: [],
      total: 0,
      keyword: searchQuery,
      error,
    };
  }
}
