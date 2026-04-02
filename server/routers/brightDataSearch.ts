import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import puppeteer from "puppeteer-core";
import { invokeLLM } from "../_core/llm";
import { searchInstagramSERP, searchTikTokSERP, searchSnapchatSERP, searchLinkedInSERP, searchFacebookSERP, serpRequest, parseGoogleResultsGeneric } from "./serpSearch";
import { buildGoogleSearchUrl } from "../lib/googleUrlBuilder";
import { searchInstagramByKeyword } from "../lib/brightDataInstagram";
import { scrapeLinkedIn as scrapeLinkedInProfile } from "../lib/brightDataScraper";
import { extractSocialStats, fetchFacebookPagePosts, fetchSnapchatPosts, fetchTikTokProfile, fetchTikTokPosts, fetchTwitterPosts } from "../lib/brightDataSocialDatasets";

// ─── Bright Data Browser API Helper ───────────────────────────────────────────
const BRIGHT_DATA_WS_ENDPOINT = process.env.BRIGHT_DATA_WS_ENDPOINT || "";

function getBrightDataEndpoint(): string {
  if (BRIGHT_DATA_WS_ENDPOINT) return BRIGHT_DATA_WS_ENDPOINT;
  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message: "Bright Data غير مضبوط. يرجى إضافة BRIGHT_DATA_WS_ENDPOINT في الإعدادات.",
  });
}

// فتح متصفح Bright Data
async function openBrightDataBrowser() {
  const endpoint = getBrightDataEndpoint();
  const browser = await puppeteer.connect({
    browserWSEndpoint: endpoint,
  });
  return browser;
}

// helper: sleep بدلاً من waitForTimeout (deprecated في puppeteer v24)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function expandSearchTerm(term: string): string[] {
  const normalized = normalizeSearchText(term);
  const variants = new Set<string>();
  if (!normalized) return [];

  variants.add(normalized);

  if (normalized.startsWith("ال") && normalized.length > 4) {
    variants.add(normalized.slice(2));
  }
  if (normalized.endsWith("ات") && normalized.length > 4) {
    variants.add(normalized.slice(0, -2));
  }
  if (normalized.endsWith("ه") && normalized.length > 3) {
    variants.add(normalized.slice(0, -1));
  }

  return Array.from(variants).filter(Boolean);
}

function getSearchTerms(query: string): string[] {
  const stopWords = new Set(["في", "من", "على", "مع", "عن", "الى", "إلى", "the", "and"]);
  const tokens = normalizeSearchText(query)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !stopWords.has(token));

  return Array.from(new Set(tokens));
}

function hasAnyVariant(text: string, term: string): boolean {
  return expandSearchTerm(term).some((variant) => variant && text.includes(variant));
}

function normalizeSearchLimit(limit?: number): number {
  return Math.min(Math.max(limit ?? 10, 1), 50);
}

const LINKEDIN_VERIFIED_MIN_SCORE = 2.5;
const LINKEDIN_CANDIDATE_MIN_SCORE = 1.5;
const SNAPCHAT_VERIFIED_MIN_SCORE = 2.5;
const SNAPCHAT_CANDIDATE_MIN_SCORE = 1;
const SOFT_FALLBACK_COUNT = 5;

function scoreProfileRelevance(input: {
  query: string;
  location: string;
  name?: string;
  bio?: string;
  contentText?: string;
  website?: string;
  verified?: boolean;
  businessSignals?: number;
}): {
  score: number;
  exactPhraseMatched: boolean;
  locationMatched: boolean;
  matchedTerms: string[];
} {
  const queryText = normalizeSearchText(input.query);
  const locationText = normalizeSearchText(input.location || "");
  const nameText = normalizeSearchText(input.name || "");
  const bioText = normalizeSearchText(input.bio || "");
  const contentText = normalizeSearchText(input.contentText || "");
  const combined = `${nameText} ${bioText} ${contentText}`.trim();
  const terms = getSearchTerms(input.query);

  let score = 0;
  const matchedTerms = new Set<string>();
  const exactPhraseMatched =
    !!queryText &&
    (nameText.includes(queryText) || bioText.includes(queryText) || contentText.includes(queryText));

  if (exactPhraseMatched) score += 4;

  for (const term of terms) {
    if (hasAnyVariant(nameText, term)) {
      score += 2;
      matchedTerms.add(term);
      continue;
    }
    if (hasAnyVariant(bioText, term)) {
      score += 1.5;
      matchedTerms.add(term);
      continue;
    }
    if (hasAnyVariant(contentText, term)) {
      score += 1;
      matchedTerms.add(term);
    }
  }

  const locationMatched =
    !!locationText &&
    (combined.includes(locationText) || hasAnyVariant(combined, locationText));

  if (locationMatched) {
    score += 2;
  } else if (locationText) {
    score -= 1;
  }

  if (input.website) score += 1;
  if (input.verified) score += 0.5;
  if (input.businessSignals) score += Math.min(1.5, input.businessSignals * 0.5);

  if (matchedTerms.size === 0) {
    score -= 4;
  } else if (matchedTerms.size >= Math.min(2, terms.length || 1)) {
    score += 1;
  }

  return {
    score: Math.round(Math.max(0, score) * 10) / 10,
    exactPhraseMatched,
    locationMatched,
    matchedTerms: Array.from(matchedTerms),
  };
}

function scoreTikTokRelevance(input: {
  query: string;
  location: string;
  name?: string;
  bio?: string;
  postsText?: string;
  website?: string;
  verified?: boolean;
}): {
  score: number;
  exactPhraseMatched: boolean;
  locationMatched: boolean;
  matchedTerms: string[];
} {
  return scoreProfileRelevance({
    query: input.query,
    location: input.location,
    name: input.name,
    bio: input.bio,
    contentText: input.postsText,
    website: input.website,
    verified: input.verified,
  });
}

