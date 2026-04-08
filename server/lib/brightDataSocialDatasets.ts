/**
 * Bright Data Dataset API - Social Media Platforms
 * يدعم: TikTok Profiles, TikTok Posts, Snapchat Posts, Twitter/X Posts, Facebook Pages
 *
 * Flow:
 * 1. Trigger: POST /datasets/v3/trigger?dataset_id=<ID>&format=json
 * 2. Returns: snapshot_id
 * 3. Poll: GET /datasets/v3/snapshot/{snapshot_id}?format=json
 * 4. Returns: full profile/posts data
 *
 * Dataset IDs (Bright Data Official - Verified from Dashboard 2026-03-15):
 * - TikTok Profiles:       gd_l1villgoiiidt09ci  ✅ ACTIVE - TikTok Profiles collect by URL
 * - Facebook Profiles:     gd_mf0urb782734ik94dz ✅ ACTIVE - Facebook Profiles collect by URL
 * - Facebook Page Posts:   gd_lkaxegm826bjpoo9m5 ✅ ACTIVE - Facebook Pages Posts by Profile URL
 * - Twitter/X Posts:       gd_lwxkxvnf1cynvib9co ✅ ACTIVE - Twitter/X Posts
 * - Snapchat:              NOT AVAILABLE in Bright Data Library (no scraper exists)
 */

import { ENV } from "../_core/env";

const BRIGHT_DATA_API_BASE = "https://api.brightdata.com";

// ===== Dataset IDs =====
export const DATASET_IDS = {
  TIKTOK_PROFILES:     "gd_l1villgoiiidt09ci",   // ✅ confirmed working - TikTok Profiles
  TIKTOK_POSTS:        "gd_l1villgoiiidt09ci",   // same dataset, posts via profile URL
  SNAPCHAT_POSTS:      "",                        // ❌ NOT AVAILABLE in Bright Data - use scraping fallback
  TWITTER_POSTS:       "gd_lwxkxvnf1cynvib9co",  // ✅ confirmed working - Twitter/X Posts
  FACEBOOK_PROFILES:   "gd_mf0urb782734ik94dz",  // ✅ confirmed working - Facebook Profiles
  FACEBOOK_PAGE_POSTS: "gd_lkaxegm826bjpoo9m5",  // ✅ confirmed working - Facebook Pages Posts
} as const;

// ===== Types =====
export interface TikTokProfile {
  id?: string;
  username?: string;
  account_id?: string;          // username field from Bright Data API
  nickname?: string;
  biography?: string;
  bio_link?: string;
  profile_url?: string;
  // Actual field names returned by Bright Data TikTok API
  followers?: number;           // actual API field
  following?: number;
  likes?: number;
  awg_engagement_rate?: number; // actual API field (note: awg not avg)
  // Legacy/alternative field names
  followers_count?: number;
  following_count?: number;
  likes_count?: number;
  videos_count?: number;
  avg_engagement_rate?: number;
  comment_engagement_rate?: number;
  like_engagement_rate?: number;
  is_verified?: boolean;
  predicted_lang?: string;
  predicted_language?: string;
  create_time?: string;
  error?: string;
}

export interface TikTokPost {
  url?: string;
  post_id?: string;
  description?: string;
  create_time?: string;
  digg_count?: number;
  share_count?: number;
  collect_count?: number;
  comment_count?: number;
  play_count?: number;
  author_username?: string;
  error?: string;
}

export interface SnapchatPost {
  url?: string;
  post_id?: string;
  profile_name?: string;
  profile_handle?: string;
  profile_link?: string;
  num_comments?: number;
  num_shares?: number;
  num_views?: number;
  content?: string;
  date_posted?: string;
  error?: string;
}

export interface TwitterPost {
  url?: string;
  id?: string;
  user_posted?: string;
  name?: string;
  profile_name?: string;
  description?: string;
  biography?: string;
  date_posted?: string;
  date_joined?: string;
  location?: string;
  external_link?: string;
  profile_image_link?: string;
  followers?: number;
  following?: number;
  posts_count?: number;
  is_verified?: boolean;
  photos?: string[];
  quoted_post?: string;
  num_comments?: number;
  num_likes?: number;
  num_reposts?: number;
  num_views?: number;
  error?: string;
}

