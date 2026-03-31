import { z } from "zod";
import { eq } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { companySettings } from "../../drizzle/schema";
import { storagePut } from "../storage";
import { nanoid } from "nanoid";

export const companySettingsRouter = router({
  // جلب إعدادات الشركة
  get: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const [row] = await db.select().from(companySettings).limit(1);
    if (!row) {
      // إنشاء صف افتراضي إذا لم يكن موجوداً
      await db.insert(companySettings).values({
        companyName: "مكسب KSA",
        city: "الرياض",
        region: "المنطقة الوسطى",
      });
      const [newRow] = await db.select().from(companySettings).limit(1);
      return newRow ?? null;
    }
    return row;
  }),

  // حفظ إعدادات الشركة
  save: protectedProcedure
    .input(
      z.object({
        companyName: z.string().min(1).max(200),
        companyDescription: z.string().max(1000).optional(),
        city: z.string().max(100).optional(),
        region: z.string().max(100).optional(),
        phone: z.string().max(30).optional(),
        email: z.string().max(200).optional().or(z.literal("")),
        website: z.string().max(300).optional(),
        logoUrl: z.string().max(2000).optional(),
        primaryColor: z.string().max(20).optional(),
        secondaryColor: z.string().max(20).optional(),
        reportHeaderText: z.string().max(500).optional(),
        reportFooterText: z.string().max(500).optional(),
        reportIntroText: z.string().max(1000).optional(),
        licenseNumber: z.string().max(100).optional(),
        commercialRegistration: z.string().max(50).optional(),
        analystName: z.string().max(100).optional(),
        analystTitle: z.string().max(100).optional(),
        address: z.string().max(500).optional(),
        instagramUrl: z.string().max(300).optional(),
        twitterUrl: z.string().max(300).optional(),
        linkedinUrl: z.string().max(300).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [existing] = await db.select({ id: companySettings.id }).from(companySettings).limit(1);
      const data = {
        companyName: input.companyName,
        companyDescription: input.companyDescription || null,
        city: input.city || null,
        region: input.region || null,
        phone: input.phone || null,
        email: input.email || null,
        website: input.website || null,
        logoUrl: input.logoUrl || null,
        primaryColor: input.primaryColor || "#1a56db",
        secondaryColor: input.secondaryColor || "#0e9f6e",
        reportHeaderText: input.reportHeaderText || null,
        reportFooterText: input.reportFooterText || null,
        reportIntroText: input.reportIntroText || null,
        licenseNumber: input.licenseNumber || null,
        commercialRegistration: input.commercialRegistration || null,
        analystName: input.analystName || null,
        analystTitle: input.analystTitle || null,
        address: input.address || null,
        instagramUrl: input.instagramUrl || null,
        twitterUrl: input.twitterUrl || null,
        linkedinUrl: input.linkedinUrl || null,
      };
      if (existing) {
        await db.update(companySettings).set(data).where(eq(companySettings.id, existing.id));
      } else {
        await db.insert(companySettings).values(data);
      }
      return { success: true };
    }),

  // رفع شعار الشركة إلى موفر التخزين النشط
  uploadLogo: protectedProcedure
    .input(z.object({
      base64: z.string(),
      mimeType: z.string().default("image/png"),
    }))
    .mutation(async ({ input }) => {
      const base64Data = input.base64.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const ext = input.mimeType.split("/")[1] || "png";
      const key = `company-logos/logo-${nanoid(8)}.${ext}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [existing] = await db.select({ id: companySettings.id }).from(companySettings).limit(1);
      if (existing) {
        await db.update(companySettings).set({ logoUrl: url }).where(eq(companySettings.id, existing.id));
      } else {
        await db.insert(companySettings).values({ companyName: "مكسب KSA", logoUrl: url });
      }
      return { url };
    }),
});
