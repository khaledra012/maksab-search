/**
 * Website Intelligence Layer
 * يجلب بيانات حقيقية شاملة عن الموقع قبل التحليل بالـ AI:
 * 1. Google PageSpeed API → Core Web Vitals حقيقية
 * 2. Bright Data Scraper المحسّن → SEO كامل + بنية الموقع
 * 3. Google Custom Search → عدد الصفحات المفهرسة
 */
import { ENV } from "../_core/env";
import { fetchWithScrapingBrowser, fetchViaProxy } from "./brightDataScraper";
import { scrapeWithHeadless, detectFeaturesFromFullHtml } from "./headlessScraper";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PageSpeedData {
  // درجات الأداء (0-100)
  performanceScore: number | null;
  accessibilityScore: number | null;
  seoScore: number | null;
  bestPracticesScore: number | null;

  // Core Web Vitals
  lcp: number | null;          // Largest Contentful Paint (ms)
  fid: number | null;          // First Input Delay (ms)
  cls: number | null;          // Cumulative Layout Shift
  fcp: number | null;          // First Contentful Paint (ms)
  ttfb: number | null;         // Time to First Byte (ms)
  speedIndex: number | null;   // Speed Index (ms)
  tti: number | null;          // Time to Interactive (ms)

  // جوال
  mobilePerformanceScore: number | null;
  mobileLcp: number | null;
  mobileFcp: number | null;

  // تشخيص
  opportunities: string[];     // فرص التحسين
  diagnostics: string[];       // تشخيصات
  passedAudits: string[];      // اختبارات ناجحة

  fetchedSuccessfully: boolean;
  error?: string;
}

export interface SEOIntelligenceData {
  // Meta Tags
  title: string;
  titleLength: number;
  metaDescription: string;
  metaDescriptionLength: number;
  metaKeywords: string;
  canonicalUrl: string;
  robotsMeta: string;

  // Open Graph
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  ogType: string;

  // Headings Structure
  h1Tags: string[];
  h2Tags: string[];
  h3Tags: string[];
  headingStructureScore: number; // 0-10

  // Images
  totalImages: number;
  imagesWithAlt: number;
  imagesWithoutAlt: number;

  // Links
  internalLinksCount: number;
  externalLinksCount: number;
  brokenLinksHint: boolean;

  // Technical SEO
  hasSSL: boolean;
  hasRobotsTxt: boolean;
  hasSitemap: boolean;
  hasSchemaMarkup: boolean;
  schemaTypes: string[];
  hasHreflang: boolean;
  isArabicContent: boolean;
  hasRtlSupport: boolean;

  // Content
  wordCount: number;
  bodyText: string;
  phones: string[];
  hasWhatsapp: boolean;
  hasBooking: boolean;
  hasEcommerce: boolean;
  hasPaymentGateway: boolean;
  hasChatWidget: boolean;
  hasAnalytics: boolean;
  hasGoogleTagManager: boolean;
  hasFacebookPixel: boolean;

  // Indexing (from Google Search)
  indexedPagesCount: number | null;
  domainAgeHint: string;

  fetchedSuccessfully: boolean;
  error?: string;
}

export interface WebsiteIntelligenceReport {
  url: string;
  pagespeed: PageSpeedData;
  seo: SEOIntelligenceData;
  fetchedAt: string;
}

// ─── Google PageSpeed API ─────────────────────────────────────────────────────

