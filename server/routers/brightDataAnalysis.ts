/**
 * Bright Data Analysis Router
 * تحليل حقيقي للمواقع والمنصات الاجتماعية باستخدام Bright Data
 * يجلب البيانات الحقيقية أولاً ثم يمررها للـ LLM
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "../_core/llm";
import {
  scrapeWebsite,
  scrapeInstagram,
  scrapeLinkedIn,
  scrapeTwitter,
  scrapeTikTok,
  scrapeAllPlatforms,
  formatScrapedDataForLLM,
  type TwitterScrapedData,
} from "../lib/brightDataScraper";
import {
  gatherWebsiteIntelligence,
  buildWebsiteIntelligenceContext,
} from "../lib/websiteIntelligence";
import { takeWebsiteScreenshot, takeSocialMediaScreenshot } from "../lib/headlessScraper";
import { storagePut } from "../storage";
import {
  fetchInstagramViaDatasetAPI,
  formatInstagramDataForLLM,
  type InstagramDatasetProfile,
} from "../lib/brightDataInstagram";
import {
  analyzeLinkedInCompany,
  buildLinkedInSearchUrl,
  type LinkedInCompanyData,
} from "../lib/brightDataLinkedIn";
import {
  getLeadById,
  updateLead,
  createWebsiteAnalysis,
  createSocialAnalysis,
  createSeoAdvancedAnalysis,
  getWebsiteAnalysisByLeadId,
  getSocialAnalysesByLeadId,
  getDb,
} from "../db";
import { leads } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

// ===== تحليل الموقع الإلكتروني بـ Bright Data =====
const analyzeWebsiteWithBrightData = protectedProcedure
  .input(z.object({
    leadId: z.number(),
    url: z.string().url(),
    companyName: z.string(),
    businessType: z.string(),
  }))
  .mutation(async ({ input }) => {
    await updateLead(input.leadId, { analysisStatus: "analyzing" });

    try {
      // الخطوة 1: جلب بيانات الموقع الشاملة (PageSpeed + SEO + Bright Data)
      let realWebsiteContext = "";
      let scrapedPhones: string[] = [];
      let scrapedFlags = {
        hasWhatsapp: false,
        hasBooking: false,
        hasEcommerce: false,
        hasSSL: false,
      };
      let pagespeedScores = {
        performance: null as number | null,
        mobile: null as number | null,
        seo: null as number | null,
        accessibility: null as number | null,
        bestPractices: null as number | null,
        lcp: null as number | null,
        cls: null as number | null,
        fcp: null as number | null,
        ttfb: null as number | null,
      };

      try {
        // جلب كل البيانات بالتوازي: PageSpeed + SEO Intelligence
        const intelligence = await gatherWebsiteIntelligence(input.url);
        realWebsiteContext = buildWebsiteIntelligenceContext(intelligence);

        // استخراج البيانات للحفظ في قاعدة البيانات
        if (intelligence.seo.fetchedSuccessfully) {
          scrapedPhones = intelligence.seo.phones;
          scrapedFlags = {
            hasWhatsapp: intelligence.seo.hasWhatsapp,
            hasBooking: intelligence.seo.hasBooking,
            hasEcommerce: intelligence.seo.hasEcommerce,
            hasSSL: intelligence.seo.hasSSL,
          };
          // حفظ الرقم المكتشف تلقائياً
          if (intelligence.seo.phones.length > 0) {
            const lead = await getLeadById(input.leadId);
            if (lead && !lead.verifiedPhone) {
              await updateLead(input.leadId, { verifiedPhone: intelligence.seo.phones[0] });
            }
          }
        }

        if (intelligence.pagespeed.fetchedSuccessfully) {
          pagespeedScores = {
            performance: intelligence.pagespeed.performanceScore,
            mobile: intelligence.pagespeed.mobilePerformanceScore,
            seo: intelligence.pagespeed.seoScore,
            accessibility: intelligence.pagespeed.accessibilityScore,
            bestPractices: intelligence.pagespeed.bestPracticesScore,
            lcp: intelligence.pagespeed.lcp,
            cls: intelligence.pagespeed.cls,
            fcp: intelligence.pagespeed.fcp,
            ttfb: intelligence.pagespeed.ttfb,
          };
        }
      } catch (scrapeErr) {
        console.warn("[BD analyzeWebsite] Intelligence gathering failed, using AI estimation:", scrapeErr);
      }

      // الخطوة 1.5 + 2: أخذ Screenshot وتحليل LLM بالتوازي تماماً لتوفير 25+ ثانية
      const screenshotPromise = (async (): Promise<string | undefined> => {
        try {
          const screenshotBuffer = await takeWebsiteScreenshot(input.url, 25000);
          if (screenshotBuffer) {
            const key = `website-screenshots/${input.leadId}-${Date.now()}.png`;
            const { url: s3Url } = await storagePut(key, screenshotBuffer, "image/png");
            console.log(`[Screenshot] Saved: ${s3Url}`);
            return s3Url;
          }
        } catch (ssErr: any) {
          console.warn("[Screenshot] Failed (non-blocking):", ssErr?.message);
        }
        return undefined;
      })();

      // الخطوة 2: تحليل بـ LLM مع البيانات الحقيقية
      const hasRealPagespeed = pagespeedScores.performance !== null;
      const prompt = `أنت خبير تحليل تسويق رقمي متخصص في السوق السعودي.
قم بتحليل الموقع الإلكتروني التالي لنشاط تجاري سعودي:
- اسم النشاط: ${input.companyName}
- نوع النشاط: ${input.businessType}
- رابط الموقع: ${input.url}
${realWebsiteContext}

تعليمات خاصة بالدرجات:
${hasRealPagespeed ? `- درجة سرعة الموقع (Desktop) من Google PageSpeed: ${pagespeedScores.performance}/100 → حولها إلى مقياس 1-10
- درجة سرعة الجوال: ${pagespeedScores.mobile}/100 → حولها إلى مقياس 1-10
- درجة SEO من PageSpeed: ${pagespeedScores.seo}/100 → حولها إلى مقياس 1-10
- درجة إمكانية الوصول: ${pagespeedScores.accessibility}/100
- درجة أفضل الممارسات: ${pagespeedScores.bestPractices}/100
- LCP (Largest Contentful Paint): ${pagespeedScores.lcp ? pagespeedScores.lcp.toFixed(1) + 'ث' : 'N/A'}
- CLS (Cumulative Layout Shift): ${pagespeedScores.cls ?? 'N/A'}
- FCP (First Contentful Paint): ${pagespeedScores.fcp ? pagespeedScores.fcp.toFixed(1) + 'ث' : 'N/A'}
- TTFB (Time to First Byte): ${pagespeedScores.ttfb ? pagespeedScores.ttfb.toFixed(0) + 'ملث' : 'N/A'}
استخدم هذه الأرقام الحقيقية لتحديد loadSpeedScore و mobileExperienceScore و seoScore.` : '- لا تتوفر بيانات PageSpeed حقيقية — قدّر الدرجات بناءً على محتوى الموقع.'}

قواعد صارمة يجب الالتزام بها:
⛔ إذا كانت البيانات أعلاه تُظهر أن الميزة موجودة (✅)، فلا تذكرها أبداً كثغرة أو توصية أو نقطة ضعف.
⛔ إذا كان الموقع يملك بوابة دفع (✅ بوابة دفع)، لا تقل أنه يحتاج وسائل دفع.
⛔ إذا كان الموقع يملك حجز/مواعيد (✅ حجز/مواعيد)، لا تقل أنه يحتاج نظام حجز.
⛔ إذا كان الموقع يملك تجارة إلكترونية (✅ تجارة إلكترونية)، لا تقل أنه يحتاج متجراً إلكترونياً.
✅ ركز الثغرات والتوصيات على ما هو غائب فعلاً (❌) أو ضعيف في الدرجات.
✅ biggestMarketingGap يجب أن تكون ثغرة حقيقية غير موجودة في الموقع، مبنية على البيانات الفعلية.

قواعد إضافية للـ summary والتوصيات:
⛔ لا تذكر في الـ summary أي ميزة موجودة (✅) كفرصة للتحسين أو نقطة ضعف.
⛔ لا تقل "يمكن تحسين الحجز" إذا كان الحجز ✅ موجوداً.
⛔ لا تقل "يمكن إضافة وسائل دفع" إذا كانت بوابة الدفع ✅ موجودة.
✅ الـ summary يجب أن يذكر نقاط القوة الحقيقية الموجودة (✅) ثم الثغرات الحقيقية الغائبة (❌) فقط.
✅ biggestMarketingGap يجب أن تكون ميزة ❌ غائبة فعلاً، وليست ميزة ✅ موجودة.

قدم تحليلاً شاملاً بصيغة JSON فقط (بدون أي نص خارج JSON) وفق الهيكل التالي:
{
  "hasWebsite": true,
  "loadSpeedScore": 7,
  "mobileExperienceScore": 6,
  "seoScore": 5,
  "contentQualityScore": 6,
  "designScore": 7,
  "offerClarityScore": 5,
  "hasSeasonalPage": false,
  "hasOnlineBooking": true,
  "hasPaymentOptions": true,
  "hasDeliveryInfo": false,
  "technicalGaps": ["ثغرة تقنية حقيقية غائبة ❌ عن الموقع فعلاً"],
  "contentGaps": ["ثغرة محتوى حقيقية غائبة ❌ عن الموقع فعلاً"],
  "overallScore": 6,
  "summary": "ملخص يذكر نقاط القوة الحقيقية الموجودة ✅ ثم الثغرات الغائبة ❌ فقط — لا يذكر ميزة موجودة كنقطة ضعف",
  "recommendations": ["توصية لميزة غائبة ❌ فعلاً", "توصية 2 لميزة غائبة ❌", "توصية 3"],
  "biggestMarketingGap": "الثغرة الأكبر الحقيقية الغائبة ❌ فعلاً عن الموقع في سطرين على الأقل — لا تذكر ميزة موجودة ✅",
  "revenueOpportunity": "كيف يمكن زيادة الإيراد بناءً على ما هو غائب ❌ فعلاً وليس ما هو موجود ✅",
  "suggestedSalesEntryAngle": "زاوية الدخول البيعية المخصصة لهذا النشاط تحديداً"
}
${realWebsiteContext ? "تذكير: لديك بيانات حقيقية شاملة من الموقع — استخدمها لتقديم تحليل دقيق. لا تقترح ميزة موجودة بالفعل (✅) كثغرة أو توصية." : "ملاحظة: قيّم الموقع بناءً على المعرفة العامة بمواقع هذا النوع من الأنشطة في السعودية."}`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "أنت محلل تسويق رقمي خبير. أجب دائماً بـ JSON صحيح فقط. قاعدة أساسية: لا تقترح أبداً ميزة كثغرة إذا كانت البيانات تُظهر أنها موجودة بالفعل (✅). الثغرات يجب أن تكون حقيقية وغائبة فعلاً." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" } as any,
      });

      const rawContent = response.choices[0]?.message?.content;
      const content = typeof rawContent === "string" ? rawContent : "{}";
      let analysis: any = {};
      try { analysis = JSON.parse(content); } catch { analysis = {}; }

      // دمج البيانات الحقيقية مع تحليل AI
      analysis.hasOnlineBooking = analysis.hasOnlineBooking || scrapedFlags.hasBooking;
      analysis.hasPaymentOptions = analysis.hasPaymentOptions || scrapedFlags.hasEcommerce;

      // انتظار Screenshot (كان يعمل بالتوازي مع LLM)
      const screenshotUrl = await screenshotPromise;

      const analysisId = await createWebsiteAnalysis({
        leadId: input.leadId,
        url: input.url,
        hasWebsite: analysis.hasWebsite ?? true,
        loadSpeedScore: analysis.loadSpeedScore,
        mobileExperienceScore: analysis.mobileExperienceScore,
        seoScore: analysis.seoScore,
        contentQualityScore: analysis.contentQualityScore,
        designScore: analysis.designScore,
        offerClarityScore: analysis.offerClarityScore,
        hasSeasonalPage: analysis.hasSeasonalPage ?? false,
        hasOnlineBooking: analysis.hasOnlineBooking ?? false,
        hasPaymentOptions: analysis.hasPaymentOptions ?? false,
        hasDeliveryInfo: analysis.hasDeliveryInfo ?? false,
        technicalGaps: analysis.technicalGaps ?? [],
        contentGaps: analysis.contentGaps ?? [],
        overallScore: analysis.overallScore,
        summary: analysis.summary,
        recommendations: analysis.recommendations ?? [],
        rawAnalysis: content,
        screenshotUrl,
      });

      await updateLead(input.leadId, {
        analysisStatus: "completed",
        biggestMarketingGap: analysis.biggestMarketingGap,
        revenueOpportunity: analysis.revenueOpportunity,
        suggestedSalesEntryAngle: analysis.suggestedSalesEntryAngle,
        brandingQualityScore: analysis.designScore,
        leadPriorityScore: analysis.overallScore,
        // تحديث مؤشرات جاهزية التحليل
        analysisReadyFlag: true,
        analysisConfidenceScore: Math.min(1, (analysis.overallScore ?? 5) / 10),
        partialAnalysisFlag: false,
      });

      return {
        success: true,
        analysisId,
        scrapedPhones,
        usedRealData: !!realWebsiteContext,
      };
    } catch (error) {
      await updateLead(input.leadId, { analysisStatus: "failed" });
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "فشل التحليل" });
    }
  });

// ===== تحليل إنستغرام بـ Bright Data =====
const analyzeInstagramWithBrightData = protectedProcedure
  .input(z.object({
    leadId: z.number(),
    profileUrl: z.string(),
    companyName: z.string(),
    businessType: z.string(),
  }))
  .mutation(async ({ input }) => {
    try {
      // جلب البيانات الحقيقية
      let realData = "";
      let instagramStats = { followersCount: 0, postsCount: 0, isVerified: false };
      let datasetProfile: InstagramDatasetProfile | undefined;
      let dataSource = "none";

      // المحاولة الأولى: Dataset API (الأكثر موثوقية)
      try {
        console.log(`[BD Instagram] Trying Dataset API for ${input.profileUrl}`);
        const datasetResult = await fetchInstagramViaDatasetAPI(input.profileUrl);
        if (datasetResult.success && datasetResult.profile) {
          datasetProfile = datasetResult.profile;
          realData = formatInstagramDataForLLM(datasetProfile);
          instagramStats = {
            followersCount: datasetProfile.followers || 0,
            postsCount: datasetProfile.posts_count || 0,
            isVerified: datasetProfile.is_verified || false,
          };
          dataSource = "dataset_api";
          console.log(`[BD Instagram] Dataset API success: ${instagramStats.followersCount} followers`);
        } else {
          console.warn(`[BD Instagram] Dataset API failed: ${datasetResult.error}, trying scraper...`);
        }
      } catch (datasetErr) {
        console.warn(`[BD Instagram] Dataset API error: ${datasetErr}, trying scraper...`);
      }

      // المحاولة الثانية: Scraping Browser (fallback)
      if (!realData) {
        try {
          const scraped = await scrapeInstagram(input.profileUrl);
          if (scraped.loadedSuccessfully) {
            realData = `
=== بيانات إنستغرام الحقيقية (Bright Data Scraper) ===
الاسم الكامل: ${scraped.fullName}
البيو: ${scraped.bio}
المتابعون: ${scraped.followersCount.toLocaleString()}
يتابع: ${scraped.followingCount.toLocaleString()}
عدد المنشورات: ${scraped.postsCount}
موثّق: ${scraped.isVerified ? "نعم ✓" : "لا"}
=== نهاية البيانات الحقيقية ===`;

            instagramStats = {
              followersCount: scraped.followersCount,
              postsCount: scraped.postsCount,
              isVerified: scraped.isVerified,
            };
            dataSource = "scraper";
          }
        } catch (scrapeErr) {
          console.warn("[BD analyzeInstagram] Scrape also failed:", scrapeErr);
        }
      }

      const prompt = `أنت خبير تحليل سوشيال ميديا ومصمم جرافيك ومحلل نصوص تسويقية متخصص في السوق السعودي.
قم بتحليل حساب إنستغرام التالي تحليلاً عميقاً شاملاً:
- اسم النشاط: ${input.companyName}
- نوع النشاط: ${input.businessType}
- رابط الحساب: ${input.profileUrl}
${realData}

قدم تحليلاً بصيغة JSON فقط (بدون أي نص خارج JSON):
{
  "hasAccount": true,
  "followersCount": ${instagramStats.followersCount || 0},
  "postsCount": ${instagramStats.postsCount || 0},
  "isVerified": ${instagramStats.isVerified},
  "postingFrequencyScore": 6,
  "engagementScore": 5,
  "contentQualityScore": 6,
  "hasSeasonalContent": false,
  "hasPricingContent": false,
  "hasCallToAction": false,
  "contentStrategyScore": 5,
  "digitalPresenceScore": 6,
  "gaps": ["ثغرة حقيقية من البيانات"],
  "overallScore": 5.5,
  "summary": "ملخص تحليلي في سطرين بناءً على البيانات الحقيقية",
  "recommendations": ["توصية 1", "توصية 2", "توصية 3"],
  "designQuality": {
    "score": 6,
    "colorConsistency": "هل الألوان متناسقة ومعبّرة عن الهوية البصرية للنشاط؟ وصف تفصيلي",
    "visualIdentity": "هل يوجد هوية بصرية واضحة (لوجو، خطوط، ألوان ثابتة)؟ وصف تفصيلي",
    "imageQuality": "جودة الصور والتصاميم المستخدمة (احترافية، هاتف، مصمم، إلخ)",
    "brandingStrength": "قوة الهوية التجارية البصرية من 1-10",
    "weaknesses": ["نقطة ضعف تصميمية 1", "نقطة ضعف تصميمية 2"],
    "improvements": ["تحسين تصميمي مقترح 1", "تحسين تصميمي مقترح 2"]
  },
  "copyQuality": {
    "score": 6,
    "bioAnalysis": "تحليل البايو: هل يوضح ما يقدمه النشاط؟ هل يحتوي CTA؟ هل يذكر الموقع؟",
    "captionStyle": "أسلوب الكابشن: رسمي، عامي، ترويجي، تعليمي، إلخ",
    "ctaStrength": "قوة الـ CTA في المنشورات (ضعيف/متوسط/قوي) مع وصف",
    "languageClarity": "وضوح اللغة والرسائل التسويقية",
    "emotionalConnection": "هل النصوص تخلق ارتباطاً عاطفياً مع الجمهور؟",
    "weaknesses": ["ضعف نصي 1", "ضعف نصي 2"],
    "improvements": ["تحسين نصي مقترح 1", "تحسين نصي مقترح 2"]
  },
  "missedOpportunities": {
    "lostCustomerReasons": ["سبب خسارة عميل محتمل 1", "سبب خسارة عميل محتمل 2", "سبب خسارة عميل محتمل 3"],
    "conversionBarriers": ["عائق تحويل 1", "عائق تحويل 2"],
    "missingFeatures": ["ميزة مفقودة 1 (مثل: رابط في البايو، هايلايتس، Reels)", "ميزة مفقودة 2"],
    "audienceGaps": "شريحة جمهور لا يتم استهدافها حالياً مع وصف تفصيلي",
    "competitiveWeakness": "أين يتفوق المنافسون على هذا الحساب؟",
    "urgentFixes": ["إصلاح عاجل 1 (أكبر فرصة ضائعة)", "إصلاح عاجل 2"]
  }
}
${realData ? "ملاحظة: لديك بيانات حقيقية من الحساب — استخدمها لتقديم تحليل دقيق وعميق." : "ملاحظة: قيّم الحساب بناءً على المعرفة العامة بحسابات هذا النوع من الأنشطة في السعودية."}`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "أنت محلل سوشيال ميديا خبير. أجب دائماً بـ JSON صحيح فقط." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" } as any,
      });

      const rawContent = response.choices[0]?.message?.content;
      const content = typeof rawContent === "string" ? rawContent : "{}";
      let analysis: any = {};
      try { analysis = JSON.parse(content); } catch { analysis = {}; }

      // تأكد من استخدام الأرقام الحقيقية
      if (instagramStats.followersCount > 0) {
        analysis.followersCount = instagramStats.followersCount;
      }

      const analysisId = await createSocialAnalysis({
        leadId: input.leadId,
        platform: "instagram",
        profileUrl: input.profileUrl,
        hasAccount: analysis.hasAccount ?? true,
        postingFrequencyScore: analysis.postingFrequencyScore,
        engagementScore: analysis.engagementScore,
        contentQualityScore: analysis.contentQualityScore,
        hasSeasonalContent: analysis.hasSeasonalContent ?? false,
        hasPricingContent: analysis.hasPricingContent ?? false,
        hasCallToAction: analysis.hasCallToAction ?? false,
        contentStrategyScore: analysis.contentStrategyScore,
        digitalPresenceScore: analysis.digitalPresenceScore,
        gaps: analysis.gaps ?? [],
        overallScore: analysis.overallScore,
        summary: analysis.summary,
        recommendations: analysis.recommendations ?? [],
        rawAnalysis: content,
      });

      // تحديث بيانات الـ lead ببيانات إنستغرام الحقيقية
      if (datasetProfile?.business_phone) {
        const lead = await getLeadById(input.leadId);
        if (lead && !lead.verifiedPhone) {
          await updateLead(input.leadId, { verifiedPhone: datasetProfile.business_phone });
        }
      }

      return {
        success: true,
        analysisId,
        usedRealData: !!realData,
        dataSource,
        followersCount: instagramStats.followersCount,
        postsCount: instagramStats.postsCount,
        isVerified: instagramStats.isVerified,
        businessEmail: datasetProfile?.business_email || null,
        businessPhone: datasetProfile?.business_phone || null,
        businessCategory: datasetProfile?.business_category || null,
        avgEngagement: datasetProfile?.avg_engagement || null,
        website: datasetProfile?.website || null,
      };
    } catch (error) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "فشل تحليل إنستغرام" });
    }
  });

// ===== تحليل لينكد إن بـ Bright Data =====
const analyzeLinkedInWithBrightData = protectedProcedure
  .input(z.object({
    leadId: z.number(),
    profileUrl: z.string(),
    companyName: z.string(),
    businessType: z.string(),
  }))
  .mutation(async ({ input }) => {
    try {
      // ===== المحاولة الأولى: Bright Data LinkedIn Companies API =====
      let linkedinApiResult = await analyzeLinkedInCompany(
        input.profileUrl,
        input.companyName
      );

      // إذا فشل API، حاول بناء URL من اسم الشركة
      if (!linkedinApiResult.success && input.companyName) {
        const guessedUrl = buildLinkedInSearchUrl(input.companyName);
        console.log(`[BD analyzeLinkedIn] Trying guessed URL: ${guessedUrl}`);
        linkedinApiResult = await analyzeLinkedInCompany(guessedUrl, input.companyName);
      }

      const companyData = linkedinApiResult.companyData;
      const dataSource = linkedinApiResult.dataSource;

      // بناء context للـ LLM من البيانات الحقيقية
      let realData = "";
      if (linkedinApiResult.success && companyData) {
        realData = `
=== بيانات لينكد إن الحقيقية (Bright Data ${dataSource === "api" ? "Companies API" : "Scraper"}) ===
اسم الشركة: ${companyData.name || input.companyName}
الوصف: ${(companyData.about || companyData.description || "").slice(0, 500)}
الشعار: ${companyData.slogan || ""}
المتابعون: ${(companyData.followers || 0).toLocaleString()}
الموظفون على LinkedIn: ${companyData.employees_in_linkedin || companyData.employees || "غير محدد"}
حجم الشركة: ${companyData.company_size || "غير محدد"}
القطاع: ${companyData.industries?.join(", ") || "غير محدد"}
المقر الرئيسي: ${companyData.headquarters || ""}
تأسست: ${companyData.founded || ""}
نوع المنظمة: ${companyData.organization_type || ""}
التخصصات: ${companyData.specialties?.slice(0, 5).join(", ") || ""}
الموقع: ${companyData.website || ""}
=== نهاية البيانات الحقيقية ===`;
      }

      const linkedinStats = {
        followersCount: linkedinApiResult.followersCount,
        employeesCount: linkedinApiResult.employeesCount > 0
          ? linkedinApiResult.employeesCount.toLocaleString()
          : (companyData?.company_size || "غير محدد"),
        industry: linkedinApiResult.industry || companyData?.industries?.[0] || "غير محدد",
      };

      const prompt = `أنت خبير تحليل سوشيال ميديا B2B متخصص في السوق السعودي.
قم بتحليل حساب لينكد إن التالي:
- اسم النشاط: ${input.companyName}
- نوع النشاط: ${input.businessType}
- رابط الحساب: ${input.profileUrl}
${realData}

قدم تحليلاً بصيغة JSON فقط:
{
  "hasAccount": true,
  "followersCount": ${linkedinStats.followersCount || 0},
  "employeesCount": "${linkedinStats.employeesCount}",
  "industry": "${linkedinStats.industry}",
  "postingFrequencyScore": 5,
  "engagementScore": 4,
  "contentQualityScore": 5,
  "hasSeasonalContent": false,
  "hasPricingContent": false,
  "hasCallToAction": false,
  "contentStrategyScore": 4,
  "digitalPresenceScore": 5,
  "gaps": ["ثغرة حقيقية من البيانات"],
  "overallScore": 5,
  "summary": "ملخص تحليلي في سطرين",
  "recommendations": ["توصية 1", "توصية 2", "توصية 3"]
}`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "أنت محلل سوشيال ميديا خبير. أجب دائماً بـ JSON صحيح فقط." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" } as any,
      });

      const rawContent = response.choices[0]?.message?.content;
      const content = typeof rawContent === "string" ? rawContent : "{}";
      let analysis: any = {};
      try { analysis = JSON.parse(content); } catch { analysis = {}; }

      const analysisId = await createSocialAnalysis({
        leadId: input.leadId,
        platform: "linkedin" as any,
        profileUrl: input.profileUrl,
        hasAccount: analysis.hasAccount ?? true,
        postingFrequencyScore: analysis.postingFrequencyScore,
        engagementScore: analysis.engagementScore,
        contentQualityScore: analysis.contentQualityScore,
        hasSeasonalContent: analysis.hasSeasonalContent ?? false,
        hasPricingContent: analysis.hasPricingContent ?? false,
        hasCallToAction: analysis.hasCallToAction ?? false,
        contentStrategyScore: analysis.contentStrategyScore,
        digitalPresenceScore: analysis.digitalPresenceScore,
        gaps: analysis.gaps ?? [],
        overallScore: analysis.overallScore,
        summary: analysis.summary,
        recommendations: analysis.recommendations ?? [],
        rawAnalysis: content,
      });

      return {
        success: true,
        analysisId,
        usedRealData: !!realData,
        dataSource,
        followersCount: linkedinStats.followersCount,
        employeesCount: linkedinStats.employeesCount,
        industry: linkedinStats.industry,
        headquarters: linkedinApiResult.headquarters,
        founded: linkedinApiResult.founded,
        companySize: linkedinApiResult.companySize,
        specialties: linkedinApiResult.specialties,
        about: linkedinApiResult.about,
        companyName: companyData?.name || input.companyName,
        organizationType: companyData?.organization_type,
        logo: companyData?.logo,
      };
    } catch (error) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "فشل تحليل لينكد إن" });
    }
  });

// ===== تحليل تويتر/X بـ Bright Data =====
const analyzeTwitterWithBrightData = protectedProcedure
  .input(z.object({
    leadId: z.number(),
    profileUrl: z.string(),
    companyName: z.string(),
    businessType: z.string(),
  }))
  .mutation(async ({ input }) => {
    try {
      let realData = "";
      let twitterStats: { followersCount: number; isVerified: boolean; tweetsCount?: number; following?: number; displayName?: string; bio?: string } = { followersCount: 0, isVerified: false };

      // أولاً: نحاول Bright Data API الرسمي (أكثر موثوقية)
      try {
        const { fetchTwitterData } = await import("./realSocialData");
        const apiData = await fetchTwitterData(input.profileUrl);
        if (apiData && apiData.followers > 0) {
          realData = `
=== بيانات تويتر/X الحقيقية (Bright Data API) ===
الاسم: ${apiData.displayName}
البيو: ${apiData.description}
المتابعون: ${apiData.followers.toLocaleString()}
يتابع: ${apiData.following.toLocaleString()}
عدد التغريدات: ${apiData.tweetsCount.toLocaleString()}
موثّق: ${apiData.isBlueVerified ? "نعم ✓ (Blue)" : apiData.verified ? "نعم ✓" : "لا"}
الموقع: ${apiData.location || "غير محدد"}
=== نهاية البيانات الحقيقية ===`;

          twitterStats = {
            followersCount: apiData.followers,
            isVerified: apiData.isBlueVerified || apiData.verified,
            tweetsCount: apiData.tweetsCount,
            following: apiData.following,
            displayName: apiData.displayName,
            bio: apiData.description,
          };
          console.log(`[BD analyzeTwitter] API success: ${apiData.followers} followers`);
        }
      } catch (apiErr) {
        console.warn("[BD analyzeTwitter] API failed, trying scraper:", apiErr);
      }

      // ثانياً: fallback إلى scraping إذا فشل API
      if (!realData) {
        try {
          const scraped = await scrapeTwitter(input.profileUrl);
          if (scraped.loadedSuccessfully && scraped.followersCount > 0) {
            realData = `
=== بيانات تويتر/X الحقيقية (Bright Data Scraper) ===
الاسم: ${scraped.displayName}
البيو: ${scraped.bio}
المتابعون: ${scraped.followersCount.toLocaleString()}
يتابع: ${scraped.followingCount.toLocaleString()}
موثّق: ${scraped.isVerified ? "نعم ✓" : "لا"}
=== نهاية البيانات الحقيقية ===`;

            twitterStats = {
              followersCount: scraped.followersCount,
              isVerified: scraped.isVerified,
            };
          }
        } catch (scrapeErr) {
          console.warn("[BD analyzeTwitter] Scrape also failed:", scrapeErr);
        }
      }

      const prompt = `أنت خبير تحليل سوشيال ميديا ومحلل هوية بصرية متخصص في السوق السعودي.
قم بتحليل حساب تويتر/X التالي تحليلاً عميقاً شاملاً:
- اسم النشاط: ${input.companyName}
- نوع النشاط: ${input.businessType}
- رابط الحساب: ${input.profileUrl}
${realData}

قدم تحليلاً بصيغة JSON فقط (بدون أي نص خارج JSON):
{
  "hasAccount": true,
  "followersCount": ${twitterStats.followersCount || 0},
  "isVerified": ${twitterStats.isVerified},
  "postingFrequencyScore": 5,
  "engagementScore": 4,
  "contentQualityScore": 5,
  "hasSeasonalContent": false,
  "hasPricingContent": false,
  "hasCallToAction": false,
  "contentStrategyScore": 4,
  "digitalPresenceScore": 5,
  "gaps": ["ثغرة حقيقية من البيانات"],
  "overallScore": 5,
  "summary": "ملخص تحليلي في سطرين",
  "recommendations": ["توصية 1", "توصية 2", "توصية 3"],
  "designQuality": {
    "score": 5,
    "colorConsistency": "هل الصورة الشخصية وصورة الغلاف تعكسان هوية بصرية متناسقة؟",
    "visualIdentity": "هل يوجد لوجو وهوية بصرية واضحة في الحساب؟",
    "imageQuality": "جودة الصور والوسائط المرفقة بالتغريدات",
    "brandingStrength": "قوة الهوية التجارية البصرية من 1-10",
    "weaknesses": ["نقطة ضعف تصميمية 1"],
    "improvements": ["تحسين تصميمي مقترح 1"]
  },
  "copyQuality": {
    "score": 5,
    "bioAnalysis": "تحليل البايو ووضوح رسالة الحساب",
    "captionStyle": "أسلوب التغريدات: رسمي، عامي، ترويجي، إلخ",
    "ctaStrength": "قوة الـ CTA في التغريدات",
    "languageClarity": "وضوح اللغة والرسائل التسويقية",
    "emotionalConnection": "هل النصوص تخلق ارتباطاً عاطفياً؟",
    "weaknesses": ["ضعف نصي 1"],
    "improvements": ["تحسين نصي مقترح 1"]
  },
  "missedOpportunities": {
    "lostCustomerReasons": ["سبب خسارة عميل محتمل 1", "سبب خسارة عميل محتمل 2"],
    "conversionBarriers": ["عائق تحويل 1"],
    "missingFeatures": ["ميزة مفقودة 1"],
    "audienceGaps": "شريحة جمهور لا يتم استهدافها حالياً",
    "competitiveWeakness": "أين يتفوق المنافسون؟",
    "urgentFixes": ["إصلاح عاجل 1"]
  }
}
${realData ? "ملاحظة: لديك بيانات حقيقية — استخدمها لتقديم تحليل دقيق وعميق." : "قيّم بناءً على المعرفة العامة بهذا النوع من الأنشطة في السعودية."}`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "أنت محلل سوشيال ميديا خبير. أجب دائماً بـ JSON صحيح فقط." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" } as any,
      });

      const rawContent = response.choices[0]?.message?.content;
      const content = typeof rawContent === "string" ? rawContent : "{}";
      let analysis: any = {};
      try { analysis = JSON.parse(content); } catch { analysis = {}; }

      const analysisId = await createSocialAnalysis({
        leadId: input.leadId,
        platform: "twitter",
        profileUrl: input.profileUrl,
        hasAccount: analysis.hasAccount ?? true,
        postingFrequencyScore: analysis.postingFrequencyScore,
        engagementScore: analysis.engagementScore,
        contentQualityScore: analysis.contentQualityScore,
        hasSeasonalContent: analysis.hasSeasonalContent ?? false,
        hasPricingContent: analysis.hasPricingContent ?? false,
        hasCallToAction: analysis.hasCallToAction ?? false,
        contentStrategyScore: analysis.contentStrategyScore,
        digitalPresenceScore: analysis.digitalPresenceScore,
        gaps: analysis.gaps ?? [],
        overallScore: analysis.overallScore,
        summary: analysis.summary,
        recommendations: analysis.recommendations ?? [],
        rawAnalysis: content,
      });

      return { success: true, analysisId, usedRealData: !!realData, followersCount: twitterStats.followersCount };
    } catch (error) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "فشل تحليل تويتر" });
    }
  });

// ===== تحليل تيك توك بـ Bright Data =====
const analyzeTikTokWithBrightData = protectedProcedure
  .input(z.object({
    leadId: z.number(),
    profileUrl: z.string(),
    companyName: z.string(),
    businessType: z.string(),
  }))
  .mutation(async ({ input }) => {
    try {
      let realData = "";
      let tiktokStats = { followersCount: 0, likesCount: 0, videosCount: 0, isVerified: false };

      try {
        const scraped = await scrapeTikTok(input.profileUrl);
        if (scraped.loadedSuccessfully) {
          realData = `
=== بيانات تيك توك الحقيقية (Bright Data) ===
الاسم: ${scraped.displayName}
البيو: ${scraped.bio}
المتابعون: ${scraped.followersCount.toLocaleString()}
الإعجابات الكلية: ${scraped.likesCount.toLocaleString()}
عدد الفيديوهات: ${scraped.videosCount}
موثّق: ${scraped.isVerified ? "نعم ✓" : "لا"}
=== نهاية البيانات الحقيقية ===`;

          tiktokStats = {
            followersCount: scraped.followersCount,
            likesCount: scraped.likesCount,
            videosCount: scraped.videosCount,
            isVerified: scraped.isVerified,
          };
        }
      } catch (scrapeErr) {
        console.warn("[BD analyzeTikTok] Scrape failed:", scrapeErr);
      }

      const prompt = `أنت خبير تحليل سوشيال ميديا ومحلل هوية بصرية متخصص في السوق السعودي.
قم بتحليل حساب تيك توك التالي تحليلاً عميقاً شاملاً:
- اسم النشاط: ${input.companyName}
- نوع النشاط: ${input.businessType}
- رابط الحساب: ${input.profileUrl}
${realData}

قدم تحليلاً بصيغة JSON فقط (بدون أي نص خارج JSON):
{
  "hasAccount": true,
  "followersCount": ${tiktokStats.followersCount || 0},
  "likesCount": ${tiktokStats.likesCount || 0},
  "videosCount": ${tiktokStats.videosCount || 0},
  "isVerified": ${tiktokStats.isVerified},
  "postingFrequencyScore": 5,
  "engagementScore": 6,
  "contentQualityScore": 5,
  "hasSeasonalContent": false,
  "hasPricingContent": false,
  "hasCallToAction": false,
  "contentStrategyScore": 5,
  "digitalPresenceScore": 6,
  "gaps": ["ثغرة حقيقية من البيانات"],
  "overallScore": 5.5,
  "summary": "ملخص تحليلي في سطرين بناءً على البيانات الحقيقية",
  "recommendations": ["توصية 1", "توصية 2", "توصية 3"],
  "designQuality": {
    "score": 6,
    "colorConsistency": "هل الفيديوهات تتبع هوية بصرية متناسقة (ألوان، خطوط، أسلوب)؟",
    "visualIdentity": "هل يوجد لوجو وهوية بصرية واضحة في الفيديوهات؟",
    "imageQuality": "جودة الفيديوهات والمؤثرات البصرية",
    "brandingStrength": "قوة الهوية التجارية البصرية من 1-10",
    "weaknesses": ["نقطة ضعف تصميمية 1", "نقطة ضعف تصميمية 2"],
    "improvements": ["تحسين تصميمي مقترح 1", "تحسين تصميمي مقترح 2"]
  },
  "copyQuality": {
    "score": 5,
    "bioAnalysis": "تحليل البايو ووضوح رسالة الحساب",
    "captionStyle": "أسلوب نصوص الفيديوهات: رسمي، عامي، ترفيهي، تعليمي، إلخ",
    "ctaStrength": "قوة الـ CTA في الفيديوهات",
    "languageClarity": "وضوح اللغة والرسائل التسويقية",
    "emotionalConnection": "هل الفيديوهات تخلق ارتباطاً عاطفياً مع الجمهور؟",
    "weaknesses": ["ضعف نصي 1", "ضعف نصي 2"],
    "improvements": ["تحسين نصي مقترح 1"]
  },
  "missedOpportunities": {
    "lostCustomerReasons": ["سبب خسارة عميل محتمل 1", "سبب خسارة عميل محتمل 2"],
    "conversionBarriers": ["عائق تحويل 1"],
    "missingFeatures": ["ميزة مفقودة 1 (مثل: رابط في البايو، Duets، ستيتش)"],
    "audienceGaps": "شريحة جمهور لا يتم استهدافها حالياً",
    "competitiveWeakness": "أين يتفوق المنافسون على هذا الحساب؟",
    "urgentFixes": ["إصلاح عاجل 1 (أكبر فرصة ضائعة)"]
  }
}
${realData ? "ملاحظة: لديك بيانات حقيقية — استخدمها لتقديم تحليل دقيق وعميق." : "قيّم بناءً على المعرفة العامة بحسابات هذا النوع في السعودية."}`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "أنت محلل سوشيال ميديا خبير. أجب دائماً بـ JSON صحيح فقط." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" } as any,
      });

      const rawContent = response.choices[0]?.message?.content;
      const content = typeof rawContent === "string" ? rawContent : "{}";
      let analysis: any = {};
      try { analysis = JSON.parse(content); } catch { analysis = {}; }

      const analysisId = await createSocialAnalysis({
        leadId: input.leadId,
        platform: "tiktok",
        profileUrl: input.profileUrl,
        hasAccount: analysis.hasAccount ?? true,
        postingFrequencyScore: analysis.postingFrequencyScore,
        engagementScore: analysis.engagementScore,
        contentQualityScore: analysis.contentQualityScore,
        hasSeasonalContent: analysis.hasSeasonalContent ?? false,
        hasPricingContent: analysis.hasPricingContent ?? false,
        hasCallToAction: analysis.hasCallToAction ?? false,
        contentStrategyScore: analysis.contentStrategyScore,
        digitalPresenceScore: analysis.digitalPresenceScore,
        gaps: analysis.gaps ?? [],
        overallScore: analysis.overallScore,
        summary: analysis.summary,
        recommendations: analysis.recommendations ?? [],
        rawAnalysis: content,
      });

      return {
        success: true,
        analysisId,
        usedRealData: !!realData,
        followersCount: tiktokStats.followersCount,
        likesCount: tiktokStats.likesCount,
      };
    } catch (error) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "فشل تحليل تيك توك" });
    }
  });

// ===== تحليل شامل لجميع المنصات دفعة واحدة =====
const analyzeAllPlatforms = protectedProcedure
  .input(z.object({ leadId: z.number() }))
  .mutation(async ({ input }) => {
    const lead = await getLeadById(input.leadId);
    if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "العميل غير موجود" });

    await updateLead(input.leadId, { analysisStatus: "analyzing" });

    try {
      // جلب جميع المنصات بالتوازي
      const allData = await scrapeAllPlatforms({
        websiteUrl: lead.website,
        instagramUrl: lead.instagramUrl,
        linkedinUrl: (lead as any).linkedinUrl ?? null,
        twitterUrl: lead.twitterUrl,
        tiktokUrl: lead.tiktokUrl,
        facebookUrl: lead.facebookUrl ?? null,
      });

      const realDataSummary = formatScrapedDataForLLM(allData);

      // تحليل شامل بـ LLM
      const prompt = `أنت خبير تسويق رقمي واستراتيجي مبيعات في السوق السعودي.
بناءً على البيانات الحقيقية التالية المجلوبة بـ Bright Data، أنشئ تقريراً تسويقياً شاملاً:

النشاط: ${lead.companyName}
النوع: ${lead.businessType}
المدينة: ${lead.city}

${realDataSummary}

أنشئ تقريراً بصيغة JSON:
{
  "executiveSummary": "ملخص تنفيذي شامل في 3 جمل بناءً على البيانات الحقيقية",
  "digitalPresenceScore": 6,
  "keyStrengths": ["نقطة قوة حقيقية 1", "نقطة قوة حقيقية 2"],
  "criticalGaps": ["ثغرة حرجة حقيقية 1", "ثغرة حرجة حقيقية 2", "ثغرة حرجة حقيقية 3"],
  "immediateOpportunities": ["فرصة فورية 1", "فرصة فورية 2"],
  "seasonalOpportunity": "تقييم فرصة الموسم",
  "recommendedActions": ["إجراء 1", "إجراء 2", "إجراء 3", "إجراء 4"],
  "salesScript": "نص مقترح لأول تواصل مع العميل بناءً على البيانات الحقيقية",
  "priorityLevel": "high",
  "platformsSummary": {
    "website": "ملخص الموقع",
    "instagram": "ملخص إنستغرام",
    "twitter": "ملخص تويتر",
    "tiktok": "ملخص تيك توك",
    "linkedin": "ملخص لينكد إن",
    "facebook": "ملخص فيسبوك"
  }
}`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "أنت خبير تسويق رقمي. أجب بـ JSON فقط." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" } as any,
      });

      const rawContent = response.choices[0]?.message?.content;
      const content = typeof rawContent === "string" ? rawContent : "{}";
      let report: any = {};
      try { report = JSON.parse(content); } catch { report = {}; }

      // تحديث بيانات الـ lead
      await updateLead(input.leadId, {
        analysisStatus: "completed",
        leadPriorityScore: report.digitalPresenceScore,
        biggestMarketingGap: report.criticalGaps?.[0] ?? null,
        revenueOpportunity: report.immediateOpportunities?.[0] ?? null,
        suggestedSalesEntryAngle: report.salesScript ?? null,
        // تحديث مؤشرات جاهزية التحليل
        analysisReadyFlag: true,
        analysisConfidenceScore: Math.min(1, (report.digitalPresenceScore ?? 5) / 10),
        partialAnalysisFlag: false,
      });

      // حفظ أرقام الهاتف المكتشفة
      if (allData.website?.phones?.length && !lead.verifiedPhone) {
        await updateLead(input.leadId, { verifiedPhone: allData.website.phones[0] });
      }

      // حفظ تحليل الموقع في جدول websiteAnalyses إذا كان هناك موقع
      if (lead.website || allData.website) {
        try {
          await createWebsiteAnalysis({
            leadId: input.leadId,
            url: lead.website || "unknown",
            hasWebsite: !!(lead.website),
            overallScore: report.digitalPresenceScore ?? null,
            summary: report.executiveSummary ?? null,
            recommendations: report.recommendedActions ?? [],
            technicalGaps: report.criticalGaps ?? [],
            contentGaps: [],
            rawAnalysis: JSON.stringify(report),
          });
        } catch (e) { /* تجاهل خطأ الحفظ */ }
      }

      // حفظ تحليل السوشيال ميديا في جدول socialAnalyses
      const socialPlatforms: Array<{ key: "instagram" | "twitter" | "tiktok" | "facebook"; url: string | null | undefined; data: any }> = [
        { key: "instagram", url: lead.instagramUrl, data: allData.instagram },
        { key: "twitter", url: lead.twitterUrl, data: allData.twitter },
        { key: "tiktok", url: lead.tiktokUrl, data: allData.tiktok },
        { key: "facebook", url: lead.facebookUrl, data: allData.facebook },
      ];
      // أخذ جميع Screenshots بالتوازي أولاً لتوفير الوقت (بدلاً من 90+ ثانية تسلسلي)
      const screenshotMap = new Map<string, string | undefined>();
      await Promise.all(
        socialPlatforms
          .filter(sp => sp.url)
          .map(async (sp) => {
            try {
              const socialBuf = await takeSocialMediaScreenshot(sp.url!, sp.key, 30000);
              if (socialBuf) {
                const suffix = Math.random().toString(36).slice(2, 8);
                const ssKey = `screenshots/social-${input.leadId}-${sp.key}-${suffix}.png`;
                const { url: s3Url } = await storagePut(ssKey, socialBuf, "image/png");
                screenshotMap.set(sp.key, s3Url);
                console.log(`[SocialScreenshot] Saved ${sp.key}: ${s3Url}`);
              }
            } catch (ssErr: any) {
              console.warn(`[SocialScreenshot] Failed for ${sp.key}:`, ssErr?.message);
            }
          })
      );
      // حفظ تحليل كل منصة مع الـ Screenshot المقابل
      for (const sp of socialPlatforms) {
        if (sp.url || sp.data) {
          try {
            await createSocialAnalysis({
              leadId: input.leadId,
              platform: sp.key,
              profileUrl: sp.url ?? undefined,
              hasAccount: !!(sp.url),
              followersCount: sp.data?.followersCount ?? null,
              summary: report.platformsSummary?.[sp.key] ?? null,
              recommendations: report.recommendedActions ?? [],
              gaps: report.criticalGaps ?? [],
              rawAnalysis: JSON.stringify(sp.data ?? {}),
              dataSource: "bright_data",
              screenshotUrl: screenshotMap.get(sp.key),
            });
          } catch (e) { /* تجاهل خطأ الحفظ */ }
        }
      }

      // توليد بيانات المنافسين عبر AI وحفظها في seoAdvancedAnalysis
      try {
        const competitorPrompt = `أنت خبير تسويق رقمي في السوق السعودي.
بناءً على النشاط التجاري التالي، حدد أبرز 3-5 منافسين محتملين في السوق السعودي:

النشاط: ${lead.companyName}
النوع: ${lead.businessType}
المدينة: ${lead.city}
الموقع: ${lead.website || 'غير متوفر'}

أنشئ تقريراً بصيغة JSON:
{
  "competitors": [
    {
      "name": "اسم المنافس",
      "website": "رابط الموقع أو null",
      "strengths": ["نقطة قوة 1", "نقطة قوة 2"],
      "weaknesses": ["نقطة ضعف 1"],
      "estimatedDigitalScore": 7,
      "marketPosition": "وصف موقعه في السوق",
      "instagramUrl": "رابط إنستغرام أو null"
    }
  ],
  "competitorGaps": ["ثغرة تنافسية 1", "ثغرة تنافسية 2"],
  "marketOpportunities": ["فرصة 1", "فرصة 2"],
  "competitiveAdvantage": "الميزة التنافسية المقترحة للعميل"
}`;
        const compResponse = await invokeLLM({
          messages: [
            { role: "system", content: "أنت خبير تسويق رقمي. أجب بـ JSON فقط." },
            { role: "user", content: competitorPrompt },
          ],
          response_format: { type: "json_object" } as any,
        });
        const compRaw = compResponse.choices[0]?.message?.content;
        const compContent = typeof compRaw === "string" ? compRaw : "{}";
        let compData: any = {};
        try { compData = JSON.parse(compContent); } catch { compData = {}; }
        if (compData.competitors?.length > 0) {
          await createSeoAdvancedAnalysis({
            leadId: input.leadId,
            url: lead.website || "",
            competitors: compData.competitors,
            competitorGaps: compData.competitorGaps ?? [],
            priorityActions: compData.marketOpportunities ?? [],
            seoSummary: compData.competitiveAdvantage ?? null,
          });
          console.log(`[Competitors] Saved ${compData.competitors.length} competitors for lead ${input.leadId}`);
        }
      } catch (compErr: any) {
        console.warn("[Competitors] Failed to generate:", compErr?.message);
      }

      return {
        success: true,
        report,
        scrapedData: {
          websiteLoaded: allData.website?.loadedSuccessfully ?? false,
          instagramLoaded: allData.instagram?.loadedSuccessfully ?? false,
          linkedinLoaded: allData.linkedin?.loadedSuccessfully ?? false,
          twitterLoaded: allData.twitter?.loadedSuccessfully ?? false,
          tiktokLoaded: allData.tiktok?.loadedSuccessfully ?? false,
          facebookLoaded: allData.facebook?.loadedSuccessfully ?? false,
          discoveredPhones: allData.website?.phones ?? [],
          instagramFollowers: allData.instagram?.followersCount ?? 0,
          twitterFollowers: allData.twitter?.followersCount ?? 0,
          tiktokFollowers: allData.tiktok?.followersCount ?? 0,
          linkedinFollowers: allData.linkedin?.followersCount ?? 0,
          facebookFollowers: allData.facebook?.followersCount ?? 0,
        },
      };
    } catch (error) {
      await updateLead(input.leadId, { analysisStatus: "failed" });
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "فشل التحليل الشامل" });
    }
  });

