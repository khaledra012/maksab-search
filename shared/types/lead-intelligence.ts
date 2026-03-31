/**
 * Lead Intelligence — Unified Type Definitions (PHASE 1)
 * =======================================================
 * المرجع الوحيد لجميع أنواع البيانات في منظومة Lead Intelligence.
 * يُستخدم من قِبل جميع الـ Routers والـ Libs لضمان اتساق البيانات.
 *
 * الطبقات:
 *  1. Discovery  → DiscoveryCandidate   (مرشح خام من مصدر واحد)
 *  2. Source     → SourceRecord         (سجل المصدر الخام)
 *  3. Resolution → BusinessLead         (كيان موحد بعد دمج المصادر)
 *  4. Assets     → LeadAsset            (رابط رقمي مرتبط بالكيان)
 *  5. Audit      → SEOAudit / SocialAudit / ConversionAudit / MarketAudit
 *  6. Opportunity → LeadOpportunity
 *  7. Scoring    → LeadScore
 *  8. Brief      → SalesBrief
 *  9. Linkage    → LinkageScore / ResolvedGroup
 *
 * PHASE 1 CHANGES:
 *  - Added `id` field to DiscoveryCandidate
 *  - Changed source to strict union (not generic string)
 *  - Split phones/emails into verifiedXxx / candidateXxx
 *  - Added SourceRecord type
 *  - Added MarketAudit type
 *  - Updated LeadOpportunity.type to match new opportunity taxonomy
 *  - Updated LeadScore to use new breakdown keys
 *  - Updated BusinessLead to use new field names
 *  - Added `status` lifecycle field to BusinessLead
 */

// ─── 1. Discovery Layer ────────────────────────────────────────────────────────

/** منصات البحث المدعومة */
export type DiscoverySource =
  | "google"
  | "maps"
  | "instagram"
  | "tiktok"
  | "snapchat"
  | "x"
  | "facebook"
  | "linkedin"
  | "telegram"
  | "website";

/** نوع مصدر الاكتشاف */
export type DiscoverySourceType =
  | "search_result"
  | "profile"
  | "listing"
  | "page"
  | "post";

/**
 * مرشح خام يصدر من أي مصدر بحث (Google / SERP / Maps / Social)
 * قبل أي معالجة أو دمج.
 *
 * PHASE 1 KEY CHANGE:
 *  - verifiedPhones / candidatePhones (بدلاً من phones[])
 *  - verifiedEmails / candidateEmails (بدلاً من emails[])
 *  - verifiedWebsite / candidateWebsites (بدلاً من websites[])
 *  - source: DiscoverySource (strict union)
 *  - raw: unknown (بدلاً من rawSourceData)
 */
export type DiscoveryCandidate = {
  /** معرف فريد للمرشح */
  id: string;
  /** المصدر الذي جاء منه المرشح */
  source: DiscoverySource;
  /** نوع المصدر */
  sourceType: DiscoverySourceType;
  /** رابط الصفحة أو الحساب */
  url?: string;
  /** اسم العمل كما ظهر في المصدر */
  nameHint?: string;
  /** اسم المستخدم في المنصة */
  usernameHint?: string;
  /** اسم العمل التجاري المستنتج */
  businessNameHint?: string;
  /** تصنيف النشاط */
  categoryHint?: string;
  /** المدينة المستنتجة */
  cityHint?: string;
  /** المنطقة المستنتجة */
  regionHint?: string;
  /**
   * أرقام هاتف مؤكدة (مستخرجة مباشرة من صفحة هذا المرشح بـ regex)
   * لا تأتي من مصادر أخرى أو من AI
   */
  verifiedPhones: string[];
  /**
   * أرقام هاتف مرشحة (مستخرجة من نص الصفحة كاملاً أو من مصادر غير مباشرة)
   * تحتاج تحقق إضافي قبل الاعتماد عليها
   */
  candidatePhones: string[];
  /** بريد إلكتروني مؤكد */
  verifiedEmails: string[];
  /** بريد إلكتروني مرشح */
  candidateEmails: string[];
  /** الموقع الإلكتروني المؤكد (مستخرج مباشرة من الصفحة) */
  verifiedWebsite?: string;
  /** مواقع إلكترونية مرشحة */
  candidateWebsites: string[];
  /** درجة الثقة في هذا المرشح (0-1) */
  confidence: number;
  /** البيانات الخام من المصدر للرجوع إليها */
  raw: unknown;
};