// ─── تحليل النتائج بالذكاء الاصطناعي ─────────────────────────────────────────
async function analyzeResultsWithAI(
  results: any[],
  query: string,
  platform: string
): Promise<any[]> {
  if (!results.length) return results;
  try {
    const prompt = `أنت محلل بيانات للسوق السعودي. قيّم هذه النتائج من ${platform} للبحث عن "${query}".
لكل نتيجة، أضف:
1. relevanceScore: درجة الملاءمة من 1-10
2. businessType: نوع النشاط التجاري بالعربية
3. priority: "عالية" أو "متوسطة" أو "منخفضة"
4. contactSuggestion: اقتراح طريقة التواصل المثلى

البيانات:
${JSON.stringify(results.slice(0, 10), null, 2)}

أرجع JSON object بالشكل: {"results": [...]} مع نفس العناصر مضافاً إليها الحقول المطلوبة.`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: "أنت محلل بيانات متخصص في السوق السعودي. أرجع JSON فقط." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" } as any,
    });

    const content = response?.choices?.[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(typeof content === "string" ? content : "{}");
      if (Array.isArray(parsed)) return parsed;
      if (parsed.results && Array.isArray(parsed.results)) return parsed.results;
    }
  } catch {
    // إذا فشل التحليل، نرجع النتائج الأصلية
  }
  return results;
}

// ─── بحث Instagram (SERP API) ─────────────────────────────────────────────────
async function scrapeInstagram(query: string, location: string, limit = 10): Promise<any[]> {
  const requestedLimit = normalizeSearchLimit(limit);
  // dataset-first for better discovery quality, with SERP fallback only if needed
  try {
    const datasetResult = await searchInstagramByKeyword(query, location, requestedLimit);
    if (datasetResult.success && datasetResult.results.length > 0) {
      return datasetResult.results.slice(0, requestedLimit).map((r) => ({
        platform: "instagram",
        username: r.username,
        name: r.full_name || r.username,
        fullName: r.full_name || r.username,
        profileUrl: r.profile_url,
        profile_url: r.profile_url,
        bio: r.biography || "",
        description: r.biography || "",
        followers: r.followers || 0,
        followersCount: r.followers || 0,
        posts: r.posts_count || 0,
        postsCount: r.posts_count || 0,
        isVerified: !!r.is_verified,
        verified: !!r.is_verified,
        isBusiness: !!r.is_business_account,
        businessType: r.business_category || "",
        businessCategory: r.business_category || "",
        businessEmail: r.business_email || "",
        businessPhone: r.business_phone || "",
        phone: r.business_phone || "",
        website: r.website || "",
        avgEngagement: r.avg_engagement || 0,
        city: location || "",
        verificationLevel: "dataset",
        dataSource: "instagram_dataset",
      }));
    }
  } catch (err) {
    console.warn("[Instagram Dataset] failed, fallback to SERP:", err);
  }

  try {
    const serpResults = await searchInstagramSERP(query, location, requestedLimit);
    return serpResults.slice(0, requestedLimit).map(r => ({
      platform: "instagram",
      username: r.username,
      name: r.displayName,
      fullName: r.displayName,
      profileUrl: r.url,
      profile_url: r.url,
      bio: r.bio,
      description: r.bio,
      website: "",
      phone: "",
      city: location || "",
      verificationLevel: "serp_fallback",
      dataSource: "instagram_serp_fallback",
    }));
  } catch (err) {
    console.warn("[Instagram SERP] failed:", err);
    return [];
  }
}