export interface FacebookPagePost {
  url?: string;
  post_id?: string;
  user_url?: string;
  user_username_raw?: string;
  content?: string;
  date_posted?: string;
  hashtags?: string[];
  num_comments?: number;
  num_likes?: number;
  num_shares?: number;
  error?: string;
}

export interface SocialDatasetResult<T> {
  success: boolean;
  data?: T[];
  snapshotId?: string;
  error?: string;
  platform: string;
  profileExists?: boolean;
  liveChecked?: boolean;
}

// ===== Helper: sleep =====
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ===== Helper: HTTP Request =====
async function brightDataRequest(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  timeoutMs = 90000
): Promise<unknown> {
  const apiKey = ENV.brightDataApiToken;
  if (!apiKey) throw new Error("BRIGHT_DATA_API_TOKEN not configured");

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
async function triggerDatasetCollection(
  datasetId: string,
  inputs: Record<string, string>[]
): Promise<string> {
  const result = await brightDataRequest(
    "POST",
    `/datasets/v3/trigger?dataset_id=${datasetId}&format=json&uncompressed_webhook=true`,
    inputs
  ) as { snapshot_id: string };

  if (!result?.snapshot_id) {
    throw new Error(`No snapshot_id returned from Bright Data for dataset ${datasetId}`);
  }

  console.log(`[BD Dataset] Triggered ${datasetId}, snapshot: ${result.snapshot_id}`);
  return result.snapshot_id;
}

// ===== Step 2: Poll for Results =====
async function pollSnapshot<T>(
  snapshotId: string,
  maxWaitMs = 120000,
  pollIntervalMs = 5000
): Promise<T[]> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const result = await brightDataRequest(
        "GET",
        `/datasets/v3/snapshot/${snapshotId}?format=json`,
        undefined,
        20000
      );

      if (Array.isArray(result) && result.length > 0) {
        console.log(`[BD Dataset] Snapshot ${snapshotId} ready with ${result.length} records`);
        return result as T[];
      }

      if (result && typeof result === "object" && !Array.isArray(result)) {
        const status = (result as any).status;
        if (["running", "pending", "initializing"].includes(status)) {
          console.log(`[BD Dataset] Snapshot ${snapshotId} status: ${status}, waiting...`);
          await sleep(pollIntervalMs);
          continue;
        }
        if (status === "failed") {
          throw new Error(`Snapshot ${snapshotId} failed: ${JSON.stringify(result)}`);
        }
      }

      if (typeof result === "string" && result.trim()) {
        const lines = result.trim().split("\n").filter(l => l.trim());
        const records = lines.map(line => {
          try { return JSON.parse(line); } catch { return null; }
        }).filter(Boolean);
        if (records.length > 0) return records as T[];
      }

      await sleep(pollIntervalMs);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes("not ready") || errMsg.includes("processing") || errMsg.includes("404")) {
        await sleep(pollIntervalMs);
        continue;
      }
      throw err;
    }
  }

  throw new Error(`Snapshot ${snapshotId} timed out after ${maxWaitMs / 1000}s`);
}

// ===== Normalize URLs =====
function normalizeTikTokUrl(input: string): string {
  if (!input) return input;
  const clean = input.trim().replace(/\s+/g, "");
  if (clean.startsWith("http")) return clean;
  const handle = clean.replace(/^@/, "");
  return `https://www.tiktok.com/@${handle}`;
}

function normalizeSnapchatUrl(input: string): string {
  if (!input) return input;
  const clean = input.trim().replace(/\s+/g, "");
  if (clean.startsWith("http")) return clean;
  const handle = clean.replace(/^@/, "");
  return `https://www.snapchat.com/add/${handle}`;
}

