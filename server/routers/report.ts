import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getLeadById, getWebsiteAnalysisByLeadId, getSocialAnalysesByLeadId, getDb } from "../db";
import { invokeLLM } from "../_core/llm";
import { storagePut } from "../storage";
import { nanoid } from "nanoid";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { getActiveSeasonForBusiness, getUpcomingSeasonsForBusiness } from "./seasons";
import { getReportStyleSettings } from "./reportStyle";

async function getCompanySettingsData() {
  try {
    const db = await getDb();
    if (!db) return null;
    const { companySettings } = await import("../../drizzle/schema");
    const [row] = await db.select().from(companySettings).limit(1);
    return row || null;
  } catch { return null; }
}

// ===== Helper: جلب المنافسين من نفس المجال والمدينة =====
// معاجم القطاعات لضمان مطابقة دقيقة لنوع النشاط
function buildAnalystContext(lead: any): string {
  const sections: string[] = [];
  if (lead?.notes?.trim()) sections.push(`ملاحظات الفريق:\n${lead.notes.trim()}`);
  if (lead?.additionalNotes?.trim()) sections.push(`تعليقات المحلل:\n${lead.additionalNotes.trim()}`);
  return sections.join("\n\n");
}

const BUSINESS_CATEGORY_KEYWORDS: Record<string, string[]> = {
  "ملابس": ["ملابس", "أزياء", "بوتيك", "عبايا", "خياط", "موضة", "فاشون", "أطفال", "رجال", "نساء"],
  "مطعم": ["مطعم", "كافيه", "مقهى", "مطبخ", "وجبات", "برغر", "بيتزا", "سوشي", "مشوي", "شوارم", "فطور", "حلويات"],
  "لحوم": ["لحم", "ملحمة", "قصاب", "مشوي", "شوارم", "برغر", "كباب"],
  "صالون": ["صالون", "تجميل", "حلاقة", "سبا", "نايل", "بشرة", "شعر"],
  "عقار": ["عقار", "شقق", "فلل", "بيوت", "مكاتب", "وساطة"],
  "سيارات": ["سيارة", "سيارات", "مركبات", "معرض", "تأجير", "غيار"],
  "تعليم": ["تعليم", "مدرسة", "أكاديمية", "دروس", "تدريب", "كورس"],
  "طب": ["طب", "عيادة", "مستشفى", "صيدلية", "دكتور", "صحة"],
  "سفر": ["سفر", "سياحة", "فندق", "شقق", "رحلات", "حجز"],
  "تقنية": ["تقنية", "الكترونيك", "برمجة", "موبايل", "كمبيوتر", "صيانة"],
};

function getBusinessCategory(businessType: string): string | null {
  const bt = (businessType || "").toLowerCase();
  for (const [category, keywords] of Object.entries(BUSINESS_CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => bt.includes(kw))) return category;
  }
  return null;
}

async function getCompetitors(leadId: number, businessType: string, city: string): Promise<any[]> {
  try {
    const db = await getDb();
    if (!db) return [];
    const { leads } = await import("../../drizzle/schema");
    const { and, eq, ne, like, or } = await import("drizzle-orm");

    const selectFields = {
      id: leads.id,
      companyName: leads.companyName,
      businessType: leads.businessType,
      city: leads.city,
      website: leads.website,
      instagramUrl: leads.instagramUrl,
      tiktokUrl: leads.tiktokUrl,
      snapchatUrl: leads.snapchatUrl,
      facebookUrl: leads.facebookUrl,
      twitterUrl: leads.twitterUrl,
      googleMapsUrl: leads.googleMapsUrl,
      verifiedPhone: leads.verifiedPhone,
      leadPriorityScore: leads.leadPriorityScore,
    };

    // المرحلة 1: بحث دقيق - نفس نوع النشاط + نفس المدينة
    const firstWord = businessType.split(' ')[0];
    let competitors = await db
      .select(selectFields)
      .from(leads)
      .where(
        and(
          ne(leads.id, leadId),
          like(leads.businessType, `%${firstWord}%`),
          eq(leads.city, city)
        )
      )
      .limit(5);

    // المرحلة 2: إذا لم يكف، بحث بنفس نوع النشاط فقط (بدون شرط المدينة)
    if (competitors.length < 3) {
      const moreByType = await db
        .select(selectFields)
        .from(leads)
        .where(
          and(
            ne(leads.id, leadId),
            like(leads.businessType, `%${firstWord}%`)
          )
        )
        .limit(5);
      // دمج بدون تكرار
      const existingIds = new Set(competitors.map((c: any) => c.id));
      for (const c of moreByType) {
        if (!existingIds.has(c.id)) {
          competitors.push(c);
          if (competitors.length >= 5) break;
        }
      }
    }

    // المرحلة 3: إذا لا يزال فارغ، ابحث بنفس الفئة العامة (ليس بالمدينة فقط)
    if (competitors.length < 2) {
      const category = getBusinessCategory(businessType);
      if (category) {
        const categoryKeywords = BUSINESS_CATEGORY_KEYWORDS[category] || [];
        const existingIds = new Set(competitors.map((c: any) => c.id));
        for (const kw of categoryKeywords.slice(0, 3)) {
          if (competitors.length >= 5) break;
          const byCategory = await db
            .select(selectFields)
            .from(leads)
            .where(
              and(
                ne(leads.id, leadId),
                like(leads.businessType, `%${kw}%`)
              )
            )
            .limit(3);
          for (const c of byCategory) {
            if (!existingIds.has(c.id)) {
              competitors.push(c);
              existingIds.add(c.id);
              if (competitors.length >= 5) break;
            }
          }
        }
      }
    }

    return competitors.slice(0, 5);
  } catch (e) {
    console.error('[Competitors]', e);
    return [];
  }
}

async function generatePDFBuffer(lead: any, websiteAnalysis: any, socialAnalyses: any[]): Promise<Buffer> {
  const company = await getCompanySettingsData();
  // جلب بيانات الموسم التسويقي الحالي
  const businessType = lead.businessType || "";
  const activeSeason = await getActiveSeasonForBusiness(businessType).catch(() => null);
  const upcomingSeasons = await getUpcomingSeasonsForBusiness(businessType).catch(() => []);
  const competitors = await getCompetitors(lead.id, businessType, lead.city || "").catch(() => []);
  // جلب آخر تحليل SEO متقدم محفوظ
  let seoAdvancedData: any = null;
  try {
    const db = await getDb();
    if (db) {
      const { seoAdvancedAnalysis } = await import("../../drizzle/schema");
      const { desc, eq } = await import("drizzle-orm");
      const rows = await db.select().from(seoAdvancedAnalysis)
        .where(eq(seoAdvancedAnalysis.leadId, lead.id))
        .orderBy(desc(seoAdvancedAnalysis.analyzedAt))
        .limit(1);
      seoAdvancedData = rows[0] ?? null;
    }
  } catch { /* لا يوقف التقرير إذا فشل جلب SEO */ }
  // جلب إعدادات أسلوب الكتابة
  const styleSettings = await getReportStyleSettings().catch(() => null);
  const html = buildPDFHtml(lead, websiteAnalysis, socialAnalyses, company, activeSeason, upcomingSeasons, competitors, styleSettings, seoAdvancedData);
  
  let executablePath: string;
  try {
    const { execSync } = await import("child_process");
    const sysChrome = execSync("which chromium-browser || which chromium || which google-chrome 2>/dev/null", { encoding: "utf8" }).trim().split("\n")[0];
    if (sysChrome) {
      executablePath = sysChrome;
    } else {
      executablePath = await chromium.executablePath();
    }
  } catch {
    executablePath = await chromium.executablePath();
  }

  // خيارات محسّنة لتقليل استهلاك الذاكرة ومنع crash السيرفر
  const extraArgs = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-extensions",
    "--disable-background-networking",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-breakpad",
    "--disable-client-side-phishing-detection",
    "--disable-component-update",
    "--disable-default-apps",
    "--disable-domain-reliability",
    "--disable-features=AudioServiceOutOfProcess",
    "--disable-hang-monitor",
    "--disable-ipc-flooding-protection",
    "--disable-notifications",
    "--disable-offer-store-unmasked-wallet-cards",
    "--disable-popup-blocking",
    "--disable-print-preview",
    "--disable-prompt-on-repost",
    "--disable-renderer-backgrounding",
    "--disable-sync",
    "--disable-translate",
    "--metrics-recording-only",
    "--mute-audio",
    "--no-first-run",
    "--safebrowsing-disable-auto-update",
    "--single-process",
    "--memory-pressure-off",
    "--js-flags=--max-old-space-size=512",
  ];

  const browser = await puppeteer.launch({
    executablePath,
    args: extraArgs,
    headless: true,
    defaultViewport: { width: 1200, height: 900 },
  });

  try {
    const page = await browser.newPage();
    // تعطيل تحميل الصور والخطوط الخارجية لتسريع التوليد
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const rt = req.resourceType();
      if (rt === 'image' || rt === 'font' || rt === 'media') {
        req.abort();
      } else {
        req.continue();
      }
    });
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 45000 });
    // انتظار قصير لضمان اكتمال الرسم
    await new Promise(r => setTimeout(r, 500));
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      timeout: 60000,
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close().catch(() => {});
  }
}

// ===== Helper: حساب الفرص الضائعة بناءً على البيانات المتاحة =====
function computeMissedOpportunities(lead: any, websiteAnalysis: any, socialAnalyses: any[]) {
  const gaps: Array<{ icon: string; title: string; description: string; impact: string; solution: string; priority: "high" | "medium" | "low" }> = [];

  // 1. الموقع الإلكتروني غير مرصود
  if (!lead.website) {
    gaps.push({
      icon: "🌐",
      title: "الموقع الإلكتروني — يحتاج تطوير",
      description: `لم يظهر موقع إلكتروني لـ ${lead.companyName} في المسح الأولي. قد يكون الموقع موجوداً ولم يُرصد، أو أن هذا الجانب لم يُطوَّر بعد — وفي كلتا الحالتين يمثل فرصة لتعزيز الحضور الرقمي.`,
      impact: "تقدير أولي: تطوير الموقع يرفع من معدل الوصول عبر محركات البحث بشكل ملموس",
      solution: "بناء موقع احترافي مع تحسين SEO يضع النشاط في أول نتائج البحث",
      priority: "high"
    });
  }

  // 2. ضعف SEO
  if (websiteAnalysis && websiteAnalysis.seoScore && Number(websiteAnalysis.seoScore) < 6) {
    gaps.push({
      icon: "🔍",
      title: "ظهور محركات البحث (SEO) — يحتاج تحسين",
      description: `درجة SEO للموقع ${Number(websiteAnalysis.seoScore).toFixed(1)}/10 — هذا يشير إلى وجود فرصة لتحسين الترتيب في نتائج البحث وزيادة الوصول العضوي.`,
      impact: "تقدير أولي: تحسين SEO يرفع الزيارات العضوية المجانية بشكل ملحوظ",
      solution: "تحسين SEO الفني والمحتوى لرفع الترتيب في Google",
      priority: "high"
    });
  }

  // 3. إنستغرام غير مرصود
  if (!lead.instagramUrl) {
    gaps.push({
      icon: "📸",
      title: "إنستغرام — لم يُرصد في المسح الأولي",
      description: `لم يظهر حساب إنستغرام لـ ${lead.businessType || "النشاط"} في ${lead.city || "المملكة"} خلال المسح الأولي. قد يكون الحساب موجوداً بمسمى مختلف، أو أن هذه المنصة لم تُفعَّل بعد — وهي فرصة لتعزيز الوصول للفئة العمرية 18-35.`,
      impact: "تقدير أولي: تفعيل إنستغرام يرفع من الوصول للعملاء المحتملين في هذه الفئة",
      solution: "إنشاء حساب إنستغرام احترافي مع استراتيجية محتوى منتظمة",
      priority: "high"
    });
  }

  // 4. إنستغرام موجود لكن تفاعل يحتاج تطوير
  const instaSocial = socialAnalyses.find(s => s.platform?.toLowerCase().includes("instagram"));
  if (instaSocial && instaSocial.followersCount && Number(instaSocial.followersCount) < 1000) {
    gaps.push({
      icon: "📉",
      title: "إنستغرام — التفاعل يحتاج تطوير",
      description: `عدد المتابعين الحالي ${Number(instaSocial.followersCount).toLocaleString("ar")} — هناك فرصة لتنمية الجمهور وزيادة التفاعل مقارنةً بالمتوسط في ${lead.city || "السوق"} لنشاط مماثل.`,
      impact: "تطوير التفاعل يرفع الوصول العضوي ويعزز الثقة الاجتماعية",
      solution: "استراتيجية نمو متكاملة: محتوى + تفاعل + إعلانات مستهدفة",
      priority: "medium"
    });
  }

  // 5. تيك توك غير مرصود
  if (!lead.tiktokUrl) {
    gaps.push({
      icon: "🎵",
      title: "تيك توك — لم يُرصد في المسح الأولي",
      description: `لم يظهر حساب تيك توك لـ ${lead.companyName} في المسح الأولي. تيك توك منصة اكتشاف قوية في السعودية، وتفعيلها يمثل فرصة للانتشار الواسع.`,
      impact: "تفعيل تيك توك يفتح فرصة الانتشار الفيروسي المجاني",
      solution: "إنشاء محتوى تيك توك قصير وجذاب يعكس هوية النشاط",
      priority: "medium"
    });
  }

  // 6. رقم هاتف غير موثق في المسح
  if (!lead.verifiedPhone) {
    gaps.push({
      icon: "📞",
      title: "معلومات التواصل — لم تُوثَّق في المسح الأولي",
      description: `لم يُرصد رقم هاتف موثق لـ ${lead.companyName} في المسح الأولي. توثيق بيانات التواصل وإبرازها على المنصات الرقمية يسهّل على العملاء المهتمين التواصل المباشر.`,
      impact: "توثيق التواصل يسهّل وصول العملاء الجاهزين للشراء",
      solution: "توثيق بيانات التواصل وإضافتها لجميع المنصات الرقمية",
      priority: "high"
    });
  }

  // 7. سناب شات غير مرصود
  if (!lead.snapchatUrl) {
    gaps.push({
      icon: "👻",
      title: "سناب شات — لم يُرصد في المسح الأولي",
      description: `لم يظهر حساب سناب شات لـ ${lead.companyName} في المسح الأولي. سناب شات منصة ذات انتشار واسع في السعودية، وتفعيلها يمثل فرصة للوصول لشريحة شبابية واسعة.`,
      impact: "تفعيل سناب شات يفتح قناة وصول مهمة للشريحة الأكثر إنفاقاً في السوق السعودي",
      solution: "إنشاء حساب سناب شات مع قصص يومية وإعلانات مستهدفة",
      priority: "medium"
    });
  }

  // 8. Google Maps غير مرصود
  if (!lead.googleMapsUrl) {
    gaps.push({
      icon: "⭐",
      title: "Google Maps — لم يُرصد في المسح الأولي",
      description: `لم يظهر نشاط ${lead.companyName} على Google Maps في المسح الأولي. التسجيل على Google Business يعزز الثقة لدى العملاء الجدد ويرفع الظهور في نتائج البحث المحلي.`,
      impact: "تفعيل Google Business يرفع من معدل الثقة والاكتشاف المحلي",
      solution: "تسجيل النشاط على Google Business وبناء استراتيجية تقييمات",
      priority: "high"
    });
  }

  // ترتيب حسب الأولوية
  return gaps.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.priority] - order[b.priority];
  }).slice(0, 6); // أقصى 6 فرص
}

