import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { users, userInvitations, userPermissions, passwordResetTokens } from "../../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { ENV } from "../_core/env";
import { sdk } from "../_core/sdk";
import { buildPasswordResetEmail, sendEmail } from "../emailService";

export const staffAuthRouter = router({
  // تسجيل دخول الموظف بكلمة مرور
  login: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "خطأ في الاتصال بقاعدة البيانات" });

      const [user] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });
      if (!user.passwordHash) throw new TRPCError({ code: "UNAUTHORIZED", message: "هذا الحساب لا يدعم تسجيل الدخول بكلمة مرور" });

      // التحقق من أن الحساب مفعّل
      if (user.isActive === false) {
        throw new TRPCError({ code: "FORBIDDEN", message: "هذا الحساب معطّل. تواصل مع المدير." });
      }

      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });

      const sessionToken = await sdk.signSession({
        openId: user.openId,
        name: user.name || user.email || "staff",
      });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, cookieOptions);

      return { success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
    }),

  // التحقق من صحة رابط الدعوة وعرض تفاصيلها
  verifyInvitationToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "خطأ في الاتصال بقاعدة البيانات" });

      const [invitation] = await db.select().from(userInvitations)
        .where(eq(userInvitations.token, input.token))
        .limit(1);

      if (!invitation) {
        return { valid: false, reason: "رابط الدعوة غير صحيح" };
      }

      if (invitation.status === "accepted") {
        return { valid: false, reason: "هذه الدعوة مستخدمة مسبقاً" };
      }

      if (invitation.status === "revoked") {
        return { valid: false, reason: "تم إلغاء هذه الدعوة" };
      }

      if (invitation.status === "expired" || new Date() > invitation.expiresAt) {
        return { valid: false, reason: "انتهت صلاحية رابط الدعوة" };
      }

      return {
        valid: true,
        email: invitation.email,
        role: invitation.role,
        permissions: (invitation.permissions as string[]) || [],
        expiresAt: invitation.expiresAt,
      };
    }),

  // قبول الدعوة وتعيين كلمة مرور
  acceptInvitation: publicProcedure
    .input(z.object({
      token: z.string(),
      name: z.string().min(1),
      password: z.string().min(6),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "خطأ في الاتصال بقاعدة البيانات" });

      // جلب الدعوة
      const [invitation] = await db.select().from(userInvitations)
        .where(and(eq(userInvitations.token, input.token), eq(userInvitations.status, "pending")))
        .limit(1);
      if (!invitation) throw new TRPCError({ code: "NOT_FOUND", message: "الدعوة غير موجودة أو منتهية الصلاحية" });

      // التحقق من انتهاء الصلاحية
      if (new Date() > invitation.expiresAt) {
        await db.update(userInvitations).set({ status: "expired" }).where(eq(userInvitations.id, invitation.id));
        throw new TRPCError({ code: "BAD_REQUEST", message: "انتهت صلاحية رابط الدعوة" });
      }

      const passwordHash = await bcrypt.hash(input.password, 10);
      const permissions = (invitation.permissions as string[]) || [];
      const invitedRole = (invitation.role as "user" | "admin") || "user";

      // البحث عن مستخدم موجود بنفس البريد الإلكتروني
      const existingUsers = await db.select().from(users).where(eq(users.email, invitation.email)).limit(1);
      let userId: number;
      let userOpenId: string;

      if (existingUsers.length > 0) {
        // تحديث المستخدم الموجود
        userOpenId = existingUsers[0].openId;
        await db.update(users).set({
          name: input.name,
          passwordHash,
          isActive: true,
          role: invitedRole,
        }).where(eq(users.email, invitation.email));
        userId = existingUsers[0].id;
      } else {
        // إنشاء مستخدم جديد
        userOpenId = `staff_${nanoid(16)}`;
        const result = await db.insert(users).values({
          openId: userOpenId,
          name: input.name,
          email: invitation.email,
          passwordHash,
          role: invitedRole,
          isActive: true,
        });
        userId = (result as any).insertId;
      }

      // ====== حفظ الصلاحيات في جدول userPermissions ======
      if (invitedRole !== "admin") {
        // للموظفين العاديين: حفظ الصلاحيات المحددة في الدعوة
        const existingPerms = await db.select().from(userPermissions)
          .where(eq(userPermissions.userId, userId)).limit(1);

        if (existingPerms.length > 0) {
          await db.update(userPermissions)
            .set({ permissions })
            .where(eq(userPermissions.userId, userId));
        } else {
          await db.insert(userPermissions).values({
            userId,
            permissions,
          });
        }
      }
      // للمدراء: لا نحتاج لحفظ صلاحيات لأنهم يملكون كل الصلاحيات تلقائياً

      // تحديث حالة الدعوة
      await db.update(userInvitations)
        .set({ status: "accepted", acceptedBy: userId })
        .where(eq(userInvitations.id, invitation.id));

      // إنشاء جلسة تسجيل الدخول
      const sessionToken = await sdk.signSession({
        openId: userOpenId,
        name: input.name,
      });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, cookieOptions);

      return { success: true, role: invitedRole };
    }),

  // طلب إعادة تعيين كلمة المرور
  forgotPassword: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "خطأ في الاتصال بقاعدة البيانات" });

      const [user] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
      // لا نكشف إذا كان البريد موجوداً أم لا
      if (!user) return { success: true };

      const resetToken = nanoid(32);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // ساعة واحدة

      await db.insert(passwordResetTokens).values({
        userId: user.id,
        token: resetToken,
        expiresAt,
      });

      const appUrl = (ENV.appUrl || "http://localhost:3000").replace(/\/$/, "");
      const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;
      const emailData = buildPasswordResetEmail({
        email: input.email,
        resetUrl,
      });
      const emailSent = await sendEmail(emailData);

      if (!emailSent) {
        console.warn(`[StaffAuth] Password reset email was not sent to ${input.email}`);
      }

      return { success: true };
    }),

  // الحصول على بيانات المستخدم الحالي
  me: protectedProcedure.query(async ({ ctx }) => {
    return ctx.user;
  }),

  // تسجيل الخروج
  logout: protectedProcedure.mutation(async ({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true };
  }),

  // إعادة تعيين كلمة المرور
  resetPassword: publicProcedure
    .input(z.object({
      token: z.string(),
      password: z.string().min(6),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "خطأ في الاتصال بقاعدة البيانات" });

      const [resetRecord] = await db.select().from(passwordResetTokens)
        .where(and(
          eq(passwordResetTokens.token, input.token),
          sql`${passwordResetTokens.expiresAt} > NOW()`
        ))
        .limit(1);

      if (!resetRecord) throw new TRPCError({ code: "NOT_FOUND", message: "رمز إعادة التعيين غير صالح أو منتهي الصلاحية" });

      const passwordHash = await bcrypt.hash(input.password, 10);
      await db.update(users).set({ passwordHash }).where(eq(users.id, resetRecord.userId));
      await db.delete(passwordResetTokens).where(eq(passwordResetTokens.token, input.token));

      return { success: true };
    }),
});