// ─── بحث TikTok (SERP API) ─────────────────────────────────────────────────────
async function scrapeTikTok(query: string, location: string, limit = 10): Promise<any[]> {
  const requestedLimit = normalizeSearchLimit(limit);
  try {
    const serpResults = await searchTikTokSERP(query, location, requestedLimit);
    const candidates = serpResults
      .filter((r) => r.url && r.username)
      .slice(0, requestedLimit);

    const verified = await Promise.allSettled(
      candidates.map(async (candidate) => {
        const [datasetResult, postsResult] = await Promise.all([
          fetchTikTokProfile(candidate.url),
          fetchTikTokPosts(candidate.url, 5).catch(() => ({ success: false, data: [], platform: "tiktok_posts" as const })),
        ]);
        if (!datasetResult.success || !datasetResult.data?.length) return null;

        const profile = datasetResult.data[0];
        const stats = extractSocialStats("tiktok", datasetResult.data);
        const postStats = postsResult.success && postsResult.data?.length
          ? extractSocialStats("tiktok_posts", postsResult.data)
          : {};
        const resolvedProfileUrl =
          profile.profile_url ||
          candidate.url ||
          `https://www.tiktok.com/@${candidate.username}`;
        const resolvedName =
          profile.nickname ||
          profile.account_id ||
          profile.username ||
          candidate.displayName ||
          candidate.username;
        const resolvedBio = profile.biography || candidate.bio || "";
        const postsText = postStats.recentPosts?.map((post) => post.content).filter(Boolean).join(" | ") || "";
        const relevance = scoreTikTokRelevance({
          query,
          location,
          name: resolvedName,
          bio: resolvedBio,
          postsText,
          website: profile.bio_link || "",
          verified: !!stats.isVerified,
        });

        if (relevance.score < 4) return null;

        return {
          platform: "tiktok",
          username: candidate.username,
          id: candidate.username,
          name: resolvedName,
          fullName: resolvedName,
          displayName: resolvedName,
          profileUrl: resolvedProfileUrl,
          profile_url: resolvedProfileUrl,
          url: resolvedProfileUrl,
          bio: resolvedBio,
          description: resolvedBio,
          followers: stats.followersCount || 0,
          followersCount: stats.followersCount || 0,
          followingCount: profile.following ?? profile.following_count ?? 0,
          likesCount: profile.likes ?? profile.likes_count ?? 0,
          postsCount: stats.postsCount || profile.videos_count || 0,
          avgEngagement: stats.engagementRate || 0,
          avgLikes: postStats.avgLikes || 0,
          avgViews: postStats.avgViews || 0,
          recentPosts: postStats.recentPosts || [],
          website: profile.bio_link || "",
          verified: !!stats.isVerified,
          isVerified: !!stats.isVerified,
          phone: "",
          city: relevance.locationMatched ? location : "",
          rating: relevance.score,
          relevanceScore: relevance.score,
          matchedBy: relevance.matchedTerms,
          exactPhraseMatched: relevance.exactPhraseMatched,
          verificationLevel: "dataset",
          dataSource: "tiktok_dataset_filtered",
        };
      })
    );

    const verifiedResults = verified
      .flatMap((result) => (result.status === "fulfilled" && result.value ? [result.value] : []))
      .slice(0, requestedLimit);

    if (verifiedResults.length > 0) return verifiedResults;

    return candidates
      .map((candidate) => {
        const relevance = scoreTikTokRelevance({
          query,
          location,
          name: candidate.displayName || candidate.username,
          bio: candidate.bio || "",
        });

        if (relevance.score < 4) return null;

        return {
          platform: "tiktok",
          username: candidate.username,
          id: candidate.username,
          name: candidate.displayName || candidate.username,
          fullName: candidate.displayName || candidate.username,
          displayName: candidate.displayName || candidate.username,
          profileUrl: candidate.url,
          profile_url: candidate.url,
          url: candidate.url,
          bio: candidate.bio || "",
          description: candidate.bio || "",
          followers: 0,
          followersCount: 0,
          phone: "",
          city: relevance.locationMatched ? location : "",
          verified: false,
          rating: relevance.score,
          relevanceScore: relevance.score,
          matchedBy: relevance.matchedTerms,
          exactPhraseMatched: relevance.exactPhraseMatched,
          verificationLevel: "candidate_only",
          dataSource: "tiktok_serp_candidate",
        };
      })
      .filter(Boolean)
      .slice(0, requestedLimit);
  } catch (err) {
    console.warn("[TikTok verified search] failed:", err);
    return [];
  }
}

// ─── بحث Twitter/X (عبر SERP API - بدلاً من Puppeteer المحظور) ─────────────────
async function scrapeTwitter(query: string, location: string, limit = 10): Promise<any[]> {
  const requestedLimit = normalizeSearchLimit(limit);
  const locationStr = location ? `${location} السعودية` : "السعودية";
  const queries = [
    `${query} ${locationStr} site:twitter.com OR site:x.com`,
    `${query} ${locationStr} twitter`,
    `${query} السعودية site:x.com`,
    `${query} ${location || "الرياض"} site:x.com`,
    `twitter ${query} ${locationStr} حساب`,
    `x.com ${query} ${locationStr} حساب`,
  ];

  const results: any[] = [];
  const seen = new Set<string>();

  for (const q of queries) {
    try {
      // PHASE 1 FIX: cr=countrySA أُزيل — يُسبب 407 من SERP proxy
      const googleUrl = buildGoogleSearchUrl({ query: q });
      const html = await serpRequest(googleUrl);
      const googleResults = parseGoogleResultsGeneric(html);

      for (const item of googleResults) {
        // استخراج username من URL
        const itemUrl = item.url;
          const usernameMatch = itemUrl.match(/(?:twitter|x)\.com\/([a-zA-Z0-9_]+)(?:\/|$)/);
        if (!usernameMatch) continue;
        const username = usernameMatch[1];
        // تجاهل صفحات عامة
        if (["search", "explore", "home", "i", "hashtag", "intent"].includes(username)) continue;
        if (seen.has(username)) continue;
        seen.add(username);
        results.push({
          platform: "twitter",
          username,
          displayName: item.displayName
            .replace(/ on X$/, "")
            .replace(/ \(@[^)]+\)/, "")
            .replace(/ \| Twitter$/, "")
            .trim(),
          profileUrl: `https://x.com/${username}`,
          bio: item.bio?.substring(0, 200) || "",
          // PHASE 1 FIX: candidatePhones بدل phone: phones[0]
          // الأرقام مستخرجة من نص الصفحة — ليست verified
          candidatePhones: item.candidatePhones,
          verifiedPhones: [],
          dataSource: "serp",
        });
      }
    } catch (err) {
      console.warn(`[Twitter SERP] query failed: ${q}`, err);
    }
    if (results.length >= requestedLimit) break;
  }

  const candidates = results.slice(0, requestedLimit);

  const verified = await Promise.allSettled(
    candidates.map(async (candidate) => {
      const datasetResult = await fetchTwitterPosts(candidate.profileUrl, 8);
      if (!datasetResult.success || !datasetResult.data?.length) return null;

      const stats = extractSocialStats("twitter", datasetResult.data);
      const first = datasetResult.data[0];
      const resolvedName =
        first.name ||
        first.profile_name ||
        candidate.displayName ||
        candidate.username;
      const resolvedBio =
        first.biography ||
        first.description ||
        candidate.bio ||
        "";

      return {
        platform: "twitter",
        username: candidate.username,
        id: candidate.username,
        name: resolvedName,
        fullName: resolvedName,
        displayName: resolvedName,
        profileUrl: candidate.profileUrl,
        profile_url: candidate.profileUrl,
        url: candidate.profileUrl,
        bio: resolvedBio,
        description: resolvedBio,
        followers: first.followers || 0,
        followersCount: first.followers || 0,
        followingCount: first.following || 0,
        postsCount: first.posts_count || stats.postsCount || datasetResult.data.length,
        avgLikes: stats.avgLikes || 0,
        avgViews: stats.avgViews || 0,
        verified: !!first.is_verified,
        isVerified: !!first.is_verified,
        phone: "",
        city: "",
        location: first.location || "",
        verificationLevel: "dataset",
        dataSource: "twitter_dataset_verified",
      };
    })
  );

  const verifiedResults = verified
    .flatMap((result) => (result.status === "fulfilled" && result.value ? [result.value] : []))
    .slice(0, requestedLimit);

  if (verifiedResults.length > 0) return verifiedResults;

  return candidates.slice(0, requestedLimit).map((candidate) => ({
    platform: "twitter",
    username: candidate.username,
    id: candidate.username,
    name: candidate.displayName || candidate.username,
    fullName: candidate.displayName || candidate.username,
    displayName: candidate.displayName || candidate.username,
    profileUrl: candidate.profileUrl,
    profile_url: candidate.profileUrl,
    url: candidate.profileUrl,
    bio: candidate.bio || "",
    description: candidate.bio || "",
    followers: 0,
    followersCount: 0,
    phone: "",
    city: "",
    verified: false,
    verificationLevel: "candidate_only",
    dataSource: "twitter_serp_candidate",
  }));
}