function normalizeTwitterUrl(input: string): string {
  if (!input) return input;
  const clean = input.trim().replace(/\s+/g, "");
  // Twitter/X Posts dataset requires URL format: https://x.com/username/status/
  if (clean.includes("/status/")) return clean.replace("twitter.com", "x.com");
  const handle = clean.replace(/^@/, "").replace(/.*twitter\.com\//, "").replace(/.*x\.com\//, "").replace(/\/.*$/, "");
  // Use profile posts discovery format
  return `https://x.com/${handle}/status/`;
}

function normalizeFacebookUrl(input: string): string {
  if (!input) return input;
  const clean = input.trim().replace(/\s+/g, "");
  if (clean.startsWith("http")) return clean;
  return `https://www.facebook.com/${clean}`;
}

function hasSignals(html: string, signals: string[]): boolean {
  const lower = String(html || "").toLowerCase();
  return signals.some((signal) => signal && lower.includes(signal.toLowerCase()));
}

async function liveCheckProfilePage(
  profilePageUrl: string,
  unavailableSignals: string[],
  evidenceSignals: string[],
): Promise<{ liveChecked: boolean; profileExists?: boolean; html?: string }> {
  try {
    const { fetchWithScrapingBrowser, fetchViaProxy } = await import("./brightDataScraper");
    let html = "";
    let liveChecked = false;

    try {
      html = await fetchWithScrapingBrowser(profilePageUrl);
      liveChecked = true;
    } catch {
      try {
        html = await fetchViaProxy(profilePageUrl, 20000);
        liveChecked = true;
      } catch {
        return { liveChecked: false, profileExists: undefined };
      }
    }

    const profileExists = !(hasSignals(html, unavailableSignals) && !hasSignals(html, evidenceSignals));
    return { liveChecked, profileExists, html };
  } catch {
    return { liveChecked: false, profileExists: undefined };
  }
}

// ===== Public API: TikTok Profile =====
export async function fetchTikTokProfile(
  profileUrl: string
): Promise<SocialDatasetResult<TikTokProfile>> {
  const platform = "tiktok";
  try {
    const cleanUrl = normalizeTikTokUrl(profileUrl);
    const handleMatch = cleanUrl.match(/tiktok\.com\/@([^\/\?]+)/i);
    const handle = handleMatch?.[1]?.toLowerCase() || "";
    const liveCheck = await liveCheckProfilePage(
      cleanUrl,
      [
        "couldn't find this account",
        "couldn't find this user",
        "user not found",
        "account unavailable",
        "this account is private",
        "page not available",
        "profile not found",
        "not found",
      ],
      [
        `tiktok.com/@${handle}`,
        `"uniqueid":"${handle}"`,
        "\"followercount\":",
        "\"followingcount\":",
        "followers",
        "following",
        "og:title",
      ]
    );
    if (liveCheck.liveChecked && liveCheck.profileExists === false) {
      return {
        success: false,
        error: "TikTok profile unavailable",
        platform,
        profileExists: false,
        liveChecked: true,
      };
    }

    console.log(`[BD TikTok] Fetching profile: ${cleanUrl}`);

    const snapshotId = await triggerDatasetCollection(
      DATASET_IDS.TIKTOK_PROFILES,
      [{ url: cleanUrl }]
    );

    const data = await pollSnapshot<TikTokProfile>(snapshotId, 120000, 5000);

    return {
      success: true,
      data,
      snapshotId,
      platform,
      profileExists: liveCheck.liveChecked ? true : undefined,
      liveChecked: liveCheck.liveChecked,
    };
  } catch (err: any) {
    console.error(`[BD TikTok] Error:`, err.message);
    return { success: false, error: err.message, platform };
  }
}

// ===== Public API: TikTok Posts =====
export async function fetchTikTokPosts(
  profileUrl: string,
  limit = 10
): Promise<SocialDatasetResult<TikTokPost>> {
  const platform = "tiktok_posts";
  try {
    const cleanUrl = normalizeTikTokUrl(profileUrl);
    console.log(`[BD TikTok Posts] Fetching posts for: ${cleanUrl}`);

    const snapshotId = await triggerDatasetCollection(
      DATASET_IDS.TIKTOK_POSTS,
      [{ url: cleanUrl, num_of_posts: String(limit) }]
    );

    const data = await pollSnapshot<TikTokPost>(snapshotId, 120000, 5000);

    return { success: true, data, snapshotId, platform };
  } catch (err: any) {
    console.error(`[BD TikTok Posts] Error:`, err.message);
    return { success: false, error: err.message, platform };
  }
}

// ===== Public API: Snapchat Posts =====
// ملاحظة: Bright Data لا يدعم Snapchat كـ dataset رسمياً
// نستخدم Scraping Browser لجلب بيانات حقيقية من صفحة الملف الشخصي
export async function fetchSnapchatPosts(
  profileUrl: string,
  limit = 10
): Promise<SocialDatasetResult<SnapchatPost>> {
  const platform = "snapchat";
  const hasUnavailableSignals = (html: string) => {
    const lower = html.toLowerCase();
    return [
      "page not found",
      "profile not found",
      "account unavailable",
      "this account is unavailable",
      "couldn't find",
      "could not be found",
      "user not found",
      "الحساب غير متوفر",
      "الحساب غير متاح",
      "الصفحة غير موجودة",
      "غير متوفر",
      "غير موجود",
      "لم نتمكن من العثور",
    ].some((signal) => lower.includes(signal));
  };

  const hasProfileEvidence = (html: string, handle: string) => {
    const lower = html.toLowerCase();
    const normalizedHandle = handle.toLowerCase();
    return (
      lower.includes(`snapchat.com/add/${normalizedHandle}`) ||
      lower.includes(`@${normalizedHandle}`) ||
      lower.includes(`"${normalizedHandle}"`) ||
      lower.includes("og:title") ||
      lower.includes("og:description") ||
      lower.includes("\"story\"") ||
      lower.includes("subscriber") ||
      lower.includes("follower")
    );
  };

  try {
    const cleanUrl = normalizeSnapchatUrl(profileUrl);
    const handle = cleanUrl.replace(/.*snapchat\.com\/add\//, "").replace(/\/$/, "");
    console.log(`[BD Snapchat] Fetching via Scraping Browser for handle: ${handle}`);

    // محاولة 1: Scraping Browser لجلب صفحة الملف الشخصي مباشرة
    const { fetchWithScrapingBrowser, fetchViaProxy } = await import("./brightDataScraper");
    const profilePageUrl = `https://www.snapchat.com/add/${handle}`;
    let html = "";
    let liveChecked = false;
    try {
      html = await fetchWithScrapingBrowser(profilePageUrl);
      liveChecked = true;
    } catch (sbErr) {
      console.warn(`[BD Snapchat] Scraping Browser failed, trying proxy:`, sbErr);
      try {
        html = await fetchViaProxy(profilePageUrl, 20000);
        liveChecked = true;
      } catch (proxyErr) {
        console.warn(`[BD Snapchat] Proxy failed, trying SERP fallback:`, proxyErr);
        // محاولة 3: SERP API كـ fallback
        const apiToken = ENV.brightDataApiToken;
        const serpZone = ENV.brightDataSerpZone || "serp_api1";
        if (apiToken) {
          const query = `site:snapchat.com/add/${handle} snapchat`;
          const targetUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=5&hl=ar&gl=sa`;
          const res = await fetch("https://api.brightdata.com/request", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiToken}` },
            body: JSON.stringify({ zone: serpZone, url: targetUrl, format: "raw" }),
            signal: AbortSignal.timeout(30000),
          });
          if (res.ok) html = await res.text();
        }
      }
    }

    const posts: SnapchatPost[] = [];

    if (html) {
      if (liveChecked && hasUnavailableSignals(html) && !hasProfileEvidence(html, handle)) {
        return {
          success: false,
          error: "Snapchat profile unavailable",
          platform,
          profileExists: false,
          liveChecked: true,
        };
      }

      // استخراج بيانات الملف الشخصي من HTML
      const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
                      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)?.[1] || "";
      const ogDescription = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
                            html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i)?.[1] || "";
      const subscribersMatch = html.match(/(\d[\d,\.]+)\s*(?:مشترك|subscriber|follower)/i);
      const subscribersCount = subscribersMatch ? parseInt(subscribersMatch[1].replace(/[,\.]/g, "")) : 0;

      // استخراج القصص من HTML
      const storyMatches = html.match(/"story"[^}]+"title":"([^"]+)"/g) || [];
      for (const m of storyMatches.slice(0, limit)) {
        const titleMatch = m.match(/"title":"([^"]+)"/);
        if (titleMatch) {
          posts.push({
            profile_handle: handle,
            profile_link: cleanUrl,
            content: titleMatch[1],
            url: cleanUrl,
            profile_name: ogTitle.replace(" on Snapchat", "").trim(),
            num_views: subscribersCount,
          });
        }
      }

      // إذا لم نجد قصص، أضف بيانات أساسية
      if (posts.length === 0 && (ogTitle || ogDescription || html.includes(handle))) {
        posts.push({
          profile_handle: handle,
          profile_link: cleanUrl,
          content: ogDescription || `حساب Snapchat: @${handle}`,
          url: cleanUrl,
          profile_name: ogTitle.replace(" on Snapchat", "").trim() || handle,
          num_views: subscribersCount,
        });
      }
    }

    return {
      success: posts.length > 0,
      data: posts,
      platform,
      profileExists: liveChecked ? posts.length > 0 : undefined,
      liveChecked,
    };
  } catch (err: any) {
    console.error(`[BD Snapchat] Error:`, err.message);
    return { success: false, error: err.message, platform, liveChecked: false };
  }
}

