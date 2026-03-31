/**
 * PDF Generator - تحويل HTML إلى PDF حقيقي باستخدام Puppeteer
 * يستخدم Chromium المثبت على الـ server
 */
import puppeteer from "puppeteer-core";

const CHROMIUM_PATH = "/usr/bin/chromium-browser";

export interface PdfGenerationOptions {
  html: string;
  filename?: string;
  format?: "A4" | "Letter";
  landscape?: boolean;
  margins?: {
    top?: string;
    bottom?: string;
    left?: string;
    right?: string;
  };
}

export async function generatePdfFromHtml(options: PdfGenerationOptions): Promise<Buffer> {
  const {
    html,
    format = "A4",
    landscape = false,
    margins = { top: "15mm", bottom: "15mm", left: "15mm", right: "15mm" },
  } = options;

  let browser = null;

  try {
    browser = await puppeteer.launch({
      executablePath: CHROMIUM_PATH,
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
        "--disable-extensions",
        "--disable-software-rasterizer",
      ],
    });

    const page = await browser.newPage();

    // Set content with full HTML
    await page.setContent(html, {
      waitUntil: "networkidle0",
      timeout: 30000,
    });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format,
      landscape,
      printBackground: true,
      margin: margins,
      displayHeaderFooter: false,
    });

    return Buffer.from(pdfBuffer);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * بناء HTML تقرير احترافي RTL للعميل
 */
