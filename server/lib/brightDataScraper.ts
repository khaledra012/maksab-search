/**
 * Bright Data Scraper Layer
 * يجلب البيانات الحقيقية من المواقع والمنصات الاجتماعية
 * يستخدم Scraping Browser (WebSocket) للصفحات الصعبة
 * ويستخدم SERP API للبحث العام
 */
import * as https from "https";
import * as http from "http";
import { ENV } from "../_core/env";

// ===== Types =====
export interface WebsiteScrapedData {
  url: string;
  title: string;
  description: string;
  bodyText: string;          // أول 3000 حرف من النص
  hasPhone: boolean;
  phones: string[];
  hasWhatsapp: boolean;
  hasBooking: boolean;
  hasEcommerce: boolean;
  hasSSL: boolean;
  loadedSuccessfully: boolean;
  error?: string;
}

export interface InstagramScrapedData {
  username: string;
  fullName: string;
  bio: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  isVerified: boolean;
  profilePicUrl: string;
  recentPosts: Array<{
    caption: string;
    likesCount: number;
    commentsCount: number;
  }>;
  avgEngagement: number;
  loadedSuccessfully: boolean;
  error?: string;
}

export interface LinkedInScrapedData {
  companyName: string;
  tagline: string;
  about: string;
  followersCount: number;
  employeesCount: string;
  industry: string;
  website: string;
  specialties: string[];
  recentPosts: string[];
  loadedSuccessfully: boolean;
  error?: string;
}

export interface TwitterScrapedData {
  username: string;
  displayName: string;
  bio: string;
  followersCount: number;
  followingCount: number;
  tweetsCount: number;
  isVerified: boolean;
  recentTweets: string[];
  avgLikes: number;
  loadedSuccessfully: boolean;
  error?: string;
}

export interface TikTokScrapedData {
  username: string;
  displayName: string;
  bio: string;
  followersCount: number;
  followingCount: number;
  likesCount: number;
  videosCount: number;
  isVerified: boolean;
  recentVideos: Array<{
    description: string;
    viewsCount: number;
    likesCount: number;
  }>;
  avgViews: number;
  loadedSuccessfully: boolean;
  error?: string;
}

export interface FacebookScrapedData {
  username: string;
  displayName: string;
  bio: string;
  followersCount: number;
  postsCount: number;
  avgLikes: number;
  avgComments: number;
  recentPosts: Array<{
    content: string;
    likesCount: number;
    commentsCount: number;
    date?: string;
  }>;
  loadedSuccessfully: boolean;
  error?: string;
}

// ===== Proxy Configuration =====
function getBrightDataProxyAgent() {
  const proxyUrl = `http://${ENV.brightDataSerpUsername}:${ENV.brightDataSerpPassword}@${ENV.brightDataSerpHost}:${ENV.brightDataSerpPort}`;
  return proxyUrl;
}

// ===== HTTP Fetch via Bright Data Proxy =====
export async function fetchViaProxy(url: string, timeoutMs = 15000): Promise<string> {
  const proxyHost = ENV.brightDataSerpHost;
  const proxyPort = ENV.brightDataSerpPort;
  const proxyUser = ENV.brightDataSerpUsername;
  const proxyPass = ENV.brightDataSerpPassword;

  if (!proxyUser || !proxyPass) {
    throw new Error("Bright Data proxy credentials not configured");
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timeout")), timeoutMs);

    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === "https:";

    const connectOptions = {
      host: proxyHost,
      port: proxyPort,
      method: "CONNECT",
      path: `${parsedUrl.hostname}:${isHttps ? 443 : 80}`,
      headers: {
        "Proxy-Authorization": "Basic " + Buffer.from(`${proxyUser}:${proxyPass}`).toString("base64"),
        "Host": `${parsedUrl.hostname}:${isHttps ? 443 : 80}`,
      },
    };

    const connectReq = http.request(connectOptions);

    connectReq.on("connect", (res, socket) => {
      if (res.statusCode !== 200) {
        clearTimeout(timer);
        reject(new Error(`Proxy CONNECT failed: ${res.statusCode}`));
        return;
      }

      const requestOptions: any = {
        socket,
        host: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "ar,en;q=0.9",
          "Accept-Encoding": "identity",
        },
      };

      const protocol = isHttps ? https : http;
      const req = (protocol as any).request(requestOptions, (resp: any) => {
        let data = "";
        resp.on("data", (chunk: Buffer) => { data += chunk.toString(); });
        resp.on("end", () => {
          clearTimeout(timer);
          resolve(data);
        });
      });

      req.on("error", (err: Error) => {
        clearTimeout(timer);
        reject(err);
      });

      req.end();
    });

    connectReq.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    connectReq.end();
  });
}