// ===== Public API: Twitter/X Posts =====
export async function fetchTwitterPosts(
  profileUrl: string,
  limit = 10
): Promise<SocialDatasetResult<TwitterPost>> {
  const platform = "twitter";
  try {
    const cleanUrl = normalizeTwitterUrl(profileUrl);
    const handle = cleanUrl
      .replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, "")
      .replace(/\/status\/?$/i, "")
      .replace(/\/.*$/i, "")
      .trim()
      .toLowerCase();
    const liveCheckUrl = handle ? `https://x.com/${handle}` : cleanUrl.replace(/\/status\/?$/i, "");
    const liveCheck = await liveCheckProfilePage(
      liveCheckUrl,
      [
        "this account doesn’t exist",
        "this account doesn't exist",
        "account suspended",
        "page doesn’t exist",
        "page doesn't exist",
        "user not found",
        "something went wrong",
        "not found",
      ],
      [
        `x.com/${handle}`,
        `"screen_name":"${handle}"`,
        "followers",
        "following",
        "og:title",
        "profile_image_url",
      ]
    );
    if (liveCheck.liveChecked && liveCheck.profileExists === false) {
      return {
        success: false,
        error: "Twitter profile unavailable",
        platform,
        profileExists: false,
        liveChecked: true,
      };
    }

    console.log(`[BD Twitter] Fetching posts for: ${cleanUrl}`);

    const snapshotId = await triggerDatasetCollection(
      DATASET_IDS.TWITTER_POSTS,
      [{ url: cleanUrl, num_of_posts: String(limit) }]
    );

    const data = await pollSnapshot<TwitterPost>(snapshotId, 120000, 5000);

    return {
      success: true,
      data,
      snapshotId,
      platform,
      profileExists: liveCheck.liveChecked ? true : undefined,
      liveChecked: liveCheck.liveChecked,
    };
  } catch (err: any) {
    console.error(`[BD Twitter] Error:`, err.message);
    return { success: false, error: err.message, platform };
  }
}

