/**
 * SEO Advanced Analysis Engine
 * يجمع بيانات SEO متقدمة عبر:
 * 1. Bright Data SERP → ترتيب الموقع في نتائج البحث
 * 2. Google Custom Search → الكلمات المفتاحية والمنافسين
 * 3. Bright Data Scraper → تحليل Backlinks من Open Link Profile
 * 4. AI → تفسير البيانات وتوليد توصيات
 */
import { ENV } from "../_core/env";
import { fetchViaProxy, fetchWithScrapingBrowser } from "./brightDataScraper";
import { invokeLLM } from "../_core/llm";
import { gatherWebsiteIntelligence, buildWebsiteIntelligenceContext } from "./websiteIntelligence";

// ========================================
export interface KeywordData {
  keyword: string;
  volume: string;
  position: number | null;
  difficulty: string;
}

export interface CompetitorData {
  name: string;
  url: string;
  seoScore: number;
  strengths: string[];
}

export interface RankingData {
  keyword: string;
  position: number | null;
  url: string;
  snippet: string;
}

export interface SeoAdvancedReport {
  // الكلمات المفتاحية
  topKeywords: KeywordData[];
  missingKeywords: string[];
  keywordOpportunities: string[];

  // الـ Backlinks
  estimatedBacklinks: number;
  backlinkQuality: "weak" | "average" | "good" | "strong";
  topReferringDomains: string[];
  backlinkGaps: string[];

  // المنافسون
  competitors: CompetitorData[];
  competitorGaps: string[];
  competitiveAdvantages: string[];

  // ترتيب البحث
  searchRankings: RankingData[];
  brandMentions: number;
  localSeoScore: number;

  // ملخص
  overallSeoHealth: "critical" | "weak" | "average" | "good" | "excellent";
  seoSummary: string;
  priorityActions: string[];
}

