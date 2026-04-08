import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import puppeteer from "puppeteer-core";
import { invokeLLM } from "../_core/llm";
import {
  searchInstagramSERP,
  searchTikTokSERP,
  searchSnapchatSERP,
  searchLinkedInSERP,
  searchFacebookSERP,
  searchTwitterSERP,
  serpRequest,
  parseGoogleResultsGeneric,
} from "./serpSearch";
import { buildGoogleSearchUrl } from "../lib/googleUrlBuilder";
import { searchInstagramByKeyword } from "../lib/brightDataInstagram";
import { analyzeLinkedInCompany } from "../lib/brightDataLinkedIn";
import {
  fetchViaProxy,
  fetchWithScrapingBrowser,
  scrapeLinkedIn as scrapeLinkedInProfile,
} from "../lib/brightDataScraper";
import { extractEvidenceBatch } from "../lib/browserExtractor";
import {
  extractSocialStats,
  fetchFacebookPagePosts,
  fetchSnapchatPosts,
  fetchTikTokProfile,
  fetchTikTokPosts,
  fetchTwitterPosts,
} from "../lib/brightDataSocialDatasets";
import { searchGoogleWeb } from "./googleSearch";

// ─── Bright Data Browser API Helper ───────────────────────────────────────────
const BRIGHT_DATA_WS_ENDPOINT = process.env.BRIGHT_DATA_WS_ENDPOINT || "";

function getBrightDataEndpoint(): string {
  if (BRIGHT_DATA_WS_ENDPOINT) return BRIGHT_DATA_WS_ENDPOINT;
  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message:
      "Bright Data غير مضبوط. يرجى إضافة BRIGHT_DATA_WS_ENDPOINT في الإعدادات.",
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
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

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
  const stopWords = new Set([
    "في",
    "من",
    "على",
    "مع",
    "عن",
    "الى",
    "إلى",
    "the",
    "and",
  ]);
  const tokens = normalizeSearchText(query)
    .split(" ")
    .map(token => token.trim())
    .filter(token => token.length >= 2 && !stopWords.has(token));

  return Array.from(new Set(tokens));
}

function hasAnyVariant(text: string, term: string): boolean {
  return expandSearchTerm(term).some(
    variant => variant && text.includes(variant)
  );
}

function normalizeSearchLimit(limit?: number): number {
  return Math.min(Math.max(limit ?? 10, 1), 50);
}

function getModerateOverfetchConfig(requestedLimit: number): {
  discoveryLimit: number;
  verificationLimit: number;
} {
  if (requestedLimit <= 10) {
    return { discoveryLimit: 24, verificationLimit: 18 };
  }
  if (requestedLimit <= 20) {
    return { discoveryLimit: 42, verificationLimit: 30 };
  }
  return { discoveryLimit: 78, verificationLimit: 54 };
}

function getResultIdentity(result: any): string {
  return String(
    result?.id ||
      result?.username ||
      result?.url ||
      result?.profileUrl ||
      result?.profile_url ||
      result?.website ||
      result?.name ||
      ""
  )
    .trim()
    .toLowerCase();
}

function mergePrioritizedResults<T>(
  preferred: T[],
  fallback: T[],
  limit: number
): T[] {
  const merged: T[] = [];
  const seen = new Set<string>();

  for (const item of [...preferred, ...fallback]) {
    if (!item) continue;
    const key = getResultIdentity(item);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    merged.push(item);
    if (merged.length >= limit) break;
  }

  return merged;
}

function toConfidenceLevel(score: number): "high" | "medium" | "low" {
  if (score >= 80) return "high";
  if (score >= 60) return "medium";
  return "low";
}

function buildConfidenceScore(
  rawScore: number,
  source: "dataset" | "serp"
): number {
  const base = source === "dataset" ? 42 : 24;
  const multiplier = source === "dataset" ? 8 : 7;
  return Math.max(18, Math.min(98, Math.round(base + rawScore * multiplier)));
}

function scoreTikTokReachPreference(followersCount: number): number {
  const sizePreference = evaluateFollowerSizePreference(
    "tiktok",
    followersCount
  );
  if (!followersCount || followersCount <= 0)
    return sizePreference.sizePreferenceScore;
  if (followersCount <= 8_000) return sizePreference.sizePreferenceScore + 1;
  if (followersCount <= 25_000) return sizePreference.sizePreferenceScore + 0.6;
  if (followersCount <= 80_000) return sizePreference.sizePreferenceScore + 0.2;
  return sizePreference.sizePreferenceScore;
}

const LINKEDIN_VERIFIED_MIN_SCORE = 2.5;
const LINKEDIN_CANDIDATE_MIN_SCORE = 1.5;
const SNAPCHAT_VERIFIED_MIN_SCORE = 1.6;
const SNAPCHAT_CANDIDATE_MIN_SCORE = 0.3;
const SOFT_FALLBACK_COUNT = 5;
const SNAPCHAT_WEBSITE_DISCOVERY_MAX = 8;
const BUSINESS_WEBSITE_DISCOVERY_MAX = 20;

type SizeSegment =
  | "unknown"
  | "tiny"
  | "emerging"
  | "preferred"
  | "growing"
  | "large"
  | "oversized";

type PlatformFollowerSizePolicy = {
  tinyMax: number;
  preferredMin: number;
  preferredMax: number;
  softMax: number;
  hardMax: number;
};

const PLATFORM_FOLLOWER_SIZE_POLICIES: Record<
  string,
  PlatformFollowerSizePolicy
> = {
  instagram: {
    tinyMax: 400,
    preferredMin: 1_000,
    preferredMax: 80_000,
    softMax: 250_000,
    hardMax: 650_000,
  },
  tiktok: {
    tinyMax: 250,
    preferredMin: 800,
    preferredMax: 70_000,
    softMax: 180_000,
    hardMax: 500_000,
  },
  twitter: {
    tinyMax: 150,
    preferredMin: 500,
    preferredMax: 60_000,
    softMax: 150_000,
    hardMax: 400_000,
  },
  linkedin: {
    tinyMax: 100,
    preferredMin: 500,
    preferredMax: 120_000,
    softMax: 350_000,
    hardMax: 900_000,
  },
  facebook: {
    tinyMax: 400,
    preferredMin: 1_200,
    preferredMax: 150_000,
    softMax: 450_000,
    hardMax: 1_200_000,
  },
};

const STRICT_BUSINESS_BIO_KEYWORDS = [
  "متجر",
  "محل",
  "مطعم",
  "كافيه",
  "كوفي",
  "عيادة",
  "صالون",
  "مركز",
  "شركة",
  "مؤسسة",
  "براند",
  "بوتيك",
  "للطلبات",
  "للطلب",
  "للحجز",
  "للاستفسار",
  "واتساب",
  "تواصل",
  "توصيل",
  "منيو",
  "فرع",
  "رسمي",
  "الرسمي",
  "shop",
  "store",
  "restaurant",
  "cafe",
  "clinic",
  "salon",
  "center",
  "company",
  "official",
  "booking",
  "order",
  "orders",
  "delivery",
  "menu",
  "whatsapp",
  "contact",
  "reservations",
  "branch",
  "boutique",
];

const BUSINESS_NAME_KEYWORDS = [
  "مطعم",
  "كافيه",
  "كوفي",
  "عيادة",
  "مركز",
  "شركة",
  "مؤسسة",
  "بوتيك",
  "متجر",
  "محل",
  "shop",
  "store",
  "restaurant",
  "cafe",
  "clinic",
  "salon",
  "center",
  "company",
  "official",
  "boutique",
  "brand",
  "trading",
  "group",
];

const CREATOR_PROFILE_KEYWORDS = [
  "صانع محتوى",
  "بلوجر",
  "بلوغر",
  "يوتيوبر",
  "يوتيوبر",
  "مؤثر",
  "انفلونسر",
  "مراجع",
  "مراجعات",
  "يوميات",
  "لايف ستايل",
  "creator",
  "content creator",
  "influencer",
  "blogger",
  "vlogger",
  "ugc",
  "public figure",
  "reviewer",
  "reviews",
  "lifestyle",
  "streamer",
  "gaming",
  "gamer",
  "affiliate",
  "coupon",
  "giveaway",
  "trends",
];

const NEGATIVE_BUSINESS_FILTER_KEYWORDS = [
  "تغطيات",
  "تغطية",
  "فلوج",
  "فلوقات",
  "اعلانات",
  "إعلانات",
  "صانع محتوى",
  "يوميات",
  "ريفيو",
  "ريفيوز",
  "مراجعات",
  "بلوجر",
  "بلوغر",
  "يوتيوبر",
  "يوتيوبر",
  "مؤثر",
  "انفلونسر",
  "creator",
  "content creator",
  "influencer",
  "blogger",
  "vlogger",
  "reviewer",
  "reviews",
  "lifestyle",
  "public figure",
  "ugc",
  "streamer",
  "gaming",
  "gamer",
  "giveaway",
];

const COMMERCIAL_INTENT_KEYWORDS = [
  "للطلب",
  "للطلبات",
  "اطلب",
  "الطلب",
  "للحجز",
  "احجز",
  "حجز",
  "توصيل",
  "متجر",
  "مؤسسة",
  "فروعنا",
  "فروع",
  "رسمي",
  "الرسمي",
  "معتمد",
  "واتساب",
  "تواصل",
  "استفسار",
  "ابشر",
  "order",
  "orders",
  "shop now",
  "store",
  "official",
  "booking",
  "book",
  "reserve",
  "reservations",
  "delivery",
  "branches",
  "our branches",
  "contact",
  "whatsapp",
];

const VALIDATED_BUSINESS_LINK_KEYWORDS = [
  "salla.",
  "zid.",
  "shopify",
  "wa.me",
  "whatsapp.com",
];

const NON_OFFICIAL_WEBSITE_HOST_KEYWORDS = [
  "instagram.com",
  "instabio.cc",
  "tiktok.com",
  "x.com",
  "twitter.com",
  "facebook.com",
  "linkedin.com",
  "snapchat.com",
  "youtube.com",
  "youtu.be",
  "linktr.ee",
  "bio.site",
  "beacons.ai",
  "lnk.bio",
  "taplink.cc",
  "solo.to",
  "flow.page",
];

function containsNormalizedKeyword(text: string, keywords: string[]): string[] {
  const normalized = normalizeSearchText(text || "");
  if (!normalized) return [];

  return keywords.filter(keyword => {
    const normalizedKeyword = normalizeSearchText(keyword);
    return normalizedKeyword && normalized.includes(normalizedKeyword);
  });
}

function extractPhonesFromLooseText(text: string): string[] {
  if (!text) return [];
  const matches = text.match(/(?:\+?966|00966|0)?(?:5\d{8}|[2-9]\d{7})/g) || [];
  return Array.from(
    new Set(
      matches.map(value => value.replace(/[^\d+]/g, "").trim()).filter(Boolean)
    )
  );
}

function extractHostname(input: string): string {
  const value = String(input || "").trim();
  if (!value) return "";
  try {
    return new URL(
      value.startsWith("http") ? value : `https://${value}`
    ).hostname.toLowerCase();
  } catch {
    return (
      value
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .split("/")[0] || ""
    );
  }
}

function evaluateWebsiteValidation(website: string) {
  const rawWebsite = String(website || "").trim();
  const normalizedWebsite = rawWebsite.toLowerCase();
  const host = extractHostname(rawWebsite);
  const validatedLinkMatches = VALIDATED_BUSINESS_LINK_KEYWORDS.filter(
    keyword => normalizedWebsite.includes(keyword)
  );
  const hasValidatedCommerceLink = validatedLinkMatches.length > 0;
  const isNonOfficialHost = NON_OFFICIAL_WEBSITE_HOST_KEYWORDS.some(keyword =>
    host.includes(keyword)
  );
  const hasOfficialWebsite =
    !!host &&
    host.includes(".") &&
    !isNonOfficialHost &&
    !hasValidatedCommerceLink;

  let linkValidationScore = 0;
  if (hasValidatedCommerceLink) linkValidationScore += 3;
  if (hasOfficialWebsite) linkValidationScore += 2;

  return {
    host,
    hasValidatedCommerceLink,
    hasOfficialWebsite,
    validatedLinkMatches,
    linkValidationScore,
  };
}

function evaluateStrictBusinessProfile(input: {
  name?: string;
  bio?: string;
  website?: string;
  phone?: string;
  candidatePhones?: string[];
  verified?: boolean;
}) {
  const businessBioMatches = containsNormalizedKeyword(
    input.bio || "",
    STRICT_BUSINESS_BIO_KEYWORDS
  );
  const businessNameMatches = containsNormalizedKeyword(
    input.name || "",
    BUSINESS_NAME_KEYWORDS
  );
  const creatorMatches = containsNormalizedKeyword(
    `${input.name || ""} ${input.bio || ""}`,
    CREATOR_PROFILE_KEYWORDS
  );
  const negativeKeywordMatches = containsNormalizedKeyword(
    `${input.name || ""} ${input.bio || ""}`,
    NEGATIVE_BUSINESS_FILTER_KEYWORDS
  );
  const commercialIntentMatches = containsNormalizedKeyword(
    `${input.name || ""} ${input.bio || ""} ${input.website || ""}`,
    COMMERCIAL_INTENT_KEYWORDS
  );

  const extractedPhones = extractPhonesFromLooseText(
    `${input.phone || ""} ${input.bio || ""}`
  );
  const allPhones = Array.from(
    new Set(
      [...(input.candidatePhones || []), ...extractedPhones].filter(Boolean)
    )
  );

  const websiteValidation = evaluateWebsiteValidation(input.website || "");
  const hasWebsite = !!String(input.website || "").trim();
  const hasPhone = !!String(input.phone || "").trim() || allPhones.length > 0;
  const hasBusinessKeywordInBio = businessBioMatches.length > 0;
  const hasCommercialIntent = commercialIntentMatches.length > 0;
  const hardSignals = [
    websiteValidation.hasValidatedCommerceLink,
    websiteValidation.hasOfficialWebsite,
    hasPhone,
    hasBusinessKeywordInBio,
    hasCommercialIntent,
  ].filter(Boolean).length;

  let businessScore = hardSignals * 2.4;
  businessScore += Math.min(2, businessNameMatches.length * 0.5);
  businessScore += Math.min(3, commercialIntentMatches.length * 0.9);
  businessScore += websiteValidation.linkValidationScore;
  if (input.verified) businessScore += 0.5;
  if (creatorMatches.length > 0)
    businessScore -= Math.min(3, creatorMatches.length * 1.25);
  if (negativeKeywordMatches.length > 0)
    businessScore -= Math.min(5, negativeKeywordMatches.length * 1.5);

  const strictPass =
    websiteValidation.hasValidatedCommerceLink ||
    websiteValidation.hasOfficialWebsite ||
    hasPhone ||
    hasBusinessKeywordInBio ||
    hasCommercialIntent;
  const creatorOnlyProfile =
    creatorMatches.length > 0 &&
    !websiteValidation.hasValidatedCommerceLink &&
    !websiteValidation.hasOfficialWebsite &&
    !hasPhone &&
    !hasCommercialIntent;
  const hardReject =
    negativeKeywordMatches.length > 0 &&
    !websiteValidation.hasValidatedCommerceLink &&
    !websiteValidation.hasOfficialWebsite &&
    !hasPhone &&
    !hasCommercialIntent;
  const businessValidationLevel =
    websiteValidation.hasValidatedCommerceLink || hasPhone
      ? "validated"
      : websiteValidation.hasOfficialWebsite || hasCommercialIntent
        ? "likely_business"
        : hasBusinessKeywordInBio || businessNameMatches.length > 0
          ? "possible_business"
          : "weak";

  return {
    strictPass,
    creatorOnlyProfile,
    hardReject,
    businessScore: Math.round(Math.max(0, businessScore) * 10) / 10,
    hasWebsite,
    hasPhone,
    hasBusinessKeywordInBio,
    hasCommercialIntent,
    hasValidatedCommerceLink: websiteValidation.hasValidatedCommerceLink,
    hasOfficialWebsite: websiteValidation.hasOfficialWebsite,
    linkValidationScore: websiteValidation.linkValidationScore,
    commercialIntentScore: Math.min(5, commercialIntentMatches.length * 1.2),
    businessValidationLevel,
    businessBioMatches,
    businessNameMatches,
    creatorMatches,
    negativeKeywordMatches,
    commercialIntentMatches,
    validatedLinkMatches: websiteValidation.validatedLinkMatches,
    allPhones,
  };
}

function inferDiscoveryMethod(
  result: any
): "direct_dataset" | "serp" | "website_fallback" | "browser" | "unknown" {
  const dataSource = String(result?.dataSource || "").toLowerCase();
  const verificationLevel = String(
    result?.verificationLevel || ""
  ).toLowerCase();

  if (dataSource.includes("website_")) return "website_fallback";
  if (
    dataSource.includes("direct_") ||
    dataSource.includes("proxy_search") ||
    dataSource.includes("proxy_company") ||
    dataSource.includes("browser_company")
  )
    return "browser";
  if (
    verificationLevel === "browser_verified" ||
    dataSource.includes("browser")
  )
    return "browser";
  if (dataSource.includes("dataset") || dataSource.includes("verified"))
    return "direct_dataset";
  if (dataSource.includes("serp") || verificationLevel === "serp_fallback")
    return "serp";
  return "unknown";
}

function getFollowerBucket(
  followersCount: number
): "unknown" | "nano" | "small" | "medium" | "large" | "enterprise" {
  if (!Number.isFinite(followersCount) || followersCount <= 0) return "unknown";
  if (followersCount <= 1_000) return "nano";
  if (followersCount <= 10_000) return "small";
  if (followersCount <= 100_000) return "medium";
  if (followersCount <= 500_000) return "large";
  return "enterprise";
}

function getFollowerSizePolicy(
  platform: string
): PlatformFollowerSizePolicy | null {
  return (
    PLATFORM_FOLLOWER_SIZE_POLICIES[String(platform || "").toLowerCase()] ||
    null
  );
}

function roundPreferenceScore(value: number): number {
  return Math.round(value * 10) / 10;
}

function evaluateFollowerSizePreference(
  platform: string,
  followersCount: number
): {
  sizePreferenceScore: number;
  sizeSegment: SizeSegment;
  sizeCapExceeded: boolean;
  hardReject: boolean;
} {
  const policy = getFollowerSizePolicy(platform);
  if (!policy || !Number.isFinite(followersCount) || followersCount <= 0) {
    return {
      sizePreferenceScore: 0,
      sizeSegment: "unknown",
      sizeCapExceeded: false,
      hardReject: false,
    };
  }

  if (followersCount <= policy.tinyMax) {
    return {
      sizePreferenceScore: 1.2,
      sizeSegment: "tiny",
      sizeCapExceeded: false,
      hardReject: false,
    };
  }

  if (followersCount < policy.preferredMin) {
    const progress =
      (followersCount - policy.tinyMax) /
      Math.max(1, policy.preferredMin - policy.tinyMax);
    return {
      sizePreferenceScore: roundPreferenceScore(1.5 + progress * 0.9),
      sizeSegment: "emerging",
      sizeCapExceeded: false,
      hardReject: false,
    };
  }

  if (followersCount <= policy.preferredMax) {
    return {
      sizePreferenceScore: 3,
      sizeSegment: "preferred",
      sizeCapExceeded: false,
      hardReject: false,
    };
  }

  if (followersCount <= policy.softMax) {
    const progress =
      (followersCount - policy.preferredMax) /
      Math.max(1, policy.softMax - policy.preferredMax);
    return {
      sizePreferenceScore: roundPreferenceScore(1.2 - progress * 3.6),
      sizeSegment: "growing",
      sizeCapExceeded: false,
      hardReject: false,
    };
  }

  if (followersCount <= policy.hardMax) {
    const progress =
      (followersCount - policy.softMax) /
      Math.max(1, policy.hardMax - policy.softMax);
    return {
      sizePreferenceScore: roundPreferenceScore(-2.4 - progress * 3),
      sizeSegment: "large",
      sizeCapExceeded: true,
      hardReject: false,
    };
  }

  return {
    sizePreferenceScore: -6,
    sizeSegment: "oversized",
    sizeCapExceeded: true,
    hardReject: true,
  };
}