export function buildLeadReportHtml(params: {
  lead: any;
  websiteAnalysis?: any;
  socialAnalyses?: any[];
  reportType: "internal" | "client";
  settings?: any;
}): string {
  const { lead, websiteAnalysis, socialAnalyses, reportType, settings } = params;

  const isInternal = reportType === "internal";
  const primaryColor = "#1a6b5a";
  const accentColor = "#00c896";
  const today = new Date().toLocaleDateString("ar-SA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const urgencyColors: Record<string, string> = {
    critical: "#ef4444",
    high: "#f97316",
    medium: "#eab308",
    low: "#22c55e",
  };

  const urgencyLabels: Record<string, string> = {
    critical: "عاجل جداً",
    high: "عالي",
    medium: "متوسط",
    low: "منخفض",
  };

  const urgencyColor = urgencyColors[lead.urgencyLevel || "medium"] || "#eab308";
  const urgencyLabel = urgencyLabels[lead.urgencyLevel || "medium"] || "متوسط";

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>تقرير ${isInternal ? "داخلي" : "عميل"} - ${lead.businessName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Cairo', 'Arial', sans-serif;
      direction: rtl;
      background: #ffffff;
      color: #1a1a2e;
      font-size: 13px;
      line-height: 1.6;
    }

    .page {
      max-width: 800px;
      margin: 0 auto;
      padding: 0;
    }

    /* Header */
    .header {
      background: linear-gradient(135deg, ${primaryColor} 0%, #0d4a3a 100%);
      color: white;
      padding: 30px 40px;
      position: relative;
      overflow: hidden;
    }

    .header::after {
      content: '';
      position: absolute;
      bottom: -20px;
      left: 0;
      right: 0;
      height: 40px;
      background: white;
      clip-path: polygon(0 50%, 100% 0, 100% 100%, 0 100%);
    }

    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
    }

    .company-name {
      font-size: 28px;
      font-weight: 900;
      letter-spacing: -0.5px;
    }

    .report-badge {
      background: rgba(255,255,255,0.2);
      border: 1px solid rgba(255,255,255,0.4);
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
    }

    .header-meta {
      display: flex;
      gap: 20px;
      font-size: 12px;
      opacity: 0.85;
    }

    /* Content */
    .content {
      padding: 40px;
    }

    /* Section */
    .section {
      margin-bottom: 28px;
    }

    .section-title {
      font-size: 15px;
      font-weight: 700;
      color: ${primaryColor};
      border-bottom: 2px solid ${accentColor};
      padding-bottom: 8px;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    /* Info Grid */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .info-item {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 16px;
    }

    .info-label {
      font-size: 11px;
      color: #64748b;
      margin-bottom: 4px;
    }

    .info-value {
      font-size: 14px;
      font-weight: 600;
      color: #1a1a2e;
    }

    /* Score Card */
    .score-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
    }

    .score-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px;
      text-align: center;
    }

    .score-number {
      font-size: 24px;
      font-weight: 900;
      color: ${primaryColor};
    }

    .score-label {
      font-size: 10px;
      color: #64748b;
      margin-top: 2px;
    }

    /* Urgency Badge */
    .urgency-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: ${urgencyColor}20;
      border: 1px solid ${urgencyColor}40;
      color: ${urgencyColor};
      padding: 6px 14px;
      border-radius: 20px;
      font-weight: 700;
      font-size: 13px;
    }

    /* Highlight Box */
    .highlight-box {
      background: linear-gradient(135deg, ${primaryColor}10, ${accentColor}10);
      border: 1px solid ${primaryColor}30;
      border-right: 4px solid ${primaryColor};
      border-radius: 8px;
      padding: 16px 20px;
      margin-bottom: 12px;
    }

    .highlight-label {
      font-size: 11px;
      color: ${primaryColor};
      font-weight: 700;
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .highlight-text {
      font-size: 14px;
      color: #1a1a2e;
      line-height: 1.7;
    }

    /* Gap List */
    .gap-list {
      list-style: none;
    }

    .gap-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 0;
      border-bottom: 1px solid #f1f5f9;
    }

    .gap-item:last-child { border-bottom: none; }

    .gap-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #ef4444;
      margin-top: 5px;
      flex-shrink: 0;
    }

    /* Social Row */
    .social-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      margin-bottom: 8px;
    }

    .social-platform {
      font-weight: 600;
      font-size: 13px;
    }

    .social-metric {
      font-size: 12px;
      color: #64748b;
    }

    /* Footer */
    .footer {
      background: #f8fafc;
      border-top: 2px solid ${primaryColor}20;
      padding: 20px 40px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      color: #94a3b8;
    }

    .footer-brand {
      font-weight: 700;
      color: ${primaryColor};
      font-size: 13px;
    }

    /* Watermark for internal */
    ${isInternal ? `
    .watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-45deg);
      font-size: 80px;
      font-weight: 900;
      color: rgba(0,0,0,0.03);
      pointer-events: none;
      z-index: 0;
      white-space: nowrap;
    }
    ` : ""}

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  ${isInternal ? '<div class="watermark">داخلي - سري</div>' : ""}
  
  <div class="page">
    <!-- Header -->
    <div class="header">
      <div class="header-top">
        <div>
          <div class="company-name">${lead.businessName}</div>
          <div style="opacity:0.8; font-size:13px; margin-top:4px;">${lead.businessType || ""} ${lead.city ? `• ${lead.city}` : ""}</div>
        </div>
        <div>
          <div class="report-badge">${isInternal ? "📊 تقرير داخلي" : "📋 تقرير العميل"}</div>
        </div>
      </div>
      <div class="header-meta">
        <span>📅 ${today}</span>
        ${lead.phone ? `<span>📞 ${lead.phone}</span>` : ""}
        ${lead.website ? `<span>🌐 ${lead.website}</span>` : ""}
      </div>
    </div>

    <!-- Content -->
    <div class="content" style="padding-top: 50px;">

      <!-- Basic Info -->
      <div class="section">
        <div class="section-title">📋 معلومات النشاط التجاري</div>
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">اسم النشاط</div>
            <div class="info-value">${lead.businessName}</div>
          </div>
          <div class="info-item">
            <div class="info-label">نوع النشاط</div>
            <div class="info-value">${lead.businessType || "غير محدد"}</div>
          </div>
          <div class="info-item">
            <div class="info-label">المدينة</div>
            <div class="info-value">${lead.city || "غير محدد"}</div>
          </div>
          <div class="info-item">
            <div class="info-label">رقم الهاتف</div>
            <div class="info-value">${lead.phone || lead.verifiedPhone || "غير متوفر"}</div>
          </div>
          ${lead.website ? `
          <div class="info-item">
            <div class="info-label">الموقع الإلكتروني</div>
            <div class="info-value" style="font-size:12px;">${lead.website}</div>
          </div>
          ` : ""}
          ${lead.instagramUrl ? `
          <div class="info-item">
            <div class="info-label">إنستغرام</div>
            <div class="info-value" style="font-size:12px;">${lead.instagramUrl}</div>
          </div>
          ` : ""}
        </div>
      </div>

      <!-- Priority & Urgency -->
      ${lead.urgencyLevel || lead.leadPriorityScore ? `
      <div class="section">
        <div class="section-title">⚡ الأولوية والإلحاح</div>
        <div style="display:flex; gap:16px; align-items:center; flex-wrap:wrap;">
          ${lead.urgencyLevel ? `<div class="urgency-badge">🔥 ${urgencyLabel}</div>` : ""}
          ${lead.leadPriorityScore ? `
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:12px; color:#64748b;">درجة الأولوية:</span>
            <span style="font-size:20px; font-weight:900; color:${primaryColor};">${lead.leadPriorityScore}/10</span>
          </div>
          ` : ""}
        </div>
      </div>
      ` : ""}

      <!-- AI Analysis -->
      ${lead.primaryOpportunity || lead.marketingGapSummary || lead.iceBreaker ? `
      <div class="section">
        <div class="section-title">🧠 التحليل الذكي</div>
        
        ${lead.primaryOpportunity ? `
        <div class="highlight-box">
          <div class="highlight-label">🎯 الفرصة الرئيسية</div>
          <div class="highlight-text">${lead.primaryOpportunity}</div>
        </div>
        ` : ""}
        
        ${lead.iceBreaker ? `
        <div class="highlight-box">
          <div class="highlight-label">💬 نص التواصل المقترح (Ice Breaker)</div>
          <div class="highlight-text">${lead.iceBreaker}</div>
        </div>
        ` : ""}
        
        ${lead.salesEntryAngle ? `
        <div class="highlight-box">
          <div class="highlight-label">📐 زاوية الدخول البيعية</div>
          <div class="highlight-text">${lead.salesEntryAngle}</div>
        </div>
        ` : ""}
      </div>
      ` : ""}

      <!-- Website Analysis -->
      ${websiteAnalysis ? `
      <div class="section">
        <div class="section-title">🌐 تحليل الموقع الإلكتروني</div>
        <div class="score-grid">
          ${websiteAnalysis.seoScore !== null ? `
          <div class="score-card">
            <div class="score-number">${websiteAnalysis.seoScore}</div>
            <div class="score-label">SEO</div>
          </div>
          ` : ""}
          ${websiteAnalysis.designScore !== null ? `
          <div class="score-card">
            <div class="score-number">${websiteAnalysis.designScore}</div>
            <div class="score-label">التصميم</div>
          </div>
          ` : ""}
          ${websiteAnalysis.contentScore !== null ? `
          <div class="score-card">
            <div class="score-number">${websiteAnalysis.contentScore}</div>
            <div class="score-label">المحتوى</div>
          </div>
          ` : ""}
          ${websiteAnalysis.mobileScore !== null ? `
          <div class="score-card">
            <div class="score-number">${websiteAnalysis.mobileScore}</div>
            <div class="score-label">الجوال</div>
          </div>
          ` : ""}
        </div>
        
        ${websiteAnalysis.mainIssues?.length ? `
        <div style="margin-top: 16px;">
          <div style="font-size:13px; font-weight:600; color:#1a1a2e; margin-bottom:10px;">المشاكل الرئيسية:</div>
          <ul class="gap-list">
            ${websiteAnalysis.mainIssues.slice(0, 4).map((issue: string) => `
            <li class="gap-item">
              <div class="gap-dot"></div>
              <span>${issue}</span>
            </li>
            `).join("")}
          </ul>
        </div>
        ` : ""}
      </div>
      ` : ""}

      <!-- Social Media -->
      ${socialAnalyses?.length ? `
      <div class="section">
        <div class="section-title">📱 تحليل السوشيال ميديا</div>
        ${socialAnalyses.map((s: any) => `
        <div class="social-row">
          <div class="social-platform">
            ${s.platform === "instagram" ? "📸 إنستغرام" :
              s.platform === "twitter" ? "🐦 تويتر/X" :
              s.platform === "tiktok" ? "🎵 تيك توك" :
              s.platform === "linkedin" ? "💼 لينكد إن" :
              s.platform}
          </div>
          <div class="social-metric">
            ${s.followersCount ? `👥 ${s.followersCount.toLocaleString("ar-SA")} متابع` : ""}
            ${s.engagementRate ? ` • ${s.engagementRate}% تفاعل` : ""}
            ${s.overallScore ? ` • درجة: ${s.overallScore}/10` : ""}
          </div>
        </div>
        `).join("")}
      </div>
      ` : ""}

      ${isInternal ? `
      <!-- Internal Notes -->
      <div class="section">
        <div class="section-title">📝 ملاحظات داخلية</div>
        <div style="background:#fff7ed; border:1px solid #fed7aa; border-radius:8px; padding:16px;">
          <p style="color:#92400e; font-size:12px;">هذا التقرير للاستخدام الداخلي فقط ولا يجوز مشاركته مع العميل.</p>
          ${lead.notes ? `<p style="margin-top:8px; color:#1a1a2e;">${lead.notes}</p>` : ""}
        </div>
      </div>
      ` : ""}

    </div>

    <!-- Footer -->
    <div class="footer">
      <div class="footer-brand">مكسب — منصة تجميع بيانات الأعمال</div>
      <div>${today} • ${isInternal ? "تقرير داخلي سري" : "تقرير العميل"}</div>
    </div>
  </div>
</body>
</html>`;
}