// ===== Bright Data Scraping Browser (WebSocket) =====
export async function fetchWithScrapingBrowser(url: string): Promise<string> {
  if (!ENV.brightDataWsEndpoint) {
    throw new Error("Bright Data WS endpoint not configured");
  }

  try {
    // استخدام puppeteer-core مع Bright Data Scraping Browser
    const puppeteer = await import("puppeteer-core");
    const browser = await puppeteer.connect({
      browserWSEndpoint: ENV.brightDataWsEndpoint,
    });

    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(30000);

    await page.goto(url, { waitUntil: "domcontentloaded" });
    await new Promise(r => setTimeout(r, 2000));

    const content = await page.content();
    await browser.disconnect();

    return content;
  } catch (err) {
    throw new Error(`Scraping Browser failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ===== Text Extraction Helpers =====
function extractTextFromHTML(html: string): string {
  // إزالة scripts وstyles
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

  return text.slice(0, 4000);
}

function extractPhones(text: string): string[] {
  const patterns = [
    /(?:^|\D)(05\d{8})(?:\D|$)/g,
    /(?:^|\D)(009665\d{8})(?:\D|$)/g,
    /(?:^|\D)(\+9665\d{8})(?:\D|$)/g,
    /(?:^|\D)(011\d{7})(?:\D|$)/g,
    /(?:^|\D)(012\d{7})(?:\D|$)/g,
    /(?:^|\D)(013\d{7})(?:\D|$)/g,
  ];

  const phones = new Set<string>();
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      phones.add(match[1]);
    }
  }
  return Array.from(phones).slice(0, 5);
}

function extractMetaTag(html: string, name: string): string {
  const patterns = [
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, "i"),
    new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1].trim();
  }
  return "";
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : "";
}

function extractNumber(text: string): number {
  if (!text) return 0;
  const cleaned = text.replace(/[,،\s]/g, "").replace(/[KkMm]$/, (m) => {
    return m.toLowerCase() === "k" ? "000" : "000000";
  });
  const num = parseInt(cleaned);
  return isNaN(num) ? 0 : num;
}

// ===== Website Scraper =====
export async function scrapeWebsite(url: string): Promise<WebsiteScrapedData> {
  const result: WebsiteScrapedData = {
    url,
    title: "",
    description: "",
    bodyText: "",
    hasPhone: false,
    phones: [],
    hasWhatsapp: false,
    hasBooking: false,
    hasEcommerce: false,
    hasSSL: url.startsWith("https://"),
    loadedSuccessfully: false,
  };

  try {
    // محاولة أولى: Scraping Browser (للمواقع الصعبة)
    let html = "";
    try {
      html = await fetchWithScrapingBrowser(url);
    } catch {
      // محاولة ثانية: Proxy مباشر
      html = await fetchViaProxy(url);
    }

    result.title = extractTitle(html);
    result.description = extractMetaTag(html, "description") || extractMetaTag(html, "og:description");
    result.bodyText = extractTextFromHTML(html);

    const phones = extractPhones(html + " " + result.bodyText);
    result.phones = phones;
    result.hasPhone = phones.length > 0;

    result.hasWhatsapp = /whatsapp|wa\.me|واتساب/i.test(html);
    result.hasBooking = /booking|reservation|حجز|موعد|book now/i.test(html);
    result.hasEcommerce = /cart|checkout|add to cart|سلة|شراء|buy now|order now/i.test(html);
    result.loadedSuccessfully = true;

  } catch (err) {
    result.error = err instanceof Error ? err.message : "Unknown error";
    result.loadedSuccessfully = false;
  }

  return result;
}

// ===== Instagram Scraper =====
export async function scrapeInstagram(username: string): Promise<InstagramScrapedData> {
  const result: InstagramScrapedData = {
    username,
    fullName: "",
    bio: "",
    followersCount: 0,
    followingCount: 0,
    postsCount: 0,
    isVerified: false,
    profilePicUrl: "",
    recentPosts: [],
    avgEngagement: 0,
    loadedSuccessfully: false,
  };

  try {
    const cleanUsername = username.replace(/^@/, "").replace(/.*instagram\.com\//, "").replace(/\/$/, "");
    const url = `https://www.instagram.com/${cleanUsername}/`;

    let html = "";
    try {
      html = await fetchWithScrapingBrowser(url);
    } catch {
      html = await fetchViaProxy(url);
    }

    // استخراج البيانات من meta tags وJSON-LD
    const ogTitle = extractMetaTag(html, "og:title");
    const description = extractMetaTag(html, "og:description");

    // استخراج الأرقام من description
    // مثال: "1.2M Followers, 500 Following, 200 Posts"
    const followersMatch = description.match(/([\d,\.]+[KkMm]?)\s*(?:Followers|متابع)/i);
    const followingMatch = description.match(/([\d,\.]+[KkMm]?)\s*(?:Following|يتابع)/i);
    const postsMatch = description.match(/([\d,\.]+[KkMm]?)\s*(?:Posts|منشور)/i);

    result.fullName = ogTitle?.replace(" • Instagram photos and videos", "").trim() || cleanUsername;
    result.followersCount = followersMatch ? extractNumber(followersMatch[1]) : 0;
    result.followingCount = followingMatch ? extractNumber(followingMatch[1]) : 0;
    result.postsCount = postsMatch ? extractNumber(postsMatch[1]) : 0;

    // استخراج البيو
    const bioMatch = html.match(/"biography":"([^"]+)"/);
    result.bio = bioMatch ? bioMatch[1].replace(/\\n/g, " ").replace(/\\u[\dA-F]{4}/gi, "") : "";

    // التحقق من التوثيق
    result.isVerified = /"is_verified":true/.test(html) || /✓|verified/i.test(ogTitle || "");

    // صورة الملف الشخصي
    const picMatch = html.match(/"profile_pic_url":"([^"]+)"/);
    result.profilePicUrl = picMatch ? picMatch[1].replace(/\\u002F/g, "/") : "";

    result.loadedSuccessfully = result.followersCount > 0 || result.fullName !== cleanUsername;

  } catch (err) {
    result.error = err instanceof Error ? err.message : "Unknown error";
    result.loadedSuccessfully = false;
  }

  return result;
}