function normalizeMatchedBy(value: any): string[] {
  if (Array.isArray(value)) {
    return value.map(item => String(item || "").trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }
  return [];
}

function inferStrictPassFromResult(result: any): boolean {
  if (typeof result?.strictPass === "boolean") return result.strictPass;
  if (typeof result?.businessValidationLevel === "string") {
    const level = result.businessValidationLevel.trim().toLowerCase();
    if (level === "validated" || level === "likely_business") return true;
  }

  const hasWebsite = !!String(result?.website || "").trim();
  const candidatePhones = Array.isArray(result?.candidatePhones)
    ? result.candidatePhones.filter(Boolean)
    : [];
  const hasPhone =
    !!String(result?.phone || "").trim() || candidatePhones.length > 0;
  const businessSignals = Array.isArray(result?.businessSignals)
    ? result.businessSignals.filter(Boolean).length
    : 0;
  const businessScore =
    typeof result?.businessScore === "number" ? result.businessScore : 0;
  const commercialIntentScore =
    typeof result?.commercialIntentScore === "number"
      ? result.commercialIntentScore
      : 0;
  const linkValidationScore =
    typeof result?.linkValidationScore === "number"
      ? result.linkValidationScore
      : 0;

  return (
    hasWebsite ||
    hasPhone ||
    businessSignals > 0 ||
    businessScore >= 3 ||
    commercialIntentScore >= 2 ||
    linkValidationScore >= 2
  );
}

function normalizeUnifiedSearchResult(platform: string, result: any) {
  const normalizedPlatform = String(
    result?.platform || platform || ""
  ).toLowerCase();
  const profileUrl =
    result?.profileUrl || result?.profile_url || result?.url || "";
  const url = result?.url || result?.profileUrl || result?.profile_url || "";
  const followersCount =
    Number(result?.followersCount ?? result?.followers ?? 0) || 0;
  const sizePreference = evaluateFollowerSizePreference(
    normalizedPlatform || platform,
    followersCount
  );
  const discoveryMethod = inferDiscoveryMethod(result);
  const sourceForConfidence = discoveryMethod === "serp" ? "serp" : "dataset";
  const rawScoreBase =
    (typeof result?.relevanceScore === "number"
      ? result.relevanceScore
      : Number(result?.rating || 0) || 0) +
    (typeof result?.businessScore === "number" ? result.businessScore : 0);
  const confidenceScore =
    typeof result?.confidenceScore === "number" &&
    Number.isFinite(result.confidenceScore)
      ? Math.round(result.confidenceScore)
      : buildConfidenceScore(rawScoreBase, sourceForConfidence);
  const verificationLevel =
    typeof result?.verificationLevel === "string" &&
    result.verificationLevel.trim()
      ? result.verificationLevel
      : discoveryMethod === "serp"
        ? "serp_fallback"
        : "candidate_only";
  const strictPass = inferStrictPassFromResult(result);

  return {
    ...result,
    platform: normalizedPlatform || platform,
    id: result?.id || result?.username || getResultIdentity(result),
    profileUrl,
    profile_url: result?.profile_url || profileUrl,
    url,
    followersCount,
    confidenceScore,
    confidenceLevel:
      typeof result?.confidenceLevel === "string" &&
      result.confidenceLevel.trim()
        ? result.confidenceLevel
        : toConfidenceLevel(confidenceScore),
    businessScore:
      typeof result?.businessScore === "number"
        ? result.businessScore
        : strictPass
          ? 3
          : 0,
    commercialIntentScore:
      typeof result?.commercialIntentScore === "number"
        ? result.commercialIntentScore
        : 0,
    linkValidationScore:
      typeof result?.linkValidationScore === "number"
        ? result.linkValidationScore
        : 0,
    verificationLevel,
    discoveryMethod,
    strictPass,
    businessValidationLevel:
      typeof result?.businessValidationLevel === "string" &&
      result.businessValidationLevel.trim()
        ? result.businessValidationLevel
        : strictPass
          ? "likely_business"
          : "weak",
    hardReject: Boolean(result?.hardReject),
    deadLink: Boolean(
      result?.deadLink ||
      result?.profileUnavailable ||
      result?.profileExists === false
    ),
    followerBucket: getFollowerBucket(followersCount),
    sizePreferenceScore:
      typeof result?.sizePreferenceScore === "number"
        ? result.sizePreferenceScore
        : sizePreference.sizePreferenceScore,
    sizeSegment:
      typeof result?.sizeSegment === "string" && result.sizeSegment.trim()
        ? result.sizeSegment
        : sizePreference.sizeSegment,
    sizeCapExceeded:
      typeof result?.sizeCapExceeded === "boolean"
        ? result.sizeCapExceeded
        : sizePreference.sizeCapExceeded,
    matchedBy: normalizeMatchedBy(result?.matchedBy),
    negativeKeywordMatches: Array.isArray(result?.negativeKeywordMatches)
      ? result.negativeKeywordMatches.filter(Boolean)
      : [],
    commercialIntentMatches: Array.isArray(result?.commercialIntentMatches)
      ? result.commercialIntentMatches.filter(Boolean)
      : [],
    validatedLinkMatches: Array.isArray(result?.validatedLinkMatches)
      ? result.validatedLinkMatches.filter(Boolean)
      : [],
    resultIdentity: getResultIdentity(result),
  };
}

function normalizeUnifiedSearchResults(
  platform: string,
  results: any[]
): any[] {
  return results.map(result => normalizeUnifiedSearchResult(platform, result));
}

function normalizeUnifiedMixedSearchResults(results: any[]): any[] {
  return results.map(result =>
    normalizeUnifiedSearchResult(String(result?.platform || "unknown"), result)
  );
}

type SearchObservabilityMetrics = {
  platform: string;
  query: string;
  location: string;
  requestedLimit: number;
  discoveryLimit?: number;
  verificationLimit?: number;
  discovered: number;
  verified: number;
  filteredOut: number;
  deadLinks: number;
  returned: number;
};

function logPlatformSearchMetrics(metrics: SearchObservabilityMetrics): void {
  console.info(
    `[Search Metrics] ${JSON.stringify({
      platform: metrics.platform,
      query: metrics.query,
      location: metrics.location,
      requestedLimit: metrics.requestedLimit,
      discoveryLimit: metrics.discoveryLimit ?? null,
      verificationLimit: metrics.verificationLimit ?? null,
      discovered: Math.max(0, metrics.discovered || 0),
      verified: Math.max(0, metrics.verified || 0),
      filteredOut: Math.max(0, metrics.filteredOut || 0),
      deadLinks: Math.max(0, metrics.deadLinks || 0),
      returned: Math.max(0, metrics.returned || 0),
    })}`
  );
}

function extractTikTokHandle(input: string): string | null {
  if (!input) return null;
  try {
    const url = new URL(input.startsWith("http") ? input : `https://${input}`);
    const match = url.pathname.match(/\/@([a-zA-Z0-9._]{2,30})/i);
    if (match) return match[1];
  } catch {
    const plainMatch = input.match(/tiktok\.com\/@([a-zA-Z0-9._]{2,30})/i);
    if (plainMatch) return plainMatch[1];
  }
  return null;
}

function normalizeTikTokCandidateUrl(input: string): string {
  const handle = extractTikTokHandle(input);
  return handle ? `https://www.tiktok.com/@${handle}` : input;
}

function buildTikTokUserSearchUrl(searchQuery: string): string {
  return `https://www.tiktok.com/search/user?q=${encodeURIComponent(searchQuery.trim())}`;
}

function decodeLooseJsonText(value: string): string {
  return String(value || "")
    .replace(/\\u002F/gi, "/")
    .replace(/\\u003C/gi, "<")
    .replace(/\\u003E/gi, ">")
    .replace(/\\u0026/gi, "&")
    .replace(/\\n/gi, " ")
    .replace(/\\t/gi, " ")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCompactMetricValue(value: string): number {
  const normalized = String(value || "")
    .trim()
    .replace(/,/g, "");
  const match = normalized.match(/([\d.]+)\s*([kmb])?/i);
  if (!match) return 0;

  const numeric = Number(match[1]);
  if (!Number.isFinite(numeric)) return 0;

  const unit = (match[2] || "").toLowerCase();
  if (unit === "k") return Math.round(numeric * 1_000);
  if (unit === "m") return Math.round(numeric * 1_000_000);
  if (unit === "b") return Math.round(numeric * 1_000_000_000);
  return Math.round(numeric);
}

function parseTikTokFollowersFromText(text: string): number {
  const normalized = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return 0;

  const patterns = [
    /([\d.,]+(?:\s*[kmb])?)\s*(?:followers|follower|متابع(?:ين)?)/i,
    /(?:followers|follower|متابع(?:ين)?)[^\d]{0,8}([\d.,]+(?:\s*[kmb])?)/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) continue;
    const parsed = parseCompactMetricValue(match[1]);
    if (parsed > 0) return parsed;
  }

  return 0;
}

function summarizeTikTokSearchCard(
  text: string,
  username: string
): {
  displayName: string;
  bio: string;
  followersCount: number;
} {
  const cleaned = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) {
    return {
      displayName: username,
      bio: "",
      followersCount: 0,
    };
  }

  const handleToken = `@${username}`.toLowerCase();
  const lower = cleaned.toLowerCase();
  const handleIndex = lower.indexOf(handleToken);
  const beforeHandle =
    handleIndex > 0 ? cleaned.slice(0, handleIndex).trim() : "";
  const afterHandle =
    handleIndex >= 0
      ? cleaned.slice(handleIndex + handleToken.length).trim()
      : cleaned;
  const followersCount = parseTikTokFollowersFromText(cleaned);

  const displayName =
    beforeHandle && beforeHandle.length <= 80 ? beforeHandle : username;
  const bio = afterHandle || cleaned;

  return {
    displayName,
    bio,
    followersCount,
  };
}

function mapTikTokDirectCandidate(raw: {
  href?: string;
  text?: string;
  username?: string;
  displayName?: string;
  bio?: string;
  followersCount?: number;
  verified?: boolean;
  source?: string;
}): any | null {
  const username = raw.username || extractTikTokHandle(raw.href || "");
  if (!username) return null;

  const normalizedUrl = normalizeTikTokCandidateUrl(raw.href || username);
  const summary = summarizeTikTokSearchCard(raw.text || "", username);
  const displayName = raw.displayName || summary.displayName || username;
  const bio = raw.bio || summary.bio || "";
  const followersCount =
    Number(raw.followersCount || summary.followersCount || 0) || 0;

  return {
    username,
    url: normalizedUrl,
    displayName,
    bio,
    website: "",
    verified: Boolean(raw.verified),
    candidatePhones: extractPhonesFromLooseText(bio),
    followersCount,
    dataSource: raw.source || "tiktok_browser_search_candidate",
  };
}

function extractTikTokCandidatesFromSearchHtml(
  html: string,
  source: string,
  limit: number
): any[] {
  const candidateMap = new Map<string, any>();
  const cappedLimit = Math.min(Math.max(limit, 1), 200);
  const pushCandidate = (candidate: any | null) => {
    if (!candidate) return;
    const key = getResultIdentity(candidate);
    if (!key) return;
    const previous = candidateMap.get(key);
    if (!previous) {
      candidateMap.set(key, candidate);
      return;
    }
    const previousBioLength = String(previous.bio || "").length;
    const nextBioLength = String(candidate.bio || "").length;
    if (nextBioLength > previousBioLength) {
      candidateMap.set(key, { ...previous, ...candidate });
    }
  };

  const hrefPatterns = [
    /https?:\/\/www\.tiktok\.com\/@([a-zA-Z0-9._]{2,30})(?!\/video)/gi,
    /https?:\\\/\\\/www\.tiktok\.com\\\/@([a-zA-Z0-9._]{2,30})(?!\\\/video)/gi,
  ];

  for (const pattern of hrefPatterns) {
    let match: RegExpExecArray | null = null;
    while ((match = pattern.exec(html)) !== null) {
      const username = match[1];
      pushCandidate(
        mapTikTokDirectCandidate({
          username,
          href: `https://www.tiktok.com/@${username}`,
          source,
        })
      );
      if (candidateMap.size >= cappedLimit) break;
    }
    if (candidateMap.size >= cappedLimit) break;
  }

  if (candidateMap.size < cappedLimit) {
    const profileObjectRegex =
      /"uniqueId":"([a-zA-Z0-9._]{2,30})"[\s\S]{0,400}?"nickname":"([^"]{0,160})"[\s\S]{0,900}?"signature":"([^"]{0,500})"(?:[\s\S]{0,400}?"followerCount":(\d+))?/gi;
    let match: RegExpExecArray | null = null;
    while ((match = profileObjectRegex.exec(html)) !== null) {
      const username = match[1];
      const nickname = decodeLooseJsonText(match[2]);
      const signature = decodeLooseJsonText(match[3]);
      const followerCount = Number(match[4] || 0) || 0;
      pushCandidate(
        mapTikTokDirectCandidate({
          username,
          href: `https://www.tiktok.com/@${username}`,
          displayName: nickname || username,
          bio: signature,
          followersCount: followerCount,
          source,
        })
      );
      if (candidateMap.size >= cappedLimit) break;
    }
  }

  return Array.from(candidateMap.values()).slice(0, cappedLimit);
}

async function discoverTikTokCandidatesFromDirectSearch(
  query: string,
  location: string,
  limit: number
): Promise<any[]> {
  const cappedLimit = Math.min(Math.max(limit, 1), 120);
  const searchQueries = Array.from(
    new Set(
      [
        [query, location].filter(Boolean).join(" ").trim(),
        query.trim(),
        location ? `${query} ${location} السعودية`.trim() : "",
      ]
        .map(value => value.trim())
        .filter(Boolean)
    )
  );

  const aggregate: any[] = [];

  for (const searchQuery of searchQueries) {
    const searchUrl = buildTikTokUserSearchUrl(searchQuery);
    let browser: any = null;

    try {
      browser = await openBrightDataBrowser();
      const page = await browser.newPage();
      await page.setDefaultNavigationTimeout(35000);
      await page.setViewport({ width: 1365, height: 900 });
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
      );
      await page.setExtraHTTPHeaders({
        "Accept-Language": "ar-SA,ar;q=0.9,en-US;q=0.8,en;q=0.7",
      });

      await page.goto(searchUrl, {
        waitUntil: "domcontentloaded",
        timeout: 35000,
      });
      await sleep(4500);

      for (let index = 0; index < 3; index += 1) {
        await page.evaluate(() => {
          window.scrollBy(0, window.innerHeight * 1.6);
        });
        await sleep(1800);
      }

      const [rawCandidates, html] = await Promise.all([
        page.evaluate(
          maxCandidates => {
            const items: Array<{ href: string; text: string }> = [];
            const seen = new Set<string>();
            const anchors = Array.from(document.querySelectorAll("a"));

            for (const anchor of anchors) {
              const href = (anchor as HTMLAnchorElement).href || "";
              if (!href.includes("tiktok.com/@") || href.includes("/video/"))
                continue;

              const normalizedHref = href.split("?")[0].replace(/\/+$/g, "");
              if (seen.has(normalizedHref)) continue;
              seen.add(normalizedHref);

              let contextText = "";
              let current = anchor.parentElement as HTMLElement | null;
              for (let depth = 0; depth < 5 && current; depth += 1) {
                const currentText = (current.innerText || "")
                  .replace(/\s+/g, " ")
                  .trim();
                if (currentText.length > contextText.length) {
                  contextText = currentText;
                }
                if (currentText.length >= 80) break;
                current = current.parentElement;
              }

              items.push({
                href: normalizedHref,
                text: contextText || (anchor.textContent || "").trim(),
              });

              if (items.length >= maxCandidates) break;
            }

            return items;
          },
          Math.max(cappedLimit * 2, 60)
        ),
        page.content(),
      ]);

      const browserCandidates = rawCandidates
        .map(candidate =>
          mapTikTokDirectCandidate({
            href: candidate.href,
            text: candidate.text,
            source: "tiktok_browser_search_candidate",
          })
        )
        .filter(Boolean);

      const htmlCandidates = extractTikTokCandidatesFromSearchHtml(
        html,
        "tiktok_browser_search_html_candidate",
        cappedLimit * 2
      );

      const mergedCandidates = mergePrioritizedResults(
        browserCandidates,
        htmlCandidates,
        cappedLimit * 3
      );

      for (const candidate of mergedCandidates) {
        aggregate.push(candidate);
      }

      if (browser) {
        try {
          await browser.disconnect();
        } catch {
          // noop
        }
        browser = null;
      }
    } catch (err) {
      console.warn(
        "[TikTok Direct Search] browser discovery failed:",
        searchQuery,
        err
      );
      if (browser) {
        try {
          await browser.disconnect();
        } catch {
          // noop
        }
      }
    }

    if (aggregate.length < cappedLimit) {
      try {
        const html = await fetchWithScrapingBrowser(searchUrl);
        const htmlCandidates = extractTikTokCandidatesFromSearchHtml(
          html,
          "tiktok_direct_search_candidate",
          cappedLimit * 2
        );
        for (const candidate of htmlCandidates) {
          aggregate.push(candidate);
        }
      } catch (err) {
        console.warn(
          "[TikTok Direct Search] HTML browser fallback failed:",
          searchQuery,
          err
        );
      }
    }

    if (aggregate.length < cappedLimit) {
      try {
        const html = await fetchViaProxy(searchUrl, 20000);
        const proxyCandidates = extractTikTokCandidatesFromSearchHtml(
          html,
          "tiktok_proxy_search_candidate",
          cappedLimit * 2
        );
        for (const candidate of proxyCandidates) {
          aggregate.push(candidate);
        }
      } catch (err) {
        console.warn(
          "[TikTok Direct Search] proxy fallback failed:",
          searchQuery,
          err
        );
      }
    }

    const deduped = mergePrioritizedResults(aggregate, [], cappedLimit * 3);
    aggregate.splice(0, aggregate.length, ...deduped);

    if (aggregate.length >= cappedLimit) {
      break;
    }
  }

  return mergePrioritizedResults(aggregate, [], cappedLimit * 3);
}

function extractTwitterHandle(input: string): string | null {
  if (!input) return null;
  try {
    const url = new URL(input.startsWith("http") ? input : `https://${input}`);
    const segments = url.pathname.split("/").filter(Boolean);
    const candidate = segments[0] || "";
    if (
      /^[a-zA-Z0-9_]{2,30}$/.test(candidate) &&
      !["search", "explore", "home", "i", "hashtag", "intent"].includes(
        candidate.toLowerCase()
      )
    ) {
      return candidate;
    }
  } catch {
    const plainMatch = input.match(/(?:twitter|x)\.com\/([a-zA-Z0-9_]{2,30})/i);
    if (plainMatch) return plainMatch[1];
  }
  return null;
}

function normalizeTwitterCandidateUrl(input: string): string {
  const handle = extractTwitterHandle(input);
  return handle ? `https://x.com/${handle}` : input;
}

function buildTwitterUserSearchUrl(searchQuery: string): string {
  return `https://x.com/search?q=${encodeURIComponent(searchQuery.trim())}&src=typed_query&f=user`;
}

function parseTwitterFollowersFromText(text: string): number {
  const normalized = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return 0;

  const patterns = [
    /([\d.,]+(?:\s*[kmb])?)\s*(?:followers|follower|متابع(?:ين)?)/i,
    /(?:followers|follower|متابع(?:ين)?)[^\d]{0,8}([\d.,]+(?:\s*[kmb])?)/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) continue;
    const parsed = parseCompactMetricValue(match[1]);
    if (parsed > 0) return parsed;
  }

  return 0;
}

function summarizeTwitterSearchCard(
  text: string,
  username: string
): {
  displayName: string;
  bio: string;
  followersCount: number;
} {
  const cleaned = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) {
    return {
      displayName: username,
      bio: "",
      followersCount: 0,
    };
  }

  const handleToken = `@${username}`.toLowerCase();
  const lower = cleaned.toLowerCase();
  const handleIndex = lower.indexOf(handleToken);
  const beforeHandle =
    handleIndex > 0 ? cleaned.slice(0, handleIndex).trim() : "";
  const afterHandle =
    handleIndex >= 0
      ? cleaned.slice(handleIndex + handleToken.length).trim()
      : cleaned;

  return {
    displayName:
      beforeHandle && beforeHandle.length <= 120 ? beforeHandle : username,
    bio: afterHandle || cleaned,
    followersCount: parseTwitterFollowersFromText(cleaned),
  };
}

function mapTwitterDirectCandidate(raw: {
  href?: string;
  text?: string;
  username?: string;
  displayName?: string;
  bio?: string;
  followersCount?: number;
  verified?: boolean;
  source?: string;
}): any | null {
  const username = raw.username || extractTwitterHandle(raw.href || "");
  if (!username) return null;

  const normalizedUrl = normalizeTwitterCandidateUrl(raw.href || username);
  const summary = summarizeTwitterSearchCard(raw.text || "", username);
  const displayName = raw.displayName || summary.displayName || username;
  const bio = raw.bio || summary.bio || "";
  const followersCount =
    Number(raw.followersCount || summary.followersCount || 0) || 0;

  return {
    username,
    profileUrl: normalizedUrl,
    url: normalizedUrl,
    displayName,
    bio,
    website: "",
    verified: Boolean(raw.verified),
    candidatePhones: extractPhonesFromLooseText(bio),
    followersCount,
    dataSource: raw.source || "twitter_browser_search_candidate",
  };
}

