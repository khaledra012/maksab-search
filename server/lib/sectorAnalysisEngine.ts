/**
 * Sector Analysis Engine - محرك التحليل القطاعي
 * 5 قطاعات: مطاعم، طبي، تجارة إلكترونية، منتجات رقمية، عام
 * 3 أوضاع لغوية: رسمي، مبيعات سعودي، مختصر
 */

export type Sector = "restaurants" | "medical" | "ecommerce" | "digital_products" | "general";
export type AnalysisLanguageMode = "msa_formal" | "saudi_sales_tone" | "arabic_sales_brief";

export interface SectorAnalysisInput {
  companyName: string;
  businessType?: string | null;
  city?: string | null;
  sector: Sector;
  languageMode: AnalysisLanguageMode;
  // بيانات الحضور الرقمي
  hasWebsite?: boolean;
  hasInstagram?: boolean;
  hasTwitter?: boolean;
  hasSnapchat?: boolean;
  hasTiktok?: boolean;
  hasFacebook?: boolean;
  hasGoogleMaps?: boolean;
  reviewCount?: number | null;
  websiteAnalysis?: string | null;
  socialAnalysis?: string | null;
  // بيانات إضافية
  notes?: string | null;
}

export interface SectorAnalysisOutput {
  // التحليل الأساسي
  digitalPresenceScore: number;           // 0-100
  marketingGapSummary: string;            // ملخص الثغرة التسويقية
  competitivePosition: string;            // الموقع التنافسي
  // فرص المبيعات
  primaryOpportunity: string;             // الفرصة الأولى
  secondaryOpportunity: string;           // الفرصة الثانية
  urgencyLevel: "high" | "medium" | "low"; // مستوى الإلحاح
  // الخدمات المقترحة (مكسب)
  recommendedServices: ServiceRecommendation[];
  // نقطة الدخول البيعية
  salesEntryAngle: string;                // زاوية الدخول
  iceBreaker: string;                     // جملة الافتتاح
  // التحليل القطاعي
  sectorInsights: string;                 // رؤى قطاعية
  benchmarkComparison: string;            // مقارنة بالسوق
  // ملخص الفرص التسويقية وخطة التطور
  marketingOpportunitiesSummary: string;  // ملخص شامل للفرص التسويقية بناءً على دراسة السوق
  growthDevelopmentPlan: string;          // خطة التطور والنمو المتوقع
  // درجة الأولوية
  leadPriorityScore: number;              // 1-10
  confidenceScore: number;               // 0-100
}

export interface ServiceRecommendation {
  service: "SEO" | "Ads" | "Social Media" | "Design";
  priority: "high" | "medium" | "low";
  reason: string;
  expectedImpact: string;
}

// ===== Language Mode Formatters =====
const LANGUAGE_INSTRUCTIONS: Record<AnalysisLanguageMode, string> = {
  msa_formal: `
اكتب بأسلوب عربي فصيح رسمي ومهني.
استخدم مصطلحات تسويقية دقيقة.
الجمل واضحة ومباشرة دون مبالغة.
`,
  saudi_sales_tone: `
اكتب بأسلوب مبيعات سعودي محلي ومقنع.
استخدم عبارات تحفيزية تناسب بيئة الأعمال السعودية.
ركز على الفرص الفورية والنتائج الملموسة.
يمكن استخدام بعض العبارات المحلية المألوفة في بيئة الأعمال.
`,
  arabic_sales_brief: `
اكتب بشكل مختصر جداً — جملة أو جملتان لكل نقطة.
ركز على الأرقام والنتائج المباشرة.
تجنب الشرح المطول.
`,
};