// ─── 2. Source Record ──────────────────────────────────────────────────────────

/**
 * سجل المصدر الخام — يُحفظ مع BusinessLead لتتبع مصادر البيانات
 */
export type SourceRecord = {
  id: string;
  source: DiscoverySource | string;
  sourceType: DiscoverySourceType | string;
  url?: string;
  confidence: number;
  raw?: unknown;
};

// ─── 3. Assets Layer ───────────────────────────────────────────────────────────

/** منصات الأصول الرقمية */
export type AssetPlatform =
  | "instagram"
  | "tiktok"
  | "snapchat"
  | "x"
  | "facebook"
  | "linkedin"
  | "telegram"
  | "website"
  | "maps"
  | "google";

/** نوع الأصل الرقمي */
export type AssetType = "profile" | "page" | "website" | "listing" | "post";

/**
 * أصل رقمي مرتبط بكيان عمل (حساب سوشيال / موقع / خريطة)
 */
export type LeadAsset = {
  id: string;
  leadId: string;
  platform: AssetPlatform;
  assetType: AssetType;
  url: string;
  username?: string;
  /** درجة الثقة في صحة هذا الأصل (0-1) */
  confidence: number;
  raw?: unknown;
};

// ─── 4. Resolution Layer ───────────────────────────────────────────────────────

/** حالة دورة حياة الـ Lead */
export type LeadStatus =
  | "new"
  | "resolved"
  | "enriched"
  | "audited"
  | "scored"
  | "ready_for_sales"
  /** هوية غير مستقرة: تعارض في الحقول الحرجة — يتطلب مراجعة يدوية */
  | "identity_unstable";

/**
 * كيان العمل الموحد بعد دمج المرشحين من مصادر متعددة
 *
 * PHASE 1 KEY CHANGES:
 *  - normalizedBusinessName (بدلاً من normalizedName)
 *  - verifiedPhones[] / candidatePhones[] (بدلاً من verifiedPhone/candidatePhones)
 *  - verifiedEmails[] / candidateEmails[] (جديد)
 *  - socialProfiles object (بدلاً من assets فقط)
 *  - sourceRecords[] (جديد)
 *  - status lifecycle field (جديد)
 *  - score: LeadScore (بدلاً من score: number)
 *  - opportunities: LeadOpportunity[] (جديد)
 */
export type BusinessLead = {
  id: string;
  businessName: string;
  /** الاسم المعياري (normalized) للمقارنة */
  normalizedBusinessName: string;
  category?: string;
  subcategory?: string;
  city?: string;
  region?: string;
  country?: string;
  /** أرقام هاتف مؤكدة */
  verifiedPhones: string[];
  /** أرقام هاتف مرشحة */
  candidatePhones: string[];
  /** بريد إلكتروني مؤكد */
  verifiedEmails: string[];
  /** بريد إلكتروني مرشح */
  candidateEmails: string[];
  /** الموقع الإلكتروني المؤكد */
  verifiedWebsite?: string;
  /** مواقع إلكترونية مرشحة */
  candidateWebsites: string[];
  /** رابط Google Maps */
  googleMapsUrl?: string;
  /** حسابات السوشيال ميديا */
  socialProfiles: {
    instagram?: string;
    tiktok?: string;
    snapchat?: string;
    x?: string;
    facebook?: string;
    linkedin?: string;
    telegram?: string;
  };
  /** سجلات المصادر التي تم دمجها */
  sourceRecords: SourceRecord[];
  /** الأصول الرقمية المرتبطة */
  assets: LeadAsset[];
  /** تدقيق السيو */
  seoAudit?: SEOAudit;
  /** تدقيق السوشيال */
  socialAudit?: SocialAudit;
  /** تدقيق التحويل */
  conversionAudit?: ConversionAudit;
  /** تدقيق السوق */
  marketAudit?: MarketAudit;
  /** الفرص المستخرجة */
  opportunities: LeadOpportunity[];
  /** نتيجة التقييم */
  score?: LeadScore;
  /** ملخص السيلز */
  salesBrief?: SalesBrief;
  /** حالة دورة الحياة */
  status: LeadStatus;
  createdAt: string;
  updatedAt: string;
};