function extractTwitterCandidatesFromSearchHtml(
  html: string,
  source: string,
  limit: number
): any[] {
  const candidateMap = new Map<string, any>();
  const cappedLimit = Math.min(Math.max(limit, 1), 200);

  const pushCandidate = (candidate: any | null) => {
    if (!candidate) return;
    const key = getResultIdentity(candidate);
    if (!key) return;
    const previous = candidateMap.get(key);
    if (!previous) {
      candidateMap.set(key, candidate);
      return;
    }
    const previousBioLength = String(previous.bio || "").length;
    const nextBioLength = String(candidate.bio || "").length;
    if (nextBioLength > previousBioLength) {
      candidateMap.set(key, { ...previous, ...candidate });
    }
  };

  const hrefPatterns = [
    /https?:\/\/x\.com\/([a-zA-Z0-9_]{2,30})(?!\/status)(?:[\/"'\s?]|$)/gi,
    /https?:\/\/twitter\.com\/([a-zA-Z0-9_]{2,30})(?!\/status)(?:[\/"'\s?]|$)/gi,
    /https?:\\\/\\\/x\.com\\\/([a-zA-Z0-9_]{2,30})(?!\\\/status)(?:\\\/|\\?"|\\u0026|\s|$)/gi,
    /https?:\\\/\\\/twitter\.com\\\/([a-zA-Z0-9_]{2,30})(?!\\\/status)(?:\\\/|\\?"|\\u0026|\s|$)/gi,
  ];

  const reservedHandles = new Set([
    "search",
    "explore",
    "home",
    "i",
    "hashtag",
    "intent",
    "messages",
    "notifications",
    "compose",
    "settings",
  ]);

  for (const pattern of hrefPatterns) {
    let match: RegExpExecArray | null = null;
    while ((match = pattern.exec(html)) !== null) {
      const username = match[1];
      if (reservedHandles.has(username.toLowerCase())) continue;
      pushCandidate(
        mapTwitterDirectCandidate({
          username,
          href: `https://x.com/${username}`,
          source,
        })
      );
      if (candidateMap.size >= cappedLimit) break;
    }
    if (candidateMap.size >= cappedLimit) break;
  }

  if (candidateMap.size < cappedLimit) {
    const profileObjectRegex =
      /"screen_name":"([a-zA-Z0-9_]{2,30})"[\s\S]{0,320}?"name":"([^"]{0,160})"[\s\S]{0,1200}?"description":"([^"]{0,600})"(?:[\s\S]{0,500}?"followers_count":(\d+))?/gi;
    let match: RegExpExecArray | null = null;
    while ((match = profileObjectRegex.exec(html)) !== null) {
      const username = match[1];
      if (reservedHandles.has(username.toLowerCase())) continue;
      pushCandidate(
        mapTwitterDirectCandidate({
          username,
          href: `https://x.com/${username}`,
          displayName: decodeLooseJsonText(match[2]),
          bio: decodeLooseJsonText(match[3]),
          followersCount: Number(match[4] || 0) || 0,
          source,
        })
      );
      if (candidateMap.size >= cappedLimit) break;
    }
  }

  return Array.from(candidateMap.values()).slice(0, cappedLimit);
}

async function discoverTwitterCandidatesFromDirectSearch(
  query: string,
  location: string,
  limit: number
): Promise<any[]> {
  const cappedLimit = Math.min(Math.max(limit, 1), 120);
  const searchQueries = Array.from(
    new Set(
      [
        [query, location].filter(Boolean).join(" ").trim(),
        query.trim(),
        location ? `${query} ${location} السعودية`.trim() : "",
      ]
        .map(value => value.trim())
        .filter(Boolean)
    )
  );

  const aggregate: any[] = [];

  for (const searchQuery of searchQueries) {
    const searchUrl = buildTwitterUserSearchUrl(searchQuery);
    let browser: any = null;

    try {
      browser = await openBrightDataBrowser();
      const page = await browser.newPage();
      await page.setDefaultNavigationTimeout(35000);
      await page.setViewport({ width: 1440, height: 980 });
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
      );
      await page.setExtraHTTPHeaders({
        "Accept-Language": "ar-SA,ar;q=0.9,en-US;q=0.8,en;q=0.7",
      });

      await page.goto(searchUrl, {
        waitUntil: "domcontentloaded",
        timeout: 35000,
      });
      await sleep(5000);

      for (let index = 0; index < 3; index += 1) {
        await page.evaluate(() => {
          window.scrollBy(0, window.innerHeight * 1.7);
        });
        await sleep(1800);
      }

      const [rawCandidates, html] = await Promise.all([
        page.evaluate(
          maxCandidates => {
            const items: Array<{ href: string; text: string }> = [];
            const seen = new Set<string>();
            const anchors = Array.from(document.querySelectorAll("a"));
            const reserved = new Set([
              "search",
              "explore",
              "home",
              "i",
              "hashtag",
              "intent",
              "messages",
              "notifications",
              "compose",
              "settings",
            ]);

            for (const anchor of anchors) {
              const href = (anchor as HTMLAnchorElement).href || "";
              if (!/https?:\/\/(?:www\.)?(?:x|twitter)\.com\//i.test(href))
                continue;
              if (/\/status\//i.test(href)) continue;

              const url = new URL(href);
              const segments = url.pathname.split("/").filter(Boolean);
              const handle = segments[0] || "";
              if (!/^[a-zA-Z0-9_]{2,30}$/.test(handle)) continue;
              if (reserved.has(handle.toLowerCase())) continue;

              const normalizedHref = `https://x.com/${handle}`;
              if (seen.has(normalizedHref)) continue;
              seen.add(normalizedHref);

              let contextText = "";
              let current = anchor.parentElement as HTMLElement | null;
              for (let depth = 0; depth < 6 && current; depth += 1) {
                const currentText = (current.innerText || "")
                  .replace(/\s+/g, " ")
                  .trim();
                if (currentText.length > contextText.length) {
                  contextText = currentText;
                }
                if (currentText.length >= 120) break;
                current = current.parentElement;
              }

              items.push({
                href: normalizedHref,
                text: contextText || (anchor.textContent || "").trim(),
              });

              if (items.length >= maxCandidates) break;
            }

            return items;
          },
          Math.max(cappedLimit * 2, 60)
        ),
        page.content(),
      ]);

      const browserCandidates = rawCandidates
        .map(candidate =>
          mapTwitterDirectCandidate({
            href: candidate.href,
            text: candidate.text,
            source: "twitter_browser_search_candidate",
          })
        )
        .filter(Boolean);

      const htmlCandidates = extractTwitterCandidatesFromSearchHtml(
        html,
        "twitter_direct_search_candidate",
        cappedLimit * 2
      );

      const mergedCandidates = mergePrioritizedResults(
        browserCandidates,
        htmlCandidates,
        cappedLimit * 3
      );

      for (const candidate of mergedCandidates) {
        aggregate.push(candidate);
      }

      if (browser) {
        try {
          await browser.disconnect();
        } catch {
          // noop
        }
        browser = null;
      }
    } catch (err) {
      console.warn(
        "[Twitter Direct Search] browser discovery failed:",
        searchQuery,
        err
      );
      if (browser) {
        try {
          await browser.disconnect();
        } catch {
          // noop
        }
      }
    }

    if (aggregate.length < cappedLimit) {
      try {
        const html = await fetchWithScrapingBrowser(searchUrl);
        const htmlCandidates = extractTwitterCandidatesFromSearchHtml(
          html,
          "twitter_scraping_browser_search_candidate",
          cappedLimit * 2
        );
        for (const candidate of htmlCandidates) {
          aggregate.push(candidate);
        }
      } catch (err) {
        console.warn(
          "[Twitter Direct Search] HTML browser fallback failed:",
          searchQuery,
          err
        );
      }
    }

    if (aggregate.length < cappedLimit) {
      try {
        const html = await fetchViaProxy(searchUrl, 20000);
        const proxyCandidates = extractTwitterCandidatesFromSearchHtml(
          html,
          "twitter_proxy_search_candidate",
          cappedLimit * 2
        );
        for (const candidate of proxyCandidates) {
          aggregate.push(candidate);
        }
      } catch (err) {
        console.warn(
          "[Twitter Direct Search] proxy fallback failed:",
          searchQuery,
          err
        );
      }
    }

    const deduped = mergePrioritizedResults(aggregate, [], cappedLimit * 3);
    aggregate.splice(0, aggregate.length, ...deduped);

    if (aggregate.length >= cappedLimit) {
      break;
    }
  }

  return mergePrioritizedResults(aggregate, [], cappedLimit * 3);
}

function extractLinkedInCompanyPath(
  input: string
): { type: "company" | "school" | "showcase"; slug: string } | null {
  if (!input) return null;
  try {
    const url = new URL(input.startsWith("http") ? input : `https://${input}`);
    const match = url.pathname.match(
      /\/(company|school|showcase)\/([a-zA-Z0-9._-]{2,120})/i
    );
    if (!match) return null;
    return {
      type: match[1].toLowerCase() as "company" | "school" | "showcase",
      slug: match[2],
    };
  } catch {
    const plainMatch = input.match(
      /linkedin\.com\/(company|school|showcase)\/([a-zA-Z0-9._-]{2,120})/i
    );
    if (!plainMatch) return null;
    return {
      type: plainMatch[1].toLowerCase() as "company" | "school" | "showcase",
      slug: plainMatch[2],
    };
  }
}

function normalizeLinkedInCompanyUrl(input: string): string {
  const companyPath = extractLinkedInCompanyPath(input);
  return companyPath
    ? `https://www.linkedin.com/${companyPath.type}/${companyPath.slug}/`
    : input;
}

function buildLinkedInCompanySearchUrl(searchQuery: string): string {
  return `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(searchQuery.trim())}`;
}

function parseLinkedInFollowersFromText(text: string): number {
  const normalized = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return 0;
  const patterns = [
    /([\d.,]+(?:\s*[kmb])?)\s*(?:followers|follower|متابع(?:ين)?)/i,
    /(?:followers|follower|متابع(?:ين)?)[^\d]{0,8}([\d.,]+(?:\s*[kmb])?)/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) continue;
    const parsed = parseCompactMetricValue(match[1]);
    if (parsed > 0) return parsed;
  }

  return 0;
}

function parseLinkedInEmployeesFromText(text: string): string {
  const normalized = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return "";
  const match = normalized.match(
    /([\d.,+\-]+(?:\s*[kmb])?)\s*(?:employees|employee|موظف(?:ين)?)/i
  );
  return match ? match[1].trim() : "";
}

function summarizeLinkedInCompanyCard(
  text: string,
  fallbackName: string
): {
  displayName: string;
  bio: string;
  followersCount: number;
  employeesCount: string;
} {
  const cleaned = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) {
    return {
      displayName: fallbackName,
      bio: "",
      followersCount: 0,
      employeesCount: "",
    };
  }

  const displayName = cleaned.length <= 120 ? cleaned : fallbackName;

  const bio =
    cleaned === displayName ? "" : cleaned.replace(displayName, "").trim();

  return {
    displayName,
    bio,
    followersCount: parseLinkedInFollowersFromText(cleaned),
    employeesCount: parseLinkedInEmployeesFromText(cleaned),
  };
}

function mapLinkedInDirectCandidate(raw: {
  href?: string;
  text?: string;
  username?: string;
  displayName?: string;
  bio?: string;
  followersCount?: number;
  employeesCount?: string;
  verified?: boolean;
  source?: string;
}): any | null {
  const companyPath = extractLinkedInCompanyPath(
    raw.href || raw.username || ""
  );
  if (!companyPath) return null;

  const normalizedUrl = normalizeLinkedInCompanyUrl(raw.href || "");
  const summary = summarizeLinkedInCompanyCard(
    raw.text || "",
    raw.displayName || companyPath.slug
  );

  return {
    username: companyPath.slug,
    type: companyPath.type,
    url: normalizedUrl,
    profileUrl: normalizedUrl,
    displayName: raw.displayName || summary.displayName || companyPath.slug,
    bio: raw.bio || summary.bio || "",
    website: "",
    verified: Boolean(raw.verified),
    candidatePhones: extractPhonesFromLooseText(raw.bio || summary.bio || ""),
    followersCount:
      Number(raw.followersCount || summary.followersCount || 0) || 0,
    employeesCount: raw.employeesCount || summary.employeesCount || "",
    dataSource: raw.source || "linkedin_browser_company_candidate",
  };
}

function extractLinkedInCompanyCandidatesFromSearchHtml(
  html: string,
  source: string,
  limit: number
): any[] {
  const candidateMap = new Map<string, any>();
  const cappedLimit = Math.min(Math.max(limit, 1), 200);

  const pushCandidate = (candidate: any | null) => {
    if (!candidate) return;
    const key = getResultIdentity(candidate);
    if (!key) return;
    const previous = candidateMap.get(key);
    if (!previous) {
      candidateMap.set(key, candidate);
      return;
    }
    const previousBioLength = String(previous.bio || "").length;
    const nextBioLength = String(candidate.bio || "").length;
    if (nextBioLength > previousBioLength) {
      candidateMap.set(key, { ...previous, ...candidate });
    }
  };

  const hrefPatterns = [
    /https?:\/\/(?:[\w.-]+\.)?linkedin\.com\/(company|school|showcase)\/([a-zA-Z0-9._-]{2,120})\/?/gi,
    /https?:\\\/\\\/(?:[\w.-]+\.)?linkedin\.com\\\/(company|school|showcase)\\\/([a-zA-Z0-9._-]{2,120})\\\/?/gi,
  ];

  for (const pattern of hrefPatterns) {
    let match: RegExpExecArray | null = null;
    while ((match = pattern.exec(html)) !== null) {
      pushCandidate(
        mapLinkedInDirectCandidate({
          href: `https://www.linkedin.com/${match[1].toLowerCase()}/${match[2]}/`,
          source,
        })
      );
      if (candidateMap.size >= cappedLimit) break;
    }
    if (candidateMap.size >= cappedLimit) break;
  }

  return Array.from(candidateMap.values()).slice(0, cappedLimit);
}

async function discoverLinkedInCompanyCandidatesDirect(
  query: string,
  location: string,
  limit: number
): Promise<any[]> {
  const cappedLimit = Math.min(Math.max(limit, 1), 120);
  const searchQueries = Array.from(
    new Set(
      [
        [query, location].filter(Boolean).join(" ").trim(),
        query.trim(),
        location ? `${query} ${location} السعودية`.trim() : "",
      ]
        .map(value => value.trim())
        .filter(Boolean)
    )
  );

  const aggregate: any[] = [];

  for (const searchQuery of searchQueries) {
    const searchUrl = buildLinkedInCompanySearchUrl(searchQuery);
    let browser: any = null;

    try {
      browser = await openBrightDataBrowser();
      const page = await browser.newPage();
      await page.setDefaultNavigationTimeout(35000);
      await page.setViewport({ width: 1440, height: 980 });
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
      );
      await page.setExtraHTTPHeaders({
        "Accept-Language": "ar-SA,ar;q=0.9,en-US;q=0.8,en;q=0.7",
      });

      await page.goto(searchUrl, {
        waitUntil: "domcontentloaded",
        timeout: 35000,
      });
      await sleep(5000);

      for (let index = 0; index < 3; index += 1) {
        await page.evaluate(() => {
          window.scrollBy(0, window.innerHeight * 1.7);
        });
        await sleep(1800);
      }

      const [rawCandidates, html] = await Promise.all([
        page.evaluate(
          maxCandidates => {
            const items: Array<{
              href: string;
              text: string;
              displayName: string;
            }> = [];
            const seen = new Set<string>();
            const anchors = Array.from(document.querySelectorAll("a"));

            for (const anchor of anchors) {
              const href = (anchor as HTMLAnchorElement).href || "";
              const match = href.match(
                /linkedin\.com\/(company|school|showcase)\/([a-zA-Z0-9._-]{2,120})/i
              );
              if (!match) continue;

              const normalizedHref = `https://www.linkedin.com/${match[1].toLowerCase()}/${match[2]}/`;
              if (seen.has(normalizedHref)) continue;
              seen.add(normalizedHref);

              let contextText = "";
              let current = anchor.parentElement as HTMLElement | null;
              for (let depth = 0; depth < 6 && current; depth += 1) {
                const currentText = (current.innerText || "")
                  .replace(/\s+/g, " ")
                  .trim();
                if (currentText.length > contextText.length) {
                  contextText = currentText;
                }
                if (currentText.length >= 160) break;
                current = current.parentElement;
              }

              items.push({
                href: normalizedHref,
                text: contextText || (anchor.textContent || "").trim(),
                displayName: (anchor.textContent || "")
                  .replace(/\s+/g, " ")
                  .trim(),
              });

              if (items.length >= maxCandidates) break;
            }

            return items;
          },
          Math.max(cappedLimit * 2, 60)
        ),
        page.content(),
      ]);

      const browserCandidates = rawCandidates
        .map(candidate =>
          mapLinkedInDirectCandidate({
            href: candidate.href,
            text: candidate.text,
            displayName: candidate.displayName,
            source: "linkedin_browser_company_candidate",
          })
        )
        .filter(Boolean);

      const htmlCandidates = extractLinkedInCompanyCandidatesFromSearchHtml(
        html,
        "linkedin_direct_company_candidate",
        cappedLimit * 2
      );

      const mergedCandidates = mergePrioritizedResults(
        browserCandidates,
        htmlCandidates,
        cappedLimit * 3
      );

      for (const candidate of mergedCandidates) {
        aggregate.push(candidate);
      }

      if (browser) {
        try {
          await browser.disconnect();
        } catch {
          // noop
        }
        browser = null;
      }
    } catch (err) {
      console.warn(
        "[LinkedIn Direct Search] browser discovery failed:",
        searchQuery,
        err
      );
      if (browser) {
        try {
          await browser.disconnect();
        } catch {
          // noop
        }
      }
    }

    if (aggregate.length < cappedLimit) {
      try {
        const html = await fetchWithScrapingBrowser(searchUrl);
        const htmlCandidates = extractLinkedInCompanyCandidatesFromSearchHtml(
          html,
          "linkedin_scraping_browser_company_candidate",
          cappedLimit * 2
        );
        for (const candidate of htmlCandidates) {
          aggregate.push(candidate);
        }
      } catch (err) {
        console.warn(
          "[LinkedIn Direct Search] HTML browser fallback failed:",
          searchQuery,
          err
        );
      }
    }

    if (aggregate.length < cappedLimit) {
      try {
        const html = await fetchViaProxy(searchUrl, 20000);
        const proxyCandidates = extractLinkedInCompanyCandidatesFromSearchHtml(
          html,
          "linkedin_proxy_company_candidate",
          cappedLimit * 2
        );
        for (const candidate of proxyCandidates) {
          aggregate.push(candidate);
        }
      } catch (err) {
        console.warn(
          "[LinkedIn Direct Search] proxy fallback failed:",
          searchQuery,
          err
        );
      }
    }

    const deduped = mergePrioritizedResults(aggregate, [], cappedLimit * 3);
    aggregate.splice(0, aggregate.length, ...deduped);

    if (aggregate.length >= cappedLimit) {
      break;
    }
  }

  return mergePrioritizedResults(aggregate, [], cappedLimit * 3);
}

async function discoverOfficialSocialCandidatesFromWeb(
  platform: "tiktok" | "twitter",
  query: string,
  location: string,
  limit: number
): Promise<any[]> {
  const requestedLimit = Math.min(
    Math.max(limit, 1),
    BUSINESS_WEBSITE_DISCOVERY_MAX
  );
  const searchPlans = [
    { city: location || "", page: 1 },
    ...(location ? [{ city: "", page: 1 }] : []),
    ...(requestedLimit > 5 ? [{ city: location || "", page: 2 }] : []),
  ];

  const platformKey = platform === "tiktok" ? "tiktok" : "twitter";
  const domainPattern =
    platform === "tiktok" ? /tiktok\.com/i : /(?:x|twitter)\.com/i;
  const extractHandle =
    platform === "tiktok" ? extractTikTokHandle : extractTwitterHandle;
  const normalizeUrl =
    platform === "tiktok"
      ? normalizeTikTokCandidateUrl
      : normalizeTwitterCandidateUrl;

  const webResults: Array<{
    name: string;
    description: string;
    url: string;
    city?: string;
    socialLinks?: { tiktok?: string; twitter?: string };
  }> = [];

  for (const plan of searchPlans) {
    try {
      const response = await searchGoogleWeb(
        query,
        plan.city,
        "businesses",
        plan.page
      );
      webResults.push(
        ...response.results.map(result => ({
          name: result.name,
          description: result.description,
          url: result.url,
          city: result.city,
          socialLinks: result.socialLinks,
        }))
      );
    } catch (err) {
      console.warn(
        `[${platform} Web Discovery] Google search plan failed:`,
        plan,
        err
      );
    }
  }

  if (webResults.length === 0) return [];

  const directSocialCandidates: any[] = [];
  const websiteSeedMap = new Map<
    string,
    { name: string; description: string; city?: string }
  >();

  for (const result of webResults) {
    const directSocial = result.socialLinks?.[platformKey] || "";
    const directHandle = extractHandle(directSocial);
    if (directHandle) {
      directSocialCandidates.push({
        username: directHandle,
        url: normalizeUrl(directSocial),
        displayName: result.name || directHandle,
        bio: result.description || "",
        website: result.url,
        verified: true,
        cityHint: result.city || "",
        candidatePhones: [],
        dataSource: `${platform}_website_direct`,
      });
    }

    if (!result.url || !/^https?:\/\//i.test(result.url)) continue;
    if (domainPattern.test(result.url)) continue;
    if (websiteSeedMap.has(result.url)) continue;

    websiteSeedMap.set(result.url, {
      name: result.name,
      description: result.description,
      city: result.city,
    });
  }

  const websiteEntries = Array.from(websiteSeedMap.entries())
    .slice(0, BUSINESS_WEBSITE_DISCOVERY_MAX)
    .map(([url, meta]) => ({
      url,
      source: `${platform}-web:${meta.name || url}`,
    }));

  if (websiteEntries.length === 0) {
    return mergePrioritizedResults(directSocialCandidates, [], requestedLimit);
  }

  const evidences = await extractEvidenceBatch(websiteEntries);
  const extractedCandidates: any[] = [];

  for (const evidence of evidences) {
    const seed = websiteSeedMap.get(evidence.url);
    const links = evidence.socialLinks.filter(link => domainPattern.test(link));

    for (const link of links) {
      const handle = extractHandle(link);
      if (!handle) continue;

      const evidenceBioParts = [
        seed?.description || "",
        evidence.cityHints.length > 0 ? evidence.cityHints.join(" ") : "",
      ].filter(Boolean);

      extractedCandidates.push({
        username: handle,
        url: normalizeUrl(link),
        displayName: evidence.visibleName || seed?.name || handle,
        bio: evidenceBioParts.join(" | "),
        website: evidence.url,
        verified: evidence.confidence === "high",
        cityHint: seed?.city || evidence.cityHints[0] || "",
        candidatePhones: evidence.phones || [],
        dataSource: `${platform}_website_extracted`,
      });
    }
  }

  return mergePrioritizedResults(
    directSocialCandidates,
    extractedCandidates,
    requestedLimit
  );
}

function extractSnapchatHandle(input: string): string | null {
  if (!input) return null;

  try {
    const url = new URL(input.startsWith("http") ? input : `https://${input}`);
    const normalized = `${url.hostname}${url.pathname}`.toLowerCase();
    if (!normalized.includes("snapchat.com")) return null;

    const path = url.pathname.replace(/\/+$/g, "");
    const addMatch = path.match(/\/add\/([a-zA-Z0-9._-]{2,30})/i);
    if (addMatch) return addMatch[1];

    const segments = path.split("/").filter(Boolean);
    const lastSegment = segments.at(-1) || "";
    if (
      /^[a-zA-Z0-9._-]{2,30}$/.test(lastSegment) &&
      !["add", "discover", "spotlight", "stories"].includes(
        lastSegment.toLowerCase()
      )
    ) {
      return lastSegment;
    }
  } catch {
    const plainMatch = input.match(
      /snapchat\.com\/(?:add\/)?([a-zA-Z0-9._-]{2,30})/i
    );
    if (plainMatch) return plainMatch[1];
  }

  return null;
}

function normalizeSnapchatCandidateUrl(input: string): string {
  const handle = extractSnapchatHandle(input);
  return handle ? `https://www.snapchat.com/add/${handle}` : input;
}

async function discoverSnapchatCandidatesFromWeb(
  query: string,
  location: string,
  limit: number
): Promise<any[]> {
  const requestedLimit = Math.min(
    Math.max(limit, 1),
    SNAPCHAT_WEBSITE_DISCOVERY_MAX
  );
  const searchPlans = [
    { city: location || "", page: 1 },
    ...(location ? [{ city: "", page: 1 }] : []),
    ...(requestedLimit > 5 ? [{ city: location || "", page: 2 }] : []),
  ];

  const webResults: Array<{
    name: string;
    description: string;
    url: string;
    city?: string;
    socialLinks?: { snapchat?: string };
  }> = [];

  for (const plan of searchPlans) {
    try {
      const response = await searchGoogleWeb(
        query,
        plan.city,
        "businesses",
        plan.page
      );
      webResults.push(
        ...response.results.map(result => ({
          name: result.name,
          description: result.description,
          url: result.url,
          city: result.city,
          socialLinks: result.socialLinks,
        }))
      );
    } catch (err) {
      console.warn(
        "[Snapchat Web Discovery] Google search plan failed:",
        plan,
        err
      );
    }
  }

  if (webResults.length === 0) return [];

  const directSocialCandidates: any[] = [];
  const websiteSeedMap = new Map<
    string,
    { name: string; description: string; city?: string }
  >();

  for (const result of webResults) {
    const directSnapchat = result.socialLinks?.snapchat || "";
    const directHandle = extractSnapchatHandle(directSnapchat);
    if (directHandle) {
      directSocialCandidates.push({
        username: directHandle,
        url: normalizeSnapchatCandidateUrl(directSnapchat),
        displayName: result.name || directHandle,
        bio: result.description || "",
        website: result.url,
        verified: true,
        cityHint: result.city || "",
        dataSource: "snapchat_website_direct",
      });
    }

    if (!result.url || !/^https?:\/\//i.test(result.url)) continue;
    if (/snapchat\.com/i.test(result.url)) continue;
    if (websiteSeedMap.has(result.url)) continue;

    websiteSeedMap.set(result.url, {
      name: result.name,
      description: result.description,
      city: result.city,
    });
  }

  const websiteEntries = Array.from(websiteSeedMap.entries())
    .slice(0, SNAPCHAT_WEBSITE_DISCOVERY_MAX)
    .map(([url, meta]) => ({
      url,
      source: `snapchat-web:${meta.name || url}`,
    }));

  if (websiteEntries.length === 0) {
    return mergePrioritizedResults(directSocialCandidates, [], requestedLimit);
  }

  const evidences = await extractEvidenceBatch(websiteEntries);
  const extractedCandidates: any[] = [];

  for (const evidence of evidences) {
    const seed = websiteSeedMap.get(evidence.url);
    const snapchatLinks = evidence.socialLinks.filter(link =>
      /snapchat\.com/i.test(link)
    );

    for (const link of snapchatLinks) {
      const handle = extractSnapchatHandle(link);
      if (!handle) continue;

      const evidenceBioParts = [
        seed?.description || "",
        evidence.cityHints.length > 0 ? evidence.cityHints.join(" ") : "",
      ].filter(Boolean);

      extractedCandidates.push({
        username: handle,
        url: normalizeSnapchatCandidateUrl(link),
        displayName: evidence.visibleName || seed?.name || handle,
        bio: evidenceBioParts.join(" | "),
        website: evidence.url,
        verified: evidence.confidence === "high",
        cityHint: seed?.city || evidence.cityHints[0] || "",
        dataSource: "snapchat_website_extracted",
      });
    }
  }

  return mergePrioritizedResults(
    directSocialCandidates,
    extractedCandidates,
    requestedLimit
  );
}

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
    (nameText.includes(queryText) ||
      bioText.includes(queryText) ||
      contentText.includes(queryText));

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
  if (input.businessSignals)
    score += Math.min(1.5, input.businessSignals * 0.5);

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
        {
          role: "system",
          content: "أنت محلل بيانات متخصص في السوق السعودي. أرجع JSON فقط.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" } as any,
    });

    const content = response?.choices?.[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(typeof content === "string" ? content : "{}");
      if (Array.isArray(parsed)) return parsed;
      if (parsed.results && Array.isArray(parsed.results))
        return parsed.results;
    }
  } catch {
    // إذا فشل التحليل، نرجع النتائج الأصلية
  }
  return results;
}

// ─── بحث Instagram (SERP API) ─────────────────────────────────────────────────
async function scrapeInstagram(
  query: string,
  location: string,
  limit = 10
): Promise<any[]> {
  const requestedLimit = normalizeSearchLimit(limit);
  const { discoveryLimit } = getModerateOverfetchConfig(requestedLimit);
  const instagramSourceRank = (verificationLevel: string) => {
    switch (verificationLevel) {
      case "dataset":
        return 3;
      case "browser_verified":
        return 2;
      case "candidate_only":
        return 1;
      case "serp_fallback":
      default:
        return 0;
    }
  };
  const sortInstagramResults = (results: any[]) =>
    results.sort((a, b) => {
      const scoreDiff = (b.confidenceScore || 0) - (a.confidenceScore || 0);
      if (scoreDiff !== 0) return scoreDiff;
      const validationDiff =
        (b.linkValidationScore || 0) +
        (b.commercialIntentScore || 0) -
        ((a.linkValidationScore || 0) + (a.commercialIntentScore || 0));
      if (validationDiff !== 0) return validationDiff;
      const sourceDiff =
        instagramSourceRank(b.verificationLevel) -
        instagramSourceRank(a.verificationLevel);
      if (sourceDiff !== 0) return sourceDiff;
      const sizeDiff =
        (b.sizePreferenceScore || 0) - (a.sizePreferenceScore || 0);
      if (sizeDiff !== 0) return sizeDiff;
      return (b.followersCount || 0) - (a.followersCount || 0);
    });

  const mapDatasetResult = (r: any) => {
    const businessSignals =
      Number(!!r.is_business_account) +
      Number(!!r.is_verified) +
      Number(!!r.business_category) +
      Number(!!r.business_email) +
      Number(!!r.business_phone) +
      Number(!!r.website) +
      Number((r.followers || 0) >= 1000);
    const relevance = scoreProfileRelevance({
      query,
      location,
      name: r.full_name || r.username,
      bio: r.biography || "",
      website: r.website || "",
      verified: !!r.is_verified,
      businessSignals,
    });
    const business = evaluateStrictBusinessProfile({
      name: r.full_name || r.username,
      bio: r.biography || "",
      website: r.website || "",
      phone: r.business_phone || "",
      candidatePhones: extractPhonesFromLooseText(
        `${r.business_phone || ""} ${r.biography || ""}`
      ),
      verified: !!r.is_verified,
    });
    const sizePreference = evaluateFollowerSizePreference(
      "instagram",
      Number(r.followers || 0) || 0
    );
    const confidenceScore = buildConfidenceScore(
      relevance.score +
        businessSignals * 0.4 +
        business.businessScore * 0.35 +
        sizePreference.sizePreferenceScore,
      "dataset"
    );

    return {
      platform: "instagram",
      username: r.username,
      id: r.username,
      name: r.full_name || r.username,
      fullName: r.full_name || r.username,
      profileUrl: r.profile_url,
      profile_url: r.profile_url,
      url: r.profile_url,
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
      city: relevance.locationMatched ? location : "",
      rating: relevance.score,
      relevanceScore: relevance.score,
      businessScore: business.businessScore,
      businessSignals: [
        ...(business.hasValidatedCommerceLink ? ["validated_link"] : []),
        ...(business.hasOfficialWebsite ? ["official_website"] : []),
        ...(business.hasPhone ? ["phone"] : []),
        ...(business.hasCommercialIntent ? ["commercial_intent"] : []),
        ...business.businessBioMatches,
      ],
      strictPass: business.strictPass,
      hardReject: business.hardReject,
      businessValidationLevel: business.businessValidationLevel,
      linkValidationScore: business.linkValidationScore,
      commercialIntentScore: business.commercialIntentScore,
      negativeKeywordMatches: business.negativeKeywordMatches,
      commercialIntentMatches: business.commercialIntentMatches,
      validatedLinkMatches: business.validatedLinkMatches,
      matchedBy: relevance.matchedTerms,
      exactPhraseMatched: relevance.exactPhraseMatched,
      confidenceScore,
      confidenceLevel: toConfidenceLevel(confidenceScore),
      sizePreferenceScore: sizePreference.sizePreferenceScore,
      sizeSegment: sizePreference.sizeSegment,
      sizeCapExceeded: sizePreference.sizeCapExceeded,
      sizeHardReject: sizePreference.hardReject,
      verificationLevel: "dataset",
      dataSource: "instagram_dataset",
    };
  };

  const mapSerpResult = (r: any) => {
    const relevance = scoreProfileRelevance({
      query,
      location,
      name: r.displayName || r.username,
      bio: r.bio || "",
    });
    const business = evaluateStrictBusinessProfile({
      name: r.displayName || r.username,
      bio: r.bio || "",
      website: "",
      phone: "",
      candidatePhones: r.candidatePhones || [],
      verified: false,
    });
    const followersCount = Number(r.followersCount || r.followers || 0) || 0;
    const sizePreference = evaluateFollowerSizePreference(
      "instagram",
      followersCount
    );
    const confidenceScore = buildConfidenceScore(
      relevance.score +
        sizePreference.sizePreferenceScore +
        business.businessScore * 0.35,
      "serp"
    );

    return {
      platform: "instagram",
      username: r.username,
      id: r.username,
      name: r.displayName,
      fullName: r.displayName,
      profileUrl: r.url,
      profile_url: r.url,
      url: r.url,
      bio: r.bio,
      description: r.bio,
      followers: followersCount,
      followersCount,
      website: "",
      phone: "",
      city: relevance.locationMatched ? location : "",
      rating: relevance.score,
      relevanceScore: relevance.score,
      businessScore: business.businessScore,
      businessSignals: [
        ...(business.hasPhone ? ["phone"] : []),
        ...(business.hasCommercialIntent ? ["commercial_intent"] : []),
        ...business.businessBioMatches,
      ],
      strictPass: business.strictPass,
      hardReject: business.hardReject,
      businessValidationLevel: business.businessValidationLevel,
      linkValidationScore: business.linkValidationScore,
      commercialIntentScore: business.commercialIntentScore,
      negativeKeywordMatches: business.negativeKeywordMatches,
      commercialIntentMatches: business.commercialIntentMatches,
      validatedLinkMatches: business.validatedLinkMatches,
      matchedBy: relevance.matchedTerms,
      exactPhraseMatched: relevance.exactPhraseMatched,
      confidenceScore,
      confidenceLevel: toConfidenceLevel(confidenceScore),
      sizePreferenceScore: sizePreference.sizePreferenceScore,
      sizeSegment: sizePreference.sizeSegment,
      sizeCapExceeded: sizePreference.sizeCapExceeded,
      sizeHardReject: sizePreference.hardReject,
      verificationLevel: "serp_fallback",
      dataSource: "instagram_serp_fallback",
    };
  };

  let mergedResults: any[] = [];

  try {
    const datasetResult = await searchInstagramByKeyword(
      query,
      location,
      discoveryLimit
    );
    if (datasetResult.success && datasetResult.results.length > 0) {
      const primaryDatasetResults = sortInstagramResults(
        datasetResult.results.slice(0, discoveryLimit).map(mapDatasetResult)
      );
      mergedResults = mergePrioritizedResults(
        mergedResults,
        primaryDatasetResults,
        discoveryLimit
      );
    }
  } catch (err) {
    console.warn("[Instagram Dataset] primary search failed:", err);
  }

  if (location && mergedResults.length < requestedLimit) {
    try {
      const broadDatasetResult = await searchInstagramByKeyword(
        query,
        undefined,
        discoveryLimit
      );
      if (broadDatasetResult.success && broadDatasetResult.results.length > 0) {
        const broadDatasetResults = sortInstagramResults(
          broadDatasetResult.results
            .slice(0, discoveryLimit)
            .map(mapDatasetResult)
        );
        mergedResults = mergePrioritizedResults(
          mergedResults,
          broadDatasetResults,
          discoveryLimit
        );
      }
    } catch (err) {
      console.warn("[Instagram Dataset] broad search failed:", err);
    }
  }

  if (mergedResults.length < requestedLimit) {
    try {
      const serpResults = await searchInstagramSERP(
        query,
        location,
        discoveryLimit
      );
      const mappedSerpResults = sortInstagramResults(
        serpResults.slice(0, discoveryLimit).map(mapSerpResult)
      );
      mergedResults = mergePrioritizedResults(
        mergedResults,
        mappedSerpResults,
        discoveryLimit
      );
    } catch (err) {
      console.warn("[Instagram SERP] location fallback failed:", err);
    }
  }

  if (location && mergedResults.length < requestedLimit) {
    try {
      const broadSerpResults = await searchInstagramSERP(
        query,
        "",
        discoveryLimit
      );
      const mappedBroadSerpResults = sortInstagramResults(
        broadSerpResults.slice(0, discoveryLimit).map(mapSerpResult)
      );
      mergedResults = mergePrioritizedResults(
        mergedResults,
        mappedBroadSerpResults,
        discoveryLimit
      );
    } catch (err) {
      console.warn("[Instagram SERP] broad fallback failed:", err);
    }
  }

  const sortedResults = sortInstagramResults(mergedResults);
  const finalResults =
    sortedResults.length <= requestedLimit
      ? sortedResults.slice(0, requestedLimit)
      : (() => {
          const strictFilteredResults = sortedResults.filter(
            result => !result.hardReject && !result.sizeHardReject
          );
          return (
            strictFilteredResults.length >= requestedLimit
              ? strictFilteredResults
              : sortedResults
          ).slice(0, requestedLimit);
        })();

  logPlatformSearchMetrics({
    platform: "instagram",
    query,
    location,
    requestedLimit,
    discoveryLimit,
    discovered: mergedResults.length,
    verified: sortedResults.filter(
      result =>
        result.verificationLevel === "dataset" ||
        result.verificationLevel === "browser_verified"
    ).length,
    filteredOut: Math.max(0, sortedResults.length - finalResults.length),
    deadLinks: 0,
    returned: finalResults.length,
  });

  return finalResults;
}

// ─── بحث TikTok (SERP API) ─────────────────────────────────────────────────────
async function scrapeTikTok(
  query: string,
  location: string,
  limit = 10
): Promise<any[]> {
  const requestedLimit = normalizeSearchLimit(limit);
  const { discoveryLimit, verificationLimit } =
    getModerateOverfetchConfig(requestedLimit);
  const sortTikTokResults = (results: any[]) =>
    results.sort((a, b) => {
      const scoreDiff = (b.confidenceScore || 0) - (a.confidenceScore || 0);
      if (scoreDiff !== 0) return scoreDiff;
      const reachDiff =
        (b.reachPreferenceScore || 0) - (a.reachPreferenceScore || 0);
      if (reachDiff !== 0) return reachDiff;
      const sizeDiff =
        (b.sizePreferenceScore || 0) - (a.sizePreferenceScore || 0);
      if (sizeDiff !== 0) return sizeDiff;
      const businessDiff = (b.businessScore || 0) - (a.businessScore || 0);
      if (businessDiff !== 0) return businessDiff;
      const aFollowers = a.followersCount || 0;
      const bFollowers = b.followersCount || 0;
      if (aFollowers > 0 && bFollowers > 0 && aFollowers !== bFollowers) {
        return aFollowers - bFollowers;
      }
      return bFollowers - aFollowers;
    });

  try {
    let candidates = (
      await discoverTikTokCandidatesFromDirectSearch(
        query,
        location,
        discoveryLimit
      )
    )
      .filter(r => r?.url && r?.username)
      .slice(0, discoveryLimit * 2);

    if (candidates.length < requestedLimit) {
      const serpCandidates = (
        await searchTikTokSERP(query, location, discoveryLimit)
      )
        .filter(r => r.url && r.username)
        .map(r => ({
          ...r,
          url: normalizeTikTokCandidateUrl(r.url),
          followersCount: Number(r.followersCount || r.followers || 0) || 0,
          dataSource: r.dataSource || "tiktok_serp_candidate",
        }))
        .slice(0, discoveryLimit);
      candidates = mergePrioritizedResults(
        candidates,
        serpCandidates,
        discoveryLimit * 3
      );
    }

    if (location && candidates.length < requestedLimit) {
      const broadDirectCandidates = (
        await discoverTikTokCandidatesFromDirectSearch(
          query,
          "",
          discoveryLimit
        )
      )
        .filter(r => r?.url && r?.username)
        .slice(0, discoveryLimit * 2);
      candidates = mergePrioritizedResults(
        candidates,
        broadDirectCandidates,
        discoveryLimit * 3
      );
    }

    if (location && candidates.length < requestedLimit) {
      const broadSerpCandidates = (
        await searchTikTokSERP(query, "", discoveryLimit)
      )
        .filter(r => r.url && r.username)
        .map(r => ({
          ...r,
          url: normalizeTikTokCandidateUrl(r.url),
          followersCount: Number(r.followersCount || r.followers || 0) || 0,
          dataSource: r.dataSource || "tiktok_serp_candidate",
        }))
        .slice(0, discoveryLimit);
      candidates = mergePrioritizedResults(
        candidates,
        broadSerpCandidates,
        discoveryLimit * 3
      );
    }

    if (candidates.length < requestedLimit) {
      const websiteCandidates = await discoverOfficialSocialCandidatesFromWeb(
        "tiktok",
        query,
        location,
        discoveryLimit
      );
      candidates = mergePrioritizedResults(
        candidates,
        websiteCandidates,
        discoveryLimit * 3
      );
    }

    if (location && candidates.length < requestedLimit) {
      const broadWebsiteCandidates =
        await discoverOfficialSocialCandidatesFromWeb(
          "tiktok",
          query,
          "",
          discoveryLimit
        );
      candidates = mergePrioritizedResults(
        candidates,
        broadWebsiteCandidates,
        discoveryLimit * 3
      );
    }

    const applyOverflowFilter = candidates.length > requestedLimit;

    const scoredCandidates = candidates
      .map(candidate => {
        const relevance = scoreTikTokRelevance({
          query,
          location,
          name: candidate.displayName || candidate.username,
          bio: candidate.bio || "",
          website: candidate.website || "",
          verified: !!candidate.verified,
        });
        const business = evaluateStrictBusinessProfile({
          name: candidate.displayName || candidate.username,
          bio: candidate.bio || "",
          website: candidate.website || "",
          phone: candidate.phone || "",
          candidatePhones: candidate.candidatePhones || [],
          verified: !!candidate.verified,
        });
        const rejectCreator =
          business.hardReject ||
          business.creatorOnlyProfile ||
          (business.creatorMatches.length > 0 &&
            !business.hasWebsite &&
            !business.hasPhone);
        const sizePreference = evaluateFollowerSizePreference(
          "tiktok",
          candidate.followersCount || 0
        );
        const overflowAdjustment = applyOverflowFilter
          ? (business.strictPass ? 1.25 : -1.5) + (rejectCreator ? -3.5 : 0)
          : 0;

        return {
          candidate,
          relevance,
          business,
          sizePreference,
          rejectCreator,
          combinedScore:
            relevance.score +
            business.businessScore +
            (candidate.verified ? 0.5 : 0) +
            sizePreference.sizePreferenceScore +
            overflowAdjustment,
        };
      })
      .filter(
        ({ sizePreference, business }) =>
          !business.hardReject &&
          !(applyOverflowFilter && sizePreference.hardReject)
      )
      .sort((a, b) => b.combinedScore - a.combinedScore);

    const verificationPool = scoredCandidates
      .slice(0, verificationLimit)
      .map(({ candidate }) => candidate);

    const verified = await Promise.allSettled(
      verificationPool.map(async candidate => {
        const [datasetResult, postsResult] = await Promise.all([
          fetchTikTokProfile(candidate.url),
          fetchTikTokPosts(candidate.url, 5).catch(() => ({
            success: false,
            data: [],
            platform: "tiktok_posts" as const,
          })),
        ]);
        if (datasetResult.profileExists === false) {
          return {
            deadLink: true,
            deadLinkId: getResultIdentity(candidate),
            platform: "tiktok",
            profileUnavailable: true,
          };
        }
        if (!datasetResult.success || !datasetResult.data?.length) return null;

        const profile = datasetResult.data[0];
        const stats = extractSocialStats("tiktok", datasetResult.data);
        const postStats =
          postsResult.success && postsResult.data?.length
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
        const postsText =
          postStats.recentPosts
            ?.map(post => post.content)
            .filter(Boolean)
            .join(" | ") || "";
        const website = profile.bio_link || candidate.website || "";
        const business = evaluateStrictBusinessProfile({
          name: resolvedName,
          bio: resolvedBio,
          website,
          phone: "",
          candidatePhones: [
            ...(candidate.candidatePhones || []),
            ...extractPhonesFromLooseText(resolvedBio),
          ],
          verified: !!stats.isVerified,
        });
        const rejectCreator =
          business.hardReject ||
          business.creatorOnlyProfile ||
          (business.creatorMatches.length > 0 &&
            !business.hasWebsite &&
            !business.hasPhone);
        const relevance = scoreTikTokRelevance({
          query,
          location,
          name: resolvedName,
          bio: resolvedBio,
          postsText,
          website,
          verified: !!stats.isVerified,
        });

        if (applyOverflowFilter && (!business.strictPass || rejectCreator))
          return null;

        const sizePreference = evaluateFollowerSizePreference(
          "tiktok",
          stats.followersCount || 0
        );
        if (applyOverflowFilter && sizePreference.hardReject) return null;

        const reachPreferenceScore = scoreTikTokReachPreference(
          stats.followersCount || 0
        );
        const confidenceScore = buildConfidenceScore(
          relevance.score + business.businessScore + reachPreferenceScore,
          "dataset"
        );

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
          website,
          verified: !!stats.isVerified,
          isVerified: !!stats.isVerified,
          phone: business.allPhones[0] || "",
          candidatePhones: business.allPhones,
          city: relevance.locationMatched ? location : "",
          rating: relevance.score,
          relevanceScore: relevance.score,
          businessScore: business.businessScore,
          businessSignals: [
            ...(business.hasValidatedCommerceLink ? ["validated_link"] : []),
            ...(business.hasOfficialWebsite ? ["official_website"] : []),
            ...(business.hasWebsite ? ["website"] : []),
            ...(business.hasPhone ? ["phone"] : []),
            ...(business.hasCommercialIntent ? ["commercial_intent"] : []),
            ...business.businessBioMatches,
          ],
          strictPass: business.strictPass,
          hardReject: business.hardReject,
          businessValidationLevel: business.businessValidationLevel,
          linkValidationScore: business.linkValidationScore,
          commercialIntentScore: business.commercialIntentScore,
          negativeKeywordMatches: business.negativeKeywordMatches,
          commercialIntentMatches: business.commercialIntentMatches,
          validatedLinkMatches: business.validatedLinkMatches,
          matchedBy: relevance.matchedTerms,
          exactPhraseMatched: relevance.exactPhraseMatched,
          reachPreferenceScore,
          sizePreferenceScore: sizePreference.sizePreferenceScore,
          sizeSegment: sizePreference.sizeSegment,
          sizeCapExceeded: sizePreference.sizeCapExceeded,
          confidenceScore,
          confidenceLevel: toConfidenceLevel(confidenceScore),
          verificationLevel: "dataset",
          dataSource:
            String(candidate.dataSource || "").includes("browser") ||
            String(candidate.dataSource || "").includes("direct")
              ? "tiktok_direct_profile_verified"
              : String(candidate.dataSource || "").includes("website")
                ? "tiktok_website_verified"
                : "tiktok_business_verified",
        };
      })
    );

    const verifiedResults = sortTikTokResults(
      verified.flatMap(result =>
        result.status === "fulfilled" &&
        result.value &&
        !(result.value as any).deadLink
          ? [result.value]
          : []
      )
    ).slice(0, requestedLimit);

    const deadLinkIds = new Set(
      verified.flatMap(result =>
        result.status === "fulfilled" && (result.value as any)?.deadLink
          ? [(result.value as any).deadLinkId as string]
          : []
      )
    );

    const candidateResults = sortTikTokResults(
      scoredCandidates
        .filter(
          ({ candidate }) => !deadLinkIds.has(getResultIdentity(candidate))
        )
        .slice(0, Math.max(verificationLimit, requestedLimit * 3))
        .map(
          ({
            candidate,
            relevance,
            business,
            rejectCreator,
            combinedScore,
            sizePreference,
          }) => {
            const reachPreferenceScore = scoreTikTokReachPreference(
              candidate.followersCount || 0
            );
            const overflowAdjustment = applyOverflowFilter
              ? (business.strictPass ? 1.25 : -1.5) + (rejectCreator ? -3.5 : 0)
              : 0;
            const confidenceScore = buildConfidenceScore(
              Math.max(
                0,
                relevance.score +
                  business.businessScore +
                  reachPreferenceScore +
                  overflowAdjustment
              ),
              "serp"
            );
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
              followers: candidate.followersCount || 0,
              followersCount: candidate.followersCount || 0,
              phone: business.allPhones[0] || "",
              candidatePhones: business.allPhones,
              website: candidate.website || "",
              city: relevance.locationMatched ? location : "",
              verified: false,
              rating: relevance.score,
              relevanceScore: relevance.score,
              businessScore: business.businessScore,
              businessSignals: [
                ...(business.hasValidatedCommerceLink
                  ? ["validated_link"]
                  : []),
                ...(business.hasOfficialWebsite ? ["official_website"] : []),
                ...(business.hasWebsite ? ["website"] : []),
                ...(business.hasPhone ? ["phone"] : []),
                ...(business.hasCommercialIntent ? ["commercial_intent"] : []),
                ...business.businessBioMatches,
              ],
              strictPass: business.strictPass,
              hardReject: business.hardReject,
              businessValidationLevel: business.businessValidationLevel,
              linkValidationScore: business.linkValidationScore,
              commercialIntentScore: business.commercialIntentScore,
              negativeKeywordMatches: business.negativeKeywordMatches,
              commercialIntentMatches: business.commercialIntentMatches,
              validatedLinkMatches: business.validatedLinkMatches,
              matchedBy: relevance.matchedTerms,
              exactPhraseMatched: relevance.exactPhraseMatched,
              reachPreferenceScore,
              sizePreferenceScore: sizePreference.sizePreferenceScore,
              sizeSegment: sizePreference.sizeSegment,
              sizeCapExceeded: sizePreference.sizeCapExceeded,
              confidenceScore,
              confidenceLevel: toConfidenceLevel(confidenceScore),
              verificationLevel: "candidate_only",
              dataSource: candidate.dataSource || "tiktok_serp_candidate",
            };
          }
        )
    ).slice(0, requestedLimit);

    const finalResults =
      verifiedResults.length > 0
        ? sortTikTokResults(
            mergePrioritizedResults(
              verifiedResults,
              candidateResults,
              requestedLimit
            )
          ).slice(0, requestedLimit)
        : candidateResults;

    logPlatformSearchMetrics({
      platform: "tiktok",
      query,
      location,
      requestedLimit,
      discoveryLimit,
      verificationLimit,
      discovered: candidates.length,
      verified: verifiedResults.length,
      filteredOut: Math.max(0, candidates.length - scoredCandidates.length),
      deadLinks: deadLinkIds.size,
      returned: finalResults.length,
    });

    return finalResults;
  } catch (err) {
    console.warn("[TikTok verified search] failed:", err);
    return [];
  }
}