// ===== Public API: Facebook Page Posts =====
export async function fetchFacebookPagePosts(
  pageUrl: string,
  limit = 10
): Promise<SocialDatasetResult<FacebookPagePost>> {
  const platform = "facebook";
  try {
    const cleanUrl = normalizeFacebookUrl(pageUrl);
    console.log(`[BD Facebook] Fetching page posts for: ${cleanUrl}`);

    // نحاول أولاً Facebook Page Posts dataset
    const snapshotId = await triggerDatasetCollection(
      DATASET_IDS.FACEBOOK_PAGE_POSTS,
      [{ url: cleanUrl, num_of_posts: String(limit) }]
    );

    const data = await pollSnapshot<FacebookPagePost>(snapshotId, 120000, 5000);

    return { success: true, data, snapshotId, platform };
  } catch (err: any) {
    console.error(`[BD Facebook] Error:`, err.message);
    // إذا فشل Page Posts، نحاول Facebook Profiles
    try {
      console.log(`[BD Facebook] Trying Facebook Profiles dataset as fallback...`);
      const cleanUrl2 = normalizeFacebookUrl(pageUrl);
      const snapshotId2 = await triggerDatasetCollection(
        DATASET_IDS.FACEBOOK_PROFILES,
        [{ url: cleanUrl2 }]
      );
      const data2 = await pollSnapshot<FacebookPagePost>(snapshotId2, 120000, 5000);
      return { success: true, data: data2, snapshotId: snapshotId2, platform };
    } catch (err2: any) {
      console.error(`[BD Facebook] Fallback also failed:`, err2.message);
      return { success: false, error: err.message, platform };
    }
  }
}

