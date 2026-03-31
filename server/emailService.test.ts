/**
 * Tests for emailService
 */
import { describe, it, expect, vi } from "vitest";
import { buildInvitationEmail, buildPasswordResetEmail } from "./emailService";

describe("emailService - email templates", () => {
  it("buildInvitationEmail returns correct structure", () => {
    const result = buildInvitationEmail({
      inviteeEmail: "test@example.com",
      inviterName: "أحمد",
      inviteUrl: "https://maksab-sales.xyz/accept-invitation?token=abc123",
      role: "user",
    });
    expect(result.to).toBe("test@example.com");
    expect(result.subject).toContain("دعوة");
    expect(result.html).toContain("أحمد");
    expect(result.html).toContain("abc123");
    expect(result.html).toContain("موظف");
  });

  it("buildInvitationEmail shows admin role correctly", () => {
    const result = buildInvitationEmail({
      inviteeEmail: "admin@example.com",
      inviterName: "محمد",
      inviteUrl: "https://maksab-sales.xyz/accept-invitation?token=xyz",
      role: "admin",
    });
    expect(result.html).toContain("مدير");
  });

  it("buildPasswordResetEmail returns correct structure", () => {
    const result = buildPasswordResetEmail({
      email: "user@example.com",
      resetUrl: "https://maksab-sales.xyz/reset-password?token=reset123",
    });
    expect(result.to).toBe("user@example.com");
    expect(result.subject).toContain("كلمة المرور");
    expect(result.html).toContain("user@example.com");
    expect(result.html).toContain("reset123");
    expect(result.html).toContain("1 ساعة");
  });

  it("buildInvitationEmail includes 48-hour expiry notice", () => {
    const result = buildInvitationEmail({
      inviteeEmail: "x@y.com",
      inviterName: "Test",
      inviteUrl: "https://example.com/invite",
      role: "user",
    });
    expect(result.html).toContain("48 ساعة");
  });

  it("buildPasswordResetEmail includes security notice", () => {
    const result = buildPasswordResetEmail({
      email: "x@y.com",
      resetUrl: "https://example.com/reset",
    });
    expect(result.html).toContain("حسابك آمن");
  });
});
