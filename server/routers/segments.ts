/**
 * نظام الشرائح (Segments) - تقسيم العملاء لمجموعات مستهدفة
 * مع تحديد أوقات الإرسال المثلى والفلترة المتقدمة
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { TRPCError } from "@trpc/server";
import { eq, desc, and, inArray, sql, count } from "drizzle-orm";
import { segments, leadSegments, leads } from "../../drizzle/schema";

// ===== Zod Schemas =====
const OptimalTimeSchema = z.object({
  day: z.number().min(0).max(6), // 0=Sunday ... 6=Saturday
  hour: z.number().min(0).max(23),
  label: z.string(), // e.g. "الأحد 9 صباحاً"
});

const FilterCriteriaSchema = z.object({
  cities: z.array(z.string()).optional(),
  sources: z.array(z.string()).optional(),
  statuses: z.array(z.string()).optional(),
  minInterestScore: z.number().min(0).max(100).optional(),
  hasWhatsapp: z.boolean().optional(),
  country: z.string().optional(),
});

export const segmentsRouter = router({
  // ===== جلب كل الشرائح مع عدد العملاء =====
  list: protectedProcedure.query(async () => {
    const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not ready" });
    const allSegments = await db
      .select()
      .from(segments)
      .orderBy(desc(segments.createdAt));

    // جلب عدد العملاء لكل شريحة
    const counts = await db
      .select({
        segmentId: leadSegments.segmentId,
        count: count(leadSegments.id),
      })
      .from(leadSegments)
      .groupBy(leadSegments.segmentId);

    const countMap = new Map(counts.map((c) => [c.segmentId, c.count]));

    return allSegments.map((seg) => ({
      ...seg,
      leadCount: countMap.get(seg.id) ?? 0,
    }));
  }),

  // ===== جلب شريحة واحدة مع عملائها =====
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not ready" });
      const [segment] = await db
        .select()
        .from(segments)
        .where(eq(segments.id, input.id))
        .limit(1);

      if (!segment) throw new TRPCError({ code: "NOT_FOUND", message: "الشريحة غير موجودة" });

      // جلب العملاء المرتبطين بالشريحة
      const segmentLeads = await db
        .select({
          id: leads.id,
          companyName: leads.companyName,
          phone: leads.verifiedPhone,
          city: leads.city,
          businessType: leads.businessType,
          hasWhatsapp: leads.hasWhatsapp,
          addedAt: leadSegments.addedAt,
        })
        .from(leadSegments)
        .innerJoin(leads, eq(leadSegments.leadId, leads.id))
        .where(eq(leadSegments.segmentId, input.id))
        .orderBy(desc(leadSegments.addedAt));

      return { ...segment, leads: segmentLeads };
    }),

  // ===== إنشاء شريحة جديدة =====
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().optional(),
        color: z.string().default("#3b82f6"),
        optimalSendTimes: z.array(OptimalTimeSchema).default([]),
        filterCriteria: FilterCriteriaSchema.default({}),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not ready" });
      const [result] = await db.insert(segments).values({
        name: input.name,
        description: input.description,
        color: input.color,
        optimalSendTimes: input.optimalSendTimes,
        filterCriteria: input.filterCriteria,
      });
      return { id: (result as { insertId: number }).insertId, success: true };
    }),

  // ===== تعديل شريحة =====
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().optional(),
        color: z.string().optional(),
        optimalSendTimes: z.array(OptimalTimeSchema).optional(),
        filterCriteria: FilterCriteriaSchema.optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not ready" });
      const { id, ...data } = input;
      await db.update(segments).set(data).where(eq(segments.id, id));
      return { success: true };
    }),

  // ===== حذف شريحة =====
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not ready" });
      // حذف ربط العملاء أولاً
      await db.delete(leadSegments).where(eq(leadSegments.segmentId, input.id));
      await db.delete(segments).where(eq(segments.id, input.id));
      return { success: true };
    }),

  // ===== إضافة عملاء لشريحة =====
  addLeads: protectedProcedure
    .input(
      z.object({
        segmentId: z.number(),
        leadIds: z.array(z.number()),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not ready" });
      // تجنب التكرار: جلب الموجودين مسبقاً
      const existing = await db
        .select({ leadId: leadSegments.leadId })
        .from(leadSegments)
        .where(
          and(
            eq(leadSegments.segmentId, input.segmentId),
            inArray(leadSegments.leadId, input.leadIds)
          )
        );
      const existingIds = new Set(existing.map((e) => e.leadId));
      const newIds = input.leadIds.filter((id) => !existingIds.has(id));

      if (newIds.length > 0) {
        await db.insert(leadSegments).values(
          newIds.map((leadId) => ({
            leadId,
            segmentId: input.segmentId,
            addedBy: ctx.user?.name ?? "admin",
          }))
        );
      }
      return { added: newIds.length, skipped: existingIds.size };
    }),

  // ===== حذف عميل من شريحة =====
  removeLead: protectedProcedure
    .input(z.object({ segmentId: z.number(), leadId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not ready" });
      await db
        .delete(leadSegments)
        .where(
          and(
            eq(leadSegments.segmentId, input.segmentId),
            eq(leadSegments.leadId, input.leadId)
          )
        );
      return { success: true };
    }),

  // ===== جلب شرائح عميل معين =====
  getLeadSegments: protectedProcedure
    .input(z.object({ leadId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not ready" });
      return db
        .select({
          id: segments.id,
          name: segments.name,
          color: segments.color,
          addedAt: leadSegments.addedAt,
        })
        .from(leadSegments)
        .innerJoin(segments, eq(leadSegments.segmentId, segments.id))
        .where(eq(leadSegments.leadId, input.leadId));
    }),

  // ===== إحصائيات الشرائح =====
  stats: protectedProcedure.query(async () => {
    const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not ready" });
    const totalSegments = await db.select({ count: count() }).from(segments);
    const totalMappings = await db.select({ count: count() }).from(leadSegments);
    const activeSegments = await db
      .select({ count: count() })
      .from(segments)
      .where(eq(segments.isActive, true));

    return {
      totalSegments: totalSegments[0]?.count ?? 0,
      activeSegments: activeSegments[0]?.count ?? 0,
      totalLeadMappings: totalMappings[0]?.count ?? 0,
    };
  }),

  // ===== جلب العملاء المتاحين للإضافة لشريحة (مع فلترة) =====
  availableLeads: protectedProcedure
    .input(
      z.object({
        segmentId: z.number(),
        search: z.string().optional(),
        city: z.string().optional(),
        source: z.string().optional(),
        hasWhatsapp: z.boolean().optional(),
        limit: z.number().default(50),
        offset: z.number().default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not ready" });

      // جلب العملاء الموجودين مسبقاً في الشريحة
      const existingInSegment = await db
        .select({ leadId: leadSegments.leadId })
        .from(leadSegments)
        .where(eq(leadSegments.segmentId, input.segmentId));
      const existingIds = existingInSegment.map((e: { leadId: number }) => e.leadId);

      // بناء الفلاتر
      const conditions: ReturnType<typeof eq>[] = [];
      if (input.city) conditions.push(eq(leads.city, input.city));
      if (input.source) conditions.push(eq(leads.businessType, input.source));
      if (input.hasWhatsapp !== undefined) {
        const waVal = input.hasWhatsapp ? "yes" : "no";
        conditions.push(eq(leads.hasWhatsapp, waVal as "yes" | "no" | "unknown"));
      }

      let baseQuery = db
        .select({
          id: leads.id,
          companyName: leads.companyName,
          phone: leads.verifiedPhone,
          city: leads.city,
          businessType: leads.businessType,
          hasWhatsapp: leads.hasWhatsapp,
        })
        .from(leads)
        .limit(input.limit)
        .offset(input.offset)
        .orderBy(desc(leads.createdAt));

      const allLeads = await baseQuery;

      // فلترة العملاء غير الموجودين في الشريحة
      const existingSet = new Set(existingIds);
      let filtered = allLeads.filter((l: { id: number }) => !existingSet.has(l.id));

      // فلترة البحث النصي
      if (input.search) {
        const q = input.search.toLowerCase();
        filtered = filtered.filter((l: { companyName: string; phone: string | null }) =>
          l.companyName.toLowerCase().includes(q) ||
          (l.phone ?? "").toLowerCase().includes(q)
        );
      }

      return filtered;
    }),
});