// ===== Unified: Fetch Any Platform =====
export async function fetchSocialPlatformData(
  platform: "tiktok" | "snapchat" | "twitter" | "facebook",
  profileUrl: string
): Promise<SocialDatasetResult<any>> {
  switch (platform) {
    case "tiktok":
      return fetchTikTokProfile(profileUrl);
    case "snapchat":
      return fetchSnapchatPosts(profileUrl);
    case "twitter":
      return fetchTwitterPosts(profileUrl);
    case "facebook":
      return fetchFacebookPagePosts(profileUrl);
    default:
      return { success: false, error: `Unsupported platform: ${platform}`, platform };
  }
}

// ===== Extract Summary Stats from Results =====
export function extractSocialStats(platform: string, data: any[]): {
  followersCount?: number;
  postsCount?: number;
  engagementRate?: number;
  avgLikes?: number;
  avgComments?: number;
  avgViews?: number;
  bio?: string;
  isVerified?: boolean;
  profileName?: string;
  recentPosts?: Array<{ content: string; date?: string; likes?: number; views?: number }>;
} {
  if (!data || data.length === 0) return {};

  if (platform === "tiktok") {
    const profile = data[0] as TikTokProfile;
    // Bright Data TikTok API returns: followers, likes, videos_count, awg_engagement_rate
    const followersCount = profile.followers ?? profile.followers_count ?? 0;
    const engagementRate = profile.awg_engagement_rate ?? profile.avg_engagement_rate ?? 0;
    const profileName = profile.nickname || profile.account_id || profile.username;
    return {
      followersCount,
      postsCount: profile.videos_count,
      engagementRate,
      bio: profile.biography,
      isVerified: profile.is_verified,
      profileName,
    };
  }

  if (platform === "tiktok_posts") {
    const posts = data as TikTokPost[];
    const totalLikes = posts.reduce((s, p) => s + (p.digg_count || 0), 0);
    const totalViews = posts.reduce((s, p) => s + (p.play_count || 0), 0);
    return {
      postsCount: posts.length,
      avgLikes: posts.length ? Math.round(totalLikes / posts.length) : 0,
      avgViews: posts.length ? Math.round(totalViews / posts.length) : 0,
      recentPosts: posts.slice(0, 5).map(p => ({
        content: p.description || "",
        date: p.create_time,
        likes: p.digg_count,
        views: p.play_count,
      })),
    };
  }

  if (platform === "snapchat") {
    const posts = data as SnapchatPost[];
    const totalViews = posts.reduce((s, p) => s + (p.num_views || 0), 0);
    return {
      postsCount: posts.length,
      avgViews: posts.length ? Math.round(totalViews / posts.length) : 0,
      profileName: posts[0]?.profile_name,
      recentPosts: posts.slice(0, 5).map(p => ({
        content: p.content || "",
        date: p.date_posted,
        views: p.num_views,
      })),
    };
  }

  if (platform === "twitter") {
    const posts = data as TwitterPost[];
    const totalLikes = posts.reduce((s, p) => s + (p.num_likes || 0), 0);
    const totalViews = posts.reduce((s, p) => s + (p.num_views || 0), 0);
    return {
      postsCount: posts.length,
      avgLikes: posts.length ? Math.round(totalLikes / posts.length) : 0,
      avgViews: posts.length ? Math.round(totalViews / posts.length) : 0,
      profileName: posts[0]?.name,
      recentPosts: posts.slice(0, 5).map(p => ({
        content: p.description || "",
        date: p.date_posted,
        likes: p.num_likes,
        views: p.num_views,
      })),
    };
  }

  if (platform === "facebook") {
    const posts = data as FacebookPagePost[];
    const totalLikes = posts.reduce((s, p) => s + (p.num_likes || 0), 0);
    return {
      postsCount: posts.length,
      avgLikes: posts.length ? Math.round(totalLikes / posts.length) : 0,
      profileName: posts[0]?.user_username_raw,
      recentPosts: posts.slice(0, 5).map(p => ({
        content: p.content || "",
        date: p.date_posted,
        likes: p.num_likes,
      })),
    };
  }

  return {};
}
