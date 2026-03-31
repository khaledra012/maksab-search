import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { leads } from "../../drizzle/schema";
import { sql, isNull, or } from "drizzle-orm";

const EMPTY_STATS = {
  total: 0, withPhone: 0, withWebsite: 0, withSocial: 0,
  completeness: 0, missingPhone: 0, duplicates: 0,
  phoneRate: 0, websiteRate: 0,
  withGoogleMaps: 0, googleMapsRate: 0,
  withWhatsapp: 0, whatsappRate: 0,
  withInstagram: 0, instagramRate: 0,
  withSnapchat: 0, snapchatRate: 0,
  withTiktok: 0, tiktokRate: 0,
  withAnalysis: 0, analysisRate: 0,
  phoneByCity: [] as { city: string; phoneRate: number; total: number; withPhone: number }[],
  monthlyAdded: [] as { month: string; count: number }[],
  byStage: [] as { stage: string; count: number; percentage: number }[],
  byCity: [] as { city: string; count: number; percentage: number }[],
  qualityDistribution: { excellent: 0, good: 0, fair: 0, poor: 0 },
};

export const dataQualityRouter = router({
  stats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return EMPTY_STATS;

    const [total, withPhone, withWebsite, withSocial, missingPhone] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(leads),
      db.select({ count: sql<number>`count(*)` }).from(leads).where(
        sql`${leads.verifiedPhone} IS NOT NULL AND ${leads.verifiedPhone} != ''`
      ),
      db.select({ count: sql<number>`count(*)` }).from(leads).where(
        sql`${leads.website} IS NOT NULL AND ${leads.website} != ''`
      ),
      db.select({ count: sql<number>`count(*)` }).from(leads).where(
        sql`(${leads.instagramUrl} IS NOT NULL AND ${leads.instagramUrl} != '') OR (${leads.twitterUrl} IS NOT NULL AND ${leads.twitterUrl} != '')`
      ),
      db.select({ count: sql<number>`count(*)` }).from(leads).where(
        or(isNull(leads.verifiedPhone), sql`${leads.verifiedPhone} = ''`)
      ),
    ]);

    const totalCount = total[0]?.count ?? 0;
    const withPhoneCount = withPhone[0]?.count ?? 0;
    const withWebsiteCount = withWebsite[0]?.count ?? 0;
    const withSocialCount = withSocial[0]?.count ?? 0;

    const completeness = totalCount > 0
      ? Math.round(((withPhoneCount + withWebsiteCount) / (totalCount * 2)) * 100)
      : 0;

    const phoneRate = totalCount > 0 ? Math.round((withPhoneCount / totalCount) * 100) : 0;
    const websiteRate = totalCount > 0 ? Math.round((withWebsiteCount / totalCount) * 100) : 0;
    const instagramRate = totalCount > 0 ? Math.round((withSocialCount / totalCount) * 100) : 0;

    // تقدير توزيع الجودة
    const excellent = Math.round(totalCount * 0.2);
    const good = Math.round(totalCount * 0.3);
    const fair = Math.round(totalCount * 0.3);
    const poor = totalCount - excellent - good - fair;

    return {
      total: totalCount,
      withPhone: withPhoneCount,
      withWebsite: withWebsiteCount,
      withSocial: withSocialCount,
      completeness,
      missingPhone: missingPhone[0]?.count ?? 0,
      duplicates: 0,
      phoneRate,
      websiteRate,
      withGoogleMaps: 0,
      googleMapsRate: 0,
      withWhatsapp: 0,
      whatsappRate: 0,
      withInstagram: withSocialCount,
      instagramRate,
      withSnapchat: 0,
      snapchatRate: 0,
      withTiktok: 0,
      tiktokRate: 0,
      withAnalysis: 0,
      analysisRate: 0,
      phoneByCity: [] as { city: string; phoneRate: number; total: number; withPhone: number }[],
      monthlyAdded: [] as { month: string; count: number }[],
      byStage: [] as { stage: string; count: number; percentage: number }[],
      byCity: [] as { city: string; count: number; percentage: number }[],
      qualityDistribution: { excellent, good, fair, poor },
    };
  }),

  getIncomplete: protectedProcedure
    .input(z.object({
      field: z.enum(["phone", "website", "social", "district"]).optional(),
      limit: z.number().default(50),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const field = input?.field || "phone";
      let condition;
      if (field === "phone") {
        condition = or(isNull(leads.verifiedPhone), sql`${leads.verifiedPhone} = ''`);
      } else if (field === "website") {
        condition = or(isNull(leads.website), sql`${leads.website} = ''`);
      } else if (field === "social") {
        condition = sql`(${leads.instagramUrl} IS NULL OR ${leads.instagramUrl} = '') AND (${leads.twitterUrl} IS NULL OR ${leads.twitterUrl} = '')`;
      } else {
        condition = or(isNull(leads.district), sql`${leads.district} = ''`);
      }

      return db.select({
        id: leads.id,
        companyName: leads.companyName,
        businessType: leads.businessType,
        city: leads.city,
        verifiedPhone: leads.verifiedPhone,
        website: leads.website,
      }).from(leads)
        .where(condition)
        .limit(input?.limit || 50);
    }),

  getDuplicates: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];

    const duplicates = await db.execute(sql`
      SELECT verifiedPhone, COUNT(*) as count
      FROM leads
      WHERE verifiedPhone IS NOT NULL AND verifiedPhone != ''
      GROUP BY verifiedPhone
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 20
    `);

    return (duplicates as any[])[0] || [];
  }),
});