export async function fetchPageSpeedData(url: string): Promise<PageSpeedData> {
  const result: PageSpeedData = {
    performanceScore: null,
    accessibilityScore: null,
    seoScore: null,
    bestPracticesScore: null,
    lcp: null, fid: null, cls: null, fcp: null, ttfb: null,
    speedIndex: null, tti: null,
    mobilePerformanceScore: null, mobileLcp: null, mobileFcp: null,
    opportunities: [], diagnostics: [], passedAudits: [],
    fetchedSuccessfully: false,
  };

  const apiKey = ENV.googlePagespeedApiKey;
  if (!apiKey) {
    result.error = "Google PageSpeed API key not configured";
    return result;
  }

  try {
    // جلب بيانات الديسكتوب
    const desktopUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=desktop&key=${apiKey}&category=performance&category=accessibility&category=seo&category=best-practices`;
    const mobileUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&key=${apiKey}&category=performance`;

    const [desktopRes, mobileRes] = await Promise.allSettled([
      fetch(desktopUrl, { signal: AbortSignal.timeout(20000) }).then(r => r.json()),
      fetch(mobileUrl, { signal: AbortSignal.timeout(20000) }).then(r => r.json()),
    ]);

    if (desktopRes.status === "fulfilled" && desktopRes.value?.lighthouseResult) {
      const lhr = desktopRes.value.lighthouseResult;
      const cats = lhr.categories || {};
      const audits = lhr.audits || {};

      result.performanceScore = Math.round((cats.performance?.score ?? 0) * 100);
      result.accessibilityScore = Math.round((cats.accessibility?.score ?? 0) * 100);
      result.seoScore = Math.round((cats.seo?.score ?? 0) * 100);
      result.bestPracticesScore = Math.round((cats["best-practices"]?.score ?? 0) * 100);

      // Core Web Vitals
      result.lcp = audits["largest-contentful-paint"]?.numericValue ? Math.round(audits["largest-contentful-paint"].numericValue) : null;
      result.fid = audits["max-potential-fid"]?.numericValue ? Math.round(audits["max-potential-fid"].numericValue) : null;
      result.cls = audits["cumulative-layout-shift"]?.numericValue ?? null;
      result.fcp = audits["first-contentful-paint"]?.numericValue ? Math.round(audits["first-contentful-paint"].numericValue) : null;
      result.ttfb = audits["server-response-time"]?.numericValue ? Math.round(audits["server-response-time"].numericValue) : null;
      result.speedIndex = audits["speed-index"]?.numericValue ? Math.round(audits["speed-index"].numericValue) : null;
      result.tti = audits["interactive"]?.numericValue ? Math.round(audits["interactive"].numericValue) : null;

      // فرص التحسين
      result.opportunities = Object.values(audits)
        .filter((a: any) => a.details?.type === "opportunity" && a.score !== null && a.score < 0.9)
        .map((a: any) => a.title)
        .slice(0, 5);

      // تشخيصات
      result.diagnostics = Object.values(audits)
        .filter((a: any) => a.details?.type === "table" && a.score !== null && a.score < 0.9)
        .map((a: any) => a.title)
        .slice(0, 5);

      // اختبارات ناجحة
      result.passedAudits = Object.values(audits)
        .filter((a: any) => a.score === 1)
        .map((a: any) => a.title)
        .slice(0, 5);

      result.fetchedSuccessfully = true;
    }

    if (mobileRes.status === "fulfilled" && mobileRes.value?.lighthouseResult) {
      const lhr = mobileRes.value.lighthouseResult;
      const cats = lhr.categories || {};
      const audits = lhr.audits || {};
      result.mobilePerformanceScore = Math.round((cats.performance?.score ?? 0) * 100);
      result.mobileLcp = audits["largest-contentful-paint"]?.numericValue ? Math.round(audits["largest-contentful-paint"].numericValue) : null;
      result.mobileFcp = audits["first-contentful-paint"]?.numericValue ? Math.round(audits["first-contentful-paint"].numericValue) : null;
    }

  } catch (err: any) {
    result.error = err.message;
    result.fetchedSuccessfully = false;
  }

  return result;
}

// ─── SEO Intelligence via Bright Data ────────────────────────────────────────