// ===== Helper: توليد ملخص ذكي للمؤشرات الفارغة =====
function computeSmartScores(lead: any, websiteAnalysis: any, socialAnalyses: any[]) {
  // حساب درجة الأولوية إذا لم تكن موجودة
  let priorityScore = lead.leadPriorityScore ? Number(lead.leadPriorityScore) : null;
  if (!priorityScore) {
    let score = 50; // أساس
    if (lead.verifiedPhone) score += 10;
    if (lead.website) score += 10;
    if (lead.instagramUrl) score += 8;
    if (lead.tiktokUrl) score += 5;
    if (lead.snapchatUrl) score += 5;
    if (lead.googleMapsUrl) score += 7;
    if (lead.twitterUrl) score += 5;
    priorityScore = Math.min(score, 95);
  }

  // حساب درجة جودة البيانات
  const dataFields = [lead.verifiedPhone, lead.website, lead.instagramUrl, lead.tiktokUrl, lead.snapchatUrl, lead.googleMapsUrl, lead.twitterUrl, lead.facebookUrl];
  const filledFields = dataFields.filter(Boolean).length;
  const dataQualityScore = Math.round((filledFields / dataFields.length) * 10 * 10) / 10;

  // حساب درجة التفاعل الاجتماعي
  let socialScore = 5.0;
  if (socialAnalyses.length > 0) {
    const scores = socialAnalyses.map(s => Number(s.engagementRate || 5)).filter(s => !isNaN(s));
    if (scores.length > 0) socialScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  // مستوى الإلحاح
  const urgencyLevel = lead.urgencyLevel || (priorityScore >= 70 ? "high" : priorityScore >= 45 ? "medium" : "low");
  const urgencyLabels: Record<string, string> = { high: "عاجل", medium: "متوسط", low: "منخفض" };

  // تقييم الموقع
  const websiteScore = websiteAnalysis?.seoScore ? Number(websiteAnalysis.seoScore) : (lead.website ? 4.5 : 0);

  return {
    priorityScore: priorityScore.toFixed(1),
    dataQualityScore: dataQualityScore.toFixed(1),
    socialScore: socialScore.toFixed(1),
    websiteScore: websiteScore > 0 ? websiteScore.toFixed(1) : null,
    urgencyLevel,
    urgencyLabel: urgencyLabels[urgencyLevel] || "متوسط",
    platformsCount: dataFields.filter(Boolean).length,
  };
}

// ===== HTML Template for PDF - النسخة المحسّنة =====
// ===== Helper: بناء radar chart SVG =====
function buildRadarChart(subjects: string[], datasets: Array<{label: string; data: number[]; color: string}>): string {
  const size = 280;
  const cx = size / 2;
  const cy = size / 2;
  const r = 100;
  const n = subjects.length;
  const levels = 5;
  // نقاط المحاور
  const axes = subjects.map((_, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), angle };
  });
  // شبكة الخلفية
  let gridSvg = '';
  for (let l = 1; l <= levels; l++) {
    const rr = (r * l) / levels;
    const pts = subjects.map((_, i) => {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      return `${cx + rr * Math.cos(angle)},${cy + rr * Math.sin(angle)}`;
    }).join(' ');
    gridSvg += `<polygon points="${pts}" fill="none" stroke="#e2e8f0" stroke-width="0.8"/>`;
  }
  // خطوط المحاور
  const axisLines = axes.map(a => `<line x1="${cx}" y1="${cy}" x2="${a.x}" y2="${a.y}" stroke="#cbd5e1" stroke-width="0.8"/>`).join('');
  // تسميات المحاور
  const labels = subjects.map((s, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const lx = cx + (r + 18) * Math.cos(angle);
    const ly = cy + (r + 18) * Math.sin(angle);
    return `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" font-size="9" fill="#475569" font-family="Tajawal,sans-serif">${s}</text>`;
  }).join('');
  // مناطق البيانات
  const dataPolygons = datasets.map(ds => {
    const pts = ds.data.map((v, i) => {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      const rr = (r * Math.min(v, 10)) / 10;
      return `${cx + rr * Math.cos(angle)},${cy + rr * Math.sin(angle)}`;
    }).join(' ');
    return `<polygon points="${pts}" fill="${ds.color}33" stroke="${ds.color}" stroke-width="2" stroke-linejoin="round"/>`;
  }).join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    ${gridSvg}${axisLines}${dataPolygons}${labels}
  </svg>`;
}

function getInspirationalQuote(businessType: string): { text: string; author: string } {
  const bt = (businessType || "").toLowerCase();
  if (bt.includes("مطعم") || bt.includes("طعام") || bt.includes("كافيه") || bt.includes("مقهى") || bt.includes("حلويات"))
    return { text: "الطعام الجيد ليس مجرد وجبة — هو تجربة تستحق أن تُشارك", author: "جورج أوغست إسكوفييه" };
  if (bt.includes("عقار") || bt.includes("تطوير") || bt.includes("مقاول"))
    return { text: "الاستثمار في العقارات ليس مجرد شراء مكان — بل بناء مستقبل", author: "مبدأ الاستثمار الذكي" };
  if (bt.includes("طب") || bt.includes("صحة") || bt.includes("عيادة") || bt.includes("مستشفى"))
    return { text: "الصحة ليست كل شيء، لكن بدونها كل شيء لا يساوي شيئاً", author: "آرثر شوبنهاور" };
  if (bt.includes("تعليم") || bt.includes("تدريب") || bt.includes("أكاديمية"))
    return { text: "الاستثمار في المعرفة يدفع أفضل الفوائد دائماً", author: "بنجامين فرانكلين" };
  if (bt.includes("تقنية") || bt.includes("برمجة") || bt.includes("تكنولوجيا"))
    return { text: "التكنولوجيا تُحرك العالم، والابتكار يُعيد تشكيله", author: "مبدأ الريادة الرقمية" };
  if (bt.includes("تجميل") || bt.includes("صالون") || bt.includes("سبا"))
    return { text: "الجمال ليس في الوجه؛ الجمال نور في القلب", author: "خليل جبران" };
  if (bt.includes("ملابس") || bt.includes("أزياء") || bt.includes("موضة"))
    return { text: "الأناقة ليست ترفاً — إنها لغة تقولها قبل أن تتكلم", author: "كوكو شانيل" };
  if (bt.includes("رياضة") || bt.includes("لياقة") || bt.includes("جيم"))
    return { text: "الجسم يحقق ما يؤمن به العقل", author: "نابليون هيل" };
  const general = [
    { text: "النجاح ليس نهاية الطريق، والفشل ليس نهاية المشوار — الشجاعة هي الاستمرار", author: "ونستون تشرشل" },
    { text: "أفضل وقت لزرع شجرة كان منذ عشرين عاماً، وأفضل وقت آخر هو الآن", author: "مثل صيني" },
    { text: "لا تبنِ أحلامك على الفرص المتاحة — ابنِ الفرص لتحقيق أحلامك", author: "مبدأ ريادة الأعمال" },
    { text: "التميز في السوق لا يأتي من المنافسة — بل من إعادة تعريف قواعد اللعبة", author: "مبدأ الاستراتيجية التسويقية" },
  ];
  return general[Math.abs(Math.floor(Date.now() / 1000)) % general.length];
}

function buildPDFHtml(lead: any, websiteAnalysis: any, socialAnalyses: any[], company?: any, activeSeason?: any, upcomingSeasons?: any[], competitors?: any[], styleSettings?: any, seoAdvancedData?: any): string {
  const stageLabels: Record<string, string> = {
    new: "جديد", contacted: "تم التواصل", interested: "مهتم",
    price_offer: "عرض سعر", meeting: "اجتماع", won: "عميل فعلي", lost: "خسرناه",
  };
  const urgencyColors: Record<string, string> = { high: "#ef4444", medium: "#f59e0b", low: "#22c55e" };
  const now = new Date().toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });

  const companyName = company?.companyName || "مكسب لخدمات الأعمال";
  const companyLogo = company?.logoUrl || "";
  const companyPhone = company?.phone || "";
  const companyEmail = company?.email || "info@maksab-ksa.com";
  const companyWebsite = company?.website || "maksab-ksa.com";
  const primaryColor = company?.primaryColor || "#1a56db";
  const secondaryColor = company?.secondaryColor || "#0e9f6e";
  const reportFooterText = company?.reportFooterText || `جميع الحقوق محفوظة لـ ${companyName} ${new Date().getFullYear()}`;

  // إعدادات أسلوب الكتابة
  const styleTone = styleSettings?.tone || "professional";
  const styleKeywords: string[] = (styleSettings?.brandKeywords as string[]) || [];
  const styleClosing = styleSettings?.closingStatement || "";
  const includeSeasonSection = styleSettings?.includeSeasonSection !== false;
  const includeCompetitorsSection = styleSettings?.includeCompetitorsSection !== false;
  const detailLevel = styleSettings?.detailLevel || "standard";
  // نص الخاتمة بناءً على الإعدادات
  const closingText = styleClosing || (
    styleTone === "friendly" ? `نحن سعداء بمساعدتك في رحلة النمو الرقمي. تواصل معنا وابدأ التحول اليوم.` :
    styleTone === "direct" ? `الفرصة متاحة الآن. تواصل معنا لنبدأ فوراً.` :
    styleTone === "consultative" ? `بناءً على هذا التحليل، نوصي بجلسة عمل لوضع خطة تنفيذية مخصصة لـ ${lead.companyName}.` :
    `ما تقرأه هنا هو تشخيص أولي للوضع الرقمي. التحليل الأعمق والخطة التنفيذية المخصصة تتطلب جلسة عمل مع فريقنا.`
  );

  // توجيهات مخصصة للموسم حسب نوع النشاط
  function getSeasonBusinessGuidance(season: any, businessType: string): string {
    if (!season) return "";
    const bt = (businessType || "").toLowerCase();
    const sn = (season.name || "").toLowerCase();
    // رمضان
    if (sn.includes("رمضان")) {
      if (bt.includes("مطعم") || bt.includes("كافيه") || bt.includes("حلويات")) return `فرصة ذهبية: الطلب يرتفع 300% في رمضان. ركز على باقات السحور والإفطار والتوصيل.`;
      if (bt.includes("ملابس") || bt.includes("أزياء") || bt.includes("عبايا")) return `موسم الملابس الرمضانية والعيدية. ابدأ الحملة قبل رمضان بأسبوعين على الأقل.`;
      if (bt.includes("صالون") || bt.includes("تجميل")) return `الطلب يرتفع قبيل العيد. قدم باقات العروس وعروض الحجز المبكر.`;
      return `رمضان فرصة لزيادة الحضور الرقمي وبناء الثقة مع العملاء.`;
    }
    // اليوم الوطني
    if (sn.includes("وطني")) {
      if (bt.includes("مطعم") || bt.includes("كافيه")) return `حملات اليوم الوطني تحقق تفاعلاً عالياً. قدم عروضاً خاصة ومحتوىً وطنياً.`;
      if (bt.includes("ملابس") || bt.includes("أزياء")) return `الملابس الوطنية فرصة تسويقية ممتازة. استخدم الألوان الوطنية في محتواك.`;
      return `اليوم الوطني فرصة لحملات إبداعية تعزز الانتماء وترفع التفاعل.`;
    }
    // الصيف
    if (sn.includes("صيف")) {
      if (bt.includes("سفر") || bt.includes("سياحة") || bt.includes("فندق")) return `موسم ذروتك. ركز على الحجز المبكر والعروض الحصرية.`;
      if (bt.includes("ملابس") || bt.includes("أطفال")) return `موسم العودة للمدرسة فرصة كبيرة. ابدأ حملتك مبكراً.`;
      return `الصيف فرصة لعروض خاصة وتنشيط المبيعات.`;
    }
    // العودة للمدرسة
    if (sn.includes("مدرسة") || sn.includes("عودة")) {
      if (bt.includes("ملابس") || bt.includes("أطفال")) return `موسم العودة للمدرسة هو موسمك. ابدأ حملة الزي المدرسي قبل شهر من بداية الدراسة.`;
      if (bt.includes("تعليم") || bt.includes("دروس")) return `التسجيل للدورات يرتفع في هذا الموسم. قدم عروضاً للحجز المبكر.`;
      return `موسم العودة للمدرسة يخلق طلباً عالياً على منتجاتك.`;
    }
    // افتراضي
    return `هذا الموسم يمثل فرصة تسويقية مميزة لـ ${lead.companyName}. استغلها بحملة مخصصة.`;
  }

  // حساب المؤشرات الذكية
  const scores = computeSmartScores(lead, websiteAnalysis, socialAnalyses);
  // حساب الفرص الضائعة
  const missedOpps = computeMissedOpportunities(lead, websiteAnalysis, socialAnalyses);

  // بيانات صور العميل
  const clientLogoUrl = lead.clientLogoUrl || "";
  const placePhotos: string[] = Array.isArray(lead.placePhotos) ? lead.placePhotos.slice(0, 3) : [];
  const instaAnalysis = socialAnalyses.find(s => s.platform?.toLowerCase().includes("instagram"));
  const instaProfilePic = (instaAnalysis as any)?.profilePicUrl || "";

  // بناء بطاقات السوشيال ميديا
  const socialRows = socialAnalyses.length > 0 ? socialAnalyses.map(s => {
    // تحليل البيانات العميقة من AI
    let summaryText = "";
    let recommendationsList = "";
    try {
      if (s.summary) summaryText = typeof s.summary === "string" ? s.summary : JSON.stringify(s.summary);
      else if (s.analysisText) summaryText = String(s.analysisText).substring(0, 250);
      if (s.recommendations) {
        const recs = typeof s.recommendations === "string" ? JSON.parse(s.recommendations) : s.recommendations;
        if (Array.isArray(recs) && recs.length > 0) {
          recommendationsList = recs.slice(0, 3).map((r: any) => `<li style="margin-bottom:4px;">${typeof r === "string" ? r : r.text || r.title || JSON.stringify(r)}</li>`).join("");
        }
      }
    } catch { summaryText = s.analysisText ? String(s.analysisText).substring(0, 250) : ""; }
    return `
    <div class="social-card">
      <div class="social-header">
        <span class="social-platform-name">${s.platform}</span>
        ${s.engagementRate ? `<span class="social-score" style="background:${Number(s.engagementRate) >= 7 ? '#dcfce7' : '#fef3c7'};color:${Number(s.engagementRate) >= 7 ? '#166534' : '#92400e'};">` + `${Number(s.engagementRate).toFixed(1)}/10</span>` : ""}
      </div>
      <div class="social-stats">
        ${s.followersCount ? `<div class="stat-chip">👥 ${Number(s.followersCount).toLocaleString("ar")} متابع</div>` : ""}
        ${s.postsCount ? `<div class="stat-chip">📝 ${s.postsCount} منشور</div>` : ""}
        ${s.engagementRate ? `<div class="stat-chip">📊 ${s.engagementRate}% تفاعل</div>` : ""}
      </div>
      ${summaryText ? `<p class="social-analysis" style="margin-top:8px;">${summaryText}</p>` : ""}
      ${recommendationsList ? `<div style="margin-top:8px;"><div style="font-size:10px;font-weight:700;color:#0f172a;margin-bottom:4px;">💡 توصيات:</div><ul style="margin:0;padding-right:16px;font-size:10px;color:#334155;line-height:1.6;">${recommendationsList}</ul></div>` : ""}
    </div>
  `;
  }).join("") : `
    <div class="empty-social">
      <div style="font-size:32px;margin-bottom:8px;">📊</div>
      <div style="font-size:13px;color:#64748b;font-weight:600;">لم يتم تحليل منصات التواصل بعد</div>
      <div style="font-size:11px;color:#94a3b8;margin-top:4px;">اضغط على "تحليل العميل" لجلب بيانات المنصات</div>
    </div>
  `;

  // بناء بطاقات الفرص الضائعة
  const oppCards = missedOpps.map((opp, i) => `
    <div class="opp-card opp-${opp.priority}">
      <div class="opp-header">
        <span class="opp-icon">${opp.icon}</span>
        <div class="opp-title-wrap">
          <div class="opp-title">${opp.title}</div>
          <span class="opp-badge opp-badge-${opp.priority}">${opp.priority === 'high' ? 'أولوية عالية' : opp.priority === 'medium' ? 'أولوية متوسطة' : 'أولوية منخفضة'}</span>
        </div>
        <span class="opp-num">${i + 1}</span>
      </div>
      <p class="opp-desc">${opp.description}</p>
      <div class="opp-impact">
        <span class="impact-icon">⚠️</span>
        <span>${opp.impact}</span>
      </div>
      <div class="opp-solution">
        <span class="solution-icon">✅</span>
        <span><strong>الحل مع مكسب:</strong> ${opp.solution}</span>
      </div>
    </div>
  `).join("");

  // بناء قسم التوصيات
  const recommendations = [];
  if (!lead.website) recommendations.push({ title: "بناء موقع إلكتروني احترافي", desc: "موقع متكامل مع SEO يضعك في أول نتائج Google ويحوّل الزوار لعملاء", timeframe: "2-3 أسابيع", icon: "🌐" });
  if (!lead.instagramUrl || (instaSocial(socialAnalyses) && Number(instaSocial(socialAnalyses)?.followersCount || 0) < 1000)) recommendations.push({ title: "إدارة حسابات السوشيال ميديا", desc: "محتوى احترافي يومي على إنستغرام وتيك توك وسناب شات لبناء جمهور مخلص", timeframe: "شهري", icon: "📱" });
  if (!lead.verifiedPhone) recommendations.push({ title: "توثيق وتحسين بيانات التواصل", desc: "ضمان ظهور معلومات التواصل الصحيحة على جميع المنصات والخرائط", timeframe: "أسبوع واحد", icon: "📞" });
  recommendations.push({ title: "حملة إعلانية مستهدفة", desc: "إعلانات Google وسوشيال ميديا مستهدفة للوصول للعملاء المثاليين في " + (lead.city || "المنطقة"), timeframe: "فوري", icon: "🎯" });
  recommendations.push({ title: "تحسين التقييمات والسمعة الرقمية", desc: "استراتيجية منهجية لجمع تقييمات إيجابية وبناء ثقة العملاء الجدد", timeframe: "شهر واحد", icon: "⭐" });

  const recCards = recommendations.slice(0, 4).map((rec, i) => `
    <div class="rec-card">
      <div class="rec-num">${i + 1}</div>
      <div class="rec-icon">${rec.icon}</div>
      <div class="rec-content">
        <div class="rec-title">${rec.title}</div>
        <div class="rec-desc">${rec.desc}</div>
        <div class="rec-timeframe">⏱ ${rec.timeframe}</div>
      </div>
    </div>
  `).join("");

  // ===== قسم القناة الأكثر جدوى =====
  function detectPrimaryChannel(businessType: string, lead: any, socialAnalyses: any[]): { channel: string; icon: string; color: string; reason: string; secondaryChannels: Array<{name: string; icon: string; note: string}> } {
    const bt = (businessType || "").toLowerCase();
    const hasInsta = !!lead.instagramUrl;
    const hasTiktok = !!lead.tiktokUrl;
    const hasSnap = !!lead.snapchatUrl;
    const hasWebsite = !!lead.website;
    const instaFollowers = Number(socialAnalyses.find(s => s.platform === "instagram")?.followersCount || 0);
    // مطاعم وكافيهات
    if (bt.includes("مطعم") || bt.includes("كافيه") || bt.includes("مقهى") || bt.includes("حلويات") || bt.includes("مخبز")) {
      return { channel: "إنستغرام وتيك توك", icon: "📸", color: "#e1306c", reason: "قطاع الأغذية والمشروبات يعتمد بشكل أساسي على المحتوى المرئي الجذاب. إنستغرام وتيك توك هما الأعلى تحويلاً للزوار إلى عملاء فعليين في هذا القطاع بالسوق السعودي.", secondaryChannels: [{name: "سناب شات", icon: "👻", note: "للعروض اليومية"}, {name: "Google Maps", icon: "📍", note: "للظهور في البحث المحلي"}] };
    }
    // صالونات وعيادات
    if (bt.includes("صالون") || bt.includes("عيادة") || bt.includes("طبي") || bt.includes("صحة") || bt.includes("تجميل")) {
      return { channel: "إنستغرام", icon: "📸", color: "#e1306c", reason: "الخدمات الشخصية والجمالية تعتمد على الثقة والمحتوى البصري. إنستغرام هو المنصة الأعلى تحويلاً لهذا القطاع مع إمكانية الحجز المباشر عبر الرابط في البايو.", secondaryChannels: [{name: "واتساب بيزنس", icon: "💬", note: "للحجوزات المباشرة"}, {name: "Google Maps", icon: "📍", note: "للتقييمات والظهور المحلي"}] };
    }
    // تعليم ودروس
    if (bt.includes("تعليم") || bt.includes("دروس") || bt.includes("أكاديمية") || bt.includes("تدريب")) {
      return { channel: "يوتيوب وإنستغرام", icon: "🎓", color: "#ff0000", reason: "قطاع التعليم يستفيد من المحتوى التعليمي الطويل على يوتيوب لبناء الثقة، مع إنستغرام للتواصل اليومي وعرض النتائج والشهادات.", secondaryChannels: [{name: "تيك توك", icon: "🎵", note: "لمقاطع تعليمية قصيرة"}, {name: "لينكدإن", icon: "💼", note: "للدورات المهنية"}] };
    }
    // عقارات
    if (bt.includes("عقار") || bt.includes("مكتب عقاري") || bt.includes("شاليه") || bt.includes("فندق")) {
      return { channel: "إنستغرام وGoogle", icon: "🏠", color: "#4285f4", reason: "قطاع العقارات يعتمد على المحتوى البصري الاحترافي وإعلانات Google المستهدفة. المشترون يبدأون رحلتهم بالبحث على Google ثم يتحققون من المصداقية عبر إنستغرام.", secondaryChannels: [{name: "يوتيوب", icon: "▶️", note: "لجولات افتراضية"}, {name: "واتساب", icon: "💬", note: "للتواصل المباشر"}] };
    }
    // ملابس وأزياء
    if (bt.includes("ملابس") || bt.includes("أزياء") || bt.includes("عبايات") || bt.includes("مجوهرات") || bt.includes("عطور")) {
      return { channel: "إنستغرام وسناب شات", icon: "👗", color: "#e1306c", reason: "قطاع الأزياء والموضة يعتمد بشكل كامل على المنصات البصرية. إنستغرام للمحتوى الاحترافي وسناب شات للوصول إلى الجمهور السعودي الشاب.", secondaryChannels: [{name: "تيك توك", icon: "🎵", note: "لمحتوى الترند"}, {name: "الموقع الإلكتروني", icon: "🌐", note: "للمتجر الإلكتروني"}] };
    }
    // خدمات B2B
    if (bt.includes("محاسب") || bt.includes("محامي") || bt.includes("استشار") || bt.includes("برمجة") || bt.includes("تقنية")) {
      return { channel: "لينكدإن والموقع الإلكتروني", icon: "💼", color: "#0077b5", reason: "الخدمات المهنية وB2B تعتمد على بناء المصداقية والخبرة. لينكدإن هو المنصة الأعلى جودة للوصول إلى صناع القرار، مع موقع إلكتروني احترافي يعزز الثقة.", secondaryChannels: [{name: "تويتر/X", icon: "🐦", note: "للقيادة الفكرية"}, {name: "Google Ads", icon: "🔍", note: "للاستهداف المحدد"}] };
    }
    // افتراضي
    return { channel: "إنستغرام", icon: "📸", color: "#e1306c", reason: "بناءً على طبيعة النشاط والجمهور المستهدف في السوق السعودي، إنستغرام يمثل القناة الأعلى وصولاً وتحويلاً للعملاء المحتملين في هذه المرحلة.", secondaryChannels: [{name: "سناب شات", icon: "👻", note: "للجمهور الشاب"}, {name: "Google Maps", icon: "📍", note: "للبحث المحلي"}] };
  }
  const primaryChannel = detectPrimaryChannel(lead.businessType || "", lead, socialAnalyses);

  // ===== QR Code لواتساب =====
  const waPhone = (companyPhone || "").replace(/[^0-9]/g, "");
  const waNumber = waPhone.startsWith("966") ? waPhone : waPhone.startsWith("0") ? "966" + waPhone.slice(1) : "966" + waPhone;
  const waMessage = encodeURIComponent(`مرحباً، اطلعت على التقرير الخاص بـ ${lead.companyName} وأود الاستفسار عن خطة التنفيذ المخصصة`);
  const waLink = `https://wa.me/${waNumber}?text=${waMessage}`;
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(waLink)}&bgcolor=ffffff&color=128C7E&margin=4`;

  // بناء قسم المنصات المتاحة
  const platforms = [
    { name: "إنستغرام", url: lead.instagramUrl, icon: "📸", color: "#e1306c" },
    { name: "تيك توك", url: lead.tiktokUrl, icon: "🎵", color: "#010101" },
    { name: "سناب شات", url: lead.snapchatUrl, icon: "👻", color: "#fffc00" },
    { name: "تويتر/X", url: lead.twitterUrl, icon: "🐦", color: "#1da1f2" },
    { name: "فيسبوك", url: lead.facebookUrl, icon: "👤", color: "#1877f2" },
    { name: "لينكدإن", url: lead.linkedinUrl, icon: "💼", color: "#0077b5" },
    { name: "Google Maps", url: lead.googleMapsUrl, icon: "📍", color: "#4285f4" },
    { name: "الموقع", url: lead.website, icon: "🌐", color: "#6366f1" },
  ];
  const activePlatforms = platforms.filter(p => p.url);
  const missingPlatforms = platforms.filter(p => !p.url);

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif;
    background: #f1f5f9;
    color: #1e293b;
    direction: rtl;
    font-size: 13px;
    line-height: 1.6;
  }

  /* ===== الصفحة ===== */
  .page { width: 210mm; background: white; margin: 0 auto; position: relative; page-break-after: always; }
  .page:last-child { page-break-after: avoid; }

  /* ===== الهيدر ===== */
  .header {
    background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, ${primaryColor} 100%);
    color: white;
    padding: 28px 36px 20px;
    position: relative;
    overflow: hidden;
  }
  .header::before {
    content: '';
    position: absolute;
    top: -40px; left: -40px;
    width: 200px; height: 200px;
    background: rgba(255,255,255,0.03);
    border-radius: 50%;
  }
  .header::after {
    content: '';
    position: absolute;
    bottom: -60px; right: -20px;
    width: 250px; height: 250px;
    background: rgba(255,255,255,0.02);
    border-radius: 50%;
  }
  .header-top { display: flex; justify-content: space-between; align-items: flex-start; position: relative; z-index: 1; }
  .company-info { display: flex; align-items: center; gap: 14px; }
  .company-logo { width: 52px; height: 52px; object-fit: contain; border-radius: 10px; background: rgba(255,255,255,0.1); padding: 4px; }
  .company-name { font-size: 22px; font-weight: 800; margin-bottom: 3px; }
  .company-meta { font-size: 11px; opacity: 0.7; }
  .report-badge {
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 10px;
    padding: 10px 16px;
    text-align: center;
    font-size: 11px;
  }
  .report-badge strong { display: block; font-size: 13px; margin-bottom: 3px; }

  /* ===== شريط العميل ===== */
  .client-bar {
    background: #0a0f1e;
    padding: 10px 36px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 3px solid ${primaryColor};
  }
  .client-name { font-size: 18px; font-weight: 800; color: white; }
  .client-meta { font-size: 11px; color: rgba(255,255,255,0.5); }

  /* ===== شريط المؤشرات ===== */
  .scores-row { display: flex; background: #0f172a; }
  .score-item { flex: 1; padding: 14px 10px; text-align: center; border-left: 1px solid rgba(255,255,255,0.06); }
  .score-item:last-child { border-left: none; }
  .score-value { font-size: 20px; font-weight: 800; color: ${secondaryColor}; }
  .score-label { font-size: 9px; color: rgba(255,255,255,0.45); margin-top: 2px; letter-spacing: 0.3px; }

  /* ===== المحتوى ===== */
  .body { padding: 24px 36px; }
  .section { margin-bottom: 22px; }
  .section-title {
    font-size: 13px; font-weight: 800; color: #0f172a;
    border-right: 4px solid ${primaryColor};
    padding: 6px 12px; margin-bottom: 14px;
    background: #f8fafc;
    border-radius: 0 8px 8px 0;
    display: flex; align-items: center; gap: 8px;
  }

  /* ===== شبكة المعلومات ===== */
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .info-item { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 9px 12px; }
  .info-label { font-size: 9px; color: #94a3b8; margin-bottom: 2px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
  .info-value { font-size: 12px; color: #1e293b; font-weight: 700; }
  .info-value a { color: ${primaryColor}; text-decoration: none; }

  /* ===== بطاقات التحليل ===== */
  .analysis-box { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 10px; padding: 12px 14px; margin-bottom: 10px; }
  .analysis-box-title { font-size: 10px; font-weight: 800; color: #0369a1; margin-bottom: 6px; display: flex; align-items: center; gap: 6px; }
  .analysis-box p { font-size: 11px; color: #334155; line-height: 1.7; }
  .ice-box { background: #ecfdf5; border-color: #6ee7b7; }
  .ice-box .analysis-box-title { color: #065f46; }
  .ice-box p { color: #064e3b; font-weight: 600; }
  .sales-box { background: #fef3c7; border-color: #fbbf24; }
  .sales-box .analysis-box-title { color: #92400e; }
  .sales-box p { color: #78350f; font-weight: 600; }
  .gap-box { background: #fef2f2; border-color: #fca5a5; }
  .gap-box .analysis-box-title { color: #991b1b; }
  .gap-box p { color: #7f1d1d; }

  /* ===== المنصات ===== */
  .platforms-grid { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
  .platform-chip {
    display: flex; align-items: center; gap: 5px;
    padding: 5px 10px; border-radius: 20px;
    font-size: 10px; font-weight: 700;
    border: 1px solid;
  }
  .platform-chip.active { background: #ecfdf5; border-color: #6ee7b7; color: #065f46; }
  .platform-chip.missing { background: #fef2f2; border-color: #fca5a5; color: #991b1b; opacity: 0.8; }

  /* ===== السوشيال ميديا ===== */
  .social-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .social-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; }
  .social-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .social-platform-name { font-size: 12px; font-weight: 800; color: #1e293b; text-transform: capitalize; }
  .social-score { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 12px; }
  .social-stats { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 7px; }
  .stat-chip { font-size: 10px; background: #e2e8f0; padding: 2px 7px; border-radius: 10px; color: #475569; }
  .social-analysis { font-size: 10px; color: #64748b; line-height: 1.6; }
  .empty-social { text-align: center; padding: 24px; background: #f8fafc; border-radius: 10px; border: 1px dashed #cbd5e1; }

  /* ===== الفرص الضائعة ===== */
  .opp-card {
    border-radius: 10px;
    padding: 14px 16px;
    margin-bottom: 10px;
    border-right: 4px solid;
    position: relative;
  }
  .opp-high { background: #fef2f2; border-color: #ef4444; }
  .opp-medium { background: #fffbeb; border-color: #f59e0b; }
  .opp-low { background: #f0fdf4; border-color: #22c55e; }
  .opp-header { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 8px; }
  .opp-icon { font-size: 20px; flex-shrink: 0; margin-top: 2px; }
  .opp-title-wrap { flex: 1; }
  .opp-title { font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 3px; }
  .opp-badge { font-size: 9px; font-weight: 700; padding: 2px 8px; border-radius: 10px; }
  .opp-badge-high { background: #fee2e2; color: #991b1b; }
  .opp-badge-medium { background: #fef3c7; color: #92400e; }
  .opp-badge-low { background: #dcfce7; color: #166534; }
  .opp-num { font-size: 22px; font-weight: 900; color: rgba(0,0,0,0.08); flex-shrink: 0; }
  .opp-desc { font-size: 11px; color: #334155; line-height: 1.7; margin-bottom: 8px; }
  .opp-impact { display: flex; align-items: flex-start; gap: 6px; font-size: 10px; color: #7f1d1d; background: rgba(239,68,68,0.08); padding: 6px 10px; border-radius: 6px; margin-bottom: 6px; }
  .opp-solution { display: flex; align-items: flex-start; gap: 6px; font-size: 10px; color: #065f46; background: rgba(34,197,94,0.08); padding: 6px 10px; border-radius: 6px; }
  .impact-icon, .solution-icon { flex-shrink: 0; }

  /* ===== التوصيات ===== */
  .rec-card {
    display: flex; align-items: flex-start; gap: 12px;
    background: white; border: 1px solid #e2e8f0;
    border-radius: 10px; padding: 14px;
    margin-bottom: 10px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }
  .rec-num { font-size: 28px; font-weight: 900; color: ${primaryColor}22; flex-shrink: 0; line-height: 1; width: 32px; }
  .rec-icon { font-size: 22px; flex-shrink: 0; }
  .rec-content { flex: 1; }
  .rec-title { font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 4px; }
  .rec-desc { font-size: 11px; color: #475569; line-height: 1.6; margin-bottom: 6px; }
  .rec-timeframe { font-size: 10px; color: ${primaryColor}; font-weight: 700; }

  /* ===== CTA ===== */
  .cta-section {
    background: linear-gradient(135deg, #0f172a 0%, ${primaryColor} 100%);
    border-radius: 14px;
    padding: 28px 32px;
    text-align: center;
    color: white;
    margin-top: 20px;
  }
  .cta-title { font-size: 20px; font-weight: 900; margin-bottom: 8px; }
  .cta-subtitle { font-size: 12px; opacity: 0.8; margin-bottom: 20px; line-height: 1.7; }
  .cta-buttons { display: flex; justify-content: center; gap: 12px; flex-wrap: wrap; }
  .cta-btn {
    padding: 10px 20px; border-radius: 8px;
    font-size: 12px; font-weight: 700;
    text-decoration: none;
  }
  .cta-btn-primary { background: white; color: ${primaryColor}; }
  .cta-btn-secondary { background: rgba(255,255,255,0.15); color: white; border: 1px solid rgba(255,255,255,0.3); }

  /* ===== الفوتر ===== */
  .footer {
    background: #0f172a; color: rgba(255,255,255,0.45);
    padding: 12px 36px; display: flex; justify-content: space-between;
    align-items: center; font-size: 9px;
    border-top: 2px solid ${primaryColor}55;
  }
  .footer-brand { color: rgba(255,255,255,0.75); font-weight: 700; font-size: 11px; }
  .footer-watermark { font-size: 8px; opacity: 0.4; font-style: italic; }

  /* ===== الشبكة ===== */
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .score-bar-row { display: flex; align-items: center; gap: 8px; margin-bottom: 7px; }
  .score-bar-label { font-size: 10px; color: #64748b; width: 110px; flex-shrink: 0; }
  .score-bar-track { flex: 1; height: 5px; background: #e2e8f0; border-radius: 3px; overflow: hidden; }
  .score-bar-fill { height: 100%; border-radius: 3px; background: linear-gradient(90deg, ${primaryColor}, ${secondaryColor}); }
  .score-bar-value { font-size: 10px; font-weight: 700; color: #1e293b; width: 28px; text-align: left; }

  /* ===== الطباعة ===== */
  @media print {
    .page { page-break-after: always; }
    .page:last-child { page-break-after: avoid; }
  }
</style>
</head>
<body>

<!-- ===== الصفحة 1: غلاف فاخر ===== -->
<div class="page" style="background:#0a0f1e;min-height:297mm;display:flex;flex-direction:column;position:relative;overflow:hidden;">
  <!-- خلفية فاخرة: دوائر ضوئية وتأثيرات ذهبية -->
  <div style="position:absolute;top:-80px;right:-80px;width:400px;height:400px;background:radial-gradient(circle,rgba(212,175,55,0.12) 0%,transparent 70%);border-radius:50%;pointer-events:none;"></div>
  <div style="position:absolute;bottom:-100px;left:-100px;width:500px;height:500px;background:radial-gradient(circle,rgba(99,102,241,0.1) 0%,transparent 70%);border-radius:50%;pointer-events:none;"></div>
  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:600px;height:600px;background:radial-gradient(circle,rgba(30,58,95,0.3) 0%,transparent 70%);border-radius:50%;pointer-events:none;"></div>
  <!-- خطوط ذهبية زخرفية -->
  <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,#d4af37,#f5e27a,#d4af37,transparent);"></div>
  <div style="position:absolute;bottom:0;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,#d4af37,#f5e27a,#d4af37,transparent);"></div>
  <div style="position:absolute;top:0;right:0;bottom:0;width:3px;background:linear-gradient(180deg,transparent,#d4af37,#f5e27a,#d4af37,transparent);"></div>
  <div style="position:absolute;top:0;left:0;bottom:0;width:3px;background:linear-gradient(180deg,transparent,#d4af37,#f5e27a,#d4af37,transparent);"></div>

  <!-- شعار الشركة في الأعلى -->
  <div style="position:relative;z-index:2;padding:28px 48px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(212,175,55,0.15);">
    <div style="display:flex;align-items:center;gap:12px;">
      ${companyLogo ? `<img src="${companyLogo}" style="width:44px;height:44px;object-fit:contain;border-radius:8px;background:rgba(255,255,255,0.05);padding:4px;" alt="شعار" onerror="this.style.display='none'">` : `<div style="width:44px;height:44px;background:linear-gradient(135deg,#d4af37,#f5e27a);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:20px;">✦</div>`}
      <div>
        <div style="font-size:15px;font-weight:800;color:#f5e27a;letter-spacing:1px;">${companyName}</div>
        <div style="font-size:9px;color:rgba(212,175,55,0.6);letter-spacing:2px;text-transform:uppercase;">استشارات تسويقية متخصصة</div>
      </div>
    </div>
    <div style="text-align:left;">
      <div style="font-size:9px;color:rgba(255,255,255,0.3);letter-spacing:1px;text-transform:uppercase;">CONFIDENTIAL REPORT</div>
      <div style="font-size:10px;color:rgba(212,175,55,0.7);margin-top:3px;">${now}</div>
    </div>
  </div>

  <!-- المحتوى الرئيسي للغلاف -->
  <div style="position:relative;z-index:2;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 60px;text-align:center;">
    <!-- شعار العميل -->
    ${(clientLogoUrl || instaProfilePic) ? `
    <div style="margin-bottom:28px;">
      <div style="width:110px;height:110px;border-radius:50%;border:3px solid rgba(212,175,55,0.5);padding:6px;background:rgba(255,255,255,0.04);margin:0 auto;box-shadow:0 0 40px rgba(212,175,55,0.2);">
        <img src="${clientLogoUrl || instaProfilePic}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" alt="شعار العميل" onerror="this.style.display='none'">
      </div>
    </div>` : `
    <div style="margin-bottom:28px;">
      <div style="width:90px;height:90px;border-radius:50%;border:2px solid rgba(212,175,55,0.4);background:linear-gradient(135deg,rgba(212,175,55,0.1),rgba(99,102,241,0.1));margin:0 auto;display:flex;align-items:center;justify-content:center;font-size:36px;box-shadow:0 0 40px rgba(212,175,55,0.15);">
        ${lead.businessType?.includes('مطعم') || lead.businessType?.includes('طعام') ? '🍽️' : lead.businessType?.includes('عياد') || lead.businessType?.includes('طب') ? '🏥' : lead.businessType?.includes('فندق') ? '🏨' : '🏢'}
      </div>
    </div>`}

    <!-- نوع التقرير -->
    <div style="display:inline-flex;align-items:center;gap:8px;background:rgba(212,175,55,0.1);border:1px solid rgba(212,175,55,0.3);border-radius:30px;padding:6px 20px;margin-bottom:20px;">
      <span style="width:6px;height:6px;background:#d4af37;border-radius:50%;display:inline-block;"></span>
      <span style="font-size:10px;color:#d4af37;letter-spacing:2px;text-transform:uppercase;font-weight:700;">تقرير تحليل تسويقي شامل</span>
      <span style="width:6px;height:6px;background:#d4af37;border-radius:50%;display:inline-block;"></span>
    </div>

    <!-- اسم العميل -->
    <h1 style="font-size:38px;font-weight:900;color:white;margin-bottom:10px;line-height:1.2;text-shadow:0 0 40px rgba(212,175,55,0.3);">${lead.companyName}</h1>
    <div style="font-size:14px;color:rgba(212,175,55,0.8);margin-bottom:32px;letter-spacing:1px;">${[lead.businessType, lead.city].filter(Boolean).join(" · ")}</div>

    <!-- خط فاصل ذهبي -->
    <div style="width:80px;height:2px;background:linear-gradient(90deg,transparent,#d4af37,transparent);margin:0 auto 32px;"></div>

    <!-- المقدمة الاحترافية -->
    <div style="max-width:520px;margin:0 auto 36px;">
      <p style="font-size:13.5px;color:rgba(255,255,255,0.75);line-height:2;font-weight:400;">
        يسعدنا تقديم هذا التقرير التحليلي المُعدّ خصيصاً لـ <strong style="color:rgba(212,175,55,0.9);">${lead.companyName}</strong>،
        والذي يتضمن تشخيصاً أولياً للحضور الرقمي، وتحليلاً للفرص التسويقية المرصودة،
        وتوصيات استراتيجية لتعزيز النمو الرقمي. هذا التقرير تحليلي أولي وقد لا يعكس الصورة الكاملة للنشاط.
      </p>
      <p style="font-size:10.5px;color:rgba(255,255,255,0.4);line-height:1.8;font-weight:400;margin-top:8px;font-style:italic;">
        تنبيه: الجوانب غير المرصودة قد تكون موجودةً ولم تُكتشف — التقديرات الواردة أولية وتستند إلى معطيات السوق العامة.
      </p>
    </div>

    <!-- مؤشرات الدرجات بتصميم فاخر -->
    <div style="display:flex;gap:16px;justify-content:center;margin-bottom:36px;flex-wrap:wrap;">
      <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(212,175,55,0.2);border-radius:14px;padding:16px 22px;min-width:100px;text-align:center;">
        <div style="font-size:28px;font-weight:900;color:#d4af37;">${scores.priorityScore}</div>
        <div style="font-size:9px;color:rgba(255,255,255,0.4);margin-top:4px;letter-spacing:0.5px;">درجة الأولوية</div>
      </div>
      <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(99,102,241,0.3);border-radius:14px;padding:16px 22px;min-width:100px;text-align:center;">
        <div style="font-size:28px;font-weight:900;color:#818cf8;">${scores.socialScore}<span style="font-size:14px;color:rgba(255,255,255,0.3);">/10</span></div>
        <div style="font-size:9px;color:rgba(255,255,255,0.4);margin-top:4px;letter-spacing:0.5px;">التفاعل الاجتماعي</div>
      </div>
      <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(96,165,250,0.3);border-radius:14px;padding:16px 22px;min-width:100px;text-align:center;">
        <div style="font-size:28px;font-weight:900;color:#60a5fa;">${scores.platformsCount}<span style="font-size:14px;color:rgba(255,255,255,0.3);">/8</span></div>
        <div style="font-size:9px;color:rgba(255,255,255,0.4);margin-top:4px;letter-spacing:0.5px;">منصة مفعّلة</div>
      </div>
      <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(${scores.urgencyLevel === 'high' ? '239,68,68' : scores.urgencyLevel === 'medium' ? '245,158,11' : '34,197,94'},0.3);border-radius:14px;padding:16px 22px;min-width:100px;text-align:center;">
        <div style="font-size:22px;font-weight:900;color:${urgencyColors[scores.urgencyLevel]};">${scores.urgencyLabel}</div>
        <div style="font-size:9px;color:rgba(255,255,255,0.4);margin-top:4px;letter-spacing:0.5px;">مستوى الإلحاح</div>
      </div>
    </div>

    <!-- الاقتباس الاحترافي -->
    ${(() => { const q = getInspirationalQuote(lead.businessType || ""); return `
    <div style="max-width:480px;margin:0 auto;padding:20px 28px;border:1px solid rgba(212,175,55,0.2);border-radius:12px;background:rgba(212,175,55,0.04);">
      <div style="font-size:28px;color:rgba(212,175,55,0.3);line-height:1;margin-bottom:8px;">&#8220;</div>
      <div style="font-size:12px;color:rgba(255,255,255,0.65);line-height:1.9;font-style:italic;margin-bottom:10px;">${q.text}</div>
      <div style="font-size:10px;color:rgba(212,175,55,0.6);font-weight:600;">— ${q.author}</div>
    </div>`; })()}
  </div>

  <!-- فوتر الغلاف -->
  <div style="position:relative;z-index:2;padding:20px 48px;border-top:1px solid rgba(212,175,55,0.15);display:flex;justify-content:space-between;align-items:center;">
    <div style="font-size:9px;color:rgba(255,255,255,0.25);letter-spacing:1px;">حصري من ${companyName} · CONFIDENTIAL</div>
    <div style="display:flex;align-items:center;gap:6px;">
      <div style="width:4px;height:4px;background:#d4af37;border-radius:50%;"></div>
      <div style="font-size:9px;color:rgba(212,175,55,0.5);">صفحة 1</div>
      <div style="width:4px;height:4px;background:#d4af37;border-radius:50%;"></div>
    </div>
    <div style="font-size:9px;color:rgba(255,255,255,0.25);">${now}</div>
  </div>
</div>

<!-- ===== الصفحة 2: ملخص النشاط والحضور الرقمي ===== -->
<div class="page">
  <div class="header">
    <div class="header-top">
      <div class="company-info">
        ${companyLogo ? `<img src="${companyLogo}" class="company-logo" alt="شعار">` : `<div style="width:52px;height:52px;background:rgba(255,255,255,0.15);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:22px;">🏢</div>`}
        <div>
          <div class="company-name">${companyName}</div>
          <div class="company-meta">${[companyPhone, companyEmail, companyWebsite].filter(Boolean).join(" · ")}</div>
        </div>
      </div>
      <div class="report-badge">
        <strong>ملخص النشاط التجاري</strong>
        ${now}
        <div style="font-size:9px;opacity:0.6;margin-top:3px;">حصري من مكسب</div>
      </div>
    </div>
  </div>

  <div class="client-bar">
    <div>
      <div class="client-name">${lead.companyName}</div>
      <div class="client-meta">${[lead.businessType, lead.city, lead.district].filter(Boolean).join(" · ")}</div>
    </div>
    <div style="display:flex;gap:8px;align-items:center;">
      <div style="text-align:center;background:rgba(255,255,255,0.05);padding:6px 12px;border-radius:8px;">
        <div style="font-size:16px;font-weight:800;color:${urgencyColors[scores.urgencyLevel]};">${scores.urgencyLabel}</div>
        <div style="font-size:9px;color:rgba(255,255,255,0.4);">مستوى الإلحاح</div>
      </div>
      <div style="text-align:center;background:rgba(255,255,255,0.05);padding:6px 12px;border-radius:8px;">
        <div style="font-size:16px;font-weight:800;color:#60a5fa;">${scores.platformsCount}/8</div>
        <div style="font-size:9px;color:rgba(255,255,255,0.4);">منصة مفعّلة</div>
      </div>
    </div>
  </div>

  <div class="scores-row">
    <div class="score-item">
      <div class="score-value">${scores.priorityScore}</div>
      <div class="score-label">درجة الأولوية</div>
    </div>
    <div class="score-item">
      <div class="score-value">${scores.dataQualityScore}</div>
      <div class="score-label">جودة البيانات /10</div>
    </div>
    <div class="score-item">
      <div class="score-value">${scores.socialScore}</div>
      <div class="score-label">التفاعل الاجتماعي /10</div>
    </div>
    <div class="score-item">
      <div class="score-value" style="color:${scores.websiteScore ? '#60a5fa' : '#94a3b8'};">${scores.websiteScore ? scores.websiteScore + '/10' : 'لم يُرصد'}</div>
      <div class="score-label">تقييم الموقع</div>
    </div>
  </div>

  <div class="body">
    <!-- معلومات النشاط -->
    <div class="section">
      <div class="section-title">📋 معلومات النشاط التجاري</div>
      <div class="info-grid">
        <div class="info-item"><div class="info-label">رقم الهاتف</div><div class="info-value">${lead.verifiedPhone || "غير متوفر"}</div></div>
        <div class="info-item"><div class="info-label">الموقع الإلكتروني</div><div class="info-value">${lead.website ? `<a href="${lead.website}">${lead.website}</a>` : "غير متوفر"}</div></div>
        <div class="info-item"><div class="info-label">مرحلة العميل</div><div class="info-value">${stageLabels[lead.stage] || lead.stage || "جديد"}</div></div>
        <div class="info-item"><div class="info-label">تاريخ الإضافة</div><div class="info-value">${lead.createdAt ? new Date(lead.createdAt).toLocaleDateString("ar-SA") : now}</div></div>
      </div>
    </div>

    <!-- الحضور الرقمي -->
    <div class="section">
      <div class="section-title">🌐 الحضور الرقمي</div>
      <div style="margin-bottom:8px;font-size:11px;color:#64748b;">المنصات المفعّلة (${activePlatforms.length}/${platforms.length})</div>
      <div class="platforms-grid">
        ${activePlatforms.map(p => `<div class="platform-chip active">${p.icon} ${p.name}</div>`).join("")}
        ${missingPlatforms.map(p => `<div class="platform-chip missing">${p.icon} ${p.name} — غائب</div>`).join("")}
      </div>
    </div>

    <!-- صور العميل (Google Maps + Instagram) -->
    ${(placePhotos.length > 0 || clientLogoUrl || instaProfilePic) ? `
    <div class="section">
      <div class="section-title">📸 معرض الصور</div>
      <div style="display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap;">
        ${(clientLogoUrl || instaProfilePic) ? `
        <div style="text-align:center;">
          <img src="${clientLogoUrl || instaProfilePic}" style="width:80px;height:80px;border-radius:12px;object-fit:cover;border:2px solid #e2e8f0;" alt="شعار العميل" onerror="this.style.display='none'" />
          <div style="font-size:9px;color:#94a3b8;margin-top:4px;">شعار النشاط</div>
        </div>` : ""}
        ${placePhotos.map((photoUrl, idx) => `
        <div style="text-align:center;">
          <img src="${photoUrl}" style="width:${idx === 0 ? '140px' : '100px'};height:${idx === 0 ? '100px' : '80px'};border-radius:10px;object-fit:cover;border:1.5px solid #e2e8f0;" alt="صورة المكان" onerror="this.style.display='none'" />
          <div style="font-size:9px;color:#94a3b8;margin-top:4px;">Google Maps</div>
        </div>
        `).join("")}
      </div>
    </div>` : ""}

    <!-- التحليل الذكي -->
    ${(lead.biggestMarketingGap || lead.revenueOpportunity || lead.suggestedSalesEntryAngle || lead.marketingGapSummary || lead.primaryOpportunity) ? `
    <div class="section">
      <div class="section-title">📊 التحليل التسويقي الذكي</div>
      ${(lead.biggestMarketingGap || lead.marketingGapSummary) ? `<div class="analysis-box gap-box"><div class="analysis-box-title">⚠️ أكبر ثغرة تسويقية</div><p>${lead.biggestMarketingGap || lead.marketingGapSummary}</p></div>` : ""}
      ${(lead.revenueOpportunity || lead.primaryOpportunity) ? `<div class="analysis-box"><div class="analysis-box-title">💰 فرصة الإيراد</div><p>${lead.revenueOpportunity || lead.primaryOpportunity}</p></div>` : ""}
      ${lead.suggestedSalesEntryAngle ? `<div class="analysis-box" style="border-right:3px solid #0ea5e9;"><div class="analysis-box-title" style="color:#0369a1;">🎯 زاوية الدخول البيعية</div><p>${lead.suggestedSalesEntryAngle}</p></div>` : ""}
    </div>` : `
    <div class="section">
      <div class="section-title">📊 التحليل الأولي</div>
      <div class="analysis-box">
        <div class="analysis-box-title">📊 ملاحظات أولية</div>
        <p>${lead.companyName} نشاط تجاري في قطاع ${lead.businessType || "الأعمال"} بمدينة ${lead.city || "الرياض"}. بناءً على المسح الأولي، رُصد حضور رقمي على ${activePlatforms.length} منصة من أصل ${platforms.length} منصة رئيسية — المنصات غير المرصودة قد تكون موجودةً ولم تُكتشف. ${lead.verifiedPhone ? 'رقم الهاتف متوفر مما يسهل التواصل المباشر.' : 'لم يُرصد رقم هاتف موثق — توثيقه يسهّل التواصل مع العملاء.'} ${lead.website ? 'يملك موقعاً إلكترونياً يحتاج لتقييم SEO.' : 'لم يُرصد موقع إلكتروني — قد يكون موجوداً بمسمى مختلف أو يمثل فرصة للتطوير.'}</p>
      </div>
    </div>`}

    <!-- ملخص الفرص التسويقية والتطور المتوقع -->
    ${(lead.marketingOpportunitiesSummary || lead.growthDevelopmentPlan) ? `
    <div class="section" style="margin-top:14px;">
      <div class="section-title" style="color:#0f172a;font-size:13px;font-weight:700;border-bottom:2px solid #6366f1;padding-bottom:6px;margin-bottom:12px;">🚀 ملخص الفرص التسويقية والتطور المتوقع</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        ${lead.marketingOpportunitiesSummary ? `
        <div style="background:linear-gradient(135deg,#f0fdf4 0%,#dcfce7 100%);border:1.5px solid #86efac;border-radius:10px;padding:14px;position:relative;overflow:hidden;">
          <div style="position:absolute;top:0;right:0;width:4px;height:100%;background:linear-gradient(180deg,#22c55e,#16a34a);"></div>
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
            <span style="font-size:16px;">📈</span>
            <span style="font-size:11px;font-weight:700;color:#15803d;">الفرص التسويقية المتاحة</span>
          </div>
          <p style="font-size:10.5px;color:#166534;line-height:1.7;margin:0;">${lead.marketingOpportunitiesSummary}</p>
        </div>` : ""}
        ${lead.growthDevelopmentPlan ? `
        <div style="background:linear-gradient(135deg,#eff6ff 0%,#dbeafe 100%);border:1.5px solid #93c5fd;border-radius:10px;padding:14px;position:relative;overflow:hidden;">
          <div style="position:absolute;top:0;right:0;width:4px;height:100%;background:linear-gradient(180deg,#3b82f6,#1d4ed8);"></div>
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
            <span style="font-size:16px;">🔮</span>
            <span style="font-size:11px;font-weight:700;color:#1d4ed8;">خطة التطور والنمو المتوقع</span>
          </div>
          <p style="font-size:10.5px;color:#1e40af;line-height:1.7;margin:0;">${lead.growthDevelopmentPlan}</p>
        </div>` : ""}
      </div>
      <div style="margin-top:10px;padding:8px 12px;background:#fafafa;border:1px dashed #cbd5e1;border-radius:8px;font-size:9.5px;color:#64748b;text-align:center;">
        ⚡ هذا التحليل مبني على دراسة السوق المحلي في ${lead.city || "المملكة العربية السعودية"} وبيانات القطاع · ${new Date().toLocaleDateString("ar-SA", { year: "numeric", month: "long" })}
      </div>
    </div>` : ""}
  </div>

  <div class="footer">
    <div class="footer-brand">${companyName}</div>
    <div>${reportFooterText} · صفحة 2</div>
    <div class="footer-watermark">حصري من شركة مكسب · CONFIDENTIAL</div>
  </div>
</div>

<!-- ===== الصفحة 3: التحليل الرقمي التفصيلي ===== -->
<div class="page">
  <div class="header" style="padding:18px 36px;">
    <div class="header-top">
      <div class="company-info">
        ${companyLogo ? `<img src="${companyLogo}" class="company-logo" alt="شعار" style="width:38px;height:38px;">` : ""}
        <div>
          <div style="font-size:16px;font-weight:800;">${companyName}</div>
          <div style="font-size:10px;opacity:0.6;">التحليل الرقمي التفصيلي</div>
        </div>
      </div>
      <div style="font-size:11px;opacity:0.7;">${lead.companyName} · ${now}</div>
    </div>
  </div>

  <div class="body">
    <!-- تحليل الموقع الإلكتروني -->
    <div class="section">
      <div class="section-title">🌐 تحليل الموقع الإلكتروني</div>
      ${websiteAnalysis ? `
        <!-- Screenshot الموقع -->
        ${ (websiteAnalysis as any).screenshotUrl ? `
        <div style="margin-bottom:14px;border-radius:12px;overflow:hidden;border:2px solid #e2e8f0;box-shadow:0 4px 16px rgba(0,0,0,0.08);">
          <div style="background:#f8fafc;padding:6px 12px;font-size:10px;font-weight:700;color:#64748b;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:6px;">
            <span>🖥️</span>
            <span>لقطة شاشة حقيقية للموقع</span>
            <span style="margin-right:auto;font-weight:400;color:#94a3b8;">${lead.website || ''}</span>
          </div>
          <img src="${ (websiteAnalysis as any).screenshotUrl }" style="width:100%;height:auto;display:block;max-height:280px;object-fit:cover;object-position:top;" alt="لقطة شاشة الموقع" onerror="this.parentElement.style.display='none'" />
        </div>` : '' }
        <!-- Gauge Cards بصرية -->
        ${(() => {
          const gaugeItems = [
            { key: 'loadSpeedScore', label: 'سرعة الموقع', icon: '⚡', hint: 'كلما كان أسرع، كلما بقي الزوار أكثر' },
            { key: 'mobileExperienceScore', label: 'تجربة الجوال', icon: '📱', hint: 'أغلب العملاء يتصفحون من الجوال' },
            { key: 'seoScore', label: 'ظهور Google', icon: '🔍', hint: 'مدى ظهور الموقع في نتائج البحث' },
            { key: 'contentQualityScore', label: 'جودة المحتوى', icon: '📝', hint: 'وضوح وإقناع المحتوى للزائر' },
            { key: 'designScore', label: 'جودة التصميم', icon: '🎨', hint: 'المظهر العام وسهولة التصفح' },
            { key: 'offerClarityScore', label: 'وضوح العرض', icon: '💰', hint: 'مدى وضوح الخدمات والأسعار' },
          ];
          const availableItems = gaugeItems.filter(g => (websiteAnalysis as any)[g.key] != null);
          if (availableItems.length === 0) return "";
          return `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;">${availableItems.map(g => {
            const val = Number((websiteAnalysis as any)[g.key]);
            const pct = Math.round((val/10)*100);
            const color = val >= 7 ? '#22c55e' : val >= 5 ? '#f59e0b' : '#ef4444';
            const label = val >= 7 ? 'جيد' : val >= 5 ? 'متوسط' : 'يحتاج تحسين';
            const r = 22; const circ = 2 * Math.PI * r; const dash = (pct/100)*circ;
            return `<div style="background:white;border:1px solid #e2e8f0;border-radius:10px;padding:10px;text-align:center;">
              <div style="font-size:14px;margin-bottom:4px;">${g.icon}</div>
              <svg width="60" height="60" viewBox="0 0 60 60" style="display:block;margin:0 auto 4px;">
                <circle cx="30" cy="30" r="${r}" fill="none" stroke="#e2e8f0" stroke-width="5"/>
                <circle cx="30" cy="30" r="${r}" fill="none" stroke="${color}" stroke-width="5" stroke-dasharray="${dash.toFixed(1)} ${circ.toFixed(1)}" stroke-linecap="round" transform="rotate(-90 30 30)"/>
                <text x="30" y="34" text-anchor="middle" font-size="11" font-weight="800" fill="${color}" font-family="Tajawal,sans-serif">${val.toFixed(1)}</text>
              </svg>
              <div style="font-size:9.5px;font-weight:700;color:#1e293b;margin-bottom:2px;">${g.label}</div>
              <div style="font-size:8.5px;color:${color};font-weight:700;">${label}</div>
              <div style="font-size:8px;color:#94a3b8;margin-top:2px;">${g.hint}</div>
            </div>`;
          }).join("")}</div>`;
        })()}
        ${websiteAnalysis.summary ? `<div class="analysis-box"><div class="analysis-box-title">ملخص التحليل</div><p>${String(websiteAnalysis.summary).substring(0, 350)}</p></div>` : websiteAnalysis.analysisText ? `<div class="analysis-box"><div class="analysis-box-title">ملاحظات التحليل</div><p>${String(websiteAnalysis.analysisText).substring(0, 350)}</p></div>` : ""}
      ` : `
        <div style="background:#fef2f2;border:1px dashed #fca5a5;border-radius:10px;padding:18px;text-align:center;">
          <div style="font-size:28px;margin-bottom:8px;">🌐</div>
          <div style="font-size:13px;font-weight:700;color:#991b1b;margin-bottom:4px;">${lead.website ? 'لم يتم تحليل الموقع بعد' : 'لا يوجد موقع إلكتروني'}</div>
          <div style="font-size:11px;color:#7f1d1d;">${lead.website ? `الموقع: ${lead.website} — اضغط "تحليل العميل" لجلب بيانات الموقع` : `غياب الموقع الإلكتروني يعني خسارة ${lead.businessType ? `عملاء ${lead.businessType}` : 'العملاء'} الذين يبحثون عبر Google`}</div>
        </div>
      `}
     </div>
    <!-- قسم SEO المتقدم -->
    ${seoAdvancedData ? `
    <div class="section">
      <div class="section-title">🔍 تحليل SEO المتقدم</div>
      <div class="two-col" style="margin-bottom:12px;">
        <div>
          ${seoAdvancedData.overallSeoHealth ? `<div class="score-bar-row"><div class="score-bar-label">صحة SEO العامة</div><div class="score-bar-track"><div class="score-bar-fill" style="width:${(Number(seoAdvancedData.overallSeoHealth)/10)*100}%"></div></div><div class="score-bar-value">${Number(seoAdvancedData.overallSeoHealth).toFixed(1)}</div></div>` : ""}
          ${seoAdvancedData.localSeoScore ? `<div class="score-bar-row"><div class="score-bar-label">SEO المحلي</div><div class="score-bar-track"><div class="score-bar-fill" style="width:${(Number(seoAdvancedData.localSeoScore)/10)*100}%"></div></div><div class="score-bar-value">${Number(seoAdvancedData.localSeoScore).toFixed(1)}</div></div>` : ""}
          ${seoAdvancedData.topKeywords ? (() => { try { const kws = typeof seoAdvancedData.topKeywords === "string" ? JSON.parse(seoAdvancedData.topKeywords) : seoAdvancedData.topKeywords; return Array.isArray(kws) && kws.length > 0 ? `<div style="margin-top:8px;"><div style="font-size:10px;font-weight:700;margin-bottom:4px;">🎯 كلمات مفتاحية مستخدمة:</div><div style="display:flex;flex-wrap:wrap;gap:4px;">${kws.slice(0,6).map((k: any) => `<span style="background:#dbeafe;color:#1e40af;padding:2px 8px;border-radius:12px;font-size:9px;">${typeof k === "string" ? k : k.keyword || k}</span>`).join("")}</div></div>` : ""; } catch { return ""; } })() : ""}
        </div>
        <div>
          ${seoAdvancedData.seoSummary ? `<div class="analysis-box"><div class="analysis-box-title">ملخص SEO</div><p style="font-size:10px;line-height:1.7;">${String(seoAdvancedData.seoSummary).substring(0, 280)}</p></div>` : ""}
        </div>
      </div>
      ${seoAdvancedData.priorityActions ? (() => { try { const actions = typeof seoAdvancedData.priorityActions === "string" ? JSON.parse(seoAdvancedData.priorityActions) : seoAdvancedData.priorityActions; return Array.isArray(actions) && actions.length > 0 ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 14px;"><div style="font-size:10px;font-weight:700;color:#166534;margin-bottom:6px;">⚡ أولويات التحسين:</div><ul style="margin:0;padding-right:16px;font-size:10px;color:#14532d;line-height:1.7;">${actions.slice(0,4).map((a: any) => `<li>${typeof a === "string" ? a : a.action || a.title || JSON.stringify(a)}</li>`).join("")}</ul></div>` : ""; } catch { return ""; } })() : ""}
      <!-- رسالة Backlinks -->
      <div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:10px 14px;margin-top:10px;">
        <div style="font-size:10px;font-weight:700;color:#92400e;margin-bottom:4px;">🔗 الروابط الخارجية (Backlinks) — تقدير أولي</div>
        <p style="font-size:10px;color:#78350f;margin:0;line-height:1.7;">${seoAdvancedData.estimatedBacklinks ? `عدد الروابط التقديري: ${seoAdvancedData.estimatedBacklinks} — هذا تقدير أولي غير مؤكد. للحصول على بيانات دقيقة وتحليل عميق للروابط والمنافسين، تواصل معنا للحصول على استشارة مجانية.` : `لم يتم قياس الروابط بعد — هذا الجانب يحتاج أدوات متخصصة مثل Ahrefs لقياسه بدقة. تواصل معنا للحصول على استشارة مجانية.`}</p>
      </div>
    </div>
    ` : ""}
    <!-- مقارنة المنافسين من SERP -->
    ${seoAdvancedData && seoAdvancedData.competitors && (() => { try { const comps = typeof seoAdvancedData.competitors === "string" ? JSON.parse(seoAdvancedData.competitors) : seoAdvancedData.competitors; return Array.isArray(comps) && comps.length > 0 ? `
    <div class="section">
      <div class="section-title">🏁 المنافسون في السوق</div>
      <div style="font-size:10px;color:#64748b;margin-bottom:10px;">منافسون حقيقيون في نفس النشاط والمنطقة — مجلوبون من نتائج Google</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px;">
        ${comps.slice(0,3).map((c: any) => `<div style="background:white;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;">
          <div style="font-size:10.5px;font-weight:700;color:#1e293b;margin-bottom:4px;">${c.name || "منافس"}</div>
          ${c.url ? `<div style="font-size:9px;color:#3b82f6;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${c.url.replace(/^https?:\/\//, "").substring(0,30)}</div>` : ""}
          ${c.seoScore ? `<div style="display:flex;align-items:center;gap:4px;"><div style="font-size:9px;color:#64748b;">SEO:</div><div style="flex:1;height:4px;background:#e2e8f0;border-radius:2px;"><div style="height:100%;background:#6366f1;border-radius:2px;width:${Math.min(100,(Number(c.seoScore)/10)*100)}%;"></div></div><div style="font-size:9px;font-weight:700;color:#6366f1;">${Number(c.seoScore).toFixed(1)}</div></div>` : ""}
          ${c.strengths && Array.isArray(c.strengths) && c.strengths.length > 0 ? `<div style="margin-top:6px;"><div style="font-size:9px;color:#64748b;margin-bottom:2px;">نقاط قوته:</div>${c.strengths.slice(0,2).map((s: string) => `<div style="font-size:9px;color:#334155;background:#f1f5f9;padding:2px 6px;border-radius:4px;margin-bottom:2px;">${s}</div>`).join("")}</div>` : ""}
        </div>`).join("")}
      </div>
      ${seoAdvancedData.competitorGaps && (() => { try { const gaps = typeof seoAdvancedData.competitorGaps === "string" ? JSON.parse(seoAdvancedData.competitorGaps) : seoAdvancedData.competitorGaps; return Array.isArray(gaps) && gaps.length > 0 ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 14px;"><div style="font-size:10px;font-weight:700;color:#166534;margin-bottom:6px;">🎯 فرص التميز عن المنافسين:</div><ul style="margin:0;padding-right:16px;font-size:10px;color:#14532d;line-height:1.7;">${gaps.slice(0,3).map((g: string) => `<li>${g}</li>`).join("")}</ul></div>` : ""; } catch { return ""; } })()}
    </div>
    ` : ""; } catch { return ""; } })()}
    <!-- تحليل السوشيال ميديا -->
    <div class="section">
      <div class="section-title">📱 تحليل منصات التواصل الاجتماعي</div>
      ${socialAnalyses.length > 0 ? `<div class="social-grid">${socialRows}</div>` : `
        <div style="background:#f8fafc;border:1px dashed #cbd5e1;border-radius:10px;padding:20px;text-align:center;">
          <div style="font-size:28px;margin-bottom:8px;">📊</div>
          <div style="font-size:13px;font-weight:700;color:#475569;margin-bottom:4px;">لم يتم تحليل منصات التواصل بعد</div>
          <div style="font-size:11px;color:#94a3b8;">اضغط على "تحليل العميل" في صفحة العميل لجلب بيانات المنصات تلقائياً</div>
          <div style="display:flex;justify-content:center;gap:8px;margin-top:12px;flex-wrap:wrap;">
            ${activePlatforms.map(p => `<div style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:6px 12px;font-size:11px;font-weight:700;">${p.icon} ${p.name}</div>`).join("")}
          </div>
        </div>
      `}
    </div>

    ${lead.notes || lead.additionalNotes ? `
    <div class="section">
      <div class="section-title">📝 ملاحظات</div>
      <div class="analysis-box">
        ${lead.notes ? `<p>${lead.notes}</p>` : ""}
        ${lead.additionalNotes ? `<p style="margin-top:${lead.notes ? "10px" : "0"};padding-top:${lead.notes ? "10px" : "0"};border-top:${lead.notes ? "1px solid #e2e8f0" : "none"};"><strong>تعليقات المحلل:</strong> ${lead.additionalNotes}</p>` : ""}
      </div>
    </div>` : ""}
  </div>

  <div class="footer">
    <div class="footer-brand">${companyName}</div>
    <div>${reportFooterText} · صفحة 3</div>
    <div class="footer-watermark">حصري من شركة مكسب · CONFIDENTIAL</div>
  </div>
</div>

<!-- ===== الصفحة 4: الفرص الضائعة ===== -->
<div class="page">
  <div class="header" style="padding:18px 36px;">
    <div class="header-top">
      <div class="company-info">
        ${companyLogo ? `<img src="${companyLogo}" class="company-logo" alt="شعار" style="width:38px;height:38px;">` : ""}
        <div>
          <div style="font-size:16px;font-weight:800;">${companyName}</div>
          <div style="font-size:10px;opacity:0.6;">الفرص الضائعة والتشخيص</div>
        </div>
      </div>
      <div style="font-size:11px;opacity:0.7;">${lead.companyName} · ${now}</div>
    </div>
  </div>

  <div class="body">
    <div class="section">
      <div class="section-title">⚠️ الفرص الضائعة — تشخيص شامل</div>
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:12px 16px;margin-bottom:16px;font-size:11px;color:#0369a1;line-height:1.7;">
        <strong>ملاحظة منهجية:</strong> هذا التحليل مبني على مسح أولي للحضور الرقمي لـ ${lead.companyName}. الجوانب غير المرصودة قد تكون موجودةً ولم تُكتشف، أو أنها فرص حقيقية للتطوير — وفي كلتا الحالتين يمثل ذلك فرصة لتعزيز الحضور الرقمي. التقديرات الواردة أولية وتستند إلى معطيات السوق العامة، وليس بيانات دقيقة خاصة بالنشاط.
      </div>
      ${missedOpps.length > 0 ? oppCards : `
        <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:20px;text-align:center;">
          <div style="font-size:28px;margin-bottom:8px;">✅</div>
          <div style="font-size:14px;font-weight:700;color:#166534;">الحضور الرقمي جيد نسبياً</div>
          <div style="font-size:11px;color:#15803d;margin-top:4px;">لم يتم رصد فرص ضائعة جوهرية — التركيز على التحسين المستمر</div>
        </div>
      `}
    </div>
  </div>

  <div class="footer">
    <div class="footer-brand">${companyName}</div>
    <div>${reportFooterText} · صفحة 4</div>
    <div class="footer-watermark">حصري من شركة مكسب · CONFIDENTIAL</div>
  </div>
</div>

<!-- ===== الصفحة 5: مقارنة المنافسين (تُضاف هنا ديناميكياً) ===== -->
${(() => {
  // فلترة المنافسين الذين لديهم حضور رقمي حقيقي (منصة واحدة على الأقل)
  const competitorsWithRealData = (competitors || []).filter((c: any) => {
    const realPlatforms = [c.website, c.instagramUrl, c.tiktokUrl, c.snapchatUrl, c.googleMapsUrl, c.twitterUrl, c.facebookUrl, c.verifiedPhone];
    return realPlatforms.filter(Boolean).length >= 1;
  });
  // عرض القسم فقط إذا كان هناك منافسان بحضور حقيقي
  if (!competitorsWithRealData || competitorsWithRealData.length < 2) return '';
  const filteredComps = competitorsWithRealData;
  // حساب درجة الحضور الرقمي لكل منافس
  function calcPresence(c: any): number {
    let score = 0;
    if (c.website) score += 2;
    if (c.instagramUrl) score += 2;
    if (c.tiktokUrl) score += 1.5;
    if (c.snapchatUrl) score += 1.5;
    if (c.googleMapsUrl) score += 1.5;
    if (c.twitterUrl) score += 0.5;
    if (c.facebookUrl) score += 0.5;
    if (c.verifiedPhone) score += 0.5;
    return Math.min(Math.round(score * 10) / 10, 10);
  }
  const leadPresence = calcPresence(lead);
  const compData = filteredComps.slice(0, 4).map((c: any, i: number) => ({
    ...c,
    presence: calcPresence(c),
    color: ['#6366f1','#f59e0b','#10b981','#ef4444'][i % 4],
  }));
  const radarSubjects = ['موقع', 'إنستغرام', 'تيك توك', 'سناب', 'خرائط', 'هاتف'];
  function getRadarData(c: any): number[] {
    return [
      c.website ? 10 : 0,
      c.instagramUrl ? 10 : 0,
      c.tiktokUrl ? 10 : 0,
      c.snapchatUrl ? 10 : 0,
      c.googleMapsUrl ? 10 : 0,
      c.verifiedPhone ? 10 : 0,
    ];
  }
  const radarDatasets = [
    { label: lead.companyName, data: getRadarData(lead), color: primaryColor },
    ...compData.map((c: any) => ({ label: c.companyName, data: getRadarData(c), color: c.color }))
  ];
  const radarSvg = buildRadarChart(radarSubjects, radarDatasets);
  const allEntities = [{ ...lead, presence: leadPresence, color: primaryColor, isMain: true }, ...compData.map((c: any) => ({ ...c, isMain: false }))];
  const tableRows = allEntities.map((e: any) => `
    <tr style="background:${e.isMain ? primaryColor + '12' : 'white'};">
      <td style="padding:8px 12px;font-weight:${e.isMain ? '800' : '600'};font-size:11px;color:${e.isMain ? primaryColor : '#1e293b'};border-bottom:1px solid #f1f5f9;">
        ${e.isMain ? '⭐ ' : ''}${e.companyName}
        ${e.isMain ? '<span style="background:' + primaryColor + ';color:white;font-size:8px;padding:1px 6px;border-radius:10px;margin-right:4px;">عميلك</span>' : ''}
      </td>
      <td style="padding:8px;text-align:center;border-bottom:1px solid #f1f5f9;">${e.website ? '<span style="color:#22c55e;font-size:14px;">✓</span>' : '<span style="color:#ef4444;font-size:14px;">✗</span>'}</td>
      <td style="padding:8px;text-align:center;border-bottom:1px solid #f1f5f9;">${e.instagramUrl ? '<span style="color:#22c55e;font-size:14px;">✓</span>' : '<span style="color:#ef4444;font-size:14px;">✗</span>'}</td>
      <td style="padding:8px;text-align:center;border-bottom:1px solid #f1f5f9;">${e.tiktokUrl ? '<span style="color:#22c55e;font-size:14px;">✓</span>' : '<span style="color:#ef4444;font-size:14px;">✗</span>'}</td>
      <td style="padding:8px;text-align:center;border-bottom:1px solid #f1f5f9;">${e.snapchatUrl ? '<span style="color:#22c55e;font-size:14px;">✓</span>' : '<span style="color:#ef4444;font-size:14px;">✗</span>'}</td>
      <td style="padding:8px;text-align:center;border-bottom:1px solid #f1f5f9;">${e.googleMapsUrl ? '<span style="color:#22c55e;font-size:14px;">✓</span>' : '<span style="color:#ef4444;font-size:14px;">✗</span>'}</td>
      <td style="padding:8px;text-align:center;border-bottom:1px solid #f1f5f9;">${e.verifiedPhone ? '<span style="color:#22c55e;font-size:14px;">✓</span>' : '<span style="color:#ef4444;font-size:14px;">✗</span>'}</td>
      <td style="padding:8px;text-align:center;border-bottom:1px solid #f1f5f9;">
        <div style="display:inline-flex;align-items:center;gap:4px;">
          <div style="width:40px;height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden;">
            <div style="width:${e.presence * 10}%;height:100%;background:${e.isMain ? primaryColor : e.color};border-radius:3px;"></div>
          </div>
          <span style="font-size:10px;font-weight:700;color:${e.isMain ? primaryColor : '#475569'}">${e.presence}/10</span>
        </div>
      </td>
    </tr>
  `).join('');
  const legendItems = radarDatasets.map((ds: any) => `
    <div style="display:flex;align-items:center;gap:5px;">
      <div style="width:10px;height:10px;border-radius:50%;background:${ds.color};"></div>
      <span style="font-size:9px;color:#475569;">${ds.label.length > 15 ? ds.label.substring(0,15)+'...' : ds.label}</span>
    </div>
  `).join('');
  return `
<div class="page">
  <div class="header" style="padding:18px 36px;">
    <div class="header-top">
      <div class="company-info">
        ${companyLogo ? `<img src="${companyLogo}" class="company-logo" alt="شعار" style="width:38px;height:38px;">` : ''}
        <div>
          <div style="font-size:16px;font-weight:800;">${companyName}</div>
          <div style="font-size:10px;opacity:0.6;">تحليل المنافسين والموقع التنافسي</div>
        </div>
      </div>
      <div style="font-size:11px;opacity:0.7;">${lead.companyName} · ${now}</div>
    </div>
  </div>
  <div class="body">
    <div style="font-size:13px;font-weight:800;color:#1e293b;margin-bottom:4px;">📊 الموقع التنافسي لـ ${lead.companyName}</div>
    <div style="font-size:10.5px;color:#64748b;margin-bottom:16px;">مقارنة الحضور الرقمي مع ${compData.length} منافس من نفس المجال في ${lead.city || 'السوق'}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:16px;">
      <div style="background:white;border:1px solid #e2e8f0;border-radius:14px;padding:16px;">
        <div style="font-size:11px;font-weight:700;color:#1e293b;margin-bottom:10px;text-align:center;">🕸️ مخطط الحضور الرقمي</div>
        <div style="display:flex;justify-content:center;">${radarSvg}</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;justify-content:center;">${legendItems}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <div style="background:${primaryColor}12;border:1.5px solid ${primaryColor};border-radius:12px;padding:14px;">
          <div style="font-size:11px;font-weight:800;color:${primaryColor};margin-bottom:6px;">⭐ ${lead.companyName}</div>
          <div style="font-size:28px;font-weight:900;color:${primaryColor};">${leadPresence}<span style="font-size:14px;">/10</span></div>
          <div style="font-size:10px;color:#64748b;margin-top:4px;">درجة الحضور الرقمي</div>
          <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:4px;">
            ${[{k:'website',l:'موقع'},{k:'instagramUrl',l:'إنستغرام'},{k:'tiktokUrl',l:'تيك توك'},{k:'snapchatUrl',l:'سناب'},{k:'googleMapsUrl',l:'خرائط'},{k:'verifiedPhone',l:'هاتف'}].map(p => `<span style="font-size:9px;padding:2px 7px;border-radius:10px;background:${(lead as any)[p.k] ? '#dcfce7' : '#fee2e2'};color:${(lead as any)[p.k] ? '#166534' : '#991b1b'};">${p.l}</span>`).join('')}
          </div>
        </div>
        ${compData.map((c: any) => `
        <div style="background:white;border:1px solid #e2e8f0;border-radius:10px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-size:10.5px;font-weight:700;color:#1e293b;">${c.companyName}</div>
            <div style="font-size:9px;color:#64748b;">${c.city || ''}</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:18px;font-weight:900;color:${c.color};">${c.presence}</div>
            <div style="font-size:8px;color:#94a3b8;">/10</div>
          </div>
        </div>
        `).join('')}
      </div>
    </div>
    <div style="background:white;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
      <div style="background:${primaryColor};color:white;padding:10px 16px;font-size:11px;font-weight:800;">📋 جدول المقارنة التفصيلي</div>
      <table style="width:100%;border-collapse:collapse;font-family:Tajawal,sans-serif;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:8px 12px;text-align:right;font-size:10px;color:#64748b;font-weight:700;border-bottom:1px solid #e2e8f0;">النشاط</th>
            <th style="padding:8px;text-align:center;font-size:10px;color:#64748b;font-weight:700;border-bottom:1px solid #e2e8f0;">موقع</th>
            <th style="padding:8px;text-align:center;font-size:10px;color:#64748b;font-weight:700;border-bottom:1px solid #e2e8f0;">إنستغرام</th>
            <th style="padding:8px;text-align:center;font-size:10px;color:#64748b;font-weight:700;border-bottom:1px solid #e2e8f0;">تيك توك</th>
            <th style="padding:8px;text-align:center;font-size:10px;color:#64748b;font-weight:700;border-bottom:1px solid #e2e8f0;">سناب</th>
            <th style="padding:8px;text-align:center;font-size:10px;color:#64748b;font-weight:700;border-bottom:1px solid #e2e8f0;">خرائط</th>
            <th style="padding:8px;text-align:center;font-size:10px;color:#64748b;font-weight:700;border-bottom:1px solid #e2e8f0;">هاتف</th>
            <th style="padding:8px;text-align:center;font-size:10px;color:#64748b;font-weight:700;border-bottom:1px solid #e2e8f0;">الدرجة</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
    ${(() => {
      const avgCompPresence = compData.length > 0 ? compData.reduce((s: number, c: any) => s + c.presence, 0) / compData.length : 0;
      const gap = leadPresence - avgCompPresence;
      const gapText = gap > 0 
        ? `<span style="color:#22c55e;font-weight:800;">يتقدم بـ ${gap.toFixed(1)} نقطة</span> على متوسط المنافسين — ميزة تنافسية واضحة يجب الحفاظ عليها وتعزيزها.`
        : gap < -1
        ? `<span style="color:#ef4444;font-weight:800;">يتأخر بـ ${Math.abs(gap).toFixed(1)} نقطة</span> عن متوسط المنافسين — فرصة تحسين عاجلة لاستعادة الموقع التنافسي.`
        : `<span style="color:#f59e0b;font-weight:800;">متعادل تقريباً</span> مع متوسط المنافسين — التمييز يحتاج لجودة المحتوى وليس فقط الوجود على المنصات.`;
      return `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;margin-top:12px;">
        <div style="font-size:11px;font-weight:800;color:#1e293b;margin-bottom:6px;">🔍 تحليل الفجوة التنافسية</div>
        <div style="font-size:10.5px;color:#475569;line-height:1.7;">${lead.companyName} ${gapText} متوسط حضور المنافسين: <strong>${avgCompPresence.toFixed(1)}/10</strong></div>
      </div>`;
    })()}
  </div>
  <div class="footer">
    <div class="footer-brand">${companyName}</div>
    <div>${reportFooterText} · صفحة 5</div>
    <div class="footer-watermark">حصري من شركة مكسب · CONFIDENTIAL</div>
  </div>
</div>
`;
})()}

<!-- ===== الصفحة 6: التوصيات + القناة + الموسم + خاتمة ===== -->
<div class="page">
  <div class="header" style="padding:18px 36px;">
    <div class="header-top">
      <div class="company-info">
        ${companyLogo ? `<img src="${companyLogo}" class="company-logo" alt="شعار" style="width:38px;height:38px;">` : ""}
        <div>
          <div style="font-size:16px;font-weight:800;">${companyName}</div>
          <div style="font-size:10px;opacity:0.6;">التوصيات والخطوات التالية</div>
        </div>
      </div>
      <div style="font-size:11px;opacity:0.7;">${lead.companyName} · ${now}</div>
    </div>
  </div>
  <div class="body">
    <!-- التوصيات الاستراتيجية -->
    <div class="section">
      <div class="section-title">🎯 التوصيات الاستراتيجية</div>
      <div style="font-size:11px;color:#64748b;margin-bottom:14px;">خطة عمل مقترحة مرتبة حسب الأولوية والأثر التجاري المتوقع</div>
      ${recCards}
    </div>

    <!-- قسم القناة الأكثر جدوى -->
    <div style="background:linear-gradient(135deg,#f0f9ff 0%,#e0f2fe 100%);border:1.5px solid #0ea5e9;border-radius:14px;padding:18px 22px;margin-bottom:16px;">
      <div style="font-size:13px;font-weight:800;color:#0369a1;margin-bottom:10px;display:flex;align-items:center;gap:8px;">
        <span style="font-size:18px;">📱</span>
        <span>القناة الأكثر جدوى لهذا النشاط</span>
      </div>
      <div style="display:flex;align-items:flex-start;gap:14px;">
        <div style="background:${primaryChannel.color};color:white;border-radius:12px;padding:10px 18px;font-size:22px;font-weight:900;white-space:nowrap;flex-shrink:0;">
          ${primaryChannel.icon} ${primaryChannel.channel}
        </div>
        <div style="flex:1;">
          <div style="font-size:11.5px;color:#1e293b;line-height:1.7;margin-bottom:10px;">${primaryChannel.reason}</div>
          <div style="font-size:10.5px;color:#64748b;font-weight:600;margin-bottom:6px;">منصات داعمة موصى بها أيضاً:</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${primaryChannel.secondaryChannels.map((sc: any) => `
              <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:4px 10px;font-size:10px;color:#475569;">
                ${sc.icon} <strong>${sc.name}</strong> — ${sc.note}
              </div>
            `).join("")}
          </div>
        </div>
      </div>
    </div>

    <!-- قسم الموسم التسويقي -->
    ${includeSeasonSection ? (activeSeason ? `
    <div style="background:linear-gradient(135deg,${activeSeason.color}15 0%,${activeSeason.color}08 100%);border:1.5px solid ${activeSeason.color};border-radius:14px;padding:16px 20px;margin-bottom:16px;">
      <div style="font-size:13px;font-weight:800;color:${activeSeason.color};margin-bottom:8px;display:flex;align-items:center;gap:8px;">
        <span style="font-size:20px;">${activeSeason.icon}</span>
        <span>تنبيه موسمي: ${activeSeason.name}</span>
        <span style="background:${activeSeason.color};color:white;font-size:9px;padding:2px 8px;border-radius:20px;font-weight:700;">نشط الآن</span>
      </div>
      <div style="font-size:11px;color:#475569;margin-bottom:8px;">${activeSeason.description || ""}</div>
      ${getSeasonBusinessGuidance(activeSeason, lead.businessType || "") ? `
      <div style="background:${activeSeason.color}20;border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:11px;font-weight:700;color:${activeSeason.color};border-right:3px solid ${activeSeason.color};">
        🎯 توجيه مخصص لـ ${lead.businessType || "نشاطك"}: ${getSeasonBusinessGuidance(activeSeason, lead.businessType || "")}
      </div>` : ""}
      <div style="font-size:11px;font-weight:700;color:#1e293b;margin-bottom:8px;">فرص تسويقية متاحة في هذا الموسم:</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
        ${((activeSeason.opportunities || []) as string[]).slice(0, 4).map((opp: string) => `
          <div style="background:white;border-radius:8px;padding:6px 10px;font-size:10.5px;color:#374151;border-right:3px solid ${activeSeason.color};">
            • ${opp}
          </div>
        `).join("")}
      </div>
    </div>
    ` : (upcomingSeasons && upcomingSeasons.length > 0 ? `
    <div style="background:#fffbeb;border:1.5px solid #f59e0b;border-radius:14px;padding:14px 18px;margin-bottom:16px;">
      <div style="font-size:12px;font-weight:800;color:#b45309;margin-bottom:8px;">⏰ موسم تسويقي قادم خلال 30 يوماً: ${upcomingSeasons[0].icon} ${upcomingSeasons[0].name}</div>
      <div style="font-size:11px;color:#78350f;">ابدأ التحضير مبكراً للاستفادة من هذا الموسم. ${upcomingSeasons[0].description || ""}</div>
      ${getSeasonBusinessGuidance(upcomingSeasons[0], lead.businessType || "") ? `
      <div style="background:#fef3c7;border-radius:8px;padding:6px 10px;margin-top:8px;font-size:10.5px;font-weight:600;color:#92400e;">
        🎯 توجيه لـ ${lead.businessType || "نشاطك"}: ${getSeasonBusinessGuidance(upcomingSeasons[0], lead.businessType || "")}
      </div>` : ""}
    </div>
    ` : "")) : ""}

    <!-- خاتمة ذكية + QR Code + واتساب -->
    <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);border-radius:16px;padding:22px 28px;color:white;margin-top:4px;">
      <div style="display:flex;gap:20px;align-items:flex-start;">
        <!-- نص الخاتمة -->
        <div style="flex:1;">
          <div style="font-size:15px;font-weight:900;margin-bottom:8px;">هذا التقرير بداية الطريق</div>
          <div style="font-size:11.5px;opacity:0.85;line-height:1.8;margin-bottom:14px;">
            ${closingText}
          </div>
          <div style="font-size:12px;font-weight:700;opacity:0.9;margin-bottom:10px;">للحصول على تحليل أعمق وخطة تنفيذية مخصصة:</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${companyPhone ? `<a href="${waLink}" style="background:#25d366;color:white;padding:8px 16px;border-radius:8px;font-size:11px;font-weight:700;text-decoration:none;display:inline-flex;align-items:center;gap:6px;">💬 تواصل عبر واتساب</a>` : ""}
            ${companyEmail ? `<a href="mailto:${companyEmail}" style="background:rgba(255,255,255,0.15);color:white;padding:8px 16px;border-radius:8px;font-size:11px;font-weight:700;text-decoration:none;border:1px solid rgba(255,255,255,0.3)">✉️ ${companyEmail}</a>` : ""}
            <a href="https://${companyWebsite}" style="background:rgba(255,255,255,0.15);color:white;padding:8px 16px;border-radius:8px;font-size:11px;font-weight:700;text-decoration:none;border:1px solid rgba(255,255,255,0.3)">🌐 ${companyWebsite}</a>
          </div>
        </div>
        <!-- QR Code -->
        ${companyPhone ? `
        <div style="flex-shrink:0;text-align:center;">
          <img src="${qrApiUrl}" width="110" height="110" style="border-radius:10px;border:3px solid rgba(255,255,255,0.3);display:block;margin-bottom:6px;" alt="QR Code" />
          <div style="font-size:9px;opacity:0.7;">امسح للتواصل</div>
        </div>
        ` : ""}
      </div>
    </div>
  </div>
  <div class="footer">
    <div class="footer-brand">${companyName}</div>
    <div>${reportFooterText} · صفحة 6</div>
    <div class="footer-watermark">حصري من شركة مكسب · CONFIDENTIAL</div>
  </div>
</div>
</body>
</html>`;
}

// Helper لإيجاد تحليل إنستغرام
function instaSocial(socialAnalyses: any[]) {
  return socialAnalyses.find(s => s.platform?.toLowerCase().includes("instagram")) || null;
}

export const reportRouter = router({
  generatePDF: protectedProcedure
    .input(z.object({ leadId: z.number() }))
    .mutation(async ({ input }) => {
      const lead = await getLeadById(input.leadId);
      if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "العميل غير موجود" });

      // ===== Identity Gate: منع التوليد عند غياب الحقول الأساسية =====
      const missingCritical: string[] = [];
      if (!lead.companyName || lead.companyName.trim() === '' || lead.companyName === 'غير محدد') missingCritical.push('اسم النشاط');
      if (!lead.city || lead.city.trim() === '' || lead.city === 'غير محدد') missingCritical.push('المدينة');
      if (!lead.businessType || lead.businessType.trim() === '' || lead.businessType === 'غير محدد') missingCritical.push('نوع النشاط');
      if (missingCritical.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `لا يمكن توليد التقرير: الحقول التالية مفقودة أو غير محددة: ${missingCritical.join('، ')}. يرجى إكمال بيانات العميل أولاً.`,
        });
      }

      const websiteAnalysis = await getWebsiteAnalysisByLeadId(input.leadId);
      const socialAnalyses = await getSocialAnalysesByLeadId(input.leadId);

      let pdfBuffer: Buffer;
      try {
        pdfBuffer = await generatePDFBuffer(lead, websiteAnalysis, socialAnalyses);
      } catch (err: any) {
        console.error("[PDF] error:", err.message);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `فشل توليد PDF: ${err.message}` });
      }

      const fileKey = `reports/${input.leadId}-${nanoid(8)}.pdf`;
      const { url } = await storagePut(fileKey, pdfBuffer, "application/pdf");

      return { success: true, leadId: input.leadId, url, filename: `تحليل مخصص لعناية ${lead.companyName}.pdf` };
    }),

  generateAndSendViaWhatsApp: protectedProcedure
    .input(z.object({ leadId: z.number() }))
    .mutation(async () => {
      return { success: false, message: "ميزة إرسال PDF عبر واتساب غير متاحة حالياً" };
    }),

  generateSummary: protectedProcedure
    .input(z.object({ leadId: z.number() }))
    .mutation(async ({ input }) => {
      const lead = await getLeadById(input.leadId);
      if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "العميل غير موجود" });
      const analystContext = buildAnalystContext(lead);
      const response = await invokeLLM({
        messages: [
          { role: "system", content: "أنت مساعد مبيعات خبير. قدم ملخصاً احترافياً للعميل." },
          { role: "user", content: `قدم ملخصاً مختصراً لهذا العميل:\nالشركة: ${lead.companyName}\nالنشاط: ${lead.businessType}\nالمدينة: ${lead.city}\nالمرحلة: ${lead.stage}` },
          ...(analystContext ? [{ role: "user" as const, content: `ضع هذه الملاحظات في الاعتبار عند كتابة الملخص:\n${analystContext}` }] : []),
        ],
      });
      return { summary: response.choices[0]?.message?.content || "لا يمكن إنشاء الملخص حالياً" };
    }),

  // ===== جلب HTML التقرير للمعاينة (نفس buildPDFHtml المستخدم في PDF) =====
  getHtml: protectedProcedure
    .input(z.object({ leadId: z.number() }))
    .mutation(async ({ input }) => {
      const lead = await getLeadById(input.leadId);
      if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "العميل غير موجود" });

      // ===== Identity Gate =====
      const missingCritical: string[] = [];
      if (!lead.companyName || lead.companyName.trim() === '' || lead.companyName === 'غير محدد') missingCritical.push('اسم النشاط');
      if (!lead.city || lead.city.trim() === '' || lead.city === 'غير محدد') missingCritical.push('المدينة');
      if (!lead.businessType || lead.businessType.trim() === '' || lead.businessType === 'غير محدد') missingCritical.push('نوع النشاط');
      if (missingCritical.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `لا يمكن عرض التقرير: الحقول التالية مفقودة أو غير محددة: ${missingCritical.join('، ')}. يرجى إكمال بيانات العميل أولاً.`,
        });
      }

      const websiteAnalysis = await getWebsiteAnalysisByLeadId(input.leadId);
      const socialAnalyses = await getSocialAnalysesByLeadId(input.leadId);
      const company = await getCompanySettingsData();
      const businessType = lead.businessType || "";
      const activeSeason = await getActiveSeasonForBusiness(businessType).catch(() => null);
      const upcomingSeasons = await getUpcomingSeasonsForBusiness(businessType).catch(() => []);
      const competitors = await getCompetitors(lead.id, businessType, lead.city || "").catch(() => []);

      const html = buildPDFHtml(lead, websiteAnalysis, socialAnalyses, company, activeSeason, upcomingSeasons, competitors);
      return { html, companyName: lead.companyName };
    }),

  // ===== حساب نسب الفجوة بالذكاء الاصطناعي =====
  computeGapPercentages: protectedProcedure
    .input(z.object({
      leadId: z.number(),
      gaps: z.array(z.string()),
    }))
    .mutation(async ({ input }) => {
      const lead = await getLeadById(input.leadId);
      if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "العميل غير موجود" });

      const competitors = await getCompetitors(lead.id, lead.businessType || "", lead.city || "").catch(() => []);
      const websiteAnalysis = await getWebsiteAnalysisByLeadId(input.leadId);
      const socialAnalyses = await getSocialAnalysesByLeadId(input.leadId);

      const leadSummary = {
        name: lead.companyName,
        businessType: lead.businessType,
        city: lead.city,
        hasWebsite: !!lead.website,
        hasInstagram: !!lead.instagramUrl,
        hasTiktok: !!lead.tiktokUrl,
        hasSnapchat: !!lead.snapchatUrl,
        priorityScore: lead.leadPriorityScore,
        websiteSeoScore: websiteAnalysis?.seoScore,
        websiteSpeedScore: websiteAnalysis?.loadSpeedScore,
        socialFollowers: socialAnalyses[0]?.followersCount,
        socialEngagement: socialAnalyses[0]?.engagementScore,
        googleRating: (lead as any).googleRating,
        googleReviews: (lead as any).googleReviewsCount,
        analystNotes: buildAnalystContext(lead) || null,
      };

      const compSummary = competitors.slice(0, 5).map((c: any) => ({
        name: c.companyName,
        priorityScore: c.leadPriorityScore,
        hasWebsite: !!c.website,
        hasInstagram: !!c.instagramUrl,
        hasTiktok: !!c.tiktokUrl,
        hasSnapchat: !!c.snapchatUrl,
        googleRating: c.googleRating,
        googleReviews: c.googleReviewsCount,
      }));

      const prompt = `أنت محلل تسويق رقمي خبير. بناءً على بيانات العميل والمنافسين، احسب نسبة الفجوة التنافسية لكل ثغرة مذكورة.

بيانات العميل:
${JSON.stringify(leadSummary, null, 2)}

بيانات المنافسين (${compSummary.length} منافس):
${JSON.stringify(compSummary, null, 2)}

الثغرات المطلوب حساب نسبة الفجوة لها:
${input.gaps.map((g, i) => `${i + 1}. ${g}`).join('\n')}

المطلوب: أعطني نسبة مئوية للفجوة التنافسية لكل ثغرة (0-100) بناءً على مقارنة وضع العميل بالمنافسين. كلما كان العميل أضعف في هذا الجانب مقارنةً بالمنافسين، كلما زادت النسبة. إذا لم تتوفر بيانات كافية، استخدم تقديراً منطقياً بناءً على نوع النشاط والمدينة.`;

      const analystContext = buildAnalystContext(lead);
      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "أنت محلل تسويق رقمي. أجب فقط بـ JSON وفق النسق المطلوب." },
            { role: "user", content: prompt },
            ...(analystContext ? [{ role: "user" as const, content: `ضع ملاحظات المحلل التالية في الاعتبار عند حساب الفجوات:\n${analystContext}` }] : []),
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "gap_percentages",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  percentages: {
                    type: "array",
                    items: { type: "number" },
                    description: "نسب الفجوة لكل ثغرة (0-100)"
                  },
                  reasoning: {
                    type: "array",
                    items: { type: "string" },
                    description: "تبرير موجز لكل نسبة"
                  }
                },
                required: ["percentages", "reasoning"],
                additionalProperties: false
              }
            }
          }
        });
        const content = response.choices[0]?.message?.content;
        const parsed = typeof content === 'string' ? JSON.parse(content) : content;
        return {
          percentages: (parsed.percentages || []).map((p: number) => Math.min(100, Math.max(0, Math.round(p)))),
          reasoning: parsed.reasoning || [],
        };
      } catch (err: any) {
        console.error("[GapAI] error:", err.message);
        return { percentages: input.gaps.map((_: string, i: number) => [40, 35, 30, 25, 20][i % 5]), reasoning: [] };
      }
    }),

  getEmployeePerformance: protectedProcedure
    .input(z.object({ days: z.number().default(30) }))
    .query(async () => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) return [];
      const { users } = await import("../../drizzle/schema");
      const allUsers = await db.select({ id: users.id, name: users.name, displayName: users.displayName }).from(users).limit(20);
      return allUsers.map(u => ({ id: u.id, name: u.displayName || u.name, totalChats: 0, closeRate: 0, performanceScore: 0 }));
    }),
});