// ===== LinkedIn Scraper =====
export async function scrapeLinkedIn(linkedinUrl: string): Promise<LinkedInScrapedData> {
  const result: LinkedInScrapedData = {
    companyName: "",
    tagline: "",
    about: "",
    followersCount: 0,
    employeesCount: "",
    industry: "",
    website: "",
    specialties: [],
    recentPosts: [],
    loadedSuccessfully: false,
  };

  try {
    let html = "";
    try {
      html = await fetchWithScrapingBrowser(linkedinUrl);
    } catch {
      html = await fetchViaProxy(linkedinUrl);
    }

    const ogTitle = extractMetaTag(html, "og:title");
    const ogDescription = extractMetaTag(html, "og:description");

    result.companyName = ogTitle?.replace(" | LinkedIn", "").trim() || "";
    result.about = ogDescription || extractTextFromHTML(html).slice(0, 500);

    // استخراج عدد المتابعين
    const followersMatch = html.match(/([\d,\.]+[KkMm]?)\s*(?:followers|متابع)/i);
    result.followersCount = followersMatch ? extractNumber(followersMatch[1]) : 0;

    // استخراج عدد الموظفين
    const employeesMatch = html.match(/([\d,\-\+]+)\s*(?:employees|موظف)/i);
    result.employeesCount = employeesMatch ? employeesMatch[1] : "";

    // استخراج الصناعة
    const industryMatch = html.match(/"industry":"([^"]+)"/);
    result.industry = industryMatch ? industryMatch[1] : "";

    result.loadedSuccessfully = !!result.companyName;

  } catch (err) {
    result.error = err instanceof Error ? err.message : "Unknown error";
    result.loadedSuccessfully = false;
  }

  return result;
}