// ========================================
async function fetchSerpResults(query: string): Promise<string> {
  const apiToken = ENV.brightDataApiToken;
  const serpZone = ENV.brightDataSerpZone || "serp_api1";

  if (!apiToken) {
    return "";
  }

  try {
    // استخدام Bright Data REST API الصحيح مع URL مشفر بالكامل
    const targetUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=10&hl=ar&gl=sa`;
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
    if (!response.ok) return "";
    return await response.text();
  } catch {
    return "";
  }
}

// ========================================
function extractSerpSnippets(html: string): { title: string; url: string; snippet: string }[] {
  const results: { title: string; url: string; snippet: string }[] = [];
  if (!html) return results;

  // استخراج URLs من نتائج البحث - نستخدم jsname="UWckNb" الذي يحتوي على روابط النتائج الحقيقية
  const urlPattern = /jsname="UWckNb"[^>]*href="([^"]+)"/g;
  // fallback: href مباشر
  const urlFallback = /href="(https?:\/\/(?!(?:www\.)?(?:google|gstatic|googleapis|youtube|facebook|twitter|instagram|tiktok|snapchat|linkedin|pinterest|reddit|wikipedia|amazon|noon|tripadvisor|yelp|foursquare|maps\.google))[^"]+)"/g;
  const titlePattern = /<h3[^>]*>([^<]+)<\/h3>/g;

  let urlMatch;
  let titleMatch;
  const urls: string[] = [];
  const titles: string[] = [];

  // محاولة استخراج بـ jsname أولاً
  while ((urlMatch = urlPattern.exec(html)) !== null) {
    const url = urlMatch[1];
    if (url.startsWith("http") && !url.includes("google")) {
      urls.push(url);
    }
  }

  // إذا لم نجد نتائج، نستخدم الـ fallback
  if (urls.length === 0) {
    while ((urlMatch = urlFallback.exec(html)) !== null) {
      const url = urlMatch[1];
      if (!urls.includes(url)) urls.push(url);
    }
  }

  while ((titleMatch = titlePattern.exec(html)) !== null) {
    const title = titleMatch[1].replace(/<[^>]+>/g, "").trim();
    if (title) titles.push(title);
  }

  const count = Math.min(urls.length, Math.max(titles.length, 1), 10);
  for (let i = 0; i < count; i++) {
    results.push({ title: titles[i] || "", url: urls[i] || "", snippet: "" });
  }

  return results;
}

// ========================================
async function checkKeywordRanking(domain: string, keyword: string): Promise<number | null> {
  const html = await fetchSerpResults(keyword);
  if (!html) return null;

  const domainClean = domain.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
  const results = extractSerpSnippets(html);

  for (let i = 0; i < results.length; i++) {
    if (results[i].url.includes(domainClean)) {
      return i + 1;
    }
  }
  return null;
}

// ========================================
// نطاقات المحتوى غير التجاري (مقالات ومدونات ومحتوى)
const NON_BUSINESS_DOMAINS = [
  "youtube.com", "facebook.com", "instagram.com", "twitter.com", "tiktok.com",
  "snapchat.com", "linkedin.com", "pinterest.com",
  "wikipedia.org", "wikihow.com",
  "blogger.com", "blogspot.com", "wordpress.com", "medium.com",
  "reddit.com", "quora.com",
  "almaany.com", "mawdoo3.com", "almrsal.com", "sotor.com", "3rbseyes.com",
  "dorar.net", "islamweb.net", "islamqa.info",
  "zad.com.sa", "saudigazette.com.sa", "arabnews.com", "alriyadh.com",
  "sabq.org", "okaz.com.sa", "alyaum.com", "saudipost.net",
  "tripadvisor.com", "foursquare.com", "yelp.com",
  "maps.google.com", "goo.gl",
  "amazon.com", "amazon.sa",
  "noon.com", "jarir.com",
  "gov.sa", "moci.gov.sa", "zatca.gov.sa",
];

// كلمات تدل على محتوى غير تجاري في عنوان الصفحة
const NON_BUSINESS_TITLE_KEYWORDS = [
  "طريقة", "كيفية", "ما هو", "تعريف", "فوائد", "أسباب", "نصائح",
  "مقال", "دليل", "شرح", "تجربتي", "مراجعة",
  "how to", "what is", "guide", "tips", "review", "best",
  "أفضل 10", "أفضل 5", "أفضل مطاعم", "قائمة",
];

function isLikelyBusinessUrl(url: string, title: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    // استبعاد النطاقات غير التجارية
    if (NON_BUSINESS_DOMAINS.some(d => hostname === d || hostname.endsWith(`.${d}`))) {
      return false;
    }
    // استبعاد العناوين التي تدل على محتوى
    const lowerTitle = title.toLowerCase();
    if (NON_BUSINESS_TITLE_KEYWORDS.some(kw => lowerTitle.includes(kw))) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// ========================================
async function findCompetitors(
  businessType: string,
  city: string,
  domain: string
): Promise<{ name: string; url: string }[]> {
  const domainClean = domain.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

  // استعلامات متعددة للبحث عن نشاطات تجارية حقيقية
  const queries = [
    `أفضل ${businessType} في ${city} site:com.sa OR site:sa`,
    `${businessType} ${city} متجر موقع رسمي`,
    `${businessType} ${city}`,
  ];

  const allResults: { name: string; url: string }[] = [];

  for (const query of queries) {
    if (allResults.length >= 4) break;
    const html = await fetchSerpResults(query);
    if (!html) continue;

    const results = extractSerpSnippets(html);
    for (const r of results) {
      if (!r.url || r.url.includes(domainClean)) continue;
      if (!isLikelyBusinessUrl(r.url, r.title)) continue;

      // تجنب التكرار
      const alreadyAdded = allResults.some(existing => {
        try {
          return new URL(existing.url).hostname === new URL(r.url).hostname;
        } catch { return false; }
      });
      if (alreadyAdded) continue;

      allResults.push({
        name: r.title || new URL(r.url).hostname,
        url: r.url,
      });

      if (allResults.length >= 4) break;
    }
  }

  return allResults;
}// ===== Estimate backlinks via scraping =====
async function estimateBacklinks(url: string): Promise<{ count: number; domains: string[] }> {
  try {
    const domain = url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "").split("/")[0];
    const query = `link:${domain} -site:${domain}`;
    const html = await fetchSerpResults(query);
    if (!html) return { count: 0, domains: [] };

    const results = extractSerpSnippets(html);
    const domains = results
      .map((r) => {
        try { return new URL(r.url).hostname; } catch { return ""; }
      })
      .filter(Boolean);

    // تقدير عدد الـ backlinks - نحاول أنماط متعددة
    const countPatterns = [
      /(\d[\d,]+)\s*نتيجة/i,
      /About\s*([\d,]+)\s*results/i,
      /([\d,]+)\s*results/i,
    ];
    let count = 0;
    for (const pattern of countPatterns) {
      const m = html.match(pattern);
      if (m) {
        count = parseInt((m[1] || "0").replace(/,/g, ""));
        if (count > 0) break;
      }
    }
    // إذا لم نجد رقماً، نقدّر بناءً على عدد النتائج
    if (count === 0) count = domains.length * 15;

    const uniqueDomains = Array.from(new Set(domains)).slice(0, 5);
    return { count: Math.min(count, 50000), domains: uniqueDomains };
  } catch {
    return { count: 0, domains: [] };
  }
}

// ===== Main Analysis Function =====
export async function runSeoAdvancedAnalysis(params: {
  url: string;
  companyName: string;
  businessType: string;
  city: string;
  websiteContent?: string;
  additionalNotes?: string;
  pagespeedData?: {
    seoScore: number | null;
    performanceScore: number | null;
    mobilePerformanceScore: number | null;
  };
}): Promise<SeoAdvancedReport> {
    const { url, companyName, businessType, city, websiteContent, pagespeedData, additionalNotes } = params;
  const domain = url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "").split("/")[0];
  // ========================================
  const [
    websiteIntelResult,
    brandRankingHtml,
    businessRankingHtml,
    competitorsList,
    backlinkData,
  ] = await Promise.allSettled([
    gatherWebsiteIntelligence(url),
    fetchSerpResults(`${companyName} ${city}`),
    fetchSerpResults(`أفضل ${businessType} في ${city}`),
    findCompetitors(businessType, city, url),
    estimateBacklinks(url),
  ]);
  // استخراج بيانات الموقع الحقيقية
  const websiteIntel = websiteIntelResult.status === "fulfilled" ? websiteIntelResult.value : null;
  const realPagespeed = websiteIntel?.pagespeed;
  const realSeo = websiteIntel?.seo;
  const websiteIntelContext = websiteIntel ? buildWebsiteIntelligenceContext(websiteIntel) : "";

  const brandHtml = brandRankingHtml.status === "fulfilled" ? brandRankingHtml.value : "";
  const businessHtml = businessRankingHtml.status === "fulfilled" ? businessRankingHtml.value : "";
  const competitors = competitorsList.status === "fulfilled" ? competitorsList.value : [];
  const backlinks = backlinkData.status === "fulfilled" ? backlinkData.value : { count: 0, domains: [] };

  // ========================================
  const brandPosition = brandHtml
    ? extractSerpSnippets(brandHtml).findIndex((r) => r.url.includes(domain)) + 1 || null
    : null;
  const businessPosition = businessHtml
    ? extractSerpSnippets(businessHtml).findIndex((r) => r.url.includes(domain)) + 1 || null
    : null;

  // ========================================
  const brandMentions = brandHtml
    ? (brandHtml.match(new RegExp(companyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")) || []).length
    : 0;

  // ========================================
  // متغيرات مسبقة لتجنب template literal المتداخل
  const brandPositionStr = brandPosition ? String(brandPosition) : "null";
  const businessPositionStr = businessPosition ? String(businessPosition) : "null";
  const backlinkCountStr = String(backlinks.count);
  const brandMentionsStr = String(brandMentions);
  const backlinksDomainsJson = JSON.stringify(backlinks.domains);
  // تحديد درجات PageSpeed الحقيقية (PageSpeed API أولاً، ثم الممرر من params كبديل)
  const effectiveSeoScore = realPagespeed?.fetchedSuccessfully ? realPagespeed.seoScore : pagespeedData?.seoScore;
  const effectivePerfScore = realPagespeed?.fetchedSuccessfully ? realPagespeed.performanceScore : pagespeedData?.performanceScore;
  const effectiveMobileScore = realPagespeed?.fetchedSuccessfully ? realPagespeed.mobilePerformanceScore : pagespeedData?.mobilePerformanceScore;
  const effectiveBodyText = realSeo?.fetchedSuccessfully ? realSeo.bodyText : websiteContent;

  const fallbackWebsiteInfo = websiteIntelContext || [
    `درجة SEO: ${effectiveSeoScore ?? "غير متوفرة"}/100`,
    `درجة الأداء: ${effectivePerfScore ?? "غير متوفرة"}/100`,
    `درجة الجوال: ${effectiveMobileScore ?? "غير متوفرة"}/100`,
  ].join("\n");

  const serpContext = `
=== بيانات الموقع الحقيقية ===
${fallbackWebsiteInfo}

=== بيانات SERP ===
نتائج البحث عن اسم النشاط "${companyName} ${city}": ${brandHtml ? "متوفرة" : "غير متوفرة"}
ترتيب الموقع عند البحث باسم النشاط: ${brandPosition ? `المركز ${brandPosition}` : "غير مرتب في أول 10 نتائج"}
ترتيب الموقع عند البحث بنوع النشاط (أفضل ${businessType} في ${city}): ${businessPosition ? `المركز ${businessPosition}` : "غير مرتب في أول 10 نتائج"}
المنافسون المكتشفون من SERP: ${competitors.map((c) => `${c.name || ""} (${c.url})`).join(", ") || "لم يُكتشف منافسون"}

=== بيانات Backlinks ===
تقدير عدد الـ Backlinks: ${backlinks.count}
نطاقات مرجعية: ${backlinks.domains.join(", ") || "لا توجد"}
ملاحظة: هذا تقدير مبني على SERP. للحصول على بيانات دقيقة ينصح باستخدام Ahrefs أو SEMrush.
${effectiveBodyText ? `
=== محتوى الموقع ===
${effectiveBodyText.slice(0, 1000)}` : ""}
`;

    const additionalNotesSection = additionalNotes?.trim()
      ? `\n\n**معلومات إضافية من صاحب النشاط (ضعها في الاعتبار عند كل تحليل):**\n${additionalNotes}`
      : "";
    const prompt = `أنت خبير SEO متخصص في السوق السعودي. مهمتك تحليل بيانات حقيقية وتقديم رؤى منطقية مبنية على الأدلة.
بيانات الموقع الحقيقية لـ "${companyName}" (${businessType} في ${city}):${additionalNotesSection}
${serpContext}

تعليمات التحليل المنطقي:

1. **الكلمات المفتاحية**: بناءً على نوع النشاط (${businessType}) والمدينة (${city}) ومحتوى الموقع الفعلي، اقترح كلمات مفتاحية واقعية يبحث عنها العملاء في السعودية. إذا كان عنوان الصفحة أو H1 متوفراً، استخدمه لاستنتاج الكلمات المستهدفة حالياً.

2. **المنافسون (حرج جداً)**: 
   - استخدم فقط المنافسين المكتشفين من SERP إذا كانوا نشاطات تجارية حقيقية
   - المنافس يجب أن يكون: متجر، شركة، مطعم، محل، مستشفى، أو أي نشاط تجاري في نفس مجال ${businessType}
   - ممنوع منعاً باتاً: مقالات، مدونات، منصات اجتماعية، مواقع إخبارية، مواقع تجميعية
   - إذا لم تجد منافسين حقيقيين من SERP، اقترح 3-4 منافسين تجاريين واقعيين معروفين في ${city} لهذا النشاط

3. **تقييم الـ Backlinks**: 
   - العدد ${backlinks.count} هو تقدير من SERP وليس دقيقاً
   - قيّم الجودة بناءً على: العدد + نوع النطاقات المرجعية + حجم النشاط
   - كن صريحاً: إذا كان العدد منخفضاً جداً أو البيانات غير موثوقة، قل ذلك في الملخص

4. **درجة SEO المحلية**: احسبها بناءً على:
   - هل الموقع مُحسَّن للعربية؟ (${realSeo?.isArabicContent ? "نعم" : "لا"})
   - هل يوجد Schema Markup؟ (${realSeo?.hasSchemaMarkup ? "نعم" : "لا"})
   - هل يوجد SSL؟ (${realSeo?.hasSSL ? "نعم" : "لا"})
   - درجة SEO من PageSpeed: ${effectiveSeoScore ?? "غير متوفرة"}
   - ترتيب الموقع في البحث المحلي: ${businessPosition ? `المركز ${businessPosition}` : "غير مرتب"}

5. **الملخص**: كن صريحاً وعملياً. اذكر أقوى نقطة وأضعف نقطة بوضوح. لا تبالغ في التفاؤل.

6. **الأولويات**: رتّب حسب التأثير التجاري الفوري. الأولوية الأولى يجب أن تكون الأكثر تأثيراً على الإيرادات.

أجب بـ JSON فقط:
{
  "topKeywords": [
    {"keyword": "كلمة مفتاحية واقعية", "volume": "عالي/متوسط/منخفض", "position": null, "difficulty": "سهل/متوسط/صعب"}
  ],
  "missingKeywords": ["كلمة مفتاحية مهمة غائبة عن المحتوى"],
  "keywordOpportunities": ["فرصة محددة مع تأثيرها التجاري"],
  "estimatedBacklinks": ${backlinkCountStr},
  "backlinkQuality": "weak|average|good|strong",
  "topReferringDomains": ${backlinksDomainsJson},
  "backlinkGaps": ["نطاق تجاري مهم يجب الحصول على رابط منه"],
  "competitors": [
    {"name": "اسم نشاط تجاري حقيقي", "url": "رابطه الفعلي", "seoScore": 7, "strengths": ["ميزة تنافسية حقيقية"]}
  ],
  "competitorGaps": ["ثغرة محددة مقارنة بالمنافسين"],
  "competitiveAdvantages": ["ميزة تنافسية يمكن استغلالها فوراً"],
  "searchRankings": [
    {"keyword": "${companyName}", "position": ${brandPositionStr}, "url": "${url}", "snippet": "وصف مختصر"},
    {"keyword": "${businessType} ${city}", "position": ${businessPositionStr}, "url": "${url}", "snippet": "وصف مختصر"}
  ],
  "brandMentions": ${brandMentionsStr},
  "localSeoScore": 5,
  "overallSeoHealth": "critical|weak|average|good|excellent",
  "seoSummary": "ملخص تحليلي دقيق في 2-3 جمل يذكر أقوى نقطة وأضعف نقطة والأولوية الفورية",
  "priorityActions": ["إجراء أولوية 1 مع تأثيره التجاري المباشر", "إجراء 2", "إجراء 3"]
}`;
  const response = await invokeLLM({
    messages: [
      { role: "system", content: "أنت خبير SEO. أجب دائماً بـ JSON صحيح فقط." },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" } as any,
  });

  const rawContent = response.choices[0]?.message?.content;
  const content = typeof rawContent === "string" ? rawContent : "{}";
  let aiResult: any = {};
  try { aiResult = JSON.parse(content); } catch { aiResult = {}; }

  // دمج البيانات الحقيقية مع تحليل AI
  return {
    topKeywords: aiResult.topKeywords ?? [],
    missingKeywords: aiResult.missingKeywords ?? [],
    keywordOpportunities: aiResult.keywordOpportunities ?? [],
    estimatedBacklinks: backlinks.count || aiResult.estimatedBacklinks || 0,
    backlinkQuality: aiResult.backlinkQuality ?? "weak",
    topReferringDomains: backlinks.domains.length > 0 ? backlinks.domains : (aiResult.topReferringDomains ?? []),
    backlinkGaps: aiResult.backlinkGaps ?? [],
    competitors: (competitors.length > 0
      ? competitors.map((c, i) => ({
          name: c.name,
          url: c.url,
          seoScore: aiResult.competitors?.[i]?.seoScore ?? 5,
          strengths: aiResult.competitors?.[i]?.strengths ?? [],
        }))
      : aiResult.competitors ?? []),
    competitorGaps: aiResult.competitorGaps ?? [],
    competitiveAdvantages: aiResult.competitiveAdvantages ?? [],
    searchRankings: aiResult.searchRankings ?? [
      { keyword: companyName, position: brandPosition, url, snippet: "" },
      { keyword: `${businessType} ${city}`, position: businessPosition, url, snippet: "" },
    ],
    brandMentions,
    localSeoScore: aiResult.localSeoScore ?? 5,
    overallSeoHealth: aiResult.overallSeoHealth ?? "average",
    seoSummary: aiResult.seoSummary ?? "",
    priorityActions: aiResult.priorityActions ?? [],
  };
}
