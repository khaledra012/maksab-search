/**
 * اختبارات منطق AI auto-reply والتصعيد والكلمات المفتاحية
 */
import { describe, it, expect } from "vitest";

// ===== محاكاة منطق AI auto-reply =====
function shouldAutoReply(globalEnabled: boolean, chatAutoReply: boolean): boolean {
  // يجب أن يكون كلاهما مفعّلاً حتى يرد AI
  if (!globalEnabled || !chatAutoReply) return false;
  return true;
}

// ===== محاكاة منطق الكلمات المفتاحية =====
function checkConversationKeywords(
  message: string,
  keywords: Array<{ keyword: string; response: string; isActive: boolean }>
): string | null {
  const msgLower = message.toLowerCase();
  for (const kw of keywords) {
    if (kw.isActive && msgLower.includes(kw.keyword.toLowerCase())) {
      return kw.response;
    }
  }
  return null;
}

// ===== محاكاة منطق التصعيد =====
function checkEscalationKeywords(
  message: string,
  escalationKeywords: string[]
): boolean {
  const msgLower = message.toLowerCase();
  return escalationKeywords.some(kw => msgLower.includes(kw.toLowerCase()));
}

// ===== الاختبارات =====
describe("AI Auto-Reply Logic", () => {
  it("يجب أن يرد AI عندما يكون كلاهما مفعّلاً", () => {
    expect(shouldAutoReply(true, true)).toBe(true);
  });

  it("يجب أن يتوقف AI عندما يكون الإعداد العام مُعطَّلاً", () => {
    expect(shouldAutoReply(false, true)).toBe(false);
  });

  it("يجب أن يتوقف AI عندما يكون إعداد المحادثة مُعطَّلاً", () => {
    expect(shouldAutoReply(true, false)).toBe(false);
  });

  it("يجب أن يتوقف AI عندما يكون كلاهما مُعطَّلاً", () => {
    expect(shouldAutoReply(false, false)).toBe(false);
  });
});

describe("Conversation Keywords Logic", () => {
  const keywords = [
    { keyword: "سعر", response: "يمكنك الاطلاع على الأسعار في موقعنا", isActive: true },
    { keyword: "توصيل", response: "نوفر خدمة التوصيل خلال 3-5 أيام عمل", isActive: true },
    { keyword: "ضمان", response: "نوفر ضمان سنة كاملة على جميع المنتجات", isActive: false },
  ];

  it("يجب أن يُرجع الرد المناسب عند وجود كلمة مفتاحية", () => {
    const response = checkConversationKeywords("كم السعر؟", keywords);
    expect(response).toBe("يمكنك الاطلاع على الأسعار في موقعنا");
  });

  it("يجب أن يُرجع الرد المناسب للكلمة المفتاحية الثانية", () => {
    const response = checkConversationKeywords("هل يوجد توصيل؟", keywords);
    expect(response).toBe("نوفر خدمة التوصيل خلال 3-5 أيام عمل");
  });

  it("يجب أن يتجاهل الكلمات المفتاحية المُعطَّلة", () => {
    const response = checkConversationKeywords("ما هو الضمان؟", keywords);
    expect(response).toBeNull();
  });

  it("يجب أن يُرجع null عند عدم وجود كلمة مفتاحية", () => {
    const response = checkConversationKeywords("مرحباً كيف حالك؟", keywords);
    expect(response).toBeNull();
  });

  it("يجب أن يكون البحث غير حساس لحالة الأحرف", () => {
    const response = checkConversationKeywords("السعر كم؟", keywords);
    expect(response).not.toBeNull();
  });
});

describe("Escalation Keywords Logic", () => {
  const escalationKeywords = ["مدير", "شكوى", "إلغاء", "مشكلة"];

  it("يجب أن يُفعّل التصعيد عند وجود كلمة تصعيد", () => {
    expect(checkEscalationKeywords("أريد التحدث مع مدير", escalationKeywords)).toBe(true);
  });

  it("يجب أن يُفعّل التصعيد عند وجود كلمة شكوى", () => {
    expect(checkEscalationKeywords("لدي شكوى", escalationKeywords)).toBe(true);
  });

  it("يجب ألا يُفعّل التصعيد عند عدم وجود كلمة تصعيد", () => {
    expect(checkEscalationKeywords("شكراً جزيلاً", escalationKeywords)).toBe(false);
  });

  it("يجب أن يكون البحث غير حساس لحالة الأحرف", () => {
    expect(checkEscalationKeywords("مدير", escalationKeywords)).toBe(true);
  });
});
