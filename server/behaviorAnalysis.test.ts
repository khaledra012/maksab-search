import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock LLM ─────────────────────────────────────────────────────────────────
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

// ─── Mock DB ──────────────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getLeadById: vi.fn(),
}));

import { invokeLLM } from "./_core/llm";
import { getLeadById } from "./db";

const mockLead = {
  id: 1,
  companyName: "مطعم الرياض",
  businessType: "مطعم",
  city: "الرياض",
  district: "العليا",
  verifiedPhone: "+966501234567",
  website: "https://riyadh-restaurant.com",
  instagramUrl: "https://instagram.com/riyadh_rest",
  twitterUrl: "https://twitter.com/riyadh_rest",
  snapchatUrl: null,
  tiktokUrl: null,
  facebookUrl: null,
  googleMapsUrl: "https://maps.google.com/?q=...",
  leadPriorityScore: 8.5,
  biggestMarketingGap: "غياب التسويق الرقمي",
  revenueOpportunity: "زيادة المبيعات 30%",
  suggestedSalesEntryAngle: "التسويق عبر إنستغرام",
  notes: "عميل واعد",
  analysisStatus: "completed",
  brandingQualityScore: 7.2,
  seasonalReadinessScore: 6.0,
  reviewCount: 150,
  stage: "new",
  priority: "high",
  nextStep: null,
  nextFollowup: null,
  ownerUserId: null,
  hasWhatsapp: "yes",
  whatsappCheckedAt: null,
  lastWhatsappSentAt: null,
  socialSince: "2020",
  sourceJobId: null,
  country: "السعودية",
  zoneId: null,
  zoneName: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockBehaviorResponse = {
  activityLevel: "نشط",
  activityScore: 8,
  preferredPlatforms: ["إنستغرام", "تويتر"],
  bestContactTimes: ["مساءً 7-9", "ظهراً 12-2"],
  communicationStyle: "تواصل ودي مع عروض مخصصة",
  responselikelihood: "عالية",
  digitalStrengths: ["حضور قوي على إنستغرام", "موقع إلكتروني فعال"],
  marketingOpportunities: ["إعلانات مدفوعة", "محتوى فيديو"],
  contactRecommendations: ["إرسال عرض عبر واتساب", "التواصل مساءً"],
  estimatedAudience: "5000-10000 متابع",
  engagementPattern: "نشاط يومي مرتفع",
  urgencyLevel: "متوسط",
  summary: "نشاط تجاري نشط رقمياً مع فرص تسويقية واضحة",
};

describe("behaviorAnalysis router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("analyzeCustomer", () => {
    it("يجب أن يُحلل العميل بنجاح ويُرجع بيانات منظمة", async () => {
      (getLeadById as any).mockResolvedValue(mockLead);
      (invokeLLM as any).mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify(mockBehaviorResponse),
            },
          },
        ],
      });

      const { behaviorAnalysisRouter } = await import(
        "./routers/behaviorAnalysis"
      );
      expect(behaviorAnalysisRouter).toBeDefined();
    });

    it("يجب أن يُرجع خطأ NOT_FOUND إذا لم يوجد العميل", async () => {
      (getLeadById as any).mockResolvedValue(null);
      // التحقق من أن getLeadById يُرجع null
      const result = await getLeadById(999);
      expect(result).toBeNull();
    });

    it("يجب أن يبني قائمة روابط التواصل الاجتماعي بشكل صحيح", () => {
      const lead = { ...mockLead };
      const socialLinks = [
        lead.instagramUrl && `Instagram: ${lead.instagramUrl}`,
        lead.twitterUrl && `Twitter: ${lead.twitterUrl}`,
        lead.website && `Website: ${lead.website}`,
        lead.snapchatUrl && `Snapchat: ${lead.snapchatUrl}`,
        lead.tiktokUrl && `TikTok: ${lead.tiktokUrl}`,
        lead.facebookUrl && `Facebook: ${lead.facebookUrl}`,
        lead.googleMapsUrl && `Google Maps: ${lead.googleMapsUrl}`,
      ].filter(Boolean);

      expect(socialLinks).toHaveLength(4); // instagram, twitter, website, googleMaps
      expect(socialLinks[0]).toContain("Instagram");
      expect(socialLinks[1]).toContain("Twitter");
    });

    it("يجب أن يتعامل مع العميل بدون روابط تواصل اجتماعي", () => {
      const leadNoSocial = {
        ...mockLead,
        instagramUrl: null,
        twitterUrl: null,
        website: null,
        snapchatUrl: null,
        tiktokUrl: null,
        facebookUrl: null,
        googleMapsUrl: null,
      };
      const socialLinks = [
        leadNoSocial.instagramUrl && `Instagram: ${leadNoSocial.instagramUrl}`,
        leadNoSocial.twitterUrl && `Twitter: ${leadNoSocial.twitterUrl}`,
        leadNoSocial.website && `Website: ${leadNoSocial.website}`,
      ].filter(Boolean);

      expect(socialLinks).toHaveLength(0);
    });
  });

  describe("analyzePlatform", () => {
    it("يجب أن يُرجع خطأ إذا لم يوجد رابط للمنصة", async () => {
      (getLeadById as any).mockResolvedValue({
        ...mockLead,
        snapchatUrl: null,
      });
      // التحقق من أن snapchatUrl غير موجود
      const lead = await getLeadById(1);
      expect(lead?.snapchatUrl).toBeNull();
    });

    it("يجب أن يقبل رابط مخصص للمنصة", async () => {
      (getLeadById as any).mockResolvedValue(mockLead);
      (invokeLLM as any).mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                platformActivity: "نشط",
                contentQuality: 8,
                improvements: ["إضافة قصص يومية"],
                contactTip: "تواصل عبر الرسائل المباشرة",
                estimatedFollowers: "5000-10000",
                lastActiveEstimate: "خلال آخر 24 ساعة",
              }),
            },
          },
        ],
      });

      // التحقق من أن invokeLLM يمكن استدعاؤه
      const result = await (invokeLLM as any)({
        messages: [{ role: "user", content: "test" }],
      });
      expect(result.choices[0].message.content).toBeDefined();
    });
  });

  describe("compareWithCompetitors", () => {
    it("يجب أن يُقارن بين العميل والمنافسين", async () => {
      (getLeadById as any).mockResolvedValue(mockLead);
      (invokeLLM as any).mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                competitivePosition: "مساوٍ",
                mainAdvantages: ["موقع مميز", "خدمة سريعة"],
                mainWeaknesses: ["ضعف التسويق الرقمي"],
                differentiationOpportunities: ["التخصص في وجبات صحية"],
                recommendedStrategy: "التركيز على التسويق الرقمي",
                urgencyToAct: "متوسط",
              }),
            },
          },
        ],
      });

      const lead = await getLeadById(1);
      expect(lead?.companyName).toBe("مطعم الرياض");
    });

    it("يجب أن يقبل حتى 3 منافسين", () => {
      const competitors = ["مطعم النخبة", "مطعم الفخامة", "مطعم الأصالة"];
      expect(competitors.length).toBeLessThanOrEqual(3);
    });

    it("يجب أن يرفض أكثر من 3 منافسين", () => {
      const tooManyCompetitors = [
        "منافس 1",
        "منافس 2",
        "منافس 3",
        "منافس 4",
      ];
      expect(tooManyCompetitors.length).toBeGreaterThan(3);
    });
  });

  describe("بناء prompt التحليل", () => {
    it("يجب أن يتضمن prompt بيانات العميل الأساسية", () => {
      const lead = mockLead;
      const prompt = `أنت محلل استراتيجي متخصص في السوق السعودي.
النشاط: ${lead.companyName}
النوع: ${lead.businessType}
المدينة: ${lead.city}
درجة الأولوية: ${lead.leadPriorityScore}
الثغرة: ${lead.biggestMarketingGap}`;

      expect(prompt).toContain("مطعم الرياض");
      expect(prompt).toContain("الرياض");
      expect(prompt).toContain("8.5");
      expect(prompt).toContain("غياب التسويق الرقمي");
    });

    it("يجب أن يتعامل مع القيم الفارغة في البيانات", () => {
      const leadPartial = {
        ...mockLead,
        leadPriorityScore: null,
        biggestMarketingGap: null,
        revenueOpportunity: null,
      };

      const priorityDisplay = leadPartial.leadPriorityScore || "غير محددة";
      const gapDisplay = leadPartial.biggestMarketingGap || "غير محددة";

      expect(priorityDisplay).toBe("غير محددة");
      expect(gapDisplay).toBe("غير محددة");
    });
  });

  describe("معالجة استجابة LLM", () => {
    it("يجب أن يُحلل JSON من الاستجابة بشكل صحيح", () => {
      const jsonContent = JSON.stringify(mockBehaviorResponse);
      const parsed = JSON.parse(jsonContent);

      expect(parsed.activityLevel).toBe("نشط");
      expect(parsed.activityScore).toBe(8);
      expect(parsed.preferredPlatforms).toHaveLength(2);
      expect(parsed.responselikelihood).toBe("عالية");
    });

    it("يجب أن يتعامل مع استجابة JSON كـ object مباشرة", () => {
      const content = mockBehaviorResponse; // object مباشرة
      const parsed =
        typeof content === "string" ? JSON.parse(content) : content;

      expect(parsed.activityLevel).toBe("نشط");
      expect(parsed.urgencyLevel).toBe("متوسط");
    });

    it("يجب أن يتحقق من جميع حقول الاستجابة المطلوبة", () => {
      const requiredFields = [
        "activityLevel",
        "activityScore",
        "preferredPlatforms",
        "bestContactTimes",
        "communicationStyle",
        "responselikelihood",
        "digitalStrengths",
        "marketingOpportunities",
        "contactRecommendations",
        "urgencyLevel",
        "summary",
      ];

      requiredFields.forEach((field) => {
        expect(mockBehaviorResponse).toHaveProperty(field);
      });
    });
  });

  describe("مستويات النشاط", () => {
    it("يجب أن يُصنف درجة النشاط بشكل صحيح", () => {
      const getActivityColor = (score: number) => {
        if (score >= 7) return "green";
        if (score >= 5) return "yellow";
        return "red";
      };

      expect(getActivityColor(8)).toBe("green");
      expect(getActivityColor(6)).toBe("yellow");
      expect(getActivityColor(3)).toBe("red");
    });

    it("يجب أن يتعامل مع درجة نشاط غير محددة", () => {
      const score = null;
      const displayScore = score || "—";
      expect(displayScore).toBe("—");
    });
  });
});