// ─── بحث LinkedIn (عبر SERP API) ───────────────────────────────────
async function scrapeLinkedIn(query: string, location: string, limit = 10): Promise<any[]> {
  const requestedLimit = normalizeSearchLimit(limit);
  try {
    const serpResults = await searchLinkedInSERP(query, location, requestedLimit);
    const candidates = serpResults
      .filter((r) => r.url && r.username)
      .slice(0, requestedLimit);

    const verified = await Promise.allSettled(
      candidates.map(async (candidate) => {
        const scraped = await scrapeLinkedInProfile(candidate.url);
        if (!scraped.loadedSuccessfully) return null;

        const resolvedName =
          scraped.companyName ||
          candidate.displayName ||
          candidate.username;
        const resolvedBio =
          scraped.about ||
          candidate.bio ||
          "";
        const contentText = [
          scraped.tagline,
          scraped.industry,
          ...(scraped.specialties || []),
          ...(scraped.recentPosts || []),
        ]
          .filter(Boolean)
          .join(" | ");
        const businessSignals = [
          scraped.industry,
          scraped.website,
          scraped.employeesCount,
          (scraped.specialties || []).length ? "specialties" : "",
          scraped.followersCount > 0 ? "followers" : "",
        ].filter(Boolean).length;
        const relevance = scoreProfileRelevance({
          query,
          location,
          name: resolvedName,
          bio: resolvedBio,
          contentText,
          website: scraped.website || "",
          businessSignals,
        });

        if (relevance.score < LINKEDIN_VERIFIED_MIN_SCORE) return null;

        return {
          platform: "linkedin",
          username: candidate.username,
          id: candidate.username,
          type: "company",
          name: resolvedName,
          fullName: resolvedName,
          displayName: resolvedName,
          profileUrl: candidate.url,
          profile_url: candidate.url,
          url: candidate.url,
          bio: resolvedBio.substring(0, 300),
          description: resolvedBio.substring(0, 300),
          subtitle: scraped.tagline || scraped.industry || candidate.username,
          phone: "",
          city: relevance.locationMatched ? location : "",
          location: relevance.locationMatched ? location : "",
          followersCount: scraped.followersCount || 0,
          employeesCount: scraped.employeesCount || "",
          industry: scraped.industry || "",
          website: scraped.website || "",
          specialties: scraped.specialties || [],
          rating: relevance.score,
          relevanceScore: relevance.score,
          matchedBy: relevance.matchedTerms,
          exactPhraseMatched: relevance.exactPhraseMatched,
          verificationLevel: "browser_verified",
          dataSource: "linkedin_browser_verified",
        };
      })
    );

    const verifiedResults = verified
      .flatMap((result) => (result.status === "fulfilled" && result.value ? [result.value] : []))
      .slice(0, requestedLimit);

    if (verifiedResults.length > 0) return verifiedResults;

    const scoredCandidates = candidates
      .map((candidate) => ({
        candidate,
        relevance: scoreProfileRelevance({
          query,
          location,
          name: candidate.displayName || candidate.username,
          bio: candidate.bio || "",
        }),
      }))
      .sort((a, b) => b.relevance.score - a.relevance.score);

    const mapCandidateResult = ({ candidate, relevance }: (typeof scoredCandidates)[number]) => ({
      platform: "linkedin",
      username: candidate.username,
      id: candidate.username,
      type: "company",
      name: candidate.displayName || candidate.username,
      fullName: candidate.displayName || candidate.username,
      displayName: candidate.displayName || candidate.username,
      profileUrl: candidate.url,
      profile_url: candidate.url,
      url: candidate.url,
      bio: candidate.bio?.substring(0, 200) || "",
      description: candidate.bio?.substring(0, 200) || "",
      subtitle: candidate.username,
      phone: "",
      city: relevance.locationMatched ? location : "",
      location: relevance.locationMatched ? location : "",
      rating: relevance.score,
      relevanceScore: relevance.score,
      matchedBy: relevance.matchedTerms,
      exactPhraseMatched: relevance.exactPhraseMatched,
      verificationLevel: "candidate_only",
      dataSource: "linkedin_serp_candidate",
    });

    const strongCandidates = scoredCandidates
      .filter(({ relevance }) => relevance.score >= LINKEDIN_CANDIDATE_MIN_SCORE)
      .slice(0, requestedLimit)
      .map(mapCandidateResult);

    if (strongCandidates.length > 0) return strongCandidates;

    return scoredCandidates
      .slice(0, Math.min(requestedLimit, SOFT_FALLBACK_COUNT))
      .map(mapCandidateResult);
  } catch (e) {
    console.error("[LinkedIn SERP] Error:", e);
    return [];
  }
}

