/**
 * نظام دعوة المستخدمين وإدارة الصلاحيات
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { TRPCError } from "@trpc/server";
import { eq, desc, and } from "drizzle-orm";
import {
  userInvitations,
  userPermissions,
  users,
} from "../../drizzle/schema";
import crypto from "crypto";
import { notifyOwner } from "../_core/notification";
import { sendEmail, buildInvitationEmail } from "../emailService";

// قائمة الصلاحيات المتاحة - مُنظَّمة حسب الوظيفة
export const AVAILABLE_PERMISSIONS = [
  // ===== إدارة العملاء =====
  "leads.view",           // عرض قائمة العملاء
  "leads.add",            // إضافة عملاء جدد
  "leads.edit",           // تعديل بيانات العملاء
  "leads.delete",         // حذف العملاء
  "leads.export",         // تصدير بيانات العملاء
  // ===== واتساب والتواصل =====
  "whatsapp.send",        // إرسال رسائل واتساب فردية
  "whatsapp.bulk_send",   // الإرسال الجماعي
  "whatsapp.view_all_chats", // عرض جميع المحادثات
  "whatsapp.settings",    // إعدادات واتساب
  // ===== البحث والاستخراج =====
  "search.use",           // استخدام البحث الأساسي
  "search.extract",       // استخراج البيانات من المواقع
  "search.advanced",      // البحث المتقدم والمحرك الذكي
  // ===== المتابعة =====
  "followup.view",        // عرض قائمة المتابعة
  "followup.manage",      // إدارة مواعيد المتابعة
  "followup.assign",      // تعيين متابعات للموظفين
  // ===== التحليل والتقارير =====
  "analytics.view",       // عرض التحليلات والإحصائيات
  "analytics.export",     // تصدير التقارير
  "reports.view",         // عرض التقارير الموحدة
  // ===== الإعدادات =====
  "templates.manage",     // إدارة قوالب الرسائل
  "ai.settings",          // إعدادات الذكاء الاصطناعي
] as const;

// مجموعات الصلاحيات الجاهزة للأدوار
export const PERMISSION_PRESETS = {
  searcher: ["leads.view", "search.use", "search.extract", "search.advanced", "leads.add"],
  sender: ["leads.view", "whatsapp.send", "whatsapp.bulk_send", "whatsapp.view_all_chats"],
  lead_manager: ["leads.view", "leads.add", "leads.edit", "leads.export"],
  followup_agent: ["leads.view", "leads.edit", "followup.view", "followup.manage", "whatsapp.send"],
  analyst: ["leads.view", "analytics.view", "analytics.export", "reports.view"],
  full_access: [
    "leads.view", "leads.add", "leads.edit", "leads.export",
    "whatsapp.send", "whatsapp.bulk_send", "whatsapp.view_all_chats",
    "search.use", "search.extract", "search.advanced",
    "followup.view", "followup.manage",
    "analytics.view", "reports.view",
    "templates.manage",
  ],
} as const;

export type Permission = (typeof AVAILABLE_PERMISSIONS)[number];

export const invitationsRouter = router({
  // إرسال دعوة لمستخدم جديد
  sendInvitation: protectedProcedure
    .input(
      z.object({
        email: z.string().email(),
        role: z.enum(["user", "admin"]).default("user"),
        permissions: z.array(z.string()).default(["leads.view", "search.use"]),
        origin: z.string().url(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "فقط المدير يمكنه إرسال الدعوات",
        });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });

      // التحقق من وجود دعوة مفعلة لنفس الإيميل - إذا وجدت نقوم بتحديثها
      const existing = await db
        .select()
        .from(userInvitations)
        .where(
          and(
            eq(userInvitations.email, input.email),
            eq(userInvitations.status, "pending")
          )
        )
        .limit(1);

      const token = crypto.randomBytes(48).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 أيام

      if (existing.length > 0) {
        // تحديث الدعوة الموجودة برابط جديد وصلاحيات محدثة
        await db.update(userInvitations)
          .set({
            token,
            role: input.role,
            permissions: input.permissions,
            expiresAt,
            invitedBy: ctx.user.id,
          })
          .where(eq(userInvitations.id, existing[0].id));
      } else {
        await db.insert(userInvitations).values({
          email: input.email,
          invitedBy: ctx.user.id,
          token,
          role: input.role,
          permissions: input.permissions,
          status: "pending",
          expiresAt,
        });
      }

      const inviteUrl = `${input.origin}/accept-invitation?token=${token}`;

      await notifyOwner({
        title: "دعوة مستخدم جديد",
        content: `تم إرسال دعوة إلى ${input.email}\nرابط الدعوة: ${inviteUrl}`,
      });

      // إرسال إيميل الدعوة تلقائياً
      const inviterName = ctx.user.name || ctx.user.email || "المدير";
      const emailData = buildInvitationEmail({
        inviteeEmail: input.email,
        inviterName,
        inviteUrl,
        role: input.role,
      });
      const emailSent = await sendEmail(emailData);

      return { success: true, inviteUrl, email: input.email, expiresAt, emailSent };
    }),

  // قبول الدعوة
  acceptInvitation: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [invitation] = await db
        .select()
        .from(userInvitations)
        .where(eq(userInvitations.token, input.token))
        .limit(1);

      if (!invitation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "رابط الدعوة غير صحيح" });
      }

      if (invitation.status !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "هذه الدعوة مستخدمة أو منتهية الصلاحية" });
      }

      if (new Date() > invitation.expiresAt) {
        await db.update(userInvitations).set({ status: "expired" }).where(eq(userInvitations.id, invitation.id));
        throw new TRPCError({ code: "BAD_REQUEST", message: "انتهت صلاحية رابط الدعوة" });
      }

      if (invitation.role === "admin") {
        await db.update(users).set({ role: "admin" }).where(eq(users.id, ctx.user.id));
      }

      const permissions = (invitation.permissions as string[]) || [];
      const existingPerms = await db.select().from(userPermissions).where(eq(userPermissions.userId, ctx.user.id)).limit(1);

      if (existingPerms.length > 0) {
        await db.update(userPermissions).set({ permissions }).where(eq(userPermissions.userId, ctx.user.id));
      } else {
        await db.insert(userPermissions).values({ userId: ctx.user.id, permissions });
      }

      await db.update(userInvitations).set({ status: "accepted", acceptedBy: ctx.user.id }).where(eq(userInvitations.id, invitation.id));

      return { success: true, role: invitation.role };
    }),

  // قائمة الدعوات (للأدمن)
  listInvitations: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });

    const db = await getDb();
    if (!db) return [];

    return db.select().from(userInvitations).orderBy(desc(userInvitations.createdAt));
  }),

  // إلغاء دعوة
  revokeInvitation: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.update(userInvitations).set({ status: "revoked" }).where(eq(userInvitations.id, input.id));
      return { success: true };
    }),

  // قائمة المستخدمين مع صلاحياتهم (للأدمن)
  listUsers: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });

    const db = await getDb();
    if (!db) return [];

    const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
    const allPerms = await db.select().from(userPermissions);
    const permsMap = new Map(allPerms.map((p) => [p.userId, p.permissions as string[]]));

    return allUsers.map((u) => ({
      ...u,
      permissions: permsMap.get(u.id) || [],
    }));
  }),

  // تحديث صلاحيات مستخدم
  updateUserPermissions: protectedProcedure
    .input(
      z.object({
        userId: z.number(),
        permissions: z.array(z.string()),
        role: z.enum(["user", "admin"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      if (input.role) {
        await db.update(users).set({ role: input.role }).where(eq(users.id, input.userId));
      }

      const existing = await db.select().from(userPermissions).where(eq(userPermissions.userId, input.userId)).limit(1);

      if (existing.length > 0) {
        await db.update(userPermissions).set({ permissions: input.permissions }).where(eq(userPermissions.userId, input.userId));
      } else {
        await db.insert(userPermissions).values({ userId: input.userId, permissions: input.permissions });
      }

      return { success: true };
    }),

  // تعيين حساب واتساب افتراضي للمستخدم
  setDefaultWhatsappAccount: protectedProcedure
    .input(z.object({
      userId: z.number(),
      accountId: z.string().nullable(), // accountId is varchar in DB
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(users).set({ defaultWhatsappAccountId: input.accountId }).where(eq(users.id, input.userId));
      return { success: true };
    }),

  // جلب صلاحيات المستخدم الحالي
  myPermissions: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role === "admin") {
      return { permissions: [...AVAILABLE_PERMISSIONS] as string[], role: "admin" };
    }

    const db = await getDb();
    if (!db) return { permissions: [], role: ctx.user.role };

    const [perms] = await db.select().from(userPermissions).where(eq(userPermissions.userId, ctx.user.id)).limit(1);

    return {
      permissions: (perms?.permissions as string[]) || [],
      role: ctx.user.role,
    };
  }),

  // التحقق من صلاحية معينة
  hasPermission: protectedProcedure
    .input(z.object({ permission: z.string() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role === "admin") return { hasPermission: true };

      const db = await getDb();
      if (!db) return { hasPermission: false };

      const [perms] = await db.select().from(userPermissions).where(eq(userPermissions.userId, ctx.user.id)).limit(1);
      const permissions = (perms?.permissions as string[]) || [];
      return { hasPermission: permissions.includes(input.permission) };
    }),

  // تفعيل/تعطيل حساب مستخدم
  toggleUserActive: protectedProcedure
    .input(z.object({ userId: z.number(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(users).set({ isActive: input.isActive }).where(eq(users.id, input.userId));
      return { success: true };
    }),

  // تحديث حد الرسائل اليومية للمستخدم
  setUserDailyLimit: protectedProcedure
    .input(z.object({ userId: z.number(), limit: z.number().min(0).max(10000) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(users).set({ dailyMessageLimit: input.limit }).where(eq(users.id, input.userId));
      return { success: true };
    }),
});
