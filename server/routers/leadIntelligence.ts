/**
 * Lead Intelligence Router
 * ========================
 * العقل المركزي لمنظومة Lead Intelligence.
 * يربط جميع مصادر البيانات ويطبق خوارزمية الربط الذكي
 * لتحويل النتائج الخام إلى كيانات موحدة قابلة للبيع.
 *
 * Pipeline:
 *   Discovery → Resolution (Identity Linkage) → BusinessLead
 *
 * PHASE 1 CHANGES:
 *  - Updated DiscoveryCandidate construction to use new fields
 *  - source: DiscoverySource (strict union)
 *  - sourceType: DiscoverySourceType (strict union)
 *  - verifiedPhones / candidatePhones (بدلاً من phones)
 *  - verifiedEmails / candidateEmails (جديد)
 *  - verifiedWebsite / candidateWebsites (بدلاً من websites)
 *  - raw: unknown (بدلاً من rawSourceData)
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { createLeadWithResolution } from "../db";
import { canonicalizeSource, getSocialFieldKey } from "../../shared/sourceRegistry";
import {
  resolveLeads,
  computeLinkageScore,
  normalizeName,
  normalizePhone,
  extractDomain,
  explainLinkage,
  clusterCandidates,
} from "../lib/identityLinkage";
import { enrichCandidatesBatch } from "../lib/profileEnricher";
import { enrichCandidatesWithAI } from "../lib/aiEnrichmentAgent";
import { runGateOnBatch } from "../lib/identityIntegrityGate";
import type {
  DiscoveryCandidate,
  DiscoverySource,
  DiscoverySourceType,
} from "../../shared/types/lead-intelligence";

// ─── Helper: تحويل مصدر string إلى DiscoverySource (عبر Source Registry) ──────

function toDiscoverySource(source: string): DiscoverySource {
  const canonical = canonicalizeSource(source);
  // telegram مدعوم في DiscoverySource لكن ليس في sourceRegistry بعد
  if (source === "telegram") return "telegram" as DiscoverySource;
  // إذا كان unknown → نسجّل تحذيراً ولا نُخفي المشكلة
  if (canonical === "unknown") {
    console.warn(`[sourceRegistry] Unknown source: "${source}" — will be tagged as unknown`);
  }
  return canonical as DiscoverySource;
}

function toDiscoverySourceType(source: string): DiscoverySourceType {
  const canonical = canonicalizeSource(source);
  if (canonical === "google") return "search_result";
  if (canonical === "maps") return "listing";
  if (["instagram", "tiktok", "snapchat", "x", "facebook", "linkedin", "telegram"].includes(canonical)) {
    return "profile";
  }
  return "page";
}

// ─── Helper: تحويل نتيجة خام إلى DiscoveryCandidate ─────────────────────────

function rawResultToCandidate(
  result: Record<string, unknown>,
  source: string,
  idx: number
): DiscoveryCandidate {
  const canonicalSrc = canonicalizeSource(source);
  const displayName = String(result.displayName || result.name || "");
  const bio = String(result.bio || result.description || result.snippet || "");
  const username = String(result.username || result.id || "");

  // Phase C: فصل صارم بين profileUrl و website و externalLinks
  // profileUrl: رابط صفحة الحساب (دائماً سوشيال)
  // website: موقع العمل (دائماً غير سوشيال)
  // externalLinks: روابط خارجية من البيو (قد تكون سوشيال أو غير سوشيال)
  const isSocialPlatform = ["instagram", "tiktok", "snapchat", "x", "facebook", "linkedin"].includes(canonicalSrc);
  
  // profileUrl: الرابط الأساسي للحساب (للسوشيال فقط)
  const profileUrl = isSocialPlatform
    ? String(result.profileUrl || result.url || "")
    : undefined;
  
  // للمنصات غير السوشيال (maps/google): url هو رابط النتيجة
  const resultUrl = !isSocialPlatform
    ? String(result.url || result.link || "")
    : undefined;
  
  // url الموحد: للسوشيال = profileUrl، للباقي = resultUrl
  const url = profileUrl || resultUrl || String(result.profileUrl || result.url || "");

  // ─── استخراج username من URL إذا لم يكن موجوداً مباشرة ───
  let resolvedUsername = username;
  if (!resolvedUsername && url) {
    // instagram.com/username أو tiktok.com/@username أو snapchat.com/add/username
    const usernameFromUrl = url.match(
      /(?:instagram\.com|tiktok\.com\/@?|snapchat\.com\/add\/|twitter\.com\/|x\.com\/|facebook\.com\/|linkedin\.com\/(?:company|in)\/)\/?([@]?[\w.]+)/i
    );
    if (usernameFromUrl) resolvedUsername = usernameFromUrl[1].replace(/^@/, "");
  }

  // ─── استخراج روابط المنصات من bio (cross-platform signals) ───
  const SOCIAL_URL_PATTERNS = [
    { platform: "instagram", regex: /(?:instagram\.com\/|@)([\w.]{3,30})/gi },
    { platform: "tiktok",    regex: /tiktok\.com\/@?([\w.]{3,30})/gi },
    { platform: "snapchat",  regex: /snapchat\.com\/add\/([\w.]{3,30})/gi },
    { platform: "x",         regex: /(?:twitter\.com\/|x\.com\/)([\.\w.]{3,30})/gi },   { platform: "facebook",  regex: /facebook\.com\/([\w.]{3,30})/gi },
  ];
  const crossPlatformHandles: Record<string, string> = {};
  const bioAndUrl = `${bio} ${url}`;
  for (const { platform, regex } of SOCIAL_URL_PATTERNS) {
    const matches = Array.from(bioAndUrl.matchAll(regex));
    if (matches.length > 0) {
      crossPlatformHandles[platform] = matches[0][1].replace(/^@/, "");
    }
  }

  // ─── استخراج أرقام الهاتف من النص + availablePhones ───
  const text = `${displayName} ${bio} ${resolvedUsername}`;
  const phoneMatches =
    text.match(/(?:\+966|00966|0)(?:5[0-9]{8}|[1-9][0-9]{7})/g) || [];

  // أرقام الهاتف: مؤكدة (من حقل phone مباشرة) vs مرشحة (من النص)
  const directPhone = String(result.phone || "").trim();
  // availablePhones: أرقام مستخرجة من صفحة المنصة بـ regex (من socialSearch)
  const availablePhones = (result.availablePhones as string[] | undefined) || [];
  const verifiedPhones: string[] = [
    ...(directPhone ? [directPhone] : []),
    ...availablePhones,
  ].filter((p, i, arr) => p && arr.indexOf(p) === i);
  const candidatePhones: string[] = phoneMatches.filter(p => !verifiedPhones.includes(p));

  // البريد الإلكتروني
  const directEmail = String(result.email || "").trim();
  const emailMatches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  const verifiedEmails: string[] = directEmail ? [directEmail] : [];
  const candidateEmails: string[] = emailMatches.filter(e => e !== directEmail);

  // المواقع الإلكترونية
  const directWebsite = String(result.website || "").trim();
  const availableWebsites = (result.availableWebsites as string[] | undefined) || [];
  const isSocialUrl = (u: string) =>
    ["instagram.com", "tiktok.com", "twitter.com", "x.com", "snapchat.com", "facebook.com", "linkedin.com", "t.me"].some(
      p => u.includes(p)
    );

  // الموقع المؤكد: من directWebsite أو availableWebsites (غير سوشيال)
  const allWebsiteCandidates = [
    directWebsite,
    ...availableWebsites,
  ].filter(w => w && !isSocialUrl(w));
  const verifiedWebsite: string | undefined = allWebsiteCandidates[0] || undefined;

  const candidateWebsites: string[] = [];
  if (url && url.startsWith("http") && !isSocialUrl(url) && url !== verifiedWebsite) {
    candidateWebsites.push(url);
  }

  // استنتاج المدينة من النص
  const CITY_PATTERNS: Record<string, RegExp> = {
    "الرياض": /\b(الرياض|riyadh)\b/i,
    "جدة": /\b(جدة|jeddah|jidda)\b/i,
    "مكة": /\b(مكة|mecca|makkah)\b/i,
    "المدينة": /\b(المدينة|medina|madinah)\b/i,
    "الدمام": /\b(الدمام|dammam)\b/i,
    "الخبر": /\b(الخبر|khobar)\b/i,
    "الطائف": /\b(الطائف|taif)\b/i,
    "تبوك": /\b(تبوك|tabuk)\b/i,
    "أبها": /\b(أبها|abha)\b/i,
  };

  let cityHint: string | undefined;
  for (const [city, pattern] of Object.entries(CITY_PATTERNS)) {
    if (pattern.test(text)) {
      cityHint = city;
      break;
    }
  }

  // حساب درجة الثقة بناءً على اكتمال البيانات
  let confidence = 0.3;
  if (displayName) confidence += 0.2;
  if (bio && bio.length > 20) confidence += 0.1;
  if (verifiedPhones.length > 0) confidence += 0.2;
  if (verifiedWebsite) confidence += 0.1;
  if (cityHint) confidence += 0.1;

  return {
    id: `${source}-${idx}-${Date.now()}`,
    source: toDiscoverySource(source),
    sourceType: toDiscoverySourceType(source),
    url: url || undefined,
    nameHint: displayName || undefined,
    usernameHint: resolvedUsername || username || undefined,
    businessNameHint: displayName || undefined,
    categoryHint: String(result.businessType || result.category || "") || undefined,
    cityHint,
    verifiedPhones,
    candidatePhones,
    verifiedEmails,
    candidateEmails,
    verifiedWebsite,
    candidateWebsites,
    confidence: Math.min(confidence, 1),
    raw: {
      ...result,
      // إضافة crossPlatformHandles لاستخدامها في computeLinkageScore
      crossPlatformHandles: Object.keys(crossPlatformHandles).length > 0 ? crossPlatformHandles : undefined,
      resolvedUsername: resolvedUsername || undefined,
    },
  };
}

// ─── Router ───────────────────────────────────────────────────────────────────

const leadIntelligenceRouter = router({

  /**
   * resolve: يأخذ نتائج خام من مصادر متعددة ويدمجها في كيانات موحدة
   * هذه هي الدالة الأساسية لـ Identity Linkage
   */
  resolve: protectedProcedure
    .input(
      z.object({
        rawResults: z.record(
          z.string(),
          z.array(z.record(z.string(), z.unknown()))
        ),
      })
    )
    .mutation(async ({ input }) => {
      const candidates: DiscoveryCandidate[] = [];

      for (const [platform, results] of Object.entries(input.rawResults)) {
        results.forEach((result, idx) => {
          candidates.push(rawResultToCandidate(result, platform, idx));
        });
      }

      if (candidates.length === 0) {
        return {
          leads: [],
          stats: {
            inputCandidates: 0,
            outputLeads: 0,
            mergedCount: 0,
            mergeRate: "0%",
          },
        };
      }

      const leads = resolveLeads(candidates);
      const mergedCount = candidates.length - leads.length;

      return {
        leads,
        stats: {
          inputCandidates: candidates.length,
          outputLeads: leads.length,
          mergedCount,
          mergeRate: `${Math.round((mergedCount / candidates.length) * 100)}%`,
        },
      };
    }),

  /**
   * compareTwo: مقارنة مرشحين وإظهار تفاصيل درجة التشابه
   * مفيد للـ debugging وفهم قرارات الخوارزمية
   */
  compareTwo: protectedProcedure
    .input(
      z.object({
        candidateA: z.object({
          nameHint: z.string().optional(),
          businessNameHint: z.string().optional(),
          verifiedPhones: z.array(z.string()).default([]),
          candidatePhones: z.array(z.string()).default([]),
          verifiedWebsite: z.string().optional(),
          candidateWebsites: z.array(z.string()).default([]),
          cityHint: z.string().optional(),
          categoryHint: z.string().optional(),
          usernameHint: z.string().optional(),
          source: z.string().default("manual"),
        }),
        candidateB: z.object({
          nameHint: z.string().optional(),
          businessNameHint: z.string().optional(),
          verifiedPhones: z.array(z.string()).default([]),
          candidatePhones: z.array(z.string()).default([]),
          verifiedWebsite: z.string().optional(),
          candidateWebsites: z.array(z.string()).default([]),
          cityHint: z.string().optional(),
          categoryHint: z.string().optional(),
          usernameHint: z.string().optional(),
          source: z.string().default("manual"),
        }),
      })
    )
    .query(async ({ input }) => {
      const a: DiscoveryCandidate = {
        id: `manual-a-${Date.now()}`,
        source: toDiscoverySource(input.candidateA.source),
        sourceType: "profile",
        verifiedEmails: [],
        candidateEmails: [],
        confidence: 0.8,
        raw: input.candidateA,
        nameHint: input.candidateA.nameHint,
        businessNameHint: input.candidateA.businessNameHint,
        verifiedPhones: input.candidateA.verifiedPhones,
        candidatePhones: input.candidateA.candidatePhones,
        verifiedWebsite: input.candidateA.verifiedWebsite,
        candidateWebsites: input.candidateA.candidateWebsites,
        cityHint: input.candidateA.cityHint,
        categoryHint: input.candidateA.categoryHint,
        usernameHint: input.candidateA.usernameHint,
      };

      const b: DiscoveryCandidate = {
        id: `manual-b-${Date.now()}`,
        source: toDiscoverySource(input.candidateB.source),
        sourceType: "profile",
        verifiedEmails: [],
        candidateEmails: [],
        confidence: 0.8,
        raw: input.candidateB,
        nameHint: input.candidateB.nameHint,
        businessNameHint: input.candidateB.businessNameHint,
        verifiedPhones: input.candidateB.verifiedPhones,
        candidatePhones: input.candidateB.candidatePhones,
        verifiedWebsite: input.candidateB.verifiedWebsite,
        candidateWebsites: input.candidateB.candidateWebsites,
        cityHint: input.candidateB.cityHint,
        categoryHint: input.candidateB.categoryHint,
        usernameHint: input.candidateB.usernameHint,
      };

      const score = computeLinkageScore(a, b);
      const explanation = explainLinkage(a, b);

      return {
        score,
        explanation,
        normalizedA: normalizeName(a.businessNameHint || a.nameHint || ""),
        normalizedB: normalizeName(b.businessNameHint || b.nameHint || ""),
      };
    }),

  /**
   * normalizeName: تطبيع اسم العمل للمقارنة
   */
  normalizeName: protectedProcedure
    .input(z.object({ name: z.string() }))
    .query(async ({ input }) => {
      return {
        original: input.name,
        normalized: normalizeName(input.name),
      };
    }),

  /**
   * normalizePhone: تطبيع رقم الهاتف
   */
  normalizePhone: protectedProcedure
    .input(z.object({ phone: z.string() }))
    .query(async ({ input }) => {
      return {
        original: input.phone,
        normalized: normalizePhone(input.phone),
      };
    }),

  /**
   * extractDomain: استخراج النطاق من URL
   */
  extractDomain: protectedProcedure
    .input(z.object({ url: z.string() }))
    .query(async ({ input }) => {
      return {
        original: input.url,
        domain: extractDomain(input.url),
      };
    }),

  /**
   * clusterPreview: معاينة التجميع قبل الدمج الكامل
   */
  clusterPreview: protectedProcedure
    .input(
      z.object({
        candidates: z.array(
          z.object({
            source: z.string(),
            nameHint: z.string().optional(),
            businessNameHint: z.string().optional(),
            verifiedPhones: z.array(z.string()).default([]),
            candidatePhones: z.array(z.string()).default([]),
            verifiedWebsite: z.string().optional(),
            candidateWebsites: z.array(z.string()).default([]),
            cityHint: z.string().optional(),
            categoryHint: z.string().optional(),
            usernameHint: z.string().optional(),
            confidence: z.number().default(0.5),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      const candidates: DiscoveryCandidate[] = input.candidates.map((c, idx) => ({
        id: `preview-${idx}-${Date.now()}`,
        source: toDiscoverySource(c.source),
        sourceType: toDiscoverySourceType(c.source),
        verifiedEmails: [],
        candidateEmails: [],
        raw: c,
        nameHint: c.nameHint,
        businessNameHint: c.businessNameHint,
        verifiedPhones: c.verifiedPhones,
        candidatePhones: c.candidatePhones,
        verifiedWebsite: c.verifiedWebsite,
        candidateWebsites: c.candidateWebsites,
        cityHint: c.cityHint,
        categoryHint: c.categoryHint,
        usernameHint: c.usernameHint,
        confidence: c.confidence,
      }));

      const groups = clusterCandidates(candidates);

      return {
        groups: groups.map(g => ({
          primaryName: g.primary.businessNameHint || g.primary.nameHint,
          primarySource: g.primary.source,
          duplicateCount: g.duplicates.length,
          duplicates: g.duplicates.map(d => ({
            name: d.businessNameHint || d.nameHint,
            source: d.source,
          })),
          mergeConfidence: Math.round(g.mergeConfidence * 100),
          sources: g.sources,
        })),
        stats: {
          totalCandidates: candidates.length,
          uniqueGroups: groups.length,
          mergedCount: candidates.length - groups.length,
        },
      };
    }),

  /**
   * seedFromRaw — PHASE 2
   * إدخال lead خام من أي مصدر عبر createLeadWithResolution()
   * يطبّق normalisation + conservative deduplication تلقائياً.
   * لا يحجب الإدخال أبداً — التكرار يُعلّم فقط ك‘possible_duplicate’.
   */
  seedFromRaw: protectedProcedure
    .input(z.object({
      companyName: z.string().min(1),
      businessType: z.string().optional(),
      city: z.string().optional(),
      country: z.string().optional(),
      verifiedPhone: z.string().optional(),
      website: z.string().optional(),
      instagramUrl: z.string().optional(),
      twitterUrl: z.string().optional(),
      tiktokUrl: z.string().optional(),
      snapchatUrl: z.string().optional(),
      facebookUrl: z.string().optional(),
      googleMapsUrl: z.string().optional(),
      notes: z.string().optional(),
      source: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { source, ...leadData } = input;
      const id = await createLeadWithResolution({
        ...leadData,
        city: leadData.city || "غير محدد",
        businessType: leadData.businessType || "غير محدد",
        notes: leadData.notes
          ? `[source: ${source || 'unknown'}] ${leadData.notes}`
          : source ? `[source: ${source}]` : undefined,
      });
      return { id, source: source || 'unknown' };
    }),

  /**
   * scoreLeadById — PHASE 5
   * Manual trigger for the scoring pipeline.
   * Runs: AuditEngine → MissingFields → Readiness → OpportunityEngine → LeadScorer → PriorityLabeler.
   * Returns structured result with per-step observability.
   * NOT auto-wired into enrichment — manual trigger only.
   */
  scoreLeadById: protectedProcedure
    .input(z.object({ leadId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const { runScoringPipeline } = await import("../scoring/index.js");
      const result = await runScoringPipeline(input.leadId);
      return {
        success: result.success,
        leadId: result.leadId,
        score: result.score,
        opportunities: result.opportunities,
        readinessState: result.readinessState,
        dbUpdated: result.dbUpdated,
        dbSkipReason: result.dbSkipReason,
        completedSteps: result.completedSteps,
        failedSteps: result.failedSteps,
      };
    }),

  /**
   * enrichLeadById — PHASE 4
   * Manual trigger for enrichment pipeline.
   * Runs Gate → Website → Social → Audit → Readiness Recompute.
   * Returns structured result with per-step observability.
   */
  enrichLeadById: protectedProcedure
    .input(z.object({ leadId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const { getLeadById } = await import("../db.js");
      const { runEnrichmentPipeline } = await import("../enrichment/index.js");

      const lead = await getLeadById(input.leadId);
      if (!lead) {
        return {
          success: false,
          reason: "lead_not_found",
          leadId: input.leadId,
        };
      }

      const result = await runEnrichmentPipeline(lead);
      return {
        success: true,
        leadId: input.leadId,
        gateResult: result.gateResult,
        gateReason: result.gateReason,
        websiteEnriched: result.websiteEnriched,
        socialEnriched: result.socialEnriched,
        platformsEnriched: result.platformsEnriched,
        auditCompleted: result.auditCompleted,
        readinessRecomputed: result.readinessRecomputed,
        errors: result.errors,
      };
    }),

  /**
   * generateSalesBrief — PHASE 6A
   * Deterministic, stateless SalesBrief generation.
   * Runs scoring pipeline then generates brief from templates.
   * No DB writes. Manual trigger only.
   */
  generateSalesBrief: protectedProcedure
    .input(z.object({ leadId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const { runSalesBriefPipeline } = await import("../salesBrief/index.js");
      return runSalesBriefPipeline(input.leadId);
    }),

  // ─── Search → Compare → Merge Pipeline ───────────────────────────────────────

  /**
   * groupCandidates — Search → Compare
   * يأخذ نتائج خام من منصات متعددة ويجمّعها في مجموعات باستخدام Identity Linkage.
   * يُستخدم لعرض المقارنة قبل الدمج.
   */
  groupCandidates: protectedProcedure
    .input(
      z.object({
        rawResults: z.record(
          z.string(),
          z.array(z.record(z.string(), z.unknown()))
        ),
        // خيار لتفعيل/تعطيل إثراء الصفحة الكاملة (افتراضي: مفعّل)
        enableProfileEnrichment: z.boolean().optional().default(true),
        // خيار لتفعيل/تعطيل إثراء AI (افتراضي: مفعّل)
        enableAIEnrichment: z.boolean().optional().default(true),
      })
    )
    .mutation(async ({ input }) => {
      const candidates: DiscoveryCandidate[] = [];

      // Phase B: Diagnostic trace لكل منصة
      const platformDiagnostics: Record<string, {
        source: string;         // canonical source name
        rawCount: number;       // عدد النتائج الخام
        parsedCount: number;    // عدد النتائج التي تم تحليلها بنجاح
        withPhone: number;      // عدد النتائج التي تحتوي على هاتف
        withWebsite: number;    // عدد النتائج التي تحتوي على موقع
        withUsername: number;   // عدد النتائج التي تحتوي على username
        withCity: number;       // عدد النتائج التي تحتوي على مدينة
        unknownSources: string[]; // أسماء المنصات غير المعروفة
      }> = {};

      for (const [platform, results] of Object.entries(input.rawResults)) {
        const canonicalPlatform = canonicalizeSource(platform);
        const diag = {
          source: canonicalPlatform,
          rawCount: results.length,
          parsedCount: 0,
          withPhone: 0,
          withWebsite: 0,
          withUsername: 0,
          withCity: 0,
          unknownSources: canonicalPlatform === "unknown" ? [platform] : [],
        };

        (results as Record<string, unknown>[]).forEach((result, idx) => {
          const candidate = rawResultToCandidate(result, platform, idx);
          candidates.push(candidate);
          diag.parsedCount++;
          if (candidate.verifiedPhones.length > 0 || candidate.candidatePhones.length > 0) diag.withPhone++;
          if (candidate.verifiedWebsite || candidate.candidateWebsites.length > 0) diag.withWebsite++;
          if (candidate.usernameHint) diag.withUsername++;
          if (candidate.cityHint) diag.withCity++;
        });

        platformDiagnostics[canonicalPlatform] = diag;
      }

      // ─── Profile Enrichment: جلب صفحة الحساب الكاملة ───────────────────────
      // يجلب صفحة كل حساب سوشيال عبر Bright Data Residential Proxy
      // ويستخرج: الهاتف، الموقع، روابط المنصات المتقاطعة، الـ bio الكامل
      if (input.enableProfileEnrichment !== false) {
        try {
          const enrichedMap = await enrichCandidatesBatch(
            candidates.map(c => ({ url: c.url, source: c.source, usernameHint: c.usernameHint })),
            3 // max concurrent
          );

          // دمج البيانات المُثراة مع الـ candidates
          for (const candidate of candidates) {
            if (!candidate.url) continue;
            const enriched = enrichedMap.get(candidate.url);
            if (!enriched || !enriched.success) continue;

            // إضافة الأرقام المستخرجة
            if (enriched.phones.length > 0) {
              candidate.candidatePhones = Array.from(new Set([
                ...candidate.candidatePhones,
                ...enriched.phones,
              ]));
            }

            // إضافة المواقع المستخرجة
            if (enriched.websites.length > 0) {
              candidate.candidateWebsites = Array.from(new Set([
                ...candidate.candidateWebsites,
                ...enriched.websites,
              ]));
              // أول موقع → verifiedWebsite إذا لم يكن موجوداً
              if (!candidate.verifiedWebsite && enriched.websites[0]) {
                candidate.verifiedWebsite = enriched.websites[0];
              }
            }

            // تحديث الـ bio إذا كان الجديد أطول
            if (enriched.bio && enriched.bio.length > (candidate.nameHint?.length || 0)) {
              // نحتفظ بالـ bio في raw
            }

            // تحديث المدينة إذا لم تكن موجودة
            if (!candidate.cityHint && enriched.city) {
              candidate.cityHint = enriched.city;
            }

            // إضافة crossPlatformHandles إلى raw
            if (Object.keys(enriched.crossPlatformHandles).length > 0) {
              candidate.raw = {
                ...(candidate.raw as Record<string, unknown> || {}),
                crossPlatformHandles: {
                  ...((candidate.raw as Record<string, unknown>)?.crossPlatformHandles as Record<string, string> || {}),
                  ...enriched.crossPlatformHandles,
                },
              };
            }

            // تحديث عدد المتابعين
            if (enriched.followers) {
              candidate.raw = {
                ...(candidate.raw as Record<string, unknown> || {}),
                followers: enriched.followers,
              };
            }
          }

          console.log(`[groupCandidates] Profile enrichment done: ${enrichedMap.size} profiles enriched`);
        } catch (enrichErr) {
          // لا نوقف العملية إذا فشل الإثراء
          console.warn("[groupCandidates] Profile enrichment failed (non-fatal):", enrichErr);
        }
      }

      // ─── Identity Integrity Gate ──────────────────────────────────────────────
      // يفحص كل مرشح بشكل مستقل ويكتشف التعارضات في الحقول الحرجة
      // يُوقف AI Enrichment على المرشحين غير المستقرين
      const batchGateResult = runGateOnBatch(candidates);
      console.log(`[groupCandidates] Identity Gate: ${batchGateResult.summary}`);

      // فصل المرشحين: مستقرون vs غير مستقرون
      const stableCandidateIds = new Set(
        batchGateResult.results
          .filter(r => r.integrityResult.status !== "identity_unstable")
          .map(r => r.id)
      );
      const unstableCandidateIds = new Set(
        batchGateResult.results
          .filter(r => r.integrityResult.status === "identity_unstable")
          .map(r => r.id)
      );

      if (unstableCandidateIds.size > 0) {
        console.warn(
          `[groupCandidates] ${unstableCandidateIds.size} candidates have identity conflicts — ` +
          `AI enrichment, scoring, and auto-save BLOCKED for these candidates`
        );
      }

      // ─── AI Enrichment: فقط على المرشحين المستقرين ───────────────────────────
      // يُكمل الحقول الناقصة (هاتف/موقع/سوشيال/مدينة/تصنيف) من البايو والنص الخام
      // مُقيَّد بـ Identity Integrity Gate — لا يعمل على المرشحين المتعارضين
      let aiEnrichmentSummary = null;
      if (input.enableAIEnrichment !== false && candidates.length > 0) {
        // فلترة المرشحين المستقرين فقط للإثراء
        const stableCandidates = candidates.filter(c => stableCandidateIds.has(c.id));
        if (stableCandidates.length > 0) {
          try {
            aiEnrichmentSummary = await enrichCandidatesWithAI(stableCandidates, 5);
            console.log(
              `[groupCandidates] AI enrichment done (stable only): ${aiEnrichmentSummary.successCount}/${aiEnrichmentSummary.totalProcessed} enriched, ` +
              `phones: ${aiEnrichmentSummary.fieldsExtracted.phones}, ` +
              `websites: ${aiEnrichmentSummary.fieldsExtracted.websites}, ` +
              `social: ${aiEnrichmentSummary.fieldsExtracted.socialHandles}, ` +
              `cities: ${aiEnrichmentSummary.fieldsExtracted.cities}, ` +
              `time: ${aiEnrichmentSummary.processingMs}ms`
            );
          } catch (aiErr) {
            // لا نوقف العملية إذا فشل الإثراء
            console.warn("[groupCandidates] AI enrichment failed (non-fatal):", aiErr);
          }
        } else {
          console.log("[groupCandidates] AI enrichment skipped — no stable candidates");
        }
      }

      if (candidates.length === 0) {
        return {
          groups: [],
          singles: [],
          stats: { totalCandidates: 0, totalGroups: 0, mergedCount: 0 },
        };
      }

      const resolvedGroups = clusterCandidates(candidates);

      // فصل المجموعات (أكثر من مرشح) عن المفردات (مرشح واحد)
      const groups = resolvedGroups.filter(g => g.duplicates.length > 0);
      const singles = resolvedGroups.filter(g => g.duplicates.length === 0);

      return {
        groups: groups.map(g => ({
          primaryName: g.primary.businessNameHint || g.primary.nameHint || "",
          primarySource: g.primary.source,
          primaryUrl: g.primary.url,
          primaryPhone: g.primary.verifiedPhones[0] || g.primary.candidatePhones[0],
          primaryWebsite: g.primary.verifiedWebsite || g.primary.candidateWebsites[0],
          primaryCity: g.primary.cityHint,
          primaryCategory: g.primary.categoryHint,
          mergeConfidence: Math.round(g.mergeConfidence * 100),
          sources: g.sources,
          duplicateCount: g.duplicates.length,
          duplicates: g.duplicates.map(d => ({
            name: d.businessNameHint || d.nameHint || "",
            source: d.source,
            url: d.url,
            phone: d.verifiedPhones[0] || d.candidatePhones[0],
          })),
          // نمرر المرشحين الكاملين (مشفرين) للاستخدام في getMergePreview
          _candidatesJson: JSON.stringify([g.primary, ...g.duplicates]),
        })),
        singles: singles.map(g => ({
          name: g.primary.businessNameHint || g.primary.nameHint || "",
          source: g.primary.source,
          url: g.primary.url,
          phone: g.primary.verifiedPhones[0] || g.primary.candidatePhones[0],
          website: g.primary.verifiedWebsite || g.primary.candidateWebsites[0],
          city: g.primary.cityHint,
          category: g.primary.categoryHint,
          _candidateJson: JSON.stringify(g.primary),
        })),
        stats: {
          totalCandidates: candidates.length,
          totalGroups: groups.length,
          mergedCount: candidates.length - resolvedGroups.length,
        },
        // AI Enrichment Summary
        aiEnrichment: aiEnrichmentSummary ? {
          totalProcessed: aiEnrichmentSummary.totalProcessed,
          successCount: aiEnrichmentSummary.successCount,
          failureCount: aiEnrichmentSummary.failureCount,
          fieldsExtracted: aiEnrichmentSummary.fieldsExtracted,
          processingMs: aiEnrichmentSummary.processingMs,
        } : null,
        // Identity Integrity Gate Summary
        identityGate: {
          passedCount: batchGateResult.passedCount,
          blockedCount: batchGateResult.blockedCount,
          reviewCount: batchGateResult.reviewCount,
          summary: batchGateResult.summary,
          // تفاصيل المرشحين غير المستقرين للعرض في الواجهة
          unstableItems: batchGateResult.results
            .filter(r => r.integrityResult.status === "identity_unstable")
            .map(r => ({
              candidateId: r.id,
              userMessage: r.integrityResult.userMessage,
              conflictingFields: r.conflictDetails.map(cf => ({
                fieldName: cf.fieldName,
                fieldLabel: cf.fieldLabel,
                severity: cf.severity,
                values: cf.values.map(v => ({
                  value: v.value,
                  source: v.source,
                  sourceLabel: v.sourceLabel,
                  confidence: v.confidence,
                  rawOrigin: v.rawOrigin,
                })),
              })),
            })),
        },
        // Phase B: Diagnostic trace لكل منصة
        diagnostics: Object.entries(platformDiagnostics).map(([platform, d]) => ({
          platform,
          rawCount: d.rawCount,
          parsedCount: d.parsedCount,
          withPhone: d.withPhone,
          withWebsite: d.withWebsite,
          withUsername: d.withUsername,
          withCity: d.withCity,
          dataQuality: d.parsedCount === 0 ? "empty" :
            (d.withPhone / d.parsedCount) > 0.3 ? "rich" :
            (d.withUsername / d.parsedCount) > 0.5 ? "moderate" : "sparse",
        })),
      };
    }),

  /**
   * getMergePreview — Compare → Preview
   * يأخذ مجموعة مرشحين (مُمررة من groupCandidates) ويبني BusinessLead موحد
   * بدون حفظ في قاعدة البيانات — للمعاينة فقط.
   */
  getMergePreview: protectedProcedure
    .input(
      z.object({
        candidatesJson: z.string(), // JSON.stringify(DiscoveryCandidate[])
      })
    )
    .mutation(async ({ input }) => {
      const { buildBusinessLeadFromGroup } = await import("../lib/identityLinkage.js");

      let candidates: DiscoveryCandidate[];
      try {
        candidates = JSON.parse(input.candidatesJson) as DiscoveryCandidate[];
      } catch {
        throw new Error("candidatesJson: invalid JSON");
      }

      if (!candidates.length) {
        throw new Error("candidatesJson: empty array");
      }

      // بناء ResolvedGroup من المرشحين
      const sorted = [...candidates].sort((a, b) => b.confidence - a.confidence);
      const group = {
        primary: sorted[0],
        duplicates: sorted.slice(1),
        mergeConfidence: sorted.reduce((s, c) => s + c.confidence, 0) / sorted.length,
        sources: Array.from(new Set(candidates.map(c => c.source))),
      };

      const lead = buildBusinessLeadFromGroup(group);

      // Phase D: fieldWinners — لكل حقل: القيمة الفائزة + مصدرها + قيم المنافسين
      type FieldWinner = {
        value: string | undefined;
        winnerSource: string;
        allValues: Array<{ source: string; value: string }>;
        confidence: "verified" | "candidate" | "inferred";
      };

      const buildFieldWinner = (
        field: string,
        extractor: (c: DiscoveryCandidate) => string | undefined,
        confidenceLevel: "verified" | "candidate" | "inferred" = "inferred"
      ): FieldWinner => {
        const allValues: Array<{ source: string; value: string }> = [];
        for (const c of candidates) {
          const v = extractor(c);
          if (v) allValues.push({ source: c.source, value: v });
        }
        const winner = allValues[0];
        return {
          value: winner?.value,
          winnerSource: winner?.source || "unknown",
          allValues,
          confidence: confidenceLevel,
        };
      };

      const fieldWinners: Record<string, FieldWinner> = {
        businessName: buildFieldWinner("businessName", c => c.businessNameHint || c.nameHint),
        phone: buildFieldWinner("phone", c => c.verifiedPhones[0], "verified"),
        candidatePhone: buildFieldWinner("candidatePhone", c => c.candidatePhones[0], "candidate"),
        website: buildFieldWinner("website", c => c.verifiedWebsite, "verified"),
        candidateWebsite: buildFieldWinner("candidateWebsite", c => c.candidateWebsites[0], "candidate"),
        city: buildFieldWinner("city", c => c.cityHint),
        category: buildFieldWinner("category", c => c.categoryHint),
        instagram: buildFieldWinner("instagram", c => c.source === "instagram" ? c.url : undefined, "verified"),
        tiktok: buildFieldWinner("tiktok", c => c.source === "tiktok" ? c.url : undefined, "verified"),
        snapchat: buildFieldWinner("snapchat", c => c.source === "snapchat" ? c.url : undefined, "verified"),
        x: buildFieldWinner("x", c => c.source === "x" ? c.url : undefined, "verified"),
        facebook: buildFieldWinner("facebook", c => c.source === "facebook" ? c.url : undefined, "verified"),
        linkedin: buildFieldWinner("linkedin", c => c.source === "linkedin" ? c.url : undefined, "verified"),
      };

      // Phase D: mergeSignals — إشارات الدمج المستخدمة
      const mergeSignals: Array<{ type: string; description: string; strength: "strong" | "moderate" | "weak" }> = [];
      const sourceArr = candidates.map(c => c.source);
      const sourceSet = Array.from(new Set(sourceArr));
      if (sourceSet.length > 1) {
        mergeSignals.push({ type: "multi_platform", description: `تم دمج ${sourceSet.length} منصات: ${sourceSet.join(", ")}`, strength: "strong" });
      }
      const phones = candidates.flatMap(c => [...c.verifiedPhones, ...c.candidatePhones]);
      const uniquePhones = Array.from(new Set(phones));
      if (uniquePhones.length > 0 && phones.length > uniquePhones.length) {
        mergeSignals.push({ type: "phone_match", description: `هاتف مشترك: ${uniquePhones[0]}`, strength: "strong" });
      }
      const names = candidates.map(c => c.businessNameHint || c.nameHint || "").filter(Boolean);
      if (names.length > 1) {
        mergeSignals.push({ type: "name_similarity", description: `تشابه الأسماء: ${names.slice(0, 3).join(" / ")}`, strength: "moderate" });
      }
      const usernameArr = candidates.map(c => c.usernameHint).filter((u): u is string => Boolean(u));
      const uniqueUsernames = Array.from(new Set(usernameArr));
      if (uniqueUsernames.length === 1 && candidates.length > 1) {
        mergeSignals.push({ type: "username_match", description: `username مشترك: @${uniqueUsernames[0]}`, strength: "strong" });
      }

      // fieldSources للتوافق مع الكود القديم
      const fieldSources: Record<string, string> = {};
      for (const [field, winner] of Object.entries(fieldWinners)) {
        if (winner.value) fieldSources[field] = winner.winnerSource;
      }

      return {
        lead,
        fieldSources,
        fieldWinners,
        mergeSignals,
        sourceCount: candidates.length,
        sources: group.sources,
        mergeConfidence: Math.round(group.mergeConfidence * 100),
      };
    }),

  /**
   * createFromMerge — Merge → Save
   * يأخذ مجموعة مرشحين ويبني BusinessLead موحد ويحفظه في قاعدة البيانات.
   * يُطبّق createLeadWithResolution للتحقق من التكرار تلقائياً.
   */
  createFromMerge: protectedProcedure
    .input(
      z.object({
        candidatesJson: z.string(), // JSON.stringify(DiscoveryCandidate[])
        // تجاوزات اختيارية من المستخدم
        overrides: z.object({
          companyName: z.string().optional(),
          businessType: z.string().optional(),
          city: z.string().optional(),
          phone: z.string().optional(),
          website: z.string().optional(),
          instagramUrl: z.string().optional(),
          tiktokUrl: z.string().optional(),
          snapchatUrl: z.string().optional(),
          twitterUrl: z.string().optional(),
          linkedinUrl: z.string().optional(),
          facebookUrl: z.string().optional(),
          googleMapsUrl: z.string().optional(),
        }).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { buildBusinessLeadFromGroup } = await import("../lib/identityLinkage.js");

      let candidates: DiscoveryCandidate[];
      try {
        candidates = JSON.parse(input.candidatesJson) as DiscoveryCandidate[];
      } catch {
        throw new Error("candidatesJson: invalid JSON");
      }

      if (!candidates.length) {
        throw new Error("candidatesJson: empty array");
      }

      // بناء ResolvedGroup
      const sorted = [...candidates].sort((a, b) => b.confidence - a.confidence);
      const group = {
        primary: sorted[0],
        duplicates: sorted.slice(1),
        mergeConfidence: sorted.reduce((s, c) => s + c.confidence, 0) / sorted.length,
        sources: Array.from(new Set(candidates.map(c => c.source))),
      };

      const lead = buildBusinessLeadFromGroup(group);
      const ov = input.overrides || {};

      // تطبيق التجاوزات
      const companyName = ov.companyName || lead.businessName;
      const businessType = ov.businessType || lead.category || "غير محدد";
      const city = ov.city || lead.city || "غير محدد";
      const phone = ov.phone || lead.verifiedPhones[0] || lead.candidatePhones[0] || undefined;
      const website = ov.website || lead.verifiedWebsite || lead.candidateWebsites[0] || undefined;

      // استخراج روابط السوشيال من المرشحين + التجاوزات
      const getSocialUrl = (platform: string): string | undefined => {
        const fromCandidates = candidates.find(c => c.source === platform)?.url;
        return fromCandidates || undefined;
      };

      const instagramUrl = ov.instagramUrl || getSocialUrl("instagram");
      const tiktokUrl = ov.tiktokUrl || getSocialUrl("tiktok");
      const snapchatUrl = ov.snapchatUrl || getSocialUrl("snapchat");
      // x/twitter: نبحث أولاً بـ "x" (canonical) ثم بـ "twitter" (legacy)
      const twitterUrl = ov.twitterUrl || getSocialUrl("x") || getSocialUrl("twitter");
      const linkedinUrl = ov.linkedinUrl || getSocialUrl("linkedin");
      const facebookUrl = ov.facebookUrl || getSocialUrl("facebook");
      const googleMapsUrl = ov.googleMapsUrl || getSocialUrl("maps");

      // بناء ملاحظة المصادر
      const sourcesNote = `[merged from: ${group.sources.join(", ")}] [confidence: ${Math.round(group.mergeConfidence * 100)}%]`;

      const id = await createLeadWithResolution({
        companyName,
        businessType,
        city,
        verifiedPhone: phone,
        website,
        instagramUrl,
        tiktokUrl,
        snapchatUrl,
        twitterUrl, // حقل DB يُسمى twitterUrl لكن source الرسمي هو "x"
        linkedinUrl,
        facebookUrl,
        googleMapsUrl,
        notes: sourcesNote,
      });

      // إذا كان مكرراً، أرجع status=duplicate بدلاً من throw حتى تتمكن الواجهة من عرض خيار التحديث
      if (id === null) {
        // اجلب معرّف العميل الموجود من قاعدة البيانات
        const { checkLeadDuplicate } = await import("../db");
        const dup = await checkLeadDuplicate(phone || "", companyName, website);
        return {
          status: "duplicate" as const,
          existingId: dup.candidateId,
          companyName,
          city,
          sources: group.sources,
          mergeConfidence: Math.round(group.mergeConfidence * 100),
          phone,
          website,
          duplicateReason: dup.reason,
        };
      }

      return {
        status: "created" as const,
        id,
        companyName,
        city,
        sources: group.sources,
        mergeConfidence: Math.round(group.mergeConfidence * 100),
        phone,
        website,
      };
    }),

  // ===== جلب نتيجة التقييم المحفوظة من DB =====
  getSavedScore: protectedProcedure
    .input(z.object({ leadId: z.number() }))
    .query(async ({ input }) => {
      const { getDb } = await import("../db");
      const { leads } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return null;
      const rows = await db
        .select({
          scoringValue: leads.scoringValue,
          scoringPriority: leads.scoringPriority,
          scoringReasons: leads.scoringReasons,
          scoringBreakdown: leads.scoringBreakdown,
          scoringOpportunities: leads.scoringOpportunities,
          scoringReadinessState: leads.scoringReadinessState,
          scoringRunAt: leads.scoringRunAt,
        })
        .from(leads)
        .where(eq(leads.id, input.leadId))
        .limit(1);
      const row = rows[0];
      if (!row || row.scoringValue == null) return null;
      // إعادة بناء النتيجة بنفس بنية scoreResult
      return {
        score: {
          value: row.scoringValue,
          priority: row.scoringPriority ?? "C",
          reasons: (row.scoringReasons as string[]) ?? [],
          breakdown: (row.scoringBreakdown as Record<string, number>) ?? {},
        },
        opportunities: (row.scoringOpportunities as any[]) ?? [],
        readinessState: row.scoringReadinessState ?? "partial",
        runAt: row.scoringRunAt,
      };
    }),
  // ─── seedFromRawBatch: تحويل نتائج بحث خام (batch) إلى leads في DB ─────────────────
  seedFromRawBatch: protectedProcedure
    .input(z.object({
      candidates: z.array(z.object({
        companyName: z.string(),
        businessType: z.string().optional(),
        city: z.string().optional(),
        country: z.string().optional(),
        verifiedPhone: z.string().optional(),
        website: z.string().optional(),
        instagramUrl: z.string().optional(),
        twitterUrl: z.string().optional(),
        snapchatUrl: z.string().optional(),
        tiktokUrl: z.string().optional(),
        facebookUrl: z.string().optional(),
        googleMapsUrl: z.string().optional(),
        reviewCount: z.number().optional(),
        notes: z.string().optional(),
        source: z.string().optional(),
      })),
      defaultBusinessType: z.string().optional(),
      defaultCity: z.string().optional(),
      defaultCountry: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const results = { added: 0, duplicates: 0, failed: 0, ids: [] as number[] };
      for (const candidate of input.candidates) {
        try {
          const leadId = await createLeadWithResolution({
            companyName: candidate.companyName,
            businessType: candidate.businessType || input.defaultBusinessType || "غير محدد",
            city: candidate.city || input.defaultCity || "غير محدد",
            country: candidate.country || input.defaultCountry || "السعودية",
            verifiedPhone: candidate.verifiedPhone || null,
            website: candidate.website || null,
            instagramUrl: candidate.instagramUrl || null,
            twitterUrl: candidate.twitterUrl || null,
            snapchatUrl: candidate.snapchatUrl || null,
            tiktokUrl: candidate.tiktokUrl || null,
            facebookUrl: candidate.facebookUrl || null,
            googleMapsUrl: candidate.googleMapsUrl || null,
            reviewCount: candidate.reviewCount || 0,
            notes: candidate.notes || null,
            analysisStatus: "pending",
          });
          if (leadId) {
            results.added++;
            results.ids.push(leadId);
          } else {
            results.duplicates++;
          }
        } catch {
          results.failed++;
        }
      }
      return results;
    }),

  // ─── parseBio: تحليل البايو بـ AI واستخراج بيانات النشاط ───────────────────────
  parseBio: protectedProcedure
    .input(z.object({
      bio: z.string().min(5).max(3000),
    }))
    .mutation(async ({ input }) => {
      const { invokeLLM } = await import("../_core/llm");
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `أنت محلل بيانات متخصص في استخراج معلومات الأنشطة التجارية السعودية من النصوص والبيو.
مهمتك استخراج كل معلومة ممكنة من النص المُدخل وإرجاعها بصيغة JSON دقيقة.
إذا لم تجد معلومة معينة، أرجع null لذلك الحقل.
لا تخترع بيانات غير موجودة في النص.`,
          },
          {
            role: "user",
            content: `حلّل هذا النص واستخرج بيانات النشاط التجاري:\n\n${input.bio}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "bio_extraction",
            strict: true,
            schema: {
              type: "object",
              properties: {
                companyName: { type: ["string", "null"], description: "اسم النشاط التجاري" },
                businessType: { type: ["string", "null"], description: "نوع النشاط (مطعم، صالون، ملحمة...)" },
                city: { type: ["string", "null"], description: "المدينة" },
                district: { type: ["string", "null"], description: "الحي أو المنطقة" },
                verifiedPhone: { type: ["string", "null"], description: "رقم الهاتف بصيغة +966..." },
                website: { type: ["string", "null"], description: "رابط الموقع الإلكتروني" },
                instagramUrl: { type: ["string", "null"], description: "رابط أو اسم حساب إنستغرام" },
                twitterUrl: { type: ["string", "null"], description: "رابط أو اسم حساب تويتر" },
                snapchatUrl: { type: ["string", "null"], description: "رابط أو اسم حساب سناب شات" },
                tiktokUrl: { type: ["string", "null"], description: "رابط أو اسم حساب تيك توك" },
                facebookUrl: { type: ["string", "null"], description: "رابط أو اسم حساب فيسبوك" },
                notes: { type: ["string", "null"], description: "ملاحظات إضافية مستخرجة من النص" },
                confidence: { type: "number", description: "نسبة الثقة في الاستخراج من 0 إلى 100" },
                extractedFields: { type: "array", items: { type: "string" }, description: "أسماء الحقول التي تم استخراجها بنجاح" },
              },
              required: ["companyName", "businessType", "city", "district", "verifiedPhone", "website", "instagramUrl", "twitterUrl", "snapchatUrl", "tiktokUrl", "facebookUrl", "notes", "confidence", "extractedFields"],
              additionalProperties: false,
            },
          },
        } as any,
      });
      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error("لم يتم استخراج البيانات");
      const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
      // تنظيف أرقام الهاتف
      if (parsed.verifiedPhone) {
        const cleaned = parsed.verifiedPhone.replace(/[\s\-()]/g, "");
        parsed.verifiedPhone = cleaned.startsWith("05") ? `+966${cleaned.slice(1)}` : cleaned;
      }
      // تنظيف روابط السوشيال ميديا
      const socialFields = ["instagramUrl", "twitterUrl", "snapchatUrl", "tiktokUrl", "facebookUrl"];
      const socialPrefixes: Record<string, string> = {
        instagramUrl: "https://instagram.com/",
        twitterUrl: "https://twitter.com/",
        snapchatUrl: "https://snapchat.com/add/",
        tiktokUrl: "https://tiktok.com/@",
        facebookUrl: "https://facebook.com/",
      };
      for (const field of socialFields) {
        if (parsed[field] && !parsed[field].startsWith("http")) {
          const username = parsed[field].replace(/^@/, "");
          parsed[field] = `${socialPrefixes[field]}${username}`;
        }
      }
      return parsed;
    }),

  // ─── checkDuplicateBatch: فحص مجموعة نتائج بحث ضد قاعدة البيانات ────────────
  checkDuplicateBatch: protectedProcedure
    .input(z.array(z.object({
      id: z.string(),                          // معرّف النتيجة (من البحث)
      companyName: z.string().optional(),
      phone: z.string().optional(),
      website: z.string().optional(),
    })).max(200))
    .mutation(async ({ input }) => {
      const { checkLeadDuplicate } = await import("../db");
      const results: Record<string, { isDuplicate: boolean; existingLeadId: number | null; reason: string }> = {};

      for (const item of input) {
        try {
          const dup = await checkLeadDuplicate(
            item.phone || "",
            item.companyName || "",
            item.website
          );
          results[item.id] = {
            isDuplicate: dup.isDuplicate,
            existingLeadId: dup.candidateId,
            reason: dup.reason,
          };
        } catch {
          results[item.id] = { isDuplicate: false, existingLeadId: null, reason: "check_failed" };
        }
      }

      return results;
    }),
});
// ────────────────────────────────────────────────────────────────────────────────
export { leadIntelligenceRouter };
