/**
 * نظام توليد تقارير PDF احترافية بهوية الشركة
 * يستخدم pdfkit لإنشاء تقارير مفصلة للعملاء
 */
import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";

interface CompanyBranding {
  companyName: string;
  companyDescription?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  reportHeaderText?: string | null;
  reportFooterText?: string | null;
  reportIntroText?: string | null;
  city?: string | null;
}

interface LeadData {
  companyName: string;
  businessType?: string | null;
  city?: string | null;
  district?: string | null;
  verifiedPhone?: string | null;
  website?: string | null;
  instagramUrl?: string | null;
  twitterUrl?: string | null;
  tiktokUrl?: string | null;
  snapchatUrl?: string | null;
  googleMapsUrl?: string | null;
  leadPriorityScore?: number | null;
  biggestMarketingGap?: string | null;
  suggestedSalesEntryAngle?: string | null;
}

interface AnalysisData {
  activityScore?: number;
  activityLevel?: string;
  urgencyLevel?: string;
  responselikelihood?: string;
  summary?: string;
  strengths?: string[];
  weaknesses?: string[];
  opportunities?: string[];
  recommendations?: string[];
  tiktokFollowers?: number;
  tiktokVideos?: number;
  twitterFollowers?: number;
  instagramFollowers?: number;
  backlinkCount?: number;
}

interface SocialAnalysis {
  platform: string;
  score?: number;
  summary?: string;
  strengths?: string[];
  weaknesses?: string[];
  recommendations?: string[];
}

interface WebsiteAnalysis {
  score?: number;
  summary?: string;
  strengths?: string[];
  weaknesses?: string[];
  recommendations?: string[];
  seoScore?: number;
  speedScore?: number;
  mobileScore?: number;
}

export interface ReportInput {
  branding: CompanyBranding;
  lead: LeadData;
  analysis?: AnalysisData | null;
  socialAnalyses?: SocialAnalysis[];
  websiteAnalysis?: WebsiteAnalysis | null;
}

// تحويل hex إلى RGB
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [26, 86, 219];
}

// تحميل خط عربي
function getArabicFont(): string {
  // استخدام خط Helvetica المدمج مع pdfkit كـ fallback
  // يمكن تحميل خط عربي حقيقي لاحقاً
  return "Helvetica";
}

// دالة لرسم نص RTL (عربي)
function reverseArabic(text: string): string {
  // pdfkit لا يدعم RTL بشكل كامل، نعكس النص
  return text;
}