// ─── بحث Snapchat ──────────────────────────────────────────────────────────────
async function scrapeSnapchat(query: string, location: string, limit = 10): Promise<any[]> {
  const requestedLimit = normalizeSearchLimit(limit);
  try {
    const serpResults = await searchSnapchatSERP(query, location, requestedLimit);
    const candidates = serpResults
      .filter((r) => r.url && r.username)
      .slice(0, requestedLimit);

    const verified = await Promise.allSettled(
      candidates.map(async (candidate) => {
        const datasetResult = await fetchSnapchatPosts(candidate.url, 6);
        if (!datasetResult.success || !datasetResult.data?.length) return null;

        const stats = extractSocialStats("snapchat", datasetResult.data);
        const resolvedName =
          stats.profileName ||
          candidate.displayName ||
          candidate.username;
        const postsText =
          stats.recentPosts?.map((post) => post.content).filter(Boolean).join(" | ") ||
          "";
        const derivedBio =
          candidate.bio ||
          stats.recentPosts?.map((post) => post.content).filter(Boolean).slice(0, 2).join(" | ") ||
          "";
        const relevance = scoreProfileRelevance({
          query,
          location,
          name: resolvedName,
          bio: derivedBio,
          contentText: postsText,
          businessSignals: stats.postsCount ? 1 : 0,
        });

        if (relevance.score < SNAPCHAT_VERIFIED_MIN_SCORE) return null;

        return {
          platform: "snapchat",
          username: candidate.username,
          id: candidate.username,
          name: resolvedName,
          fullName: resolvedName,
          displayName: resolvedName,
          profileUrl: candidate.url,
          profile_url: candidate.url,
          url: candidate.url,
          bio: derivedBio,
          description: derivedBio,
          followers: 0,
          followersCount: 0,
          postsCount: stats.postsCount || datasetResult.data.length,
          avgViews: stats.avgViews || 0,
          recentPosts: stats.recentPosts || [],
          phone: "",
          city: relevance.locationMatched ? location : "",
          verified: false,
          rating: relevance.score,
          relevanceScore: relevance.score,
          matchedBy: relevance.matchedTerms,
          exactPhraseMatched: relevance.exactPhraseMatched,
          verificationLevel: "browser_verified",
          dataSource: "snapchat_browser_verified",
        };
      })
    );

    const verifiedResults = verified
      .flatMap((result) => (result.status === "fulfilled" && result.value ? [result.value] : []))
      .slice(0, requestedLimit);

    if (verifiedResults.length > 0) return verifiedResults;

    const scoredCandidates = candidates
      .map((candidate) => ({
        candidate,
        relevance: scoreProfileRelevance({
          query,
          location,
          name: candidate.displayName || candidate.username,
          bio: candidate.bio || "",
        }),
      }))
      .sort((a, b) => b.relevance.score - a.relevance.score);

    const mapCandidateResult = ({ candidate, relevance }: (typeof scoredCandidates)[number]) => ({
      platform: "snapchat",
      username: candidate.username,
      id: candidate.username,
      name: candidate.displayName || candidate.username,
      fullName: candidate.displayName || candidate.username,
      displayName: candidate.displayName || candidate.username,
      profileUrl: candidate.url,
      profile_url: candidate.url,
      url: candidate.url,
      bio: candidate.bio || "",
      description: candidate.bio || "",
      followers: 0,
      followersCount: 0,
      phone: "",
      city: relevance.locationMatched ? location : "",
      verified: false,
      rating: relevance.score,
      relevanceScore: relevance.score,
      matchedBy: relevance.matchedTerms,
      exactPhraseMatched: relevance.exactPhraseMatched,
      verificationLevel: "candidate_only",
      dataSource: "snapchat_serp_candidate",
    });

    const strongCandidates = scoredCandidates
      .filter(({ relevance }) => relevance.score >= SNAPCHAT_CANDIDATE_MIN_SCORE)
      .slice(0, requestedLimit)
      .map(mapCandidateResult);

    if (strongCandidates.length > 0) return strongCandidates;

    return scoredCandidates
      .slice(0, Math.min(requestedLimit, SOFT_FALLBACK_COUNT))
      .map(mapCandidateResult);
  } catch (err) {
    console.warn("[Snapchat SERP] failed:", err);
    return [];
  }
}
// ─── بحث Facebook (عبر SERP API) ──────────────────────────────────────────────
async function scrapeFacebook(query: string, location: string, limit = 10): Promise<any[]> {
  const requestedLimit = normalizeSearchLimit(limit);
  try {
    const serpResults = await searchFacebookSERP(query, location, requestedLimit);
    const candidates = serpResults
      .filter((r) => r.url && r.username)
      .slice(0, requestedLimit);

    const verified = await Promise.allSettled(
      candidates.map(async (candidate) => {
        const datasetResult = await fetchFacebookPagePosts(candidate.url, 6);
        if (!datasetResult.success || !datasetResult.data?.length) return null;

        const stats = extractSocialStats("facebook", datasetResult.data);
        const derivedBio =
          candidate.bio ||
          stats.recentPosts?.map((post) => post.content).filter(Boolean).slice(0, 2).join(" | ") ||
          "";

        return {
          platform: "facebook",
          username: candidate.username,
          id: candidate.username,
          type: "company",
          name: stats.profileName || candidate.displayName || candidate.username,
          displayName: stats.profileName || candidate.displayName || candidate.username,
          profileUrl: candidate.url,
          profile_url: candidate.url,
          url: candidate.url,
          bio: derivedBio,
          description: derivedBio,
          followers: stats.followersCount || 0,
          followersCount: stats.followersCount || 0,
          postsCount: stats.postsCount || datasetResult.data.length,
          avgLikes: stats.avgLikes || 0,
          phone: "",
          city: location || "",
          verified: true,
          verificationLevel: "dataset",
          dataSource: "facebook_dataset_verified",
        };
      })
    );

    const verifiedResults = verified
      .flatMap((result) => (result.status === "fulfilled" && result.value ? [result.value] : []))
      .slice(0, requestedLimit);

    if (verifiedResults.length > 0) return verifiedResults;

    return candidates.slice(0, requestedLimit).map((candidate) => ({
      platform: "facebook",
      username: candidate.username,
      id: candidate.username,
      type: "company",
      name: candidate.displayName || candidate.username,
      displayName: candidate.displayName || candidate.username,
      profileUrl: candidate.url,
      profile_url: candidate.url,
      url: candidate.url,
      bio: candidate.bio || "",
      description: candidate.bio || "",
      followers: 0,
      followersCount: 0,
      phone: "",
      city: location || "",
      verified: false,
      verificationLevel: "candidate_only",
      dataSource: "facebook_serp_candidate",
    }));
  } catch (err) {
    console.warn("[Facebook verified search] failed:", err);
    return [];
  }
}