// ===== Twitter/X Scraper =====
export async function scrapeTwitter(twitterUrl: string): Promise<TwitterScrapedData> {
  const result: TwitterScrapedData = {
    username: "",
    displayName: "",
    bio: "",
    followersCount: 0,
    followingCount: 0,
    tweetsCount: 0,
    isVerified: false,
    recentTweets: [],
    avgLikes: 0,
    loadedSuccessfully: false,
  };

  try {
    // استخراج username من الرابط
    const usernameMatch = twitterUrl.match(/(?:twitter\.com|x\.com)\/([^\/\?]+)/);
    const username = usernameMatch ? usernameMatch[1] : "";
    result.username = username;

    const url = `https://x.com/${username}`;

    let html = "";
    try {
      html = await fetchWithScrapingBrowser(url);
    } catch {
      html = await fetchViaProxy(url);
    }

    const ogTitle = extractMetaTag(html, "og:title");
    const ogDescription = extractMetaTag(html, "og:description");

    result.displayName = ogTitle?.replace(" on X", "").replace(" on Twitter", "").trim() || username;
    result.bio = ogDescription || "";

    // استخراج الأرقام
    const followersMatch = html.match(/([\d,\.]+[KkMm]?)\s*(?:Followers|متابع)/i);
    const followingMatch = html.match(/([\d,\.]+[KkMm]?)\s*(?:Following|يتابع)/i);

    result.followersCount = followersMatch ? extractNumber(followersMatch[1]) : 0;
    result.followingCount = followingMatch ? extractNumber(followingMatch[1]) : 0;

    result.isVerified = /is_blue_verified":true|verified_type/.test(html);

    result.loadedSuccessfully = !!result.displayName && result.displayName !== username;

  } catch (err) {
    result.error = err instanceof Error ? err.message : "Unknown error";
    result.loadedSuccessfully = false;
  }

  return result;
}

// ===== TikTok Scraper =====
export async function scrapeTikTok(tiktokUrl: string): Promise<TikTokScrapedData> {
  const result: TikTokScrapedData = {
    username: "",
    displayName: "",
    bio: "",
    followersCount: 0,
    followingCount: 0,
    likesCount: 0,
    videosCount: 0,
    isVerified: false,
    recentVideos: [],
    avgViews: 0,
    loadedSuccessfully: false,
  };

  try {
    const usernameMatch = tiktokUrl.match(/tiktok\.com\/@([^\/\?]+)/);
    const username = usernameMatch ? usernameMatch[1] : "";
    result.username = username;

    const url = `https://www.tiktok.com/@${username}`;

    let html = "";
    try {
      html = await fetchWithScrapingBrowser(url);
    } catch {
      html = await fetchViaProxy(url);
    }

    const ogTitle = extractMetaTag(html, "og:title");
    const ogDescription = extractMetaTag(html, "og:description");

    result.displayName = ogTitle?.replace(" | TikTok", "").replace("(@" + username + ")", "").trim() || username;
    result.bio = ogDescription || "";

    // استخراج الأرقام من JSON المضمّن
    const followersMatch = html.match(/"followerCount":(\d+)/);
    const followingMatch = html.match(/"followingCount":(\d+)/);
    const likesMatch = html.match(/"heartCount":(\d+)/);
    const videosMatch = html.match(/"videoCount":(\d+)/);

    result.followersCount = followersMatch ? parseInt(followersMatch[1]) : 0;
    result.followingCount = followingMatch ? parseInt(followingMatch[1]) : 0;
    result.likesCount = likesMatch ? parseInt(likesMatch[1]) : 0;
    result.videosCount = videosMatch ? parseInt(videosMatch[1]) : 0;

    result.isVerified = /"verified":true/.test(html);

    result.loadedSuccessfully = result.followersCount > 0 || result.displayName !== username;

  } catch (err) {
    result.error = err instanceof Error ? err.message : "Unknown error";
    result.loadedSuccessfully = false;
  }

  return result;
}

