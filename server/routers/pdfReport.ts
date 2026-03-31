/**
 * PDF Report Router - روتر توليد تقارير PDF
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { leads, seoAdvancedAnalysis, websiteAnalyses, socialAnalyses as socialAnalysesTable, realSocialSnapshots } from "../../drizzle/schema";
import { eq, isNotNull, ne, or, desc } from "drizzle-orm";
import { generatePdfFromHtml } from "../lib/pdfGenerator";
import { generateReportHTML, type PDFReportData } from "../lib/pdfReportEngine";
import { storagePut } from "../storage";
import { getActiveSeasonForBusiness } from "./seasons";
import { getReportStyleSettings } from "./reportStyle";
import { companySettings } from "../../drizzle/schema";

function buildReportData(lead: typeof leads.$inferSelect, reportType: "internal" | "client_facing", generatedBy?: string): PDFReportData {
  return {
    lead: {
      id: lead.id,
      companyName: lead.companyName,
      businessType: lead.businessType,
      city: lead.city,
      country: lead.country,
      verifiedPhone: lead.verifiedPhone,
      website: lead.website,
      instagramUrl: lead.instagramUrl,
      twitterUrl: lead.twitterUrl,
      snapchatUrl: lead.snapchatUrl,
      tiktokUrl: lead.tiktokUrl,
      facebookUrl: lead.facebookUrl,
      googleMapsUrl: lead.googleMapsUrl,
      reviewCount: lead.reviewCount,
      stage: lead.stage,
      priority: lead.priority,
      notes: lead.notes,
      additionalNotes: lead.additionalNotes,
    },
    analysis: {
      sectorMain: lead.sectorMain,
      marketingGapSummary: lead.marketingGapSummary,
      competitivePosition: lead.competitivePosition,
      primaryOpportunity: lead.primaryOpportunity,
      secondaryOpportunity: lead.secondaryOpportunity,
      urgencyLevel: lead.urgencyLevel,
      recommendedServices: lead.recommendedServices,
      salesEntryAngle: lead.salesEntryAngle,
      iceBreaker: lead.iceBreaker,
      sectorInsights: lead.sectorInsights,
      benchmarkComparison: lead.benchmarkComparison,
      leadPriorityScore: lead.leadPriorityScore,
      aiConfidenceScore: lead.aiConfidenceScore,
      biggestMarketingGap: lead.biggestMarketingGap,
      revenueOpportunity: lead.revenueOpportunity,
      suggestedSalesEntryAngle: lead.suggestedSalesEntryAngle,
    },
    reportType,
    generatedAt: new Date(),
    generatedBy,
  };
}

export const pdfReportRouter = router({

  // جلب قائمة العملاء المحللين (لتبويب التقارير)
  listAnalyzedLeads: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(200).default(100) }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const results = await db.select({
        id: leads.id,
        companyName: leads.companyName,
        businessType: leads.businessType,
        city: leads.city,
        sectorMain: leads.sectorMain,
        urgencyLevel: leads.urgencyLevel,
        leadPriorityScore: leads.leadPriorityScore,
        pdfFileUrl: leads.pdfFileUrl,
        pdfGenerationStatus: leads.pdfGenerationStatus,
        pdfGeneratedAt: leads.pdfGeneratedAt,
        reportTemplateType: leads.reportTemplateType,
        marketingGapSummary: leads.marketingGapSummary,
        primaryOpportunity: leads.primaryOpportunity,
        iceBreaker: leads.iceBreaker,
      })
      .from(leads)
      .where(
        or(
          isNotNull(leads.marketingGapSummary),
          isNotNull(leads.primaryOpportunity),
          ne(leads.pdfGenerationStatus, "not_generated" as const)
        )
      )
      .limit(input?.limit ?? 100)
      .orderBy(leads.id);
      return results;
    }),

  // توليد تقرير HTML (للمعاينة)
  generatePreview: protectedProcedure
    .input(z.object({
      leadId: z.number(),
      reportType: z.enum(["internal", "client_facing"]).default("internal"),
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [lead] = await db.select().from(leads).where(eq(leads.id, input.leadId));
      if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "العميل غير موجود" });
      const activeSeason = await getActiveSeasonForBusiness(lead.businessType || "");
      const reportData = buildReportData(lead, input.reportType, ctx.user?.name || undefined);
      // ربط إعدادات التقارير ومعلومات الشركة بالتقرير
      const [styleRow, companyRow] = await Promise.all([
        getReportStyleSettings(),
        db.select().from(companySettings).limit(1).then(r => r[0] || null),
      ]);
      reportData.styleSettings = {
        tone: styleRow?.tone || "professional",
        brandKeywords: (styleRow?.brandKeywords as string[]) || [],
        closingStatement: styleRow?.closingStatement || "",
        includeSeasonSection: styleRow?.includeSeasonSection !== false,
        includeCompetitorsSection: styleRow?.includeCompetitorsSection !== false,
        detailLevel: styleRow?.detailLevel || "standard",
        whatsappNumber: companyRow?.phone || "966500000000",
        companyPhone: companyRow?.phone || "+966-50-000-0000",
        companyEmail: companyRow?.email || "info@maksab.sa",
        companyWebsite: companyRow?.website || "www.maksab.sa",
        analystName: companyRow?.analystName || ctx.user?.name || "فريق مكسب",
        analystTitle: companyRow?.analystTitle || "محلل تسويق رقمي",
      };
      if (activeSeason) {
        reportData.seasonOverride = {
          name: activeSeason.name,
          emoji: activeSeason.icon || "📅",
          color: activeSeason.color || "#64748b",
          urgency: (activeSeason as any).urgency_text || activeSeason.description || "",
          tip: (activeSeason as any).tip_text || (Array.isArray(activeSeason.opportunities) ? activeSeason.opportunities[0] : "") || "",
        };
      }
      // جلب بيانات SEO المتقدم إن وجدتت
      const [seoRow] = await db.select().from(seoAdvancedAnalysis)
        .where(eq(seoAdvancedAnalysis.leadId, input.leadId))
        .orderBy(seoAdvancedAnalysis.analyzedAt)
        .limit(1);
      if (seoRow) {
        reportData.seoData = {
          url: seoRow.url,
          overallSeoHealth: seoRow.overallSeoHealth || undefined,
          localSeoScore: seoRow.localSeoScore || undefined,
          estimatedBacklinks: seoRow.estimatedBacklinks || undefined,
          backlinkQuality: seoRow.backlinkQuality || undefined,
          brandMentions: seoRow.brandMentions || undefined,
          seoSummary: seoRow.seoSummary || undefined,
          topKeywords: (seoRow.topKeywords as any[])?.length ? seoRow.topKeywords as any : undefined,
          keywordOpportunities: (seoRow.keywordOpportunities as any[])?.length ? seoRow.keywordOpportunities as any : undefined,
          missingKeywords: (seoRow.missingKeywords as any[])?.length ? seoRow.missingKeywords as any : undefined,
          searchRankings: (seoRow.searchRankings as any[])?.length ? seoRow.searchRankings as any : undefined,
          competitors: (seoRow.competitors as any[])?.length ? seoRow.competitors as any : undefined,
          competitorGaps: (seoRow.competitorGaps as any[])?.length ? seoRow.competitorGaps as any : undefined,
          priorityActions: (seoRow.priorityActions as any[])?.length ? seoRow.priorityActions as any : undefined,
          topReferringDomains: (seoRow.topReferringDomains as any[])?.length ? seoRow.topReferringDomains as any : undefined,
          backlinkGaps: (seoRow.backlinkGaps as any[])?.length ? seoRow.backlinkGaps as any : undefined,
        };
      }
      // جلب تحليل الموقع الإلكتروني
      const [websiteRowP] = await db.select().from(websiteAnalyses)
        .where(eq(websiteAnalyses.leadId, input.leadId))
        .orderBy(desc(websiteAnalyses.analyzedAt))
        .limit(1);
      if (websiteRowP) {
        reportData.websiteData = {
          url: websiteRowP.url,
          hasWebsite: websiteRowP.hasWebsite ?? false,
          loadSpeedScore: websiteRowP.loadSpeedScore,
          mobileExperienceScore: websiteRowP.mobileExperienceScore,
          seoScore: websiteRowP.seoScore,
          contentQualityScore: websiteRowP.contentQualityScore,
          designScore: websiteRowP.designScore,
          offerClarityScore: websiteRowP.offerClarityScore,
          overallScore: websiteRowP.overallScore,
          hasOnlineBooking: websiteRowP.hasOnlineBooking,
          hasPaymentOptions: websiteRowP.hasPaymentOptions,
          hasDeliveryInfo: websiteRowP.hasDeliveryInfo,
          hasSeasonalPage: websiteRowP.hasSeasonalPage,
          technicalGaps: websiteRowP.technicalGaps as string[] | null,
          contentGaps: websiteRowP.contentGaps as string[] | null,
          recommendations: websiteRowP.recommendations as string[] | null,
          summary: websiteRowP.summary,
          analyzedAt: websiteRowP.analyzedAt,
          screenshotUrl: websiteRowP.screenshotUrl,
        };
      }
      // جلب تحليل السوشيال (AI analysis per platform) مع Screenshots
      const socialRowsP = await db.select().from(socialAnalysesTable)
        .where(eq(socialAnalysesTable.leadId, input.leadId))
        .orderBy(socialAnalysesTable.analyzedAt);
      if (socialRowsP.length > 0) {
        reportData.socialAnalyses = socialRowsP.map(r => ({
          platform: r.platform,
          hasAccount: r.hasAccount ?? false,
          followersCount: r.followersCount,
          engagementRate: r.engagementRate,
          postsCount: r.postsCount,
          avgLikes: r.avgLikes,
          avgViews: r.avgViews,
          overallScore: r.overallScore,
          engagementScore: r.engagementScore,
          contentQualityScore: r.contentQualityScore,
          postingFrequencyScore: r.postingFrequencyScore,
          contentStrategyScore: r.contentStrategyScore,
          digitalPresenceScore: r.digitalPresenceScore,
          hasSeasonalContent: r.hasSeasonalContent,
          hasPricingContent: r.hasPricingContent,
          hasCallToAction: r.hasCallToAction,
          gaps: r.gaps as string[] | null,
          recommendations: r.recommendations as string[] | null,
          summary: r.summary,
          analysisText: r.analysisText,
          dataSource: r.dataSource,
          profileUrl: r.profileUrl,
          screenshotUrl: r.screenshotUrl,
          platformRecommendation: (() => { try { const raw = r.rawAnalysis ? JSON.parse(r.rawAnalysis as string) : null; return (raw as any)?.platformRecommendation || null; } catch { return null; } })(),
          competitorScreenshots: r.competitorScreenshots as {name: string; url: string; screenshotUrl?: string; followersCount?: number; score?: number}[] | null,
        }));
      }
      // جلب بيانات السوشيال الحقيقية (Bright Data snapshot)
      const [socialSnapP] = await db.select().from(realSocialSnapshots)
        .where(eq(realSocialSnapshots.leadId, input.leadId))
        .orderBy(realSocialSnapshots.fetchedAt)
        .limit(1);
      if (socialSnapP) {
        reportData.socialSnapshot = {
          instagramFollowers: socialSnapP.instagramFollowers,
          instagramFollowing: socialSnapP.instagramFollowing,
          instagramPostsCount: socialSnapP.instagramPostsCount,
          instagramVerified: socialSnapP.instagramVerified,
          instagramEngagementRate: socialSnapP.instagramEngagementRate,
          instagramBio: socialSnapP.instagramBio,
          instagramUsername: socialSnapP.instagramUsername,
          tiktokFollowers: socialSnapP.tiktokFollowers,
          tiktokVideoCount: socialSnapP.tiktokVideoCount,
          tiktokHearts: socialSnapP.tiktokHearts,
          tiktokEngagementRate: socialSnapP.tiktokEngagementRate,
          tiktokVerified: socialSnapP.tiktokVerified,
          tiktokDescription: socialSnapP.tiktokDescription,
          tiktokUsername: socialSnapP.tiktokUsername,
          twitterFollowers: socialSnapP.twitterFollowers,
          twitterTweetsCount: socialSnapP.twitterTweetsCount,
          twitterVerified: socialSnapP.twitterVerified,
          twitterBlueVerified: socialSnapP.twitterBlueVerified,
          twitterDescription: socialSnapP.twitterDescription,
          twitterUsername: socialSnapP.twitterUsername,
          backlinkTotal: socialSnapP.backlinkTotal,
          backlinkHasGMB: socialSnapP.backlinkHasGMB,
          fetchedAt: socialSnapP.fetchedAt,
        };
      }
      const html = generateReportHTML(reportData);

      return { html, leadName: lead.companyName };
    }),

  // توليد وحفظ تقرير HTML في S3
  generateAndSave: protectedProcedure
    .input(z.object({
      leadId: z.number(),
      reportType: z.enum(["internal", "client_facing"]).default("internal"),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [lead] = await db.select().from(leads).where(eq(leads.id, input.leadId));
      if (!lead) throw new TRPCError({ code: "NOT_FOUND" });

      await db.update(leads)
        .set({ pdfGenerationStatus: "generating" as const })
        .where(eq(leads.id, input.leadId));

      try {
        const activeSeason = await getActiveSeasonForBusiness(lead.businessType || "");
        const reportData = buildReportData(lead, input.reportType, ctx.user?.name || undefined);
        // ربط إعدادات التقارير ومعلومات الشركة
        const [styleRow2, companyRow2] = await Promise.all([
          getReportStyleSettings(),
          db.select().from(companySettings).limit(1).then(r => r[0] || null),
        ]);
        reportData.styleSettings = {
          tone: styleRow2?.tone || "professional",
          brandKeywords: (styleRow2?.brandKeywords as string[]) || [],
          closingStatement: styleRow2?.closingStatement || "",
          includeSeasonSection: styleRow2?.includeSeasonSection !== false,
          includeCompetitorsSection: styleRow2?.includeCompetitorsSection !== false,
          detailLevel: styleRow2?.detailLevel || "standard",
          whatsappNumber: companyRow2?.phone || "966500000000",
          companyPhone: companyRow2?.phone || "+966-50-000-0000",
          companyEmail: companyRow2?.email || "info@maksab.sa",
          companyWebsite: companyRow2?.website || "www.maksab.sa",
          analystName: companyRow2?.analystName || ctx.user?.name || "فريق مكسب",
          analystTitle: companyRow2?.analystTitle || "محلل تسويق رقمي",
        };
        if (activeSeason) {
          reportData.seasonOverride = {
            name: activeSeason.name,
            emoji: activeSeason.icon || "📅",
            color: activeSeason.color || "#64748b",
            urgency: (activeSeason as any).urgency_text || activeSeason.description || "",
            tip: (activeSeason as any).tip_text || (Array.isArray(activeSeason.opportunities) ? activeSeason.opportunities[0] : "") || "",
          };
        }
        // جلب بيانات SEO المتقدم إن وجدت
        const [seoRow2] = await db.select().from(seoAdvancedAnalysis)
          .where(eq(seoAdvancedAnalysis.leadId, input.leadId))
          .orderBy(seoAdvancedAnalysis.analyzedAt)
          .limit(1);
        if (seoRow2) {
          reportData.seoData = {
            url: seoRow2.url,
            overallSeoHealth: seoRow2.overallSeoHealth || undefined,
            localSeoScore: seoRow2.localSeoScore || undefined,
            estimatedBacklinks: seoRow2.estimatedBacklinks || undefined,
            backlinkQuality: seoRow2.backlinkQuality || undefined,
            brandMentions: seoRow2.brandMentions || undefined,
            seoSummary: seoRow2.seoSummary || undefined,
            topKeywords: (seoRow2.topKeywords as any[])?.length ? seoRow2.topKeywords as any : undefined,
            keywordOpportunities: (seoRow2.keywordOpportunities as any[])?.length ? seoRow2.keywordOpportunities as any : undefined,
            missingKeywords: (seoRow2.missingKeywords as any[])?.length ? seoRow2.missingKeywords as any : undefined,
            searchRankings: (seoRow2.searchRankings as any[])?.length ? seoRow2.searchRankings as any : undefined,
            competitors: (seoRow2.competitors as any[])?.length ? seoRow2.competitors as any : undefined,
            competitorGaps: (seoRow2.competitorGaps as any[])?.length ? seoRow2.competitorGaps as any : undefined,
            priorityActions: (seoRow2.priorityActions as any[])?.length ? seoRow2.priorityActions as any : undefined,
            topReferringDomains: (seoRow2.topReferringDomains as any[])?.length ? seoRow2.topReferringDomains as any : undefined,
            backlinkGaps: (seoRow2.backlinkGaps as any[])?.length ? seoRow2.backlinkGaps as any : undefined,
          };
        }

        // جلب تحليل الموقع الإلكتروني
        const [websiteRow] = await db.select().from(websiteAnalyses)
          .where(eq(websiteAnalyses.leadId, input.leadId))
          .orderBy(desc(websiteAnalyses.analyzedAt))
          .limit(1);
        if (websiteRow) {
          reportData.websiteData = {
            url: websiteRow.url,
            hasWebsite: websiteRow.hasWebsite ?? false,
            loadSpeedScore: websiteRow.loadSpeedScore,
            mobileExperienceScore: websiteRow.mobileExperienceScore,
            seoScore: websiteRow.seoScore,
            contentQualityScore: websiteRow.contentQualityScore,
            designScore: websiteRow.designScore,
            offerClarityScore: websiteRow.offerClarityScore,
            overallScore: websiteRow.overallScore,
            hasOnlineBooking: websiteRow.hasOnlineBooking,
            hasPaymentOptions: websiteRow.hasPaymentOptions,
            hasDeliveryInfo: websiteRow.hasDeliveryInfo,
            hasSeasonalPage: websiteRow.hasSeasonalPage,
            technicalGaps: websiteRow.technicalGaps as string[] | null,
            contentGaps: websiteRow.contentGaps as string[] | null,
            recommendations: websiteRow.recommendations as string[] | null,
            summary: websiteRow.summary,
            analyzedAt: websiteRow.analyzedAt,
            screenshotUrl: websiteRow.screenshotUrl,
          };
        }

        // جلب بيانات السوشيال الحقيقية (Bright Data snapshot)
        const [socialSnap] = await db.select().from(realSocialSnapshots)
          .where(eq(realSocialSnapshots.leadId, input.leadId))
          .orderBy(realSocialSnapshots.fetchedAt)
          .limit(1);
        if (socialSnap) {
          reportData.socialSnapshot = {
            instagramFollowers: socialSnap.instagramFollowers,
            instagramFollowing: socialSnap.instagramFollowing,
            instagramPostsCount: socialSnap.instagramPostsCount,
            instagramVerified: socialSnap.instagramVerified,
            instagramEngagementRate: socialSnap.instagramEngagementRate,
            instagramBio: socialSnap.instagramBio,
            instagramUsername: socialSnap.instagramUsername,
            tiktokFollowers: socialSnap.tiktokFollowers,
            tiktokVideoCount: socialSnap.tiktokVideoCount,
            tiktokHearts: socialSnap.tiktokHearts,
            tiktokEngagementRate: socialSnap.tiktokEngagementRate,
            tiktokVerified: socialSnap.tiktokVerified,
            tiktokDescription: socialSnap.tiktokDescription,
            tiktokUsername: socialSnap.tiktokUsername,
            twitterFollowers: socialSnap.twitterFollowers,
            twitterTweetsCount: socialSnap.twitterTweetsCount,
            twitterVerified: socialSnap.twitterVerified,
            twitterBlueVerified: socialSnap.twitterBlueVerified,
            twitterDescription: socialSnap.twitterDescription,
            twitterUsername: socialSnap.twitterUsername,
            backlinkTotal: socialSnap.backlinkTotal,
            backlinkHasGMB: socialSnap.backlinkHasGMB,
            fetchedAt: socialSnap.fetchedAt,
          };
        }

        // جلب تحليل السوشيال (AI analysis per platform)
        const socialRows = await db.select().from(socialAnalysesTable)
          .where(eq(socialAnalysesTable.leadId, input.leadId))
          .orderBy(socialAnalysesTable.analyzedAt);
        if (socialRows.length > 0) {
          reportData.socialAnalyses = socialRows.map(r => ({
            platform: r.platform,
            hasAccount: r.hasAccount ?? false,
            followersCount: r.followersCount,
            engagementRate: r.engagementRate,
            postsCount: r.postsCount,
            avgLikes: r.avgLikes,
            avgViews: r.avgViews,
            overallScore: r.overallScore,
            engagementScore: r.engagementScore,
            contentQualityScore: r.contentQualityScore,
            postingFrequencyScore: r.postingFrequencyScore,
            contentStrategyScore: r.contentStrategyScore,
            digitalPresenceScore: r.digitalPresenceScore,
            hasSeasonalContent: r.hasSeasonalContent,
            hasPricingContent: r.hasPricingContent,
            hasCallToAction: r.hasCallToAction,
            gaps: r.gaps as string[] | null,
            recommendations: r.recommendations as string[] | null,
            summary: r.summary,
            analysisText: r.analysisText,
            dataSource: r.dataSource,
            profileUrl: r.profileUrl,
            screenshotUrl: r.screenshotUrl,
            platformRecommendation: (() => { try { const raw = r.rawAnalysis ? JSON.parse(r.rawAnalysis as string) : null; return (raw as any)?.platformRecommendation || null; } catch { return null; } })(),
            competitorScreenshots: r.competitorScreenshots as {name: string; url: string; screenshotUrl?: string; followersCount?: number; score?: number}[] | null,
          }));
        }

        // إضافة بيانات التعليقات والسمعة من بيانات العميل المتاحة
        if (lead.reviewCount || lead.googleMapsUrl) {
          reportData.reviewsAnalysis = {
            reviewCount: lead.reviewCount ?? null,
            googleRating: null,
            sentimentPositive: null,
            sentimentNegative: null,
            sentimentNeutral: null,
            topPositiveKeywords: null,
            topNegativeKeywords: null,
            topThemes: null,
            reputationScore: null,
            reputationLabel: null,
            aiSummary: null,
            recommendations: null,
          };
        }

        const html = generateReportHTML(reportData);
        const pdfBuffer = await generatePdfFromHtml({ html, format: "A4" });

        const fileKey = `reports/lead-${lead.id}-${input.reportType}-${Date.now()}.pdf`;
        const { url } = await storagePut(fileKey, pdfBuffer, "application/pdf");

        await db.update(leads)
          .set({
            pdfGenerationStatus: "ready" as const,
            pdfFileUrl: url,
            pdfGeneratedAt: new Date(),
            reportStatus: "ready" as const,
            reportTemplateType: input.reportType,
          })
          .where(eq(leads.id, input.leadId));

        return { success: true, reportUrl: url, leadName: lead.companyName };
      } catch (error) {
        console.error(`[PDF Report] Failed to generate report for lead ${input.leadId}:`, error);
        await db.update(leads)
          .set({ pdfGenerationStatus: "failed" as const })
          .where(eq(leads.id, input.leadId));
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "فشل توليد التقرير" });
      }
    }),

  // جلب رابط التقرير المحفوظ
  getReportUrl: protectedProcedure
    .input(z.object({ leadId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const [lead] = await db.select({
        pdfFileUrl: leads.pdfFileUrl,
        pdfGenerationStatus: leads.pdfGenerationStatus,
        pdfGeneratedAt: leads.pdfGeneratedAt,
        reportTemplateType: leads.reportTemplateType,
      }).from(leads).where(eq(leads.id, input.leadId));

      return lead || null;
    }),

  // توليد PDF جماعي لعدة عملاء
  generateBulk: protectedProcedure
    .input(z.object({
      leadIds: z.array(z.number()).min(1).max(200),
      reportType: z.enum(["internal", "client_facing"]).default("client_facing"),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      let queued = 0;
      let skipped = 0;
      for (const leadId of input.leadIds) {
        const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
        if (!lead) { skipped++; continue; }
        queued++;
        // تشغيل توليد التقرير في الخلفية
        setImmediate(async () => {
          try {
            await db.update(leads)
              .set({ pdfGenerationStatus: "generating" as const })
              .where(eq(leads.id, leadId));
            const activeSeason = await getActiveSeasonForBusiness(lead.businessType || "");
            const reportData = buildReportData(lead, input.reportType, ctx.user?.name || undefined);
            // ربط إعدادات التقارير ومعلومات الشركة
            const [styleRowB, companyRowB] = await Promise.all([
              getReportStyleSettings(),
              db.select().from(companySettings).limit(1).then(r => r[0] || null),
            ]);
            reportData.styleSettings = {
              tone: styleRowB?.tone || "professional",
              brandKeywords: (styleRowB?.brandKeywords as string[]) || [],
              closingStatement: styleRowB?.closingStatement || "",
              includeSeasonSection: styleRowB?.includeSeasonSection !== false,
              includeCompetitorsSection: styleRowB?.includeCompetitorsSection !== false,
              detailLevel: styleRowB?.detailLevel || "standard",
              whatsappNumber: companyRowB?.phone || "966500000000",
              companyPhone: companyRowB?.phone || "+966-50-000-0000",
              companyEmail: companyRowB?.email || "info@maksab.sa",
              companyWebsite: companyRowB?.website || "www.maksab.sa",
              analystName: companyRowB?.analystName || ctx.user?.name || "فريق مكسب",
              analystTitle: companyRowB?.analystTitle || "محلل تسويق رقمي",
            };
            if (activeSeason) {
              reportData.seasonOverride = {
                name: activeSeason.name,
                emoji: activeSeason.icon || "📅",
                color: activeSeason.color || "#64748b",
                urgency: (activeSeason as any).urgency_text || activeSeason.description || "",
                tip: (activeSeason as any).tip_text || (Array.isArray(activeSeason.opportunities) ? activeSeason.opportunities[0] : "") || "",
              };
            }
            const [seoRow] = await db.select().from(seoAdvancedAnalysis)
              .where(eq(seoAdvancedAnalysis.leadId, leadId)).limit(1);
            if (seoRow) {
              reportData.seoData = {
                url: seoRow.url,
                overallSeoHealth: seoRow.overallSeoHealth || undefined,
                localSeoScore: seoRow.localSeoScore || undefined,
                estimatedBacklinks: seoRow.estimatedBacklinks || undefined,
                backlinkQuality: seoRow.backlinkQuality || undefined,
                seoSummary: seoRow.seoSummary || undefined,
                topKeywords: (seoRow.topKeywords as any[])?.length ? seoRow.topKeywords as any : undefined,
                competitors: (seoRow.competitors as any[])?.length ? seoRow.competitors as any : undefined,
                priorityActions: (seoRow.priorityActions as any[])?.length ? seoRow.priorityActions as any : undefined,
              };
            }
            const [websiteRow] = await db.select().from(websiteAnalyses)
              .where(eq(websiteAnalyses.leadId, leadId))
              .orderBy(desc(websiteAnalyses.analyzedAt))
              .limit(1);
            if (websiteRow) {
              reportData.websiteData = {
                url: websiteRow.url,
                hasWebsite: websiteRow.hasWebsite ?? false,
                loadSpeedScore: websiteRow.loadSpeedScore,
                mobileExperienceScore: websiteRow.mobileExperienceScore,
                seoScore: websiteRow.seoScore,
                contentQualityScore: websiteRow.contentQualityScore,
                designScore: websiteRow.designScore,
                offerClarityScore: websiteRow.offerClarityScore,
                overallScore: websiteRow.overallScore,
                hasOnlineBooking: websiteRow.hasOnlineBooking,
                hasPaymentOptions: websiteRow.hasPaymentOptions,
                hasDeliveryInfo: websiteRow.hasDeliveryInfo,
                hasSeasonalPage: websiteRow.hasSeasonalPage,
                technicalGaps: websiteRow.technicalGaps as string[] | null,
                contentGaps: websiteRow.contentGaps as string[] | null,
                recommendations: websiteRow.recommendations as string[] | null,
                summary: websiteRow.summary,
                analyzedAt: websiteRow.analyzedAt,
                screenshotUrl: websiteRow.screenshotUrl,
              };
            }
            const [socialSnap] = await db.select().from(realSocialSnapshots)
              .where(eq(realSocialSnapshots.leadId, leadId)).limit(1);
            if (socialSnap) {
              reportData.socialSnapshot = {
                instagramFollowers: socialSnap.instagramFollowers,
                instagramFollowing: socialSnap.instagramFollowing,
                instagramPostsCount: socialSnap.instagramPostsCount,
                instagramVerified: socialSnap.instagramVerified,
                instagramEngagementRate: socialSnap.instagramEngagementRate,
                instagramBio: socialSnap.instagramBio,
                instagramUsername: socialSnap.instagramUsername,
                tiktokFollowers: socialSnap.tiktokFollowers,
                tiktokVideoCount: socialSnap.tiktokVideoCount,
                tiktokHearts: socialSnap.tiktokHearts,
                tiktokEngagementRate: socialSnap.tiktokEngagementRate,
                tiktokVerified: socialSnap.tiktokVerified,
                tiktokDescription: socialSnap.tiktokDescription,
                tiktokUsername: socialSnap.tiktokUsername,
                twitterFollowers: socialSnap.twitterFollowers,
                twitterTweetsCount: socialSnap.twitterTweetsCount,
                twitterVerified: socialSnap.twitterVerified,
                twitterBlueVerified: socialSnap.twitterBlueVerified,
                twitterDescription: socialSnap.twitterDescription,
                twitterUsername: socialSnap.twitterUsername,
                backlinkTotal: socialSnap.backlinkTotal,
                backlinkHasGMB: socialSnap.backlinkHasGMB,
                fetchedAt: socialSnap.fetchedAt,
              };
            }
            // جلب تحليل السوشيال (AI analysis per platform) مع Screenshots
            const socialRowsB = await db.select().from(socialAnalysesTable)
              .where(eq(socialAnalysesTable.leadId, leadId))
              .orderBy(socialAnalysesTable.analyzedAt);
            if (socialRowsB.length > 0) {
              reportData.socialAnalyses = socialRowsB.map(r => ({
                platform: r.platform,
                hasAccount: r.hasAccount ?? false,
                followersCount: r.followersCount,
                engagementRate: r.engagementRate,
                postsCount: r.postsCount,
                avgLikes: r.avgLikes,
                avgViews: r.avgViews,
                overallScore: r.overallScore,
                engagementScore: r.engagementScore,
                contentQualityScore: r.contentQualityScore,
                postingFrequencyScore: r.postingFrequencyScore,
                contentStrategyScore: r.contentStrategyScore,
                digitalPresenceScore: r.digitalPresenceScore,
                hasSeasonalContent: r.hasSeasonalContent,
                hasPricingContent: r.hasPricingContent,
                hasCallToAction: r.hasCallToAction,
                gaps: r.gaps as string[] | null,
                recommendations: r.recommendations as string[] | null,
                summary: r.summary,
                analysisText: r.analysisText,
                dataSource: r.dataSource,
                profileUrl: r.profileUrl,
                screenshotUrl: r.screenshotUrl,
                platformRecommendation: (() => { try { const raw = r.rawAnalysis ? JSON.parse(r.rawAnalysis as string) : null; return (raw as any)?.platformRecommendation || null; } catch { return null; } })(),
                competitorScreenshots: r.competitorScreenshots as {name: string; url: string; screenshotUrl?: string; followersCount?: number; score?: number}[] | null,
              }));
            }
            const html = generateReportHTML(reportData);
            const pdfBuffer = await generatePdfFromHtml({ html, format: "A4" });
            const fileKey = `reports/lead-${leadId}-${input.reportType}-${Date.now()}.pdf`;
            const { url } = await storagePut(fileKey, pdfBuffer, "application/pdf");
            await db.update(leads)
              .set({
                pdfGenerationStatus: "ready" as const,
                pdfFileUrl: url,
                pdfGeneratedAt: new Date(),
                reportStatus: "ready" as const,
                reportTemplateType: input.reportType,
              })
              .where(eq(leads.id, leadId));
          } catch (err) {
            console.error(`[PDF Bulk] Failed for lead ${leadId}:`, err);
            await db.update(leads)
              .set({ pdfGenerationStatus: "failed" as const })
              .where(eq(leads.id, leadId));
          }
        });
      }
      return { queued, skipped };
    }),
});
