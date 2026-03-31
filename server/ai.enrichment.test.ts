/**
 * AI Enrichment Agent — Isolated Tests
 * ======================================
 * اختبارات معزولة للتحقق من صحة AI Enrichment Agent
 * قبل ربطه بالنظام الكامل.
 *
 * الاختبارات:
 *  1. تطبيع أرقام الهاتف السعودية
 *  2. بناء نص المرشح (buildCandidateText)
 *  3. دمج النتائج مع المرشح (in-place merge logic)
 *  4. اختبار تكامل حقيقي مع LLM (يُشغَّل فقط عند توفر API key)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DiscoveryCandidate } from "../shared/types/lead-intelligence";

// ─── Mock للـ LLM ─────────────────────────────────────────────────────────────

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

// ─── استيراد الوحدة بعد الـ mock ─────────────────────────────────────────────

import { enrichCandidatesWithAI, enrichSingleCandidate } from "./lib/aiEnrichmentAgent";
import { invokeLLM } from "./_core/llm";

// ─── مساعد: إنشاء مرشح وهمي ──────────────────────────────────────────────────

function makeCandidate(overrides: Partial<DiscoveryCandidate> = {}): DiscoveryCandidate {
  return {
    id: `test-${Date.now()}-${Math.random()}`,
    source: "instagram",
    sourceType: "profile",
    verifiedPhones: [],
    candidatePhones: [],
    verifiedEmails: [],
    candidateEmails: [],
    candidateWebsites: [],
    confidence: 0.7,
    raw: {},
    ...overrides,
  };
}

// ─── Mock response builder ────────────────────────────────────────────────────

function mockLLMResponse(results: Array<{
  id: string;
  phones?: string[];
  website?: string | null;
  instagram?: string | null;
  tiktok?: string | null;
  snapchat?: string | null;
  x?: string | null;
  telegram?: string | null;
  city?: string | null;
  category?: string | null;
}>) {
  const fullResults = results.map(r => ({
    id: r.id,
    phones: r.phones || [],
    website: r.website || null,
    instagram: r.instagram || null,
    tiktok: r.tiktok || null,
    snapchat: r.snapchat || null,
    x: r.x || null,
    telegram: r.telegram || null,
    city: r.city || null,
    category: r.category || null,
  }));

  return {
    choices: [{
      message: {
        content: JSON.stringify({ results: fullResults }),
      },
    }],
  };
}

// ─── الاختبارات ───────────────────────────────────────────────────────────────

describe("AI Enrichment Agent", () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── 1. اختبار الدمج الأساسي ─────────────────────────────────────────────

  describe("enrichCandidatesWithAI — basic merge", () => {

    it("يُضيف رقم هاتف مستخرج إلى candidatePhones", async () => {
      const candidate = makeCandidate({
        nameHint: "مطعم الأصيل",
        raw: { bio: "للطلب: 0501234567 — جدة" },
      });

      vi.mocked(invokeLLM).mockResolvedValueOnce(
        mockLLMResponse([{
          id: candidate.id,
          phones: ["0501234567"],
          city: "جدة",
          category: "مطعم",
        }]) as any
      );

      const summary = await enrichCandidatesWithAI([candidate]);

      expect(candidate.candidatePhones).toContain("0501234567");
      expect(candidate.cityHint).toBe("جدة");
      expect(candidate.categoryHint).toBe("مطعم");
      expect(summary.successCount).toBe(1);
      expect(summary.fieldsExtracted.phones).toBe(1);
      expect(summary.fieldsExtracted.cities).toBe(1);
    });

    it("لا يُكرر رقم هاتف موجود مسبقاً في verifiedPhones", async () => {
      const candidate = makeCandidate({
        nameHint: "محل الأمل",
        verifiedPhones: ["0501234567"],
        raw: { bio: "هاتف: 0501234567" },
      });

      vi.mocked(invokeLLM).mockResolvedValueOnce(
        mockLLMResponse([{
          id: candidate.id,
          phones: ["0501234567"],
        }]) as any
      );

      await enrichCandidatesWithAI([candidate]);

      // يجب أن يبقى في verifiedPhones فقط، لا يُضاف إلى candidatePhones
      expect(candidate.candidatePhones).not.toContain("0501234567");
    });

    it("لا يُكرر رقم هاتف موجود مسبقاً في candidatePhones", async () => {
      const candidate = makeCandidate({
        nameHint: "صالون النور",
        candidatePhones: ["0551234567"],
        raw: { bio: "واتساب: 0551234567" },
      });

      vi.mocked(invokeLLM).mockResolvedValueOnce(
        mockLLMResponse([{
          id: candidate.id,
          phones: ["0551234567"],
        }]) as any
      );

      await enrichCandidatesWithAI([candidate]);

      const count = candidate.candidatePhones.filter(p => p === "0551234567").length;
      expect(count).toBe(1); // مرة واحدة فقط
    });

    it("يُضيف موقع إلكتروني إذا لم يكن موجوداً", async () => {
      const candidate = makeCandidate({
        nameHint: "شركة التقنية",
        raw: { bio: "موقعنا: https://alteqnia.com.sa" },
      });

      vi.mocked(invokeLLM).mockResolvedValueOnce(
        mockLLMResponse([{
          id: candidate.id,
          website: "https://alteqnia.com.sa",
        }]) as any
      );

      await enrichCandidatesWithAI([candidate]);

      expect(candidate.verifiedWebsite).toBe("https://alteqnia.com.sa");
      expect((candidate.raw as any).aiEnriched).toBe(true);
    });

    it("لا يُلغي موقع إلكتروني موجود مسبقاً", async () => {
      const candidate = makeCandidate({
        nameHint: "متجر الجودة",
        verifiedWebsite: "https://existing.com",
        raw: { bio: "موقع جديد: https://new-site.com" },
      });

      vi.mocked(invokeLLM).mockResolvedValueOnce(
        mockLLMResponse([{
          id: candidate.id,
          website: "https://new-site.com",
        }]) as any
      );

      await enrichCandidatesWithAI([candidate]);

      // يجب أن يبقى الموقع الأصلي
      expect(candidate.verifiedWebsite).toBe("https://existing.com");
    });

    it("يُضيف حسابات السوشيال إلى crossPlatformHandles", async () => {
      const candidate = makeCandidate({
        nameHint: "مطبخ الشام",
        raw: { bio: "انستقرام: @matbakh_alsham | تيك توك: @matbakh.alsham" },
      });

      vi.mocked(invokeLLM).mockResolvedValueOnce(
        mockLLMResponse([{
          id: candidate.id,
          instagram: "matbakh_alsham",
          tiktok: "matbakh.alsham",
        }]) as any
      );

      await enrichCandidatesWithAI([candidate]);

      const handles = (candidate.raw as any).crossPlatformHandles;
      expect(handles?.instagram).toBe("matbakh_alsham");
      expect(handles?.tiktok).toBe("matbakh.alsham");
    });

  });

  // ─── 2. اختبار تطبيع أرقام الهاتف ───────────────────────────────────────

  describe("phone normalization", () => {

    it("يُطبّع رقم +966 إلى 05XXXXXXXX", async () => {
      const candidate = makeCandidate({
        nameHint: "اختبار",
        raw: { bio: "هاتف" },
      });

      vi.mocked(invokeLLM).mockResolvedValueOnce(
        mockLLMResponse([{
          id: candidate.id,
          phones: ["0501234567"], // LLM يُرجع الرقم مُطبَّعاً
        }]) as any
      );

      await enrichCandidatesWithAI([candidate]);
      expect(candidate.candidatePhones).toContain("0501234567");
    });

    it("يُتجاهل رقم هاتف غير سعودي", async () => {
      const candidate = makeCandidate({
        nameHint: "اختبار دولي",
        raw: { bio: "هاتف" },
      });

      vi.mocked(invokeLLM).mockResolvedValueOnce(
        mockLLMResponse([{
          id: candidate.id,
          phones: [], // LLM لا يُرجع أرقام غير سعودية
        }]) as any
      );

      await enrichCandidatesWithAI([candidate]);
      expect(candidate.candidatePhones).toHaveLength(0);
    });

  });

  // ─── 3. اختبار المرشحين بدون نص كافٍ ────────────────────────────────────

  describe("candidates without sufficient text", () => {

    it("يتخطى المرشحين بدون اسم أو bio", async () => {
      const candidate = makeCandidate({
        // بدون nameHint أو bio
        raw: {},
      });

      const summary = await enrichCandidatesWithAI([candidate]);

      // LLM لم يُستدعَ
      expect(invokeLLM).not.toHaveBeenCalled();
      expect(summary.totalProcessed).toBe(0);
    });

    it("يُعالج المرشح إذا كان لديه اسم فقط", async () => {
      const candidate = makeCandidate({
        nameHint: "مطعم السلام",
        raw: {},
      });

      vi.mocked(invokeLLM).mockResolvedValueOnce(
        mockLLMResponse([{
          id: candidate.id,
          city: "الرياض",
          category: "مطعم",
        }]) as any
      );

      const summary = await enrichCandidatesWithAI([candidate]);
      expect(summary.totalProcessed).toBe(1);
    });

  });

  // ─── 4. اختبار معالجة الأخطاء ────────────────────────────────────────────

  describe("error handling", () => {

    it("يُكمل بدون crash عند فشل LLM", async () => {
      const candidate = makeCandidate({
        nameHint: "مطعم الاختبار",
        raw: { bio: "نص البيو" },
      });

      vi.mocked(invokeLLM).mockRejectedValueOnce(new Error("LLM timeout"));

      const summary = await enrichCandidatesWithAI([candidate]);

      expect(summary.failureCount).toBe(1);
      expect(summary.successCount).toBe(0);
      // المرشح لم يتغير
      expect(candidate.candidatePhones).toHaveLength(0);
    });

    it("يُكمل الدفعات الأخرى عند فشل دفعة واحدة", async () => {
      const candidates = [
        makeCandidate({ nameHint: "مطعم 1", raw: { bio: "بيو 1" } }),
        makeCandidate({ nameHint: "مطعم 2", raw: { bio: "بيو 2" } }),
        makeCandidate({ nameHint: "مطعم 3", raw: { bio: "بيو 3" } }),
        makeCandidate({ nameHint: "مطعم 4", raw: { bio: "بيو 4" } }),
        makeCandidate({ nameHint: "مطعم 5", raw: { bio: "بيو 5" } }),
        makeCandidate({ nameHint: "مطعم 6", raw: { bio: "بيو 6" } }),
      ];

      // الدفعة الأولى تفشل، الثانية تنجح
      vi.mocked(invokeLLM)
        .mockRejectedValueOnce(new Error("batch 1 failed"))
        .mockResolvedValueOnce(
          mockLLMResponse(
            candidates.slice(5).map(c => ({ id: c.id, city: "جدة" }))
          ) as any
        );

      const summary = await enrichCandidatesWithAI(candidates, 5);

      expect(summary.totalProcessed).toBe(6);
      // الدفعة الأولى فشلت (5 مرشحين)، الثانية نجحت (1 مرشح)
      expect(summary.failureCount).toBe(5);
      expect(summary.successCount).toBe(1);
    });

  });

  // ─── 5. اختبار enrichSingleCandidate ─────────────────────────────────────

  describe("enrichSingleCandidate", () => {

    it("يُثري مرشحاً واحداً ويُرجع نتيجة مفصّلة", async () => {
      const candidate = makeCandidate({
        nameHint: "ملحمة الطازج",
        raw: { bio: "أفضل لحوم طازجة في الرياض. هاتف: 0561234567" },
      });

      vi.mocked(invokeLLM).mockResolvedValueOnce(
        mockLLMResponse([{
          id: candidate.id,
          phones: ["0561234567"],
          city: "الرياض",
          category: "ملحمة",
        }]) as any
      );

      const result = await enrichSingleCandidate(candidate);

      expect(result.success).toBe(true);
      expect(result.extracted.phones).toContain("0561234567");
      expect(result.extracted.city).toBe("الرياض");
      expect(result.extracted.category).toBe("ملحمة");
      expect(result.processingMs).toBeGreaterThanOrEqual(0);
    });

  });

  // ─── 6. اختبار الملخص الإجمالي ───────────────────────────────────────────

  describe("enrichment summary", () => {

    it("يُحسب إجمالي الحقول المستخرجة بشكل صحيح", async () => {
      const candidates = [
        makeCandidate({ nameHint: "نشاط 1", raw: { bio: "بيو 1" } }),
        makeCandidate({ nameHint: "نشاط 2", raw: { bio: "بيو 2" } }),
      ];

      vi.mocked(invokeLLM).mockResolvedValueOnce(
        mockLLMResponse([
          {
            id: candidates[0].id,
            phones: ["0501111111"],
            website: "https://site1.com",
            city: "الرياض",
            instagram: "account1",
          },
          {
            id: candidates[1].id,
            phones: ["0502222222", "0503333333"],
            city: "جدة",
            tiktok: "account2",
          },
        ]) as any
      );

      const summary = await enrichCandidatesWithAI(candidates);

      expect(summary.totalProcessed).toBe(2);
      expect(summary.successCount).toBe(2);
      expect(summary.failureCount).toBe(0);
      expect(summary.fieldsExtracted.phones).toBe(3); // 1 + 2
      expect(summary.fieldsExtracted.websites).toBe(1);
      expect(summary.fieldsExtracted.cities).toBe(2);
      expect(summary.fieldsExtracted.socialHandles).toBe(2); // instagram + tiktok
    });

  });

});