// ===== Facebook Scraper =====
export async function scrapeFacebook(facebookUrl: string): Promise<FacebookScrapedData> {
  const { fetchFacebookPagePosts, extractSocialStats } = await import("./brightDataSocialDatasets");

  const result: FacebookScrapedData = {
    username: "",
    displayName: "",
    bio: "",
    followersCount: 0,
    postsCount: 0,
    avgLikes: 0,
    avgComments: 0,
    recentPosts: [],
    loadedSuccessfully: false,
  };

  try {
    const fbResult = await fetchFacebookPagePosts(facebookUrl, 10);
    if (!fbResult.success || !fbResult.data?.length) {
      result.error = fbResult.error || "No data returned";
      return result;
    }

    const stats = extractSocialStats("facebook", fbResult.data);
    result.username = facebookUrl.replace(/.*facebook\.com\//, "").replace(/\/$/, "");
    result.displayName = stats.profileName || result.username;
    result.followersCount = stats.followersCount || 0;
    result.postsCount = stats.postsCount || fbResult.data.length;
    result.avgLikes = stats.avgLikes || 0;
    result.avgComments = stats.avgComments || 0;
    result.recentPosts = (stats.recentPosts || []).map(p => ({
      content: p.content || "",
      likesCount: p.likes || 0,
      commentsCount: 0,
      date: p.date,
    }));
    result.loadedSuccessfully = true;
  } catch (err) {
    result.error = err instanceof Error ? err.message : "Unknown error";
    result.loadedSuccessfully = false;
  }

  return result;
}

// ===== Batch Scraper (يجلب كل المنصات دفعة واحدة) =====
export interface AllPlatformsData {
  website?: WebsiteScrapedData;
  instagram?: InstagramScrapedData;
  linkedin?: LinkedInScrapedData;
  twitter?: TwitterScrapedData;
  tiktok?: TikTokScrapedData;
  facebook?: FacebookScrapedData;
  scrapedAt: number;
}

export async function scrapeAllPlatforms(params: {
  websiteUrl?: string | null;
  instagramUrl?: string | null;
  linkedinUrl?: string | null;
  twitterUrl?: string | null;
  tiktokUrl?: string | null;
  facebookUrl?: string | null;
}): Promise<AllPlatformsData> {
  const results: AllPlatformsData = { scrapedAt: Date.now() };

  const tasks: Promise<void>[] = [];

  if (params.websiteUrl) {
    tasks.push(
      scrapeWebsite(params.websiteUrl)
        .then(d => { results.website = d; })
        .catch(err => {
          results.website = { url: params.websiteUrl!, title: "", description: "", bodyText: "", hasPhone: false, phones: [], hasWhatsapp: false, hasBooking: false, hasEcommerce: false, hasSSL: false, loadedSuccessfully: false, error: String(err) };
        })
    );
  }

  if (params.instagramUrl) {
    tasks.push(
      scrapeInstagram(params.instagramUrl)
        .then(d => { results.instagram = d; })
        .catch(err => {
          results.instagram = { username: params.instagramUrl!, fullName: "", bio: "", followersCount: 0, followingCount: 0, postsCount: 0, isVerified: false, profilePicUrl: "", recentPosts: [], avgEngagement: 0, loadedSuccessfully: false, error: String(err) };
        })
    );
  }

  if (params.linkedinUrl) {
    tasks.push(
      scrapeLinkedIn(params.linkedinUrl)
        .then(d => { results.linkedin = d; })
        .catch(err => {
          results.linkedin = { companyName: "", tagline: "", about: "", followersCount: 0, employeesCount: "", industry: "", website: "", specialties: [], recentPosts: [], loadedSuccessfully: false, error: String(err) };
        })
    );
  }

  if (params.twitterUrl) {
    tasks.push(
      scrapeTwitter(params.twitterUrl)
        .then(d => { results.twitter = d; })
        .catch(err => {
          results.twitter = { username: "", displayName: "", bio: "", followersCount: 0, followingCount: 0, tweetsCount: 0, isVerified: false, recentTweets: [], avgLikes: 0, loadedSuccessfully: false, error: String(err) };
        })
    );
  }

  if (params.tiktokUrl) {
    tasks.push(
      scrapeTikTok(params.tiktokUrl)
        .then(d => { results.tiktok = d; })
        .catch(err => {
          results.tiktok = { username: "", displayName: "", bio: "", followersCount: 0, followingCount: 0, likesCount: 0, videosCount: 0, isVerified: false, recentVideos: [], avgViews: 0, loadedSuccessfully: false, error: String(err) };
        })
    );
  }

  if (params.facebookUrl) {
    tasks.push(
      scrapeFacebook(params.facebookUrl)
        .then(d => { results.facebook = d; })
        .catch(err => {
          results.facebook = { username: "", displayName: "", bio: "", followersCount: 0, postsCount: 0, avgLikes: 0, avgComments: 0, recentPosts: [], loadedSuccessfully: false, error: String(err) };
        })
    );
  }

  await Promise.all(tasks);
  return results;
}

// ===== Format for LLM =====
export function formatScrapedDataForLLM(data: AllPlatformsData): string {
  const parts: string[] = [];

  if (data.website?.loadedSuccessfully) {
    parts.push(`=== الموقع الإلكتروني ===
العنوان: ${data.website.title}
الوصف: ${data.website.description}
أرقام الهاتف المكتشفة: ${data.website.phones.join(", ") || "لا يوجد"}
يدعم واتساب: ${data.website.hasWhatsapp ? "نعم" : "لا"}
يدعم الحجز: ${data.website.hasBooking ? "نعم" : "لا"}
يدعم التجارة الإلكترونية: ${data.website.hasEcommerce ? "نعم" : "لا"}
محتوى الموقع (أول 1500 حرف): ${data.website.bodyText.slice(0, 1500)}`);
  } else if (data.website) {
    parts.push(`=== الموقع الإلكتروني ===\nفشل جلب الموقع: ${data.website.error || "خطأ غير معروف"}`);
  }

  if (data.instagram?.loadedSuccessfully) {
    parts.push(`=== إنستغرام ===
الاسم: ${data.instagram.fullName}
البيو: ${data.instagram.bio}
المتابعون: ${data.instagram.followersCount.toLocaleString()}
المنشورات: ${data.instagram.postsCount}
موثّق: ${data.instagram.isVerified ? "نعم ✓" : "لا"}`);
  } else if (data.instagram) {
    parts.push(`=== إنستغرام ===\nفشل جلب البيانات: ${data.instagram.error || "خطأ"}`);
  }

  if (data.linkedin?.loadedSuccessfully) {
    parts.push(`=== لينكد إن ===
الشركة: ${data.linkedin.companyName}
الوصف: ${data.linkedin.about?.slice(0, 300)}
المتابعون: ${data.linkedin.followersCount.toLocaleString()}
الموظفون: ${data.linkedin.employeesCount}
القطاع: ${data.linkedin.industry}`);
  } else if (data.linkedin) {
    parts.push(`=== لينكد إن ===\nفشل جلب البيانات: ${data.linkedin.error || "خطأ"}`);
  }

  if (data.twitter?.loadedSuccessfully) {
    parts.push(`=== تويتر/X ===
الاسم: ${data.twitter.displayName}
البيو: ${data.twitter.bio}
المتابعون: ${data.twitter.followersCount.toLocaleString()}
موثّق: ${data.twitter.isVerified ? "نعم ✓" : "لا"}`);
  } else if (data.twitter) {
    parts.push(`=== تويتر/X ===\nفشل جلب البيانات: ${data.twitter.error || "خطأ"}`);
  }

  if (data.tiktok?.loadedSuccessfully) {
    parts.push(`=== تيك توك ===
الاسم: ${data.tiktok.displayName}
البيو: ${data.tiktok.bio}
المتابعون: ${data.tiktok.followersCount.toLocaleString()}
الإعجابات الكلية: ${data.tiktok.likesCount.toLocaleString()}
عدد الفيديوهات: ${data.tiktok.videosCount}
موثّق: ${data.tiktok.isVerified ? "نعم ✓" : "لا"}`);
  } else if (data.tiktok) {
    parts.push(`=== تيك توك ===\nفشل جلب البيانات: ${data.tiktok.error || "خطأ"}`);
  }

  if (data.facebook?.loadedSuccessfully) {
    parts.push(`=== فيسبوك ===
الاسم: ${data.facebook.displayName}
المتابعون: ${data.facebook.followersCount.toLocaleString()}
عدد المنشورات: ${data.facebook.postsCount}
متوسط الإعجابات: ${data.facebook.avgLikes}
آخر المنشورات: ${data.facebook.recentPosts.slice(0, 3).map(p => p.content.slice(0, 100)).join(" | ")}`);
  } else if (data.facebook) {
    parts.push(`=== فيسبوك ===\nفشل جلب البيانات: ${data.facebook.error || "خطأ"}`);
  }

  return parts.join("\n\n");
}