// ─── بحث Google Search (عبر SERP API - بدلاً من Puppeteer البطيء) ──────────────
async function scrapeGoogleSearch(query: string, location: string): Promise<any[]> {
  // استخدام SERP API مباشرة بدلاً من Puppeteer لتجنب timeout
  const locationStr = location ? `${location} السعودية` : "السعودية";
  const searchQuery = `${query} ${locationStr}`;
  // استعلامات متعددة لتوسيع النتائج
  const queries = [
    searchQuery,
    `${query} ${locationStr} أعمال`,
    `${query} ${locationStr} للتواصل`,
  ];

  const results: any[] = [];
  const seen = new Set<string>();

  for (const q of queries) {
    try {
      // PHASE 1 FIX:
      //   1. cr=countrySA أُزيل — يُسبب 407 من SERP proxy
      //   2. parseGoogleResultsGeneric() بدل parseGoogleResultsPublic(html, "")
      //      الدالة القديمة كانت تُرجع [] دائماً عند domainFilter فارغ
      //   3. candidatePhones بدل phone: phones[0] — الأرقام مستخرجة من النص
      //      وليست verified — يجب أن تكون candidatePhones لا verifiedPhones
      const googleUrl = buildGoogleSearchUrl({ query: q });
      const html = await serpRequest(googleUrl);
      const googleResults = parseGoogleResultsGeneric(html);
      for (const item of googleResults) {
        const itemLink = item.url;
        if (seen.has(itemLink)) continue;
        seen.add(itemLink);
        results.push({
          platform: "google",
          displayName: item.displayName,
          profileUrl: item.url,
          bio: item.bio?.substring(0, 300) || "",
          // PHASE 1 FIX: candidatePhones (ليست verified) — مستخرجة من نص الصفحة
          // لا تُعامَل كـ verifiedPhones في مرحلة الربط الذكي
          candidatePhones: item.candidatePhones,
          verifiedPhones: [],
          website: item.url,
          dataSource: "serp",
        });
      }
    } catch (err) {
      console.warn(`[Google SERP] query failed: ${q}`, err);
    }
    if (results.length >= 30) break;
  }
  return results.slice(0, 30);
}

// ─── tRPC Router ───────────────────────────────────────────────────────────────
export type VerifiedSearchPlatform =
  | "instagram"
  | "tiktok"
  | "twitter"
  | "linkedin"
  | "snapchat"
  | "google"
  | "facebook";

export async function searchVerifiedPlatformResults(
  platform: VerifiedSearchPlatform,
  query: string,
  location: string,
  limit = 10
): Promise<any[]> {
  switch (platform) {
    case "instagram":
      return scrapeInstagram(query, location, limit);
    case "tiktok":
      return scrapeTikTok(query, location, limit);
    case "twitter":
      return scrapeTwitter(query, location, limit);
    case "linkedin":
      return scrapeLinkedIn(query, location, limit);
    case "snapchat":
      return scrapeSnapchat(query, location, limit);
    case "google":
      return scrapeGoogleSearch(query, location);
    case "facebook":
      return scrapeFacebook(query, location, limit);
    default:
      return [];
  }
}