// ===== Sector-Specific Context =====
const SECTOR_CONTEXT: Record<Sector, string> = {
  restaurants: `
القطاع: مطاعم وكافيهات وخدمات الطعام
الخصائص السوقية في السعودية:
- المنافسة شديدة في المدن الكبرى (الرياض، جدة، الدمام)
- الاعتماد الكبير على التوصيل والطلب الإلكتروني (HungerStation, Jahez)
- تأثير قوي للسوشيال ميديا (Instagram, TikTok) على قرار الزيارة
- التقييمات على Google Maps عامل حاسم
- الموسمية (رمضان، الأعياد) تصنع فرصاً تسويقية ضخمة
الثغرات الشائعة: ضعف الهوية البصرية، غياب الإعلانات الموجهة، عدم تحسين Google Business Profile
`,
  medical: `
القطاع: عيادات ومستوصفات وخدمات طبية
الخصائص السوقية في السعودية:
- الطلب المتزايد على الرعاية الصحية الخاصة
- البحث عبر Google هو المصدر الأول للمرضى الجدد
- الثقة والمصداقية عامل حاسم (تقييمات، شهادات)
- التخصصات عالية الطلب: تجميل، أسنان، نساء وولادة، باطنية
- قيود إعلانية على بعض الخدمات الطبية
الثغرات الشائعة: ضعف SEO المحلي، غياب المحتوى التثقيفي، عدم إدارة التقييمات
`,
  ecommerce: `
القطاع: متاجر إلكترونية وتجارة رقمية
الخصائص السوقية في السعودية:
- سوق التجارة الإلكترونية ينمو بمعدل 30%+ سنوياً
- المنافسة مع Noon, Amazon, Salla, Zid
- الشحن السريع والدفع الآمن أولوية للمشتري السعودي
- Instagram وTikTok قنوات بيع مباشرة فعّالة
- برامج الولاء والعروض الموسمية محرك رئيسي
الثغرات الشائعة: ضعف تحسين محركات البحث للمنتجات، غياب إعلانات الاستهداف الدقيق، ضعف تجربة الموبايل
`,
  digital_products: `
القطاع: منتجات وخدمات رقمية وتقنية
الخصائص السوقية في السعودية:
- نمو متسارع في قطاع التقنية ضمن رؤية 2030
- الطلب على حلول SaaS والتحول الرقمي للشركات
- المنافسة مع شركات عالمية وإقليمية
- LinkedIn وTwitter قنوات B2B فعّالة
- المحتوى التقني والتعليمي يبني الثقة والسلطة
الثغرات الشائعة: ضعف التسويق بالمحتوى، غياب استراتيجية LinkedIn، ضعف SEO للكلمات التقنية
`,
  general: `
القطاع: أعمال تجارية عامة في السوق السعودي
الخصائص السوقية:
- السوق السعودي في مرحلة تحول رقمي متسارع
- المستهلك السعودي من أعلى المستهلكين استخداماً للسوشيال ميديا عالمياً
- الاعتماد المتزايد على البحث الرقمي لاتخاذ قرارات الشراء
- فرص كبيرة للشركات الصغيرة والمتوسطة في التسويق الرقمي
الثغرات الشائعة: غياب الاستراتيجية الرقمية الشاملة، ضعف الحضور الرقمي
`,
};

// ===== Maksab Services Context =====
const MAKSAB_SERVICES_CONTEXT = `
خدمات مكسب المتاحة:
1. SEO (تحسين محركات البحث): تحسين ظهور الموقع في Google، بناء الروابط، تحسين المحتوى
2. Ads (الإعلانات المدفوعة): Google Ads, Meta Ads, TikTok Ads, Snapchat Ads
3. Social Media (إدارة السوشيال ميديا): إنشاء المحتوى، إدارة الحسابات، بناء المتابعين
4. Design (التصميم): هوية بصرية، تصميم منشورات، تصميم مواقع، مواد تسويقية
`;

// ===== Main Prompt Builder =====
export function buildSectorAnalysisPrompt(input: SectorAnalysisInput): string {
  const languageInstructions = LANGUAGE_INSTRUCTIONS[input.languageMode];
  const sectorContext = SECTOR_CONTEXT[input.sector];

  // بناء ملخص الحضور الرقمي
  const digitalPresence = buildDigitalPresenceSummary(input);

  return `أنت محلل تسويق رقمي استراتيجي متخصص في السوق السعودي، تعمل لصالح شركة مكسب للتسويق الرقمي.

${languageInstructions}

${sectorContext}

${MAKSAB_SERVICES_CONTEXT}

بيانات العميل المحتمل:
- اسم النشاط: ${input.companyName}
- نوع النشاط: ${input.businessType || "غير محدد"}
- المدينة: ${input.city || "غير محدد"}
- الحضور الرقمي الحالي: ${digitalPresence}
${input.websiteAnalysis ? `- تحليل الموقع: ${input.websiteAnalysis}` : ""}
${input.socialAnalysis ? `- تحليل السوشيال: ${input.socialAnalysis}` : ""}
${input.notes ? `- ملاحظات: ${input.notes}` : ""}

قم بتحليل هذا العميل المحتمل وأجب بـ JSON فقط بالهيكل التالي:
{
  "digitalPresenceScore": <0-100>,
  "marketingGapSummary": "<ملخص الثغرة التسويقية الرئيسية>",
  "competitivePosition": "<الموقع التنافسي في السوق>",
  "primaryOpportunity": "<الفرصة التسويقية الأولى والأكثر إلحاحاً>",
  "secondaryOpportunity": "<الفرصة التسويقية الثانية>",
  "urgencyLevel": "<high|medium|low>",
  "recommendedServices": [
    {
      "service": "<SEO|Ads|Social Media|Design>",
      "priority": "<high|medium|low>",
      "reason": "<سبب التوصية>",
      "expectedImpact": "<التأثير المتوقع>"
    }
  ],
  "salesEntryAngle": "<زاوية الدخول البيعية المقترحة>",
  "iceBreaker": "<جملة الافتتاح المقترحة للتواصل مع العميل>",
  "sectorInsights": "<رؤى خاصة بهذا القطاع>",
  "benchmarkComparison": "<مقارنة وضع العميل بمعيار السوق>",
  "marketingOpportunitiesSummary": "<ملخص شامل ومفصّل للفرص التسويقية المتاحة بناءً على دراسة السوق ووضع المنافسين في هذا القطاع بالمدينة - فقرة كاملة 3-4 جمل>",
  "growthDevelopmentPlan": "<خطة مرحلية للتطور والنمو المتوقع لهذا النشاط خلال 6-12 شهراً بناءً على اتجاهات السوق وفرص النمو الرقمي - فقرة كاملة 3-4 جمل>",
  "leadPriorityScore": <1-10>,
  "confidenceScore": <0-100>
}`;
}

