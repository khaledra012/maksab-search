/**
 * اختبارات منطق تحليل اهتمام العميل
 * يتحقق من أن الرسائل تُصنَّف بشكل صحيح
 */
import { describe, it, expect } from "vitest";

// ===== استنساخ منطق analyzeInterest للاختبار (بدون AI) =====
const DEFAULT_INTEREST_KEYWORDS = [
  "نعم", "أيوه", "ايوه", "موافق", "تمام", "حسناً", "اوكي", "ok", "yes",
  "تواصل", "اتصل", "رقم", "واتساب", "تلفون", "جوال",
  "كيف", "متى", "متاح", "متاحة", "ممكن", "توصيل",
  "مهتم", "مهتمة", "interested",
];

const HIGH_INTEREST_KEYWORDS = [
  "موعد", "أحجز", "احجز", "حجز", "أحجز", "زيارة", "أزور", "ازور",
  "اشتري", "أشتري", "شراء", "أطلب", "اطلب", "طلب", "أريد", "اريد",
  "أبي", "ابي", "أبغى", "ابغى", "عايز", "عاوز", "بدي", "نبي",
  "سعر", "كم", "بكم", "أسعار", "تكلفة", "الثمن", "كلفة",
  "buy", "order", "price", "want", "book", "appointment",
];

function analyzeInterestSync(message: string): { isInterested: boolean; score: number; keywords: string[] } {
  const lowerMsg = message.toLowerCase();
  const foundKeywords = DEFAULT_INTEREST_KEYWORDS.filter((kw) =>
    lowerMsg.includes(kw.toLowerCase())
  );
  const highInterestFound = HIGH_INTEREST_KEYWORDS.filter((kw) =>
    lowerMsg.includes(kw.toLowerCase())
  );
  let score = Math.min(
    foundKeywords.length * 15 + highInterestFound.length * 30,
    80
  );
  const allFoundKeywords = Array.from(new Set([...foundKeywords, ...highInterestFound]));
  return {
    isInterested: score >= 40 || allFoundKeywords.length >= 1,
    score,
    keywords: allFoundKeywords,
  };
}

// ===== تصحيح درجة AI (من 0-1 إلى 0-100) =====
function fixAiScore(rawScore: number): number {
  let aiScore = rawScore;
  if (aiScore > 0 && aiScore <= 1) aiScore = Math.round(aiScore * 100);
  return Math.min(Math.round(aiScore), 100);
}

describe("تحليل اهتمام العميل - الكلمات المفتاحية", () => {
  it("يجب أن تُصنَّف 'أريد موعد' كمهتم جداً (درجة عالية)", () => {
    const result = analyzeInterestSync("أريد موعد");
    expect(result.isInterested).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(40);
    expect(result.keywords).toContain("موعد");
    expect(result.keywords).toContain("أريد");
  });

  it("يجب أن تُصنَّف 'كم سعر الكيلو' كمهتم", () => {
    const result = analyzeInterestSync("كم سعر الكيلو");
    expect(result.isInterested).toBe(true);
    expect(result.keywords.length).toBeGreaterThan(0);
  });

  it("يجب أن تُصنَّف 'أبغى أطلب' كمهتم جداً", () => {
    const result = analyzeInterestSync("أبغى أطلب");
    expect(result.isInterested).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(40);
  });

  it("يجب أن تُصنَّف 'شراء' كمهتم", () => {
    const result = analyzeInterestSync("شراء");
    expect(result.isInterested).toBe(true);
    expect(result.keywords).toContain("شراء");
  });

  it("يجب أن تُصنَّف 'نعم' كمهتم", () => {
    const result = analyzeInterestSync("نعم");
    expect(result.isInterested).toBe(true);
  });

  it("يجب أن تُصنَّف 'مرحبا' كغير مهتم (لا كلمات مفتاحية)", () => {
    const result = analyzeInterestSync("مرحبا");
    expect(result.isInterested).toBe(false);
    expect(result.score).toBe(0);
    expect(result.keywords.length).toBe(0);
  });

  it("يجب أن تُصنَّف 'شكراً' كغير مهتم", () => {
    const result = analyzeInterestSync("شكراً");
    expect(result.isInterested).toBe(false);
  });

  it("يجب أن تُصنَّف 'أريد موعد للزيارة' بدرجة عالية جداً", () => {
    const result = analyzeInterestSync("أريد موعد للزيارة");
    expect(result.isInterested).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(60);
  });

  it("يجب أن تُصنَّف 'بكم الكيلو' كمهتم بالسعر", () => {
    const result = analyzeInterestSync("بكم الكيلو");
    expect(result.isInterested).toBe(true);
    expect(result.keywords).toContain("بكم");
  });

  it("يجب أن تُصنَّف 'want to buy' كمهتم (إنجليزي)", () => {
    const result = analyzeInterestSync("want to buy");
    expect(result.isInterested).toBe(true);
  });
});

describe("تصحيح درجة AI (من نسبة إلى رقم صحيح)", () => {
  it("يجب تحويل 0.8 إلى 80", () => {
    expect(fixAiScore(0.8)).toBe(80);
  });

  it("يجب تحويل 0.13 إلى 13", () => {
    expect(fixAiScore(0.13)).toBe(13);
  });

  it("يجب الإبقاء على 85 كما هو", () => {
    expect(fixAiScore(85)).toBe(85);
  });

  it("يجب الإبقاء على 100 كما هو", () => {
    expect(fixAiScore(100)).toBe(100);
  });

  it("يجب تحويل 0.95 إلى 95", () => {
    expect(fixAiScore(0.95)).toBe(95);
  });

  it("يجب ألا تتجاوز الدرجة 100", () => {
    expect(fixAiScore(150)).toBe(100);
  });
});
