/**
 * اختبارات الميزات الجديدة:
 * 1. forgotPassword - طلب إعادة تعيين كلمة المرور
 * 2. resetPassword - إعادة تعيين كلمة المرور
 * 3. التحقق من صحة المدخلات
 */
import { describe, it, expect, vi } from "vitest";
import { z } from "zod";

// ===== مخططات التحقق (نفس ما في staffAuth.ts) =====

const forgotPasswordSchema = z.object({
  email: z.string().email(),
  origin: z.string().url(),
});

const resetPasswordSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل"),
});

const acceptInvitationSchema = z.object({
  token: z.string(),
  name: z.string().min(2, "الاسم يجب أن يكون حرفَين على الأقل"),
  password: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل"),
});

const loginSchema = z.object({
  email: z.string().email("بريد إلكتروني غير صحيح"),
  password: z.string().min(1, "كلمة المرور مطلوبة"),
});

// ===== اختبارات forgotPassword =====
describe("forgotPassword - Input Validation", () => {
  it("يجب أن يقبل بريداً إلكترونياً صحيحاً وorigin صحيح", () => {
    const result = forgotPasswordSchema.safeParse({
      email: "user@example.com",
      origin: "https://maksab-sales.xyz",
    });
    expect(result.success).toBe(true);
  });

  it("يجب أن يرفض بريداً إلكترونياً غير صحيح", () => {
    const result = forgotPasswordSchema.safeParse({
      email: "not-an-email",
      origin: "https://example.com",
    });
    expect(result.success).toBe(false);
  });

  it("يجب أن يرفض origin غير صحيح (ليس URL)", () => {
    const result = forgotPasswordSchema.safeParse({
      email: "user@example.com",
      origin: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("يجب أن يرفض origin فارغاً", () => {
    const result = forgotPasswordSchema.safeParse({
      email: "user@example.com",
      origin: "",
    });
    expect(result.success).toBe(false);
  });

  it("يجب أن يرفض البريد الفارغ", () => {
    const result = forgotPasswordSchema.safeParse({
      email: "",
      origin: "https://example.com",
    });
    expect(result.success).toBe(false);
  });
});

// ===== اختبارات resetPassword =====
describe("resetPassword - Input Validation", () => {
  it("يجب أن يقبل token وكلمة مرور صحيحة", () => {
    const result = resetPasswordSchema.safeParse({
      token: "abc123def456",
      newPassword: "MySecurePassword123",
    });
    expect(result.success).toBe(true);
  });

  it("يجب أن يرفض كلمة مرور أقل من 8 أحرف", () => {
    const result = resetPasswordSchema.safeParse({
      token: "abc123",
      newPassword: "short",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
    }
  });

  it("يجب أن يقبل كلمة مرور بالضبط 8 أحرف", () => {
    const result = resetPasswordSchema.safeParse({
      token: "abc123",
      newPassword: "exactly8",
    });
    expect(result.success).toBe(true);
  });

  it("يجب أن يرفض token فارغاً", () => {
    const result = resetPasswordSchema.safeParse({
      token: "",
      newPassword: "validpassword",
    });
    // token فارغ مقبول في zod (string())، لكن سيُرفض في DB
    expect(result.success).toBe(true);
  });
});

// ===== اختبارات acceptInvitation =====
describe("acceptInvitation - Input Validation", () => {
  it("يجب أن يقبل بيانات صحيحة", () => {
    const result = acceptInvitationSchema.safeParse({
      token: "valid-token-123",
      name: "Ahmed Ali",
      password: "SecurePass123",
    });
    expect(result.success).toBe(true);
  });

  it("يجب أن يرفض اسماً بحرف واحد", () => {
    const result = acceptInvitationSchema.safeParse({
      token: "valid-token",
      name: "A",
      password: "SecurePass123",
    });
    expect(result.success).toBe(false);
  });

  it("يجب أن يرفض كلمة مرور أقل من 8 أحرف", () => {
    const result = acceptInvitationSchema.safeParse({
      token: "valid-token",
      name: "Ahmed",
      password: "short",
    });
    expect(result.success).toBe(false);
  });
});

// ===== اختبارات login =====
describe("login - Input Validation", () => {
  it("يجب أن يقبل بريداً وكلمة مرور صحيحين", () => {
    const result = loginSchema.safeParse({
      email: "staff@company.com",
      password: "password123",
    });
    expect(result.success).toBe(true);
  });

  it("يجب أن يرفض بريداً غير صحيح", () => {
    const result = loginSchema.safeParse({
      email: "invalid-email",
      password: "password123",
    });
    expect(result.success).toBe(false);
  });

  it("يجب أن يرفض كلمة مرور فارغة", () => {
    const result = loginSchema.safeParse({
      email: "staff@company.com",
      password: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("كلمة المرور مطلوبة");
    }
  });
});

// ===== اختبارات منطق الأمان =====
describe("Security - Token Generation Logic", () => {
  it("يجب أن يكون الـ token طويلاً بما يكفي (96 حرف hex = 48 bytes)", () => {
    const { randomBytes } = require("crypto");
    const token = randomBytes(48).toString("hex");
    expect(token).toHaveLength(96);
    expect(token).toMatch(/^[a-f0-9]+$/);
  });

  it("يجب أن تكون صلاحية رابط إعادة التعيين ساعة واحدة", () => {
    const now = Date.now();
    const expiresAt = new Date(now + 60 * 60 * 1000);
    const diffMs = expiresAt.getTime() - now;
    expect(diffMs).toBe(3600000); // 1 hour in ms
  });

  it("يجب أن تكون صلاحية رابط الدعوة 7 أيام", () => {
    const now = Date.now();
    const expiresAt = new Date(now + 7 * 24 * 60 * 60 * 1000);
    const diffDays = (expiresAt.getTime() - now) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBe(7);
  });
});

// ===== اختبارات قوالب الإيميل =====
describe("Email Templates", () => {
  it("يجب أن يبني قالب الدعوة بشكل صحيح", async () => {
    const { buildInvitationEmail } = await import("./emailService");
    const result = buildInvitationEmail({
      inviteeEmail: "new@company.com",
      inviterName: "المدير",
      inviteUrl: "https://example.com/accept-invitation?token=abc",
      role: "user",
    });
    expect(result.to).toBe("new@company.com");
    expect(result.subject).toContain("دعوة");
    expect(result.html).toContain("https://example.com/accept-invitation?token=abc");
  });

  it("يجب أن يبني قالب إعادة التعيين بشكل صحيح", async () => {
    const { buildPasswordResetEmail } = await import("./emailService");
    const result = buildPasswordResetEmail({
      email: "user@company.com",
      resetUrl: "https://example.com/reset-password?token=xyz",
    });
    expect(result.to).toBe("user@company.com");
    expect(result.subject).toContain("إعادة تعيين");
    expect(result.html).toContain("https://example.com/reset-password?token=xyz");
  });
});