// ─── بحث Twitter/X (عبر SERP API - بدلاً من Puppeteer المحظور) ─────────────────
async function scrapeTwitter(
  query: string,
  location: string,
  limit = 10
): Promise<any[]> {
  const requestedLimit = normalizeSearchLimit(limit);
  {
    const discoveryLimit = Math.min(240, Math.max(120, requestedLimit * 10));
    const verificationLimit = Math.min(
      discoveryLimit,
      Math.max(80, requestedLimit * 6)
    );
    const sortTwitterResults = (results: any[]) =>
      results.sort((a, b) => {
        const scoreDiff = (b.confidenceScore || 0) - (a.confidenceScore || 0);
        if (scoreDiff !== 0) return scoreDiff;
        const businessDiff = (b.businessScore || 0) - (a.businessScore || 0);
        if (businessDiff !== 0) return businessDiff;
        return (b.followersCount || 0) - (a.followersCount || 0);
      });

    try {
      let candidates = (
        await searchTwitterSERP(query, location, discoveryLimit)
      )
        .filter(r => r.url && r.username)
        .map(r => ({
          ...r,
          profileUrl: normalizeTwitterCandidateUrl(r.url),
          url: normalizeTwitterCandidateUrl(r.url),
          dataSource: "twitter_profile_serp",
          candidatePhones: [],
        }))
        .slice(0, discoveryLimit);

      if (location && candidates.length < verificationLimit) {
        const broadCandidates = (
          await searchTwitterSERP(query, "", discoveryLimit)
        )
          .filter(r => r.url && r.username)
          .map(r => ({
            ...r,
            profileUrl: normalizeTwitterCandidateUrl(r.url),
            url: normalizeTwitterCandidateUrl(r.url),
            dataSource: "twitter_profile_serp",
            candidatePhones: [],
          }))
          .slice(0, discoveryLimit);
        candidates = mergePrioritizedResults(
          candidates,
          broadCandidates,
          discoveryLimit
        );
      }

      if (candidates.length < verificationLimit) {
        const websiteCandidates = await discoverOfficialSocialCandidatesFromWeb(
          "twitter",
          query,
          location,
          discoveryLimit
        );
        candidates = mergePrioritizedResults(
          candidates,
          websiteCandidates.map(candidate => ({
            ...candidate,
            profileUrl: normalizeTwitterCandidateUrl(
              candidate.url || candidate.profileUrl || ""
            ),
            url: normalizeTwitterCandidateUrl(
              candidate.url || candidate.profileUrl || ""
            ),
          })),
          discoveryLimit
        );
      }

      if (location && candidates.length < verificationLimit) {
        const broadWebsiteCandidates =
          await discoverOfficialSocialCandidatesFromWeb(
            "twitter",
            query,
            "",
            discoveryLimit
          );
        candidates = mergePrioritizedResults(
          candidates,
          broadWebsiteCandidates.map(candidate => ({
            ...candidate,
            profileUrl: normalizeTwitterCandidateUrl(
              candidate.url || candidate.profileUrl || ""
            ),
            url: normalizeTwitterCandidateUrl(
              candidate.url || candidate.profileUrl || ""
            ),
          })),
          discoveryLimit
        );
      }

      const scoredCandidates = candidates
        .map(candidate => {
          const relevance = scoreProfileRelevance({
            query,
            location,
            name: candidate.displayName || candidate.username,
            bio: candidate.bio || "",
            website: candidate.website || "",
            verified: !!candidate.verified,
          });
          const business = evaluateStrictBusinessProfile({
            name: candidate.displayName || candidate.username,
            bio: candidate.bio || "",
            website: candidate.website || "",
            phone: candidate.phone || "",
            candidatePhones: candidate.candidatePhones || [],
            verified: !!candidate.verified,
          });
          const rejectCreator =
            business.creatorOnlyProfile ||
            (business.creatorMatches.length > 0 &&
              !business.hasWebsite &&
              !business.hasPhone);

          return {
            candidate,
            relevance,
            business,
            rejectCreator,
            combinedScore:
              relevance.score +
              business.businessScore +
              (candidate.verified ? 0.5 : 0),
          };
        })
        .filter(
          ({ business, rejectCreator }) => business.strictPass && !rejectCreator
        )
        .sort((a, b) => b.combinedScore - a.combinedScore);

      const verificationPool = scoredCandidates
        .slice(0, verificationLimit)
        .map(({ candidate }) => candidate);

      const verifiedSettled = await Promise.allSettled(
        verificationPool.map(async candidate => {
          const profileUrl = normalizeTwitterCandidateUrl(
            candidate.profileUrl ||
              candidate.url ||
              `https://x.com/${candidate.username}`
          );
          const datasetResult = await fetchTwitterPosts(profileUrl, 8);
          if (!datasetResult.success || !datasetResult.data?.length)
            return null;

          const stats = extractSocialStats("twitter", datasetResult.data);
          const first = datasetResult.data[0];
          const resolvedName =
            first.name ||
            first.profile_name ||
            candidate.displayName ||
            candidate.username;
          const resolvedBio =
            first.biography || first.description || candidate.bio || "";
          const postsText = datasetResult.data
            .slice(0, 8)
            .map(post =>
              [post.description, post.quoted_post].filter(Boolean).join(" ")
            )
            .filter(Boolean)
            .join(" | ");
          const website = first.external_link || candidate.website || "";
          const candidatePhones = [
            ...(candidate.candidatePhones || []),
            ...extractPhonesFromLooseText(
              [
                resolvedBio,
                first.location || "",
                first.description || "",
                postsText,
              ]
                .filter(Boolean)
                .join(" | ")
            ),
          ];
          const business = evaluateStrictBusinessProfile({
            name: resolvedName,
            bio: `${resolvedBio} ${first.location || ""}`.trim(),
            website,
            phone: "",
            candidatePhones,
            verified: !!first.is_verified,
          });
          const rejectCreator =
            business.creatorOnlyProfile ||
            (business.creatorMatches.length > 0 &&
              !business.hasWebsite &&
              !business.hasPhone);
          const relevance = scoreProfileRelevance({
            query,
            location,
            name: resolvedName,
            bio: resolvedBio,
            contentText: postsText,
            website,
            verified: !!first.is_verified,
            businessSignals: [
              business.hasWebsite,
              business.hasPhone,
              business.hasBusinessKeywordInBio,
            ].filter(Boolean).length,
          });

          if (!business.strictPass || rejectCreator) return null;

          const confidenceScore = buildConfidenceScore(
            relevance.score + business.businessScore,
            "dataset"
          );

          return {
            platform: "twitter",
            username: candidate.username,
            id: candidate.username,
            name: resolvedName,
            fullName: resolvedName,
            displayName: resolvedName,
            profileUrl,
            profile_url: profileUrl,
            url: profileUrl,
            bio: resolvedBio,
            description: resolvedBio,
            followers: first.followers || 0,
            followersCount: first.followers || 0,
            followingCount: first.following || 0,
            postsCount:
              first.posts_count ||
              stats.postsCount ||
              datasetResult.data.length,
            avgLikes: stats.avgLikes || 0,
            avgViews: stats.avgViews || 0,
            recentPosts: stats.recentPosts || [],
            verified: !!first.is_verified,
            isVerified: !!first.is_verified,
            website,
            phone: business.allPhones[0] || "",
            candidatePhones: business.allPhones,
            city: relevance.locationMatched ? location : "",
            location: first.location || candidate.cityHint || "",
            rating: relevance.score,
            relevanceScore: relevance.score,
            businessScore: business.businessScore,
            businessSignals: [
              ...(business.hasWebsite ? ["website"] : []),
              ...(business.hasPhone ? ["phone"] : []),
              ...business.businessBioMatches,
            ],
            matchedBy: relevance.matchedTerms,
            exactPhraseMatched: relevance.exactPhraseMatched,
            confidenceScore,
            confidenceLevel: toConfidenceLevel(confidenceScore),
            verificationLevel: "dataset",
            dataSource: "twitter_business_verified",
          };
        })
      );

      const verifiedResults = sortTwitterResults(
        verifiedSettled.flatMap(result =>
          result.status === "fulfilled" && result.value ? [result.value] : []
        )
      ).slice(0, requestedLimit);

      const candidateResults = sortTwitterResults(
        scoredCandidates
          .slice(0, Math.max(verificationLimit, requestedLimit * 4))
          .map(({ candidate, relevance, business }) => {
            const confidenceScore = buildConfidenceScore(
              relevance.score + business.businessScore,
              "serp"
            );
            const profileUrl = normalizeTwitterCandidateUrl(
              candidate.profileUrl ||
                candidate.url ||
                `https://x.com/${candidate.username}`
            );
            return {
              platform: "twitter",
              username: candidate.username,
              id: candidate.username,
              name: candidate.displayName || candidate.username,
              fullName: candidate.displayName || candidate.username,
              displayName: candidate.displayName || candidate.username,
              profileUrl,
              profile_url: profileUrl,
              url: profileUrl,
              bio: candidate.bio || "",
              description: candidate.bio || "",
              followers: 0,
              followersCount: 0,
              website: candidate.website || "",
              phone: business.allPhones[0] || "",
              candidatePhones: business.allPhones,
              city: relevance.locationMatched ? location : "",
              location: candidate.cityHint || "",
              verified: false,
              rating: relevance.score,
              relevanceScore: relevance.score,
              businessScore: business.businessScore,
              businessSignals: [
                ...(business.hasWebsite ? ["website"] : []),
                ...(business.hasPhone ? ["phone"] : []),
                ...business.businessBioMatches,
              ],
              matchedBy: relevance.matchedTerms,
              exactPhraseMatched: relevance.exactPhraseMatched,
              confidenceScore,
              confidenceLevel: toConfidenceLevel(confidenceScore),
              verificationLevel: "candidate_only",
              dataSource: candidate.dataSource || "twitter_serp_candidate",
            };
          })
      ).slice(0, requestedLimit);

      if (verifiedResults.length > 0) {
        return sortTwitterResults(
          mergePrioritizedResults(
            verifiedResults,
            candidateResults,
            requestedLimit
          )
        ).slice(0, requestedLimit);
      }

      return candidateResults;
    } catch (err) {
      console.warn("[Twitter verified search] failed:", err);
      return [];
    }
  }
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
        const usernameMatch = itemUrl.match(
          /(?:twitter|x)\.com\/([a-zA-Z0-9_]+)(?:\/|$)/
        );
        if (!usernameMatch) continue;
        const username = usernameMatch[1];
        // تجاهل صفحات عامة
        if (
          ["search", "explore", "home", "i", "hashtag", "intent"].includes(
            username
          )
        )
          continue;
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
    candidates.map(async candidate => {
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
        first.biography || first.description || candidate.bio || "";

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
        postsCount:
          first.posts_count || stats.postsCount || datasetResult.data.length,
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
    .flatMap(result =>
      result.status === "fulfilled" && result.value ? [result.value] : []
    )
    .slice(0, requestedLimit);

  const candidateResults = candidates
    .slice(0, requestedLimit)
    .map(candidate => ({
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

  if (verifiedResults.length > 0) {
    return mergePrioritizedResults(
      verifiedResults,
      candidateResults,
      requestedLimit
    );
  }

  return candidateResults;
}

// ─── بحث LinkedIn (عبر SERP API) ───────────────────────────────────
async function scrapeLinkedIn(
  query: string,
  location: string,
  limit = 10
): Promise<any[]> {
  const requestedLimit = normalizeSearchLimit(limit);
  try {
    const serpResults = await searchLinkedInSERP(
      query,
      location,
      requestedLimit
    );
    const candidates = serpResults
      .filter(r => r.url && r.username)
      .slice(0, requestedLimit);

    const enrichedSettled = await Promise.allSettled(
      candidates.map(async candidate => {
        const [scraped, linkedinApiResult] = await Promise.all([
          scrapeLinkedInProfile(candidate.url),
          analyzeLinkedInCompany(
            candidate.url,
            candidate.displayName || candidate.username
          ),
        ]);

        const companyData = linkedinApiResult.success
          ? linkedinApiResult.companyData
          : undefined;
        const resolvedName =
          companyData?.name ||
          scraped.companyName ||
          candidate.displayName ||
          candidate.username;
        const resolvedBio =
          linkedinApiResult.about ||
          companyData?.about ||
          companyData?.description ||
          scraped.about ||
          candidate.bio ||
          "";
        const industry =
          linkedinApiResult.industry ||
          companyData?.industries?.join(", ") ||
          scraped.industry ||
          "";
        const website = companyData?.website || scraped.website || "";
        const specialties = linkedinApiResult.specialties?.length
          ? linkedinApiResult.specialties
          : scraped.specialties || [];
        const followersCount =
          linkedinApiResult.followersCount > 0
            ? linkedinApiResult.followersCount
            : scraped.followersCount || 0;
        const employeesCount =
          linkedinApiResult.employeesCount > 0
            ? linkedinApiResult.employeesCount.toLocaleString()
            : scraped.employeesCount || companyData?.company_size || "";
        const subtitle =
          companyData?.slogan ||
          scraped.tagline ||
          industry ||
          candidate.username;
        const contentText = [
          companyData?.slogan,
          industry,
          ...specialties,
          ...(scraped.recentPosts || []),
        ]
          .filter(Boolean)
          .join(" | ");
        const businessSignals = [
          industry,
          website,
          employeesCount,
          specialties.length ? "specialties" : "",
          followersCount > 0 ? "followers" : "",
        ].filter(Boolean).length;
        const relevance = scoreProfileRelevance({
          query,
          location,
          name: resolvedName,
          bio: resolvedBio,
          contentText,
          website,
          businessSignals,
        });

        return {
          candidate,
          resolvedName,
          resolvedBio,
          relevance,
          loadedSuccessfully:
            scraped.loadedSuccessfully ||
            !!companyData?.name ||
            followersCount > 0,
          profileExists: scraped.profileExists,
          officialPhone: scraped.officialPhone || "",
          phones: scraped.phones || [],
          followersCount,
          employeesCount,
          industry,
          website,
          specialties,
          subtitle,
        };
      })
    );

    const enrichedCandidates = candidates.map((candidate, index) => {
      const settled = enrichedSettled[index];
      if (settled?.status === "fulfilled" && settled.value) {
        return settled.value;
      }

      return {
        candidate,
        loadedSuccessfully: false,
        resolvedName: candidate.displayName || candidate.username,
        resolvedBio: candidate.bio || "",
        officialPhone: "",
        phones: [],
        followersCount: 0,
        employeesCount: "",
        industry: "",
        website: "",
        specialties: [],
        subtitle: candidate.username,
        relevance: scoreProfileRelevance({
          query,
          location,
          name: candidate.displayName || candidate.username,
          bio: candidate.bio || "",
        }),
      };
    });

    const verifiedResults = enrichedCandidates
      .filter(
        ({ loadedSuccessfully, relevance }) =>
          loadedSuccessfully && relevance.score >= LINKEDIN_VERIFIED_MIN_SCORE
      )
      .map(
        ({
          candidate,
          resolvedName,
          resolvedBio,
          relevance,
          officialPhone,
          phones,
          followersCount,
          employeesCount,
          industry,
          website,
          specialties,
          subtitle,
        }) => ({
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
          subtitle,
          phone: officialPhone,
          candidatePhones: phones,
          city: relevance.locationMatched ? location : "",
          location: relevance.locationMatched ? location : "",
          followersCount,
          employeesCount,
          industry,
          website,
          specialties,
          rating: relevance.score,
          relevanceScore: relevance.score,
          matchedBy: relevance.matchedTerms,
          exactPhraseMatched: relevance.exactPhraseMatched,
          verificationLevel: "browser_verified",
          dataSource: "linkedin_browser_verified",
        })
      )
      .slice(0, requestedLimit);

    const scoredCandidates = enrichedCandidates
      .map(item => ({
        ...item,
        score: item.relevance.score,
      }))
      .sort((a, b) => b.score - a.score);

    const mapCandidateResult = ({
      candidate,
      relevance,
      resolvedName,
      resolvedBio,
      officialPhone,
      phones,
      followersCount,
      employeesCount,
      industry,
      website,
      specialties,
      subtitle,
    }: (typeof scoredCandidates)[number]) => ({
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
      bio: resolvedBio.substring(0, 200),
      description: resolvedBio.substring(0, 200),
      subtitle,
      phone: officialPhone,
      candidatePhones: phones,
      city: relevance.locationMatched ? location : "",
      location: relevance.locationMatched ? location : "",
      followersCount,
      employeesCount,
      industry,
      website,
      specialties,
      rating: relevance.score,
      relevanceScore: relevance.score,
      matchedBy: relevance.matchedTerms,
      exactPhraseMatched: relevance.exactPhraseMatched,
      verificationLevel: "candidate_only",
      dataSource: "linkedin_serp_candidate",
    });

    const strongCandidates = scoredCandidates
      .filter(
        ({ relevance }) => relevance.score >= LINKEDIN_CANDIDATE_MIN_SCORE
      )
      .slice(0, requestedLimit)
      .map(mapCandidateResult);
    const softFallbackCandidates = scoredCandidates
      .slice(0, Math.min(requestedLimit, SOFT_FALLBACK_COUNT))
      .map(mapCandidateResult);

    if (verifiedResults.length > 0) {
      return mergePrioritizedResults(
        verifiedResults,
        strongCandidates.length > 0 ? strongCandidates : softFallbackCandidates,
        requestedLimit
      );
    }

    if (strongCandidates.length > 0) return strongCandidates;

    return softFallbackCandidates;
  } catch (e) {
    console.error("[LinkedIn SERP] Error:", e);
    return [];
  }
}

// ─── بحث Snapchat ──────────────────────────────────────────────────────────────
async function scrapeSnapchat(
  query: string,
  location: string,
  limit = 10
): Promise<any[]> {
  const requestedLimit = normalizeSearchLimit(limit);
  const { discoveryLimit, verificationLimit } =
    getModerateOverfetchConfig(requestedLimit);
  const sortSnapchatResults = (results: any[]) =>
    results.sort((a, b) => {
      const scoreDiff = (b.confidenceScore || 0) - (a.confidenceScore || 0);
      if (scoreDiff !== 0) return scoreDiff;
      const ratingDiff =
        (b.relevanceScore || b.rating || 0) -
        (a.relevanceScore || a.rating || 0);
      if (ratingDiff !== 0) return ratingDiff;
      return (b.postsCount || 0) - (a.postsCount || 0);
    });
  try {
    let candidates = (await searchSnapchatSERP(query, location, discoveryLimit))
      .filter(r => r.url && r.username)
      .slice(0, discoveryLimit);

    if (location && candidates.length < requestedLimit) {
      const broadCandidates = (
        await searchSnapchatSERP(query, "", discoveryLimit)
      )
        .filter(r => r.url && r.username)
        .slice(0, discoveryLimit);
      candidates = mergePrioritizedResults(
        candidates,
        broadCandidates,
        discoveryLimit
      );
    }

    if (candidates.length < requestedLimit) {
      const websiteCandidates = await discoverSnapchatCandidatesFromWeb(
        query,
        location,
        discoveryLimit
      );
      candidates = mergePrioritizedResults(
        candidates,
        websiteCandidates,
        discoveryLimit
      );
    }

    const scoredCandidates = candidates
      .map(candidate => ({
        candidate,
        relevance: scoreProfileRelevance({
          query,
          location,
          name: candidate.displayName || candidate.username,
          bio: candidate.bio || "",
          website: candidate.website || "",
          verified: !!candidate.verified,
          businessSignals: candidate.website ? 1 : 0,
        }),
      }))
      .sort((a, b) => b.relevance.score - a.relevance.score);

    const verificationPool = scoredCandidates
      .slice(0, verificationLimit)
      .map(({ candidate }) => candidate);

    const checkedSettled = await Promise.allSettled(
      verificationPool.map(async candidate => {
        const datasetResult = await fetchSnapchatPosts(candidate.url, 6);
        const profileUnavailable =
          datasetResult.profileExists === false ||
          /unavailable|not found|غير متوفر|غير موجود/i.test(
            datasetResult.error || ""
          );

        if (profileUnavailable) {
          return {
            candidate,
            datasetResult,
            profileUnavailable: true,
            verifiedResult: null,
          };
        }

        if (!datasetResult.success || !datasetResult.data?.length) {
          return {
            candidate,
            datasetResult,
            profileUnavailable: false,
            verifiedResult: null,
          };
        }

        const stats = extractSocialStats("snapchat", datasetResult.data);
        const resolvedName =
          stats.profileName || candidate.displayName || candidate.username;
        const postsText =
          stats.recentPosts
            ?.map(post => post.content)
            .filter(Boolean)
            .join(" | ") || "";
        const derivedBio =
          candidate.bio ||
          stats.recentPosts
            ?.map(post => post.content)
            .filter(Boolean)
            .slice(0, 2)
            .join(" | ") ||
          "";
        const relevance = scoreProfileRelevance({
          query,
          location,
          name: resolvedName,
          bio: derivedBio,
          contentText: postsText,
          businessSignals: stats.postsCount ? 1 : 0,
        });

        if (relevance.score < SNAPCHAT_VERIFIED_MIN_SCORE) {
          return {
            candidate,
            datasetResult,
            profileUnavailable: false,
            verifiedResult: null,
          };
        }

        const confidenceScore = buildConfidenceScore(
          relevance.score + (stats.postsCount ? 0.5 : 0),
          "dataset"
        );

        return {
          candidate,
          datasetResult,
          profileUnavailable: false,
          verifiedResult: {
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
            followers: candidate.followersCount || 0,
            followersCount: candidate.followersCount || 0,
            postsCount: stats.postsCount || datasetResult.data.length,
            avgViews: stats.avgViews || 0,
            recentPosts: stats.recentPosts || [],
            phone: "",
            website: candidate.website || "",
            city: relevance.locationMatched ? location : "",
            verified: false,
            rating: relevance.score,
            relevanceScore: relevance.score,
            matchedBy: relevance.matchedTerms,
            exactPhraseMatched: relevance.exactPhraseMatched,
            confidenceScore,
            confidenceLevel: toConfidenceLevel(confidenceScore),
            verificationLevel: "browser_verified",
            dataSource: "snapchat_browser_verified",
          },
        };
      })
    );

    const checkedCandidates = checkedSettled.flatMap(result =>
      result.status === "fulfilled" && result.value ? [result.value] : []
    );

    const deadUsernames = new Set(
      checkedCandidates
        .filter(item => item.profileUnavailable)
        .map(item => item.candidate.username)
    );

    const verifiedResults = checkedCandidates
      .flatMap(item => (item.verifiedResult ? [item.verifiedResult] : []))
      .slice(0, requestedLimit);

    const mapCandidateResult = ({
      candidate,
      relevance,
    }: (typeof scoredCandidates)[number]) => {
      const confidenceScore = buildConfidenceScore(relevance.score, "serp");
      return {
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
        website: candidate.website || "",
        city: relevance.locationMatched ? location : "",
        verified: false,
        rating: relevance.score,
        relevanceScore: relevance.score,
        matchedBy: relevance.matchedTerms,
        exactPhraseMatched: relevance.exactPhraseMatched,
        confidenceScore,
        confidenceLevel: toConfidenceLevel(confidenceScore),
        verificationLevel: "candidate_only",
        dataSource: "snapchat_serp_candidate",
      };
    };

    const strongCandidates = sortSnapchatResults(
      scoredCandidates
        .filter(({ candidate }) => !deadUsernames.has(candidate.username))
        .filter(
          ({ relevance }) => relevance.score >= SNAPCHAT_CANDIDATE_MIN_SCORE
        )
        .slice(0, verificationLimit)
        .map(mapCandidateResult)
    ).slice(0, requestedLimit);
    const softFallbackCandidates = sortSnapchatResults(
      scoredCandidates
        .filter(({ candidate }) => !deadUsernames.has(candidate.username))
        .slice(0, verificationLimit)
        .map(mapCandidateResult)
    ).slice(0, requestedLimit);

    const fallbackCandidates =
      strongCandidates.length > 0 ? strongCandidates : softFallbackCandidates;
    const finalResults =
      verifiedResults.length > 0
        ? sortSnapchatResults(
            mergePrioritizedResults(
              verifiedResults,
              fallbackCandidates,
              requestedLimit
            )
          ).slice(0, requestedLimit)
        : fallbackCandidates;

    logPlatformSearchMetrics({
      platform: "snapchat",
      query,
      location,
      requestedLimit,
      discoveryLimit,
      verificationLimit,
      discovered: candidates.length,
      verified: verifiedResults.length,
      filteredOut: Math.max(
        0,
        candidates.length - deadUsernames.size - fallbackCandidates.length
      ),
      deadLinks: deadUsernames.size,
      returned: finalResults.length,
    });

    return finalResults;
  } catch (err) {
    console.warn("[Snapchat SERP] failed:", err);
    return [];
  }
}
// ─── بحث Facebook (عبر SERP API) ──────────────────────────────────────────────
async function scrapeFacebook(
  query: string,
  location: string,
  limit = 10
): Promise<any[]> {
  const requestedLimit = normalizeSearchLimit(limit);
  try {
    const serpResults = await searchFacebookSERP(
      query,
      location,
      requestedLimit
    );
    const candidates = serpResults
      .filter(r => r.url && r.username)
      .slice(0, requestedLimit);

    const verified = await Promise.allSettled(
      candidates.map(async candidate => {
        const datasetResult = await fetchFacebookPagePosts(candidate.url, 6);
        if (!datasetResult.success || !datasetResult.data?.length) return null;

        const stats = extractSocialStats("facebook", datasetResult.data);
        const derivedBio =
          candidate.bio ||
          stats.recentPosts
            ?.map(post => post.content)
            .filter(Boolean)
            .slice(0, 2)
            .join(" | ") ||
          "";

        return {
          platform: "facebook",
          username: candidate.username,
          id: candidate.username,
          type: "company",
          name:
            stats.profileName || candidate.displayName || candidate.username,
          displayName:
            stats.profileName || candidate.displayName || candidate.username,
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
      .flatMap(result =>
        result.status === "fulfilled" && result.value ? [result.value] : []
      )
      .slice(0, requestedLimit);

    const candidateResults = candidates
      .slice(0, requestedLimit)
      .map(candidate => ({
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

    if (verifiedResults.length > 0) {
      return mergePrioritizedResults(
        verifiedResults,
        candidateResults,
        requestedLimit
      );
    }

    return candidateResults;
  } catch (err) {
    console.warn("[Facebook verified search] failed:", err);
    return [];
  }
}

// ─── بحث Google Search (عبر SERP API - بدلاً من Puppeteer البطيء) ──────────────
async function scrapeTwitterRanked(
  query: string,
  location: string,
  limit = 10
): Promise<any[]> {
  const requestedLimit = normalizeSearchLimit(limit);
  const { discoveryLimit, verificationLimit } =
    getModerateOverfetchConfig(requestedLimit);
  const sortTwitterResults = (results: any[]) =>
    results.sort((a, b) => {
      const scoreDiff = (b.confidenceScore || 0) - (a.confidenceScore || 0);
      if (scoreDiff !== 0) return scoreDiff;
      const validationDiff =
        (b.linkValidationScore || 0) +
        (b.commercialIntentScore || 0) -
        ((a.linkValidationScore || 0) + (a.commercialIntentScore || 0));
      if (validationDiff !== 0) return validationDiff;
      const sizeDiff =
        (b.sizePreferenceScore || 0) - (a.sizePreferenceScore || 0);
      if (sizeDiff !== 0) return sizeDiff;
      const businessDiff = (b.businessScore || 0) - (a.businessScore || 0);
      if (businessDiff !== 0) return businessDiff;
      return (b.followersCount || 0) - (a.followersCount || 0);
    });

  try {
    let candidates = (
      await discoverTwitterCandidatesFromDirectSearch(
        query,
        location,
        discoveryLimit
      )
    )
      .filter(r => r?.url && r?.username)
      .slice(0, discoveryLimit * 2);

    if (candidates.length < requestedLimit) {
      const serpCandidates = (
        await searchTwitterSERP(query, location, discoveryLimit)
      )
        .filter(r => r.url && r.username)
        .map(r => ({
          ...r,
          profileUrl: normalizeTwitterCandidateUrl(r.url),
          url: normalizeTwitterCandidateUrl(r.url),
          dataSource: "twitter_profile_serp",
          candidatePhones: r.candidatePhones || [],
          followersCount: Number(r.followersCount || r.followers || 0) || 0,
        }))
        .slice(0, discoveryLimit);
      candidates = mergePrioritizedResults(
        candidates,
        serpCandidates,
        discoveryLimit * 3
      );
    }

    if (location && candidates.length < requestedLimit) {
      const broadDirectCandidates = (
        await discoverTwitterCandidatesFromDirectSearch(
          query,
          "",
          discoveryLimit
        )
      )
        .filter(r => r?.url && r?.username)
        .slice(0, discoveryLimit * 2);
      candidates = mergePrioritizedResults(
        candidates,
        broadDirectCandidates,
        discoveryLimit * 3
      );
    }

    if (location && candidates.length < requestedLimit) {
      const broadCandidates = (
        await searchTwitterSERP(query, "", discoveryLimit)
      )
        .filter(r => r.url && r.username)
        .map(r => ({
          ...r,
          profileUrl: normalizeTwitterCandidateUrl(r.url),
          url: normalizeTwitterCandidateUrl(r.url),
          dataSource: "twitter_profile_serp",
          candidatePhones: r.candidatePhones || [],
          followersCount: Number(r.followersCount || r.followers || 0) || 0,
        }))
        .slice(0, discoveryLimit);
      candidates = mergePrioritizedResults(
        candidates,
        broadCandidates,
        discoveryLimit * 3
      );
    }

    if (candidates.length < requestedLimit) {
      const websiteCandidates = await discoverOfficialSocialCandidatesFromWeb(
        "twitter",
        query,
        location,
        discoveryLimit
      );
      candidates = mergePrioritizedResults(
        candidates,
        websiteCandidates.map(candidate => ({
          ...candidate,
          profileUrl: normalizeTwitterCandidateUrl(
            candidate.url || candidate.profileUrl || ""
          ),
          url: normalizeTwitterCandidateUrl(
            candidate.url || candidate.profileUrl || ""
          ),
        })),
        discoveryLimit * 3
      );
    }

    if (location && candidates.length < requestedLimit) {
      const broadWebsiteCandidates =
        await discoverOfficialSocialCandidatesFromWeb(
          "twitter",
          query,
          "",
          discoveryLimit
        );
      candidates = mergePrioritizedResults(
        candidates,
        broadWebsiteCandidates.map(candidate => ({
          ...candidate,
          profileUrl: normalizeTwitterCandidateUrl(
            candidate.url || candidate.profileUrl || ""
          ),
          url: normalizeTwitterCandidateUrl(
            candidate.url || candidate.profileUrl || ""
          ),
        })),
        discoveryLimit * 3
      );
    }

    const applyOverflowFilter = candidates.length > requestedLimit;
    const scoredCandidates = candidates
      .map(candidate => {
        const relevance = scoreProfileRelevance({
          query,
          location,
          name: candidate.displayName || candidate.username,
          bio: candidate.bio || "",
          website: candidate.website || "",
          verified: !!candidate.verified,
        });
        const business = evaluateStrictBusinessProfile({
          name: candidate.displayName || candidate.username,
          bio: candidate.bio || "",
          website: candidate.website || "",
          phone: candidate.phone || "",
          candidatePhones: candidate.candidatePhones || [],
          verified: !!candidate.verified,
        });
        const rejectCreator =
          business.hardReject ||
          business.creatorOnlyProfile ||
          (business.creatorMatches.length > 0 &&
            !business.hasWebsite &&
            !business.hasPhone);
        const sizePreference = evaluateFollowerSizePreference(
          "twitter",
          candidate.followersCount || 0
        );
        const overflowAdjustment = applyOverflowFilter
          ? (business.strictPass ? 1.25 : -1.5) + (rejectCreator ? -3.5 : 0)
          : 0;

        return {
          candidate,
          relevance,
          business,
          sizePreference,
          rejectCreator,
          combinedScore:
            relevance.score +
            business.businessScore +
            (candidate.verified ? 0.5 : 0) +
            sizePreference.sizePreferenceScore +
            overflowAdjustment,
        };
      })
      .filter(
        ({ sizePreference, business }) =>
          !business.hardReject &&
          !(applyOverflowFilter && sizePreference.hardReject)
      )
      .sort((a, b) => b.combinedScore - a.combinedScore);

    const verificationPool = scoredCandidates
      .slice(0, verificationLimit)
      .map(({ candidate }) => candidate);

    const verifiedSettled = await Promise.allSettled(
      verificationPool.map(async candidate => {
        const profileUrl = normalizeTwitterCandidateUrl(
          candidate.profileUrl ||
            candidate.url ||
            `https://x.com/${candidate.username}`
        );
        const datasetResult = await fetchTwitterPosts(profileUrl, 8);
        if (datasetResult.profileExists === false) {
          return {
            deadLink: true,
            deadLinkId: getResultIdentity(candidate),
            platform: "twitter",
            profileUnavailable: true,
          };
        }
        if (!datasetResult.success || !datasetResult.data?.length) return null;

        const stats = extractSocialStats("twitter", datasetResult.data);
        const first = datasetResult.data[0];
        const resolvedName =
          first.name ||
          first.profile_name ||
          candidate.displayName ||
          candidate.username;
        const resolvedBio =
          first.biography || first.description || candidate.bio || "";
        const postsText = datasetResult.data
          .slice(0, 8)
          .map(post =>
            [post.description, post.quoted_post].filter(Boolean).join(" ")
          )
          .filter(Boolean)
          .join(" | ");
        const website = first.external_link || candidate.website || "";
        const candidatePhones = [
          ...(candidate.candidatePhones || []),
          ...extractPhonesFromLooseText(
            [
              resolvedBio,
              first.location || "",
              first.description || "",
              postsText,
            ]
              .filter(Boolean)
              .join(" | ")
          ),
        ];
        const business = evaluateStrictBusinessProfile({
          name: resolvedName,
          bio: `${resolvedBio} ${first.location || ""}`.trim(),
          website,
          phone: "",
          candidatePhones,
          verified: !!first.is_verified,
        });
        const rejectCreator =
          business.hardReject ||
          business.creatorOnlyProfile ||
          (business.creatorMatches.length > 0 &&
            !business.hasWebsite &&
            !business.hasPhone);
        const relevance = scoreProfileRelevance({
          query,
          location,
          name: resolvedName,
          bio: resolvedBio,
          contentText: postsText,
          website,
          verified: !!first.is_verified,
          businessSignals: [
            business.hasWebsite,
            business.hasPhone,
            business.hasBusinessKeywordInBio,
          ].filter(Boolean).length,
        });

        if (applyOverflowFilter && (!business.strictPass || rejectCreator))
          return null;

        const sizePreference = evaluateFollowerSizePreference(
          "twitter",
          first.followers || 0
        );
        if (applyOverflowFilter && sizePreference.hardReject) return null;

        const overflowAdjustment = applyOverflowFilter
          ? (business.strictPass ? 1.25 : -1.5) + (rejectCreator ? -3.5 : 0)
          : 0;
        const confidenceScore = buildConfidenceScore(
          relevance.score +
            business.businessScore +
            overflowAdjustment +
            sizePreference.sizePreferenceScore,
          "dataset"
        );

        return {
          platform: "twitter",
          username: candidate.username,
          id: candidate.username,
          name: resolvedName,
          fullName: resolvedName,
          displayName: resolvedName,
          profileUrl,
          profile_url: profileUrl,
          url: profileUrl,
          bio: resolvedBio,
          description: resolvedBio,
          followers: first.followers || 0,
          followersCount: first.followers || 0,
          followingCount: first.following || 0,
          postsCount:
            first.posts_count || stats.postsCount || datasetResult.data.length,
          avgLikes: stats.avgLikes || 0,
          avgViews: stats.avgViews || 0,
          recentPosts: stats.recentPosts || [],
          verified: !!first.is_verified,
          isVerified: !!first.is_verified,
          website,
          phone: business.allPhones[0] || "",
          candidatePhones: business.allPhones,
          city: relevance.locationMatched ? location : "",
          location: first.location || candidate.cityHint || "",
          rating: relevance.score,
          relevanceScore: relevance.score,
          businessScore: business.businessScore,
          businessSignals: [
            ...(business.hasValidatedCommerceLink ? ["validated_link"] : []),
            ...(business.hasOfficialWebsite ? ["official_website"] : []),
            ...(business.hasWebsite ? ["website"] : []),
            ...(business.hasPhone ? ["phone"] : []),
            ...(business.hasCommercialIntent ? ["commercial_intent"] : []),
            ...business.businessBioMatches,
          ],
          strictPass: business.strictPass,
          hardReject: business.hardReject,
          businessValidationLevel: business.businessValidationLevel,
          linkValidationScore: business.linkValidationScore,
          commercialIntentScore: business.commercialIntentScore,
          negativeKeywordMatches: business.negativeKeywordMatches,
          commercialIntentMatches: business.commercialIntentMatches,
          validatedLinkMatches: business.validatedLinkMatches,
          matchedBy: relevance.matchedTerms,
          exactPhraseMatched: relevance.exactPhraseMatched,
          sizePreferenceScore: sizePreference.sizePreferenceScore,
          sizeSegment: sizePreference.sizeSegment,
          sizeCapExceeded: sizePreference.sizeCapExceeded,
          confidenceScore,
          confidenceLevel: toConfidenceLevel(confidenceScore),
          verificationLevel: "dataset",
          dataSource:
            String(candidate.dataSource || "").includes("browser") ||
            String(candidate.dataSource || "").includes("direct") ||
            String(candidate.dataSource || "").includes("proxy_search")
              ? "twitter_direct_profile_verified"
              : String(candidate.dataSource || "").includes("website")
                ? "twitter_website_verified"
                : "twitter_business_verified",
        };
      })
    );

    const verifiedResults = sortTwitterResults(
      verifiedSettled.flatMap(result =>
        result.status === "fulfilled" &&
        result.value &&
        !(result.value as any).deadLink
          ? [result.value]
          : []
      )
    ).slice(0, requestedLimit);

    const deadLinkIds = new Set(
      verifiedSettled.flatMap(result =>
        result.status === "fulfilled" && (result.value as any)?.deadLink
          ? [(result.value as any).deadLinkId as string]
          : []
      )
    );

    const candidateResults = sortTwitterResults(
      scoredCandidates
        .filter(
          ({ candidate }) => !deadLinkIds.has(getResultIdentity(candidate))
        )
        .slice(0, Math.max(verificationLimit, requestedLimit * 3))
        .map(
          ({
            candidate,
            relevance,
            business,
            rejectCreator,
            sizePreference,
          }) => {
            const overflowAdjustment = applyOverflowFilter
              ? (business.strictPass ? 1.25 : -1.5) + (rejectCreator ? -3.5 : 0)
              : 0;
            const confidenceScore = buildConfidenceScore(
              relevance.score +
                business.businessScore +
                overflowAdjustment +
                sizePreference.sizePreferenceScore,
              "serp"
            );
            const profileUrl = normalizeTwitterCandidateUrl(
              candidate.profileUrl ||
                candidate.url ||
                `https://x.com/${candidate.username}`
            );
            return {
              platform: "twitter",
              username: candidate.username,
              id: candidate.username,
              name: candidate.displayName || candidate.username,
              fullName: candidate.displayName || candidate.username,
              displayName: candidate.displayName || candidate.username,
              profileUrl,
              profile_url: profileUrl,
              url: profileUrl,
              bio: candidate.bio || "",
              description: candidate.bio || "",
              followers: candidate.followersCount || 0,
              followersCount: candidate.followersCount || 0,
              website: candidate.website || "",
              phone: business.allPhones[0] || "",
              candidatePhones: business.allPhones,
              city: relevance.locationMatched ? location : "",
              location: candidate.cityHint || "",
              verified: false,
              rating: relevance.score,
              relevanceScore: relevance.score,
              businessScore: business.businessScore,
              businessSignals: [
                ...(business.hasValidatedCommerceLink
                  ? ["validated_link"]
                  : []),
                ...(business.hasOfficialWebsite ? ["official_website"] : []),
                ...(business.hasWebsite ? ["website"] : []),
                ...(business.hasPhone ? ["phone"] : []),
                ...(business.hasCommercialIntent ? ["commercial_intent"] : []),
                ...business.businessBioMatches,
              ],
              strictPass: business.strictPass,
              hardReject: business.hardReject,
              businessValidationLevel: business.businessValidationLevel,
              linkValidationScore: business.linkValidationScore,
              commercialIntentScore: business.commercialIntentScore,
              negativeKeywordMatches: business.negativeKeywordMatches,
              commercialIntentMatches: business.commercialIntentMatches,
              validatedLinkMatches: business.validatedLinkMatches,
              matchedBy: relevance.matchedTerms,
              exactPhraseMatched: relevance.exactPhraseMatched,
              sizePreferenceScore: sizePreference.sizePreferenceScore,
              sizeSegment: sizePreference.sizeSegment,
              sizeCapExceeded: sizePreference.sizeCapExceeded,
              confidenceScore,
              confidenceLevel: toConfidenceLevel(confidenceScore),
              verificationLevel: "candidate_only",
              dataSource: candidate.dataSource || "twitter_serp_candidate",
            };
          }
        )
    ).slice(0, requestedLimit);

    const finalResults = sortTwitterResults(
      mergePrioritizedResults(verifiedResults, candidateResults, requestedLimit)
    ).slice(0, requestedLimit);

    logPlatformSearchMetrics({
      platform: "twitter",
      query,
      location,
      requestedLimit,
      discoveryLimit,
      verificationLimit,
      discovered: candidates.length,
      verified: verifiedResults.length,
      filteredOut: Math.max(0, candidates.length - scoredCandidates.length),
      deadLinks: deadLinkIds.size,
      returned: finalResults.length,
    });

    return finalResults;
  } catch (err) {
    console.warn("[Twitter ranked search] failed:", err);
    return [];
  }
}

async function scrapeLinkedInRanked(
  query: string,
  location: string,
  limit = 10
): Promise<any[]> {
  const requestedLimit = normalizeSearchLimit(limit);
  const { discoveryLimit, verificationLimit } =
    getModerateOverfetchConfig(requestedLimit);
  const sortLinkedInResults = (results: any[]) =>
    results.sort((a, b) => {
      const scoreDiff = (b.confidenceScore || 0) - (a.confidenceScore || 0);
      if (scoreDiff !== 0) return scoreDiff;
      const validationDiff =
        (b.linkValidationScore || 0) +
        (b.commercialIntentScore || 0) -
        ((a.linkValidationScore || 0) + (a.commercialIntentScore || 0));
      if (validationDiff !== 0) return validationDiff;
      const sizeDiff =
        (b.sizePreferenceScore || 0) - (a.sizePreferenceScore || 0);
      if (sizeDiff !== 0) return sizeDiff;
      const ratingDiff =
        (b.relevanceScore || b.rating || 0) -
        (a.relevanceScore || a.rating || 0);
      if (ratingDiff !== 0) return ratingDiff;
      return (b.followersCount || 0) - (a.followersCount || 0);
    });

  try {
    let candidates = (
      await discoverLinkedInCompanyCandidatesDirect(
        query,
        location,
        discoveryLimit
      )
    )
      .filter(r => r?.url && r?.username)
      .slice(0, discoveryLimit * 2);

    if (candidates.length < requestedLimit) {
      const serpCandidates = (
        await searchLinkedInSERP(query, location, discoveryLimit)
      )
        .filter(r => r.url && r.username && !!extractLinkedInCompanyPath(r.url))
        .map(r => ({
          ...r,
          url: normalizeLinkedInCompanyUrl(r.url),
          profileUrl: normalizeLinkedInCompanyUrl(r.url),
          type: extractLinkedInCompanyPath(r.url)?.type || "company",
          followersCount: Number(r.followersCount || r.followers || 0) || 0,
          employeesCount: String(r.employeesCount || ""),
          dataSource: "linkedin_company_serp",
        }))
        .slice(0, discoveryLimit);
      candidates = mergePrioritizedResults(
        candidates,
        serpCandidates,
        discoveryLimit * 3
      );
    }

    if (location && candidates.length < requestedLimit) {
      const broadDirectCandidates = (
        await discoverLinkedInCompanyCandidatesDirect(query, "", discoveryLimit)
      )
        .filter(r => r?.url && r?.username)
        .slice(0, discoveryLimit * 2);
      candidates = mergePrioritizedResults(
        candidates,
        broadDirectCandidates,
        discoveryLimit * 3
      );
    }

    if (location && candidates.length < requestedLimit) {
      const broadCandidates = (
        await searchLinkedInSERP(query, "", discoveryLimit)
      )
        .filter(r => r.url && r.username && !!extractLinkedInCompanyPath(r.url))
        .map(r => ({
          ...r,
          url: normalizeLinkedInCompanyUrl(r.url),
          profileUrl: normalizeLinkedInCompanyUrl(r.url),
          type: extractLinkedInCompanyPath(r.url)?.type || "company",
          followersCount: Number(r.followersCount || r.followers || 0) || 0,
          employeesCount: String(r.employeesCount || ""),
          dataSource: "linkedin_company_serp",
        }))
        .slice(0, discoveryLimit);
      candidates = mergePrioritizedResults(
        candidates,
        broadCandidates,
        discoveryLimit * 3
      );
    }

    const preliminaryCandidates = candidates
      .map(candidate => {
        const relevance = scoreProfileRelevance({
          query,
          location,
          name: candidate.displayName || candidate.username,
          bio: candidate.bio || "",
        });
        const business = evaluateStrictBusinessProfile({
          name: candidate.displayName || candidate.username,
          bio: candidate.bio || "",
          website: candidate.website || "",
          phone: candidate.phone || "",
          candidatePhones: candidate.candidatePhones || [],
          verified: !!candidate.verified,
        });
        const sizePreference = evaluateFollowerSizePreference(
          "linkedin",
          candidate.followersCount || 0
        );
        return {
          candidate,
          relevance,
          business,
          sizePreference,
          combinedScore:
            relevance.score +
            (candidate.verified ? 0.4 : 0) +
            business.businessScore +
            sizePreference.sizePreferenceScore,
        };
      })
      .filter(({ business }) => !business.hardReject)
      .sort((a, b) => b.combinedScore - a.combinedScore);

    const verificationPool = preliminaryCandidates
      .slice(0, verificationLimit)
      .map(({ candidate }) => candidate);

    const enrichedSettled = await Promise.allSettled(
      verificationPool.map(async candidate => {
        const [scraped, linkedinApiResult] = await Promise.all([
          scrapeLinkedInProfile(candidate.url),
          analyzeLinkedInCompany(
            candidate.url,
            candidate.displayName || candidate.username
          ),
        ]);

        const companyData = linkedinApiResult.success
          ? linkedinApiResult.companyData
          : undefined;
        const resolvedName =
          companyData?.name ||
          scraped.companyName ||
          candidate.displayName ||
          candidate.username;
        const resolvedBio =
          linkedinApiResult.about ||
          companyData?.about ||
          companyData?.description ||
          scraped.about ||
          candidate.bio ||
          "";
        const industry =
          linkedinApiResult.industry ||
          companyData?.industries?.join(", ") ||
          scraped.industry ||
          "";
        const website = companyData?.website || scraped.website || "";
        const specialties = linkedinApiResult.specialties?.length
          ? linkedinApiResult.specialties
          : scraped.specialties || [];
        const followersCount =
          linkedinApiResult.followersCount > 0
            ? linkedinApiResult.followersCount
            : scraped.followersCount || 0;
        const employeesCount =
          linkedinApiResult.employeesCount > 0
            ? linkedinApiResult.employeesCount.toLocaleString()
            : scraped.employeesCount || companyData?.company_size || "";
        const subtitle =
          companyData?.slogan ||
          scraped.tagline ||
          industry ||
          candidate.username;
        const contentText = [
          companyData?.slogan,
          industry,
          ...specialties,
          ...(scraped.recentPosts || []),
        ]
          .filter(Boolean)
          .join(" | ");
        const businessSignals = [
          industry,
          website,
          employeesCount,
          specialties.length ? "specialties" : "",
          followersCount > 0 ? "followers" : "",
        ].filter(Boolean).length;
        const relevance = scoreProfileRelevance({
          query,
          location,
          name: resolvedName,
          bio: resolvedBio,
          contentText,
          website,
          businessSignals,
        });
        const business = evaluateStrictBusinessProfile({
          name: resolvedName,
          bio: `${resolvedBio} ${industry} ${specialties.join(" ")}`.trim(),
          website,
          phone: scraped.officialPhone || "",
          candidatePhones: [
            ...(scraped.phones || []),
            ...extractPhonesFromLooseText(contentText),
          ],
          verified: true,
        });

        return {
          candidate,
          resolvedName,
          resolvedBio,
          relevance,
          loadedSuccessfully:
            scraped.loadedSuccessfully ||
            !!companyData?.name ||
            followersCount > 0,
          officialPhone: scraped.officialPhone || "",
          phones: scraped.phones || [],
          followersCount,
          employeesCount,
          industry,
          website,
          specialties,
          subtitle,
          business,
        };
      })
    );

    const enrichedMap = new Map<string, any>();
    for (const result of enrichedSettled) {
      if (result.status !== "fulfilled" || !result.value) continue;
      enrichedMap.set(getResultIdentity(result.value.candidate), result.value);
    }

    const applyOverflowFilter = candidates.length > requestedLimit;
    const scoredCandidates = preliminaryCandidates
      .map(({ candidate, relevance: rawRelevance }) => {
        const enriched = enrichedMap.get(getResultIdentity(candidate));
        const relevance = enriched?.relevance || rawRelevance;
        const resolvedFollowersCount =
          enriched?.followersCount || candidate.followersCount || 0;
        const sizePreference = evaluateFollowerSizePreference(
          "linkedin",
          resolvedFollowersCount
        );
        const business =
          enriched?.business ||
          evaluateStrictBusinessProfile({
            name: candidate.displayName || candidate.username,
            bio: candidate.bio || "",
            website: candidate.website || "",
            phone: candidate.phone || "",
            candidatePhones: candidate.candidatePhones || [],
            verified: !!candidate.verified,
          });
        const evidenceScore =
          (enriched?.loadedSuccessfully ? 1.25 : 0) +
          (enriched?.website ? 0.8 : 0) +
          (enriched?.industry ? 0.5 : 0) +
          ((enriched?.followersCount || 0) > 0 ? 0.4 : 0);
        const overflowAdjustment = applyOverflowFilter
          ? (enriched?.loadedSuccessfully ? 1.1 : -0.4) +
            (enriched?.website ? 0.5 : 0) +
            (business.strictPass ? 0.8 : -1.1)
          : 0;

        return {
          candidate,
          enriched,
          relevance,
          business,
          sizePreference,
          combinedScore:
            relevance.score +
            evidenceScore +
            business.businessScore +
            sizePreference.sizePreferenceScore +
            overflowAdjustment,
        };
      })
      .filter(
        ({ sizePreference, business }) =>
          !business.hardReject &&
          !(applyOverflowFilter && sizePreference.hardReject)
      )
      .filter(({ enriched, candidate }) => {
        if (enriched?.profileExists === false) return false;
        return true;
      })
      .sort((a, b) => b.combinedScore - a.combinedScore);

    const verifiedResults = sortLinkedInResults(
      scoredCandidates
        .filter(
          ({ enriched, relevance }) =>
            enriched?.loadedSuccessfully &&
            relevance.score >= LINKEDIN_VERIFIED_MIN_SCORE
        )
        .map(
          ({
            candidate,
            enriched,
            relevance,
            combinedScore,
            sizePreference,
            business,
          }) => {
            const confidenceScore = buildConfidenceScore(
              combinedScore,
              "dataset"
            );
            return {
              platform: "linkedin",
              username: candidate.username,
              id: candidate.username,
              type: "company",
              name: enriched.resolvedName,
              fullName: enriched.resolvedName,
              displayName: enriched.resolvedName,
              profileUrl: candidate.url,
              profile_url: candidate.url,
              url: candidate.url,
              bio: enriched.resolvedBio.substring(0, 300),
              description: enriched.resolvedBio.substring(0, 300),
              subtitle: enriched.subtitle,
              phone: enriched.officialPhone,
              candidatePhones: enriched.phones,
              city: relevance.locationMatched ? location : "",
              location: relevance.locationMatched ? location : "",
              followersCount: enriched.followersCount,
              employeesCount: enriched.employeesCount,
              industry: enriched.industry,
              website: enriched.website,
              specialties: enriched.specialties,
              rating: relevance.score,
              relevanceScore: relevance.score,
              businessScore: business.businessScore,
              businessSignals: [
                ...(business.hasValidatedCommerceLink
                  ? ["validated_link"]
                  : []),
                ...(business.hasOfficialWebsite ? ["official_website"] : []),
                ...(business.hasPhone ? ["phone"] : []),
                ...(business.hasCommercialIntent ? ["commercial_intent"] : []),
                ...(enriched.industry ? ["industry"] : []),
                ...(enriched.specialties?.length ? ["specialties"] : []),
              ],
              strictPass: business.strictPass,
              hardReject: business.hardReject,
              businessValidationLevel: business.businessValidationLevel,
              linkValidationScore: business.linkValidationScore,
              commercialIntentScore: business.commercialIntentScore,
              negativeKeywordMatches: business.negativeKeywordMatches,
              commercialIntentMatches: business.commercialIntentMatches,
              validatedLinkMatches: business.validatedLinkMatches,
              matchedBy: relevance.matchedTerms,
              exactPhraseMatched: relevance.exactPhraseMatched,
              sizePreferenceScore: sizePreference.sizePreferenceScore,
              sizeSegment: sizePreference.sizeSegment,
              sizeCapExceeded: sizePreference.sizeCapExceeded,
              confidenceScore,
              confidenceLevel: toConfidenceLevel(confidenceScore),
              verificationLevel: "browser_verified",
              dataSource:
                String(candidate.dataSource || "").includes("direct") ||
                String(candidate.dataSource || "").includes("browser") ||
                String(candidate.dataSource || "").includes("proxy_company")
                  ? "linkedin_direct_company_verified"
                  : "linkedin_browser_verified",
            };
          }
        )
    ).slice(0, requestedLimit);

    const candidateResults = sortLinkedInResults(
      scoredCandidates
        .slice(0, Math.max(verificationLimit, requestedLimit * 3))
        .map(
          ({
            candidate,
            enriched,
            relevance,
            combinedScore,
            sizePreference,
            business,
          }) => {
            const resolvedName =
              enriched?.resolvedName ||
              candidate.displayName ||
              candidate.username;
            const resolvedBio = enriched?.resolvedBio || candidate.bio || "";
            const confidenceScore = buildConfidenceScore(
              combinedScore,
              enriched?.loadedSuccessfully ? "dataset" : "serp"
            );

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
              bio: resolvedBio.substring(0, 200),
              description: resolvedBio.substring(0, 200),
              subtitle: enriched?.subtitle || candidate.username,
              phone: enriched?.officialPhone || "",
              candidatePhones: enriched?.phones || [],
              city: relevance.locationMatched ? location : "",
              location: relevance.locationMatched ? location : "",
              followersCount:
                enriched?.followersCount || candidate.followersCount || 0,
              employeesCount:
                enriched?.employeesCount || candidate.employeesCount || "",
              industry: enriched?.industry || "",
              website: enriched?.website || "",
              specialties: enriched?.specialties || [],
              rating: relevance.score,
              relevanceScore: relevance.score,
              businessScore: business.businessScore,
              businessSignals: [
                ...(business.hasValidatedCommerceLink
                  ? ["validated_link"]
                  : []),
                ...(business.hasOfficialWebsite ? ["official_website"] : []),
                ...(business.hasPhone ? ["phone"] : []),
                ...(business.hasCommercialIntent ? ["commercial_intent"] : []),
                ...(enriched?.industry ? ["industry"] : []),
              ],
              strictPass: business.strictPass,
              hardReject: business.hardReject,
              businessValidationLevel: business.businessValidationLevel,
              linkValidationScore: business.linkValidationScore,
              commercialIntentScore: business.commercialIntentScore,
              negativeKeywordMatches: business.negativeKeywordMatches,
              commercialIntentMatches: business.commercialIntentMatches,
              validatedLinkMatches: business.validatedLinkMatches,
              matchedBy: relevance.matchedTerms,
              exactPhraseMatched: relevance.exactPhraseMatched,
              sizePreferenceScore: sizePreference.sizePreferenceScore,
              sizeSegment: sizePreference.sizeSegment,
              sizeCapExceeded: sizePreference.sizeCapExceeded,
              confidenceScore,
              confidenceLevel: toConfidenceLevel(confidenceScore),
              verificationLevel: enriched?.loadedSuccessfully
                ? "candidate_only"
                : "serp_fallback",
              dataSource: enriched?.loadedSuccessfully
                ? String(candidate.dataSource || "").includes("direct") ||
                  String(candidate.dataSource || "").includes("browser") ||
                  String(candidate.dataSource || "").includes("proxy_company")
                  ? "linkedin_direct_company_candidate"
                  : "linkedin_enriched_candidate"
                : "linkedin_serp_candidate",
            };
          }
        )
    ).slice(0, requestedLimit);

    const deadLinkCount = Array.from(enrichedMap.values()).filter(
      enriched => enriched?.profileExists === false
    ).length;
    const finalResults = sortLinkedInResults(
      mergePrioritizedResults(verifiedResults, candidateResults, requestedLimit)
    ).slice(0, requestedLimit);

    logPlatformSearchMetrics({
      platform: "linkedin",
      query,
      location,
      requestedLimit,
      discoveryLimit,
      verificationLimit,
      discovered: candidates.length,
      verified: verifiedResults.length,
      filteredOut: Math.max(
        0,
        preliminaryCandidates.length - scoredCandidates.length
      ),
      deadLinks: deadLinkCount,
      returned: finalResults.length,
    });

    return finalResults;
  } catch (e) {
    console.error("[LinkedIn ranked search] Error:", e);
    return [];
  }
}

async function scrapeFacebookRanked(
  query: string,
  location: string,
  limit = 10
): Promise<any[]> {
  const requestedLimit = normalizeSearchLimit(limit);
  const { discoveryLimit, verificationLimit } =
    getModerateOverfetchConfig(requestedLimit);
  const sortFacebookResults = (results: any[]) =>
    results.sort((a, b) => {
      const scoreDiff = (b.confidenceScore || 0) - (a.confidenceScore || 0);
      if (scoreDiff !== 0) return scoreDiff;
      const validationDiff =
        (b.linkValidationScore || 0) +
        (b.commercialIntentScore || 0) -
        ((a.linkValidationScore || 0) + (a.commercialIntentScore || 0));
      if (validationDiff !== 0) return validationDiff;
      const sizeDiff =
        (b.sizePreferenceScore || 0) - (a.sizePreferenceScore || 0);
      if (sizeDiff !== 0) return sizeDiff;
      const ratingDiff =
        (b.relevanceScore || b.rating || 0) -
        (a.relevanceScore || a.rating || 0);
      if (ratingDiff !== 0) return ratingDiff;
      return (b.followersCount || 0) - (a.followersCount || 0);
    });

  try {
    let candidates = (await searchFacebookSERP(query, location, discoveryLimit))
      .filter(r => r.url && r.username)
      .slice(0, discoveryLimit);

    if (location && candidates.length < requestedLimit) {
      const broadCandidates = (
        await searchFacebookSERP(query, "", discoveryLimit)
      )
        .filter(r => r.url && r.username)
        .slice(0, discoveryLimit);
      candidates = mergePrioritizedResults(
        candidates,
        broadCandidates,
        discoveryLimit * 2
      );
    }

    const applyOverflowFilter = candidates.length > requestedLimit;

    const scoredCandidates = candidates
      .map(candidate => {
        const relevance = scoreProfileRelevance({
          query,
          location,
          name: candidate.displayName || candidate.username,
          bio: candidate.bio || "",
          verified: !!candidate.verified,
        });
        const business = evaluateStrictBusinessProfile({
          name: candidate.displayName || candidate.username,
          bio: candidate.bio || "",
          website: candidate.website || "",
          phone: candidate.phone || "",
          candidatePhones: candidate.candidatePhones || [],
          verified: !!candidate.verified,
        });
        const sizePreference = evaluateFollowerSizePreference(
          "facebook",
          candidate.followersCount || 0
        );
        return {
          candidate,
          relevance,
          business,
          sizePreference,
          combinedScore:
            relevance.score +
            (candidate.verified ? 0.5 : 0) +
            business.businessScore +
            sizePreference.sizePreferenceScore,
        };
      })
      .filter(
        ({ sizePreference, business }) =>
          !(
            applyOverflowFilter &&
            (sizePreference.hardReject || business.hardReject)
          )
      )
      .sort((a, b) => b.combinedScore - a.combinedScore);

    const verificationPool = scoredCandidates
      .slice(0, verificationLimit)
      .map(({ candidate }) => candidate);

    const verifiedSettled = await Promise.allSettled(
      verificationPool.map(async candidate => {
        const datasetResult = await fetchFacebookPagePosts(candidate.url, 6);
        if (!datasetResult.success || !datasetResult.data?.length) return null;

        const stats = extractSocialStats("facebook", datasetResult.data);
        const derivedBio =
          candidate.bio ||
          stats.recentPosts
            ?.map(post => post.content)
            .filter(Boolean)
            .slice(0, 2)
            .join(" | ") ||
          "";
        const relevance = scoreProfileRelevance({
          query,
          location,
          name:
            stats.profileName || candidate.displayName || candidate.username,
          bio: derivedBio,
          contentText:
            stats.recentPosts
              ?.map(post => post.content)
              .filter(Boolean)
              .join(" | ") || "",
          businessSignals: [
            stats.followersCount > 0,
            stats.postsCount > 0,
          ].filter(Boolean).length,
        });
        const business = evaluateStrictBusinessProfile({
          name:
            stats.profileName || candidate.displayName || candidate.username,
          bio: derivedBio,
          website: candidate.website || "",
          phone: "",
          candidatePhones: extractPhonesFromLooseText(derivedBio),
          verified: !!candidate.verified,
        });
        const sizePreference = evaluateFollowerSizePreference(
          "facebook",
          stats.followersCount || 0
        );
        const confidenceScore = buildConfidenceScore(
          relevance.score +
            (stats.followersCount > 0 ? 0.6 : 0) +
            sizePreference.sizePreferenceScore +
            business.businessScore,
          "dataset"
        );
        if (
          applyOverflowFilter &&
          (sizePreference.hardReject || business.hardReject)
        )
          return null;

        return {
          platform: "facebook",
          username: candidate.username,
          id: candidate.username,
          type: "company",
          name:
            stats.profileName || candidate.displayName || candidate.username,
          displayName:
            stats.profileName || candidate.displayName || candidate.username,
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
          city: relevance.locationMatched ? location : "",
          verified: true,
          rating: relevance.score,
          relevanceScore: relevance.score,
          businessScore: business.businessScore,
          businessSignals: [
            ...(business.hasValidatedCommerceLink ? ["validated_link"] : []),
            ...(business.hasOfficialWebsite ? ["official_website"] : []),
            ...(business.hasPhone ? ["phone"] : []),
            ...(business.hasCommercialIntent ? ["commercial_intent"] : []),
            ...business.businessBioMatches,
          ],
          strictPass: business.strictPass,
          hardReject: business.hardReject,
          businessValidationLevel: business.businessValidationLevel,
          linkValidationScore: business.linkValidationScore,
          commercialIntentScore: business.commercialIntentScore,
          negativeKeywordMatches: business.negativeKeywordMatches,
          commercialIntentMatches: business.commercialIntentMatches,
          validatedLinkMatches: business.validatedLinkMatches,
          matchedBy: relevance.matchedTerms,
          exactPhraseMatched: relevance.exactPhraseMatched,
          sizePreferenceScore: sizePreference.sizePreferenceScore,
          sizeSegment: sizePreference.sizeSegment,
          sizeCapExceeded: sizePreference.sizeCapExceeded,
          confidenceScore,
          confidenceLevel: toConfidenceLevel(confidenceScore),
          verificationLevel: "dataset",
          dataSource: "facebook_dataset_verified",
        };
      })
    );

    const verifiedResults = sortFacebookResults(
      verifiedSettled.flatMap(result =>
        result.status === "fulfilled" && result.value ? [result.value] : []
      )
    ).slice(0, requestedLimit);

    const candidateResults = sortFacebookResults(
      scoredCandidates
        .slice(0, Math.max(verificationLimit, requestedLimit * 3))
        .map(
          ({
            candidate,
            relevance,
            combinedScore,
            sizePreference,
            business,
          }) => {
            const confidenceScore = buildConfidenceScore(combinedScore, "serp");
            return {
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
              followers: candidate.followersCount || 0,
              followersCount: candidate.followersCount || 0,
              phone: "",
              city: relevance.locationMatched ? location : "",
              verified: false,
              rating: relevance.score,
              relevanceScore: relevance.score,
              businessScore: business.businessScore,
              businessSignals: [
                ...(business.hasValidatedCommerceLink
                  ? ["validated_link"]
                  : []),
                ...(business.hasOfficialWebsite ? ["official_website"] : []),
                ...(business.hasPhone ? ["phone"] : []),
                ...(business.hasCommercialIntent ? ["commercial_intent"] : []),
                ...business.businessBioMatches,
              ],
              strictPass: business.strictPass,
              hardReject: business.hardReject,
              businessValidationLevel: business.businessValidationLevel,
              linkValidationScore: business.linkValidationScore,
              commercialIntentScore: business.commercialIntentScore,
              negativeKeywordMatches: business.negativeKeywordMatches,
              commercialIntentMatches: business.commercialIntentMatches,
              validatedLinkMatches: business.validatedLinkMatches,
              matchedBy: relevance.matchedTerms,
              exactPhraseMatched: relevance.exactPhraseMatched,
              sizePreferenceScore: sizePreference.sizePreferenceScore,
              sizeSegment: sizePreference.sizeSegment,
              sizeCapExceeded: sizePreference.sizeCapExceeded,
              confidenceScore,
              confidenceLevel: toConfidenceLevel(confidenceScore),
              verificationLevel: "candidate_only",
              dataSource: "facebook_serp_candidate",
            };
          }
        )
    ).slice(0, requestedLimit);

    const finalResults = sortFacebookResults(
      mergePrioritizedResults(verifiedResults, candidateResults, requestedLimit)
    ).slice(0, requestedLimit);

    logPlatformSearchMetrics({
      platform: "facebook",
      query,
      location,
      requestedLimit,
      discoveryLimit,
      verificationLimit,
      discovered: candidates.length,
      verified: verifiedResults.length,
      filteredOut: Math.max(0, candidates.length - scoredCandidates.length),
      deadLinks: 0,
      returned: finalResults.length,
    });

    return finalResults;
  } catch (err) {
    console.warn("[Facebook ranked search] failed:", err);
    return [];
  }
}

async function scrapeGoogleSearch(
  query: string,
  location: string,
  limit = 10
): Promise<any[]> {
  const requestedLimit = normalizeSearchLimit(limit);
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
    if (results.length >= requestedLimit * 3) break;
  }
  const finalResults = results.slice(0, requestedLimit);
  logPlatformSearchMetrics({
    platform: "google",
    query,
    location,
    requestedLimit,
    discovered: results.length,
    verified: 0,
    filteredOut: Math.max(0, results.length - finalResults.length),
    deadLinks: 0,
    returned: finalResults.length,
  });
  return finalResults;
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
      return normalizeUnifiedSearchResults(
        platform,
        await scrapeInstagram(query, location, limit)
      );
    case "tiktok":
      return normalizeUnifiedSearchResults(
        platform,
        await scrapeTikTok(query, location, limit)
      );
    case "twitter":
      return normalizeUnifiedSearchResults(
        platform,
        await scrapeTwitterRanked(query, location, limit)
      );
    case "linkedin":
      return normalizeUnifiedSearchResults(
        platform,
        await scrapeLinkedInRanked(query, location, limit)
      );
    case "snapchat":
      return normalizeUnifiedSearchResults(
        platform,
        await scrapeSnapchat(query, location, limit)
      );
    case "google":
      return normalizeUnifiedSearchResults(
        platform,
        await scrapeGoogleSearch(query, location, limit)
      );
    case "facebook":
      return normalizeUnifiedSearchResults(
        platform,
        await scrapeFacebookRanked(query, location, limit)
      );
    default:
      return [];
  }
}

export const brightDataSearchRouter = router({
  // ===== Instagram Dataset API Search (أكثر موثوقية من SERP) =====
  searchInstagramDataset: protectedProcedure
    .input(
      z.object({
        keyword: z.string().min(1),
        location: z.string().optional(),
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .mutation(async ({ input }) => {
      const results = await searchVerifiedPlatformResults(
        "instagram",
        input.keyword,
        input.location || "",
        input.limit
      );
      return {
        success: results.length > 0,
        results,
        total: results.length,
        platform: "instagram",
      };
    }),

  // فحص حالة الربط
  checkConnection: protectedProcedure.query(async () => {
    const hasWs = !!BRIGHT_DATA_WS_ENDPOINT;
    const hasApiToken = !!process.env.BRIGHT_DATA_API_TOKEN;
    return {
      connected: hasWs || hasApiToken,
      message:
        hasWs || hasApiToken
          ? "Bright Data متصل وجاهز للاستخدام"
          : "يرجى إضافة BRIGHT_DATA_API_TOKEN أو BRIGHT_DATA_WS_ENDPOINT في الإعدادات",
    };
  }),

  searchFacebookVerified: protectedProcedure
    .input(
      z.object({
        keyword: z.string().min(1),
        location: z.string().optional(),
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .mutation(async ({ input }) => {
      const results = await searchVerifiedPlatformResults(
        "facebook",
        input.keyword,
        input.location || "",
        input.limit
      );
      return {
        results,
        platform: "facebook",
        total: results.length,
      };
    }),

  searchTikTokVerified: protectedProcedure
    .input(
      z.object({
        keyword: z.string().min(1),
        location: z.string().optional(),
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .mutation(async ({ input }) => {
      const results = await searchVerifiedPlatformResults(
        "tiktok",
        input.keyword,
        input.location || "",
        input.limit
      );
      return {
        results,
        platform: "tiktok",
        total: results.length,
      };
    }),

  searchTwitterVerified: protectedProcedure
    .input(
      z.object({
        keyword: z.string().min(1),
        location: z.string().optional(),
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .mutation(async ({ input }) => {
      const results = await searchVerifiedPlatformResults(
        "twitter",
        input.keyword,
        input.location || "",
        input.limit
      );
      return {
        results,
        platform: "twitter",
        total: results.length,
      };
    }),

  searchSnapchatVerified: protectedProcedure
    .input(
      z.object({
        keyword: z.string().min(1),
        location: z.string().optional(),
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .mutation(async ({ input }) => {
      const results = await searchVerifiedPlatformResults(
        "snapchat",
        input.keyword,
        input.location || "",
        input.limit
      );
      return {
        results,
        platform: "snapchat",
        total: results.length,
      };
    }),

  searchLinkedInVerified: protectedProcedure
    .input(
      z.object({
        keyword: z.string().min(1),
        location: z.string().optional(),
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .mutation(async ({ input }) => {
      const results = await searchVerifiedPlatformResults(
        "linkedin",
        input.keyword,
        input.location || "",
        input.limit
      );
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
        platform: z.enum([
          "instagram",
          "tiktok",
          "twitter",
          "linkedin",
          "snapchat",
          "google",
          "facebook",
        ]),
        query: z.string().min(1),
        location: z.string().default(""),
        limit: z.number().min(1).max(50).default(10),
        analyzeWithAI: z.boolean().default(true),
      })
    )
    .mutation(async ({ input }) => {
      let results: any[] = [];

      try {
        results = await searchVerifiedPlatformResults(
          input.platform,
          input.query,
          input.location,
          input.limit
        );
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
            message:
              "رصيد Bright Data غير كافٍ. يرجى شحن حسابك على brightdata.com لمتابعة البحث.",
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
        results = await analyzeResultsWithAI(
          results,
          input.query,
          input.platform
        );
      }

      results = normalizeUnifiedMixedSearchResults(results);

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
          .array(
            z.enum([
              "instagram",
              "tiktok",
              "twitter",
              "linkedin",
              "snapchat",
              "google",
              "facebook",
            ])
          )
          .default([
            "instagram",
            "tiktok",
            "twitter",
            "linkedin",
            "snapchat",
            "google",
            "facebook",
          ]),
      })
    )
    .mutation(async ({ input }) => {
      const allResults: Record<string, any[]> = {};
      const errors: Record<string, string> = {};

      // البحث في المنصات بالتوازي (3 في نفس الوقت كحد أقصى)
      for (let i = 0; i < input.platforms.length; i += 3) {
        const chunk = input.platforms.slice(i, i + 3);
        await Promise.all(
          chunk.map(async platform => {
            try {
              const results = await searchVerifiedPlatformResults(
                platform as VerifiedSearchPlatform,
                input.query,
                input.location,
                input.limit
              );
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
        combined: normalizeUnifiedMixedSearchResults(analyzed),
        totalCount: combined.length,
        errors,
      };
    }),

  // بحث ذكي تلقائي عن حسابات السوشيال ميديا لنشاط تجاري محدد
  smartFindSocialAccounts: protectedProcedure
    .input(
      z.object({
        companyName: z.string().min(1),
        city: z.string().default(""),
        businessType: z.string().default(""),
      })
    )
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
          .then(r => {
            results.instagram = r.slice(0, 5);
          })
          .catch(e => {
            errors.instagram = e.message;
          }),
        searchTikTokSERP(query, location)
          .then(r => {
            results.tiktok = r.slice(0, 5);
          })
          .catch(e => {
            errors.tiktok = e.message;
          }),
        searchSnapchatSERP(query, location)
          .then(r => {
            results.snapchat = r.slice(0, 5);
          })
          .catch(e => {
            errors.snapchat = e.message;
          }),
        searchLinkedInSERP(query, location)
          .then(r => {
            results.linkedin = r.slice(0, 5);
          })
          .catch(e => {
            errors.linkedin = e.message;
          }),
        // Twitter via SERP
        (async () => {
          try {
            const twitterQuery = `${query} ${location} site:twitter.com OR site:x.com`;
            // PHASE 1 FIX: buildGoogleSearchUrl + parseGoogleResultsGeneric
            const url = buildGoogleSearchUrl({ query: twitterQuery, num: 10 });
            const html = await serpRequest(url);
            const parsed = parseGoogleResultsGeneric(html);
            results.twitter = parsed
              .slice(0, 5)
              .map((r: { url: string; displayName: string; bio: string }) => ({
                username:
                  r.url.match(/(?:twitter|x)\.com\/([a-zA-Z0-9_]+)/)?.[1] || "",
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
            .map(
              ([platform, accounts]) =>
                `${platform}: ${accounts
                  .map((a: any) => a.username || a.displayName || a.name || "")
                  .filter(Boolean)
                  .join(", ")}`
            )
            .join("\n");

          const aiResp = await invokeLLM({
            messages: [
              {
                role: "system",
                content:
                  "أنت خبير تحليل سوشيال ميديا. أجب بـ JSON فقط بدون أي نص إضافي.",
              },
              {
                role: "user",
                content: `النشاط: ${input.companyName} (${input.businessType || "غير محدد"}) في ${input.city || "السعودية"}\nنتائج البحث:\n${platformSummary}\n\nاقترح أفضل حساب لكل منصة بناءً على التشابه مع اسم النشاط. أجب بـ JSON:\n{"instagram":"username","tiktok":"username","snapchat":"username","twitter":"username","linkedin":"username"}`,
              },
            ],
            response_format: { type: "json_object" } as any,
          });
          const content = aiResp?.choices?.[0]?.message?.content;
          if (content)
            aiSuggestions = JSON.parse(
              typeof content === "string" ? content : "{}"
            );
        } catch {}
      }

      return { results, errors, aiSuggestions, totalFound };
    }),
});