function buildDigitalPresenceSummary(input: SectorAnalysisInput): string {
  const channels: string[] = [];
  if (input.hasWebsite) channels.push("موقع إلكتروني");
  if (input.hasInstagram) channels.push("Instagram");
  if (input.hasTwitter) channels.push("Twitter/X");
  if (input.hasSnapchat) channels.push("Snapchat");
  if (input.hasTiktok) channels.push("TikTok");
  if (input.hasFacebook) channels.push("Facebook");
  if (input.hasGoogleMaps) channels.push(`Google Maps (${input.reviewCount || 0} تقييم)`);

  if (channels.length === 0) return "لا يوجد حضور رقمي مسجّل";
  return channels.join("، ");
}

// ===== Parse LLM Response =====
export function parseSectorAnalysisResponse(rawContent: string): SectorAnalysisOutput | null {
  try {
    // محاولة استخراج JSON من الاستجابة
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    // التحقق من الحقول الإلزامية
    if (typeof parsed.digitalPresenceScore !== "number") return null;
    if (!parsed.marketingGapSummary) return null;

    return {
      digitalPresenceScore: Math.min(100, Math.max(0, parsed.digitalPresenceScore)),
      marketingGapSummary: parsed.marketingGapSummary || "",
      competitivePosition: parsed.competitivePosition || "",
      primaryOpportunity: parsed.primaryOpportunity || "",
      secondaryOpportunity: parsed.secondaryOpportunity || "",
      urgencyLevel: ["high", "medium", "low"].includes(parsed.urgencyLevel) ? parsed.urgencyLevel : "medium",
      recommendedServices: Array.isArray(parsed.recommendedServices)
        ? parsed.recommendedServices.slice(0, 4).map((s: any) => ({
            service: ["SEO", "Ads", "Social Media", "Design"].includes(s.service) ? s.service : "Ads",
            priority: ["high", "medium", "low"].includes(s.priority) ? s.priority : "medium",
            reason: s.reason || "",
            expectedImpact: s.expectedImpact || "",
          }))
        : [],
      salesEntryAngle: parsed.salesEntryAngle || "",
      iceBreaker: parsed.iceBreaker || "",
      sectorInsights: parsed.sectorInsights || "",
      benchmarkComparison: parsed.benchmarkComparison || "",
      marketingOpportunitiesSummary: parsed.marketingOpportunitiesSummary || "",
      growthDevelopmentPlan: parsed.growthDevelopmentPlan || "",
      leadPriorityScore: Math.min(10, Math.max(1, parsed.leadPriorityScore || 5)),
      confidenceScore: Math.min(100, Math.max(0, parsed.confidenceScore || 50)),
    };
  } catch {
    return null;
  }
}

// ===== Sector Detection Helper =====
export function detectSectorFromBusinessType(businessType: string | null | undefined): Sector {
  if (!businessType) return "general";
  const bt = businessType.toLowerCase();

  const sectorKeywords: Record<Sector, string[]> = {
    restaurants: ["مطعم", "مطاعم", "كافيه", "كافيهات", "مقهى", "مقاهي", "وجبات", "أكل", "طعام", "بيتزا", "برغر", "شاورما", "حلويات", "مخبز", "ملحمة", "لحوم", "مشاوي", "restaurant", "cafe", "food"],
    medical: ["عيادة", "عيادات", "مستوصف", "مستشفى", "طبيب", "أطباء", "صيدلية", "تجميل", "أسنان", "نظارات", "بصريات", "clinic", "hospital", "pharmacy", "dental", "medical"],
    ecommerce: ["متجر", "متاجر", "تسوق", "بيع", "إلكتروني", "أونلاين", "توصيل", "store", "shop", "ecommerce", "online"],
    digital_products: ["تقنية", "برمجة", "تطبيق", "موقع", "ديجيتال", "رقمي", "سوفت", "آب", "tech", "software", "app", "digital", "web", "it"],
    general: [],
  };

  for (const [sector, keywords] of Object.entries(sectorKeywords) as [Sector, string[]][]) {
    if (sector === "general") continue;
    if (keywords.some(kw => bt.includes(kw))) return sector;
  }
  return "general";
}

// ===== Sector Labels =====
export const SECTOR_LABELS: Record<Sector, string> = {
  restaurants: "مطاعم وكافيهات",
  medical: "طبي وصحي",
  ecommerce: "تجارة إلكترونية",
  digital_products: "منتجات رقمية",
  general: "عام",
};

export const LANGUAGE_MODE_LABELS: Record<AnalysisLanguageMode, string> = {
  msa_formal: "عربي فصيح رسمي",
  saudi_sales_tone: "مبيعات سعودي",
  arabic_sales_brief: "مختصر",
};
