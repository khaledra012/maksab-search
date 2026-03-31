/**
 * Bulk Analysis Router - روتر التحليل الجماعي
 * يدير تحليل دفعات من العملاء مع Queue Management
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { leads, socialAnalyses, websiteAnalyses } from "../../drizzle/schema";
import { eq, inArray, and, or, isNull } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import {
  buildSectorAnalysisPrompt,
  parseSectorAnalysisResponse,
  detectSectorFromBusinessType,
  type Sector,
  type AnalysisLanguageMode,
} from "../lib/sectorAnalysisEngine";

// In-memory queue state (for simplicity without BullMQ)
interface QueueJob {
  batchId: string;
  leadIds: number[];
  processed: number;
  failed: number;
  total: number;
  status: "idle" | "running" | "paused" | "completed" | "failed";
  startedAt: number;
  languageMode: string;
  errors: Array<{ leadId: number; error: string }>;
}

const activeJobs = new Map<string, QueueJob>();

function generateBatchId(): string {
  return `batch-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
}

// Helper to extract string content from LLM response
function extractContent(content: string | any[]): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const textItem = content.find((c: any) => c.type === "text");
    return textItem?.text || "";
  }
  return "";
}

// Build rich social media summary from Bright Data real data
function buildSocialSummary(socialData: any[]): string {
  if (!socialData.length) return "";
  const parts: string[] = [];
  for (const s of socialData) {
    const platform = s.platform;
    const lines: string[] = [`منصة ${platform}:`];
    if (s.followersCount > 0) lines.push(`  - المتابعون: ${s.followersCount.toLocaleString()}`);
    if (s.postsCount > 0) lines.push(`  - عدد المنشورات: ${s.postsCount}`);
    if (s.engagementRate > 0) lines.push(`  - معدل التفاعل: ${s.engagementRate.toFixed(2)}%`);
    if (s.avgLikes > 0) lines.push(`  - متوسط الإعجابات: ${s.avgLikes}`);
    if (s.avgViews > 0) lines.push(`  - متوسط المشاهدات: ${s.avgViews}`);
    if (s.summary) lines.push(`  - ملخص: ${s.summary}`);
    if (s.overallScore) lines.push(`  - التقييم: ${s.overallScore}/10`);
    if (Array.isArray(s.gaps) && s.gaps.length > 0) lines.push(`  - الثغرات: ${s.gaps.join("، ")}`);
    parts.push(lines.join("\n"));
  }
  return parts.join("\n\n");
}

// Build rich website summary from analysis data
function buildWebsiteSummary(wa: any): string {
  if (!wa) return "";
  const lines: string[] = ["تحليل الموقع الإلكتروني:"];
  if (wa.overallScore) lines.push(`  - التقييم العام: ${wa.overallScore}/10`);
  if (wa.loadSpeedScore) lines.push(`  - سرعة التحميل: ${wa.loadSpeedScore}/10`);
  if (wa.seoScore) lines.push(`  - تقييم SEO: ${wa.seoScore}/10`);
  if (wa.mobileExperienceScore) lines.push(`  - تجربة الجوال: ${wa.mobileExperienceScore}/10`);
  if (wa.contentQualityScore) lines.push(`  - جودة المحتوى: ${wa.contentQualityScore}/10`);
  if (wa.summary) lines.push(`  - الملخص: ${wa.summary}`);
  if (Array.isArray(wa.technicalGaps) && wa.technicalGaps.length > 0) lines.push(`  - الثغرات التقنية: ${wa.technicalGaps.join("، ")}`);
  if (Array.isArray(wa.contentGaps) && wa.contentGaps.length > 0) lines.push(`  - ثغرات المحتوى: ${wa.contentGaps.join("، ")}`);
  return lines.join("\n");
}

// Process a single lead analysis
async function analyzeSingleLead(
  leadId: number,
  languageMode: AnalysisLanguageMode,
  db: any
): Promise<void> {
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
  if (!lead) throw new Error("Lead not found");
  const sector: Sector = (lead.sectorMain as Sector | null)
    || detectSectorFromBusinessType(lead.businessType);

  // جلب بيانات Bright Data من قاعدة البيانات
  const [socialData, websiteData] = await Promise.all([
    db.select().from(socialAnalyses).where(eq(socialAnalyses.leadId, leadId)),
    db.select().from(websiteAnalyses).where(eq(websiteAnalyses.leadId, leadId)).limit(1),
  ]);
  const websiteAnalysis = websiteData[0] || null;
  const socialAnalysisSummary = buildSocialSummary(socialData);
  const websiteAnalysisSummary = buildWebsiteSummary(websiteAnalysis);

  // بناء ملخص الملاحظات الإضافية
  const notesContext = lead.notes ? `ملاحظات إضافية من الفريق: ${lead.notes}` : "";

  const prompt = buildSectorAnalysisPrompt({
    companyName: lead.companyName,
    businessType: lead.businessType,
    city: lead.city,
    sector,
    languageMode,
    hasWebsite: !!lead.website,
    hasInstagram: !!lead.instagramUrl,
    hasTwitter: !!lead.twitterUrl,
    hasSnapchat: !!lead.snapchatUrl,
    hasTiktok: !!lead.tiktokUrl,
    hasFacebook: !!lead.facebookUrl,
    hasGoogleMaps: !!lead.googleMapsUrl,
    reviewCount: lead.reviewCount,
    notes: [lead.notes, notesContext].filter(Boolean).join("\n"),
    websiteAnalysis: websiteAnalysisSummary || undefined,
    socialAnalysis: socialAnalysisSummary || undefined,
  });

  await db.update(leads)
    .set({ analysisStatus: "analyzing" as const, bulkAnalysisStatus: "processing" as const })
    .where(eq(leads.id, leadId));

  const response = await invokeLLM({
    messages: [
      { role: "system", content: "أنت محلل تسويق رقمي. أجب بـ JSON فقط." },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" } as any,
  });

  const rawContent = extractContent(response.choices[0]?.message?.content || "");
  const analysis = parseSectorAnalysisResponse(rawContent);

  if (!analysis) throw new Error("Failed to parse analysis response");

  await db.update(leads)
    .set({
      sectorMain: sector,
      analysisStatus: "completed" as const,
      analysisLanguageMode: languageMode,
      bulkAnalysisStatus: "done" as const,
      leadPriorityScore: analysis.leadPriorityScore,
      aiConfidenceScore: analysis.confidenceScore,
      lastAnalyzedAt: Date.now(),
      marketingGapSummary: analysis.marketingGapSummary,
      competitivePosition: analysis.competitivePosition,
      primaryOpportunity: analysis.primaryOpportunity,
      secondaryOpportunity: analysis.secondaryOpportunity,
      urgencyLevel: analysis.urgencyLevel as "high" | "medium" | "low",
      recommendedServices: analysis.recommendedServices,
      salesEntryAngle: analysis.salesEntryAngle,
      iceBreaker: analysis.iceBreaker,
      sectorInsights: analysis.sectorInsights,
      benchmarkComparison: analysis.benchmarkComparison,
      marketingOpportunitiesSummary: analysis.marketingOpportunitiesSummary,
      growthDevelopmentPlan: analysis.growthDevelopmentPlan,
    })
    .where(eq(leads.id, leadId));
}

// Background batch processor
async function processBatch(batchId: string, db: any): Promise<void> {
  const job = activeJobs.get(batchId);
  if (!job) return;

  job.status = "running";

  for (let i = job.processed; i < job.leadIds.length; i++) {
    // Check if paused
    const currentJob = activeJobs.get(batchId);
    if (!currentJob || currentJob.status === "paused") {
      return;
    }

    const leadId = job.leadIds[i];
    try {
      await analyzeSingleLead(leadId, job.languageMode as AnalysisLanguageMode, db);
      job.processed++;
    } catch (err) {
      job.failed++;
      job.processed++;
      job.errors.push({
        leadId,
        error: err instanceof Error ? err.message : "Unknown error",
      });
      // Mark lead as failed
      try {
        await db.update(leads)
          .set({ analysisStatus: "failed" as const, bulkAnalysisStatus: "failed" as const })
          .where(eq(leads.id, leadId));
      } catch {}
    }

    // Small delay between requests to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  job.status = "completed";
}

export const bulkAnalysisRouter = router({
  // بدء تحليل جماعي
  startBatch: protectedProcedure
    .input(z.object({
      leadIds: z.array(z.number()).min(1).max(100),
      languageMode: z.enum(["msa_formal", "saudi_sales_tone", "arabic_sales_brief"]).default("saudi_sales_tone"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const batchId = generateBatchId();

      const job: QueueJob = {
        batchId,
        leadIds: input.leadIds,
        processed: 0,
        failed: 0,
        total: input.leadIds.length,
        status: "idle",
        startedAt: Date.now(),
        languageMode: input.languageMode,
        errors: [],
      };

      activeJobs.set(batchId, job);

      // تحديث حالة العملاء
      await db.update(leads)
        .set({
          bulkAnalysisBatchId: batchId,
          bulkAnalysisStatus: "queued" as const,
        })
        .where(inArray(leads.id, input.leadIds));

      // بدء المعالجة في الخلفية
      processBatch(batchId, db).catch(console.error);

      return {
        batchId,
        total: input.leadIds.length,
        message: `بدأ تحليل ${input.leadIds.length} عميل`,
      };
    }),

  // إيقاف مؤقت للدفعة
  pauseBatch: protectedProcedure
    .input(z.object({ batchId: z.string() }))
    .mutation(async ({ input }) => {
      const job = activeJobs.get(input.batchId);
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "الدفعة غير موجودة" });

      job.status = "paused";
      return { success: true, message: "تم إيقاف التحليل مؤقتاً" };
    }),

  // استئناف الدفعة
  resumeBatch: protectedProcedure
    .input(z.object({ batchId: z.string() }))
    .mutation(async ({ input }) => {
      const job = activeJobs.get(input.batchId);
      if (!job) throw new TRPCError({ code: "NOT_FOUND" });

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      job.status = "running";
      processBatch(input.batchId, db).catch(console.error);

      return { success: true, message: "تم استئناف التحليل" };
    }),

  // حالة الدفعة
  getBatchStatus: protectedProcedure
    .input(z.object({ batchId: z.string() }))
    .query(async ({ input }) => {
      const job = activeJobs.get(input.batchId);
      if (!job) return null;

      const progress = job.total > 0
        ? Math.round((job.processed / job.total) * 100)
        : 0;

      return {
        batchId: job.batchId,
        status: job.status,
        total: job.total,
        processed: job.processed,
        failed: job.failed,
        progress,
        startedAt: job.startedAt,
        errors: job.errors.slice(-5), // آخر 5 أخطاء
      };
    }),

  // جلب العملاء غير المحللين
  getUnanalyzedLeads: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      sector: z.enum(["restaurants", "medical", "ecommerce", "digital_products", "general"]).optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const conditions = [
        or(
          eq(leads.analysisStatus, "pending"),
          eq(leads.analysisStatus, "failed"),
        )
      ];

      if (input.sector) {
        conditions.push(eq(leads.sectorMain, input.sector));
      }

      const unanalyzed = await db.select({
        id: leads.id,
        companyName: leads.companyName,
        businessType: leads.businessType,
        city: leads.city,
        sectorMain: leads.sectorMain,
        analysisStatus: leads.analysisStatus,
      })
        .from(leads)
        .where(and(...conditions))
        .limit(input.limit);

      return unanalyzed;
    }),

  // إحصائيات التحليل الجماعي
  getBulkStats: protectedProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return null;

      const allLeads = await db.select({
        analysisStatus: leads.analysisStatus,
        bulkAnalysisStatus: leads.bulkAnalysisStatus,
      }).from(leads);

      const total = allLeads.length;
      const analyzed = allLeads.filter(l => l.analysisStatus === "completed").length;
      const pending = allLeads.filter(l => l.analysisStatus === "pending").length;
      const analyzing = allLeads.filter(l => l.analysisStatus === "analyzing").length;
      const failed = allLeads.filter(l => l.analysisStatus === "failed").length;

      // Active batches
      const activeBatches = Array.from(activeJobs.values()).filter(
        j => j.status === "running" || j.status === "paused"
      );

      return {
        total,
        analyzed,
        pending,
        analyzing,
        failed,
        analysisRate: total > 0 ? Math.round((analyzed / total) * 100) : 0,
        activeBatches: activeBatches.length,
        activeBatchDetails: activeBatches.map(j => ({
          batchId: j.batchId,
          status: j.status,
          progress: Math.round((j.processed / j.total) * 100),
          total: j.total,
          processed: j.processed,
        })),
      };
    }),

  // تحليل جميع العملاء غير المحللين تلقائياً
  analyzeAllPending: protectedProcedure
    .input(z.object({
      languageMode: z.enum(["msa_formal", "saudi_sales_tone", "arabic_sales_brief"]).default("saudi_sales_tone"),
      maxCount: z.number().min(1).max(100).default(50),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const pendingLeads = await db.select({ id: leads.id })
        .from(leads)
        .where(eq(leads.analysisStatus, "pending"))
        .limit(input.maxCount);

      if (pendingLeads.length === 0) {
        return { message: "لا يوجد عملاء بانتظار التحليل", batchId: null, total: 0 };
      }

      const batchId = generateBatchId();
      const leadIds = pendingLeads.map(l => l.id);

      const job: QueueJob = {
        batchId,
        leadIds,
        processed: 0,
        failed: 0,
        total: leadIds.length,
        status: "idle",
        startedAt: Date.now(),
        languageMode: input.languageMode,
        errors: [],
      };

      activeJobs.set(batchId, job);

      await db.update(leads)
        .set({
          bulkAnalysisBatchId: batchId,
          bulkAnalysisStatus: "queued" as const,
        })
        .where(inArray(leads.id, leadIds));

      processBatch(batchId, db).catch(console.error);

      return {
        batchId,
        total: leadIds.length,
        message: `بدأ التحليل التلقائي لـ ${leadIds.length} عميل`,
      };
    }),
});
