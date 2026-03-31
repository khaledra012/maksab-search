/**
 * SERP Search Queue Router
 * نظام قائمة انتظار متكامل لعمليات البحث
 * - إنشاء مهام بحث وإدارتها
 * - تنفيذ البحث بشكل متوازٍ (6 طلبات)
 * - تخزين النتائج في قاعدة البيانات
 * - تحليل النتائج بالذكاء الاصطناعي
 * - تصدير Excel
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { serpSearchQueue, serpSearchResults } from "../../drizzle/schema";
import { eq, desc, and, or, like, inArray, sql, gte, lte } from "drizzle-orm";
import {
  searchInstagramSERP,
  searchTikTokSERP,
  searchSnapchatSERP,
  searchLinkedInSERP,
  searchFacebookSERP,
  searchTwitterSERP,
} from "./serpSearch";
import { invokeLLM } from "../_core/llm";

// ===== Types =====
type Platform = "instagram" | "tiktok" | "snapchat" | "facebook" | "twitter" | "linkedin";
type LogEntry = { time: string; message: string; type: "info" | "success" | "warning" | "error" };

// ===== Helper: إضافة سجل للمهمة =====
async function appendLog(jobId: number, message: string, type: LogEntry["type"] = "info") {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  const [job] = await db.select({ log: serpSearchQueue.log }).from(serpSearchQueue).where(eq(serpSearchQueue.id, jobId));
  const currentLog: LogEntry[] = (job?.log as LogEntry[]) || [];
  const newEntry: LogEntry = { time: new Date().toISOString(), message, type };
  const updatedLog = [...currentLog.slice(-99), newEntry]; // الاحتفاظ بآخر 100 سجل
  await db.update(serpSearchQueue).set({ log: updatedLog }).where(eq(serpSearchQueue.id, jobId));
}

// ===== Helper: تحديث حالة المهمة =====
async function updateJobStatus(
  jobId: number,
  status: "pending" | "running" | "paused" | "completed" | "failed",
  extra: Record<string, any> = {}
) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  const updates: Record<string, any> = { status, ...extra };
  if (status === "running" && !extra.startedAt) updates.startedAt = new Date();
  if (status === "completed" || status === "failed") updates.completedAt = new Date();
  await db.update(serpSearchQueue).set(updates).where(eq(serpSearchQueue.id, jobId));
}

// ===== Helper: تحليل النتائج بالذكاء الاصطناعي =====
async function analyzeResultsWithAI(
  results: Array<{ username: string; displayName: string; bio: string; url: string }>,
  keyword: string,
  platform: string
): Promise<Array<{
  username: string;
  relevanceScore: number;
  businessType: string;
  priority: "high" | "medium" | "low";
  isContactable: boolean;
}>> {
  if (!results.length) return [];

  try {
    const prompt = `أنت محلل بيانات متخصص في السوق السعودي. قيّم هذه النتائج من ${platform} للبحث عن "${keyword}".

لكل نتيجة، حدد:
1. relevanceScore: درجة الملاءمة من 1-10 (10 = مرتبط جداً بالكلمة المفتاحية)
2. businessType: نوع النشاط التجاري بالعربية (مثال: مطعم، محل ملابس، خدمات تقنية)
3. priority: "high" إذا relevanceScore >= 7، "medium" إذا >= 4، "low" إذا < 4
4. isContactable: true إذا كان في الـ bio رقم هاتف أو بريد أو رابط واتساب

البيانات:
${JSON.stringify(results.slice(0, 15).map(r => ({
  username: r.username,
  displayName: r.displayName,
  bio: r.bio?.slice(0, 200) || "",
})), null, 2)}

أرجع JSON بالشكل التالي فقط:
{"results": [{"username": "...", "relevanceScore": 8, "businessType": "...", "priority": "high", "isContactable": false}]}`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: "أنت محلل بيانات. أرجع JSON فقط بدون أي نص إضافي." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" } as any,
    });

    const content = response?.choices?.[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(typeof content === "string" ? content : "{}");
      if (parsed.results && Array.isArray(parsed.results)) {
        return parsed.results;
      }
    }
  } catch (err) {
    console.warn("[AI Analysis] failed:", err);
  }

  // fallback: تحليل بسيط بدون AI
  return results.map((r) => ({
    username: r.username,
    relevanceScore: 5,
    businessType: keyword,
    priority: "medium" as const,
    isContactable: !!(r.bio && (r.bio.includes("05") || r.bio.includes("+966") || r.bio.includes("@"))),
  }));
}

// ===== Core: تنفيذ البحث لمنصة واحدة =====
async function searchPlatform(
  platform: Platform,
  keyword: string,
  location: string
): Promise<Array<{ username: string; displayName: string; bio: string; url: string }>> {
  switch (platform) {
    case "instagram": return searchInstagramSERP(keyword, location);
    case "tiktok": return searchTikTokSERP(keyword, location);
    case "snapchat": return searchSnapchatSERP(keyword, location);
    case "facebook": return searchFacebookSERP(keyword, location);
    case "twitter": return searchTwitterSERP(keyword, location);
    case "linkedin": return searchLinkedInSERP(keyword, location);
    default: return [];
  }
}

// ===== Core: تنفيذ مهمة بحث كاملة =====
async function executeSearchJob(jobId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

  // جلب تفاصيل المهمة
  const [job] = await db.select().from(serpSearchQueue).where(eq(serpSearchQueue.id, jobId));
  if (!job) throw new Error(`Job ${jobId} not found`);

  await updateJobStatus(jobId, "running");
  await appendLog(jobId, `بدء تنفيذ مهمة البحث: "${job.keyword}" في ${job.location}`, "info");

  const platforms = (job.platforms as Platform[]) || ["instagram", "tiktok", "snapchat"];
  let totalFound = 0;

  try {
    // البحث في كل منصة بالتوازي (مجموعات من 3)
    const platformBatches: Platform[][] = [];
    for (let i = 0; i < platforms.length; i += 3) {
      platformBatches.push(platforms.slice(i, i + 3) as Platform[]);
    }

    for (const batch of platformBatches) {
      // التحقق من حالة المهمة (هل تم إيقافها؟)
      const [currentJob] = await db.select({ status: serpSearchQueue.status }).from(serpSearchQueue).where(eq(serpSearchQueue.id, jobId));
      if (currentJob?.status === "paused" || currentJob?.status === "failed") {
        await appendLog(jobId, "تم إيقاف المهمة", "warning");
        return;
      }

      // تنفيذ البحث في المنصات بالتوازي
      const batchResults = await Promise.allSettled(
        batch.map(async (platform) => {
          await db.update(serpSearchQueue).set({ currentPlatform: platform }).where(eq(serpSearchQueue.id, jobId));
          await appendLog(jobId, `جاري البحث في ${platform}...`, "info");

          const results = await searchPlatform(platform, job.keyword, job.location || "السعودية");
          await appendLog(jobId, `${platform}: وجدت ${results.length} نتيجة`, "success");

          // تحليل النتائج بالذكاء الاصطناعي
          const analyzed = await analyzeResultsWithAI(results, job.keyword, platform);
          const analysisMap = new Map(analyzed.map((a) => [a.username, a]));

          // تخزين النتائج في قاعدة البيانات
          const toInsert = results.map((r) => {
            const analysis = analysisMap.get(r.username);
            return {
              searchQuery: `${job.keyword} ${job.location}`,
              platform: platform as any,
              keyword: job.keyword,
              location: job.location || "السعودية",
              username: r.username,
              displayName: r.displayName || r.username,
              bio: r.bio || null,
              profileUrl: r.url,
              relevanceScore: analysis?.relevanceScore || null,
              businessType: analysis?.businessType || null,
              priority: (analysis?.priority || "medium") as any,
              isContactable: analysis?.isContactable || false,
              jobId: jobId,
            };
          });

          if (toInsert.length > 0) {
            // تجنب التكرار: تحقق من الـ usernames الموجودة
            const existingUsernames = await db
              .select({ username: serpSearchResults.username })
              .from(serpSearchResults)
              .where(
                and(
                  eq(serpSearchResults.platform, platform as any),
                  eq(serpSearchResults.keyword, job.keyword)
                )
              );
            const existingSet = new Set(existingUsernames.map((e) => e.username));
            const newResults = toInsert.filter((r) => !existingSet.has(r.username));

            if (newResults.length > 0) {
              // إدراج على دفعات من 50
              for (let i = 0; i < newResults.length; i += 50) {
                await db.insert(serpSearchResults).values(newResults.slice(i, i + 50));
              }
            }
            return newResults.length;
          }
          return 0;
        })
      );

      // حساب إجمالي النتائج الجديدة
      for (const result of batchResults) {
        if (result.status === "fulfilled") {
          totalFound += result.value;
        } else {
          await appendLog(jobId, `خطأ في أحد المنصات: ${result.reason?.message}`, "error");
        }
      }

      // تحديث إجمالي النتائج
      await db.update(serpSearchQueue).set({ totalFound }).where(eq(serpSearchQueue.id, jobId));
    }

    await updateJobStatus(jobId, "completed", { totalFound, currentPlatform: null });
    await appendLog(jobId, `اكتملت المهمة! إجمالي النتائج الجديدة: ${totalFound}`, "success");
  } catch (err: any) {
    await updateJobStatus(jobId, "failed", { errorMessage: err.message });
    await appendLog(jobId, `فشلت المهمة: ${err.message}`, "error");
    throw err;
  }
}

// ===== Active Jobs Tracker =====
const activeJobs = new Map<number, boolean>();

// ===== Router =====
export const serpQueueRouter = router({
  // إنشاء مهمة بحث جديدة
  createJob: protectedProcedure
    .input(z.object({
      taskName: z.string().min(1).max(200),
      keyword: z.string().min(1).max(200),
      location: z.string().default("السعودية"),
      platforms: z.array(z.enum(["instagram", "tiktok", "snapchat", "facebook", "twitter", "linkedin"])).min(1),
      targetCount: z.number().min(10).max(500).default(50),
      priority: z.number().min(1).max(10).default(5),
      runNow: z.boolean().default(true),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const [job] = await db.insert(serpSearchQueue).values({
        taskName: input.taskName,
        keyword: input.keyword,
        location: input.location,
        platforms: input.platforms,
        targetCount: input.targetCount,
        priority: input.priority,
        status: "pending",
        createdBy: ctx.user.id,
      });

      const jobId = (job as any).insertId as number;

      if (input.runNow) {
        // تنفيذ المهمة في الخلفية (لا ننتظر)
        if (!activeJobs.has(jobId)) {
          activeJobs.set(jobId, true);
          executeSearchJob(jobId)
            .catch((err) => console.error(`[Queue] Job ${jobId} failed:`, err))
            .finally(() => activeJobs.delete(jobId));
        }
      }

      return { jobId, message: "تم إنشاء مهمة البحث بنجاح" };
    }),

  // تشغيل مهمة موجودة
  runJob: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .mutation(async ({ input }) => {
      if (activeJobs.has(input.jobId)) {
        throw new TRPCError({ code: "CONFLICT", message: "المهمة قيد التنفيذ بالفعل" });
      }
      activeJobs.set(input.jobId, true);
      executeSearchJob(input.jobId)
        .catch((err) => console.error(`[Queue] Job ${input.jobId} failed:`, err))
        .finally(() => activeJobs.delete(input.jobId));
      return { message: "تم بدء تنفيذ المهمة" };
    }),

  // إيقاف مهمة
  pauseJob: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      await db.update(serpSearchQueue).set({ status: "paused" }).where(eq(serpSearchQueue.id, input.jobId));
      return { message: "تم إيقاف المهمة" };
    }),

  // حذف مهمة
  deleteJob: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      await db.delete(serpSearchQueue).where(eq(serpSearchQueue.id, input.jobId));
      return { message: "تم حذف المهمة" };
    }),

  // قائمة المهام
  listJobs: protectedProcedure
    .input(z.object({
      status: z.enum(["pending", "running", "paused", "completed", "failed"]).optional(),
      page: z.number().default(1),
      limit: z.number().default(20),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const offset = (input.page - 1) * input.limit;

      const conditions = input.status ? [eq(serpSearchQueue.status, input.status)] : [];
      const jobs = await db
        .select()
        .from(serpSearchQueue)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(serpSearchQueue.createdAt))
        .limit(input.limit)
        .offset(offset);

      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(serpSearchQueue)
        .where(conditions.length ? and(...conditions) : undefined);

      return {
        jobs: jobs.map((j) => ({
          ...j,
          isActive: activeJobs.has(j.id),
        })),
        total: countResult?.count || 0,
      };
    }),

  // تفاصيل مهمة واحدة
  getJob: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const [job] = await db.select().from(serpSearchQueue).where(eq(serpSearchQueue.id, input.jobId));
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "المهمة غير موجودة" });
      return { ...job, isActive: activeJobs.has(job.id) };
    }),

  // نتائج البحث
  getResults: protectedProcedure
    .input(z.object({
      jobId: z.number().optional(),
      platform: z.enum(["instagram", "tiktok", "snapchat", "facebook", "twitter", "linkedin", "google_maps"]).optional(),
      status: z.enum(["new", "reviewed", "converted", "rejected"]).optional(),
      priority: z.enum(["high", "medium", "low"]).optional(),
      isContactable: z.boolean().optional(),
      keyword: z.string().optional(),
      search: z.string().optional(),
      page: z.number().default(1),
      limit: z.number().default(50),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const offset = (input.page - 1) * input.limit;

      const conditions = [];
      if (input.jobId) conditions.push(eq(serpSearchResults.jobId, input.jobId));
      if (input.platform) conditions.push(eq(serpSearchResults.platform, input.platform));
      if (input.status) conditions.push(eq(serpSearchResults.status, input.status));
      if (input.priority) conditions.push(eq(serpSearchResults.priority, input.priority));
      if (input.isContactable !== undefined) conditions.push(eq(serpSearchResults.isContactable, input.isContactable));
      if (input.keyword) conditions.push(eq(serpSearchResults.keyword, input.keyword));
      if (input.search) {
        conditions.push(
          or(
            like(serpSearchResults.username, `%${input.search}%`),
            like(serpSearchResults.displayName, `%${input.search}%`),
            like(serpSearchResults.bio, `%${input.search}%`)
          )
        );
      }

      const results = await db
        .select()
        .from(serpSearchResults)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(serpSearchResults.discoveredAt))
        .limit(input.limit)
        .offset(offset);

      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(serpSearchResults)
        .where(conditions.length ? and(...conditions) : undefined);

      return {
        results,
        total: countResult?.count || 0,
        page: input.page,
        totalPages: Math.ceil((countResult?.count || 0) / input.limit),
      };
    }),

  // إحصائيات النتائج
  getStats: protectedProcedure
    .input(z.object({ jobId: z.number().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const conditions = input.jobId ? [eq(serpSearchResults.jobId, input.jobId)] : [];

      const [total] = await db
        .select({ count: sql<number>`count(*)` })
        .from(serpSearchResults)
        .where(conditions.length ? and(...conditions) : undefined);

      const byPlatform = await db
        .select({
          platform: serpSearchResults.platform,
          count: sql<number>`count(*)`,
        })
        .from(serpSearchResults)
        .where(conditions.length ? and(...conditions) : undefined)
        .groupBy(serpSearchResults.platform);

      const byPriority = await db
        .select({
          priority: serpSearchResults.priority,
          count: sql<number>`count(*)`,
        })
        .from(serpSearchResults)
        .where(conditions.length ? and(...conditions) : undefined)
        .groupBy(serpSearchResults.priority);

      const [contactable] = await db
        .select({ count: sql<number>`count(*)` })
        .from(serpSearchResults)
        .where(
          conditions.length
            ? and(...conditions, eq(serpSearchResults.isContactable, true))
            : eq(serpSearchResults.isContactable, true)
        );

      return {
        total: total?.count || 0,
        contactable: contactable?.count || 0,
        byPlatform: Object.fromEntries(byPlatform.map((r) => [r.platform, r.count])),
        byPriority: Object.fromEntries(byPriority.map((r) => [r.priority, r.count])),
      };
    }),

  // تحديث حالة نتيجة
  updateResultStatus: protectedProcedure
    .input(z.object({
      resultId: z.number(),
      status: z.enum(["new", "reviewed", "converted", "rejected"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      await db
        .update(serpSearchResults)
        .set({ status: input.status, reviewedAt: new Date() })
        .where(eq(serpSearchResults.id, input.resultId));
      return { message: "تم تحديث الحالة" };
    }),

  // بحث سريع (بدون حفظ في قائمة الانتظار)
  quickSearch: protectedProcedure
    .input(z.object({
      keyword: z.string().min(1),
      location: z.string().default("السعودية"),
      platforms: z.array(z.enum(["instagram", "tiktok", "snapchat", "facebook", "twitter", "linkedin"])).min(1),
    }))
    .mutation(async ({ input }) => {
      const results: Record<string, any[]> = {};

      const searchPromises = input.platforms.map(async (platform) => {
        try {
          const platformResults = await searchPlatform(platform as Platform, input.keyword, input.location);
          results[platform] = platformResults;
        } catch (err: any) {
          results[platform] = [];
          console.warn(`[Quick Search] ${platform} failed:`, err.message);
        }
      });

      await Promise.allSettled(searchPromises);

      const total = Object.values(results).reduce((sum, arr) => sum + arr.length, 0);
      return { results, total };
    }),

  // تصدير نتائج (للـ Excel - يرجع البيانات الكاملة)
  exportResults: protectedProcedure
    .input(z.object({
      jobId: z.number().optional(),
      platform: z.enum(["instagram", "tiktok", "snapchat", "facebook", "twitter", "linkedin", "google_maps"]).optional(),
      status: z.enum(["new", "reviewed", "converted", "rejected"]).optional(),
      priority: z.enum(["high", "medium", "low"]).optional(),
      isContactable: z.boolean().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const conditions = [];
      if (input.jobId) conditions.push(eq(serpSearchResults.jobId, input.jobId));
      if (input.platform) conditions.push(eq(serpSearchResults.platform, input.platform));
      if (input.status) conditions.push(eq(serpSearchResults.status, input.status));
      if (input.priority) conditions.push(eq(serpSearchResults.priority, input.priority));
      if (input.isContactable !== undefined) conditions.push(eq(serpSearchResults.isContactable, input.isContactable));

      const results = await db
        .select()
        .from(serpSearchResults)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(serpSearchResults.relevanceScore), desc(serpSearchResults.discoveredAt))
        .limit(10000); // حد أقصى 10,000 نتيجة

      return results;
    }),
});
