/**
 * Report Style Settings Router
 * إعدادات أسلوب كتابة التقارير والتعليق على الفرص
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { reportStyleSettings } from "../../drizzle/schema";

// ===== Helper: جلب الإعدادات (أو إنشاء الافتراضية) =====
export async function getReportStyleSettings() {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(reportStyleSettings).limit(1);
  if (rows.length > 0) return rows[0];
  // إنشاء إعدادات افتراضية إذا لم تكن موجودة
  const [inserted] = await db.insert(reportStyleSettings).values({
    tone: "professional",
    brandKeywords: [],
    customInstructions: "",
    opportunityCommentStyle: "",
    mentionCompanyName: true,
    closingStatement: "",
    includeSeasonSection: true,
    includeCompetitorsSection: true,
    detailLevel: "standard",
  });
  const newRows = await db.select().from(reportStyleSettings).limit(1);
  return newRows[0] || null;
}

// ===== Router =====
export const reportStyleRouter = router({
  // جلب الإعدادات
  get: protectedProcedure.query(async () => {
    return getReportStyleSettings();
  }),

  // حفظ الإعدادات
  save: protectedProcedure
    .input(
      z.object({
        tone: z.enum(["professional", "friendly", "direct", "consultative"]).optional(),
        brandKeywords: z.array(z.string()).optional(),
        customInstructions: z.string().optional(),
        opportunityCommentStyle: z.string().optional(),
        mentionCompanyName: z.boolean().optional(),
        closingStatement: z.string().optional(),
        includeSeasonSection: z.boolean().optional(),
        includeCompetitorsSection: z.boolean().optional(),
        detailLevel: z.enum(["brief", "standard", "detailed"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      const existing = await getReportStyleSettings();
      if (existing) {
        await db
          .update(reportStyleSettings)
          .set({ ...input, updatedAt: new Date() })
          .where(
            (await import("drizzle-orm")).eq(reportStyleSettings.id, existing.id)
          );
      } else {
        await db.insert(reportStyleSettings).values({
          tone: input.tone || "professional",
          brandKeywords: input.brandKeywords || [],
          customInstructions: input.customInstructions || "",
          opportunityCommentStyle: input.opportunityCommentStyle || "",
          mentionCompanyName: input.mentionCompanyName ?? true,
          closingStatement: input.closingStatement || "",
          includeSeasonSection: input.includeSeasonSection ?? true,
          includeCompetitorsSection: input.includeCompetitorsSection ?? true,
          detailLevel: input.detailLevel || "standard",
        });
      }
      return { success: true };
    }),
});