// ─── 5. Audit Layer ────────────────────────────────────────────────────────────

/**
 * تدقيق السيو والحضور في محركات البحث
 */
export type SEOAudit = {
  hasWebsite: boolean;
  searchPresence: "none" | "weak" | "moderate" | "strong";
  localSEOOpportunity: boolean;
  servicePageGap: boolean;
  metadataQuality: "poor" | "average" | "good";
  contentGap: boolean;
  technicalQuality: "poor" | "average" | "good";
  notes: string[];
};

/**
 * تدقيق السوشيال ميديا والتفاعل
 */
export type SocialAudit = {
  activePlatforms: string[];
  activityLevel: "low" | "medium" | "high";
  ctaStrength: "weak" | "medium" | "strong";
  brandConsistency: "low" | "medium" | "high";
  offerClarity: "weak" | "medium" | "strong";
  engagementHealth: "weak" | "medium" | "strong";
  trustSignals: string[];
  notes: string[];
};

/**
 * تدقيق قنوات التحويل والتواصل
 */
export type ConversionAudit = {
  hasPhone: boolean;
  hasWhatsApp: boolean;
  hasBookingFlow: boolean;
  hasOrderFlow: boolean;
  hasForm: boolean;
  contactReadiness: "low" | "medium" | "high";
  funnelWeaknesses: string[];
  notes: string[];
};

/**
 * تدقيق السوق والمنافسين (جديد في PHASE 1)
 */
export type MarketAudit = {
  reviewSignals: string[];
  complaintThemes: string[];
  competitorHints: string[];
  demandSignals: string[];
  notes: string[];
};

// ─── 6. Opportunity Layer ──────────────────────────────────────────────────────

/** أنواع الفرص التسويقية */
export type OpportunityType =
  | "local_seo"
  | "technical_seo"
  | "content_strategy"
  | "social_optimization"
  | "branding"
  | "landing_page"
  | "paid_tracking"
  | "retargeting"
  | "whatsapp_funnel"
  | "reputation_management"
  | "conversion_optimization";

/**
 * فرصة تسويقية مستخرجة من التدقيقات
 */
export type LeadOpportunity = {
  id: string;
  leadId?: string;
  type: OpportunityType;
  severity: "low" | "medium" | "high";
  /** أدلة متعددة على الفرصة */
  evidence: string[];
  /** الأثر التجاري */
  businessImpact: string;
  /** الإجراء المقترح */
  suggestedAction: string;
};

// ─── 7. Scoring Layer ──────────────────────────────────────────────────────────

/**
 * نتيجة تقييم الـ Lead
 * PHASE 1: تحديث breakdown keys لتتوافق مع المتطلبات الجديدة
 */
export type LeadScore = {
  value: number;
  priority: "A" | "B" | "C" | "D";
  reasons: string[];
  breakdown: {
    /** قابلية التواصل (هاتف، واتساب، بريد) */
    contactability: number;
    /** الحضور الرقمي (موقع، سوشيال) */
    digitalPresence: number;
    /** وضوح النشاط التجاري */
    commercialClarity: number;
    /** حجم الفجوات التسويقية */
    gapSeverity: number;
    /** ملاءمة الفرص */
    opportunityFit: number;
    /** جودة الأدلة */
    evidenceQuality: number;
  };
};