// ===== جلب بيانات منصة واحدة فقط (بدون تحليل) =====
const scrapeProfile = protectedProcedure
  .input(z.object({
    platform: z.enum(["website", "instagram", "linkedin", "twitter", "tiktok"]),
    url: z.string(),
  }))
  .mutation(async ({ input }) => {
    try {
      switch (input.platform) {
        case "website":
          return await scrapeWebsite(input.url);
        case "instagram":
          return await scrapeInstagram(input.url);
        case "linkedin":
          return await scrapeLinkedIn(input.url);
        case "twitter":
          return await scrapeTwitter(input.url);
        case "tiktok":
          return await scrapeTikTok(input.url);
        default:
          throw new TRPCError({ code: "BAD_REQUEST", message: "منصة غير مدعومة" });
      }
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "فشل جلب البيانات" });
    }
  });

// ===== Export Router =====
export const brightDataAnalysisRouter = router({
  analyzeWebsite: analyzeWebsiteWithBrightData,
  analyzeInstagram: analyzeInstagramWithBrightData,
  analyzeLinkedIn: analyzeLinkedInWithBrightData,
  analyzeTwitter: analyzeTwitterWithBrightData,
  analyzeTikTok: analyzeTikTokWithBrightData,
  analyzeAllPlatforms,
  scrapeProfile,
});
