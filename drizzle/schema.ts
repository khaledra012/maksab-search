import {
  int,
  bigint,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  float,
  boolean,
  json,
  tinyint,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  defaultWhatsappAccountId: varchar("defaultWhatsappAccountId", { length: 64 }), // حساب واتساب الافتراضي للموظف
  passwordHash: varchar("passwordHash", { length: 255 }), // كلمة المرور المشفرة (لتسجيل الدخول المستقل)
  isActive: boolean("isActive").default(true).notNull(), // تفعيل/تعطيل الحساب
  displayName: varchar("displayName", { length: 100 }), // الاسم الظاهر
  department: varchar("department", { length: 100 }), // القسم
  dailyMessageLimit: int("dailyMessageLimit").default(0).notNull(), // 0 = unlimited, >0 = max messages per day
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ===== ZONES TABLE =====
export const zones = mysqlTable("zones", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  nameEn: varchar("nameEn", { length: 100 }),
  region: varchar("region", { length: 100 }).notNull(),
  status: mysqlEnum("status", ["not_started", "in_progress", "completed"]).default("not_started").notNull(),
  leadsCount: int("leadsCount").default(0).notNull(),
  targetLeads: int("targetLeads").default(20).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Zone = typeof zones.$inferSelect;
export type InsertZone = typeof zones.$inferInsert;

// ===== LEADS TABLE =====
export const leads = mysqlTable("leads", {
  id: int("id").autoincrement().primaryKey(),
  companyName: varchar("companyName", { length: 200 }).notNull(),
  businessType: varchar("businessType", { length: 100 }).notNull(),
  country: varchar("country", { length: 100 }).default("السعودية").notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  district: varchar("district", { length: 100 }),
  zoneId: int("zoneId"),
  zoneName: varchar("zoneName", { length: 100 }),
  verifiedPhone: varchar("verifiedPhone", { length: 20 }),
  email: varchar("email", { length: 320 }),  // إيميل النشاط التجاري
  website: varchar("website", { length: 500 }),
  googleMapsUrl: varchar("googleMapsUrl", { length: 1000 }),
  instagramUrl: varchar("instagramUrl", { length: 500 }),
  twitterUrl: varchar("twitterUrl", { length: 500 }),
  snapchatUrl: varchar("snapchatUrl", { length: 500 }),
  tiktokUrl: varchar("tiktokUrl", { length: 500 }),
  facebookUrl: varchar("facebookUrl", { length: 500 }),
  linkedinUrl: varchar("linkedinUrl", { length: 500 }),
  reviewCount: int("reviewCount").default(0),
  brandingQualityScore: float("brandingQualityScore"),
  seasonalReadinessScore: float("seasonalReadinessScore"),
  leadPriorityScore: float("leadPriorityScore"),
  biggestMarketingGap: text("biggestMarketingGap"),
  revenueOpportunity: text("revenueOpportunity"),
  suggestedSalesEntryAngle: text("suggestedSalesEntryAngle"),
  analysisStatus: mysqlEnum("analysisStatus", ["pending", "analyzing", "completed", "failed"]).default("pending").notNull(),
  sourceJobId: int("sourceJobId"),   // رابط بمهمة البحث التي أنشأت هذا الـ Lead
  socialSince: varchar("socialSince", { length: 20 }),  // تاريخ الظهور على السوشيال ميديا (مثال: 2019، 2020-05)
  crNumber: varchar("crNumber", { length: 30 }),  // رقم السجل التجاري
  clientLogoUrl: varchar("clientLogoUrl", { length: 1000 }),  // لوجو العميل (favicon أو إنستغرام)
  placePhotos: json("placePhotos").$type<string[]>(),  // صور المكان من Google Maps (روابط مباشرة)
  googleReviewsData: json("googleReviewsData").$type<Array<{ author: string; rating: number; text: string; time: string }>>(),  // نص مراجعات Google Maps
  googleRating: float("googleRating"),  // تقييم Google Maps الحقيقي
  hasWhatsapp: mysqlEnum("hasWhatsapp", ["unknown", "yes", "no"]).default("unknown").notNull(),
  whatsappCheckedAt: timestamp("whatsappCheckedAt"),
  lastWhatsappSentAt: timestamp("lastWhatsappSentAt"),
  notes: text("notes"),
  // ===== التصنيف الإلزامي =====
  stage: mysqlEnum("stage", ["new", "contacted", "interested", "price_offer", "meeting", "won", "lost", "deferred", "cancelled"]).default("new").notNull(),
  priority: mysqlEnum("priority", ["high", "medium", "low"]).default("medium").notNull(),
  nextStep: text("next_step"),
  nextFollowup: bigint("next_followup", { mode: "number" }),
  ownerUserId: int("owner_user_id"),

  // ===== Phase 1: Data Normalization & Deduplication =====
  normalizedBusinessName: varchar("normalized_business_name", { length: 300 }),
  normalizedPhone: varchar("normalized_phone", { length: 30 }),
  normalizedDomain: varchar("normalized_domain", { length: 500 }),
  duplicateConfidenceScore: float("duplicate_confidence_score").default(0),
  duplicateCandidateIds: json("duplicate_candidate_ids").$type<number[]>(),
  deduplicationStatus: mysqlEnum("deduplication_status", ["unchecked", "no_duplicate", "possible_duplicate", "confirmed_duplicate", "merged_manually"]).default("unchecked"),
  dataQualityScore: float("data_quality_score").default(0),

  // ===== Phase 1: Manual Review Layer =====
  manualReviewStatus: mysqlEnum("manual_review_status", ["pending", "in_review", "approved", "rejected", "draft"]).default("pending"),
  reviewedByUserId: int("reviewed_by_user_id"),
  reviewedAt: timestamp("reviewed_at"),

  // ===== Phase 1: Sector Classification =====
  sectorMain: mysqlEnum("sector_main", ["restaurants", "medical", "ecommerce", "digital_products", "general"]).default("general"),
  sectorSub: varchar("sector_sub", { length: 100 }),

  // ===== Phase 1: Analysis Settings =====
  analysisLanguageMode: mysqlEnum("analysis_language_mode", ["msa_formal", "saudi_sales_tone", "arabic_sales_brief"]).default("saudi_sales_tone"),
  analysisType: varchar("analysis_type", { length: 50 }).default("full"),
  analysisSalesGoal: varchar("analysis_sales_goal", { length: 200 }),
  recommendedOfferType: mysqlEnum("recommended_offer_type", ["seo", "ads", "social", "design", "bundle", "none"]),
  recommendedServiceBundle: json("recommended_service_bundle").$type<string[]>(),
  reportStatus: mysqlEnum("report_status", ["not_generated", "generating", "ready", "failed"]).default("not_generated"),
  reportTemplateType: mysqlEnum("report_template_type", ["internal", "client_facing"]).default("internal"),
  clientFacingReport: boolean("client_facing_report").default(false),
  watermarkEnabled: boolean("watermark_enabled").default(true),

  // ===== Phase 1: LLM Tracking =====
  llmModelName: varchar("llm_model_name", { length: 100 }),
  llmPromptTemplateId: varchar("llm_prompt_template_id", { length: 100 }),
  llmAnalysisVersion: varchar("llm_analysis_version", { length: 20 }),
  llmGenerationStatus: mysqlEnum("llm_generation_status", ["idle", "queued", "generating", "done", "failed"]).default("idle"),
  llmGenerationError: text("llm_generation_error"),
  autoAnalysisEnabled: boolean("auto_analysis_enabled").default(false),
  autoAnalysisStatus: mysqlEnum("auto_analysis_status", ["idle", "queued", "running", "done", "failed"]).default("idle"),
  analysisReadyFlag: boolean("analysis_ready_flag").default(false),
  analysisConfidenceScore: float("analysis_confidence_score").default(0),

  // ===== Phase 2: Sector Analysis Results =====
  marketingGapSummary: text("marketing_gap_summary"),
  competitivePosition: text("competitive_position"),
  primaryOpportunity: text("primary_opportunity"),
  secondaryOpportunity: text("secondary_opportunity"),
  urgencyLevel: mysqlEnum("urgency_level", ["high", "medium", "low"]).default("medium"),
  recommendedServices: json("recommended_services").$type<Array<{ service: string; priority: string; reason: string; expectedImpact: string }>>(),
  salesEntryAngle: text("sales_entry_angle"),
  iceBreaker: text("ice_breaker"),
  sectorInsights: text("sector_insights"),
  benchmarkComparison: text("benchmark_comparison"),
  marketingOpportunitiesSummary: text("marketing_opportunities_summary"),
  growthDevelopmentPlan: text("growth_development_plan"),
  aiConfidenceScore: float("ai_confidence_score").default(0),
  lastAnalyzedAt: bigint("last_analyzed_at", { mode: "number" }),

  // ===== Processing Queue =====
  processingStatus: mysqlEnum("processing_status", ["pending", "in_progress", "completed", "failed", "skipped"]).default("pending"),
  processingErrorMessage: text("processing_error_message"),
  jobQueueStatus: mysqlEnum("job_queue_status", ["idle", "queued", "running", "done", "failed"]).default("idle"),
  jobStartedAt: timestamp("job_started_at"),
  jobCompletedAt: timestamp("job_completed_at"),
  retryCount: int("retry_count").default(0),
  lastRetryAt: timestamp("last_retry_at"),

  // ===== Custom Recommendations =====
  customRecommendations: text("custom_recommendations"),  // توصيات مخصصة يُدخلها المستخدم يدوياً
  additionalNotes: text("additional_notes"),  // توضيحات إضافية يقرأها AI في التحليل والتقرير

  // ===== Phase 1: PDF Report =====
  pdfGenerationStatus: mysqlEnum("pdf_generation_status", ["not_generated", "generating", "ready", "failed"]).default("not_generated"),
  pdfTemplateVersion: varchar("pdf_template_version", { length: 20 }),
  pdfRenderEngine: varchar("pdf_render_engine", { length: 50 }),
  pdfFileUrl: varchar("pdf_file_url", { length: 1000 }),
  pdfGeneratedAt: timestamp("pdf_generated_at"),

  // ===== Phase 1: Security & Audit =====
  createdByUserId: int("created_by_user_id"),
  lastModifiedByUserId: int("last_modified_by_user_id"),
  accessScope: mysqlEnum("access_scope", ["all", "owner_only", "team"]).default("all"),

  // ===== Phase 1: External Integrations Status =====
  gscConnected: boolean("gsc_connected").default(false),
  ga4Connected: boolean("ga4_connected").default(false),
  metaConnected: boolean("meta_connected").default(false),
  externalAnalysisStatus: mysqlEnum("external_analysis_status", ["idle", "running", "done", "partial", "failed"]).default("idle"),
  externalAnalysisLastRunAt: timestamp("external_analysis_last_run_at"),
  missingDataFlags: json("missing_data_flags").$type<string[]>(),
  partialAnalysisFlag: boolean("partial_analysis_flag").default(false),

  // ===== Phase 5: Lead Scoring (حفظ نتيجة التقييم) =====
  scoringValue: int("scoring_value"),                                          // 0-100
  scoringPriority: mysqlEnum("scoring_priority", ["A", "B", "C", "D"]),         // A/B/C/D
  scoringReasons: json("scoring_reasons").$type<string[]>(),                    // أسباب النتيجة
  scoringBreakdown: json("scoring_breakdown").$type<Record<string, number>>(),  // breakdown بالأبعاد
  scoringOpportunities: json("scoring_opportunities").$type<Array<{            // الفرص المكتشفة
    id: string; type: string; severity: string;
    evidence: string[]; businessImpact: string; suggestedAction: string;
  }>>(),
  scoringReadinessState: varchar("scoring_readiness_state", { length: 50 }),   // حالة الجاهزية
  scoringRunAt: bigint("scoring_run_at", { mode: "number" }),                  // وقت آخر تقييم

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;

// ===== SEARCH JOBS TABLE (محرك البحث الخلفي) =====
export const searchJobs = mysqlTable("search_jobs", {
  id: int("id").autoincrement().primaryKey(),
  // إعدادات المهمة
  jobName: varchar("jobName", { length: 200 }).notNull(),
  country: varchar("country", { length: 100 }).notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  businessType: varchar("businessType", { length: 200 }).notNull(),
  searchKeywords: json("searchKeywords").$type<string[]>(),  // كلمات البحث المتعددة
  targetCount: int("targetCount").default(50).notNull(),
  // حالة المهمة
  status: mysqlEnum("status", ["pending", "running", "paused", "completed", "failed"]).default("pending").notNull(),
  // تقدم المهمة
  totalSearched: int("totalSearched").default(0).notNull(),
  totalFound: int("totalFound").default(0).notNull(),
  totalDuplicates: int("totalDuplicates").default(0).notNull(),
  totalAdded: int("totalAdded").default(0).notNull(),
  currentKeyword: varchar("currentKeyword", { length: 200 }),
  currentPage: int("currentPage").default(0).notNull(),
  nextPageToken: text("nextPageToken"),
  // سجل العمليات
  log: json("log").$type<Array<{ time: string; message: string; type: "info" | "success" | "warning" | "error" }>>(),
  errorMessage: text("errorMessage"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SearchJob = typeof searchJobs.$inferSelect;
export type InsertSearchJob = typeof searchJobs.$inferInsert;

// ===== WEBSITE ANALYSIS TABLE =====
export const websiteAnalyses = mysqlTable("website_analyses", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull(),
  url: varchar("url", { length: 500 }).notNull(),
  hasWebsite: boolean("hasWebsite").default(false),
  loadSpeedScore: float("loadSpeedScore"),
  mobileExperienceScore: float("mobileExperienceScore"),
  seoScore: float("seoScore"),
  contentQualityScore: float("contentQualityScore"),
  designScore: float("designScore"),
  offerClarityScore: float("offerClarityScore"),
  hasSeasonalPage: boolean("hasSeasonalPage").default(false),
  hasOnlineBooking: boolean("hasOnlineBooking").default(false),
  hasPaymentOptions: boolean("hasPaymentOptions").default(false),
  hasDeliveryInfo: boolean("hasDeliveryInfo").default(false),
  technicalGaps: json("technicalGaps").$type<string[]>(),
  contentGaps: json("contentGaps").$type<string[]>(),
  overallScore: float("overallScore"),
  summary: text("summary"),
  recommendations: json("recommendations").$type<string[]>(),
  rawAnalysis: text("rawAnalysis"),
  screenshotUrl: varchar("screenshotUrl", { length: 1000 }),  // صورة الموقع من Headless Browser
  analyzedAt: timestamp("analyzedAt").defaultNow().notNull(),
});

export type WebsiteAnalysis = typeof websiteAnalyses.$inferSelect;
export type InsertWebsiteAnalysis = typeof websiteAnalyses.$inferInsert;

// ===== SOCIAL MEDIA ANALYSIS TABLE =====
export const socialAnalyses = mysqlTable("social_analyses", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull(),
  platform: mysqlEnum("platform", ["instagram", "twitter", "snapchat", "tiktok", "facebook"]).notNull(),
  profileUrl: varchar("profileUrl", { length: 500 }),
  hasAccount: boolean("hasAccount").default(false),
  postingFrequencyScore: float("postingFrequencyScore"),
  engagementScore: float("engagementScore"),
  contentQualityScore: float("contentQualityScore"),
  hasSeasonalContent: boolean("hasSeasonalContent").default(false),
  hasPricingContent: boolean("hasPricingContent").default(false),
  hasCallToAction: boolean("hasCallToAction").default(false),
  contentStrategyScore: float("contentStrategyScore"),
  digitalPresenceScore: float("digitalPresenceScore"),
  gaps: json("gaps").$type<string[]>(),
  overallScore: float("overallScore"),
  summary: text("summary"),
  recommendations: json("recommendations").$type<string[]>(),
  rawAnalysis: text("rawAnalysis"),
  // === Bright Data Dataset API real data fields ===
  followersCount: int("followersCount").default(0),
  engagementRate: float("engagementRate").default(0),
  postsCount: int("postsCount").default(0),
  avgLikes: int("avgLikes").default(0),
  avgViews: int("avgViews").default(0),
  analysisText: text("analysisText"),
  dataSource: varchar("dataSource", { length: 50 }),
  screenshotUrl: varchar("screenshotUrl", { length: 1000 }),  // لقطة شاشة صفحة السوشيال ميديا
  competitorScreenshots: json("competitorScreenshots").$type<{name: string; url: string; screenshotUrl?: string; followersCount?: number; score?: number}[]>(),  // Screenshots المنافسين في نفس المنصة
  analyzedAt: timestamp("analyzedAt").defaultNow().notNull(),
});

export type SocialAnalysis = typeof socialAnalyses.$inferSelect;
export type InsertSocialAnalysis = typeof socialAnalyses.$inferInsert;

// ===== WHATSAPP MESSAGES TABLE =====
export const whatsappMessages = mysqlTable("whatsapp_messages", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  message: text("message").notNull(),
  messageType: mysqlEnum("messageType", ["individual", "bulk"]).default("individual").notNull(),
  bulkJobId: varchar("bulkJobId", { length: 64 }),  // معرف دفعة الإرسال المجمع
  status: mysqlEnum("status", ["sent", "pending", "failed"]).default("sent").notNull(),
  sentAt: timestamp("sentAt").defaultNow().notNull(),
});

export type WhatsappMessage = typeof whatsappMessages.$inferSelect;
export type InsertWhatsappMessage = typeof whatsappMessages.$inferInsert;

// ===== WHATSAPP TEMPLATES TABLE =====
export const whatsappTemplates = mysqlTable("whatsapp_templates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  content: text("content").notNull(),
  tone: mysqlEnum("tone", ["formal", "friendly", "direct"]).default("friendly").notNull(),
  isDefault: boolean("isDefault").default(false).notNull(),
  usageCount: int("usageCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type WhatsappTemplate = typeof whatsappTemplates.$inferSelect;
export type InsertWhatsappTemplate = typeof whatsappTemplates.$inferInsert;

// ===== USER INVITATIONS TABLE =====
export const userInvitations = mysqlTable("user_invitations", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  invitedBy: int("invitedBy").notNull(), // userId of the admin who invited
  token: varchar("token", { length: 128 }).notNull().unique(),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  permissions: json("permissions").$type<string[]>(), // ['leads.view', 'leads.add', 'whatsapp.send', 'search.use']
  status: mysqlEnum("status", ["pending", "accepted", "expired", "revoked"]).default("pending").notNull(),
  acceptedBy: int("acceptedBy"), // userId who accepted
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type UserInvitation = typeof userInvitations.$inferSelect;
export type InsertUserInvitation = typeof userInvitations.$inferInsert;

// ===== USER PERMISSIONS TABLE =====
export const userPermissions = mysqlTable("user_permissions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  permissions: json("permissions").$type<string[]>().notNull(), // ['leads.view', 'leads.add', 'whatsapp.send', 'search.use', 'analytics.view']
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type UserPermission = typeof userPermissions.$inferSelect;
export type InsertUserPermission = typeof userPermissions.$inferInsert;

// ===== WHATSAPP SETTINGS TABLE =====
export const whatsappSettings = mysqlTable("whatsapp_settings", {
  id: int("id").autoincrement().primaryKey(),
  accountId: varchar("accountId", { length: 64 }).notNull().unique(), // 'default' or custom account name
  accountLabel: varchar("accountLabel", { length: 100 }).notNull(),
  messageDelay: int("messageDelay").default(10000).notNull(), // ms between messages
  notificationThreshold: int("notificationThreshold").default(50).notNull(), // notify after X messages
  messagesSentToday: int("messagesSentToday").default(0).notNull(),
  totalMessagesSent: int("totalMessagesSent").default(0).notNull(),
  autoReplyEnabled: boolean("autoReplyEnabled").default(false).notNull(),
  autoArchiveDays: int("autoArchiveDays").default(0).notNull(), // 0 = disabled, >0 = archive after N days of inactivity
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type WhatsappSettings = typeof whatsappSettings.$inferSelect;
export type InsertWhatsappSettings = typeof whatsappSettings.$inferInsert;

// ===== WHATSAPP AUTO REPLY RULES TABLE =====
export const autoReplyRules = mysqlTable("auto_reply_rules", {
  id: int("id").autoincrement().primaryKey(),
  accountId: varchar("accountId", { length: 64 }).notNull().default("default"),
  triggerKeywords: json("triggerKeywords").$type<string[]>().notNull(), // keywords that trigger this rule
  replyTemplate: text("replyTemplate").notNull(), // template for the reply
  useAI: boolean("useAI").default(false).notNull(), // use AI to generate contextual reply
  aiContext: text("aiContext"), // context/instructions for AI reply generation
  isActive: boolean("isActive").default(true).notNull(),
  matchCount: int("matchCount").default(0).notNull(), // how many times this rule was triggered
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AutoReplyRule = typeof autoReplyRules.$inferSelect;
export type InsertAutoReplyRule = typeof autoReplyRules.$inferInsert;

// ===== AI SETTINGS TABLE =====
export const aiSettings = mysqlTable("ai_settings", {
  id: int("id").autoincrement().primaryKey(),
  provider: mysqlEnum("provider", ["openai", "builtin"]).default("builtin").notNull(),
  openaiApiKey: text("openaiApiKey"), // encrypted API key
  openaiAssistantId: varchar("openaiAssistantId", { length: 100 }), // OpenAI Assistant ID
  openaiModel: varchar("openaiModel", { length: 50 }).default("gpt-4o-mini").notNull(),
  systemPrompt: text("systemPrompt"), // global system prompt for all AI replies
  businessContext: text("businessContext"), // business description for AI
  globalAutoReplyEnabled: boolean("globalAutoReplyEnabled").default(false).notNull(), // master switch
  // إعدادات التصعيد البشري
  escalationEnabled: boolean("escalationEnabled").default(false).notNull(), // تفعيل التصعيد عند عجز AI
  escalationPhone: varchar("escalationPhone", { length: 50 }), // رقم واتساب للتصعيد
  escalationMessage: text("escalationMessage"), // رسالة التصعيد للعميل
  escalationKeywords: json("escalationKeywords").$type<string[]>().default([]), // كلمات تُفعّل التصعيد الفوري
  // الكلمات المفتاحية لبناء المحادثة
  conversationKeywords: json("conversationKeywords").$type<{keyword: string, response: string, isActive: boolean}[]>().default([]),
  temperature: float("temperature").default(0.7).notNull(),
  maxTokens: int("maxTokens").default(500).notNull(),
  // تحكم في أسلوب التحليل
  analysisStyle: varchar("analysisStyle", { length: 50 }).default("balanced"), // balanced | aggressive | conservative | detailed
  analysisPrompt: text("analysisPrompt"), // برومبت مخصص لتحليل العملاء
  // صيغة الرسائل
  messageTemplate: text("messageTemplate"), // قالب الرسالة الافتراضي
  brandTone: varchar("brandTone", { length: 50 }).default("professional"), // professional | friendly | formal | casual
  // هوية البلد
  countryContext: varchar("countryContext", { length: 50 }).default("saudi"), // saudi | gulf | arabic | international
  dialect: varchar("dialect", { length: 50 }).default("gulf"), // gulf | egyptian | levantine | msa
  // إعدادات الرد الصوتي
  voiceReplyEnabled: boolean("voiceReplyEnabled").default(false).notNull(), // تفعيل الرد الصوتي
  ttsVoice: varchar("ttsVoice", { length: 20 }).default("nova").notNull(), // صوت TTS: alloy | echo | fable | onyx | nova | shimmer
  voiceDialect: varchar("voiceDialect", { length: 50 }).default("ar-SA"), // ar-SA | ar-EG | ar-AE | ar-KW
  voiceGender: mysqlEnum("voiceGender", ["male", "female"]).default("female"), // جنس الصوت
  voiceSpeed: float("voiceSpeed").default(1.0), // سرعة الكلام 0.5-2.0
  voiceReplyScope: varchar("voice_reply_scope", { length: 20 }).default("voice_only").notNull(), // voice_only | all_messages
  transcribeIncoming: boolean("transcribeIncoming").default(true).notNull(), // تحويل الصوتيات الواردة لنص
  // إعدادات Instagram API
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AiSettings = typeof aiSettings.$inferSelect;
export type InsertAiSettings = typeof aiSettings.$inferInsert;

// ===== WHATSAPP CHATS TABLE =====
export const whatsappChats = mysqlTable("whatsapp_chats", {
  id: int("id").autoincrement().primaryKey(),
  accountId: varchar("accountId", { length: 64 }).notNull().default("default"),
  phone: varchar("phone", { length: 30 }).notNull(),
  contactName: varchar("contactName", { length: 200 }),
  leadId: int("leadId"), // linked lead if any
  lastMessage: text("lastMessage"),
  lastMessageAt: timestamp("lastMessageAt"),
  unreadCount: int("unreadCount").default(0).notNull(),
  isArchived: boolean("isArchived").default(false).notNull(),
  aiAutoReplyEnabled: boolean("aiAutoReplyEnabled").default(true).notNull(), // per-chat AI control
  // توزيع الموظفين
  assignedUserId: int("assignedUserId"),           // معرف الموظف المعيّن
  assignedUserName: varchar("assignedUserName", { length: 100 }), // اسم الموظف
  handledBy: mysqlEnum("handledBy", ["ai", "human", "mixed"]).default("ai"), // من يتولى المحادثة
  firstResponseAt: timestamp("firstResponseAt"),  // وقت أول رد
  closedAt: timestamp("closedAt"),                 // وقت إغلاق المحادثة
  totalMessages: int("totalMessages").default(0).notNull(), // إجمالي الرسائل
  sentiment: mysqlEnum("sentiment", ["positive", "neutral", "negative", "unknown"]).default("unknown"), // مشاعر العميل
  opportunityMissed: boolean("opportunityMissed").default(false).notNull(), // فرصة ضائعة
  // ===== نظام Stage + Follow-up =====
  stage: mysqlEnum("stage", ["new", "contacted", "interested", "price_offer", "meeting", "won", "lost", "deferred", "cancelled"]).default("new").notNull(),
  nextStep: text("nextStep"),                                          // الخطوة القادمة
  followUpDate: timestamp("followUpDate"),                             // تاريخ المتابعة القادمة
  ownerUserId: int("ownerUserId"),                                     // المسؤول عن المحادثة
  ownerUserName: varchar("ownerUserName", { length: 100 }),            // اسم المسؤول
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type WhatsappChat = typeof whatsappChats.$inferSelect;
export type InsertWhatsappChat = typeof whatsappChats.$inferInsert;

// ===== WHATSAPP CHAT MESSAGES TABLE =====
export const whatsappChatMessages = mysqlTable("whatsapp_chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  chatId: int("chatId").notNull(),
  accountId: varchar("accountId", { length: 64 }).notNull().default("default"),
  direction: mysqlEnum("direction", ["outgoing", "incoming"]).notNull(),
  message: text("message").notNull(),
  mediaUrl: text("mediaUrl"),       // URL للصورة أو الملف
  mediaType: varchar("mediaType", { length: 50 }), // image/video/audio/document
  mediaFilename: varchar("mediaFilename", { length: 255 }), // اسم الملف
  isAutoReply: boolean("isAutoReply").default(false).notNull(),
  status: mysqlEnum("status", ["sent", "delivered", "read", "failed"]).default("sent").notNull(),
  sentAt: timestamp("sentAt").defaultNow().notNull(),
});
export type WhatsappChatMessage = typeof whatsappChatMessages.$inferSelect;
export type InsertWhatsappChatMessage = typeof whatsappChatMessages.$inferInsert;

// ===== WHATSAPP ACCOUNTS TABLE (multi-account with roles) =====
export const whatsappAccounts = mysqlTable("whatsapp_accounts", {
  id: int("id").autoincrement().primaryKey(),
  accountId: varchar("accountId", { length: 64 }).notNull().unique(), // unique identifier
  label: varchar("label", { length: 100 }).notNull(), // display name e.g. "واتساب 1 - إرسال جماعي"
  phoneNumber: varchar("phoneNumber", { length: 30 }).notNull(), // the WhatsApp number
  // Role: bulk_sender = إرسال جماعي, human_handoff = تحويل للموظف, both = كلاهما
  role: mysqlEnum("role", ["bulk_sender", "human_handoff", "both"]).default("bulk_sender").notNull(),
  assignedEmployee: varchar("assignedEmployee", { length: 100 }), // employee name for human_handoff
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(), // for ordering in UI
  // نوع الحساب: collection=تجميع, sales=سيلز, analysis=تحليل, followup=متابعة
  accountType: mysqlEnum("account_type", ["collection", "sales", "analysis", "followup"]).default("collection").notNull(),
  notes: text("notes"), // optional notes
  // ===== سكور الرقم الذكي =====
  healthScore: int("healthScore").default(100).notNull(), // 0-100: صحة الرقم
  healthStatus: mysqlEnum("healthStatus", ["safe", "watch", "warning", "danger"]).default("safe").notNull(),
  dailySentCount: int("dailySentCount").default(0).notNull(), // عدد الرسائل المرسلة اليوم
  dailyReceivedCount: int("dailyReceivedCount").default(0).notNull(), // عدد الرسائل الواردة اليوم
  totalSentCount: int("totalSentCount").default(0).notNull(), // إجمالي المرسلة
  totalReceivedCount: int("totalReceivedCount").default(0).notNull(), // إجمالي الواردة
  reportCount: int("reportCount").default(0).notNull(), // عدد مرات الإبلاغ
  blockCount: int("blockCount").default(0).notNull(), // عدد مرات الحظر
  noReplyCount: int("noReplyCount").default(0).notNull(), // رسائل بدون رد
  maxDailyMessages: int("maxDailyMessages").default(200).notNull(), // الحد الأقصى للإرسال اليومي
  minIntervalSeconds: int("minIntervalSeconds").default(30).notNull(), // الحد الأدنى للفاصل بين الرسائل (ثانية)
  lastScoreUpdate: timestamp("lastScoreUpdate"), // آخر تحديث للسكور
  scoreHistory: json("scoreHistory").$type<{date: string, score: number, reason: string}[]>().default([]),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type WhatsappAccount = typeof whatsappAccounts.$inferSelect;
export type InsertWhatsappAccount = typeof whatsappAccounts.$inferInsert;

// ===== INTEREST ALERTS TABLE =====
// When a customer shows interest, an alert is created and can be transferred to a human agent
export const interestAlerts = mysqlTable("interest_alerts", {
  id: int("id").autoincrement().primaryKey(),
  chatId: int("chatId"), // linked chat if any
  leadId: int("leadId"), // linked lead if any
  phone: varchar("phone", { length: 30 }).notNull(), // customer phone
  contactName: varchar("contactName", { length: 200 }), // customer name
  triggerMessage: text("triggerMessage"), // the message that triggered the alert
  interestScore: int("interestScore").default(0).notNull(), // 0-100 interest level
  detectedKeywords: json("detectedKeywords").$type<string[]>().default([]), // keywords found
  // Status: pending = انتظار, transferred = تم التحويل, dismissed = تم الرفض
  status: mysqlEnum("status", ["pending", "transferred", "dismissed"]).default("pending").notNull(),
  handoffAccountId: varchar("handoffAccountId", { length: 64 }), // which account to transfer to
  handoffPhone: varchar("handoffPhone", { length: 30 }), // employee phone number
  transferredAt: timestamp("transferredAt"),
  transferredBy: varchar("transferredBy", { length: 100 }), // who transferred
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type InterestAlert = typeof interestAlerts.$inferSelect;
export type InsertInterestAlert = typeof interestAlerts.$inferInsert;

// ===== INTEREST KEYWORDS TABLE =====
// Custom keywords to detect customer interest (managed by admin)
export const interestKeywords = mysqlTable("interest_keywords", {
  id: int("id").autoincrement().primaryKey(),
  keyword: varchar("keyword", { length: 100 }).notNull().unique(),
  category: varchar("category", { length: 50 }).default("general").notNull(), // general, price, buy, contact
  weight: int("weight").default(20).notNull(), // contribution to interest score (0-100)
  isActive: boolean("isActive").default(true).notNull(),
  isDefault: boolean("isDefault").default(false).notNull(), // system default, cannot delete
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type InterestKeyword = typeof interestKeywords.$inferSelect;
export type InsertInterestKeyword = typeof interestKeywords.$inferInsert;

// ===== AI TRAINING EXAMPLES TABLE =====
// Examples of interested/not-interested messages to improve AI detection
export const aiTrainingExamples = mysqlTable("ai_training_examples", {
  id: int("id").autoincrement().primaryKey(),
  message: text("message").notNull(),
  label: mysqlEnum("label", ["interested", "not_interested"]).notNull(),
  notes: varchar("notes", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AiTrainingExample = typeof aiTrainingExamples.$inferSelect;
export type InsertAiTrainingExample = typeof aiTrainingExamples.$inferInsert;

// ===== SEGMENTS TABLE =====
// Customer segments for targeted messaging with optimal send times
export const segments = mysqlTable("segments", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  color: varchar("color", { length: 20 }).default("#3b82f6").notNull(), // hex color for UI
  // Optimal send times: JSON array of { day: 0-6, hour: 0-23 }
  optimalSendTimes: json("optimalSendTimes").$type<{ day: number; hour: number; label: string }[]>().default([]),
  // Auto-filter criteria: JSON object for automatic lead assignment
  filterCriteria: json("filterCriteria").$type<{
    cities?: string[];
    sources?: string[];
    statuses?: string[];
    minInterestScore?: number;
    hasWhatsapp?: boolean;
    country?: string;
  }>().default({}),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Segment = typeof segments.$inferSelect;
export type InsertSegment = typeof segments.$inferInsert;

// ===== LEAD SEGMENTS TABLE =====
// Many-to-many: leads ↔ segments
export const leadSegments = mysqlTable("lead_segments", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull(),
  segmentId: int("segmentId").notNull(),
  addedAt: timestamp("addedAt").defaultNow().notNull(),
  addedBy: varchar("addedBy", { length: 100 }), // user who added
});
export type LeadSegment = typeof leadSegments.$inferSelect;
export type InsertLeadSegment = typeof leadSegments.$inferInsert;

// ===== DATA SETTINGS TABLE =====
// Customizable dropdown options for business types, cities, and other fields
export const dataSettings = mysqlTable("data_settings", {
  id: int("id").autoincrement().primaryKey(),
  category: varchar("category", { length: 50 }).notNull(), // "businessType" | "city" | "district" | "source" | "tag"
  value: varchar("value", { length: 200 }).notNull(),
  label: varchar("label", { length: 200 }).notNull(),
  parentValue: varchar("parentValue", { length: 200 }), // for hierarchical data (e.g., city → district)
  sortOrder: int("sortOrder").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type DataSetting = typeof dataSettings.$inferSelect;
export type InsertDataSetting = typeof dataSettings.$inferInsert;

// ===== RAG KNOWLEDGE BASE TABLES =====
// قاعدة المعرفة للذكاء الاصطناعي - RAG (Retrieval Augmented Generation)

export const ragDocuments = mysqlTable("rag_documents", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 300 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }).default("general").notNull(),
  // نوع المستند: text (نص مباشر), faq (سؤال وجواب), product (منتج/خدمة), policy (سياسة), example (مثال رد)
  docType: mysqlEnum("docType", ["text", "faq", "product", "policy", "example", "tone"]).default("text").notNull(),
  content: text("content").notNull(),
  // عدد مرات الاستخدام في الردود
  usageCount: int("usageCount").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdBy: varchar("createdBy", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type RagDocument = typeof ragDocuments.$inferSelect;
export type InsertRagDocument = typeof ragDocuments.$inferInsert;

// أجزاء المستندات المقسّمة للبحث الدلالي
export const ragChunks = mysqlTable("rag_chunks", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("documentId").notNull(),
  chunkIndex: int("chunkIndex").default(0).notNull(),
  content: text("content").notNull(),
  // embedding كـ JSON array من الأرقام (vector)
  embedding: json("embedding").$type<number[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type RagChunk = typeof ragChunks.$inferSelect;
export type InsertRagChunk = typeof ragChunks.$inferInsert;

// سجل محادثات التدريب - أمثلة ردود احترافية
export const ragConversationExamples = mysqlTable("rag_conversation_examples", {
  id: int("id").autoincrement().primaryKey(),
  customerMessage: text("customerMessage").notNull(),
  idealResponse: text("idealResponse").notNull(),
  context: varchar("context", { length: 200 }),
  // أسلوب الرد: formal (رسمي), friendly (ودي), direct (مباشر), persuasive (مقنع)
  tone: mysqlEnum("tone", ["formal", "friendly", "direct", "persuasive"]).default("friendly").notNull(),
  category: varchar("category", { length: 100 }).default("general"),
  rating: int("rating").default(5), // تقييم جودة المثال 1-5
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type RagConversationExample = typeof ragConversationExamples.$inferSelect;
export type InsertRagConversationExample = typeof ragConversationExamples.$inferInsert;

// إعدادات شخصية AI (هوية، أسلوب، قواعد)
export const aiPersonality = mysqlTable("ai_personality", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).default("مساعد المبيعات").notNull(),
  role: varchar("role", { length: 200 }).default("مساعد مبيعات احترافي").notNull(),
  businessContext: text("businessContext"), // وصف النشاط التجاري
  defaultTone: mysqlEnum("defaultTone", ["formal", "friendly", "direct", "persuasive"]).default("friendly").notNull(),
  language: varchar("language", { length: 20 }).default("ar").notNull(),
  systemPrompt: text("systemPrompt"), // prompt مخصص كامل
  rules: json("rules").$type<string[]>().default([]), // قواعد يجب الالتزام بها
  forbiddenTopics: json("forbiddenTopics").$type<string[]>().default([]), // مواضيع محظورة
  greetingMessage: text("greetingMessage"), // رسالة ترحيب افتراضية
  closingMessage: text("closingMessage"), // رسالة إنهاء محادثة
  isActive: boolean("isActive").default(true).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type AiPersonality = typeof aiPersonality.$inferSelect;
export type InsertAiPersonality = typeof aiPersonality.$inferInsert;

// ===== BACKUP LOGS TABLE =====
export const backupLogs = mysqlTable("backup_logs", {
  id: int("id").autoincrement().primaryKey(),
  type: mysqlEnum("type", ["daily", "manual", "weekly"]).default("daily").notNull(),
  status: mysqlEnum("status", ["pending", "running", "success", "failed"]).default("pending").notNull(),
  filePath: varchar("filePath", { length: 500 }), // S3 key
  fileUrl: text("fileUrl"), // S3 URL
  fileSize: int("fileSize"), // bytes
  emailSent: boolean("emailSent").default(false).notNull(),
  emailTo: varchar("emailTo", { length: 320 }),
  recordCount: json("recordCount").$type<{leads: number, chats: number, messages: number}>(),
  error: text("error"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});
export type BackupLog = typeof backupLogs.$inferSelect;
export type InsertBackupLog = typeof backupLogs.$inferInsert;

// ===== SCHEDULED BULK SEND TABLE =====
export const scheduledBulkSends = mysqlTable("scheduled_bulk_sends", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  accountId: varchar("accountId", { length: 64 }).notNull(),
  message: text("message").notNull(),
  mediaUrl: text("mediaUrl"),
  recipients: json("recipients").$type<{phone: string, name?: string}[]>().notNull(),
  totalCount: int("totalCount").default(0).notNull(),
  sentCount: int("sentCount").default(0).notNull(),
  failedCount: int("failedCount").default(0).notNull(),
  intervalSeconds: int("intervalSeconds").default(30).notNull(), // فاصل بين الرسائل
  maxPerDay: int("maxPerDay").default(200).notNull(),
  status: mysqlEnum("status", ["pending", "running", "paused", "completed", "failed"]).default("pending").notNull(),
  scheduledAt: timestamp("scheduledAt"), // وقت البدء المجدول
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ScheduledBulkSend = typeof scheduledBulkSends.$inferSelect;
export type InsertScheduledBulkSend = typeof scheduledBulkSends.$inferInsert;

// ===== WHATSAPP NUMBER HEALTH EVENTS TABLE =====
export const numberHealthEvents = mysqlTable("number_health_events", {
  id: int("id").autoincrement().primaryKey(),
  accountId: varchar("accountId", { length: 64 }).notNull(),
  eventType: mysqlEnum("eventType", ["report", "block", "no_reply", "score_drop", "score_rise", "warning_sent"]).notNull(),
  description: text("description"),
  scoreBefore: int("scoreBefore"),
  scoreAfter: int("scoreAfter"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type NumberHealthEvent = typeof numberHealthEvents.$inferSelect;
export type InsertNumberHealthEvent = typeof numberHealthEvents.$inferInsert;

// ===== LEAD JOURNEY TABLE (تتبع مسار العميل) =====
export const leadJourney = mysqlTable("lead_journey", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId"),
  phone: varchar("phone", { length: 30 }).notNull(),
  eventType: mysqlEnum("eventType", [
    "created", "message_sent", "message_received",
    "interest_detected", "transferred_to_employee", "transferred_to_ai",
    "deal_closed", "deal_lost", "archived"
  ]).notNull(),
  description: text("description"),
  performedBy: varchar("performedBy", { length: 100 }), // اسم الموظف أو 'AI' أو 'system'
  metadata: json("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type LeadJourney = typeof leadJourney.$inferSelect;
export type InsertLeadJourney = typeof leadJourney.$inferInsert;

// ===== CAMPAIGNS TABLE (حملات الإرسال) =====
export const campaigns = mysqlTable("campaigns", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  accountId: varchar("accountId", { length: 64 }),
  totalSent: int("totalSent").default(0).notNull(),
  totalDelivered: int("totalDelivered").default(0).notNull(),
  totalReplied: int("totalReplied").default(0).notNull(),
  totalFailed: int("totalFailed").default(0).notNull(),
  responseRate: float("responseRate").default(0), // نسبة الاستجابة %
  status: mysqlEnum("status", ["draft", "running", "completed", "paused", "failed"]).default("draft").notNull(),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = typeof campaigns.$inferInsert;

// ===== REMINDERS TABLE (التذكيرات) =====
export const reminders = mysqlTable("reminders", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull(),
  leadName: varchar("leadName", { length: 200 }).notNull(),
  leadPhone: varchar("leadPhone", { length: 30 }),
  leadCity: varchar("leadCity", { length: 100 }),
  leadBusinessType: varchar("leadBusinessType", { length: 200 }),
  reminderType: mysqlEnum("reminderType", ["follow_up", "call", "message", "meeting", "custom"]).default("follow_up").notNull(),
  title: varchar("title", { length: 300 }).notNull(),
  notes: text("notes"),
  dueDate: timestamp("dueDate").notNull(),
  status: mysqlEnum("status", ["pending", "done", "snoozed", "cancelled"]).default("pending").notNull(),
  priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"]).default("medium").notNull(),
  assignedTo: varchar("assignedTo", { length: 100 }), // اسم الموظف
  createdBy: int("createdBy"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Reminder = typeof reminders.$inferSelect;
export type InsertReminder = typeof reminders.$inferInsert;

// ===== WEEKLY REPORTS TABLE (التقارير الأسبوعية) =====
export const weeklyReports = mysqlTable("weekly_reports", {
  id: int("id").autoincrement().primaryKey(),
  weekStart: timestamp("weekStart").notNull(),
  weekEnd: timestamp("weekEnd").notNull(),
  totalLeads: int("totalLeads").default(0).notNull(),
  newLeads: int("newLeads").default(0).notNull(),
  analyzedLeads: int("analyzedLeads").default(0).notNull(),
  messagesSent: int("messagesSent").default(0).notNull(),
  messagesReceived: int("messagesReceived").default(0).notNull(),
  responseRate: float("responseRate").default(0),
  hotLeads: int("hotLeads").default(0).notNull(),
  completedReminders: int("completedReminders").default(0).notNull(),
  pendingReminders: int("pendingReminders").default(0).notNull(),
  topCities: json("topCities").$type<{city: string; count: number}[]>(),
  topBusinessTypes: json("topBusinessTypes").$type<{type: string; count: number}[]>(),
  summaryText: text("summaryText"), // ملخص AI
  pdfUrl: text("pdfUrl"), // رابط PDF المولّد
  sentViaWhatsapp: boolean("sentViaWhatsapp").default(false).notNull(),
  sentAt: timestamp("sentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type WeeklyReport = typeof weeklyReports.$inferSelect;
export type InsertWeeklyReport = typeof weeklyReports.$inferInsert;

// ===== ACTIVATION SETTINGS (إعدادات تنشيط التواصل) =====
export const activationSettings = mysqlTable("activation_settings", {
  id: int("id").autoincrement().primaryKey(),
  isActive: boolean("isActive").default(false).notNull(),           // هل التنشيط مفعّل؟
  minDelaySeconds: int("minDelaySeconds").default(60).notNull(),    // أقل تأخير بين الرسائل (ثانية)
  maxDelaySeconds: int("maxDelaySeconds").default(300).notNull(),   // أقصى تأخير بين الرسائل (ثانية)
  messagesPerDay: int("messagesPerDay").default(20).notNull(),      // عدد الرسائل اليومية لكل رقم
  startHour: int("startHour").default(9).notNull(),                 // ساعة بداية الإرسال (9 صباحاً)
  endHour: int("endHour").default(22).notNull(),                    // ساعة نهاية الإرسال (10 مساءً)
  useAI: boolean("useAI").default(false).notNull(),                 // استخدام AI لتوليد رسائل متنوعة
  messageStyle: varchar("messageStyle", { length: 50 }).default("casual").notNull(), // casual/business/mixed
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ActivationSettings = typeof activationSettings.$inferSelect;
export type InsertActivationSettings = typeof activationSettings.$inferInsert;

// ===== ACTIVATION MESSAGES LOG (سجل رسائل التنشيط) =====
export const activationMessages = mysqlTable("activation_messages", {
  id: int("id").autoincrement().primaryKey(),
  fromAccountId: varchar("fromAccountId", { length: 64 }).notNull(),  // الرقم المرسِل
  toAccountId: varchar("toAccountId", { length: 64 }).notNull(),      // الرقم المستقبِل
  message: text("message").notNull(),                                   // نص الرسالة
  status: mysqlEnum("status", ["sent", "failed", "pending"]).default("pending").notNull(),
  sentAt: timestamp("sentAt").defaultNow().notNull(),
  errorMessage: text("errorMessage"),
});
export type ActivationMessage = typeof activationMessages.$inferSelect;
export type InsertActivationMessage = typeof activationMessages.$inferInsert;

export const googleSheetsConnections = mysqlTable("google_sheets_connections", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),                         // اسم الاتصال
  sheetUrl: text("sheetUrl").notNull(),                                      // رابط Google Sheet
  sheetId: varchar("sheetId", { length: 255 }).notNull(),                   // معرف الـ Sheet
  tabName: varchar("tabName", { length: 255 }),                             // اسم التبويب (اختياري)
  columnMapping: json("columnMapping").$type<Record<string, string>>(),     // تعيين الأعمدة
  purpose: mysqlEnum("purpose", ["rag_training", "leads_import", "products", "faq"]).default("rag_training").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  autoSync: boolean("autoSync").default(false).notNull(),                   // مزامنة تلقائية
  syncInterval: int("syncInterval").default(60).notNull(),                  // كل كم دقيقة
  lastSyncAt: timestamp("lastSyncAt"),
  lastSyncStatus: mysqlEnum("lastSyncStatus", ["success", "failed", "pending"]).default("pending"),
  lastSyncError: text("lastSyncError"),
  rowsImported: int("rowsImported").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type GoogleSheetsConnection = typeof googleSheetsConnections.$inferSelect;
export type InsertGoogleSheetsConnection = typeof googleSheetsConnections.$inferInsert;

// ===== جدول جدولة التقارير الأسبوعية =====
export const reportSchedules = mysqlTable("report_schedules", {
  id: int("id").autoincrement().primaryKey(),
  isEnabled: boolean("isEnabled").default(false).notNull(),           // هل الجدولة مفعّلة؟
  dayOfWeek: int("dayOfWeek").default(0).notNull(),                   // 0=الأحد, 1=الاثنين, ..., 6=السبت
  hour: int("hour").default(8).notNull(),                             // الساعة (0-23)
  minute: int("minute").default(0).notNull(),                         // الدقيقة (0-59)
  timezone: varchar("timezone", { length: 100 }).default("Asia/Riyadh").notNull(),
  whatsappAccountId: varchar("whatsappAccountId", { length: 255 }),   // حساب واتساب للإرسال
  recipientPhone: varchar("recipientPhone", { length: 50 }),          // رقم المستقبل
  includeLeadsStats: boolean("includeLeadsStats").default(true).notNull(),
  includeWhatsappStats: boolean("includeWhatsappStats").default(true).notNull(),
  includeEmployeeStats: boolean("includeEmployeeStats").default(true).notNull(),
  lastSentAt: timestamp("lastSentAt"),                                // آخر إرسال
  lastSentStatus: mysqlEnum("lastSentStatus", ["success", "failed", "pending"]).default("pending"),
  lastSentError: text("lastSentError"),
  totalSent: int("totalSent").default(0).notNull(),                   // عدد مرات الإرسال الناجحة
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ReportSchedule = typeof reportSchedules.$inferSelect;
export type InsertReportSchedule = typeof reportSchedules.$inferInsert;

// ===== جدول سجلات TTS (تتبع حالة الرد الصوتي) =====
export const ttsLogs = mysqlTable("tts_logs", {
  id: int("id").autoincrement().primaryKey(),
  accountId: varchar("accountId", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 100 }).notNull(),
  chatId: int("chatId"),
  status: mysqlEnum("status", ["success", "failed", "fallback"]).notNull(), // نتيجة TTS
  textLength: int("textLength").default(0).notNull(),                       // طول النص المحوّل
  audioSizeBytes: int("audioSizeBytes").default(0),                         // حجم الملف الصوتي
  audioUrl: text("audioUrl"),                                               // رابط الملف في S3
  errorMessage: text("errorMessage"),                                       // رسالة الخطأ عند الفشل
  durationMs: int("durationMs"),                                            // مدة التحويل بالمللي ثانية
  ttsEngine: varchar("ttsEngine", { length: 50 }).default("gtts").notNull(), // المحرك المستخدم
  voiceDialect: varchar("voiceDialect", { length: 50 }),                    // اللهجة المستخدمة
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type TtsLog = typeof ttsLogs.$inferSelect;
export type InsertTtsLog = typeof ttsLogs.$inferInsert;

// ===== جدول تسجيل سلوك البحث البشري =====
export const searchBehaviorLogs = mysqlTable("search_behavior_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  platform: varchar("platform", { length: 50 }).notNull(), // google_maps, instagram, tiktok, snapchat, telegram
  query: varchar("query", { length: 500 }).notNull(),
  filters: text("filters"),                                // JSON: { city, category, minFollowers, ... }
  resultsCount: int("resultsCount").default(0),
  selectedResults: text("selectedResults"),               // JSON: array of selected result IDs/names
  addedToLeads: int("addedToLeads").default(0),
  sessionDuration: int("sessionDuration").default(0),     // بالثواني
  scrollDepth: int("scrollDepth").default(0),             // عمق التمرير (0-100)
  clickPattern: text("clickPattern"),                     // JSON: { delays, positions }
  searchSuccess: boolean("searchSuccess").default(true),   // true=ناجح، false=فاشل
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type SearchBehaviorLog = typeof searchBehaviorLogs.$inferSelect;
export type InsertSearchBehaviorLog = typeof searchBehaviorLogs.$inferInsert;

// ===== جدول أنماط السلوك المُستخلصة =====
export const searchBehaviorPatterns = mysqlTable("search_behavior_patterns", {
  id: int("id").autoincrement().primaryKey(),
  platform: varchar("platform", { length: 50 }).notNull(),
  patternType: varchar("patternType", { length: 100 }).notNull(), // preferred_time, avg_delay, top_queries, etc.
  patternData: text("patternData").notNull(),                     // JSON: بيانات النمط
  confidence: int("confidence").default(50),                      // 0-100 نسبة الثقة
  sampleSize: int("sampleSize").default(0),                       // عدد العينات
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type SearchBehaviorPattern = typeof searchBehaviorPatterns.$inferSelect;
export type InsertSearchBehaviorPattern = typeof searchBehaviorPatterns.$inferInsert;

// ===== UNIFIED INBOX - SOCIAL ACCOUNTS (حسابات المنصات الاجتماعية) =====
// يخزن حسابات إنستجرام وتيك توك وسناب شات المربوطة بالنظام
export const socialAccounts = mysqlTable("social_accounts", {
  id: int("id").autoincrement().primaryKey(),
  platform: mysqlEnum("platform", ["instagram", "tiktok", "snapchat"]).notNull(),
  accountId: varchar("accountId", { length: 200 }).notNull(),       // معرف الحساب في المنصة
  username: varchar("username", { length: 200 }).notNull(),          // اسم المستخدم
  displayName: varchar("displayName", { length: 200 }),              // الاسم المعروض
  profilePicUrl: text("profilePicUrl"),                              // صورة الحساب
  accessToken: text("accessToken"),                                  // رمز الوصول (مشفر)
  refreshToken: text("refreshToken"),                                // رمز التجديد
  tokenExpiresAt: timestamp("tokenExpiresAt"),                       // انتهاء صلاحية التوكن
  pageId: varchar("pageId", { length: 200 }),                       // معرف الصفحة (إنستجرام Business)
  webhookVerified: boolean("webhookVerified").default(false).notNull(), // هل الويبهوك مفعّل؟
  isActive: boolean("isActive").default(true).notNull(),
  status: mysqlEnum("status", ["connected", "disconnected", "error", "pending"]).default("pending").notNull(),
  statusMessage: text("statusMessage"),
  followersCount: int("followersCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type SocialAccount = typeof socialAccounts.$inferSelect;
export type InsertSocialAccount = typeof socialAccounts.$inferInsert;

// ===== UNIFIED INBOX - SOCIAL CONVERSATIONS (محادثات المنصات) =====
// كل محادثة مع مستخدم على أي منصة
export const socialConversations = mysqlTable("social_conversations", {
  id: int("id").autoincrement().primaryKey(),
  socialAccountId: int("socialAccountId").notNull(),                 // الحساب المربوط
  platform: mysqlEnum("platform", ["instagram", "tiktok", "snapchat", "whatsapp"]).notNull(),
  externalConversationId: varchar("externalConversationId", { length: 300 }), // معرف المحادثة في المنصة
  // بيانات المتحدث
  senderExternalId: varchar("senderExternalId", { length: 200 }),   // معرف المرسل في المنصة
  senderUsername: varchar("senderUsername", { length: 200 }),        // اسم المستخدم
  senderDisplayName: varchar("senderDisplayName", { length: 200 }), // الاسم المعروض
  senderProfilePic: text("senderProfilePic"),                        // صورة المرسل
  // ربط بالعميل
  leadId: int("leadId"),                                             // إذا تم ربطه بعميل
  // حالة المحادثة
  lastMessageAt: timestamp("lastMessageAt"),
  lastMessagePreview: varchar("lastMessagePreview", { length: 300 }),
  unreadCount: int("unreadCount").default(0).notNull(),
  isRead: boolean("isRead").default(false).notNull(),
  isArchived: boolean("isArchived").default(false).notNull(),
  assignedTo: int("assignedTo"),                                     // معرف الموظف المسؤول
  aiAutoReply: boolean("aiAutoReply").default(false).notNull(),      // هل الرد التلقائي مفعّل؟
  status: mysqlEnum("status", ["open", "closed", "pending"]).default("open").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type SocialConversation = typeof socialConversations.$inferSelect;
export type InsertSocialConversation = typeof socialConversations.$inferInsert;

// ===== UNIFIED INBOX - SOCIAL MESSAGES (رسائل المنصات) =====
// كل رسالة في محادثة
export const socialMessages = mysqlTable("social_messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  platform: mysqlEnum("platform", ["instagram", "tiktok", "snapchat", "whatsapp"]).notNull(),
  externalMessageId: varchar("externalMessageId", { length: 300 }), // معرف الرسالة في المنصة
  direction: mysqlEnum("direction", ["inbound", "outbound"]).notNull(), // وارد أو صادر
  senderType: mysqlEnum("senderType", ["customer", "agent", "ai"]).default("customer").notNull(),
  // محتوى الرسالة
  messageType: mysqlEnum("messageType", ["text", "image", "video", "audio", "story_reply", "reaction", "unsupported"]).default("text").notNull(),
  content: text("content"),                                          // نص الرسالة
  mediaUrl: text("mediaUrl"),                                        // رابط الوسائط
  mediaType: varchar("mediaType", { length: 50 }),                  // نوع الوسائط
  // حالة الرسالة
  status: mysqlEnum("status", ["sent", "delivered", "read", "failed", "pending"]).default("sent").notNull(),
  errorMessage: text("errorMessage"),
  // توقيت
  sentAt: timestamp("sentAt").defaultNow().notNull(),
  deliveredAt: timestamp("deliveredAt"),
  readAt: timestamp("readAt"),
  // بيانات إضافية
  metadata: json("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type SocialMessage = typeof socialMessages.$inferSelect;
export type InsertSocialMessage = typeof socialMessages.$inferInsert;

// ===== PLATFORM CREDENTIALS (مفاتيح API للمنصات الاجتماعية) =====
// يخزن App ID وApp Secret وClient Key لكل منصة
export const platformCredentials = mysqlTable("platform_credentials", {
  id: int("id").autoincrement().primaryKey(),
  platform: mysqlEnum("platform", ["instagram", "tiktok", "snapchat"]).notNull().unique(),
  appId: varchar("appId", { length: 300 }),         // Facebook App ID / TikTok Client Key / Snapchat Client ID
  appSecret: text("appSecret"),                      // App Secret / Client Secret
  extraField1: varchar("extraField1", { length: 300 }), // حقل إضافي (مثل Redirect URI)
  extraField2: varchar("extraField2", { length: 300 }), // حقل إضافي
  isConfigured: boolean("isConfigured").default(false).notNull(), // هل تم الإعداد؟
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type PlatformCredentials = typeof platformCredentials.$inferSelect;
export type InsertPlatformCredentials = typeof platformCredentials.$inferInsert;

// ===== PASSWORD RESET TOKENS =====
export const passwordResetTokens = mysqlTable("password_reset_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;

// ===== CONVERSATION LABELS =====
// نظام Labels احترافي مثل واتساب Business
export const conversationLabels = mysqlTable("conversation_labels", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  color: varchar("color", { length: 20 }).notNull().default("#3B82F6"), // hex color
  description: text("description"),
  createdBy: int("createdBy").notNull(), // userId
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ConversationLabel = typeof conversationLabels.$inferSelect;
export type InsertConversationLabel = typeof conversationLabels.$inferInsert;

// ===== CONVERSATION LABEL ASSIGNMENTS =====
// ربط labels بالمحادثات (many-to-many)
export const conversationLabelAssignments = mysqlTable("conversation_label_assignments", {
  id: int("id").autoincrement().primaryKey(),
  chatId: int("chatId").notNull(),           // whatsapp_chats.id
  labelId: int("labelId").notNull(),          // conversation_labels.id
  assignedBy: int("assignedBy").notNull(),    // userId
  assignedAt: timestamp("assignedAt").defaultNow().notNull(),
});
export type ConversationLabelAssignment = typeof conversationLabelAssignments.$inferSelect;
export type InsertConversationLabelAssignment = typeof conversationLabelAssignments.$inferInsert;

// ===== DAILY MESSAGE COUNTS =====
// تتبع عدد الرسائل اليومية لكل مستخدم
export const dailyMessageCounts = mysqlTable("daily_message_counts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
  count: int("count").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type DailyMessageCount = typeof dailyMessageCounts.$inferSelect;
export type InsertDailyMessageCount = typeof dailyMessageCounts.$inferInsert;

// ===== AUDIT LOG =====
// سجل تدقيق شامل لجميع العمليات الحساسة
export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),                          // من قام بالعملية (null = system)
  userName: varchar("userName", { length: 100 }), // اسم المستخدم وقت التنفيذ
  action: varchar("action", { length: 100 }).notNull(), // e.g. "send_message", "assign_label", "change_permission"
  entityType: varchar("entityType", { length: 50 }), // e.g. "chat", "lead", "user"
  entityId: varchar("entityId", { length: 64 }),     // معرف الكيان المتأثر
  details: json("details").$type<Record<string, unknown>>(), // تفاصيل إضافية
  ipAddress: varchar("ipAddress", { length: 45 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

// ===== AI REFERENCE USERS =====
// المستخدمون المرجعيون الذين يتعلم AI من أسلوبهم
export const aiReferenceUsers = mysqlTable("ai_reference_users", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  userName: varchar("userName", { length: 100 }),
  isActive: boolean("isActive").default(true).notNull(),
  learnedPatterns: json("learnedPatterns").$type<{
    greetings: string[];
    closings: string[];
    toneKeywords: string[];
    avgResponseLength: number;
    commonPhrases: string[];
  }>(),
  lastLearnedAt: timestamp("lastLearnedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AiReferenceUser = typeof aiReferenceUsers.$inferSelect;
export type InsertAiReferenceUser = typeof aiReferenceUsers.$inferInsert;

// ===== CHAT INTERNAL NOTES TABLE (ملاحظات داخلية لا يراها العميل) =====
export const chatInternalNotes = mysqlTable("chat_internal_notes", {
  id: int("id").autoincrement().primaryKey(),
  chatId: int("chatId").notNull(),
  authorId: int("authorId").notNull(),
  authorName: varchar("authorName", { length: 100 }).notNull(),
  content: text("content").notNull(),
  isPinned: boolean("isPinned").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ChatInternalNote = typeof chatInternalNotes.$inferSelect;
export type InsertChatInternalNote = typeof chatInternalNotes.$inferInsert;

// ===== REAL SOCIAL SNAPSHOTS TABLE =====
// يحفظ لقطات البيانات الحقيقية من APIs (TikTok, Twitter, Instagram, Backlinks)
// مع تاريخ التغيرات لكل عميل
export const realSocialSnapshots = mysqlTable("real_social_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull(),

  // TikTok
  tiktokUsername: varchar("tiktokUsername", { length: 100 }),
  tiktokFollowers: int("tiktokFollowers"),
  tiktokFollowing: int("tiktokFollowing"),
  tiktokHearts: bigint("tiktokHearts", { mode: "number" }),
  tiktokVideoCount: int("tiktokVideoCount"),
  tiktokVerified: boolean("tiktokVerified").default(false),
  tiktokEngagementRate: float("tiktokEngagementRate"),
  tiktokDescription: text("tiktokDescription"),
  tiktokTopVideos: json("tiktokTopVideos"), // Array of top videos

  // Twitter/X
  twitterUsername: varchar("twitterUsername", { length: 100 }),
  twitterFollowers: int("twitterFollowers"),
  twitterFollowing: int("twitterFollowing"),
  twitterTweetsCount: int("twitterTweetsCount"),
  twitterVerified: boolean("twitterVerified").default(false),
  twitterBlueVerified: boolean("twitterBlueVerified").default(false),
  twitterDescription: text("twitterDescription"),
  twitterLocation: varchar("twitterLocation", { length: 200 }),

  // Instagram
  instagramUsername: varchar("instagramUsername", { length: 100 }),
  instagramFollowers: int("instagramFollowers"),
  instagramFollowing: int("instagramFollowing"),
  instagramPostsCount: int("instagramPostsCount"),
  instagramVerified: boolean("instagramVerified").default(false),
  instagramEngagementRate: float("instagramEngagementRate"),
  instagramBio: text("instagramBio"),
  instagramTopPosts: json("instagramTopPosts"), // Array of top posts

  // Backlinks
  backlinkDomain: varchar("backlinkDomain", { length: 200 }),
  backlinkTotal: int("backlinkTotal").default(0),
  backlinkReferringDomains: json("backlinkReferringDomains"), // Array of domains
  backlinkHasGMB: boolean("backlinkHasGMB").default(false),
  backlinkHasSocial: boolean("backlinkHasSocial").default(false),

  // Metadata
  availableSources: json("availableSources"), // Array of source names
  fetchedAt: timestamp("fetchedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type RealSocialSnapshot = typeof realSocialSnapshots.$inferSelect;
export type InsertRealSocialSnapshot = typeof realSocialSnapshots.$inferInsert;

// جدول إعدادات الشركة (معلومات عامة)
export const companySettings = mysqlTable("company_settings", {
  id: int("id").autoincrement().primaryKey(),
  companyName: varchar("companyName", { length: 200 }).default("مكسب KSA"),
  companyDescription: text("companyDescription"),
  city: varchar("city", { length: 100 }).default("الرياض"),
  region: varchar("region", { length: 100 }).default("المنطقة الوسطى"),
  phone: varchar("phone", { length: 30 }),
  email: varchar("email", { length: 200 }),
  website: varchar("website", { length: 300 }),
  logoUrl: text("logoUrl"),
  primaryColor: varchar("primaryColor", { length: 20 }).default("#1a56db"),
  secondaryColor: varchar("secondaryColor", { length: 20 }).default("#0e9f6e"),
  reportHeaderText: text("reportHeaderText"),
  reportFooterText: text("reportFooterText"),
  reportIntroText: text("reportIntroText"),
  licenseNumber: varchar("licenseNumber", { length: 100 }),
  commercialRegistration: varchar("commercialRegistration", { length: 50 }),
  analystName: varchar("analystName", { length: 200 }),  // اسم المحلل الذي يظهر في التوقيع الرقمي
  analystTitle: varchar("analystTitle", { length: 200 }), // لقب المحلل (مثال: محلل تسويق رقمي أول)
  address: text("address"),
  instagramUrl: varchar("instagramUrl", { length: 300 }),
  twitterUrl: varchar("twitterUrl", { length: 300 }),
  linkedinUrl: varchar("linkedinUrl", { length: 300 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CompanySettings = typeof companySettings.$inferSelect;
export type InsertCompanySettings = typeof companySettings.$inferInsert;

// ===== AI Agent Tables =====
// جدول مهام الوكيل الذكي
export const agentTasks = mysqlTable("agent_tasks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  taskType: varchar("taskType", { length: 50 }).notNull(),
  status: mysqlEnum("status", ["pending", "running", "completed", "failed", "paused"]).default("pending").notNull(),
  context: json("context"),
  leadIds: json("leadIds"),
  result: json("result"),
  startedAt: bigint("startedAt", { mode: "number" }),
  completedAt: bigint("completedAt", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AgentTask = typeof agentTasks.$inferSelect;
export type InsertAgentTask = typeof agentTasks.$inferInsert;

// جدول سجلات الوكيل الذكي
export const agentLogs = mysqlTable("agent_logs", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  userId: int("userId").notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  details: json("details"),
  timestamp: bigint("timestamp", { mode: "number" }).notNull(),
});
export type AgentLog = typeof agentLogs.$inferSelect;
export type InsertAgentLog = typeof agentLogs.$inferInsert;

// ===== SERP SEARCH RESULTS TABLE =====
// تخزين نتائج البحث من SERP API (Instagram, TikTok, Snapchat, Facebook, Twitter)
export const serpSearchResults = mysqlTable("serp_search_results", {
  id: int("id").autoincrement().primaryKey(),
  // معلومات البحث
  searchQuery: varchar("searchQuery", { length: 500 }).notNull(),
  platform: mysqlEnum("platform", ["instagram", "tiktok", "snapchat", "facebook", "twitter", "linkedin", "google_maps"]).notNull(),
  keyword: varchar("keyword", { length: 200 }).notNull(),
  location: varchar("location", { length: 100 }).default("السعودية"),
  // بيانات الحساب
  username: varchar("username", { length: 200 }).notNull(),
  displayName: varchar("displayName", { length: 300 }),
  bio: text("bio"),
  profileUrl: varchar("profileUrl", { length: 1000 }).notNull(),
  // بيانات الاتصال المستخرجة
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 200 }),
  website: varchar("website", { length: 500 }),
  // بيانات التحليل
  relevanceScore: float("relevanceScore"),
  businessType: varchar("businessType", { length: 200 }),
  priority: mysqlEnum("priority", ["high", "medium", "low"]).default("medium"),
  isContactable: boolean("isContactable").default(false), // هل يمكن التواصل؟
  // حالة المعالجة
  status: mysqlEnum("status", ["new", "reviewed", "converted", "rejected"]).default("new").notNull(),
  convertedToLeadId: int("convertedToLeadId"), // إذا تم تحويله لـ Lead
  // ربط بمهمة البحث
  jobId: int("jobId"),
  // تواريخ
  discoveredAt: timestamp("discoveredAt").defaultNow().notNull(),
  reviewedAt: timestamp("reviewedAt"),
});
export type SerpSearchResult = typeof serpSearchResults.$inferSelect;
export type InsertSerpSearchResult = typeof serpSearchResults.$inferInsert;

// ===== SERP SEARCH QUEUE TABLE =====
// قائمة انتظار عمليات البحث (Task Queue)
export const serpSearchQueue = mysqlTable("serp_search_queue", {
  id: int("id").autoincrement().primaryKey(),
  // إعدادات المهمة
  taskName: varchar("taskName", { length: 200 }).notNull(),
  keyword: varchar("keyword", { length: 200 }).notNull(),
  location: varchar("location", { length: 100 }).default("السعودية"),
  platforms: json("platforms").$type<string[]>().notNull(), // ['instagram', 'tiktok', 'snapchat', ...]
  targetCount: int("targetCount").default(50).notNull(),
  // حالة المهمة
  status: mysqlEnum("status", ["pending", "running", "paused", "completed", "failed"]).default("pending").notNull(),
  priority: int("priority").default(5).notNull(), // 1 = أعلى أولوية، 10 = أدنى
  // تقدم المهمة
  totalFound: int("totalFound").default(0).notNull(),
  totalProcessed: int("totalProcessed").default(0).notNull(),
  currentPlatform: varchar("currentPlatform", { length: 50 }),
  // سجل العمليات
  log: json("log").$type<Array<{ time: string; message: string; type: "info" | "success" | "warning" | "error" }>>(),
  errorMessage: text("errorMessage"),
  // تواريخ
  scheduledAt: timestamp("scheduledAt"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  // معرف المستخدم الذي أنشأ المهمة
  createdBy: int("createdBy"),
});
export type SerpSearchQueue = typeof serpSearchQueue.$inferSelect;
export type InsertSerpSearchQueue = typeof serpSearchQueue.$inferInsert;

// ===== MARKETING SEASONS TABLE (المواسم التسويقية) =====
export const marketingSeasons = mysqlTable("marketing_seasons", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),                           // اسم الموسم (رمضان، الصيف، اليوم الوطني...)
  startDate: varchar("startDate", { length: 10 }).notNull(),                  // تاريخ البداية (MM-DD)
  endDate: varchar("endDate", { length: 10 }).notNull(),                      // تاريخ النهاية (MM-DD)
  year: int("year"),                                                           // السنة (null = يتكرر كل سنة)
  opportunities: json("opportunities").$type<string[]>().notNull(),           // الفرص التسويقية
  relatedBusinessTypes: json("relatedBusinessTypes").$type<string[]>(),       // أنواع الأنشطة المرتبطة (null = الكل)
  description: text("description"),                                            // وصف الموسم
  color: varchar("color", { length: 20 }).default("#f59e0b"),                 // لون الموسم في الواجهة
  icon: varchar("icon", { length: 10 }).default("🌙"),                       // أيقونة الموسم
  isActive: boolean("isActive").default(true).notNull(),                      // هل الموسم مفعّل؟
  priority: int("priority").default(5).notNull(),                             // أولوية الظهور (1 = أعلى)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type MarketingSeason = typeof marketingSeasons.$inferSelect;
export type InsertMarketingSeason = typeof marketingSeasons.$inferInsert;

// ===== REPORT STYLE SETTINGS TABLE (إعدادات أسلوب كتابة التقارير) =====
export const reportStyleSettings = mysqlTable("report_style_settings", {
  id: int("id").autoincrement().primaryKey(),
  // أسلوب النبرة العام
  tone: varchar("tone", { length: 50 }).default("professional").notNull(),
  // "professional" | "friendly" | "direct" | "consultative"
  // الكلمات المفتاحية للبراند (تُدمج في النصوص)
  brandKeywords: json("brandKeywords").$type<string[]>(),
  // تعليمات مخصصة للـ AI عند كتابة التوصيات
  customInstructions: text("customInstructions"),
  // تعليمات مخصصة للتعليق على الفرص
  opportunityCommentStyle: text("opportunityCommentStyle"),
  // هل يُذكر اسم الشركة (مكسب) في التقرير؟
  mentionCompanyName: boolean("mentionCompanyName").default(true).notNull(),
  // جملة الختام المخصصة
  closingStatement: text("closingStatement"),
  // هل يُضاف قسم الموسم التسويقي تلقائياً؟
  includeSeasonSection: boolean("includeSeasonSection").default(true).notNull(),
  // هل يُضاف قسم المنافسين؟
  includeCompetitorsSection: boolean("includeCompetitorsSection").default(true).notNull(),
  // مستوى التفصيل: "brief" | "standard" | "detailed"
  detailLevel: varchar("detailLevel", { length: 20 }).default("standard").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ReportStyleSettings = typeof reportStyleSettings.$inferSelect;
export type InsertReportStyleSettings = typeof reportStyleSettings.$inferInsert;

// ===== WHATCHIMP INTEGRATION SETTINGS =====
export const whatchimpSettings = mysqlTable("whatchimp_settings", {
  id: int("id").autoincrement().primaryKey(),
  apiToken: varchar("api_token", { length: 200 }).notNull(),
  phoneNumberId: varchar("phone_number_id", { length: 50 }).notNull(),
  defaultLabelId: int("default_label_id"),
  defaultLabelName: varchar("default_label_name", { length: 100 }),
  // Bot Flow لإرسال تقرير PDF عبر واتساب
  botFlowUniqueId: varchar("bot_flow_unique_id", { length: 200 }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type WhatchimpSettings = typeof whatchimpSettings.$inferSelect;
export type InsertWhatchimpSettings = typeof whatchimpSettings.$inferInsert;

// ===== WHATCHIMP SEND LOG =====
export const whatchimpSendLog = mysqlTable("whatchimp_send_log", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("lead_id").notNull(),
  leadName: varchar("lead_name", { length: 200 }),
  phone: varchar("phone", { length: 30 }).notNull(),
  status: mysqlEnum("status", ["success", "failed", "skipped"]).notNull(),
  errorMessage: text("error_message"),
  waMessageId: varchar("wa_message_id", { length: 200 }),
  batchId: varchar("batch_id", { length: 100 }),
  sentByUserId: int("sent_by_user_id"),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
});
export type WhatchimpSendLog = typeof whatchimpSendLog.$inferSelect;
export type InsertWhatchimpSendLog = typeof whatchimpSendLog.$inferInsert;


// ===== SEO ADVANCED ANALYSIS =====
export const seoAdvancedAnalysis = mysqlTable("seo_advanced_analysis", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("lead_id").notNull(),
  url: varchar("url", { length: 500 }).notNull(),

  // الكلمات المفتاحية
  topKeywords: json("top_keywords").$type<{keyword: string, volume: string, position: number | null, difficulty: string}[]>().default([]),
  missingKeywords: json("missing_keywords").$type<string[]>().default([]),
  keywordOpportunities: json("keyword_opportunities").$type<string[]>().default([]),

  // الـ Backlinks
  estimatedBacklinks: int("estimated_backlinks"),
  backlinkQuality: mysqlEnum("backlink_quality", ["weak", "average", "good", "strong"]).default("weak"),
  topReferringDomains: json("top_referring_domains").$type<string[]>().default([]),
  backlinkGaps: json("backlink_gaps").$type<string[]>().default([]),

  // مقارنة المنافسين
  competitors: json("competitors").$type<{name: string, url: string, seoScore: number, strengths: string[]}[]>().default([]),
  competitorGaps: json("competitor_gaps").$type<string[]>().default([]),
  competitiveAdvantages: json("competitive_advantages").$type<string[]>().default([]),

  // ترتيب البحث
  searchRankings: json("search_rankings").$type<{keyword: string, position: number | null, url: string, snippet: string}[]>().default([]),
  brandMentions: int("brand_mentions").default(0),
  localSeoScore: int("local_seo_score"),

  // ملخص
  overallSeoHealth: mysqlEnum("overall_seo_health", ["critical", "weak", "average", "good", "excellent"]).default("average"),
  seoSummary: text("seo_summary"),
  priorityActions: json("priority_actions").$type<string[]>().default([]),

  analyzedAt: timestamp("analyzed_at").defaultNow().notNull(),
});
export type SeoAdvancedAnalysis = typeof seoAdvancedAnalysis.$inferSelect;
export type InsertSeoAdvancedAnalysis = typeof seoAdvancedAnalysis.$inferInsert;
