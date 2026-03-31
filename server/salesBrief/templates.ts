/**
 * PHASE 6A — salesBrief/templates.ts
 * =====================================
 * Deterministic templates and lookup tables for SalesBrief generation.
 * Zero external dependencies. Zero LLM calls.
 *
 * Design principles:
 *  - All OpportunityType values MUST have a corresponding entry (TypeScript exhaustive check)
 *  - Templates support simple {businessName}, {city}, {category} interpolation
 *  - Priority modifier adjusts urgency tone without changing the core message
 *  - bestContactChannel fallback chain is defined here as a constant
 */
import type { OpportunityType } from "../../shared/types/lead-intelligence";
import type { SalesBrief } from "../../shared/types/lead-intelligence";

// ─── OpportunityType → Arabic label ──────────────────────────────────────────
/**
 * Short Arabic label for each opportunity type.
 * Used in topOpportunity and topFindings.
 */
export const OPPORTUNITY_LABELS: Record<OpportunityType, string> = {
  local_seo:               "تحسين الظهور في البحث المحلي",
  technical_seo:           "إصلاح المشاكل التقنية للموقع",
  content_strategy:        "بناء استراتيجية محتوى",
  social_optimization:     "تطوير الحضور على السوشيال ميديا",
  branding:                "تقوية الهوية البصرية والعلامة التجارية",
  landing_page:            "بناء صفحة هبوط احترافية",
  paid_tracking:           "إعداد تتبع الإعلانات المدفوعة",
  retargeting:             "إعادة استهداف الزوار والعملاء المحتملين",
  whatsapp_funnel:         "بناء قمع مبيعات عبر واتساب",
  reputation_management:   "إدارة السمعة الإلكترونية والمراجعات",
  conversion_optimization: "تحسين معدل التحويل وزيادة المبيعات",
};

// ─── OpportunityType → salesAngle template ───────────────────────────────────
/**
 * One-sentence sales angle per opportunity type.
 * Supports: {businessName}, {city}, {category}
 */
export const SALES_ANGLE_TEMPLATES: Record<OpportunityType, string> = {
  local_seo:
    "نساعد {businessName} على الظهور في أعلى نتائج البحث المحلي وجذب عملاء من {city} بشكل مستمر.",
  technical_seo:
    "نحل المشاكل التقنية التي تمنع موقع {businessName} من الظهور في نتائج البحث وتُبطئ تجربة الزوار.",
  content_strategy:
    "نبني لـ {businessName} استراتيجية محتوى تُحوّل المتابعين إلى عملاء حقيقيين.",
  social_optimization:
    "نطوّر حضور {businessName} على السوشيال ميديا ليعكس جودة الخدمة ويجذب الجمهور الصحيح.",
  branding:
    "نبني هوية بصرية احترافية لـ {businessName} تُميّزها في السوق وتُعزز الثقة مع العملاء.",
  landing_page:
    "نصمم صفحة هبوط لـ {businessName} تحوّل الزوار إلى عملاء بمعدل تحويل أعلى.",
  paid_tracking:
    "نُعدّ منظومة تتبع إعلانات دقيقة لـ {businessName} لضمان عائد استثمار واضح وقابل للقياس.",
  retargeting:
    "نُعيد استهداف الزوار الذين زاروا {businessName} ولم يُكملوا الشراء لزيادة المبيعات.",
  whatsapp_funnel:
    "نبني قمع مبيعات احترافي عبر واتساب لـ {businessName} يحوّل الاستفسارات إلى صفقات مغلقة.",
  reputation_management:
    "نُدير سمعة {businessName} الإلكترونية ونُعزز المراجعات الإيجابية لبناء ثقة العملاء الجدد.",
  conversion_optimization:
    "نُحسّن تجربة العميل في {businessName} لزيادة نسبة التحويل من زائر إلى مشترٍ.",
};

// ─── bestContactChannel × OpportunityType → firstMessageHint ─────────────────
/**
 * First message hint per channel and opportunity type.
 * Tone: direct, professional, Saudi Arabic.
 * Supports: {businessName}, {city}, {category}
 */
export const FIRST_MESSAGE_TEMPLATES: Record<
  SalesBrief["bestContactChannel"],
  Record<OpportunityType, string>