export async function fetchSEOIntelligence(url: string): Promise<SEOIntelligenceData> {
  const result: SEOIntelligenceData = {
    title: "", titleLength: 0,
    metaDescription: "", metaDescriptionLength: 0,
    metaKeywords: "", canonicalUrl: "", robotsMeta: "",
    ogTitle: "", ogDescription: "", ogImage: "", ogType: "",
    h1Tags: [], h2Tags: [], h3Tags: [], headingStructureScore: 0,
    totalImages: 0, imagesWithAlt: 0, imagesWithoutAlt: 0,
    internalLinksCount: 0, externalLinksCount: 0, brokenLinksHint: false,
    hasSSL: url.startsWith("https://"),
    hasRobotsTxt: false, hasSitemap: false, hasSchemaMarkup: false,
    schemaTypes: [], hasHreflang: false, isArabicContent: false, hasRtlSupport: false,
    wordCount: 0, bodyText: "",
    phones: [], hasWhatsapp: false, hasBooking: false,
    hasEcommerce: false, hasPaymentGateway: false,
    hasChatWidget: false, hasAnalytics: false,
    hasGoogleTagManager: false, hasFacebookPixel: false,
    indexedPagesCount: null, domainAgeHint: "",
    fetchedSuccessfully: false,
  };

  try {
    // جلب HTML الكامل — Headless Browser يعمل دائماً بالتوازي لاكتشاف الميزات بدقة
    let html = "";
    let headlessFeatures: ReturnType<typeof detectFeaturesFromFullHtml> | null = null;

    // تشغيل Headless Browser بالتوازي مع Bright Data (بدون انتظار)
    const headlessPromise = scrapeWithHeadless(url, 20000).then(r => {
      if (r.success && r.html.length > 100) {
        return detectFeaturesFromFullHtml(r.html, r.text);
      }
      return null;
    }).catch(() => null);

    // جلب HTML للـ meta/SEO عبر Bright Data أو Proxy
    try {
      html = await fetchWithScrapingBrowser(url);
    } catch {
      try {
        html = await fetchViaProxy(url);
      } catch {
        // إذا فشل كلاهما، انتظر Headless للحصول على HTML
        console.log(`[WebsiteIntelligence] Both Bright Data & Proxy failed, waiting for Headless: ${url}`);
        const headlessResult = await scrapeWithHeadless(url);
        if (headlessResult.success && headlessResult.html.length > 100) {
          html = headlessResult.html;
          if (headlessResult.title) result.title = headlessResult.title;
          if (headlessResult.metaDescription) result.metaDescription = headlessResult.metaDescription;
        } else {
          result.error = headlessResult.error || "All fetch methods failed";
          return result;
        }
      }
    }

    if (!html || html.length < 100) {
      result.error = "Empty response";
      return result;
    }

    // انتظار نتائج Headless Browser (اكتشاف الميزات الدقيق)
    headlessFeatures = await headlessPromise;

    // Headless Browser يُستخدم دائماً لاكتشاف الميزات إذا نجح
    const skipFeatureDetection = headlessFeatures !== null;

    const domain = new URL(url).hostname;

    // ─── Meta Tags ───
    result.title = extractTag(html, /<title[^>]*>([^<]+)<\/title>/i) || "";
    result.titleLength = result.title.length;
    result.metaDescription = extractMeta(html, "description") || extractMeta(html, "og:description") || "";
    result.metaDescriptionLength = result.metaDescription.length;
    result.metaKeywords = extractMeta(html, "keywords") || "";
    result.canonicalUrl = extractAttr(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) || "";
    result.robotsMeta = extractMeta(html, "robots") || "";

    // ─── Open Graph ───
    result.ogTitle = extractMeta(html, "og:title") || "";
    result.ogDescription = extractMeta(html, "og:description") || "";
    result.ogImage = extractMeta(html, "og:image") || "";
    result.ogType = extractMeta(html, "og:type") || "";

    // ─── Headings ───
    result.h1Tags = extractAllTags(html, /<h1[^>]*>([\s\S]*?)<\/h1>/gi).slice(0, 5);
    result.h2Tags = extractAllTags(html, /<h2[^>]*>([\s\S]*?)<\/h2>/gi).slice(0, 8);
    result.h3Tags = extractAllTags(html, /<h3[^>]*>([\s\S]*?)<\/h3>/gi).slice(0, 8);

    // تقييم بنية الـ headings
    let headingScore = 0;
    if (result.h1Tags.length === 1) headingScore += 4;
    else if (result.h1Tags.length > 1) headingScore += 2;
    if (result.h2Tags.length >= 2) headingScore += 3;
    if (result.h3Tags.length >= 2) headingScore += 3;
    result.headingStructureScore = Math.min(headingScore, 10);

    // ─── Images ───
    const imgMatches = html.match(/<img[^>]+>/gi) || [];
    result.totalImages = imgMatches.length;
    result.imagesWithAlt = imgMatches.filter(img => /alt=["'][^"']+["']/i.test(img)).length;
    result.imagesWithoutAlt = result.totalImages - result.imagesWithAlt;

    // ─── Links ───
    const allLinks = html.match(/href=["']([^"']+)["']/gi) || [];
    result.internalLinksCount = allLinks.filter(l => {
      const href = l.replace(/href=["']/, "").replace(/["']$/, "");
      return href.startsWith("/") || href.includes(domain);
    }).length;
    result.externalLinksCount = allLinks.filter(l => {
      const href = l.replace(/href=["']/, "").replace(/["']$/, "");
      return href.startsWith("http") && !href.includes(domain);
    }).length;

    // ─── Technical SEO ───
    result.hasSchemaMarkup = /"@context"\s*:\s*"https?:\/\/schema\.org"/i.test(html);
    if (result.hasSchemaMarkup) {
      const schemaMatches = html.match(/"@type"\s*:\s*"([^"]+)"/gi) || [];
      result.schemaTypes = Array.from(new Set(schemaMatches.map(m => m.replace(/"@type"\s*:\s*"/, "").replace(/"$/, "")))).slice(0, 5);
    }
    result.hasHreflang = /hreflang/i.test(html);
    result.isArabicContent = /[\u0600-\u06FF]/.test(html) || /lang=["']ar["']/i.test(html);
    result.hasRtlSupport = /dir=["']rtl["']/i.test(html) || /direction:\s*rtl/i.test(html);

    // ─── Content Analysis ───
    const bodyText = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    result.bodyText = bodyText.slice(0, 3000);
    result.wordCount = bodyText.split(/\s+/).filter(w => w.length > 2).length;

    // ─── Contact & Features (متجاوز إذا استُخدم Headless Browser لأن النتائج محددة بدقة أعلى) ───
    if (!skipFeatureDetection) {
      const saudiPhonePattern = /(?:05\d{8}|009665\d{8}|\+9665\d{8}|011\d{7}|012\d{7}|013\d{7})/g;
      result.phones = Array.from(new Set(html.match(saudiPhonePattern) || [])).slice(0, 5);
      result.hasWhatsapp = /whatsapp|wa\.me|واتساب/i.test(html);
      result.hasBooking = /booking|reservation|حجز|موعد|book now|تحديد موعد/i.test(html);
      result.hasEcommerce = /cart|checkout|add to cart|سلة|شراء|buy now|order now|إضافة للسلة/i.test(html);
      result.hasPaymentGateway = /mada|visa|mastercard|paypal|stripe|moyasar|hyperpay|tap payment|مدى|بطاقة/i.test(html);
      result.hasChatWidget = /tawk\.to|intercom|zendesk|crisp|livechat|tidio|freshchat/i.test(html);
      result.hasAnalytics = /google-analytics|gtag|ga\(|analytics\.js|UA-\d+/i.test(html);
      result.hasGoogleTagManager = /googletagmanager|GTM-/i.test(html);
      result.hasFacebookPixel = /fbq\(|facebook\.net\/en_US\/fbevents|connect\.facebook\.net/i.test(html);
    } else {
      // Headless: فقط GTM و Facebook Pixel لأنهما لم يُغطيا أعلاه
      result.hasGoogleTagManager = /googletagmanager|GTM-/i.test(html);
      result.hasFacebookPixel = /fbq\(|facebook\.net\/en_US\/fbevents|connect\.facebook\.net/i.test(html);
    }

    // ─── robots.txt & sitemap ───
    try {
      const robotsUrl = `${url.replace(/\/$/, "").split("/").slice(0, 3).join("/")}/robots.txt`;
      const robotsRes = await fetch(robotsUrl, { signal: AbortSignal.timeout(5000) });
      if (robotsRes.ok) {
        result.hasRobotsTxt = true;
        const robotsText = await robotsRes.text();
        result.hasSitemap = /sitemap/i.test(robotsText);
      }
    } catch { /* ignore */ }

    // ─── Google Indexed Pages ───
    try {
      const googleApiKey = ENV.googleCustomSearchApiKey;
      const googleCx = ENV.googleCustomSearchEngineId;
      if (googleApiKey && googleCx) {
        const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${googleCx}&q=site:${domain}&num=1`;
        const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(8000) });
        const searchData = await searchRes.json();
        if (searchData?.searchInformation?.totalResults) {
          result.indexedPagesCount = parseInt(searchData.searchInformation.totalResults) || 0;
        }
      }
    } catch { /* ignore */ }

    result.fetchedSuccessfully = true;

  } catch (err: any) {
    result.error = err.message;
    result.fetchedSuccessfully = false;
  }

  return result;
}

// ─── Full Website Intelligence ────────────────────────────────────────────────

export async function gatherWebsiteIntelligence(url: string): Promise<WebsiteIntelligenceReport> {
  const [pagespeed, seo] = await Promise.allSettled([
    fetchPageSpeedData(url),
    fetchSEOIntelligence(url),
  ]);

  return {
    url,
    pagespeed: pagespeed.status === "fulfilled" ? pagespeed.value : {
      performanceScore: null, accessibilityScore: null, seoScore: null,
      bestPracticesScore: null, lcp: null, fid: null, cls: null, fcp: null,
      ttfb: null, speedIndex: null, tti: null, mobilePerformanceScore: null,
      mobileLcp: null, mobileFcp: null, opportunities: [], diagnostics: [],
      passedAudits: [], fetchedSuccessfully: false, error: "Failed to fetch",
    },
    seo: seo.status === "fulfilled" ? seo.value : {
      title: "", titleLength: 0, metaDescription: "", metaDescriptionLength: 0,
      metaKeywords: "", canonicalUrl: "", robotsMeta: "",
      ogTitle: "", ogDescription: "", ogImage: "", ogType: "",
      h1Tags: [], h2Tags: [], h3Tags: [], headingStructureScore: 0,
      totalImages: 0, imagesWithAlt: 0, imagesWithoutAlt: 0,
      internalLinksCount: 0, externalLinksCount: 0, brokenLinksHint: false,
      hasSSL: url.startsWith("https://"), hasRobotsTxt: false, hasSitemap: false,
      hasSchemaMarkup: false, schemaTypes: [], hasHreflang: false,
      isArabicContent: false, hasRtlSupport: false, wordCount: 0, bodyText: "",
      phones: [], hasWhatsapp: false, hasBooking: false, hasEcommerce: false,
      hasPaymentGateway: false, hasChatWidget: false, hasAnalytics: false,
      hasGoogleTagManager: false, hasFacebookPixel: false,
      indexedPagesCount: null, domainAgeHint: "", fetchedSuccessfully: false,
    },
    fetchedAt: new Date().toISOString(),
  };
}

// ─── Build AI Context from Intelligence ──────────────────────────────────────

export function buildWebsiteIntelligenceContext(report: WebsiteIntelligenceReport): string {
  const { pagespeed, seo } = report;
  const lines: string[] = [];

  lines.push("═══════════════════════════════════════");
  lines.push("📊 بيانات حقيقية من Google PageSpeed API:");
  lines.push("═══════════════════════════════════════");

  if (pagespeed.fetchedSuccessfully) {
    lines.push(`🖥️ الأداء (ديسكتوب): ${pagespeed.performanceScore ?? "غير متاح"}/100`);
    lines.push(`📱 الأداء (جوال): ${pagespeed.mobilePerformanceScore ?? "غير متاح"}/100`);
    lines.push(`♿ إمكانية الوصول: ${pagespeed.accessibilityScore ?? "غير متاح"}/100`);
    lines.push(`🔍 SEO (تقني): ${pagespeed.seoScore ?? "غير متاح"}/100`);
    lines.push(`✅ أفضل الممارسات: ${pagespeed.bestPracticesScore ?? "غير متاح"}/100`);
    lines.push("");
    lines.push("⚡ Core Web Vitals:");
    if (pagespeed.lcp) lines.push(`  • LCP (أكبر عنصر): ${(pagespeed.lcp / 1000).toFixed(2)}s ${pagespeed.lcp < 2500 ? "✅ جيد" : pagespeed.lcp < 4000 ? "⚠️ يحتاج تحسين" : "❌ بطيء"}`);
    if (pagespeed.fcp) lines.push(`  • FCP (أول محتوى): ${(pagespeed.fcp / 1000).toFixed(2)}s ${pagespeed.fcp < 1800 ? "✅ جيد" : "⚠️ بطيء"}`);
    if (pagespeed.cls !== null) lines.push(`  • CLS (استقرار التخطيط): ${pagespeed.cls.toFixed(3)} ${pagespeed.cls < 0.1 ? "✅ جيد" : pagespeed.cls < 0.25 ? "⚠️ متوسط" : "❌ سيء"}`);
    if (pagespeed.ttfb) lines.push(`  • TTFB (وقت الاستجابة): ${pagespeed.ttfb}ms ${pagespeed.ttfb < 800 ? "✅ جيد" : "⚠️ بطيء"}`);
    if (pagespeed.tti) lines.push(`  • TTI (وقت التفاعل): ${(pagespeed.tti / 1000).toFixed(2)}s`);
    if (pagespeed.speedIndex) lines.push(`  • Speed Index: ${(pagespeed.speedIndex / 1000).toFixed(2)}s`);

    if (pagespeed.opportunities.length > 0) {
      lines.push("");
      lines.push("🔧 فرص تحسين الأداء:");
      pagespeed.opportunities.forEach(o => lines.push(`  • ${o}`));
    }
  } else {
    lines.push(`⚠️ تعذّر جلب بيانات PageSpeed: ${pagespeed.error || "خطأ غير معروف"}`);
  }

  lines.push("");
  lines.push("═══════════════════════════════════════");
  lines.push("🔍 بيانات SEO الحقيقية (Bright Data Scraper):");
  lines.push("═══════════════════════════════════════");

  if (seo.fetchedSuccessfully) {
    // Title & Meta
    lines.push(`📌 العنوان: "${seo.title}" (${seo.titleLength} حرف) ${seo.titleLength >= 50 && seo.titleLength <= 60 ? "✅ مثالي" : seo.titleLength > 0 ? "⚠️ يحتاج تعديل" : "❌ مفقود"}`);
    lines.push(`📝 الوصف: "${seo.metaDescription.slice(0, 100)}..." (${seo.metaDescriptionLength} حرف) ${seo.metaDescriptionLength >= 120 && seo.metaDescriptionLength <= 160 ? "✅ مثالي" : seo.metaDescriptionLength > 0 ? "⚠️ يحتاج تعديل" : "❌ مفقود"}`);
    if (seo.metaKeywords) lines.push(`🔑 الكلمات المفتاحية: ${seo.metaKeywords.slice(0, 100)}`);
    lines.push(`🔗 Canonical URL: ${seo.canonicalUrl || "❌ غير محدد"}`);

    // Headings
    lines.push("");
    lines.push(`📋 بنية العناوين (${seo.headingStructureScore}/10):`);
    lines.push(`  • H1: ${seo.h1Tags.length} ${seo.h1Tags.length === 1 ? "✅" : seo.h1Tags.length === 0 ? "❌ مفقود" : "⚠️ متعدد"} ${seo.h1Tags[0] ? `"${seo.h1Tags[0].slice(0, 60)}"` : ""}`);
    lines.push(`  • H2: ${seo.h2Tags.length} عنوان ${seo.h2Tags.slice(0, 3).map(h => `"${h.slice(0, 40)}"`).join(", ")}`);
    lines.push(`  • H3: ${seo.h3Tags.length} عنوان`);

    // Images
    lines.push("");
    lines.push(`🖼️ الصور: ${seo.totalImages} صورة (${seo.imagesWithAlt} بـ alt ✅ | ${seo.imagesWithoutAlt} بدون alt ❌)`);

    // Links
    lines.push(`🔗 الروابط: ${seo.internalLinksCount} داخلي | ${seo.externalLinksCount} خارجي`);

    // Technical
    lines.push("");
    lines.push("⚙️ SEO التقني:");
    lines.push(`  • SSL/HTTPS: ${seo.hasSSL ? "✅ نعم" : "❌ لا"}`);
    lines.push(`  • robots.txt: ${seo.hasRobotsTxt ? "✅ موجود" : "❌ مفقود"}`);
    lines.push(`  • Sitemap: ${seo.hasSitemap ? "✅ موجود" : "❌ مفقود"}`);
    lines.push(`  • Schema Markup: ${seo.hasSchemaMarkup ? `✅ موجود (${seo.schemaTypes.join(", ")})` : "❌ مفقود"}`);
    lines.push(`  • hreflang: ${seo.hasHreflang ? "✅ موجود" : "❌ مفقود"}`);
    lines.push(`  • محتوى عربي: ${seo.isArabicContent ? "✅ نعم" : "⚠️ لا"}`);
    lines.push(`  • دعم RTL: ${seo.hasRtlSupport ? "✅ نعم" : "⚠️ لا"}`);

    if (seo.indexedPagesCount !== null) {
      lines.push(`  • صفحات مفهرسة في Google: ${seo.indexedPagesCount.toLocaleString("ar-SA")} صفحة`);
    }

    // Content
    lines.push("");
    lines.push(`📄 المحتوى: ~${seo.wordCount} كلمة`);

    // Features
    lines.push("");
    lines.push("🛠️ الميزات التقنية:");
    lines.push(`  • واتساب: ${seo.hasWhatsapp ? "✅" : "❌"}`);
    lines.push(`  • حجز/مواعيد: ${seo.hasBooking ? "✅" : "❌"}`);
    lines.push(`  • تجارة إلكترونية: ${seo.hasEcommerce ? "✅" : "❌"}`);
    lines.push(`  • بوابة دفع: ${seo.hasPaymentGateway ? "✅" : "❌"}`);
    lines.push(`  • شات مباشر: ${seo.hasChatWidget ? "✅" : "❌"}`);
    lines.push(`  • Google Analytics: ${seo.hasAnalytics ? "✅" : "❌"}`);
    lines.push(`  • Google Tag Manager: ${seo.hasGoogleTagManager ? "✅" : "❌"}`);
    lines.push(`  • Facebook Pixel: ${seo.hasFacebookPixel ? "✅" : "❌"}`);

    if (seo.phones.length > 0) {
      lines.push(`  • أرقام هاتف: ${seo.phones.join(", ")}`);
    }

    if (seo.bodyText) {
      lines.push("");
      lines.push(`📃 مقتطف من محتوى الموقع:`);
      lines.push(seo.bodyText.slice(0, 800));
    }
  } else {
    lines.push(`⚠️ تعذّر جلب بيانات SEO: ${seo.error || "خطأ غير معروف"}`);
  }

  return lines.join("\n");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractTag(html: string, pattern: RegExp): string {
  const match = html.match(pattern);
  return match ? match[1].replace(/<[^>]+>/g, "").trim() : "";
}

function extractMeta(html: string, name: string): string {
  const patterns = [
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, "i"),
    new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${name}["']`, "i"),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) return m[1].trim();
  }
  return "";
}

function extractAttr(html: string, pattern: RegExp): string {
  const match = html.match(pattern);
  return match ? match[1].trim() : "";
}

function extractAllTags(html: string, pattern: RegExp): string[] {
  const results: string[] = [];
  let match;
  const regex = new RegExp(pattern.source, pattern.flags);
  while ((match = regex.exec(html)) !== null) {
    const text = match[1].replace(/<[^>]+>/g, "").trim();
    if (text) results.push(text);
  }
  return results;
}