export const brightDataSearchRouter = router({
  // ===== Instagram Dataset API Search (أكثر موثوقية من SERP) =====
  searchInstagramDataset: protectedProcedure
    .input(z.object({
      keyword: z.string().min(1),
      location: z.string().optional(),
      limit: z.number().min(1).max(50).default(10),
    }))
    .mutation(async ({ input }) => {
      const result = await searchInstagramByKeyword(
        input.keyword,
        input.location,
        input.limit
      );
      // تحليل النتائج بالذكاء الاصطناعي إذا نجح
      if (result.success && result.results.length > 0) {
        const analyzed = await analyzeResultsWithAI(
          result.results.map(r => ({
            platform: "instagram",
            username: r.username,
            name: r.full_name,
            fullName: r.full_name,
            profileUrl: r.profile_url,
            profile_url: r.profile_url,
            bio: r.biography,
            description: r.biography,
            followers: r.followers,
            followersCount: r.followers,
            posts: r.posts_count,
            postsCount: r.posts_count,
            isVerified: r.is_verified,
            verified: r.is_verified,
            isBusiness: r.is_business_account,
            businessCategory: r.business_category,
            businessType: r.business_category,
            businessEmail: r.business_email,
            businessPhone: r.business_phone,
            phone: r.business_phone,
            website: r.website,
            avgEngagement: r.avg_engagement,
            city: input.location || "",
            verificationLevel: "dataset",
            dataSource: "dataset_api",
          })),
          input.keyword,
          "Instagram Dataset API"
        );
        return { ...result, results: analyzed };
      }
      return result;
    }),

  // فحص حالة الربط
  checkConnection: protectedProcedure.query(async () => {
    const hasWs = !!BRIGHT_DATA_WS_ENDPOINT;
    const hasApiToken = !!process.env.BRIGHT_DATA_API_TOKEN;
    return {
      connected: hasWs || hasApiToken,
      message: hasWs || hasApiToken
        ? "Bright Data متصل وجاهز للاستخدام"
        : "يرجى إضافة BRIGHT_DATA_API_TOKEN أو BRIGHT_DATA_WS_ENDPOINT في الإعدادات",
    };
  }),

  searchFacebookVerified: protectedProcedure
    .input(z.object({
      keyword: z.string().min(1),
      location: z.string().optional(),
      limit: z.number().min(1).max(50).default(10),
    }))
    .mutation(async ({ input }) => {
      const results = await scrapeFacebook(input.keyword, input.location || "", input.limit);
      return {
        results,
        platform: "facebook",
        total: results.length,
      };
    }),

  searchTikTokVerified: protectedProcedure
    .input(z.object({
      keyword: z.string().min(1),
      location: z.string().optional(),
      limit: z.number().min(1).max(50).default(10),
    }))
    .mutation(async ({ input }) => {
      const results = await scrapeTikTok(input.keyword, input.location || "", input.limit);
      return {
        results,
        platform: "tiktok",
        total: results.length,
      };
    }),

  searchTwitterVerified: protectedProcedure
    .input(z.object({
      keyword: z.string().min(1),
      location: z.string().optional(),
      limit: z.number().min(1).max(50).default(10),
    }))
    .mutation(async ({ input }) => {
      const results = await scrapeTwitter(input.keyword, input.location || "", input.limit);
      return {
        results,
        platform: "twitter",
        total: results.length,
      };
    }),

  searchSnapchatVerified: protectedProcedure
    .input(z.object({
      keyword: z.string().min(1),
      location: z.string().optional(),
      limit: z.number().min(1).max(50).default(10),
    }))
    .mutation(async ({ input }) => {
      const results = await scrapeSnapchat(input.keyword, input.location || "", input.limit);
      return {
        results,
        platform: "snapchat",
        total: results.length,
      };
    }),

  searchLinkedInVerified: protectedProcedure
    .input(z.object({
      keyword: z.string().min(1),
      location: z.string().optional(),
      limit: z.number().min(1).max(50).default(10),
    }))
    .mutation(async ({ input }) => {
      const results = await scrapeLinkedIn(input.keyword, input.location || "", input.limit);
      return {
        results,
        platform: "linkedin",
        total: results.length,
      };
    }),

  // بحث في منصة واحدة
  searchPlatform: protectedProcedure
    .input(
      z.object({
        platform: z.enum(["instagram", "tiktok", "twitter", "linkedin", "snapchat", "google", "facebook"]),
        query: z.string().min(1),
        location: z.string().default(""),
        limit: z.number().min(1).max(50).default(10),
        analyzeWithAI: z.boolean().default(true),
      })
    )
    .mutation(async ({ input }) => {
      let results: any[] = [];

      try {
        results = await searchVerifiedPlatformResults(input.platform, input.query, input.location, input.limit);
      } catch (e: any) {
        const msg = e?.message || "";
        // كشف أخطاء رصيد Bright Data
        if (
          msg.includes("402") ||
          msg.includes("payment") ||
          msg.includes("quota") ||
          msg.includes("insufficient") ||
          msg.includes("balance") ||
          msg.includes("credit") ||
          msg.includes("ERR_TUNNEL_CONNECTION_FAILED") ||
          msg.includes("407") ||
          msg.includes("Proxy Authentication Required") ||
          msg.includes("net::ERR_PROXY")
        ) {
          throw new TRPCError({
            code: "PAYMENT_REQUIRED",
            message: "رصيد Bright Data غير كافٍ. يرجى شحن حسابك على brightdata.com لمتابعة البحث.",
          });
        }
        if (
          msg.includes("403") ||
          msg.includes("blocked") ||
          msg.includes("captcha") ||
          msg.includes("CAPTCHA")
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `المنصة حجبت الوصول مؤقتًا. حاول مرة أخرى بعد دقيقة.`,
          });
        }
        if (msg.includes("timeout") || msg.includes("Timeout")) {
          throw new TRPCError({
            code: "TIMEOUT",
            message: `انتهت مهلة البحث. تأكد من اتصال Bright Data وحاول مرة أخرى.`,
          });
        }
        // خطأ عام
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `خطأ في البحث: ${msg}`,
        });
      }

      if (input.analyzeWithAI && results.length > 0) {
        results = await analyzeResultsWithAI(results, input.query, input.platform);
      }

      return { results, count: results.length, platform: input.platform };
    }),

  // بحث شامل في كل المنصات
  searchAll: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1),
        location: z.string().default(""),
        limit: z.number().min(1).max(50).default(10),
        platforms: z
          .array(z.enum(["instagram", "tiktok", "twitter", "linkedin", "snapchat", "google", "facebook"]))
          .default(["instagram", "tiktok", "twitter", "linkedin", "snapchat", "google", "facebook"]),
      })
    )
    .mutation(async ({ input }) => {
      const allResults: Record<string, any[]> = {};
      const errors: Record<string, string> = {};

      // البحث في المنصات بالتوازي (3 في نفس الوقت كحد أقصى)
      for (let i = 0; i < input.platforms.length; i += 3) {
        const chunk = input.platforms.slice(i, i + 3);
        await Promise.all(
          chunk.map(async (platform) => {
            try {
              let results: any[] = [];
              switch (platform) {
                case "instagram":
                  results = await scrapeInstagram(input.query, input.location, input.limit);
                  break;
                case "tiktok":
                  results = await scrapeTikTok(input.query, input.location, input.limit);
                  break;
                case "twitter":
                  results = await scrapeTwitter(input.query, input.location, input.limit);
                  break;
                case "linkedin":
                  results = await scrapeLinkedIn(input.query, input.location, input.limit);
                  break;
                case "snapchat":
                  results = await scrapeSnapchat(input.query, input.location, input.limit);
                  break;
                case "google":
                  results = await scrapeGoogleSearch(input.query, input.location);
                  break;
                case "facebook":
                  results = await scrapeFacebook(input.query, input.location, input.limit);
                  break;
              }
              allResults[platform] = results;
            } catch (e: any) {
              errors[platform] = e.message || "خطأ غير معروف";
              allResults[platform] = [];
            }
          })
        );
      }

      const combined = Object.values(allResults).flat();
      const analyzed =
        combined.length > 0
          ? await analyzeResultsWithAI(combined, input.query, "جميع المنصات")
          : [];

      return {
        byPlatform: allResults,
        combined: analyzed,
        totalCount: combined.length,
        errors,
      };
    }),

  // بحث ذكي تلقائي عن حسابات السوشيال ميديا لنشاط تجاري محدد
  smartFindSocialAccounts: protectedProcedure
    .input(z.object({
      companyName: z.string().min(1),
      city: z.string().default(""),
      businessType: z.string().default(""),
    }))
    .mutation(async ({ input }) => {
      const query = input.companyName;
      const location = input.city;
      const results: Record<string, any[]> = {
        instagram: [],
        tiktok: [],
        snapchat: [],
        twitter: [],
        linkedin: [],
      };
      const errors: Record<string, string> = {};

      // بحث متوازي في جميع المنصات
      await Promise.allSettled([
        searchInstagramSERP(query, location)
          .then(r => { results.instagram = r.slice(0, 5); })
          .catch(e => { errors.instagram = e.message; }),
        searchTikTokSERP(query, location)
          .then(r => { results.tiktok = r.slice(0, 5); })
          .catch(e => { errors.tiktok = e.message; }),
        searchSnapchatSERP(query, location)
          .then(r => { results.snapchat = r.slice(0, 5); })
          .catch(e => { errors.snapchat = e.message; }),
        searchLinkedInSERP(query, location)
          .then(r => { results.linkedin = r.slice(0, 5); })
          .catch(e => { errors.linkedin = e.message; }),
        // Twitter via SERP
        (async () => {
          try {
            const twitterQuery = `${query} ${location} site:twitter.com OR site:x.com`;
            // PHASE 1 FIX: buildGoogleSearchUrl + parseGoogleResultsGeneric
            const url = buildGoogleSearchUrl({ query: twitterQuery, num: 10 });
            const html = await serpRequest(url);
            const parsed = parseGoogleResultsGeneric(html);
            results.twitter = parsed.slice(0, 5).map((r: { url: string; displayName: string; bio: string }) => ({
              username: r.url.match(/(?:twitter|x)\.com\/([a-zA-Z0-9_]+)/)?.[1] || "",
              displayName: r.displayName,
              url: r.url,
              bio: r.bio,
            }));
          } catch (e: any) {
            errors.twitter = e.message;
          }
        })(),
      ]);

      const totalFound = Object.values(results).flat().length;

      // استخدام AI لاقتراح أفضل حساب لكل منصة
      let aiSuggestions: Record<string, string> = {};
      if (totalFound > 0) {
        try {
          const platformSummary = Object.entries(results)
            .filter(([, accounts]) => accounts.length > 0)
            .map(([platform, accounts]) =>
              `${platform}: ${accounts.map((a: any) => a.username || a.displayName || a.name || "").filter(Boolean).join(", ")}`
            ).join("\n");

          const aiResp = await invokeLLM({
            messages: [
              { role: "system", content: "أنت خبير تحليل سوشيال ميديا. أجب بـ JSON فقط بدون أي نص إضافي." },
              { role: "user", content: `النشاط: ${input.companyName} (${input.businessType || "غير محدد"}) في ${input.city || "السعودية"}\nنتائج البحث:\n${platformSummary}\n\nاقترح أفضل حساب لكل منصة بناءً على التشابه مع اسم النشاط. أجب بـ JSON:\n{"instagram":"username","tiktok":"username","snapchat":"username","twitter":"username","linkedin":"username"}` },
            ],
            response_format: { type: "json_object" } as any,
          });
          const content = aiResp?.choices?.[0]?.message?.content;
          if (content) aiSuggestions = JSON.parse(typeof content === "string" ? content : "{}");
        } catch {}
      }

      return { results, errors, aiSuggestions, totalFound };
    }),
});