> = {
  whatsapp: {
    local_seo:
      "السلام عليكم، لاحظنا أن {businessName} غير ظاهر بشكل كافٍ في نتائج البحث المحلي في {city}. عندنا حل يساعدكم تجذبون عملاء أكثر — هل يناسبكم نتكلم؟",
    technical_seo:
      "السلام عليكم، موقع {businessName} فيه بعض المشاكل التقنية تأثر على ظهوره في جوجل. نقدر نحلها بسرعة — هل يناسبكم نتكلم؟",
    content_strategy:
      "السلام عليكم، شفنا أن {businessName} عنده حضور رقمي لكن المحتوى ما يعكس قوة الخدمة. نقدر نساعدكم تبنون استراتيجية محتوى فعّالة.",
    social_optimization:
      "السلام عليكم، حضور {businessName} على السوشيال ميديا يحتاج تطوير. عندنا خطة عملية تزيد التفاعل والمتابعين المهتمين.",
    branding:
      "السلام عليكم، الهوية البصرية لـ {businessName} تحتاج تحديث يعكس مستوى الخدمة. نقدر نساعدكم تبنون هوية قوية.",
    landing_page:
      "السلام عليكم، {businessName} يحتاج صفحة هبوط احترافية تحوّل الزوار إلى عملاء. نقدر نصممها لكم بسرعة.",
    paid_tracking:
      "السلام عليكم، لو تشغّلون إعلانات، منظومة التتبع الصحيحة تضاعف عائدكم. نقدر نُعدّها لـ {businessName}.",
    retargeting:
      "السلام عليكم، كثير من زوار {businessName} يغادرون بدون شراء. نقدر نُعيد استهدافهم وتحويلهم لعملاء.",
    whatsapp_funnel:
      "السلام عليكم، بناء قمع مبيعات احترافي عبر واتساب يحوّل استفسارات {businessName} لصفقات مغلقة. هل تودّون نشرح الفكرة؟",
    reputation_management:
      "السلام عليكم، إدارة المراجعات والسمعة الإلكترونية لـ {businessName} تُعزز ثقة العملاء الجدد بشكل كبير.",
    conversion_optimization:
      "السلام عليكم، نقدر نزيد نسبة التحويل في {businessName} من خلال تحسينات عملية في تجربة العميل.",
  },
  phone: {
    local_seo:
      "أهلاً، معنا من شركة مكسب. لاحظنا أن {businessName} يمكن يظهر أكثر في البحث المحلي في {city} — هل عندكم دقيقتين نتكلم؟",
    technical_seo:
      "أهلاً، معنا من شركة مكسب. موقع {businessName} فيه بعض المشاكل التقنية تأثر على ظهوره — هل يناسبكم نتكلم؟",
    content_strategy:
      "أهلاً، معنا من شركة مكسب. نقدر نساعد {businessName} ببناء استراتيجية محتوى تجذب عملاء أكثر — هل عندكم دقيقتين؟",
    social_optimization:
      "أهلاً، معنا من شركة مكسب. عندنا خطة لتطوير حضور {businessName} على السوشيال ميديا — هل يناسبكم نتكلم؟",
    branding:
      "أهلاً، معنا من شركة مكسب. نقدر نساعد {businessName} ببناء هوية بصرية احترافية — هل عندكم دقيقتين؟",
    landing_page:
      "أهلاً، معنا من شركة مكسب. نقدر نصمم صفحة هبوط احترافية لـ {businessName} تزيد مبيعاتكم — هل يناسبكم نتكلم؟",
    paid_tracking:
      "أهلاً، معنا من شركة مكسب. منظومة تتبع الإعلانات الصحيحة تضاعف عائد {businessName} — هل عندكم دقيقتين؟",
    retargeting:
      "أهلاً، معنا من شركة مكسب. نقدر نُعيد استهداف زوار {businessName} وتحويلهم لعملاء — هل يناسبكم نتكلم؟",
    whatsapp_funnel:
      "أهلاً، معنا من شركة مكسب. نقدر نبني قمع مبيعات عبر واتساب لـ {businessName} يزيد إغلاق الصفقات — هل عندكم دقيقتين؟",
    reputation_management:
      "أهلاً، معنا من شركة مكسب. نقدر نُحسّن سمعة {businessName} الإلكترونية وتعزيز المراجعات — هل يناسبكم نتكلم؟",
    conversion_optimization:
      "أهلاً، معنا من شركة مكسب. نقدر نزيد نسبة التحويل في {businessName} بتحسينات عملية — هل عندكم دقيقتين؟",
  },
  instagram: {
    local_seo:
      "أهلاً {businessName} 👋 لاحظنا إمكانية تحسين ظهوركم في البحث المحلي في {city}. عندنا حل بسيط وفعّال — هل تودّون نشاركه معكم؟",
    technical_seo:
      "أهلاً {businessName} 👋 موقعكم فيه بعض المشاكل التقنية تأثر على ظهوره في جوجل. نقدر نساعدكم تحلّونها.",
    content_strategy:
      "أهلاً {businessName} 👋 نقدر نساعدكم تبنون استراتيجية محتوى تحوّل متابعيكم لعملاء حقيقيين.",
    social_optimization:
      "أهلاً {businessName} 👋 عندنا خطة لتطوير حضوركم على السوشيال ميديا وزيادة التفاعل الحقيقي.",
    branding:
      "أهلاً {businessName} 👋 نقدر نساعدكم تبنون هوية بصرية احترافية تعكس مستوى خدمتكم.",
    landing_page:
      "أهلاً {businessName} 👋 صفحة هبوط احترافية تحوّل زوار حسابكم لعملاء — نقدر نصممها لكم.",
    paid_tracking:
      "أهلاً {businessName} 👋 منظومة تتبع الإعلانات الصحيحة تضاعف عائدكم — نقدر نُعدّها لكم.",
    retargeting:
      "أهلاً {businessName} 👋 نقدر نُعيد استهداف زوار حسابكم الذين ما اشتروا بعد.",
    whatsapp_funnel:
      "أهلاً {businessName} 👋 قمع مبيعات عبر واتساب يحوّل استفساراتكم لصفقات مغلقة — هل تودّون نشرح الفكرة؟",
    reputation_management:
      "أهلاً {businessName} 👋 نقدر نُحسّن سمعتكم الإلكترونية وتعزيز المراجعات الإيجابية.",
    conversion_optimization:
      "أهلاً {businessName} 👋 نقدر نزيد نسبة التحويل من متابعيكم لعملاء بتحسينات عملية.",
  },
  linkedin: {
    local_seo:
      "مرحباً، لاحظنا أن {businessName} لديها فرصة لتحسين الظهور في نتائج البحث المحلي في {city}. نسعد بمشاركة تفاصيل الحل معكم.",
    technical_seo:
      "مرحباً، يوجد بعض المشاكل التقنية في موقع {businessName} تؤثر على ظهوره في محركات البحث. نسعد بمناقشة الحلول المتاحة.",
    content_strategy:
      "مرحباً، نقدم خدمات بناء استراتيجية المحتوى التي تُحوّل الجمهور الرقمي لـ {businessName} إلى عملاء فعليين.",
    social_optimization:
      "مرحباً، نقدم حلولاً متكاملة لتطوير الحضور الرقمي لـ {businessName} على منصات التواصل الاجتماعي.",
    branding:
      "مرحباً، نتخصص في بناء الهوية البصرية الاحترافية التي تُعزز مكانة {businessName} في السوق.",
    landing_page:
      "مرحباً، نصمم صفحات هبوط عالية التحويل لـ {businessName} تُحقق نتائج قابلة للقياس.",
    paid_tracking:
      "مرحباً، نُعدّ منظومات تتبع إعلانات دقيقة لـ {businessName} لضمان أعلى عائد على الاستثمار.",
    retargeting:
      "مرحباً، نقدم حلول إعادة الاستهداف لـ {businessName} لتحويل الزوار المهتمين إلى عملاء.",
    whatsapp_funnel:
      "مرحباً، نبني أنظمة مبيعات متكاملة عبر واتساب لـ {businessName} تُحسّن معدلات إغلاق الصفقات.",
    reputation_management:
      "مرحباً، نقدم خدمات إدارة السمعة الإلكترونية لـ {businessName} لتعزيز الثقة مع العملاء الجدد.",
    conversion_optimization:
      "مرحباً، نُحسّن تجربة العميل في {businessName} لزيادة معدلات التحويل وتحقيق نمو مستدام.",
  },
  email: {
    local_seo:
      "تحية طيبة، نودّ مشاركة {businessName} فرصة لتحسين الظهور في نتائج البحث المحلي في {city} وزيادة العملاء القادمين من المنطقة.",
    technical_seo:
      "تحية طيبة، رصدنا بعض المشاكل التقنية في موقع {businessName} تؤثر على ترتيبه في محركات البحث. نسعد بمناقشة الحلول.",
    content_strategy:
      "تحية طيبة، نقدم لـ {businessName} استراتيجية محتوى متكاملة تُحوّل الجمهور الرقمي إلى عملاء فعليين.",
    social_optimization:
      "تحية طيبة، نقدم حلولاً لتطوير الحضور الرقمي لـ {businessName} على منصات التواصل الاجتماعي.",
    branding:
      "تحية طيبة، نتخصص في تطوير الهوية البصرية لـ {businessName} لتعكس مستوى الخدمة المقدمة.",
    landing_page:
      "تحية طيبة، نصمم لـ {businessName} صفحات هبوط احترافية تُحقق معدلات تحويل أعلى.",
    paid_tracking:
      "تحية طيبة، نُعدّ لـ {businessName} منظومة تتبع إعلانات دقيقة لضمان أعلى عائد على الاستثمار.",
    retargeting:
      "تحية طيبة، نقدم لـ {businessName} حلول إعادة الاستهداف لتحويل الزوار المهتمين إلى عملاء.",
    whatsapp_funnel:
      "تحية طيبة، نبني لـ {businessName} قمع مبيعات احترافي عبر واتساب يُحسّن معدلات إغلاق الصفقات.",
    reputation_management:
      "تحية طيبة، نقدم لـ {businessName} خدمات إدارة السمعة الإلكترونية لتعزيز الثقة مع العملاء الجدد.",
    conversion_optimization:
      "تحية طيبة، نُحسّن تجربة العميل في {businessName} لزيادة معدلات التحويل وتحقيق نمو مستدام.",
  },
};