export async function generateLeadReportPDF(input: ReportInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const { branding, lead, analysis, socialAnalyses = [], websiteAnalysis } = input;

    const primaryColor = branding.primaryColor || "#1a56db";
    const secondaryColor = branding.secondaryColor || "#0e9f6e";
    const [pr, pg, pb] = hexToRgb(primaryColor);
    const [sr, sg, sb] = hexToRgb(secondaryColor);

    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      info: {
        Title: `تقرير تحليل - ${lead.companyName}`,
        Author: branding.companyName,
        Subject: "تقرير تحليل رقمي شامل",
        Creator: "مكسب - نظام تجميع بيانات العملاء",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const margin = 40;
    const contentWidth = pageWidth - margin * 2;

    // ===== صفحة الغلاف =====
    // خلفية الهيدر
    doc.rect(0, 0, pageWidth, 200).fill([pr, pg, pb]);

    // خط زخرفي
    doc.rect(0, 195, pageWidth, 8).fill([sr, sg, sb]);

    // اسم الشركة المُصدِرة (أعلى اليمين)
    doc.font("Helvetica-Bold").fontSize(22).fillColor("white");
    const companyDisplayName = branding.companyName || "مكسب KSA";
    doc.text(companyDisplayName, margin, 40, {
      width: contentWidth,
      align: "right",
    });

    // وصف الشركة
    if (branding.companyDescription) {
      doc.font("Helvetica").fontSize(11).fillColor([255, 255, 255, 0.8] as any);
      doc.text(branding.companyDescription, margin, 70, {
        width: contentWidth,
        align: "right",
      });
    }

    // عنوان التقرير
    doc.font("Helvetica-Bold").fontSize(16).fillColor("white");
    doc.text("Digital Analysis Report", margin, 110, {
      width: contentWidth,
      align: "right",
    });
    doc.font("Helvetica").fontSize(13).fillColor([255, 255, 255, 0.9] as any);
    doc.text("تقرير التحليل الرقمي الشامل", margin, 135, {
      width: contentWidth,
      align: "right",
    });

    // التاريخ
    const now = new Date();
    const dateStr = now.toLocaleDateString("ar-SA", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    doc.font("Helvetica").fontSize(10).fillColor("white");
    doc.text(dateStr, margin, 165, { width: contentWidth, align: "right" });

    // ===== قسم بيانات العميل =====
    let y = 230;

    // بطاقة العميل
    doc.rect(margin, y, contentWidth, 110).fillAndStroke([245, 247, 250], [pr, pg, pb]);

    // اسم العميل
    doc.font("Helvetica-Bold").fontSize(18).fillColor([pr, pg, pb]);
    doc.text(lead.companyName, margin + 15, y + 15, {
      width: contentWidth - 30,
      align: "right",
    });

    // النوع والمدينة
    const infoLine = [lead.businessType, lead.city, lead.district]
      .filter(Boolean)
      .join(" | ");
    doc.font("Helvetica").fontSize(11).fillColor("#555");
    doc.text(infoLine, margin + 15, y + 45, {
      width: contentWidth - 30,
      align: "right",
    });

    // الهاتف والموقع
    const contactLine = [lead.verifiedPhone, lead.website].filter(Boolean).join("   |   ");
    doc.font("Helvetica").fontSize(10).fillColor("#777");
    doc.text(contactLine, margin + 15, y + 68, {
      width: contentWidth - 30,
      align: "right",
    });

    // درجة الأولوية
    if (lead.leadPriorityScore) {
      const scoreColor =
        lead.leadPriorityScore >= 70
          ? [14, 159, 110]
          : lead.leadPriorityScore >= 40
          ? [255, 160, 0]
          : [220, 38, 38];
      doc.circle(margin + 50, y + 55, 28).fill(scoreColor as any);
      doc.font("Helvetica-Bold").fontSize(16).fillColor("white");
      doc.text(String(lead.leadPriorityScore), margin + 35, y + 46, {
        width: 30,
        align: "center",
      });
      doc.font("Helvetica").fontSize(8).fillColor("white");
      doc.text("/100", margin + 35, y + 65, { width: 30, align: "center" });
    }

    y += 130;

    // ===== مقدمة التقرير =====
    if (branding.reportIntroText) {
      doc.rect(margin, y, contentWidth, 1).fill([pr, pg, pb]);
      y += 10;
      doc.font("Helvetica-Bold").fontSize(13).fillColor([pr, pg, pb]);
      doc.text("مقدمة التقرير", margin, y, { width: contentWidth, align: "right" });
      y += 22;
      doc.font("Helvetica").fontSize(10).fillColor("#333");
      doc.text(branding.reportIntroText, margin, y, {
        width: contentWidth,
        align: "right",
        lineGap: 4,
      });
      y += doc.heightOfString(branding.reportIntroText, {
        width: contentWidth,
        lineGap: 4,
      }) + 20;
    }

    // ===== ملخص التحليل الذكي =====
    if (analysis) {
      // عنوان القسم
      doc.rect(margin, y, contentWidth, 1).fill([pr, pg, pb]);
      y += 10;
      doc.font("Helvetica-Bold").fontSize(14).fillColor([pr, pg, pb]);
      doc.text("AI Analysis Summary", margin, y, { width: contentWidth, align: "right" });
      doc.font("Helvetica").fontSize(11).fillColor([pr, pg, pb]);
      doc.text("ملخص التحليل الذكي", margin, y + 18, {
        width: contentWidth,
        align: "right",
      });
      y += 45;

      // مؤشرات الأداء
      const indicators = [
        {
          label: "مستوى النشاط",
          value: analysis.activityLevel || "—",
          score: analysis.activityScore,
        },
        { label: "مستوى الإلحاح", value: analysis.urgencyLevel || "—" },
        { label: "احتمالية الاستجابة", value: analysis.responselikelihood || "—" },
      ];

      const cardW = (contentWidth - 20) / 3;
      indicators.forEach((ind, i) => {
        const cx = margin + i * (cardW + 10);
        doc.rect(cx, y, cardW, 60).fillAndStroke([245, 247, 250], [220, 220, 220]);
        doc.font("Helvetica").fontSize(9).fillColor("#666");
        doc.text(ind.label, cx + 5, y + 8, { width: cardW - 10, align: "center" });
        doc.font("Helvetica-Bold").fontSize(14).fillColor([pr, pg, pb]);
        doc.text(ind.value, cx + 5, y + 25, { width: cardW - 10, align: "center" });
        if (ind.score !== undefined) {
          doc.font("Helvetica").fontSize(10).fillColor([sr, sg, sb]);
          doc.text(`${ind.score}/10`, cx + 5, y + 44, {
            width: cardW - 10,
            align: "center",
          });
        }
      });
      y += 80;

      // ملخص نصي
      if (analysis.summary) {
        doc.rect(margin, y, contentWidth, 1).fill([220, 220, 220]);
        y += 10;
        doc.font("Helvetica").fontSize(10).fillColor("#333");
        doc.text(analysis.summary, margin, y, {
          width: contentWidth,
          align: "right",
          lineGap: 3,
        });
        y +=
          doc.heightOfString(analysis.summary, { width: contentWidth, lineGap: 3 }) + 20;
      }

      // نقاط القوة والضعف
      if (
        (analysis.strengths && analysis.strengths.length > 0) ||
        (analysis.weaknesses && analysis.weaknesses.length > 0)
      ) {
        const colW = (contentWidth - 15) / 2;

        // نقاط القوة
        if (analysis.strengths && analysis.strengths.length > 0) {
          doc.rect(margin, y, colW, 20).fill([sr, sg, sb]);
          doc.font("Helvetica-Bold").fontSize(11).fillColor("white");
          doc.text("نقاط القوة", margin + 5, y + 4, { width: colW - 10, align: "right" });
          y += 25;
          analysis.strengths.slice(0, 4).forEach((s) => {
            doc.font("Helvetica").fontSize(9).fillColor("#333");
            doc.text(`• ${s}`, margin + 5, y, { width: colW - 10, align: "right" });
            y += doc.heightOfString(`• ${s}`, { width: colW - 10 }) + 4;
          });
        }

        // التوصيات
        if (analysis.recommendations && analysis.recommendations.length > 0) {
          const recY = y + 15;
          doc.rect(margin, recY, contentWidth, 20).fill([pr, pg, pb]);
          doc.font("Helvetica-Bold").fontSize(11).fillColor("white");
          doc.text("التوصيات والفرص", margin + 5, recY + 4, {
            width: contentWidth - 10,
            align: "right",
          });
          y = recY + 25;
          analysis.recommendations.slice(0, 5).forEach((r, idx) => {
            doc.rect(margin, y, 4, 14).fill([sr, sg, sb]);
            doc.font("Helvetica").fontSize(9).fillColor("#333");
            doc.text(`${idx + 1}. ${r}`, margin + 12, y + 1, {
              width: contentWidth - 20,
              align: "right",
            });
            y += doc.heightOfString(r, { width: contentWidth - 20 }) + 8;
          });
        }
      }
    }

    // ===== تحليل السوشيال ميديا =====
    if (socialAnalyses && socialAnalyses.length > 0) {
      // صفحة جديدة إذا لزم الأمر
      if (y > pageHeight - 200) {
        doc.addPage();
        y = margin;
      } else {
        y += 20;
      }

      doc.rect(margin, y, contentWidth, 1).fill([pr, pg, pb]);
      y += 10;
      doc.font("Helvetica-Bold").fontSize(14).fillColor([pr, pg, pb]);
      doc.text("Social Media Analysis", margin, y, {
        width: contentWidth,
        align: "right",
      });
      doc.font("Helvetica").fontSize(11).fillColor([pr, pg, pb]);
      doc.text("تحليل منصات التواصل الاجتماعي", margin, y + 18, {
        width: contentWidth,
        align: "right",
      });
      y += 50;

      socialAnalyses.forEach((sa) => {
        if (y > pageHeight - 150) {
          doc.addPage();
          y = margin;
        }

        // هيدر المنصة
        doc.rect(margin, y, contentWidth, 28).fill([245, 247, 250]);
        doc.rect(margin, y, 4, 28).fill([sr, sg, sb]);

        const platformName =
          sa.platform === "instagram"
            ? "Instagram انستجرام"
            : sa.platform === "tiktok"
            ? "TikTok تيك توك"
            : sa.platform === "twitter"
            ? "Twitter تويتر"
            : sa.platform === "snapchat"
            ? "Snapchat سناب شات"
            : sa.platform;

        doc.font("Helvetica-Bold").fontSize(12).fillColor("#333");
        doc.text(platformName, margin + 15, y + 8, {
          width: contentWidth - 80,
          align: "right",
        });

        if (sa.score !== undefined) {
          const scoreColor =
            sa.score >= 7
              ? [sr, sg, sb]
              : sa.score >= 5
              ? [255, 160, 0]
              : [220, 38, 38];
          doc.font("Helvetica-Bold").fontSize(14).fillColor(scoreColor as any);
          doc.text(`${sa.score}/10`, margin + 5, y + 6, { width: 50, align: "left" });
        }
        y += 38;

        if (sa.summary) {
          doc.font("Helvetica").fontSize(9).fillColor("#444");
          doc.text(sa.summary, margin + 10, y, {
            width: contentWidth - 20,
            align: "right",
            lineGap: 3,
          });
          y +=
            doc.heightOfString(sa.summary, { width: contentWidth - 20, lineGap: 3 }) + 12;
        }

        if (sa.recommendations && sa.recommendations.length > 0) {
          doc.font("Helvetica-Bold").fontSize(9).fillColor([pr, pg, pb]);
          doc.text("التوصيات:", margin + 10, y, { width: contentWidth - 20, align: "right" });
          y += 14;
          sa.recommendations.slice(0, 3).forEach((r) => {
            doc.font("Helvetica").fontSize(8).fillColor("#555");
            doc.text(`← ${r}`, margin + 20, y, {
              width: contentWidth - 30,
              align: "right",
            });
            y += doc.heightOfString(r, { width: contentWidth - 30 }) + 5;
          });
        }
        y += 15;
      });
    }

    // ===== تحليل الموقع الإلكتروني =====
    if (websiteAnalysis) {
      if (y > pageHeight - 200) {
        doc.addPage();
        y = margin;
      } else {
        y += 20;
      }

      doc.rect(margin, y, contentWidth, 1).fill([pr, pg, pb]);
      y += 10;
      doc.font("Helvetica-Bold").fontSize(14).fillColor([pr, pg, pb]);
      doc.text("Website Analysis", margin, y, { width: contentWidth, align: "right" });
      doc.font("Helvetica").fontSize(11).fillColor([pr, pg, pb]);
      doc.text("تحليل الموقع الإلكتروني", margin, y + 18, {
        width: contentWidth,
        align: "right",
      });
      y += 50;

      // مؤشرات الموقع
      const webScores = [
        { label: "SEO", value: websiteAnalysis.seoScore },
        { label: "السرعة", value: websiteAnalysis.speedScore },
        { label: "الجوال", value: websiteAnalysis.mobileScore },
        { label: "الإجمالي", value: websiteAnalysis.score },
      ].filter((s) => s.value !== undefined);

      if (webScores.length > 0) {
        const scoreW = contentWidth / webScores.length;
        webScores.forEach((ws, i) => {
          const cx = margin + i * scoreW;
          const scoreVal = ws.value || 0;
          const scoreColor =
            scoreVal >= 70 ? [sr, sg, sb] : scoreVal >= 40 ? [255, 160, 0] : [220, 38, 38];
          doc.rect(cx + 5, y, scoreW - 10, 55).fillAndStroke([245, 247, 250], [220, 220, 220]);
          doc.font("Helvetica").fontSize(9).fillColor("#666");
          doc.text(ws.label, cx + 5, y + 6, { width: scoreW - 10, align: "center" });
          doc.font("Helvetica-Bold").fontSize(20).fillColor(scoreColor as any);
          doc.text(String(scoreVal), cx + 5, y + 20, {
            width: scoreW - 10,
            align: "center",
          });
          doc.font("Helvetica").fontSize(8).fillColor("#999");
          doc.text("/100", cx + 5, y + 42, { width: scoreW - 10, align: "center" });
        });
        y += 70;
      }

      if (websiteAnalysis.summary) {
        doc.font("Helvetica").fontSize(10).fillColor("#333");
        doc.text(websiteAnalysis.summary, margin, y, {
          width: contentWidth,
          align: "right",
          lineGap: 3,
        });
        y +=
          doc.heightOfString(websiteAnalysis.summary, {
            width: contentWidth,
            lineGap: 3,
          }) + 15;
      }
    }

    // ===== أكبر فجوة تسويقية =====
    if (lead.biggestMarketingGap || lead.suggestedSalesEntryAngle) {
      if (y > pageHeight - 150) {
        doc.addPage();
        y = margin;
      } else {
        y += 20;
      }

      doc.rect(margin, y, contentWidth, 1).fill([pr, pg, pb]);
      y += 10;

      if (lead.biggestMarketingGap) {
        doc.rect(margin, y, contentWidth, 20).fill([pr, pg, pb]);
        doc.font("Helvetica-Bold").fontSize(11).fillColor("white");
        doc.text("Marketing Gap | أكبر فجوة تسويقية", margin + 5, y + 4, {
          width: contentWidth - 10,
          align: "right",
        });
        y += 25;
        doc.font("Helvetica").fontSize(10).fillColor("#333");
        doc.text(lead.biggestMarketingGap, margin + 10, y, {
          width: contentWidth - 20,
          align: "right",
          lineGap: 3,
        });
        y +=
          doc.heightOfString(lead.biggestMarketingGap, {
            width: contentWidth - 20,
            lineGap: 3,
          }) + 15;
      }

      if (lead.suggestedSalesEntryAngle) {
        doc.rect(margin, y, contentWidth, 20).fill([sr, sg, sb]);
        doc.font("Helvetica-Bold").fontSize(11).fillColor("white");
        doc.text("Sales Entry Angle | زاوية الدخول المقترحة", margin + 5, y + 4, {
          width: contentWidth - 10,
          align: "right",
        });
        y += 25;
        doc.font("Helvetica").fontSize(10).fillColor("#333");
        doc.text(lead.suggestedSalesEntryAngle, margin + 10, y, {
          width: contentWidth - 20,
          align: "right",
          lineGap: 3,
        });
        y +=
          doc.heightOfString(lead.suggestedSalesEntryAngle, {
            width: contentWidth - 20,
            lineGap: 3,
          }) + 15;
      }
    }

    // ===== تذييل الصفحة =====
    const footerY = pageHeight - 60;
    doc.rect(0, footerY, pageWidth, 60).fill([pr, pg, pb]);
    doc.rect(0, footerY, pageWidth, 4).fill([sr, sg, sb]);

    const footerText =
      branding.reportFooterText ||
      `${branding.companyName} | ${branding.phone || ""} | ${branding.email || ""} | ${branding.website || ""}`;

    doc.font("Helvetica").fontSize(9).fillColor("white");
    doc.text(footerText, margin, footerY + 15, {
      width: contentWidth,
      align: "center",
    });

    doc.font("Helvetica").fontSize(8).fillColor([255, 255, 255, 0.7] as any);
    doc.text(
      `تم إنشاء هذا التقرير بواسطة ${branding.companyName} - ${dateStr}`,
      margin,
      footerY + 35,
      { width: contentWidth, align: "center" }
    );

    doc.end();
  });
}
