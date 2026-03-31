import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { searchBehaviorLogs, searchBehaviorPatterns } from "../../drizzle/schema";
import { eq, desc, sql } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";

export const searchBehaviorRouter = router({
  // تسجيل جلسة بحث
  logSearchSession: protectedProcedure
    .input(z.object({
      platform: z.string(),
      query: z.string(),
      filters: z.union([z.string(), z.record(z.string(), z.any())]).optional(),
      resultsCount: z.number().default(0),
      selectedResults: z.union([z.string(), z.record(z.string(), z.any()), z.array(z.any())]).optional(),
      addedToLeads: z.number().default(0),
      sessionDuration: z.number().default(0),
      scrollDepth: z.number().default(0),
      searchSuccess: z.boolean().default(true),
      clickPattern: z.any().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // تحويل filters وselectedResults إلى string إذا كانت object
      const filtersStr = input.filters
        ? (typeof input.filters === "string" ? input.filters : JSON.stringify(input.filters))
        : undefined;
      const selectedStr = input.selectedResults
        ? (typeof input.selectedResults === "string" ? input.selectedResults : JSON.stringify(input.selectedResults))
        : undefined;

      await db.insert(searchBehaviorLogs).values({
        userId: ctx.user!.id,
        platform: input.platform,
        query: input.query,
        filters: filtersStr,
        resultsCount: input.resultsCount,
        selectedResults: selectedStr,
        addedToLeads: input.addedToLeads,
        sessionDuration: input.sessionDuration,
        scrollDepth: input.scrollDepth,
        searchSuccess: input.searchSuccess,
      });

      return { success: true };
    }),

  // تحسين استعلام البحث بالذكاء الاصطناعي
  enhanceQuery: protectedProcedure
    .input(z.object({
      query: z.string(),
      platform: z.string().optional(),
      context: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "أنت خبير في تحسين استعلامات البحث للسوق السعودي. أعطِ اقتراحات محسّنة للبحث.",
          },
          {
            role: "user",
            content: `حسّن استعلام البحث التالي للمنصة ${input.platform || "عامة"}:\n"${input.query}"\n\nأعطِ 3 اقتراحات محسّنة مختصرة.`,
          },
        ],
      });

      const content = response.choices[0]?.message?.content;
      const text = typeof content === "string" ? content : "";

      return {
        original: input.query,
        enhanced: text,
        suggestions: text.split("\n").filter(s => s.trim()).slice(0, 3),
      };
    }),

  // الحصول على أنماط السلوك
  getBehaviorPatterns: protectedProcedure
    .input(z.object({ platform: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      if (input?.platform) {
        return db.select().from(searchBehaviorPatterns)
          .where(eq(searchBehaviorPatterns.platform, input.platform))
          .orderBy(desc(searchBehaviorPatterns.updatedAt));
      }

      return db.select().from(searchBehaviorPatterns)
        .orderBy(desc(searchBehaviorPatterns.updatedAt))
        .limit(50);
    }),

  // الحصول على اقتراحات ذكية
  getSmartSuggestions: protectedProcedure
    .input(z.object({
      query: z.string().optional(),
      platform: z.string().optional(),
      limit: z.number().default(5),
    }).optional())
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { suggestions: [], topQueries: [] };

      // استخراج أكثر الاستعلامات استخداماً
      const topLogs = await db.select({
        query: searchBehaviorLogs.query,
        count: sql<number>`count(*)`,
      }).from(searchBehaviorLogs)
        .where(eq(searchBehaviorLogs.userId, ctx.user!.id))
        .groupBy(searchBehaviorLogs.query)
        .orderBy(desc(sql`count(*)`))
        .limit(input?.limit ?? 5);

      const topQueries = topLogs.map(l => l.query);

      // اقتراحات بناءً على الاستعلام الحالي
      const suggestions = input?.query
        ? topQueries.filter(q => q.toLowerCase().includes((input.query || "").toLowerCase())).slice(0, 3)
        : topQueries.slice(0, 5);

      return { suggestions, topQueries };
    }),

  // إحصائيات السلوك
  getStats: protectedProcedure
    .input(z.object({ days: z.number().default(30) }).optional())
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { totalSearches: 0, successRate: 0, avgLeadsAdded: 0, topPlatforms: [] };

      const logs = await db.select().from(searchBehaviorLogs)
        .where(eq(searchBehaviorLogs.userId, ctx.user!.id))
        .orderBy(desc(searchBehaviorLogs.createdAt))
        .limit(1000);

      const totalSearches = logs.length;
      const successCount = logs.filter(l => l.searchSuccess).length;
      const successRate = totalSearches > 0 ? Math.round((successCount / totalSearches) * 100) : 0;
      const avgLeadsAdded = totalSearches > 0
        ? Math.round(logs.reduce((s, l) => s + (l.addedToLeads ?? 0), 0) / totalSearches)
        : 0;

      // أكثر المنصات استخداماً
      const platformCounts: Record<string, number> = {};
      logs.forEach(l => {
        platformCounts[l.platform] = (platformCounts[l.platform] || 0) + 1;
      });
      const topPlatforms = Object.entries(platformCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([platform, count]) => ({ platform, count }));

      return { totalSearches, successRate, avgLeadsAdded, topPlatforms };
    }),
});