// ─── Priority modifier ────────────────────────────────────────────────────────
/**
 * Appended to firstMessageHint to adjust urgency based on lead priority.
 * A/B = high urgency, C = medium, D = low.
 */
export const PRIORITY_MODIFIER: Record<"A" | "B" | "C" | "D", string> = {
  A: " (الأولوية عالية — ننصح بالتواصل خلال 24 ساعة)",
  B: " (أولوية جيدة — ننصح بالتواصل هذا الأسبوع)",
  C: "",
  D: "",
};

// ─── bestContactChannel priority chain ───────────────────────────────────────
/**
 * Defines the fallback order for bestContactChannel.
 * Used by generator.ts — exported here for testability.
 *
 * Rules:
 *  1. whatsapp  — if hasWhatsapp === "yes"
 *  2. phone     — if verifiedPhone is a non-empty string
 *  3. instagram — if instagramUrl is a non-empty string
 *  4. linkedin  — if linkedinUrl is a non-empty string
 *  5. email     — safe fallback (always available as generic channel)
 *
 * Note: "phone" is NEVER used as fallback unless verifiedPhone actually exists.
 * "email" is the final safe fallback when no channel is confirmed.
 */
export type ContactChannelInput = {
  hasWhatsapp: string | null | undefined;
  verifiedPhone: string | null | undefined;
  instagramUrl: string | null | undefined;
  linkedinUrl: string | null | undefined;
};

export function resolveBestContactChannel(
  input: ContactChannelInput
): SalesBrief["bestContactChannel"] {
  if (input.hasWhatsapp === "yes") return "whatsapp";
  if (input.verifiedPhone && input.verifiedPhone.trim().length > 0) return "phone";
  if (input.instagramUrl && input.instagramUrl.trim().length > 0) return "instagram";
  if (input.linkedinUrl && input.linkedinUrl.trim().length > 0) return "linkedin";
  return "email"; // safe fallback — never phone unless verified
}

// ─── Template interpolation ───────────────────────────────────────────────────
/**
 * Replaces {businessName}, {city}, {category} in a template string.
 * Falls back to safe defaults if values are missing.
 */
export function interpolate(
  template: string,
  vars: { businessName?: string | null; city?: string | null; category?: string | null }
): string {
  return template
    .replace(/\{businessName\}/g, vars.businessName?.trim() || "النشاط")
    .replace(/\{city\}/g, vars.city?.trim() || "المنطقة")
    .replace(/\{category\}/g, vars.category?.trim() || "القطاع");
}
