/**
 * Marketing Seasons Router
 * إدارة المواسم التسويقية وربطها بأنواع الأنشطة
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { marketingSeasons } from "../../drizzle/schema";
import { eq, asc, desc, and, or, isNull } from "drizzle-orm";

// ===== Helper: جلب الموسم الحالي بناءً على التاريخ ونوع النشاط =====
export async function getActiveSeasonForBusiness(businessType: string): Promise<typeof marketingSeasons.$inferSelect | null> {
  const db = await getDb();
  if (!db) return null;

  const today = new Date();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const todayStr = `${mm}-${dd}`;
  const currentYear = today.getFullYear();

  const allSeasons = await db
    .select()
    .from(marketingSeasons)
    .where(eq(marketingSeasons.isActive, true))
    .orderBy(asc(marketingSeasons.priority));

  // فلترة المواسم النشطة حالياً
  const activeSeasons = allSeasons.filter((season) => {
    // فحص السنة إذا كانت محددة
    if (season.year && season.year !== currentYear) return false;

    // فحص التاريخ (MM-DD)
    const start = season.startDate;
    const end = season.endDate;

    // حالة عادية: البداية < النهاية (نفس السنة)
    if (start <= end) {
      if (todayStr < start || todayStr > end) return false;
    } else {
      // حالة التقاطع مع نهاية السنة (مثل: رمضان قد يمتد)
      if (todayStr < start && todayStr > end) return false;
    }

    // فحص نوع النشاط
    const related = season.relatedBusinessTypes as string[] | null;
    if (!related || related.length === 0) return true; // يشمل الكل

    const bt = businessType?.toLowerCase() || "";
    return related.some((r) => bt.includes(r.toLowerCase()) || r.toLowerCase().includes(bt));
  });

  return activeSeasons.length > 0 ? activeSeasons[0] : null;
}

// ===== Helper: جلب المواسم القادمة خلال 30 يوم =====
export async function getUpcomingSeasonsForBusiness(businessType: string): Promise<typeof marketingSeasons.$inferSelect[]> {
  const db = await getDb();
  if (!db) return [];

  const today = new Date();
  const future = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const todayStr = `${mm}-${dd}`;
  const fmm = String(future.getMonth() + 1).padStart(2, "0");
  const fdd = String(future.getDate()).padStart(2, "0");
  const futureStr = `${fmm}-${fdd}`;

  const allSeasons = await db
    .select()
    .from(marketingSeasons)
    .where(eq(marketingSeasons.isActive, true))
    .orderBy(asc(marketingSeasons.startDate));

  return allSeasons.filter((season) => {
    const start = season.startDate;
    // قادم خلال 30 يوم
    if (start <= todayStr || start > futureStr) return false;

    const related = season.relatedBusinessTypes as string[] | null;
    if (!related || related.length === 0) return true;
    const bt = businessType?.toLowerCase() || "";
    return related.some((r) => bt.includes(r.toLowerCase()) || r.toLowerCase().includes(bt));
  });
}

// ===== Router =====
export const seasonsRouter = router({
  // جلب كل المواسم
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(marketingSeasons).orderBy(asc(marketingSeasons.priority), asc(marketingSeasons.startDate));
  }),

  // جلب موسم واحد
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const result = await db.select().from(marketingSeasons).where(eq(marketingSeasons.id, input.id)).limit(1);
      if (!result[0]) throw new TRPCError({ code: "NOT_FOUND", message: "الموسم غير موجود" });
      return result[0];
    }),

  // إنشاء موسم جديد
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(2, "اسم الموسم مطلوب"),
      startDate: z.string().regex(/^\d{2}-\d{2}$/, "صيغة التاريخ: MM-DD"),
      endDate: z.string().regex(/^\d{2}-\d{2}$/, "صيغة التاريخ: MM-DD"),
      year: z.number().optional().nullable(),
      opportunities: z.array(z.string()).min(1, "أضف فرصة تسويقية واحدة على الأقل"),
      relatedBusinessTypes: z.array(z.string()).optional().nullable(),
      description: z.string().optional().nullable(),
      color: z.string().optional(),
      icon: z.string().optional(),
      isActive: z.boolean().optional(),
      priority: z.number().min(1).max(10).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const result = await db.insert(marketingSeasons).values({
        name: input.name,
        startDate: input.startDate,
        endDate: input.endDate,
        year: input.year ?? null,
        opportunities: input.opportunities,
        relatedBusinessTypes: input.relatedBusinessTypes ?? null,
        description: input.description ?? null,
        color: input.color ?? "#f59e0b",
        icon: input.icon ?? "🌙",
        isActive: input.isActive ?? true,
        priority: input.priority ?? 5,
      });
      return { success: true, id: (result[0] as any).insertId };
    }),

  // تحديث موسم
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(2).optional(),
      startDate: z.string().regex(/^\d{2}-\d{2}$/).optional(),
      endDate: z.string().regex(/^\d{2}-\d{2}$/).optional(),
      year: z.number().optional().nullable(),
      opportunities: z.array(z.string()).optional(),
      relatedBusinessTypes: z.array(z.string()).optional().nullable(),
      description: z.string().optional().nullable(),
      color: z.string().optional(),
      icon: z.string().optional(),
      isActive: z.boolean().optional(),
      priority: z.number().min(1).max(10).optional(),
      urgencyText: z.string().optional().nullable(),
      tipText: z.string().optional().nullable(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...data } = input;
      const updateData: Record<string, any> = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.startDate !== undefined) updateData.startDate = data.startDate;
      if (data.endDate !== undefined) updateData.endDate = data.endDate;
      if (data.year !== undefined) updateData.year = data.year;
      if (data.opportunities !== undefined) updateData.opportunities = data.opportunities;
      if (data.relatedBusinessTypes !== undefined) updateData.relatedBusinessTypes = data.relatedBusinessTypes;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.color !== undefined) updateData.color = data.color;
      if (data.icon !== undefined) updateData.icon = data.icon;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;
      if (data.priority !== undefined) updateData.priority = data.priority;
      if (data.urgencyText !== undefined) updateData.urgency_text = data.urgencyText;
      if (data.tipText !== undefined) updateData.tip_text = data.tipText;
      await db.update(marketingSeasons).set(updateData).where(eq(marketingSeasons.id, id));
      return { success: true };
    }),

  // حذف موسم
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(marketingSeasons).where(eq(marketingSeasons.id, input.id));
      return { success: true };
    }),

  // جلب الموسم النشط لنوع نشاط معين
  getActiveForBusiness: protectedProcedure
    .input(z.object({ businessType: z.string() }))
    .query(async ({ input }) => {
      const active = await getActiveSeasonForBusiness(input.businessType);
      const upcoming = await getUpcomingSeasonsForBusiness(input.businessType);
      return { active, upcoming };
    }),

  // إضافة مواسم افتراضية سعودية
  seedDefaults: protectedProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const existing = await db.select().from(marketingSeasons).limit(1);
    if (existing.length > 0) return { success: true, message: "المواسم الافتراضية موجودة مسبقاً" };

    const defaults = [
      {
        name: "شهر رمضان المبارك",
        startDate: "02-28",
        endDate: "03-30",
        year: null,
        opportunities: [
          "إطلاق عروض رمضانية حصرية مع خصومات تصل 40%",
          "حملات إعلانية في أوقات الذروة (بعد الإفطار والسحور)",
          "محتوى روحاني وقيمي يعزز الانتماء للعلامة التجارية",
          "تقديم باقات هدايا وعروض العائلة",
          "تفعيل برامج الولاء والنقاط الرمضانية",
          "الاستفادة من ارتفاع معدلات التصفح الليلي",
        ],
        relatedBusinessTypes: null,
        description: "أهم موسم تسويقي في السوق السعودي — ارتفاع الإنفاق الاستهلاكي بنسبة 30-50%",
        color: "#8b5cf6",
        icon: "🌙",
        priority: 1,
      },
      {
        name: "اليوم الوطني السعودي",
        startDate: "09-15",
        endDate: "09-25",
        year: null,
        opportunities: [
          "إطلاق منتجات وتصاميم بألوان العلم السعودي",
          "حملات بالهوية الوطنية والفخر السعودي",
          "عروض وخصومات احتفالية خاصة باليوم الوطني",
          "محتوى يبرز الإنجازات الوطنية ورؤية 2030",
          "مسابقات وتفاعل مع الجمهور حول الهوية الوطنية",
        ],
        relatedBusinessTypes: null,
        description: "اليوم الوطني للمملكة العربية السعودية — 23 سبتمبر",
        color: "#22c55e",
        icon: "🇸🇦",
        priority: 2,
      },
      {
        name: "موسم الصيف",
        startDate: "06-01",
        endDate: "08-31",
        year: null,
        opportunities: [
          "استهداف العائلات المسافرة والمصطافين",
          "عروض الأطفال والترفيه العائلي",
          "حملات السفر والسياحة الداخلية",
          "تخفيضات الصيف الكبرى",
          "محتوى الأنشطة الصيفية والترفيه",
        ],
        relatedBusinessTypes: ["مطعم", "كافيه", "ترفيه", "سياحة", "ملابس", "رياضة"],
        description: "موسم الصيف — ارتفاع الطلب على الترفيه والسفر والمطاعم",
        color: "#f59e0b",
        icon: "☀️",
        priority: 3,
      },
      {
        name: "موسم العودة للمدارس",
        startDate: "08-15",
        endDate: "09-10",
        year: null,
        opportunities: [
          "عروض المستلزمات المدرسية والقرطاسية",
          "باقات الملابس والأحذية المدرسية",
          "خدمات التوصيل والدروس الخصوصية",
          "عروض الأجهزة الإلكترونية للطلاب",
          "حملات الأسرة والاستعداد للعام الدراسي",
        ],
        relatedBusinessTypes: ["تعليم", "ملابس", "إلكترونيات", "قرطاسية", "نقل"],
        description: "موسم العودة للمدارس — ارتفاع الإنفاق على المستلزمات التعليمية",
        color: "#3b82f6",
        icon: "🎒",
        priority: 4,
      },
      {
        name: "موسم الأعياد (عيد الفطر والأضحى)",
        startDate: "03-28",
        endDate: "04-10",
        year: null,
        opportunities: [
          "باقات هدايا العيد والتغليف الاحتفالي",
          "عروض الملابس والأزياء العيدية",
          "خدمات توصيل الهدايا والبوكيهات",
          "حملات التهنئة والمشاركة العاطفية",
          "عروض المطاعم والحلويات العيدية",
          "تخفيضات عيد الفطر على جميع المنتجات",
        ],
        relatedBusinessTypes: null,
        description: "موسم أعياد الفطر والأضحى — أعلى معدلات الإنفاق الاحتفالي",
        color: "#ef4444",
        icon: "🎉",
        priority: 1,
      },
      {
        name: "موسم الشتاء والأمطار",
        startDate: "11-01",
        endDate: "02-28",
        year: null,
        opportunities: [
          "عروض الملابس الشتوية والمعاطف",
          "خدمات التدفئة والمنزل",
          "المطاعم والمشروبات الساخنة",
          "السياحة الداخلية في المناطق الباردة",
          "عروض السفر إلى المناطق الدافئة",
        ],
        relatedBusinessTypes: ["ملابس", "مطعم", "كافيه", "سياحة", "منزل"],
        description: "موسم الشتاء — ارتفاع الطلب على المنتجات الشتوية والترفيه الداخلي",
        color: "#6366f1",
        icon: "❄️",
        priority: 5,
      },
      {
        name: "موسم الجمعة البيضاء (Black Friday)",
        startDate: "11-20",
        endDate: "11-30",
        year: null,
        opportunities: [
          "تخفيضات كبرى تصل 70% على جميع المنتجات",
          "حملات إعلانية مكثفة قبل الموسم بأسبوعين",
          "عروض حصرية للمشتركين والعملاء الدائمين",
          "باقات مجمعة بأسعار استثنائية",
          "تفعيل قوائم الانتظار والإشعارات المبكرة",
        ],
        relatedBusinessTypes: null,
        description: "الجمعة البيضاء — أكبر موسم تخفيضات في المملكة",
        color: "#1e293b",
        icon: "🛍️",
        priority: 2,
      },
    ];

    for (const s of defaults) {
      await db.insert(marketingSeasons).values(s as any);
    }

    return { success: true, message: `تم إضافة ${defaults.length} مواسم افتراضية` };
  }),
});