// ─── 8. Sales Brief Layer ──────────────────────────────────────────────────────

/**
 * ملخص جاهز للسيلز - مخرج نهائي قابل للاستخدام الفوري
 */
export type SalesBrief = {
  businessName: string;
  city?: string;
  category?: string;
  topFindings: string[];
  topOpportunity: string;
  leadScore: number;
  priority: "A" | "B" | "C" | "D";
  bestContactChannel: "whatsapp" | "phone" | "instagram" | "email" | "linkedin";
  salesAngle: string;
  firstMessageHint: string;
};

// ─── 9. Identity Linkage Types ─────────────────────────────────────────────────

/**
 * نتيجة مقارنة بين مرشحين لتحديد إذا كانا نفس الكيان
 * PHASE 1: تحديث الأوزان لتتوافق مع المتطلبات الجديدة
 */
export type LinkageScore = {
  candidateA: DiscoveryCandidate;
  candidateB: DiscoveryCandidate;
  /** الدرجة الإجمالية للتشابه (0-1) */
  totalScore: number;
  /** هل يجب الدمج؟ */
  shouldMerge: boolean;
  breakdown: {
    /** تشابه الاسم (35%) */
    nameScore: number;
    /** تطابق رقم الهاتف المؤكد (25%) */
    phoneScore: number;
    /** تطابق الموقع الإلكتروني (20%) */
    websiteScore: number;
    /** تطابق رابط البيو / الروابط الخارجية (10%) */
    bioLinkScore: number;
    /** تطابق المدينة والتصنيف (5%) */
    cityAndCategoryScore: number;
    /** تشابه الـ handle السوشيال (5%) */
    socialHandleScore: number;
  };
  /** الإشارات المتطابقة */
  matchedSignals: string[];
  /** سبب قرار الدمج أو عدمه */
  reason: string;
};

/**
 * مجموعة من المرشحين الذين تم تحديدهم كنفس الكيان
 */
export type ResolvedGroup = {
  primary: DiscoveryCandidate;
  duplicates: DiscoveryCandidate[];
  mergeConfidence: number;
  sources: string[];
};

// ─── 10. Legacy Compatibility ──────────────────────────────────────────────────

/**
 * @deprecated استخدم BusinessLead بدلاً منه
 * يُبقى للتوافق مع الكود القديم فقط
 */
export type LegacyBusinessLead = {
  id: string;
  businessName: string;
  /** @deprecated استخدم normalizedBusinessName */
  normalizedName: string;
  category?: string;
  city?: string;
  /** @deprecated استخدم verifiedPhones[0] */
  verifiedPhone?: string;
  candidatePhones: string[];
  /** @deprecated استخدم verifiedWebsite */
  verifiedWebsite?: string;
  candidateWebsites: string[];
  email?: string;
  priority?: "A" | "B" | "C" | "D";
  score?: number;
  mergedSources: string[];
  mergeCount: number;
  mergeConfidence: number;
  assets?: LeadAsset[];
  createdAt?: Date;
};

// ─── PHASE 3: AutoFill Types ───────────────────────────────────────────────────

/**
 * Analysis readiness state — computed deterministically from missing-field counts.
 * NOT an AI score. NOT an audit result.
 */
export type AnalysisReadinessState =
  | "ready_for_analysis"
  | "partially_analyzable"
  | "missing_critical_data"
  | "not_analyzable";

/**
 * Result returned by runAutofill() after processing a lead.
 * candidatePhones/Emails/Websites are in-memory only — NOT persisted in PHASE 3.
 */
export type AutoFillResult = {
  leadId: number;
  fieldsUpdated: string[];
  missingCount: number;
  readinessState: AnalysisReadinessState;
  confidenceScore: number;
  /** In-memory only — NOT persisted to DB in PHASE 3 */
  candidatePhones: string[];
  candidateEmails: string[];
  candidateWebsites: string[];
};
