// ═══════════════════════════════════════════════════════════════════════
//  generateLeadPDF — Executive Report v8 (Print-Ready Dark)
//  صفحة 1: الغلاف التنفيذي  |  صفحة 2: الملخص التنفيذي + الفرص الضائعة
//  صفحة 3: التحليل الرقمي + Radar  |  صفحة 4: التوصيات + CTA قوي + QR
//  صفحة 5: تحليل المنافسين
// ═══════════════════════════════════════════════════════════════════════

interface GeneratePDFOptions {
  lead?: any;
  websiteAnalysis?: any;
  socialAnalyses?: any[];
  report?: any;
  company?: any;
  competitors?: any[];
  activeSeason?: any;            // الموسم التسويقي الحالي
  upcomingSeasons?: any[];       // المواسم القادمة خلال 30 يوم
  reportStyle?: any;             // إعدادات أسلوب التقرير
  aiGapPercentages?: number[];   // نسب الفجوة المحسوبة بالذكاء الاصطناعي
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
import QRCode from "qrcode";
function sc(v?: number | null) {
  if (!v) return "#64748b";
  if (v >= 8) return "#22c55e";
  if (v >= 6) return "#eab308";
  if (v >= 4) return "#f97316";
  return "#ef4444";
}
function sg(v?: number | null) {
  if (!v) return "none";
  if (v >= 8) return "0 0 24px rgba(34,197,94,0.8)";
  if (v >= 6) return "0 0 24px rgba(234,179,8,0.8)";
  if (v >= 4) return "0 0 24px rgba(249,115,22,0.8)";
  return "0 0 24px rgba(239,68,68,0.8)";
}
function fmt(v?: number | null) { return v ? Number(v).toFixed(1) : "—"; }
function fmtK(v?: number | null) {
  if (!v) return "—";
  if (v >= 1000000) return (v / 1000000).toFixed(1) + "M";
  if (v >= 1000) return (v / 1000).toFixed(1) + "K";
  return String(v);
}
function cleanPhone(v?: string | number | null) {
  if (!v) return "";
  const s = String(v).trim();
  return (s === "0" || s === "") ? "" : s;
}
function cleanUrl(url?: string | null, platform = "") {
  if (!url) return "";
  try {
    let c = url.replace(/https?:\/\/(www\.)?/, "");
    const patterns: Record<string, RegExp> = {
      instagram: /instagram\.com\/([^/?&]+)/,
      twitter: /(?:twitter|x)\.com\/([^/?&]+)/,
      tiktok: /tiktok\.com\/@?([^/?&]+)/,
      snapchat: /snapchat\.com\/add\/([^/?&]+)/,
    };
    const re = patterns[platform];
    if (re) { const m = c.match(re); return m ? `@${m[1]}` : c.split("/")[1] || c; }
    return c.split("/")[0];
  } catch { return url; }
}
function cleanMarkdown(t: string) {
  return t
    .replace(/#{1,6}\s+/g, "")
    .replace(/\*\*(.*?)\*\*/g, "<strong style='color:#f1f5f9;'>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\n\n/g, "</p><p style='margin-top:8px;'>")
    .replace(/\n/g, "<br>");
}
function parseSocialExtra(raw?: string | null) {
  if (!raw) return {};
  try { const o = JSON.parse(raw); return typeof o === "object" ? o : {}; } catch { return {}; }
}
function urg(level?: string | null) {
  switch (level) {
    case "high":   return { text: "أولوية عالية",   color: "#ef4444", bg: "rgba(239,68,68,0.15)",   border: "rgba(239,68,68,0.4)" };
    case "medium": return { text: "أولوية متوسطة", color: "#eab308", bg: "rgba(234,179,8,0.15)",   border: "rgba(234,179,8,0.4)" };
    case "low":    return { text: "أولوية منخفضة", color: "#22c55e", bg: "rgba(34,197,94,0.15)",   border: "rgba(34,197,94,0.4)" };
    default:       return { text: "غير محدد",       color: "#64748b", bg: "rgba(100,116,139,0.1)", border: "rgba(100,116,139,0.3)" };
  }
}
function pm(p: string) {
  const map: Record<string, { name: string; color: string; icon: string }> = {
    instagram: { name: "إنستغرام", color: "#e1306c", icon: "📸" },
    twitter:   { name: "تويتر / X", color: "#1da1f2", icon: "🐦" },
    tiktok:    { name: "تيك توك",   color: "#69c9d0", icon: "🎵" },
    snapchat:  { name: "سناب شات", color: "#fffc00", icon: "👻" },
    facebook:  { name: "فيسبوك",   color: "#1877f2", icon: "📘" },
    linkedin:  { name: "لينكد إن", color: "#0a66c2", icon: "💼" },
  };
  return map[p?.toLowerCase()] || { name: p || "منصة", color: "#64748b", icon: "📱" };
}

// ─── Score ring (dark) ────────────────────────────────────────────────────────
function ring(v?: number | null, size = 80, label = "") {
  const color = sc(v); const glow = sg(v);
  const d = v ? Number(v).toFixed(1) : "—";
  const fs = size > 70 ? 28 : 20;
  return `<div style="text-align:center;">
    <div style="width:${size}px;height:${size}px;border-radius:50%;
      border:3px solid ${color};box-shadow:${glow};
      display:flex;align-items:center;justify-content:center;
      font-size:${fs}px;font-weight:900;color:${color};
      background:rgba(6,13,26,0.9);margin:0 auto ${label ? "8px" : "0"};">
      ${d}
    </div>
    ${label ? `<div style="font-size:10px;color:#94a3b8;font-weight:600;letter-spacing:0.5px;">${label}</div>` : ""}
  </div>`;
}

// ─── Big number display ───────────────────────────────────────────────────────
function bigNum(v: string | number | null, label: string, sub = "", color = "#22c55e") {
  return `<div style="text-align:center;padding:16px 12px;background:${color}0d;
    border:1px solid ${color}33;border-radius:14px;">
    <div style="font-size:38px;font-weight:900;color:${color};
      text-shadow:0 0 30px ${color}88;line-height:1;margin-bottom:6px;">${v ?? "—"}</div>
    <div style="font-size:11px;font-weight:700;color:#cbd5e1;">${label}</div>
    ${sub ? `<div style="font-size:9px;color:#475569;margin-top:3px;">${sub}</div>` : ""}
  </div>`;
}

// ─── Progress bar (dark) ──────────────────────────────────────────────────────
function bar(v?: number | null, label = "", max = 10) {
  const pct = v ? Math.min((v / max) * 100, 100) : 0;
  const color = sc(v);
  return `<div style="margin-bottom:10px;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;">
      <span style="font-size:11.5px;color:#cbd5e1;font-weight:600;">${label}</span>
      <span style="font-size:13px;font-weight:900;color:${color};text-shadow:0 0 8px ${color}88;">${fmt(v)}</span>
    </div>
    <div style="height:8px;background:rgba(255,255,255,0.08);border-radius:4px;overflow:hidden;">
      <div style="height:100%;width:${pct}%;
        background:linear-gradient(90deg,${color},${color}cc);
        border-radius:4px;box-shadow:0 0 10px ${color}66;"></div>
    </div>
  </div>`;
}

// ─── Radar Chart SVG (dark) ───────────────────────────────────────────────────
function radarChart(axes: { label: string; value: number | null; market: number }[], size = 240) {
  const n = axes.length;
  if (n < 3) return "";
  const cx = size / 2, cy = size / 2, r = size * 0.36, levels = 5;
  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pt = (i: number, ratio: number) => ({
    x: cx + r * ratio * Math.cos(angle(i)),
    y: cy + r * ratio * Math.sin(angle(i)),
  });

  let gridLines = "";
  for (let l = 1; l <= levels; l++) {
    const ratio = l / levels;
    const pts = Array.from({ length: n }, (_, i) => pt(i, ratio));
    const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") + " Z";
    gridLines += `<path d="${d}" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="0.8"/>`;
  }

  let axisLines = "";
  for (let i = 0; i < n; i++) {
    const p = pt(i, 1);
    axisLines += `<line x1="${cx}" y1="${cy}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" stroke="rgba(255,255,255,0.15)" stroke-width="0.8"/>`;
  }

  const mPts = axes.map((a, i) => pt(i, (a.market || 5) / 10));
  const mPath = mPts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") + " Z";

  const cPts = axes.map((a, i) => pt(i, Math.min(Math.max((a.value || 0) / 10, 0), 1)));
  const cPath = cPts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") + " Z";

  let labels = "";
  for (let i = 0; i < n; i++) {
    const a = angle(i);
    const lx = cx + (r + 26) * Math.cos(a);
    const ly = cy + (r + 26) * Math.sin(a);
    const anchor = Math.cos(a) > 0.1 ? "start" : Math.cos(a) < -0.1 ? "end" : "middle";
    const ax = axes[i];
    const valStr = ax.value !== null && ax.value !== undefined ? Number(ax.value).toFixed(1) : "—";
    const valColor = sc(ax.value);
    labels += `<text x="${lx.toFixed(1)}" y="${(ly - 4).toFixed(1)}" text-anchor="${anchor}" font-size="8.5" fill="#cbd5e1" font-weight="700" font-family="Tajawal,Arial,sans-serif">${ax.label}</text>`;
    labels += `<text x="${lx.toFixed(1)}" y="${(ly + 9).toFixed(1)}" text-anchor="${anchor}" font-size="9" fill="${valColor}" font-weight="900" font-family="Tajawal,Arial,sans-serif">${valStr}</text>`;
  }

  let dots = "";
  cPts.forEach(p => {
    dots += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="#22c55e" stroke="rgba(34,197,94,0.3)" stroke-width="4"/>`;
  });

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" style="overflow:visible;">
    ${gridLines}${axisLines}
    <path d="${mPath}" fill="rgba(100,116,139,0.15)" stroke="rgba(100,116,139,0.5)" stroke-width="1.5" stroke-dasharray="4,2"/>
    <path d="${cPath}" fill="rgba(34,197,94,0.12)" stroke="#22c55e" stroke-width="2.5" filter="url(#glow)"/>
    <defs><filter id="glow"><feGaussianBlur stdDeviation="2" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    ${dots}${labels}
  </svg>`;
}

// ─── Section header (dark) ────────────────────────────────────────────────────
function sh(title: string, sub = "") {
  return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
    <div style="width:4px;height:24px;border-radius:2px;
      background:linear-gradient(180deg,#22c55e,#0ea5e9);
      box-shadow:0 0 10px rgba(34,197,94,0.6);flex-shrink:0;"></div>
    <div>
      <div style="font-size:15px;font-weight:800;color:#f1f5f9;letter-spacing:0.3px;">${title}</div>
      ${sub ? `<div style="font-size:10px;color:#64748b;margin-top:2px;">${sub}</div>` : ""}
    </div>
  </div>`;
}

// ─── Card (dark) ──────────────────────────────────────────────────────────────
function card(content: string, accent = "#22c55e", extraStyle = "") {
  return `<div style="background:linear-gradient(135deg,#0d1f3c 0%,#080f1e 100%);
    border:1px solid ${accent}22;border-radius:14px;padding:18px 20px;
    position:relative;overflow:hidden;${extraStyle}">
    <div style="position:absolute;top:0;right:0;width:100px;height:100px;
      background:radial-gradient(circle,${accent}08 0%,transparent 70%);pointer-events:none;"></div>
    ${content}
  </div>`;
}

// ─── Page header (shared) ─────────────────────────────────────────────────────
function pageHeader(title: string, subtitle: string, pageNum: string, coName: string, lead: any) {
  return `<div style="padding:16px 40px 14px;display:flex;align-items:center;justify-content:space-between;
    border-bottom:1px solid rgba(255,255,255,0.06);background:rgba(0,0,0,0.2);">
    <div style="display:flex;align-items:center;gap:10px;">
      <div style="width:4px;height:32px;border-radius:2px;background:linear-gradient(180deg,#22c55e,#0ea5e9);box-shadow:0 0 12px rgba(34,197,94,0.5);"></div>
      <div>
        <div style="font-size:17px;font-weight:900;color:#f1f5f9;">${title}</div>
        <div style="font-size:9px;color:#475569;margin-top:1px;">${subtitle}</div>
      </div>
    </div>
    <div style="text-align:left;">
      <div style="font-size:10px;color:#f1f5f9;font-weight:700;">${lead.companyName || ""}</div>
      <div style="font-size:9px;color:#334155;margin-top:1px;">${coName} · ${pageNum}</div>
    </div>
  </div>`;
}

// ─── Page wrapper (dark A4) ───────────────────────────────────────────────────
function page(content: string, pageBreak = true) {
  return `<div style="width:210mm;min-height:297mm;padding:0;margin:0 auto;
    background:linear-gradient(160deg,#020810 0%,#060d1a 60%,#020810 100%);
    position:relative;overflow:hidden;
    font-family:'Tajawal','Cairo','Arial',sans-serif;direction:rtl;text-align:right;
    -webkit-print-color-adjust:exact;print-color-adjust:exact;color-adjust:exact;
    ${pageBreak ? "page-break-after:always;break-after:page;" : ""}">
    ${content}
  </div>`;
}

// ─── Info row (dark) ──────────────────────────────────────────────────────────
function infoRow(label: string, value: string, icon = "") {
  if (!value) return "";
  return `<div style="display:flex;align-items:flex-start;gap:8px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
    <span style="font-size:11px;color:#475569;min-width:80px;flex-shrink:0;">${icon} ${label}</span>
    <span style="font-size:11px;color:#cbd5e1;font-weight:600;flex:1;word-break:break-all;">${value}</span>
  </div>`;
}

// ─── QR Code SVG (WhatsApp) ───────────────────────────────────────────────────
// توليد QR حقيقي باستخدام مكتبة qrcode
async function generateQRDataURL(text: string): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      width: 200,
      margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
      errorCorrectionLevel: "M",
    });
  } catch {
    return "";
  }
}

// دالة مزامنة لتوليد QR لواتساب
async function qrCodeSVG(value: string, size = 100): Promise<string> {
  const url = /^\d+$/.test(value.replace(/[\s+]/g, ""))
    ? `https://wa.me/${value.replace(/\D/g, "")}`
    : value;
  const dataUrl = await generateQRDataURL(url);
  if (!dataUrl) return "";
  return `<img src="${dataUrl}" width="${size}" height="${size}" style="border-radius:6px;display:block;" />`;
}

// ─── Missed opportunity card (enhanced with why + action + timeframe) ─────────
function missedOppCard(
  gap: string,
  impact: string,
  solution: string,
  color: string,
  icon: string,
  whyItMatters?: string,
  actionStep?: string,
  timeframe?: string,
  gapPercent?: number,
  seasonAlert?: string
) {
  return `<div style="border-radius:14px;overflow:hidden;border:1px solid ${color}33;margin-bottom:10px;
    background:linear-gradient(135deg,${color}06 0%,rgba(0,0,0,0) 100%);
    box-shadow:0 2px 12px ${color}15;">
    <div style="display:flex;align-items:stretch;">
      <div style="width:5px;background:${color};flex-shrink:0;"></div>
      <div style="flex:1;padding:11px 14px 10px 14px;">
        <!-- Title row -->
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:7px;">
          <div style="font-size:12px;font-weight:800;color:#e2e8f0;line-height:1.5;">${icon} ${gap}</div>
          <div style="display:flex;gap:5px;flex-shrink:0;align-items:center;">
            ${gapPercent ? `<div style="padding:3px 10px;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);
              border-radius:16px;white-space:nowrap;">
              <span style="font-size:9.5px;color:#fca5a5;font-weight:900;">متأخر ${gapPercent}%</span>
            </div>` : ''}
            <div style="flex-shrink:0;padding:3px 10px;background:rgba(239,68,68,0.18);border:1px solid rgba(239,68,68,0.35);
              border-radius:16px;white-space:nowrap;">
              <span style="font-size:9.5px;color:#fca5a5;font-weight:900;">📉 ${impact}</span>
            </div>
          </div>
        </div>
        <!-- Season alert -->
        ${seasonAlert ? `<div style="margin-bottom:7px;padding:5px 10px;background:rgba(234,179,8,0.1);
          border:1px solid rgba(234,179,8,0.3);border-radius:8px;display:flex;align-items:center;gap:6px;">
          <span style="font-size:10px;">⚡</span>
          <span style="font-size:9.5px;color:#fbbf24;font-weight:700;">${seasonAlert}</span>
        </div>` : ''}
        <!-- Why it matters -->
        ${whyItMatters ? `<div style="font-size:10.5px;color:#94a3b8;line-height:1.7;margin-bottom:8px;
          padding:7px 12px;background:rgba(255,255,255,0.03);border-radius:8px;
          border-right:3px solid ${color}66;">
          <strong style="color:${color};font-size:9.5px;">لماذا هذا مهم؟</strong> ${whyItMatters}
        </div>` : ''}
        <!-- Action row -->
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <div style="padding:4px 12px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);
            border-radius:20px;display:flex;align-items:center;gap:5px;">
            <span style="font-size:10px;">✅</span>
            <span style="font-size:10px;color:#86efac;font-weight:700;">حل مكسب: ${solution}</span>
          </div>
          ${timeframe ? `<div style="padding:4px 12px;background:rgba(14,165,233,0.08);border:1px solid rgba(14,165,233,0.25);
            border-radius:20px;">
            <span style="font-size:9.5px;color:#7dd3fc;font-weight:700;">⏱ ${timeframe}</span>
          </div>` : ''}
        </div>
        <!-- Action step -->
        ${actionStep ? `<div style="margin-top:7px;font-size:10px;color:#64748b;line-height:1.6;
          padding:6px 10px;background:rgba(34,197,94,0.04);border-radius:8px;
          display:flex;align-items:flex-start;gap:6px;">
          <span style="color:#22c55e;font-size:11px;flex-shrink:0;">▶</span>
          <span>${actionStep}</span>
        </div>` : ''}
      </div>
    </div>
  </div>`;
}

// ═══════════════════════════════════════════════════════════════════════
//  MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════
export async function generateLeadPDF(options: GeneratePDFOptions): Promise<void> {
  const { lead, websiteAnalysis, socialAnalyses = [], report, company, competitors = [], activeSeason, upcomingSeasons = [], reportStyle, aiGapPercentages } = options;
  if (!lead) throw new Error("لا توجد بيانات للعميل");

  // ── استخراج إعدادات التقرير ──
  const rsWritingStyle  = reportStyle?.writingStyle  || 'formal';
  const rsBrandKeywords = Array.isArray(reportStyle?.brandKeywords) ? reportStyle.brandKeywords : [];
  const rsFooterText    = reportStyle?.reportFooterText || '';
  const rsClosingStmt   = reportStyle?.closingStatement || '';
  const rsAgencyBadges  = reportStyle?.agencyBadges !== false;

  // ─── Auto-fill missing data intelligently ────────────────────────────────────
  function autoFillData() {
    const biz = lead.businessType || "نشاط تجاري";
    const city = lead.city || "الرياض";
    const hasSocial = socialAnalyses.length > 0;
    const hasWebsite = !!lead.website;
    const avgSocialScore = hasSocial
      ? socialAnalyses.reduce((sum: number, s: any) => sum + (Number(s.engagementScore) || 0), 0) / socialAnalyses.length
      : 0;

    if (!lead.leadPriorityScore) {
      let score = 5.0;
      if (hasSocial && avgSocialScore >= 7) score += 1.5;
      else if (hasSocial && avgSocialScore >= 5) score += 0.8;
      if (hasWebsite) score += 0.5;
      if (lead.phone || lead.verifiedPhone) score += 0.5;
      if (socialAnalyses.length >= 3) score += 0.5;
      lead.leadPriorityScore = Math.min(score, 9.5).toFixed(1);
    }

    if (!lead.dataQualityScore) {
      let score = 3.0;
      if (lead.phone || lead.verifiedPhone) score += 1.5;
      if (hasWebsite) score += 1.0;
      if (hasSocial) score += 1.5;
      if (lead.city) score += 0.5;
      if (lead.businessType) score += 0.5;
      if (lead.instagramUrl || lead.tiktokUrl) score += 0.5;
      lead.dataQualityScore = Math.min(score, 9.5).toFixed(1);
    }

    if (!lead.biggestMarketingGap) {
      const autoGaps: string[] = [];
      if (!hasWebsite) autoGaps.push(`غياب الموقع الإلكتروني يُضعف المصداقية ويُفوّت عملاء يبحثون عن ${biz} في ${city}`);
      if (!hasSocial) autoGaps.push(`لا يوجد حضور على منصات التواصل الاجتماعي مما يُقلّص الوصول للعملاء المحتملين`);
      if (hasSocial && avgSocialScore < 6) autoGaps.push(`ضعف التفاعل على السوشيال ميديا (${avgSocialScore.toFixed(1)}/10) يُشير لمحتوى غير جذاب أو نشر غير منتظم`);
      if (!lead.phone && !lead.verifiedPhone) autoGaps.push(`غياب معلومات الاتصال المباشر يُصعّب على العملاء التواصل والشراء`);
      if (hasSocial && !lead.website) autoGaps.push(`وجود حضور رقمي دون موقع إلكتروني يُفوّت فرصة تحويل المتابعين لعملاء فعليين`);
      if (!lead.instagramUrl && !lead.tiktokUrl) autoGaps.push(`غياب الحضور على إنستغرام وتيك توك يُضيّع شريحة واسعة من العملاء الشباب في ${city}`);
      if (autoGaps.length === 0) autoGaps.push(`إمكانية تحسين استراتيجية المحتوى الرقمي لزيادة التفاعل والتحويل`);
      lead.biggestMarketingGap = autoGaps.join("\n");
    }

    if (!report) return;
    if (!report.recommendations) {
      const autoRecs: string[] = [];
      if (!hasWebsite) autoRecs.push(`إنشاء موقع إلكتروني احترافي لـ${biz} في ${city} مع صفحة هبوط تُبرز الخدمات وتحتوي على نموذج تواصل واضح`);
      if (hasSocial && avgSocialScore < 7) autoRecs.push(`تحسين استراتيجية المحتوى على ${socialAnalyses.map((s: any) => pm(s.platform).name).join(' و')} بنشر محتوى يومي منتظم يُظهر المنتجات والخدمات بشكل جذاب`);
      if (!lead.instagramUrl) autoRecs.push(`إنشاء حساب إنستغرام احترافي مع هوية بصرية موحدة وجدول نشر أسبوعي منتظم`);
      if (!lead.tiktokUrl) autoRecs.push(`الانطلاق على تيك توك بمقاطع قصيرة تُظهر ${biz} بأسلوب ترفيهي لاستهداف الجيل الجديد`);
      autoRecs.push(`تفعيل حملات إعلانية مدفوعة على منصات التواصل الاجتماعي لاستهداف العملاء في ${city} وزيادة الوصول`);
      report.recommendations = autoRecs.join("\n");
    }

    if (!report.executiveSummary && !report.summary) {
      const platforms = socialAnalyses.map((s: any) => pm(s.platform).name).join(" و ");
      report.executiveSummary = `يمتلك ${lead.companyName || biz} في ${city} حضوراً رقمياً ${hasSocial ? `على منصات ${platforms}` : "محدوداً"} مع إمكانات نمو واعدة. ${hasWebsite ? "الموقع الإلكتروني موجود لكن يحتاج تحسيناً." : "غياب الموقع الإلكتروني يُمثّل فرصة كبيرة للتطوير."} التحليل يُشير إلى فرص واضحة لتعزيز الحضور الرقمي وزيادة قاعدة العملاء من خلال استراتيجية تسويقية متكاملة.`;
    }

    if (!lead.revenueOpportunity) {
      lead.revenueOpportunity = `بناءً على حجم السوق في ${city} ونوع النشاط (${biz})، تُقدَّر الفرصة الإيرادية الشهرية بـ 15,000 - 45,000 ريال إضافية من خلال تحسين الحضور الرقمي واستهداف العملاء المحتملين بشكل أكثر فعالية.`;
    }

    if (!lead.entryAngle) {
      lead.entryAngle = `البدء بتقديم حزمة إدارة السوشيال ميديا المتكاملة لـ${biz} مع ضمان نتائج خلال 30 يوماً، مع تقديم تقرير أداء أسبوعي شفاف لبناء الثقة وإثبات الكفاءة.`;
    }
  }
  autoFillData();

  const coName          = company?.companyName || "مكسب";
  const coPhone         = company?.phone || "";
  const coWebsite       = company?.website || "maksab-ksa.com";
  const coEmail         = company?.email || "";
  const coLogo          = company?.logoUrl || "";
  const coCommercialReg = (company as any)?.commercialRegistration || (company as any)?.crNumber || "";
  const coAnalystName   = (company as any)?.analystName || coName;
  const coAnalystTitle  = (company as any)?.analystTitle || "محلل تسويق رقمي";
  const clLogo     = lead.clientLogoUrl || "";
  const reportDate = new Date().toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });
  const urgency    = urg(lead.urgencyLevel || lead.priority);
  const priScore   = lead.leadPriorityScore ? Number(lead.leadPriorityScore) : null;
  const qualScore  = lead.dataQualityScore  ? Number(lead.dataQualityScore)  : null;
  const wsScore    = websiteAnalysis?.overallScore ? Number(websiteAnalysis.overallScore) : null;

  // ── Phones ──
  const phones: string[] = [];
  const vp = cleanPhone(lead.verifiedPhone), lp = cleanPhone(lead.phone);
  if (vp) phones.push(vp);
  if (lp && lp !== vp) phones.push(lp);
  try {
    const arr = typeof lead.additionalPhones === "string" ? JSON.parse(lead.additionalPhones) : lead.additionalPhones;
    if (Array.isArray(arr)) arr.forEach((p: string) => { const cp = cleanPhone(p); if (cp && !phones.includes(cp)) phones.push(cp); });
  } catch {}

  // ── Gaps ──
  const gaps: string[] = [];
  if (lead.biggestMarketingGap) {
    lead.biggestMarketingGap.split(/\n|•|-/).map((s: string) => s.trim()).filter(Boolean).slice(0, 5).forEach((g: string) => gaps.push(g));
  }
  if (!gaps.length && report?.gaps) {
    try {
      const arr = typeof report.gaps === "string" ? JSON.parse(report.gaps) : report.gaps;
      if (Array.isArray(arr)) arr.slice(0, 5).forEach((g: any) => gaps.push(typeof g === "string" ? g : g.title || g.gap || ""));
    } catch {}
  }

  // ── Social ──
  const bestSocial = socialAnalyses.reduce((best: any, s: any) => {
    if (!best || (s.engagementScore || 0) > (best.engagementScore || 0)) return s;
    return best;
  }, null);

  // ── Recs ──
  const recs: string[] = [];
  if (report?.recommendations) {
    report.recommendations.split(/\n|•|-|\d+\./).map((s: string) => s.trim()).filter(Boolean).slice(0, 5).forEach((r: string) => recs.push(r));
  }
  if (!recs.length && lead.entryAngle) {
    lead.entryAngle.split(/\n/).map((s: string) => s.trim()).filter(Boolean).slice(0, 3).forEach((r: string) => recs.push(r));
  }
  // توليد توصيات تلقائية إذا لم تتوفر توصيات محفوظة
  if (!recs.length) {
    const biz2 = lead.businessType || "النشاط";
    const city2 = lead.city || "الرياض";
    if (!lead.website) recs.push(`إنشاء موقع إلكتروني احترافي لـ${biz2} في ${city2} مع صفحة هبوط تُبرز الخدمات وتحتوي على نموذج تواصل واضح`);
    if (!lead.instagramUrl) recs.push(`إنشاء حساب إنستغرام احترافي مع هوية بصرية موحدة وجدول نشر أسبوعي منتظم لبناء جمهور مخلص`);
    if (!lead.tiktokUrl) recs.push(`الانطلاق على تيك توك بمقاطع قصيرة تُظهر ${biz2} بأسلوب ترفيهي لاستهداف الجيل الجديد`);
    recs.push(`تفعيل حملات إعلانية مدفوعة على منصات التواصل الاجتماعي لاستهداف العملاء في ${city2} وزيادة الوصول`);
    recs.push(`تحسين التقييمات والسمعة الرقمية عبر استراتيجية منهجية لجمع تقييمات إيجابية وبناء ثقة العملاء الجدد`);
  }

  // ── Radar axes ──
  const radarAxes = [
    { label: "الأولوية",    value: priScore,                              market: 6 },
    { label: "الموقع",      value: wsScore,                               market: 5 },
    { label: "السوشيال",    value: bestSocial?.engagementScore ?? null,   market: 5.5 },
    { label: "المحتوى",     value: bestSocial?.contentQualityScore ?? null, market: 5 },
    { label: "SEO",          value: websiteAnalysis?.seoScore ?? null,     market: 4.5 },
    { label: "البيانات",    value: qualScore,                              market: 6 },
  ];

  // ── Calculate total missed revenue ──
  const missedImpacts = [
    "8,000 - 20,000 ريال/شهر",
    "5,000 - 15,000 ريال/شهر",
    "3,000 - 10,000 ريال/شهر",
    "2,000 - 8,000 ريال/شهر",
    "1,500 - 5,000 ريال/شهر",
  ];
  const missedSolutions = [
    "حزمة مكسب الشاملة",
    "إدارة سوشيال ميديا",
    "تصميم موقع إلكتروني",
    "حملات إعلانية مدفوعة",
    "استشارة تسويقية",
  ];
  const missedColors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#0ea5e9"];
  const missedIcons = ["⚠️", "📉", "💡", "🔗", "🎯"];

  // ── بيانات تفصيلية لكل فرصة ضائعة ──
  const biz2 = lead.businessType || "النشاط";
  const city2 = lead.city || "الرياض";
  const missedWhyItMatters = [
    `العملاء اليوم يبحثون عن ${biz2} عبر جوجل ومنصات التواصل قبل اتخاذ أي قرار — غياب حضورك الرقمي يعني أنهم يذهبون لمنافسيك مباشرةً.`,
    `المحتوى الضعيف يرسل رسالة خاطئة للعميل المحتمل: إذا كان التسويق ضعيفاً، فكيف يثق بالخدمة؟ المحتوى هو واجهتك الأولى مع كل عميل جديد.`,
    `بدون موقع إلكتروني، أنت تعتمد كلياً على التوصيات الشخصية — وهي محدودة وغير قابلة للتوسع. الموقع = موظف مبيعات يعمل 24/7.`,
    `الإعلانات المدفوعة تضعك أمام عملاء يبحثون عن ${biz2} في ${city2} الآن — بدونها أنت غير ظاهر لمن يبحث عنك.`,
    `السمعة الرقمية هي أول ما يفحصه العميل قبل الشراء — غياب التقييمات الإيجابية يجعل العميل يتردد ويذهب للمنافس.`,
  ];
  const missedActionSteps = [
    `الخطوة الأولى: نجلس معك 30 دقيقة لتحديد أولويات الحضور الرقمي ونضع خطة عمل مخصصة لـ${biz2} في ${city2}.`,
    `الخطوة الأولى: نبدأ بإعداد خطة محتوى شهرية مع جدول نشر منتظم ومحتوى يعكس هوية ${biz2} ويجذب عملاء ${city2}.`,
    `الخطوة الأولى: نصمم لك موقعاً احترافياً في 7 أيام بصفحة هبوط ونموذج تواصل وعرض خدماتك بشكل جذاب.`,
    `الخطوة الأولى: نطلق حملة إعلانية تجريبية بميزانية محدودة لقياس العائد وتحسين الاستهداف قبل التوسع.`,
    `الخطوة الأولى: نضع استراتيجية لجمع التقييمات الإيجابية من عملائك الحاليين وتعزيز سمعتك الرقمية.`,
  ];
  const missedTimeframes = [
    "نتائج خلال 30 يوم",
    "نتائج خلال 21 يوم",
    "نتائج خلال 7 أيام",
    "نتائج خلال 14 يوم",
    "نتائج خلال 30 يوم",
  ];

  // ── حساب نسبة الفجوة — من AI إن توفرت، وإلا بالحساب المحلي ──
  const avgCompPri2 = competitors.length
    ? competitors.reduce((s: number, c: any) => s + (Number(c.leadPriorityScore) || 0), 0) / competitors.length
    : 0;
  const gapPercentages: number[] = gaps.map((_, i) => {
    // إذا توفرت نسب AI من السيرفر، استخدمها مباشرة
    if (aiGapPercentages && aiGapPercentages[i] !== undefined) {
      return aiGapPercentages[i];
    }
    // فول باك: حساب محلي بسيط
    const base = [40, 35, 30, 25, 20];
    if (i === 0 && priScore !== null && avgCompPri2 > 0) {
      const diff = Math.max(0, avgCompPri2 - (priScore || 0));
      return Math.round((diff / avgCompPri2) * 100);
    }
    return base[i % base.length];
  });

  // ── ترتيب التوصيات حسب الموسم النشط ──
  if (activeSeason && recs.length > 1) {
    // كلمات مفتاحية للموسم من الاسم والوصف والفرص
    const seasonKeywords: string[] = [
      ...(activeSeason.name || '').split(/\s+/),
      ...(activeSeason.description || '').split(/\s+/).slice(0, 10),
      ...(activeSeason.keyOpportunities || []).join(' ').split(/\s+/).slice(0, 15),
      ...(activeSeason.guidance || '').split(/\s+/).slice(0, 10),
    ].map((w: string) => w.replace(/[^\u0600-\u06FFa-zA-Z]/g, '').toLowerCase()).filter((w: string) => w.length > 2);

    // كلمات إضافية حسب نوع الموسم الشائعة
    const seasonTypeMap: Record<string, string[]> = {
      رمضان: ['محتوى', 'عروض', 'خصومات', 'تواصل', 'إعلان', 'سوشيال'],
      صيف: ['سياحة', 'ترفيه', 'نشاط', 'عروض', 'إعلان'],
      عيد: ['عروض', 'خصومات', 'هدايا', 'إعلان', 'محتوى'],
      'الوطني': ['هوية', 'محتوى', 'إعلان', 'سوشيال'],
      'اليوم الوطني': ['هوية', 'محتوى', 'إعلان', 'سوشيال'],
      'الجمعة البيضاء': ['خصومات', 'عروض', 'إعلان', 'موقع'],
      'بلاك فرايدي': ['خصومات', 'عروض', 'إعلان', 'موقع'],
      'موسم الرياض': ['ترفيه', 'نشاط', 'إعلان', 'سوشيال', 'محتوى'],
    };
    const seasonNameLower = (activeSeason.name || '').toLowerCase();
    for (const [key, words] of Object.entries(seasonTypeMap)) {
      if (seasonNameLower.includes(key.toLowerCase())) {
        seasonKeywords.push(...words);
        break;
      }
    }

    // حساب درجة ارتباط كل توصية بالموسم
    const scoredRecs = recs.map((rec: string) => {
      const recWords = rec.split(/\s+/).map((w: string) => w.replace(/[^\u0600-\u06FFa-zA-Z]/g, '').toLowerCase());
      const score = recWords.reduce((s: number, w: string) => {
        return s + (seasonKeywords.includes(w) ? 2 : 0);
      }, 0);
      return { rec, score };
    });

    // ترتيب: التوصيات المرتبطة بالموسم تأتي أولاً، ثم الباقي بترتيبه الأصلي
    const seasonRelated = scoredRecs.filter((x: any) => x.score > 0).sort((a: any, b: any) => b.score - a.score);
    const notRelated = scoredRecs.filter((x: any) => x.score === 0);
    const sortedRecs = [...seasonRelated, ...notRelated].map((x: any) => x.rec);

    // استبدال recs بالترتيب الجديد
    recs.length = 0;
    sortedRecs.forEach((r: string) => recs.push(r));
  }

  // ── تنبيه الموسم للفرص الضائعة ──
  const seasonName = activeSeason?.name || '';
  const seasonAlerts: (string | undefined)[] = gaps.map((g, i) => {
    if (!seasonName) return undefined;
    if (i === 0) return `هذه الفرصة أكثر إلحاحاً في موسم ${seasonName} — الآن هو الوقت المثالي للتحرك`;
    if (i === 1) return `منافسوك يستغلون موسم ${seasonName} الآن — لا تتأخر`;
    return undefined;
  });

  const safeLeadName = (lead.companyName || "عميل").replace(/[\/\\?%*:|"<>]/g, "-");
  const fileName = `تقرير تنفيذي - ${safeLeadName}.pdf`;
  // ── WhatsApp phone for QR ──
  const waPhone = coPhone || phones[0] || "";
  // ── Pre-generate QR Data URLs ──
  const waQR44   = waPhone ? await generateQRDataURL(`https://wa.me/${waPhone.replace(/\D/g, "")}`) : "";
  const crQR44   = coCommercialReg ? await generateQRDataURL(coCommercialReg) : "";
  const waQR60   = waPhone ? await generateQRDataURL(`https://wa.me/${waPhone.replace(/\D/g, "")}`) : "";
  const crQR60   = coCommercialReg ? await generateQRDataURL(coCommercialReg) : "";
  const waQR80   = waPhone ? await generateQRDataURL(`https://wa.me/${waPhone.replace(/\D/g, "")}`) : "";
  const waQR85   = waPhone ? await generateQRDataURL(`https://wa.me/${waPhone.replace(/\D/g, "")}`) : "";
  // ── Signature page QR codes ──
  const signWaQR  = waPhone ? await generateQRDataURL(`https://wa.me/${waPhone.replace(/\D/g, "")}`) : "";
  const signCrQR  = coCommercialReg ? await generateQRDataURL(coCommercialReg) : "";
  // ── Report Reference Number ──
  const reportRef = `RPT-${Date.now().toString(36).toUpperCase()}-${(lead.id || 0).toString().padStart(4, '0')}`;
  const qrImg = (dataUrl: string, size: number) =>
    dataUrl ? `<img src="${dataUrl}" width="${size}" height="${size}" style="border-radius:6px;display:block;" />` : "";

  // ═══════════════════════════════════════════════════════════════════════
  //  PAGE 0 — MAKSAB WELCOME PAGE (صفحة استقبال مكسب)
  // ═══════════════════════════════════════════════════════════════════════
  const p0 = page(`
    <!-- خلفية زخرفية متدرجة -->
    <div style="position:absolute;top:0;left:0;right:0;bottom:0;
      background:linear-gradient(160deg,#020810 0%,#040d1e 40%,#061428 70%,#020810 100%);
      pointer-events:none;"></div>

    <!-- دوائر ضوئية زخرفية -->
    <div style="position:absolute;top:-120px;right:-120px;width:500px;height:500px;border-radius:50%;
      background:radial-gradient(circle,rgba(34,197,94,0.07) 0%,transparent 65%);pointer-events:none;"></div>
    <div style="position:absolute;bottom:-100px;left:-100px;width:450px;height:450px;border-radius:50%;
      background:radial-gradient(circle,rgba(14,165,233,0.06) 0%,transparent 65%);pointer-events:none;"></div>
    <div style="position:absolute;top:40%;right:30%;width:300px;height:300px;border-radius:50%;
      background:radial-gradient(circle,rgba(167,139,250,0.03) 0%,transparent 70%);pointer-events:none;"></div>

    <!-- شريط علوي فاخر -->
    <div style="padding:16px 40px;display:flex;align-items:center;justify-content:space-between;
      background:rgba(0,0,0,0.25);border-bottom:1px solid rgba(34,197,94,0.15);">
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="width:8px;height:8px;border-radius:50%;background:#22c55e;box-shadow:0 0 10px #22c55e;"></div>
        <div style="width:6px;height:6px;border-radius:50%;background:#0ea5e9;box-shadow:0 0 8px #0ea5e9;"></div>
        <div style="width:4px;height:4px;border-radius:50%;background:#a78bfa;box-shadow:0 0 6px #a78bfa;"></div>
      </div>
      <div style="font-size:9px;color:#334155;letter-spacing:2px;font-weight:600;">MAKSAB · وكالة تسويق رقمي · المملكة العربية السعودية</div>
      <div style="font-size:9px;color:#334155;">${reportDate}</div>
    </div>

    <!-- قسم الشعار والهوية الرئيسية -->
    <div style="padding:40px 40px 28px;text-align:center;position:relative;">
      <!-- شعار مكسب -->
      <div style="margin-bottom:24px;display:flex;justify-content:center;">
        ${coLogo
          ? `<div style="padding:16px 24px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:20px;display:inline-block;">
               <img src="${coLogo}" style="height:70px;width:auto;max-width:220px;" alt="${coName}">
             </div>`
          : `<div style="display:inline-flex;flex-direction:column;align-items:center;gap:8px;">
               <div style="width:90px;height:90px;border-radius:24px;
                 background:linear-gradient(135deg,#16a34a 0%,#22c55e 50%,#0ea5e9 100%);
                 display:flex;align-items:center;justify-content:center;
                 font-size:42px;font-weight:900;color:white;
                 box-shadow:0 0 40px rgba(34,197,94,0.4),0 0 80px rgba(34,197,94,0.15);
                 border:2px solid rgba(34,197,94,0.3);">م</div>
             </div>`
        }
      </div>

      <!-- اسم الشركة -->
      <div style="font-size:52px;font-weight:900;color:#f8fafc;letter-spacing:2px;margin-bottom:6px;
        text-shadow:0 0 60px rgba(34,197,94,0.2),0 0 120px rgba(34,197,94,0.08);">${coName}</div>
      <div style="font-size:14px;color:#22c55e;font-weight:700;letter-spacing:3px;margin-bottom:6px;">وكالة التسويق الرقمي المتخصصة</div>
      <div style="font-size:11px;color:#475569;letter-spacing:1px;">المملكة العربية السعودية · خبرة أكثر من 5 سنوات في السوق السعودي</div>

      <!-- خط فاصل مضيء -->
      <div style="margin:20px auto;width:200px;height:2px;
        background:linear-gradient(90deg,transparent,#22c55e,#0ea5e9,transparent);
        border-radius:2px;box-shadow:0 0 12px rgba(34,197,94,0.5);"></div>
    </div>

    <!-- قسم الشرح والخدمات -->
    <div style="padding:0 40px 24px;">
      <!-- عنوان القسم -->
      <div style="text-align:center;margin-bottom:20px;">
        <div style="display:inline-flex;align-items:center;gap:8px;padding:6px 20px;
          background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:20px;">
          <div style="width:6px;height:6px;border-radius:50%;background:#22c55e;box-shadow:0 0 8px #22c55e;"></div>
          <span style="font-size:11px;color:#22c55e;font-weight:800;letter-spacing:1px;">من نحن وماذا نقدم</span>
        </div>
      </div>

      <!-- بطاقة الوصف الرئيسي -->
      <div style="margin-bottom:18px;padding:20px 24px;
        background:linear-gradient(135deg,rgba(34,197,94,0.05) 0%,rgba(14,165,233,0.04) 100%);
        border:1px solid rgba(34,197,94,0.15);border-radius:16px;position:relative;overflow:hidden;">
        <div style="position:absolute;top:-20px;left:-20px;width:120px;height:120px;border-radius:50%;
          background:radial-gradient(circle,rgba(34,197,94,0.06) 0%,transparent 70%);pointer-events:none;"></div>
        <div style="font-size:13px;color:#cbd5e1;line-height:2;text-align:center;position:relative;z-index:1;">
          <strong style="color:#f1f5f9;font-size:15px;">مكسب</strong> هي وكالة تسويق رقمي سعودية متخصصة في مساعدة الأنشطة التجارية على
          <strong style="color:#22c55e;"> بناء حضور رقمي قوي</strong>، تحقيق نمو مستدام، وتحويل الزوار إلى عملاء حقيقيين.
          نعمل مع أصحاب الأعمال في جميع مناطق المملكة لتقديم حلول تسويقية مخصصة ومبنية على بيانات حقيقية.
        </div>
      </div>

      <!-- شبكة الخدمات -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px;">
        ${[
          { icon: '📱', title: 'إدارة السوشيال ميديا', desc: 'محتوى إبداعي يومي على إنستغرام، تيك توك، سناب شات وتويتر', color: '#e1306c' },
          { icon: '🌐', title: 'تصميم المواقع', desc: 'مواقع احترافية سريعة ومتجاوبة مع جميع الأجهزة', color: '#0ea5e9' },
          { icon: '🎯', title: 'الإعلانات المدفوعة', desc: 'حملات جوجل وميتا وسناب شات بعائد استثمار مضمون', color: '#f97316' },
          { icon: '🔍', title: 'تحسين محركات البحث', desc: 'تصدر نتائج جوجل وزيادة الزيارات العضوية المجانية', color: '#22c55e' },
          { icon: '🤖', title: 'تحليل بالذكاء الاصطناعي', desc: 'تقارير تحليلية عميقة مبنية على بيانات حقيقية من السوق', color: '#a78bfa' },
          { icon: '📊', title: 'استراتيجية التسويق', desc: 'خطط تسويقية مخصصة لكل نشاط وكل مدينة في السعودية', color: '#eab308' },
        ].map(s => `
        <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);
          border-radius:12px;padding:12px 14px;border-top:2px solid ${s.color}22;
          transition:all 0.2s;">
          <div style="font-size:20px;margin-bottom:6px;">${s.icon}</div>
          <div style="font-size:10.5px;font-weight:800;color:#e2e8f0;margin-bottom:4px;">${s.title}</div>
          <div style="font-size:9px;color:#475569;line-height:1.6;">${s.desc}</div>
        </div>`).join('')}
      </div>

      <!-- أرقام الإنجاز -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px;">
        ${[
          { num: '+500', label: 'عميل راضٍ', color: '#22c55e' },
          { num: '+5', label: 'سنوات خبرة', color: '#0ea5e9' },
          { num: '+20', label: 'مدينة سعودية', color: '#a78bfa' },
          { num: '24/7', label: 'دعم متواصل', color: '#eab308' },
        ].map(n => `
        <div style="text-align:center;padding:14px 8px;
          background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);
          border-radius:12px;">
          <div style="font-size:26px;font-weight:900;color:${n.color};
            text-shadow:0 0 20px ${n.color}66;line-height:1;margin-bottom:4px;">${n.num}</div>
          <div style="font-size:9px;color:#64748b;font-weight:600;">${n.label}</div>
        </div>`).join('')}
      </div>

      <!-- رسالة الترحيب بالعميل -->
      <div style="padding:20px 24px;
        background:linear-gradient(135deg,rgba(14,165,233,0.06) 0%,rgba(167,139,250,0.04) 100%);
        border:1px solid rgba(14,165,233,0.2);border-radius:16px;
        position:relative;overflow:hidden;">
        <div style="position:absolute;top:-30px;right:-30px;width:150px;height:150px;border-radius:50%;
          background:radial-gradient(circle,rgba(14,165,233,0.08) 0%,transparent 70%);pointer-events:none;"></div>
        <div style="display:flex;align-items:flex-start;gap:14px;position:relative;z-index:1;">
          <div style="font-size:32px;flex-shrink:0;">🤝</div>
          <div>
            <div style="font-size:13px;font-weight:800;color:#7dd3fc;margin-bottom:8px;">أهلاً وسهلاً بك في مكسب</div>
            <div style="font-size:11px;color:#94a3b8;line-height:1.9;">
              يسعدنا تقديم هذا التقرير التحليلي المخصص لـ
              <strong style="color:#f1f5f9;">${lead.companyName || 'نشاطك التجاري'}</strong>.
              لقد أجرينا تحليلاً شاملاً لحضورك الرقمي وقارنّاه بالسوق والمنافسين،
              وأعددنا لك خارطة طريق واضحة لتحقيق نمو ملموس.
              <strong style="color:#22c55e;">هذا التقرير هو بداية شراكة نجاح حقيقية.</strong>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- فوتر الصفحة -->
    <div style="position:absolute;bottom:0;left:0;right:0;padding:10px 40px;
      background:rgba(0,0,0,0.4);border-top:1px solid rgba(255,255,255,0.04);
      display:flex;align-items:center;justify-content:space-between;">
      <div style="font-size:9px;color:#334155;">© ${new Date().getFullYear()} ${coName} — جميع الحقوق محفوظة</div>
      <div style="display:flex;align-items:center;gap:6px;">
        ${waPhone ? `<span style="font-size:9px;color:#334155;">📱 ${waPhone}</span>` : ''}
        ${coWebsite ? `<span style="font-size:9px;color:#334155;">· 🌐 ${coWebsite}</span>` : ''}
      </div>
    </div>

    <!-- علامة مائية -->
    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);
      font-size:64px;font-weight:900;color:rgba(34,197,94,0.018);white-space:nowrap;
      pointer-events:none;z-index:0;letter-spacing:6px;">مكسب للتسويق الرقمي</div>
  `);

  // ═══════════════════════════════════════════════════════════════════════
  //  PAGE 1 — EXECUTIVE COVER (DARK)
  // ═══════════════════════════════════════════════════════════════════════
  const p1 = page(`
    <!-- Decorative bg elements -->
    <div style="position:absolute;top:-80px;right:-80px;width:350px;height:350px;border-radius:50%;
      background:radial-gradient(circle,rgba(34,197,94,0.06) 0%,transparent 70%);pointer-events:none;"></div>
    <div style="position:absolute;bottom:-100px;left:-60px;width:400px;height:400px;border-radius:50%;
      background:radial-gradient(circle,rgba(14,165,233,0.05) 0%,transparent 70%);pointer-events:none;"></div>

    <!-- TOP HEADER BAR — Company Info -->
    <div style="padding:18px 40px 16px;display:flex;align-items:center;justify-content:space-between;
      border-bottom:1px solid rgba(255,255,255,0.06);background:rgba(0,0,0,0.3);">
      <!-- Company Brand -->
      <div style="display:flex;align-items:center;gap:14px;">
        ${coLogo
          ? `<img src="${coLogo}" style="height:44px;width:auto;border-radius:10px;border:1px solid rgba(255,255,255,0.1);padding:4px;background:rgba(255,255,255,0.05);" alt="logo">`
          : `<div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#22c55e,#0ea5e9);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:900;color:white;box-shadow:0 0 20px rgba(34,197,94,0.4);">${coName.charAt(0)}</div>`}
        <div>
          <div style="font-size:20px;font-weight:900;color:#f1f5f9;letter-spacing:0.5px;">${coName}</div>
          <div style="font-size:9px;color:#475569;margin-top:2px;letter-spacing:1.5px;">وكالة تسويق رقمي متخصصة · المملكة العربية السعودية</div>
          <!-- QR Code badges -->
          <div style="display:flex;gap:10px;margin-top:8px;align-items:center;">
            ${waQR44 ? `
            <div style="display:flex;flex-direction:column;align-items:center;gap:3px;">
              <div style="padding:3px;background:white;border-radius:6px;">${qrImg(waQR44, 44)}</div>
              <div style="font-size:7px;color:#86efac;font-weight:700;letter-spacing:0.5px;">واتساب</div>
            </div>` : ''}
            ${crQR44 ? `
            <div style="display:flex;flex-direction:column;align-items:center;gap:3px;">
              <div style="padding:3px;background:white;border-radius:6px;">${qrImg(crQR44, 44)}</div>
              <div style="font-size:7px;color:#7dd3fc;font-weight:700;letter-spacing:0.5px;">السجل التجاري</div>
            </div>` : ''}
          </div>
        </div>
      </div>
      <!-- Report Meta -->
      <div style="text-align:left;">
        <div style="font-size:9px;color:#475569;margin-bottom:3px;letter-spacing:0.5px;">تاريخ الإصدار</div>
        <div style="font-size:13px;font-weight:700;color:#94a3b8;">${reportDate}</div>
        <div style="margin-top:8px;padding:4px 14px;background:${urgency.bg};border:1px solid ${urgency.border};
          border-radius:20px;font-size:10px;font-weight:800;color:${urgency.color};display:inline-block;
          box-shadow:0 0 12px ${urgency.border};">${urgency.text}</div>
      </div>
    </div>

    <!-- Client hero section -->
    <div style="padding:36px 40px 28px;text-align:center;position:relative;">
      ${clLogo ? `<div style="margin-bottom:20px;"><img src="${clLogo}" style="height:80px;width:auto;max-width:200px;border-radius:14px;border:2px solid rgba(255,255,255,0.1);padding:8px;background:rgba(255,255,255,0.04);" alt="client logo"></div>` : ""}
      <div style="font-size:10px;color:#475569;font-weight:700;letter-spacing:3px;margin-bottom:8px;text-transform:uppercase;">تقرير تنفيذي مخصص لعناية</div>
      <div style="font-size:40px;font-weight:900;color:#f8fafc;margin-bottom:8px;
        text-shadow:0 0 50px rgba(34,197,94,0.25);letter-spacing:0.5px;">${lead.companyName || "العميل"}</div>
      <div style="font-size:14px;color:#64748b;margin-bottom:18px;">
        ${lead.businessType || ""} ${lead.city ? `<span style="color:#334155;margin:0 6px;">·</span> ${lead.city}` : ""}
      </div>
      <div style="display:inline-flex;align-items:center;gap:10px;padding:10px 24px;
        background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:24px;
        box-shadow:0 0 20px rgba(34,197,94,0.1);">
        <div style="width:6px;height:6px;border-radius:50%;background:#22c55e;box-shadow:0 0 8px #22c55e;"></div>
        <span style="font-size:12px;color:#22c55e;font-weight:700;letter-spacing:0.5px;">تحليل رقمي شامل · 5 محاور رئيسية</span>
      </div>
    </div>

    <!-- KEY METRICS — Big Numbers -->
    <div style="padding:0 40px 24px;">
      <div style="font-size:10px;color:#334155;font-weight:700;text-align:center;margin-bottom:14px;
        letter-spacing:2px;">المؤشرات الرئيسية</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;">
        ${[
          { v: priScore !== null ? priScore.toFixed(1) : "—",   label: "درجة الأولوية",   sub: "من 10",      color: sc(priScore) },
          { v: qualScore !== null ? qualScore.toFixed(1) : "—", label: "جودة البيانات",   sub: "من 10",      color: sc(qualScore) },
          { v: wsScore !== null ? wsScore.toFixed(1) : "—",     label: "تقييم الموقع",    sub: "من 10",      color: sc(wsScore) },
          { v: bestSocial?.engagementScore ? Number(bestSocial.engagementScore).toFixed(1) : "—", label: "التفاعل الرقمي", sub: "من 10", color: sc(bestSocial?.engagementScore) },
        ].map(({ v, label, sub, color }) => `
        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);
          border-radius:14px;padding:16px 10px;text-align:center;
          border-top:2px solid ${color};">
          <div style="font-size:34px;font-weight:900;color:${color};
            text-shadow:0 0 20px ${color}66;line-height:1;margin-bottom:6px;">${v}</div>
          <div style="font-size:10px;color:#94a3b8;font-weight:700;">${label}</div>
          <div style="font-size:9px;color:#334155;margin-top:2px;">${sub}</div>
        </div>`).join("")}
      </div>
    </div>

    <!-- Contact info -->
    <div style="padding:0 40px 20px;">
      <div style="font-size:10px;color:#334155;font-weight:700;margin-bottom:10px;letter-spacing:1px;">معلومات الاتصال</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 30px;">
        ${infoRow("الهاتف", phones.slice(0, 2).join(" | "), "📞")}
        ${infoRow("الموقع", cleanUrl(lead.website), "🌐")}
        ${infoRow("إنستغرام", cleanUrl(lead.instagramUrl, "instagram"), "📸")}
        ${infoRow("تيك توك", cleanUrl(lead.tiktokUrl, "tiktok"), "🎵")}
        ${infoRow("سناب شات", cleanUrl(lead.snapchatUrl, "snapchat"), "👻")}
        ${infoRow("تويتر", cleanUrl(lead.twitterUrl, "twitter"), "🐦")}
      </div>
    </div>

    <!-- Missed Revenue Teaser -->
    <div style="margin:0 40px 20px;padding:14px 20px;
      background:linear-gradient(135deg,rgba(239,68,68,0.08),rgba(249,115,22,0.06));
      border:1px solid rgba(239,68,68,0.2);border-radius:14px;
      display:flex;align-items:center;justify-content:space-between;">
      <div>
        <div style="font-size:11px;color:#ef4444;font-weight:800;margin-bottom:4px;">⚠️ تنبيه: إيراد ضائع يمكن استعادته</div>
        <div style="font-size:10px;color:#94a3b8;">بناءً على التحليل، هناك فرص إيرادية غير مستغلة تحتاج معالجة فورية</div>
      </div>
      <div style="text-align:center;padding:8px 16px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:12px;">
        <div style="font-size:18px;font-weight:900;color:#ef4444;">15K+</div>
        <div style="font-size:8px;color:#64748b;">ريال/شهر</div>
      </div>
    </div>

    <!-- Footer -->
    <div style="position:absolute;bottom:0;left:0;right:0;padding:10px 40px;
      background:rgba(0,0,0,0.4);border-top:1px solid rgba(255,255,255,0.04);
      display:flex;align-items:center;justify-content:space-between;">
      <div style="font-size:9px;color:#334155;">حصري من ${coName} — جميع الحقوق محفوظة © ${new Date().getFullYear()}</div>
      <div style="font-size:9px;color:#334155;">CONFIDENTIAL · صفحة 1 من 5</div>
    </div>

    <!-- Watermark -->
    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);
      font-size:64px;font-weight:900;color:rgba(34,197,94,0.025);white-space:nowrap;
      pointer-events:none;z-index:0;letter-spacing:6px;">حصري من ${coName}</div>
  `);

  // ═══════════════════════════════════════════════════════════════════════
  //  PAGE 2 — EXECUTIVE SUMMARY + MISSED OPPORTUNITIES (DARK)
  // ═══════════════════════════════════════════════════════════════════════
  const execSummary = report?.executiveSummary || report?.summary || lead.revenueOpportunity || "";
  const entryAngle  = lead.entryAngle || report?.entryAngle || "";
  const revenueOpp  = lead.revenueOpportunity || "";

  const p2 = page(`
    <!-- Decorative -->
    <div style="position:absolute;top:-60px;left:-60px;width:300px;height:300px;border-radius:50%;
      background:radial-gradient(circle,rgba(14,165,233,0.05) 0%,transparent 70%);pointer-events:none;"></div>

    ${pageHeader("الملخص التنفيذي", "تقييم شامل للحضور الرقمي والفرص المتاحة", "صفحة 2/5", coName, lead)}

    <div style="padding:20px 40px;">

      <!-- Three pillars: Performance | Gap | Opportunity -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px;">
        <div style="background:rgba(14,165,233,0.06);border:1px solid rgba(14,165,233,0.2);
          border-radius:14px;padding:16px;text-align:center;">
          <div style="font-size:10px;color:#7dd3fc;font-weight:700;margin-bottom:8px;letter-spacing:1px;">مستوى الأداء</div>
          <div style="font-size:36px;font-weight:900;color:#0ea5e9;
            text-shadow:0 0 20px rgba(14,165,233,0.6);line-height:1;">${priScore !== null ? priScore.toFixed(1) : "—"}</div>
          <div style="font-size:9px;color:#475569;margin-top:4px;">من 10 نقاط</div>
        </div>
        <div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);
          border-radius:14px;padding:16px;text-align:center;">
          <div style="font-size:10px;color:#fca5a5;font-weight:700;margin-bottom:8px;letter-spacing:1px;">الفجوة الرقمية</div>
          <div style="font-size:36px;font-weight:900;color:#ef4444;
            text-shadow:0 0 20px rgba(239,68,68,0.6);line-height:1;">${gaps.length}</div>
          <div style="font-size:9px;color:#475569;margin-top:4px;">ثغرة تسويقية</div>
        </div>
        <div style="background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.2);
          border-radius:14px;padding:16px;text-align:center;">
          <div style="font-size:10px;color:#86efac;font-weight:700;margin-bottom:8px;letter-spacing:1px;">الفرصة المالية</div>
          <div style="font-size:28px;font-weight:900;color:#22c55e;
            text-shadow:0 0 20px rgba(34,197,94,0.6);line-height:1;">15K+</div>
          <div style="font-size:9px;color:#475569;margin-top:4px;">ريال/شهر</div>
        </div>
      </div>

      <!-- Executive summary -->
      ${execSummary ? `
      <div style="margin-bottom:18px;">
        ${sh("نظرة عامة على الوضع الحالي")}
        <div style="background:rgba(14,165,233,0.06);border:1px solid rgba(14,165,233,0.15);
          border-right:4px solid #0ea5e9;border-radius:0 12px 12px 0;padding:14px 18px;">
          <p style="font-size:12px;color:#cbd5e1;line-height:1.9;margin:0;">${cleanMarkdown(execSummary)}</p>
        </div>
      </div>` : ""}

      <!-- MISSED OPPORTUNITIES — Main Section -->
      ${gaps.length ? `
      <div style="margin-bottom:18px;">
        ${sh("الفرص الضائعة وتأثيرها المالي المباشر", "كل ثغرة = خسارة شهرية يمكن تحويلها لإيراد")}        ${gaps.map((g, i) => missedOppCard(
          g,
          missedImpacts[i % missedImpacts.length],
          missedSolutions[i % missedSolutions.length],
          missedColors[i % missedColors.length],
          missedIcons[i % missedIcons.length],
          missedWhyItMatters[i % missedWhyItMatters.length],
          missedActionSteps[i % missedActionSteps.length],
          missedTimeframes[i % missedTimeframes.length],
          gapPercentages[i] || 0,
          seasonAlerts[i]
        )).join("")}}
      </div>` : ""}

      <!-- Revenue & Entry -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px;">
        ${revenueOpp ? `
        <div>
          ${sh("الفرصة الإيرادية المتاحة")}
          ${card(`<p style="font-size:11.5px;color:#94a3b8;line-height:1.8;margin:0;">${cleanMarkdown(revenueOpp)}</p>`, "#22c55e")}
        </div>` : ""}
        ${entryAngle ? `
        <div>
          ${sh("زاوية الدخول المقترحة")}
          ${card(`<p style="font-size:11.5px;color:#94a3b8;line-height:1.8;margin:0;">${cleanMarkdown(entryAngle)}</p>`, "#0ea5e9")}
        </div>` : ""}
      </div>

      <!-- خطة مكسب 90 يوم -->
      <div style="margin-bottom:18px;background:linear-gradient(135deg,rgba(34,197,94,0.04),rgba(14,165,233,0.03));
        border:1px solid rgba(34,197,94,0.2);border-radius:14px;padding:16px 20px;">
        <div style="font-size:12px;font-weight:800;color:#22c55e;margin-bottom:12px;display:flex;align-items:center;gap:8px;">
          <span style="font-size:16px;">🚀</span>
          <span>خطة مكسب للعمل معك — 90 يوماً لتحويل الفرص لنتائج</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
          <div style="background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.2);border-radius:10px;padding:12px;">
            <div style="font-size:9px;color:#86efac;font-weight:800;margin-bottom:6px;letter-spacing:1px;">📅 الشهر الأول (1-30 يوم)</div>
            <div style="font-size:9.5px;color:#94a3b8;line-height:1.7;">
              إعداد الهوية البصرية وإطلاق الحضور الرقمي الأساسي. تفعيل الحسابات وبدء نشر محتوى يومي منتظم يعكس قيمة ${lead.companyName || 'النشاط'}.
            </div>
            <div style="margin-top:8px;padding:4px 10px;background:rgba(34,197,94,0.1);border-radius:8px;">
              <div style="font-size:9px;color:#22c55e;font-weight:700;">✅ الهدف: حضور رقمي متكامل</div>
            </div>
          </div>
          <div style="background:rgba(14,165,233,0.06);border:1px solid rgba(14,165,233,0.2);border-radius:10px;padding:12px;">
            <div style="font-size:9px;color:#7dd3fc;font-weight:800;margin-bottom:6px;letter-spacing:1px;">📅 الشهر الثاني (31-60 يوم)</div>
            <div style="font-size:9.5px;color:#94a3b8;line-height:1.7;">
              إطلاق حملات إعلانية مستهدفة وقياس النتائج. تحسين المحتوى بناءً على التفاعل وبناء جمهور متفاعل في ${city2}.
            </div>
            <div style="margin-top:8px;padding:4px 10px;background:rgba(14,165,233,0.1);border-radius:8px;">
              <div style="font-size:9px;color:#0ea5e9;font-weight:700;">✅ الهدف: أول عملاء جدد</div>
            </div>
          </div>
          <div style="background:rgba(167,139,250,0.06);border:1px solid rgba(167,139,250,0.2);border-radius:10px;padding:12px;">
            <div style="font-size:9px;color:#c4b5fd;font-weight:800;margin-bottom:6px;letter-spacing:1px;">📅 الشهر الثالث (61-90 يوم)</div>
            <div style="font-size:9.5px;color:#94a3b8;line-height:1.7;">
              توسيع الحملات وبناء قناة مبيعات رقمية مستدامة. تحويل المتابعين لعملاء فعليين وقياس العائد على الاستثمار.
            </div>
            <div style="margin-top:8px;padding:4px 10px;background:rgba(167,139,250,0.1);border-radius:8px;">
              <div style="font-size:9px;color:#a78bfa;font-weight:700;">✅ الهدف: نمو مستدام</div>
            </div>
          </div>
        </div>
      </div>

      <!-- KPI bars -->
      <div>
        ${sh("مؤشرات الأداء الرئيسية")}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 30px;">
          ${bar(priScore, "درجة الأولوية التسويقية")}
          ${bar(qualScore, "جودة وشمولية البيانات")}
          ${bar(wsScore, "تقييم الموقع الإلكتروني")}
          ${bar(bestSocial?.engagementScore, "التفاعل على السوشيال ميديا")}
          ${bar(websiteAnalysis?.seoScore, "تحسين محركات البحث SEO")}
          ${bar(websiteAnalysis?.mobileScore, "تجربة المستخدم على الجوال")}
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div style="position:absolute;bottom:0;left:0;right:0;padding:10px 40px;
      background:rgba(0,0,0,0.3);border-top:1px solid rgba(255,255,255,0.04);
      display:flex;align-items:center;justify-content:space-between;">
      <div style="font-size:9px;color:#334155;">${coName} · تقرير سري ومخصص</div>
      <div style="font-size:9px;color:#334155;">صفحة 2 من 5</div>
    </div>
  `);

  // ═══════════════════════════════════════════════════════════════════════
  //  PAGE 3 — DIGITAL ANALYSIS + RADAR (DARK)
  // ═══════════════════════════════════════════════════════════════════════
  const p3 = page(`
    <!-- Decorative -->
    <div style="position:absolute;top:-80px;right:-80px;width:320px;height:320px;border-radius:50%;
      background:radial-gradient(circle,rgba(34,197,94,0.04) 0%,transparent 70%);pointer-events:none;"></div>

    ${pageHeader("التحليل الرقمي التفصيلي", "تقييم الموقع الإلكتروني والمنصات الاجتماعية", "صفحة 3/5", coName, lead)}

    <div style="padding:18px 40px;">

      <!-- Three pillars for this page -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:18px;">
        <div style="background:rgba(14,165,233,0.06);border:1px solid rgba(14,165,233,0.2);border-radius:12px;padding:12px;text-align:center;">
          <div style="font-size:9px;color:#7dd3fc;font-weight:700;margin-bottom:6px;">مستوى الأداء الرقمي</div>
          <div style="font-size:28px;font-weight:900;color:#0ea5e9;text-shadow:0 0 15px rgba(14,165,233,0.6);">${wsScore !== null ? wsScore.toFixed(1) : "—"}</div>
          <div style="font-size:8px;color:#475569;margin-top:2px;">تقييم الموقع / 10</div>
        </div>
        <div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);border-radius:12px;padding:12px;text-align:center;">
          <div style="font-size:9px;color:#fca5a5;font-weight:700;margin-bottom:6px;">الفجوة التقنية</div>
          <div style="font-size:28px;font-weight:900;color:#ef4444;text-shadow:0 0 15px rgba(239,68,68,0.6);">${wsScore !== null ? (10 - wsScore).toFixed(1) : "—"}</div>
          <div style="font-size:8px;color:#475569;margin-top:2px;">نقطة تحسين ممكنة</div>
        </div>
        <div style="background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.2);border-radius:12px;padding:12px;text-align:center;">
          <div style="font-size:9px;color:#86efac;font-weight:700;margin-bottom:6px;">الفرصة الرقمية</div>
          <div style="font-size:28px;font-weight:900;color:#22c55e;text-shadow:0 0 15px rgba(34,197,94,0.6);">${socialAnalyses.length}</div>
          <div style="font-size:8px;color:#475569;margin-top:2px;">منصة محللة</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">

        <!-- Left: Website + Social bars -->
        <div>
          <!-- Website -->
          <div style="margin-bottom:16px;">
            ${sh("تحليل الموقع الإلكتروني", lead.website ? cleanUrl(lead.website) : "لا يوجد موقع")}
            ${wsScore !== null ? `
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;">
              ${[
                { v: wsScore,                           label: "الكلي",   color: sc(wsScore) },
                { v: websiteAnalysis?.speedScore,       label: "السرعة",  color: sc(websiteAnalysis?.speedScore) },
                { v: websiteAnalysis?.mobileScore,      label: "الجوال",  color: sc(websiteAnalysis?.mobileScore) },
              ].map(({ v, label, color }) => `
              <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);
                border-radius:10px;padding:12px 8px;text-align:center;border-top:2px solid ${color};">
                <div style="font-size:22px;font-weight:900;color:${color};text-shadow:0 0 12px ${color}66;">${fmt(v)}</div>
                <div style="font-size:9px;color:#475569;margin-top:4px;font-weight:600;">${label}</div>
              </div>`).join("")}
            </div>
            ${bar(websiteAnalysis?.seoScore, "تحسين SEO")}
            ${bar(websiteAnalysis?.contentQualityScore, "جودة المحتوى")}
            ${bar(websiteAnalysis?.designScore, "التصميم والتجربة")}
            ${bar(websiteAnalysis?.conversionScore, "وضوح العروض والـ CTA")}
            ` : `${card('<div style="text-align:center;padding:10px;font-size:11px;color:#475569;">لم يتم تحليل الموقع بعد</div>', "#475569")}`}
          </div>

          <!-- Social -->
          <div>
            ${sh("تحليل السوشيال ميديا", bestSocial ? `أفضل منصة: ${pm(bestSocial.platform).name}` : "")}
            ${bestSocial ? `
            ${(() => {
              const extra = parseSocialExtra(bestSocial.rawData);
              const followers = extra.followers || extra.followersCount || bestSocial.followersCount;
              const posts = extra.posts || extra.postsCount || bestSocial.postsCount;
              const following = extra.following || extra.followingCount;
              return `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;">
                ${[
                  { v: fmtK(followers), label: "متابع", color: "#22c55e" },
                  { v: fmtK(posts),     label: "منشور", color: "#0ea5e9" },
                  { v: fmtK(following), label: "يتابع",  color: "#a78bfa" },
                ].map(({ v, label, color }) => `
                <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:12px 8px;text-align:center;">
                  <div style="font-size:20px;font-weight:900;color:${color};text-shadow:0 0 12px ${color}66;">${v}</div>
                  <div style="font-size:9px;color:#475569;margin-top:4px;font-weight:600;">${label}</div>
                </div>`).join("")}
              </div>`;
            })()}
            ${bar(bestSocial.engagementScore, "درجة التفاعل")}
            ${bar(bestSocial.contentQualityScore, "جودة المحتوى")}
            ${bar(bestSocial.overallScore, "التقييم الإجمالي")}
            ` : `${card('<div style="text-align:center;padding:10px;font-size:11px;color:#475569;">لم يتم تحليل السوشيال ميديا بعد</div>', "#475569")}`}
          </div>
        </div>

        <!-- Right: Radar chart -->
        <div>
          ${sh("مخطط المقارنة بمتوسط السوق", "العميل (أخضر) مقابل متوسط السوق (رمادي)")}
          <div style="display:flex;justify-content:center;margin-bottom:12px;">
            ${radarChart(radarAxes, 230)}
          </div>
          <!-- Legend -->
          <div style="display:flex;align-items:center;justify-content:center;gap:20px;margin-bottom:14px;">
            <div style="display:flex;align-items:center;gap:6px;">
              <div style="width:24px;height:3px;background:#22c55e;border-radius:2px;box-shadow:0 0 6px #22c55e;"></div>
              <span style="font-size:10px;color:#94a3b8;font-weight:600;">${lead.companyName || "العميل"}</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
              <div style="width:24px;height:3px;background:#64748b;border-radius:2px;border-top:2px dashed #64748b;"></div>
              <span style="font-size:10px;color:#94a3b8;font-weight:600;">متوسط السوق</span>
            </div>
          </div>

          <!-- All platforms -->
          ${socialAnalyses.length > 0 ? `
          <div style="margin-top:4px;">
            ${sh("أداء المنصات", `${socialAnalyses.length} منصة محللة`)}
            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;">
              ${socialAnalyses.slice(0, 4).map(s => {
                const meta = pm(s.platform);
                const score = s.engagementScore ? Number(s.engagementScore) : null;
                const color = sc(score);
                return `<div style="padding:10px 12px;background:rgba(255,255,255,0.03);
                  border:1px solid rgba(255,255,255,0.06);border-radius:10px;
                  border-right:3px solid ${meta.color};display:flex;align-items:center;gap:10px;">
                  <div style="font-size:18px;">${meta.icon}</div>
                  <div>
                    <div style="font-size:11px;font-weight:700;color:#f1f5f9;">${meta.name}</div>
                    <div style="font-size:20px;font-weight:900;color:${color};text-shadow:0 0 10px ${color}66;line-height:1.2;">${fmt(score)}</div>
                    <div style="font-size:9px;color:#475569;">درجة التفاعل</div>
                  </div>
                </div>`;
              }).join("")}
            </div>
          </div>` : ""}
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div style="position:absolute;bottom:0;left:0;right:0;padding:10px 40px;
      background:rgba(0,0,0,0.3);border-top:1px solid rgba(255,255,255,0.04);
      display:flex;align-items:center;justify-content:space-between;">
      <div style="font-size:9px;color:#334155;">${coName} · تقرير سري ومخصص</div>
      <div style="font-size:9px;color:#334155;">صفحة 3 من 5</div>
    </div>
  `);

  // ═══════════════════════════════════════════════════════════════════════
  //  PAGE 4 — RECOMMENDATIONS + STRONG CTA + QR CODE (DARK)
  // ═══════════════════════════════════════════════════════════════════════
  const p4 = page(`
    <!-- Decorative -->
    <div style="position:absolute;bottom:-80px;right:-60px;width:350px;height:350px;border-radius:50%;
      background:radial-gradient(circle,rgba(34,197,94,0.05) 0%,transparent 70%);pointer-events:none;"></div>

    ${pageHeader("التوصيات والخطة التنفيذية", "خطوات عملية مرتبة بالأولوية لتحقيق النمو", "صفحة 4/5", coName, lead)}

    <div style="padding:20px 40px;">

      <!-- Three pillars for recs page -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:18px;">
        <div style="background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.2);border-radius:12px;padding:12px;text-align:center;">
          <div style="font-size:9px;color:#86efac;font-weight:700;margin-bottom:6px;">مستوى الجاهزية</div>
          <div style="font-size:28px;font-weight:900;color:#22c55e;text-shadow:0 0 15px rgba(34,197,94,0.6);">${recs.length}</div>
          <div style="font-size:8px;color:#475569;margin-top:2px;">توصية استراتيجية</div>
        </div>
        <div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);border-radius:12px;padding:12px;text-align:center;">
          <div style="font-size:9px;color:#fca5a5;font-weight:700;margin-bottom:6px;">الفجوة الحالية</div>
          <div style="font-size:28px;font-weight:900;color:#ef4444;text-shadow:0 0 15px rgba(239,68,68,0.6);">${gaps.length}</div>
          <div style="font-size:8px;color:#475569;margin-top:2px;">ثغرة تحتاج معالجة</div>
        </div>
        <div style="background:rgba(249,115,22,0.06);border:1px solid rgba(249,115,22,0.2);border-radius:12px;padding:12px;text-align:center;">
          <div style="font-size:9px;color:#fdba74;font-weight:700;margin-bottom:6px;">الفرصة المالية</div>
          <div style="font-size:24px;font-weight:900;color:#f97316;text-shadow:0 0 15px rgba(249,115,22,0.6);">30 يوم</div>
          <div style="font-size:8px;color:#475569;margin-top:2px;">لرؤية النتائج</div>
        </div>
      </div>

      <!-- Recommendations -->
      ${recs.length ? `
      <div style="margin-bottom:20px;">
        ${sh("التوصيات الاستراتيجية", activeSeason ? `مُرتَّبة حسب موسم ${activeSeason.name || 'النشط'} ثم الأولوية والتأثير المالي` : "مرتبة حسب الأولوية والتأثير المالي")}
        ${activeSeason ? `
        <div style="display:inline-flex;align-items:center;gap:6px;margin-bottom:10px;padding:4px 12px;
          background:rgba(234,179,8,0.1);border:1px solid rgba(234,179,8,0.3);border-radius:20px;">
          <span style="font-size:11px;">📅</span>
          <span style="font-size:9px;color:#fbbf24;font-weight:700;">الترتيب مُحسَّن تلقائياً لموسم ${activeSeason.name}</span>
          <span style="font-size:9px;color:#78716c;">— التوصيات الأكثر ارتباطاً بالموسم في المقدمة</span>
        </div>` : ''}
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${recs.map((r, i) => {
            const accent = i === 0 ? "#22c55e" : i === 1 ? "#0ea5e9" : i === 2 ? "#a78bfa" : "#f97316";
            const priority = i === 0 ? "أولوية قصوى" : i === 1 ? "أولوية عالية" : i === 2 ? "أولوية متوسطة" : "مكمّل";
            return `<div style="display:flex;align-items:flex-start;gap:12px;padding:12px 16px;
              background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);
              border-right:3px solid ${accent};border-radius:0 12px 12px 0;">
              <div style="display:flex;flex-direction:column;align-items:center;gap:3px;flex-shrink:0;">
                <div style="width:28px;height:28px;border-radius:50%;
                  background:rgba(255,255,255,0.05);border:2px solid ${accent}44;
                  display:flex;align-items:center;justify-content:center;">
                  <span style="font-size:13px;font-weight:900;color:${accent};text-shadow:0 0 8px ${accent};">${i + 1}</span>
                </div>
                <div style="font-size:7px;color:${accent};font-weight:700;text-align:center;white-space:nowrap;">${priority}</div>
              </div>
              <div style="flex:1;">
                <div style="font-size:12px;color:#e2e8f0;line-height:1.7;">${r}</div>
              </div>
            </div>`;
          }).join("")}
        </div>
      </div>` : ""}

      <!-- ===== قسم الموسم التسويقي الحالي ===== -->
      ${activeSeason ? `
      <div style="margin-bottom:14px;background:linear-gradient(135deg,rgba(234,179,8,0.05),rgba(249,115,22,0.04));
        border:1px solid rgba(234,179,8,0.25);border-radius:14px;padding:14px 18px;">
        <div style="font-size:12px;font-weight:800;color:#fbbf24;margin-bottom:10px;display:flex;align-items:center;gap:8px;">
          <span style="font-size:16px;">📅</span>
          <span>الموسم التسويقي الحالي: ${activeSeason.name || 'موسم نشط'}</span>
          <span style="margin-right:auto;padding:3px 10px;background:rgba(234,179,8,0.15);border:1px solid rgba(234,179,8,0.35);
            border-radius:12px;font-size:9px;color:#fbbf24;font-weight:700;">نشط الآن</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            ${activeSeason.description ? `
            <div style="font-size:10.5px;color:#94a3b8;line-height:1.7;margin-bottom:8px;
              padding:8px 12px;background:rgba(255,255,255,0.03);border-radius:8px;
              border-right:3px solid rgba(234,179,8,0.5);">
              ${activeSeason.description}
            </div>` : ''}
            ${activeSeason.guidance ? `
            <div style="padding:8px 12px;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.2);
              border-radius:8px;">
              <div style="font-size:9px;color:#86efac;font-weight:700;margin-bottom:4px;">💡 توجيه مخصص لـ${lead.businessType || 'نشاطك'}</div>
              <div style="font-size:10px;color:#94a3b8;line-height:1.6;">${activeSeason.guidance}</div>
            </div>` : ''}
          </div>
          <div>
            ${activeSeason.keyOpportunities?.length ? `
            <div style="margin-bottom:8px;">
              <div style="font-size:9px;color:#fbbf24;font-weight:700;margin-bottom:5px;">✨ فرص هذا الموسم</div>
              ${activeSeason.keyOpportunities.slice(0, 3).map((opp: string) => `
              <div style="display:flex;gap:6px;align-items:flex-start;padding:3px 0;">
                <span style="color:#fbbf24;font-size:10px;flex-shrink:0;">▶</span>
                <div style="font-size:9.5px;color:#94a3b8;line-height:1.5;">${opp}</div>
              </div>`).join('')}
            </div>` : ''}
            ${upcomingSeasons.length > 0 ? `
            <div style="padding:8px 12px;background:rgba(14,165,233,0.05);border:1px solid rgba(14,165,233,0.15);
              border-radius:8px;">
              <div style="font-size:9px;color:#7dd3fc;font-weight:700;margin-bottom:5px;">⏳ مواسم قادمة</div>
              ${upcomingSeasons.slice(0, 2).map((s: any) => `
              <div style="font-size:9px;color:#64748b;padding:2px 0;">▸ ${s.name || ''} ${s.startDate ? '(' + s.startDate + ')' : ''}</div>`).join('')}
            </div>` : ''}
          </div>
        </div>
      </div>` : ''}

      <!-- ===== قسم مستقبل السوق ===== -->
      <div style="margin-bottom:14px;background:linear-gradient(135deg,rgba(14,165,233,0.04) 0%,rgba(167,139,250,0.04) 100%);
        border:1px solid rgba(14,165,233,0.15);border-radius:14px;padding:16px 20px;position:relative;overflow:hidden;">
        <div style="position:absolute;top:-30px;left:-30px;width:150px;height:150px;border-radius:50%;
          background:radial-gradient(circle,rgba(14,165,233,0.06) 0%,transparent 70%);pointer-events:none;"></div>
        <div style="font-size:12px;font-weight:800;color:#7dd3fc;margin-bottom:12px;display:flex;align-items:center;gap:8px;">
          <span style="font-size:16px;">🔭</span>
          <span>مستقبل السوق في ${lead.city || 'المملكة'} — رؤية استراتيجية 2025–2030</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px;">
          <div style="background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.15);border-radius:10px;padding:10px 12px;">
            <div style="font-size:9px;color:#86efac;font-weight:700;margin-bottom:4px;">📈 نمو القطاع</div>
            <div style="font-size:11px;color:#e2e8f0;line-height:1.6;">قطاع ${lead.businessType || 'الأعمال'} في السوق السعودي يشهد نمواً سنوياً يتجاوز <strong style="color:#22c55e;">18%</strong> مدفوعاً برؤية 2030 والتحول الرقمي.</div>
          </div>
          <div style="background:rgba(249,115,22,0.06);border:1px solid rgba(249,115,22,0.15);border-radius:10px;padding:10px 12px;">
            <div style="font-size:9px;color:#fdba74;font-weight:700;margin-bottom:4px;">⚡ شدة المنافسة</div>
            <div style="font-size:11px;color:#e2e8f0;line-height:1.6;">المنافسة الرقمية تتصاعد بسرعة — <strong style="color:#f97316;">73%</strong> من الأنشطة في ${lead.city || 'المنطقة'} ستعتمد على التسويق الرقمي بحلول 2026.</div>
          </div>
          <div style="background:rgba(167,139,250,0.06);border:1px solid rgba(167,139,250,0.15);border-radius:10px;padding:10px 12px;">
            <div style="font-size:9px;color:#c4b5fd;font-weight:700;margin-bottom:4px;">🎯 نافذة الفرصة</div>
            <div style="font-size:11px;color:#e2e8f0;line-height:1.6;">النشاطات التي تبني حضورها الرقمي <strong style="color:#a78bfa;">الآن</strong> ستحتل المراكز الأولى قبل أن تُغلق نافذة الفرصة التنافسية.</div>
          </div>
        </div>
        <div style="background:rgba(255,255,255,0.03);border-right:3px solid #7dd3fc;border-radius:0 8px 8px 0;padding:10px 14px;">
          <div style="font-size:10px;color:#94a3b8;line-height:1.7;">
            <strong style="color:#7dd3fc;">التعليق الاستشاري:</strong> بناءً على تحليل وضع ${lead.companyName || 'نشاطك'} الحالي، يمتلك النشاط إمكانات نمو حقيقية في سوق ${lead.city || 'المملكة'}. الفجوات المُحددة في هذا التقرير ليست نقاط ضعف دائمة — بل هي <strong style="color:#22c55e;">فرص تنافسية قابلة للاستثمار</strong> إذا تحرّكنا بسرعة وذكاء. كل يوم تأخير يمنح المنافسين ميزة يصعب تجاوزها لاحقاً.
          </div>
        </div>
      </div>

      <!-- ===== STRONG CTA SECTION ===== -->
      <div style="background:linear-gradient(135deg,#020810 0%,#0a1628 40%,#0d1f3c 70%,#020810 100%);
        border:1.5px solid rgba(34,197,94,0.35);border-radius:16px;padding:22px 28px;
        position:relative;overflow:hidden;
        box-shadow:0 0 60px rgba(34,197,94,0.12),inset 0 0 40px rgba(34,197,94,0.03);">
        <!-- Glow effects -->
        <div style="position:absolute;top:-60px;right:-60px;width:220px;height:220px;border-radius:50%;
          background:radial-gradient(circle,rgba(34,197,94,0.12) 0%,transparent 70%);pointer-events:none;"></div>
        <div style="position:absolute;bottom:-60px;left:-40px;width:200px;height:200px;border-radius:50%;
          background:radial-gradient(circle,rgba(14,165,233,0.08) 0%,transparent 70%);pointer-events:none;"></div>
        <!-- Top badge -->
        <div style="display:flex;justify-content:center;margin-bottom:14px;">
          <div style="padding:4px 18px;background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.35);
            border-radius:20px;font-size:9px;color:#86efac;font-weight:800;letter-spacing:2px;">
            ● الخطوة التالية — الآن
          </div>
        </div>
        <div style="position:relative;z-index:1;display:grid;grid-template-columns:1fr auto;gap:20px;align-items:center;">
          <!-- Left: CTA Text -->
          <div>
            <div style="font-size:24px;font-weight:900;color:#f8fafc;margin-bottom:8px;
              text-shadow:0 0 40px rgba(34,197,94,0.25);line-height:1.2;">
              لا تدع منافسيك يسبقونك
            </div>
            <div style="font-size:11.5px;color:#64748b;margin-bottom:16px;line-height:1.8;">
              كل يوم تأخير = إيراد ضائع. تواصل معنا الآن للحصول على
              <strong style="color:#94a3b8;">استشارة مجانية وخطة عمل مخصصة</strong>
              لـ${lead.companyName || 'نشاطك'} خلال 24 ساعة.
            </div>
            <!-- Contact buttons -->
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
              ${waPhone ? `
              <div style="padding:10px 22px;background:linear-gradient(135deg,rgba(34,197,94,0.2),rgba(34,197,94,0.1));
                border:1px solid rgba(34,197,94,0.5);border-radius:24px;font-size:12px;font-weight:800;color:#22c55e;
                box-shadow:0 0 20px rgba(34,197,94,0.25);">📱 واتساب: ${waPhone}</div>` : ''}
              <div style="padding:10px 22px;background:rgba(14,165,233,0.12);border:1px solid rgba(14,165,233,0.4);
                border-radius:24px;font-size:12px;font-weight:700;color:#0ea5e9;
                box-shadow:0 0 16px rgba(14,165,233,0.15);">🌐 ${coWebsite}</div>
              ${coEmail ? `
              <div style="padding:10px 22px;background:rgba(167,139,250,0.1);border:1px solid rgba(167,139,250,0.35);
                border-radius:24px;font-size:12px;font-weight:700;color:#a78bfa;
                box-shadow:0 0 16px rgba(167,139,250,0.15);">✉️ ${coEmail}</div>` : ''}
            </div>
            <!-- Urgency strip -->
            <div style="padding:8px 16px;background:linear-gradient(90deg,rgba(239,68,68,0.1),rgba(239,68,68,0.05));
              border:1px solid rgba(239,68,68,0.25);border-radius:10px;display:inline-flex;align-items:center;gap:8px;">
              <div style="width:7px;height:7px;border-radius:50%;background:#ef4444;
                box-shadow:0 0 8px #ef4444;animation:pulse 2s infinite;"></div>
              <span style="font-size:10px;color:#fca5a5;font-weight:700;">${rsClosingStmt || 'عرض الاستشارة المجانية متاح لفترة محدودة — احجز مكانك الآن'}</span>
            </div>
            <!-- Brand keywords from settings -->
            ${rsBrandKeywords.length > 0 ? `
            <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;">
              ${rsBrandKeywords.slice(0, 5).map((kw: string) => `<span style="padding:3px 10px;background:rgba(34,197,94,0.08);
                border:1px solid rgba(34,197,94,0.2);border-radius:12px;
                font-size:9px;color:#86efac;font-weight:600;">${kw}</span>`).join('')}
            </div>` : ''}
          </div>
          <!-- Right: QR Code -->
          ${waPhone ? `
          <div style="display:flex;flex-direction:column;align-items:center;gap:8px;flex-shrink:0;">
            <div style="padding:8px;background:white;border-radius:12px;border:3px solid rgba(34,197,94,0.4);
              box-shadow:0 0 20px rgba(34,197,94,0.2);">
              ${qrImg(waQR85, 85)}
            </div>
            <div style="font-size:8px;color:#475569;text-align:center;max-width:110px;line-height:1.5;">
              امسح للتواصل الفوري عبر واتساب
            </div>
          </div>` : ''}
        </div>
      </div>

      <!-- QR Codes Section -->
      <div style="margin-top:14px;padding:14px 18px;background:rgba(255,255,255,0.02);
        border:1px solid rgba(255,255,255,0.06);border-radius:14px;">
        <div style="font-size:9px;color:#475569;margin-bottom:10px;font-weight:700;letter-spacing:1px;">تواصل معنا مباشرةً</div>
        <div style="display:flex;align-items:center;gap:20px;">
          ${waPhone ? `
          <div style="display:flex;flex-direction:column;align-items:center;gap:5px;">
            <div style="padding:6px;background:white;border-radius:10px;box-shadow:0 0 16px rgba(34,197,94,0.25);">
              ${qrImg(waQR60, 60)}
            </div>
            <div style="font-size:8px;color:#86efac;font-weight:700;">📱 واتساب</div>
            <div style="font-size:7.5px;color:#475569;">${waPhone}</div>
          </div>` : ''}
          ${coCommercialReg ? `
          <div style="display:flex;flex-direction:column;align-items:center;gap:5px;">
            <div style="padding:6px;background:white;border-radius:10px;box-shadow:0 0 16px rgba(14,165,233,0.25);">
              ${qrImg(crQR60, 60)}
            </div>
            <div style="font-size:8px;color:#7dd3fc;font-weight:700;">🏛️ السجل التجاري</div>
            <div style="font-size:7.5px;color:#475569;">${coCommercialReg}</div>
          </div>` : ''}
          <div style="flex:1;">
            <div style="font-size:10px;color:#94a3b8;line-height:1.8;">
              ${rsClosingStmt || `هذا التقرير تشخيص أولي مخصص لك — تواصل معنا للحصول على خطة تنفيذية متكاملة وتحليل أعمق لنتائج أفضل.`}
            </div>
            ${coWebsite ? `<div style="margin-top:6px;font-size:9px;color:#64748b;">🌐 ${coWebsite}</div>` : ''}
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div style="position:absolute;bottom:0;left:0;right:0;padding:10px 40px;
      background:rgba(0,0,0,0.4);border-top:1px solid rgba(255,255,255,0.04);
      display:flex;align-items:center;justify-content:space-between;">
      <div style="font-size:9px;color:#334155;">${rsFooterText || `حصري من ${coName} — جميع الحقوق محفوظة © ${new Date().getFullYear()}`}</div>
      <div style="font-size:9px;color:#334155;">CONFIDENTIAL · صفحة 4 من 5</div>
    </div>
  `, false);

  // ═══════════════════════════════════════════════════════════════════════
  //  PAGE 5 — COMPETITOR COMPARISON (DARK)
  // ═══════════════════════════════════════════════════════════════════════

  const allEntities = [
    { ...lead, isClient: true },
    ...competitors.slice(0, 5),
  ].sort((a, b) => (Number(b.leadPriorityScore) || 0) - (Number(a.leadPriorityScore) || 0));

  const clientRank = allEntities.findIndex((e: any) => e.isClient) + 1;
  const totalInComparison = allEntities.length;

  const avgCompPriority = competitors.length
    ? competitors.reduce((s, c) => s + (Number(c.leadPriorityScore) || 0), 0) / competitors.length
    : 0;
  const avgCompPlatforms = competitors.length
    ? competitors.reduce((s, c) => s + [c.instagramUrl, c.tiktokUrl, c.twitterUrl, c.snapchatUrl, c.facebookUrl, c.linkedinUrl].filter(Boolean).length, 0) / competitors.length
    : 0;
  const clientPlatforms = [lead.instagramUrl, lead.tiktokUrl, lead.twitterUrl, lead.snapchatUrl, lead.facebookUrl, lead.linkedinUrl].filter(Boolean).length;
  const clientPri = Number(lead.leadPriorityScore) || 5;
  const clientQual = Number(lead.dataQualityScore) || 5;

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  if (clientPri > avgCompPriority + 0.5) strengths.push(`درجة الأولوية (${clientPri.toFixed(1)}) أعلى من متوسط المنافسين (${avgCompPriority.toFixed(1)})`);
  else if (clientPri < avgCompPriority - 0.5) weaknesses.push(`درجة الأولوية (${clientPri.toFixed(1)}) أقل من متوسط المنافسين (${avgCompPriority.toFixed(1)})`);
  if (clientPlatforms > avgCompPlatforms + 0.5) strengths.push(`حضور على ${clientPlatforms} منصات مقابل متوسط ${avgCompPlatforms.toFixed(1)} للمنافسين`);
  else if (clientPlatforms < avgCompPlatforms - 0.5) weaknesses.push(`حضور على ${clientPlatforms} منصات فقط مقابل متوسط ${avgCompPlatforms.toFixed(1)} للمنافسين`);
  if (lead.website && competitors.filter((c: any) => c.website).length < competitors.length / 2) strengths.push('يمتلك موقعاً إلكترونياً بينما أغلب المنافسين لا يمتلكون');
  if (!lead.website && competitors.filter((c: any) => c.website).length > competitors.length / 2) weaknesses.push('لا يمتلك موقعاً إلكترونياً بينما أغلب المنافسين يمتلكون');
  if (strengths.length === 0) strengths.push('يمتلك إمكانات تنافسية واعدة في السوق المحلي');
  if (weaknesses.length === 0) weaknesses.push('يحتاج تعزيز الحضور الرقمي لمواكبة المنافسين');

  function buildRadarSVG(entities: any[]) {
    const cx = 110, cy = 110, r = 80;
    const axes = [
      { label: 'الأولوية', key: 'leadPriorityScore' },
      { label: 'جودة البيانات', key: 'dataQualityScore' },
      { label: 'المنصات', key: '_platforms' },
      { label: 'الموقع', key: '_website' },
      { label: 'التواصل', key: '_contact' },
    ];
    const n = axes.length;
    const colors = ['#22c55e', '#f97316', '#eab308', '#0ea5e9', '#a78bfa'];

    function getVal(e: any, key: string): number {
      if (key === '_platforms') return Math.min(10, ([e.instagramUrl, e.tiktokUrl, e.twitterUrl, e.snapchatUrl, e.facebookUrl, e.linkedinUrl].filter(Boolean).length / 6) * 10);
      if (key === '_website') return e.website ? 10 : 0;
      if (key === '_contact') return (e.phone || e.verifiedPhone) ? 10 : 0;
      return Math.min(10, Number(e[key]) || 0);
    }

    function polarToCart(angle: number, val: number) {
      const rad = (angle - 90) * Math.PI / 180;
      const dist = (val / 10) * r;
      return { x: cx + dist * Math.cos(rad), y: cy + dist * Math.sin(rad) };
    }

    let gridCircles = '';
    for (let i = 2; i <= 10; i += 2) {
      const pts = axes.map((_, j) => {
        const angle = (360 / n) * j;
        const p = polarToCart(angle, i);
        return `${p.x},${p.y}`;
      }).join(' ');
      gridCircles += `<polygon points="${pts}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="0.5"/>`;
    }

    let axisLines = '';
    axes.forEach((ax, j) => {
      const angle = (360 / n) * j;
      const outer = polarToCart(angle, 10);
      const labelPos = polarToCart(angle, 12.5);
      axisLines += `<line x1="${cx}" y1="${cy}" x2="${outer.x}" y2="${outer.y}" stroke="rgba(255,255,255,0.1)" stroke-width="0.8"/>`;
      axisLines += `<text x="${labelPos.x}" y="${labelPos.y}" text-anchor="middle" dominant-baseline="middle" fill="#64748b" font-size="8" font-family="Tajawal,Arial">${ax.label}</text>`;
    });

    let polygons = '';
    entities.slice(0, 3).forEach((e, idx) => {
      const color = e.isClient ? '#22c55e' : colors[idx + 1] || '#64748b';
      const pts = axes.map((ax, j) => {
        const angle = (360 / n) * j;
        const val = getVal(e, ax.key);
        const p = polarToCart(angle, val);
        return `${p.x},${p.y}`;
      }).join(' ');
      polygons += `<polygon points="${pts}" fill="${color}22" stroke="${color}" stroke-width="${e.isClient ? 2 : 1.2}" opacity="0.9"/>`;
    });

    return `<svg width="220" height="220" viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg">
      ${gridCircles}${axisLines}${polygons}
    </svg>`;
  }

  function buildCompetitorCard(comp: any, rank: number, isClient = false) {
    const priScore = Math.min(10, Number(comp.leadPriorityScore) || 0);
    const qualScore = Math.min(10, Number(comp.dataQualityScore) || 0);
    const platforms = [comp.instagramUrl, comp.tiktokUrl, comp.twitterUrl, comp.snapchatUrl, comp.facebookUrl, comp.linkedinUrl].filter(Boolean).length;
    const hasWebsite = !!comp.website;
    const hasPhone = !!(comp.phone || comp.verifiedPhone);

    const rankColors: Record<number, { bg: string; border: string; badge: string; text: string }> = {
      1: { bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.4)', badge: 'linear-gradient(135deg,#f59e0b,#fbbf24)', text: '#fbbf24' },
      2: { bg: 'rgba(148,163,184,0.06)', border: 'rgba(148,163,184,0.3)', badge: 'linear-gradient(135deg,#94a3b8,#cbd5e1)', text: '#cbd5e1' },
      3: { bg: 'rgba(180,83,9,0.06)', border: 'rgba(180,83,9,0.3)', badge: 'linear-gradient(135deg,#b45309,#d97706)', text: '#d97706' },
    };
    const clientStyle = { bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.5)', badge: 'linear-gradient(135deg,#16a34a,#22c55e)', text: '#22c55e' };
    const defaultStyle = { bg: 'rgba(255,255,255,0.02)', border: 'rgba(255,255,255,0.08)', badge: 'linear-gradient(135deg,#334155,#475569)', text: '#64748b' };

    const style = isClient ? clientStyle : (rankColors[rank] || defaultStyle);
    const badgeLabel = isClient ? '⭐' : rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;

    const platformIcons = [
      { url: comp.instagramUrl, color: '#e1306c', label: 'IG' },
      { url: comp.tiktokUrl, color: '#69c9d0', label: 'TK' },
      { url: comp.twitterUrl, color: '#1da1f2', label: 'X' },
      { url: comp.snapchatUrl, color: '#fffc00', label: 'SC' },
      { url: comp.facebookUrl, color: '#1877f2', label: 'FB' },
      { url: comp.linkedinUrl, color: '#0a66c2', label: 'LI' },
    ];

    const priBarWidth = priScore !== null && priScore !== undefined ? Math.round(Number(priScore) * 10) : 50;
    const qualBarWidth = qualScore !== null && qualScore !== undefined ? Math.round(Number(qualScore) * 10) : 50;
    const platBarWidth = Math.round((platforms / 6) * 100);

    return `
    <div style="display:flex;gap:10px;align-items:stretch;padding:10px 14px;
      background:${style.bg};border:1px solid ${style.border};
      border-radius:12px;margin-bottom:7px;position:relative;overflow:hidden;">
      ${isClient ? `<div style="position:absolute;top:0;right:0;bottom:0;width:3px;background:${style.badge};border-radius:0 12px 12px 0;"></div>` : ''}
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:36px;">
        <div style="width:32px;height:32px;border-radius:50%;background:${style.badge};
          display:flex;align-items:center;justify-content:center;
          font-size:${isClient ? '10' : '14'}px;font-weight:900;color:#fff;
          box-shadow:0 0 10px ${style.text}44;">${badgeLabel}</div>
        ${isClient ? `<div style="font-size:7px;color:${style.text};margin-top:3px;font-weight:700;">أنت</div>` : ''}
      </div>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
          <div style="font-size:11.5px;font-weight:800;color:${isClient ? style.text : '#f1f5f9'};
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px;">${comp.companyName || 'غير معروف'}</div>
          <div style="display:flex;gap:3px;">
            ${platformIcons.map(p => p.url ? `<div style="width:16px;height:16px;border-radius:4px;background:${p.color}22;border:1px solid ${p.color}55;
              display:flex;align-items:center;justify-content:center;font-size:7px;color:${p.color};font-weight:800;">${p.label}</div>` : '').join('')}
            ${hasWebsite ? `<div style="width:16px;height:16px;border-radius:4px;background:rgba(14,165,233,0.15);border:1px solid rgba(14,165,233,0.4);
              display:flex;align-items:center;justify-content:center;font-size:7px;color:#0ea5e9;font-weight:800;">🌐</div>` : ''}
            ${hasPhone ? `<div style="width:16px;height:16px;border-radius:4px;background:rgba(34,197,94,0.15);border:1px solid rgba(34,197,94,0.4);
              display:flex;align-items:center;justify-content:center;font-size:7px;color:#22c55e;font-weight:800;">📞</div>` : ''}
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;">
          <div>
            <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
              <span style="font-size:7.5px;color:#475569;">الأولوية</span>
              <span style="font-size:7.5px;font-weight:800;color:${sc(priScore)};">${priScore !== null && priScore !== undefined ? Number(priScore).toFixed(1) : '—'}</span>
            </div>
            <div style="height:4px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden;">
              <div style="height:100%;width:${priBarWidth}%;background:${sc(priScore)};border-radius:2px;
                box-shadow:0 0 6px ${sc(priScore)}88;"></div>
            </div>
          </div>
          <div>
            <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
              <span style="font-size:7.5px;color:#475569;">جودة البيانات</span>
              <span style="font-size:7.5px;font-weight:800;color:${sc(qualScore)};">${qualScore !== null && qualScore !== undefined ? Number(qualScore).toFixed(1) : '—'}</span>
            </div>
            <div style="height:4px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden;">
              <div style="height:100%;width:${qualBarWidth}%;background:${sc(qualScore)};border-radius:2px;
                box-shadow:0 0 6px ${sc(qualScore)}88;"></div>
            </div>
          </div>
          <div>
            <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
              <span style="font-size:7.5px;color:#475569;">المنصات</span>
              <span style="font-size:7.5px;font-weight:800;color:#0ea5e9;">${platforms}/6</span>
            </div>
            <div style="height:4px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden;">
              <div style="height:100%;width:${platBarWidth}%;background:#0ea5e9;border-radius:2px;
                box-shadow:0 0 6px #0ea5e988;"></div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }

  // حالة عدم وجود منافسين
  const noCompetitorsContent = page(`
    <div style="position:absolute;top:-80px;right:-80px;width:350px;height:350px;border-radius:50%;
      background:radial-gradient(circle,rgba(14,165,233,0.05) 0%,transparent 70%);pointer-events:none;"></div>
    <div style="position:absolute;bottom:-60px;left:-60px;width:280px;height:280px;border-radius:50%;
      background:radial-gradient(circle,rgba(167,139,250,0.04) 0%,transparent 70%);pointer-events:none;"></div>

    ${pageHeader("الموقع في السوق والفرصة التنافسية", "تحليل الوضع التنافسي الحالي", "صفحة 5/5", coName, lead)}

    <div style="padding:24px 40px;">
      <!-- Three pillars -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:24px;">
        ${bigNum(clientPlatforms, "منصات نشطة", "من أصل 6 منصات", "#22c55e")}
        ${bigNum(clientPri !== null && clientPri !== undefined ? Number(clientPri).toFixed(1) : '—', "درجة الأولوية", "من أصل 10 نقاط", "#0ea5e9")}
        ${bigNum(clientQual !== null && clientQual !== undefined ? Number(clientQual).toFixed(1) : '—', "جودة البيانات", "من أصل 10 نقاط", "#a78bfa")}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div style="background:rgba(34,197,94,0.04);border:1px solid rgba(34,197,94,0.15);border-radius:14px;padding:16px;">
          <div style="font-size:12px;font-weight:800;color:#22c55e;margin-bottom:12px;display:flex;align-items:center;gap:6px;">
            <span style="font-size:14px;">✅</span> نقاط القوة الحالية
          </div>
          ${strengths.map(s => `
          <div style="display:flex;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
            <div style="width:6px;height:6px;border-radius:50%;background:#22c55e;margin-top:4px;flex-shrink:0;"></div>
            <div style="font-size:10px;color:#94a3b8;line-height:1.6;">${s}</div>
          </div>`).join('')}
        </div>
        <div style="background:rgba(239,68,68,0.04);border:1px solid rgba(239,68,68,0.15);border-radius:14px;padding:16px;">
          <div style="font-size:12px;font-weight:800;color:#ef4444;margin-bottom:12px;display:flex;align-items:center;gap:6px;">
            <span style="font-size:14px;">🎯</span> فرص التحسين
          </div>
          ${weaknesses.map(w => `
          <div style="display:flex;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
            <div style="width:6px;height:6px;border-radius:50%;background:#ef4444;margin-top:4px;flex-shrink:0;"></div>
            <div style="font-size:10px;color:#94a3b8;line-height:1.6;">${w}</div>
          </div>`).join('')}
        </div>
      </div>

      <!-- Final CTA -->
      <div style="margin-top:20px;padding:18px 22px;background:linear-gradient(135deg,rgba(34,197,94,0.08),rgba(14,165,233,0.06));
        border:1px solid rgba(34,197,94,0.2);border-radius:14px;
        display:flex;align-items:center;justify-content:space-between;gap:16px;">
        <div>
          <div style="font-size:14px;font-weight:900;color:#f1f5f9;margin-bottom:6px;">🚀 ابدأ رحلة النمو مع ${coName}</div>
          <div style="font-size:10.5px;color:#64748b;line-height:1.7;">
            بناءً على هذا التحليل، نوصي بالتواصل الفوري لتقديم حلول تسويقية مخصصة تعالج الثغرات المحددة وتعزز الحضور الرقمي في ${lead.city || 'السوق المحلي'}.
          </div>
        </div>
        ${waPhone ? `
        <div style="flex-shrink:0;">
          ${qrImg(waQR80, 80)}
        </div>` : ""}
      </div>
    </div>

    <div style="position:absolute;bottom:0;left:0;right:0;padding:10px 40px;
      background:rgba(0,0,0,0.3);border-top:1px solid rgba(255,255,255,0.04);
      display:flex;align-items:center;justify-content:space-between;">
      <div style="font-size:9px;color:#334155;">${rsFooterText || `حصري من ${coName} — جميع الحقوق محفوظة`}</div>
      <div style="font-size:9px;color:#334155;">CONFIDENTIAL · صفحة 5 من 5</div>
    </div>
  `);

  // صفحة المنافسين الكاملة
  const p5 = competitors.length === 0 ? noCompetitorsContent : page(`
    <div style="position:absolute;top:-80px;right:-80px;width:350px;height:350px;border-radius:50%;
      background:radial-gradient(circle,rgba(14,165,233,0.05) 0%,transparent 70%);pointer-events:none;"></div>
    <div style="position:absolute;bottom:-60px;left:-60px;width:280px;height:280px;border-radius:50%;
      background:radial-gradient(circle,rgba(167,139,250,0.04) 0%,transparent 70%);pointer-events:none;"></div>

    ${pageHeader("تحليل المنافسين والموقع التنافسي", "مقارنة شاملة مع المنافسين في السوق", "صفحة 5/5", coName, lead)}

    <div style="padding:18px 40px;">

      <!-- Three pillars -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px;">
        <div style="background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.2);border-radius:12px;padding:12px;text-align:center;">
          <div style="font-size:9px;color:#86efac;font-weight:700;margin-bottom:6px;">مستوى الأداء</div>
          <div style="font-size:28px;font-weight:900;color:#22c55e;text-shadow:0 0 15px rgba(34,197,94,0.6);">#${clientRank}</div>
          <div style="font-size:8px;color:#475569;margin-top:2px;">من ${totalInComparison} منافس</div>
        </div>
        <div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);border-radius:12px;padding:12px;text-align:center;">
          <div style="font-size:9px;color:#fca5a5;font-weight:700;margin-bottom:6px;">الفجوة التنافسية</div>
          <div style="font-size:28px;font-weight:900;color:#ef4444;text-shadow:0 0 15px rgba(239,68,68,0.6);">${Math.abs(clientPri - avgCompPriority).toFixed(1)}</div>
          <div style="font-size:8px;color:#475569;margin-top:2px;">نقطة فارق</div>
        </div>
        <div style="background:rgba(249,115,22,0.06);border:1px solid rgba(249,115,22,0.2);border-radius:12px;padding:12px;text-align:center;">
          <div style="font-size:9px;color:#fdba74;font-weight:700;margin-bottom:6px;">الفرصة التنافسية</div>
          <div style="font-size:28px;font-weight:900;color:#f97316;text-shadow:0 0 15px rgba(249,115,22,0.6);">${clientPlatforms}</div>
          <div style="font-size:8px;color:#475569;margin-top:2px;">منصة نشطة</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 220px;gap:18px;margin-bottom:16px;align-items:start;">

        <!-- Left: Ranking card + Summary stats -->
        <div>
          <div style="display:flex;align-items:center;gap:14px;padding:14px 18px;
            background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.25);
            border-radius:14px;margin-bottom:12px;">
            <div style="width:64px;height:64px;border-radius:50%;
              background:linear-gradient(135deg,rgba(34,197,94,0.2),rgba(14,165,233,0.1));
              border:2px solid rgba(34,197,94,0.5);
              display:flex;flex-direction:column;align-items:center;justify-content:center;
              box-shadow:0 0 20px rgba(34,197,94,0.3);flex-shrink:0;">
              <div style="font-size:22px;font-weight:900;color:#22c55e;line-height:1;">#${clientRank}</div>
              <div style="font-size:8px;color:#475569;margin-top:2px;">من ${totalInComparison}</div>
            </div>
            <div>
              <div style="font-size:13px;font-weight:800;color:#f1f5f9;">${lead.companyName || 'العميل'}</div>
              <div style="font-size:10px;color:#64748b;margin-top:2px;">${lead.businessType || 'النشاط التجاري'} · ${lead.city || 'المدينة'}</div>
              <div style="font-size:10px;color:${clientRank === 1 ? '#22c55e' : clientRank <= Math.ceil(totalInComparison/2) ? '#eab308' : '#f97316'};margin-top:4px;font-weight:700;">
                ${clientRank === 1 ? '🏆 الأول في المجال' : clientRank <= Math.ceil(totalInComparison/2) ? '📈 في النصف الأفضل' : '⚠️ يحتاج تحسين'}
              </div>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px;">
            <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:10px;text-align:center;">
              <div style="font-size:18px;font-weight:900;color:${sc(clientPri)};text-shadow:0 0 10px ${sc(clientPri)}66;">${clientPri.toFixed(1)}</div>
              <div style="font-size:8px;color:#475569;margin-top:2px;">درجة الأولوية</div>
            </div>
            <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:10px;text-align:center;">
              <div style="font-size:18px;font-weight:900;color:#0ea5e9;">${clientPlatforms}</div>
              <div style="font-size:8px;color:#475569;margin-top:2px;">منصات نشطة</div>
            </div>
            <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:10px;text-align:center;">
              <div style="font-size:18px;font-weight:900;color:${sc(avgCompPriority)};">${avgCompPriority.toFixed(1)}</div>
              <div style="font-size:8px;color:#475569;margin-top:2px;">متوسط المنافسين</div>
            </div>
          </div>
        </div>

        <!-- Right: Radar chart -->
        <div style="display:flex;flex-direction:column;align-items:center;">
          <div style="font-size:9px;color:#475569;margin-bottom:6px;text-align:center;">مخطط المقارنة الشاملة</div>
          ${buildRadarSVG(allEntities)}
          <div style="display:flex;gap:8px;margin-top:4px;flex-wrap:wrap;justify-content:center;">
            <div style="display:flex;align-items:center;gap:3px;"><div style="width:8px;height:2px;background:#22c55e;border-radius:1px;"></div><span style="font-size:7.5px;color:#475569;">أنت</span></div>
            ${competitors.slice(0, 2).map((c, i) => `<div style="display:flex;align-items:center;gap:3px;"><div style="width:8px;height:2px;background:${i === 0 ? '#f97316' : '#eab308'};border-radius:1px;"></div><span style="font-size:7.5px;color:#475569;">${(c.companyName || 'منافس').substring(0, 10)}</span></div>`).join('')}
          </div>
        </div>
      </div>

      <!-- Competitor cards -->
      <div style="margin-bottom:12px;">
        <div style="font-size:10px;color:#475569;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.06);">ترتيب المنافسين حسب درجة الأولوية</div>
        ${allEntities.map((e: any, i: number) => buildCompetitorCard(e, i + 1, !!e.isClient)).join('')}
      </div>

      <!-- Strategic Comparison Table -->
      <div style="margin-bottom:12px;">
        <div style="font-size:11px;font-weight:800;color:#f1f5f9;margin-bottom:8px;display:flex;align-items:center;gap:6px;">
          <span style="font-size:14px;">📊</span>
          <span>جدول المقارنة الاستراتيجية</span>
        </div>
        <div style="border:1px solid rgba(255,255,255,0.08);border-radius:12px;overflow:hidden;">
          <!-- Table header -->
          <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr 1fr;background:rgba(255,255,255,0.04);
            padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.06);">
            <div style="font-size:9px;color:#64748b;font-weight:700;">النشاط</div>
            <div style="font-size:9px;color:#64748b;font-weight:700;text-align:center;">الأولوية</div>
            <div style="font-size:9px;color:#64748b;font-weight:700;text-align:center;">المنصات</div>
            <div style="font-size:9px;color:#64748b;font-weight:700;text-align:center;">الموقع</div>
            <div style="font-size:9px;color:#64748b;font-weight:700;text-align:center;">التواصل</div>
            <div style="font-size:9px;color:#64748b;font-weight:700;text-align:center;">التقييم</div>
          </div>
          <!-- Table rows -->
          ${allEntities.slice(0, 5).map((e: any, i: number) => {
            const isC = !!e.isClient;
            const pri = Number(e.leadPriorityScore) || 0;
            const plats = [e.instagramUrl, e.tiktokUrl, e.twitterUrl, e.snapchatUrl, e.facebookUrl, e.linkedinUrl].filter(Boolean).length;
            const hasWeb = !!e.website;
            const hasPhone = !!(e.phone || e.verifiedPhone);
            const rowBg = isC ? 'rgba(34,197,94,0.06)' : i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent';
            const rowBorder = isC ? 'border-right:3px solid #22c55e;' : '';
            const nameColor = isC ? '#22c55e' : '#e2e8f0';
            const priColor = sc(pri);
            const cell = (content: string, color = '#94a3b8') =>
              `<div style="text-align:center;font-size:9.5px;font-weight:700;color:${color};">${content}</div>`;
            return `<div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr 1fr;
              padding:7px 12px;background:${rowBg};${rowBorder}
              border-bottom:1px solid rgba(255,255,255,0.04);align-items:center;">
              <div style="font-size:9.5px;font-weight:${isC ? '800' : '600'};color:${nameColor};
                white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${isC ? '⭐ ' : ''}${(e.companyName || 'غير معروف').substring(0, 18)}
              </div>
              ${cell(pri.toFixed(1), priColor)}
              ${cell(plats + '/6', plats >= 4 ? '#22c55e' : plats >= 2 ? '#eab308' : '#ef4444')}
              ${cell(hasWeb ? '✅' : '❌', hasWeb ? '#22c55e' : '#ef4444')}
              ${cell(hasPhone ? '✅' : '❌', hasPhone ? '#22c55e' : '#ef4444')}
              ${cell(pri >= 7 ? '★★★' : pri >= 5 ? '★★☆' : '★☆☆', sc(pri))}
            </div>`;
          }).join('')}
        </div>
      </div>

      <!-- Bar Chart: Visual Competitor Comparison -->
      <div style="margin-bottom:12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:12px 16px;">
        <div style="font-size:11px;font-weight:800;color:#f1f5f9;margin-bottom:10px;display:flex;align-items:center;gap:6px;">
          <span style="font-size:14px;">📊</span>
          <span>مقارنة بصرية لدرجات الأداء</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:7px;">
          ${allEntities.slice(0, 5).map((e: any) => {
            const isC = !!e.isClient;
            const pri = Math.min(10, Number(e.leadPriorityScore) || 0);
            const barW = Math.round(pri * 10);
            const barColor = isC ? '#22c55e' : sc(pri);
            const name = (e.companyName || 'غير معروف').substring(0, 16);
            return `<div style="display:flex;align-items:center;gap:8px;">
              <div style="width:90px;font-size:9px;font-weight:${isC ? '800' : '600'};color:${isC ? '#22c55e' : '#94a3b8'};text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${isC ? '⭐ ' : ''}${name}</div>
              <div style="flex:1;background:rgba(255,255,255,0.04);border-radius:20px;height:14px;overflow:hidden;position:relative;">
                <div style="height:100%;width:${barW}%;background:linear-gradient(90deg,${barColor}cc,${barColor});border-radius:20px;
                  box-shadow:0 0 8px ${barColor}44;transition:width 0.3s;"></div>
                <div style="position:absolute;top:50%;right:6px;transform:translateY(-50%);font-size:8px;font-weight:800;color:rgba(255,255,255,0.6);">${pri.toFixed(1)}</div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>

      <!-- Competitive Gap Analysis -->
      <div style="margin-bottom:12px;background:linear-gradient(135deg,rgba(239,68,68,0.04),rgba(249,115,22,0.03));
        border:1px solid rgba(239,68,68,0.15);border-radius:12px;padding:12px 16px;">
        <div style="font-size:11px;font-weight:800;color:#fca5a5;margin-bottom:10px;display:flex;align-items:center;gap:6px;">
          <span style="font-size:14px;">🔍</span>
          <span>تحليل الثغرات التنافسية — فرص التفوق على المنافسين</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div>
            <div style="font-size:9px;color:#86efac;font-weight:700;margin-bottom:6px;">✅ ميزاتك التنافسية</div>
            ${strengths.map(s => `<div style="display:flex;gap:6px;align-items:flex-start;padding:3px 0;">
              <div style="width:5px;height:5px;border-radius:50%;background:#22c55e;margin-top:4px;flex-shrink:0;"></div>
              <div style="font-size:9px;color:#94a3b8;line-height:1.5;">${s}</div>
            </div>`).join('')}
          </div>
          <div>
            <div style="font-size:9px;color:#fca5a5;font-weight:700;margin-bottom:6px;">🎯 ثغرات يمكن استغلالها</div>
            ${weaknesses.map(w => `<div style="display:flex;gap:6px;align-items:flex-start;padding:3px 0;">
              <div style="width:5px;height:5px;border-radius:50%;background:#ef4444;margin-top:4px;flex-shrink:0;"></div>
              <div style="font-size:9px;color:#94a3b8;line-height:1.5;">${w}</div>
            </div>`).join('')}
          </div>
        </div>
        <!-- Competitive recommendation -->
        <div style="margin-top:10px;padding:8px 12px;background:rgba(34,197,94,0.06);
          border-right:3px solid #22c55e;border-radius:0 8px 8px 0;">
          <div style="font-size:10px;color:#94a3b8;line-height:1.7;">
            <strong style="color:#22c55e;">💡 توصية مكسب:</strong>
            ${clientRank === 1
              ? `${lead.companyName || 'النشاط'} يتصدر المنافسين حالياً — التحدي هو الحفاظ على هذا التفوق وتوسيع الفجوة مع المنافسين.`
              : `الفرصة متاحة لـ${lead.companyName || 'النشاط'} للتفوق على ${competitors.filter((c: any) => (Number(c.leadPriorityScore)||0) > clientPri).length} منافسين من خلال معالجة الثغرات المحددة في هذا التقرير.`
            }
          </div>
        </div>
      </div>
    </div>

    <div style="position:absolute;bottom:0;left:0;right:0;padding:10px 40px;
      background:rgba(0,0,0,0.3);border-top:1px solid rgba(255,255,255,0.04);
      display:flex;align-items:center;justify-content:space-between;">
      <div style="font-size:9px;color:#334155;">${rsFooterText || `حصري من ${coName} — جميع الحقوق محفوظة`}</div>
      <div style="font-size:9px;color:#334155;">CONFIDENTIAL · صفحة 5 من 5</div>
    </div>
  `);

  // ═══════════════════════════════════════════════════════════════════════
  //  PAGE SOCIAL — صفحة تحليل السوشيال ميديا التفصيلي
  // ═══════════════════════════════════════════════════════════════════════

  const p_social = socialAnalyses.length > 0 ? page(`
    <div style="position:absolute;top:-80px;left:-80px;width:320px;height:320px;border-radius:50%;
      background:radial-gradient(circle,rgba(225,48,108,0.05) 0%,transparent 70%);pointer-events:none;"></div>
    <div style="position:absolute;bottom:-60px;right:-60px;width:280px;height:280px;border-radius:50%;
      background:radial-gradient(circle,rgba(105,201,208,0.04) 0%,transparent 70%);pointer-events:none;"></div>

    ${pageHeader("تحليل السوشيال ميديا التفصيلي", `${socialAnalyses.length} منصة محللة — أرقام حقيقية وتقييم ذكي`, "صفحة X/Y", coName, lead)}

    <div style="padding:14px 40px;">

      <!-- Summary row -->
      <div style="display:grid;grid-template-columns:repeat(${Math.min(socialAnalyses.length, 4)},1fr);gap:8px;margin-bottom:16px;">
        ${socialAnalyses.slice(0, 4).map((s: any) => {
          const meta = pm(s.platform);
          const extra = parseSocialExtra(s.rawData);
          const followers = extra.followers ?? extra.followersCount ?? s.followersCount ?? 0;
          const score = s.overallScore ? Number(s.overallScore) : null;
          const color = sc(score);
          return `<div style="background:rgba(255,255,255,0.03);border:1px solid ${meta.color}33;
            border-radius:12px;padding:10px 12px;text-align:center;border-top:3px solid ${meta.color};">
            <div style="font-size:18px;margin-bottom:4px;">${meta.icon}</div>
            <div style="font-size:10px;font-weight:800;color:#f1f5f9;margin-bottom:6px;">${meta.name}</div>
            <div style="font-size:20px;font-weight:900;color:${color};text-shadow:0 0 10px ${color}66;">${followers > 0 ? fmtK(followers) : (score ? score.toFixed(1) : '—')}</div>
            <div style="font-size:8px;color:#475569;margin-top:2px;">${followers > 0 ? 'متابع' : (score ? 'تقييم / 10' : 'لم يُحلَّل')}</div>
          </div>`;
        }).join('')}
      </div>

      <!-- Detailed platform cards -->
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${socialAnalyses.slice(0, 4).map((s: any) => {
          const meta = pm(s.platform);
          const extra = parseSocialExtra(s.rawData);
          const followers = extra.followers ?? extra.followersCount ?? s.followersCount ?? 0;
          const posts = extra.posts ?? extra.postsCount ?? s.postsCount ?? 0;
          const following = extra.following ?? extra.followingCount ?? 0;
          const engRate = extra.engagementRate ?? s.engagementRate ?? 0;
          const avgLikes = extra.avgLikes ?? 0;
          const avgViews = extra.avgViews ?? 0;
          const overallScore = s.overallScore ? Number(s.overallScore) : null;
          const engScore = s.engagementScore ? Number(s.engagementScore) : null;
          const contentScore = s.contentQualityScore ? Number(s.contentQualityScore) : null;
          const stratScore = s.strategyScore ? Number(s.strategyScore) : null;
          const hasCTA = s.hasCTA;
          const hasSeasonalContent = s.hasSeasonalContent;
          const hasPricing = s.hasPricing;
          const summary = s.summary || extra.summary || '';
          const recommendations = s.recommendations || extra.recommendations || [];
          const recsArr = Array.isArray(recommendations) ? recommendations : (typeof recommendations === 'string' ? [recommendations] : []);
          const hasRealData = followers > 0 || posts > 0;
          const hasAiData = overallScore !== null;
          const scoreColor = sc(overallScore);
          return `<div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);
            border-radius:14px;overflow:hidden;border-right:4px solid ${meta.color};">
            <!-- Platform header -->
            <div style="display:flex;align-items:center;justify-content:space-between;
              padding:10px 16px;background:rgba(255,255,255,0.02);border-bottom:1px solid rgba(255,255,255,0.04);">
              <div style="display:flex;align-items:center;gap:10px;">
                <div style="font-size:22px;">${meta.icon}</div>
                <div>
                  <div style="font-size:13px;font-weight:800;color:#f1f5f9;">${meta.name}</div>
                  ${s.profileUrl || lead[s.platform + 'Url'] ? `<div style="font-size:9px;color:#475569;">${cleanUrl(s.profileUrl || lead[s.platform + 'Url'], s.platform)}</div>` : ''}
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:8px;">
                ${hasCTA === false ? `<span style="padding:3px 8px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:10px;font-size:8px;color:#fca5a5;font-weight:700;">لا CTA ✗</span>` : hasCTA === true ? `<span style="padding:3px 8px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);border-radius:10px;font-size:8px;color:#86efac;font-weight:700;">CTA ✓</span>` : ''}
                ${hasSeasonalContent === false ? `<span style="padding:3px 8px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:10px;font-size:8px;color:#fca5a5;font-weight:700;">لا محتوى موسمي ✗</span>` : hasSeasonalContent === true ? `<span style="padding:3px 8px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);border-radius:10px;font-size:8px;color:#86efac;font-weight:700;">محتوى موسمي ✓</span>` : ''}
                ${hasPricing === false ? `<span style="padding:3px 8px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:10px;font-size:8px;color:#fca5a5;font-weight:700;">لا أسعار ✗</span>` : hasPricing === true ? `<span style="padding:3px 8px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);border-radius:10px;font-size:8px;color:#86efac;font-weight:700;">أسعار ✓</span>` : ''}
                ${hasAiData ? `<div style="text-align:center;">
                  <div style="font-size:22px;font-weight:900;color:${scoreColor};text-shadow:0 0 12px ${scoreColor}66;">${overallScore!.toFixed(1)}</div>
                  <div style="font-size:8px;color:#475569;">تقييم / 10</div>
                </div>` : `<div style="padding:4px 10px;background:rgba(100,116,139,0.1);border:1px solid rgba(100,116,139,0.2);border-radius:8px;"><span style="font-size:9px;color:#64748b;">لم يُحلَّل بعد</span></div>`}
              </div>
            </div>
            <!-- Stats + Scores -->
            <div style="padding:10px 16px;display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <!-- Real data stats -->
              <div>
                <div style="font-size:9px;color:#475569;font-weight:700;margin-bottom:8px;letter-spacing:1px;">📊 البيانات الحقيقية</div>
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:8px;">
                  ${[
                    { v: followers > 0 ? fmtK(followers) : '—', label: 'متابع', color: '#22c55e' },
                    { v: posts > 0 ? fmtK(posts) : '—', label: 'منشور', color: '#0ea5e9' },
                    { v: following > 0 ? fmtK(following) : (engRate > 0 ? engRate.toFixed(1)+'%' : '—'), label: following > 0 ? 'يتابع' : 'تفاعل', color: '#a78bfa' },
                  ].map(({ v, label, color }) => `<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);
                    border-radius:8px;padding:8px 6px;text-align:center;">
                    <div style="font-size:16px;font-weight:900;color:${color};text-shadow:0 0 8px ${color}66;">${v}</div>
                    <div style="font-size:8px;color:#475569;margin-top:2px;">${label}</div>
                  </div>`).join('')}
                </div>
                ${avgLikes > 0 || avgViews > 0 ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
                  ${avgLikes > 0 ? `<div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:8px;padding:6px 8px;text-align:center;">
                    <div style="font-size:13px;font-weight:900;color:#f97316;">${fmtK(avgLikes)}</div>
                    <div style="font-size:8px;color:#475569;">متوسط لايكات</div>
                  </div>` : ''}
                  ${avgViews > 0 ? `<div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:8px;padding:6px 8px;text-align:center;">
                    <div style="font-size:13px;font-weight:900;color:#eab308;">${fmtK(avgViews)}</div>
                    <div style="font-size:8px;color:#475569;">متوسط مشاهدات</div>
                  </div>` : ''}
                </div>` : ''}
                ${!hasRealData ? `<div style="padding:8px;background:rgba(100,116,139,0.05);border:1px solid rgba(100,116,139,0.1);border-radius:8px;text-align:center;">
                  <div style="font-size:9px;color:#475569;">لم يتم جلب البيانات الحقيقية بعد</div>
                </div>` : ''}
              </div>
              <!-- AI scores -->
              <div>
                <div style="font-size:9px;color:#475569;font-weight:700;margin-bottom:8px;letter-spacing:1px;">🤖 تقييم الذكاء الاصطناعي</div>
                ${hasAiData ? `
                  ${bar(engScore, 'التفاعل')}
                  ${bar(contentScore, 'جودة المحتوى')}
                  ${bar(stratScore, 'الاستراتيجية')}
                ` : `<div style="padding:8px;background:rgba(100,116,139,0.05);border:1px solid rgba(100,116,139,0.1);border-radius:8px;text-align:center;">
                  <div style="font-size:9px;color:#475569;">اضغط "تحليل شامل" للحصول على تقييم AI</div>
                </div>`}
              </div>
            </div>
            ${summary ? `<div style="padding:0 16px 8px;">
              <div style="padding:8px 12px;background:rgba(255,255,255,0.02);border-right:3px solid ${meta.color}66;border-radius:0 8px 8px 0;">
                <div style="font-size:10px;color:#94a3b8;line-height:1.7;">${summary.substring(0, 200)}${summary.length > 200 ? '...' : ''}</div>
              </div>
            </div>` : ''}
            ${recsArr.length > 0 ? `<div style="padding:0 16px 10px;">
              <div style="font-size:9px;color:#475569;font-weight:700;margin-bottom:6px;">💡 التوصيات</div>
              <div style="display:flex;flex-direction:column;gap:4px;">
                ${recsArr.slice(0, 2).map((r: string) => `<div style="display:flex;align-items:flex-start;gap:6px;">
                  <span style="color:${meta.color};font-size:10px;flex-shrink:0;">▸</span>
                  <span style="font-size:9.5px;color:#94a3b8;line-height:1.6;">${r.substring(0, 120)}${r.length > 120 ? '...' : ''}</span>
                </div>`).join('')}
              </div>
            </div>` : ''}
          </div>`;
        }).join('')}
      </div>
    </div>

    <!-- Footer -->
    <div style="position:absolute;bottom:0;left:0;right:0;padding:10px 40px;
      background:rgba(0,0,0,0.3);border-top:1px solid rgba(255,255,255,0.04);
      display:flex;align-items:center;justify-content:space-between;">
      <div style="font-size:9px;color:#334155;">${coName} · تقرير سري ومخصص</div>
      <div style="font-size:9px;color:#334155;">صفحة X من Y</div>
    </div>
  `) : null;

  // ═══════════════════════════════════════════════════════════════════════
  //  PAGE BRAND — صفحة الهوية البصرية والبراند
  // ═══════════════════════════════════════════════════════════════════════

  // جمع بيانات designQuality وcopyQuality وmissedOpportunities من جميع التحليلات
  const brandData = socialAnalyses
    .map((s: any) => {
      const raw = parseSocialExtra(s.rawData);
      return {
        platform: s.platform,
        designQuality: raw.designQuality || s.designQuality || null,
        copyQuality: raw.copyQuality || s.copyQuality || null,
        missedOpportunities: raw.missedOpportunities || s.missedOpportunities || null,
      };
    })
    .filter((s: any) => s.designQuality || s.copyQuality || s.missedOpportunities);

  const hasBrandData = brandData.length > 0;

  // حساب متوسط درجة الهوية البصرية
  const brandScores = brandData
    .map((s: any) => Number(s.designQuality?.score || 0))
    .filter((v: number) => v > 0);
  const avgBrandScore = brandScores.length > 0
    ? brandScores.reduce((a: number, b: number) => a + b, 0) / brandScores.length
    : null;

  const allDesignWeaknesses: string[] = brandData.flatMap((s: any) => s.designQuality?.weaknesses || []).slice(0, 4);
  const allDesignImprovements: string[] = brandData.flatMap((s: any) => s.designQuality?.improvements || []).slice(0, 4);
  const allCopyWeaknesses: string[] = brandData.flatMap((s: any) => s.copyQuality?.weaknesses || []).slice(0, 3);
  const allCopyImprovements: string[] = brandData.flatMap((s: any) => s.copyQuality?.improvements || []).slice(0, 3);
  const allLostReasons: string[] = brandData.flatMap((s: any) => s.missedOpportunities?.lostCustomerReasons || []).slice(0, 4);
  const allUrgentFixes: string[] = brandData.flatMap((s: any) => s.missedOpportunities?.urgentFixes || []).slice(0, 3);
  const allConversionBarriers: string[] = brandData.flatMap((s: any) => s.missedOpportunities?.conversionBarriers || []).slice(0, 3);

  const brandColor = sc(avgBrandScore);

  const p_brand = hasBrandData ? page(`
    <div style="position:absolute;top:-80px;right:-80px;width:320px;height:320px;border-radius:50%;
      background:radial-gradient(circle,rgba(168,85,247,0.05) 0%,transparent 70%);pointer-events:none;"></div>

    ${pageHeader("الهوية البصرية والبراند", "تحليل جودة التصميم والنصوص والفرص الضائعة", "صفحة 3/5", coName, lead)}

    <div style="padding:14px 40px;">

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px;">
        <div style="background:rgba(168,85,247,0.06);border:1px solid rgba(168,85,247,0.25);border-radius:12px;padding:12px;text-align:center;">
          <div style="font-size:9px;color:#d8b4fe;font-weight:700;margin-bottom:6px;">درجة الهوية البصرية</div>
          <div style="font-size:28px;font-weight:900;color:${brandColor};text-shadow:0 0 15px ${brandColor}66;">${fmt(avgBrandScore)}</div>
          <div style="font-size:8px;color:#475569;margin-top:2px;">من 10 عبر جميع المنصات</div>
        </div>
        <div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.25);border-radius:12px;padding:12px;text-align:center;">
          <div style="font-size:9px;color:#fca5a5;font-weight:700;margin-bottom:6px;">نقاط ضعف تصميمية</div>
          <div style="font-size:28px;font-weight:900;color:#ef4444;text-shadow:0 0 15px rgba(239,68,68,0.6);">${allDesignWeaknesses.length}</div>
          <div style="font-size:8px;color:#475569;margin-top:2px;">تحتاج معالجة عاجلة</div>
        </div>
        <div style="background:rgba(234,179,8,0.06);border:1px solid rgba(234,179,8,0.25);border-radius:12px;padding:12px;text-align:center;">
          <div style="font-size:9px;color:#fde047;font-weight:700;margin-bottom:6px;">فرص ضائعة</div>
          <div style="font-size:28px;font-weight:900;color:#eab308;text-shadow:0 0 15px rgba(234,179,8,0.6);">${allLostReasons.length}</div>
          <div style="font-size:8px;color:#475569;margin-top:2px;">سبب خسارة عميل محتمل</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">

        <div style="display:flex;flex-direction:column;gap:10px;">
          ${allDesignWeaknesses.length > 0 ? `
          <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(168,85,247,0.2);border-radius:12px;padding:12px;border-right:3px solid #a855f7;">
            <div style="font-size:11px;font-weight:800;color:#d8b4fe;margin-bottom:8px;">🎨 نقاط ضعف التصميم</div>
            ${allDesignWeaknesses.map((w: string) => `<div style="display:flex;align-items:flex-start;gap:7px;margin-bottom:5px;"><div style="width:5px;height:5px;border-radius:50%;background:#ef4444;margin-top:5px;flex-shrink:0;"></div><div style="font-size:10px;color:#cbd5e1;line-height:1.5;">${w}</div></div>`).join('')}
          </div>` : ''}
          ${allCopyWeaknesses.length > 0 ? `
          <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(14,165,233,0.2);border-radius:12px;padding:12px;border-right:3px solid #0ea5e9;">
            <div style="font-size:11px;font-weight:800;color:#7dd3fc;margin-bottom:8px;">✏️ ضعف النصوص والرسائل</div>
            ${allCopyWeaknesses.map((w: string) => `<div style="display:flex;align-items:flex-start;gap:7px;margin-bottom:5px;"><div style="width:5px;height:5px;border-radius:50%;background:#0ea5e9;margin-top:5px;flex-shrink:0;"></div><div style="font-size:10px;color:#cbd5e1;line-height:1.5;">${w}</div></div>`).join('')}
          </div>` : ''}
          ${allDesignImprovements.length > 0 ? `
          <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(34,197,94,0.2);border-radius:12px;padding:12px;border-right:3px solid #22c55e;">
            <div style="font-size:11px;font-weight:800;color:#86efac;margin-bottom:8px;">✨ تحسينات تصميمية مقترحة</div>
            ${allDesignImprovements.map((imp: string) => `<div style="display:flex;align-items:flex-start;gap:7px;margin-bottom:5px;"><div style="width:5px;height:5px;border-radius:50%;background:#22c55e;margin-top:5px;flex-shrink:0;"></div><div style="font-size:10px;color:#cbd5e1;line-height:1.5;">${imp}</div></div>`).join('')}
          </div>` : ''}
        </div>

        <div style="display:flex;flex-direction:column;gap:10px;">
          ${allLostReasons.length > 0 ? `
          <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(239,68,68,0.25);border-radius:12px;padding:12px;border-right:3px solid #ef4444;">
            <div style="font-size:11px;font-weight:800;color:#fca5a5;margin-bottom:8px;">🚨 أسباب خسارة العملاء</div>
            ${allLostReasons.map((r: string) => `<div style="display:flex;align-items:flex-start;gap:7px;margin-bottom:5px;"><div style="width:5px;height:5px;border-radius:50%;background:#ef4444;margin-top:5px;flex-shrink:0;"></div><div style="font-size:10px;color:#cbd5e1;line-height:1.5;">${r}</div></div>`).join('')}
          </div>` : ''}
          ${allConversionBarriers.length > 0 ? `
          <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(249,115,22,0.25);border-radius:12px;padding:12px;border-right:3px solid #f97316;">
            <div style="font-size:11px;font-weight:800;color:#fdba74;margin-bottom:8px;">🚧 عوائق التحويل إلى عميل</div>
            ${allConversionBarriers.map((b: string) => `<div style="display:flex;align-items:flex-start;gap:7px;margin-bottom:5px;"><div style="width:5px;height:5px;border-radius:50%;background:#f97316;margin-top:5px;flex-shrink:0;"></div><div style="font-size:10px;color:#cbd5e1;line-height:1.5;">${b}</div></div>`).join('')}
          </div>` : ''}
          ${allUrgentFixes.length > 0 ? `
          <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(234,179,8,0.25);border-radius:12px;padding:12px;border-right:3px solid #eab308;">
            <div style="font-size:11px;font-weight:800;color:#fde047;margin-bottom:8px;">⚡ إصلاحات عاجلة (أكبر فرص ضائعة)</div>
            ${allUrgentFixes.map((f: string) => `<div style="display:flex;align-items:flex-start;gap:7px;margin-bottom:5px;"><div style="width:5px;height:5px;border-radius:50%;background:#eab308;margin-top:5px;flex-shrink:0;"></div><div style="font-size:10px;color:#cbd5e1;line-height:1.5;">${f}</div></div>`).join('')}
          </div>` : ''}
          ${allCopyImprovements.length > 0 ? `
          <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(34,197,94,0.2);border-radius:12px;padding:12px;border-right:3px solid #22c55e;">
            <div style="font-size:11px;font-weight:800;color:#86efac;margin-bottom:8px;">📝 تحسينات نصية مقترحة</div>
            ${allCopyImprovements.map((imp: string) => `<div style="display:flex;align-items:flex-start;gap:7px;margin-bottom:5px;"><div style="width:5px;height:5px;border-radius:50%;background:#22c55e;margin-top:5px;flex-shrink:0;"></div><div style="font-size:10px;color:#cbd5e1;line-height:1.5;">${imp}</div></div>`).join('')}
          </div>` : ''}
        </div>
      </div>
    </div>

    <div style="position:absolute;bottom:0;left:0;right:0;padding:10px 40px;
      background:rgba(0,0,0,0.3);border-top:1px solid rgba(255,255,255,0.04);
      display:flex;align-items:center;justify-content:space-between;">
      <div style="font-size:9px;color:#334155;">${coName} · تقرير سري ومخصص</div>
      <div style="font-size:9px;color:#334155;">صفحة 3 من 5</div>
    </div>
  `) : null;

  // ═══════════════════════════════════════════════════════════════════════
  //  PAGE SIGNATURE — صفحة التوقيع الرقمي الاحترافية
  // ═══════════════════════════════════════════════════════════════════════
  const pSign = page(`
    <!-- Decorative bg -->
    <div style="position:absolute;top:-60px;right:-60px;width:300px;height:300px;border-radius:50%;
      background:radial-gradient(circle,rgba(34,197,94,0.05) 0%,transparent 70%);pointer-events:none;"></div>
    <div style="position:absolute;bottom:-80px;left:-40px;width:350px;height:350px;border-radius:50%;
      background:radial-gradient(circle,rgba(14,165,233,0.04) 0%,transparent 70%);pointer-events:none;"></div>

    <!-- Header -->
    <div style="padding:28px 40px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:14px;">
          ${coLogo
            ? `<img src="${coLogo}" style="height:40px;width:auto;border-radius:8px;border:1px solid rgba(255,255,255,0.1);padding:4px;background:rgba(255,255,255,0.05);" alt="logo">`
            : `<div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#22c55e,#0ea5e9);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:900;color:white;">${coName.charAt(0)}</div>`}
          <div>
            <div style="font-size:16px;font-weight:900;color:#f1f5f9;">${coName}</div>
            <div style="font-size:10px;color:#64748b;margin-top:2px;">تقرير سري ومخصص</div>
          </div>
        </div>
        <div style="text-align:left;">
          <div style="font-size:10px;color:#475569;">رقم التقرير</div>
          <div style="font-size:13px;font-weight:800;color:#22c55e;font-family:monospace;letter-spacing:1px;">${reportRef}</div>
        </div>
      </div>
    </div>

    <!-- Main content -->
    <div style="padding:30px 40px;">

      <!-- Title -->
      <div style="text-align:center;margin-bottom:32px;">
        <div style="font-size:11px;color:#22c55e;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin-bottom:8px;">توقيع رقمي معتمد</div>
        <div style="font-size:26px;font-weight:900;color:#f1f5f9;margin-bottom:6px;">شهادة إعداد التقرير</div>
        <div style="font-size:12px;color:#64748b;">تم إعداد هذا التقرير بشكل حصري ومخصص بناءً على تحليل دقيق لبيانات العميل</div>
      </div>

      <!-- Signature block -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:32px;">

        <!-- Analyst info -->
        <div style="background:linear-gradient(135deg,rgba(34,197,94,0.04),rgba(14,165,233,0.03));
          border:1px solid rgba(34,197,94,0.15);border-radius:16px;padding:24px;">
          <div style="font-size:10px;color:#64748b;font-weight:600;letter-spacing:1px;margin-bottom:16px;">المحلل المعتمد</div>

          <!-- Signature line -->
          <div style="border-bottom:2px solid rgba(34,197,94,0.3);margin-bottom:12px;padding-bottom:12px;">
            <div style="font-size:22px;font-weight:900;color:#22c55e;
              font-family:'Tajawal',cursive;letter-spacing:1px;
              text-shadow:0 0 20px rgba(34,197,94,0.4);">${coAnalystName}</div>
          </div>

          <div style="display:flex;flex-direction:column;gap:8px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <div style="width:6px;height:6px;border-radius:50%;background:#22c55e;flex-shrink:0;"></div>
              <div style="font-size:11px;color:#94a3b8;">${coAnalystTitle}</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              <div style="width:6px;height:6px;border-radius:50%;background:#0ea5e9;flex-shrink:0;"></div>
              <div style="font-size:11px;color:#94a3b8;">${coName}</div>
            </div>
            ${coEmail ? `<div style="display:flex;align-items:center;gap:8px;">
              <div style="width:6px;height:6px;border-radius:50%;background:#8b5cf6;flex-shrink:0;"></div>
              <div style="font-size:11px;color:#94a3b8;">${coEmail}</div>
            </div>` : ''}
            <div style="display:flex;align-items:center;gap:8px;">
              <div style="width:6px;height:6px;border-radius:50%;background:#f59e0b;flex-shrink:0;"></div>
              <div style="font-size:11px;color:#94a3b8;">تاريخ الإصدار: ${reportDate}</div>
            </div>
          </div>
        </div>

        <!-- Report details -->
        <div style="background:linear-gradient(135deg,rgba(14,165,233,0.04),rgba(139,92,246,0.03));
          border:1px solid rgba(14,165,233,0.15);border-radius:16px;padding:24px;">
          <div style="font-size:10px;color:#64748b;font-weight:600;letter-spacing:1px;margin-bottom:16px;">بيانات التقرير</div>

          <div style="display:flex;flex-direction:column;gap:10px;">
            <div style="display:flex;justify-content:space-between;align-items:center;
              padding:8px 12px;background:rgba(255,255,255,0.03);border-radius:8px;">
              <span style="font-size:10px;color:#64748b;">اسم العميل</span>
              <span style="font-size:11px;font-weight:700;color:#f1f5f9;">${lead.companyName || 'غير محدد'}</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;
              padding:8px 12px;background:rgba(255,255,255,0.03);border-radius:8px;">
              <span style="font-size:10px;color:#64748b;">رقم التقرير</span>
              <span style="font-size:11px;font-weight:800;color:#22c55e;font-family:monospace;">${reportRef}</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;
              padding:8px 12px;background:rgba(255,255,255,0.03);border-radius:8px;">
              <span style="font-size:10px;color:#64748b;">تاريخ الإصدار</span>
              <span style="font-size:11px;font-weight:700;color:#f1f5f9;">${reportDate}</span>
            </div>
            ${coCommercialReg ? `<div style="display:flex;justify-content:space-between;align-items:center;
              padding:8px 12px;background:rgba(255,255,255,0.03);border-radius:8px;">
              <span style="font-size:10px;color:#64748b;">سجل تجاري</span>
              <span style="font-size:11px;font-weight:700;color:#f1f5f9;">${coCommercialReg}</span>
            </div>` : ''}
            ${coLogo ? `<div style="display:flex;justify-content:space-between;align-items:center;
              padding:8px 12px;background:rgba(255,255,255,0.03);border-radius:8px;">
              <span style="font-size:10px;color:#64748b;">درجة التحليل</span>
              <span style="font-size:11px;font-weight:700;color:#22c55e;">شامل ومتعمق</span>
            </div>` : ''}
          </div>
        </div>
      </div>

      <!-- QR codes row -->
      <div style="display:flex;align-items:center;justify-content:center;gap:40px;margin-bottom:28px;">
        ${signWaQR ? `<div style="text-align:center;">
          <div style="background:white;padding:8px;border-radius:12px;display:inline-block;
            box-shadow:0 0 20px rgba(34,197,94,0.2);margin-bottom:8px;">
            <img src="${signWaQR}" width="90" height="90" style="display:block;border-radius:4px;" />
          </div>
          <div style="font-size:10px;color:#94a3b8;font-weight:600;">تواصل عبر واتساب</div>
          <div style="font-size:9px;color:#475569;margin-top:2px;">${waPhone}</div>
        </div>` : ''}

        <!-- Seal -->
        <div style="text-align:center;">
          <div style="width:100px;height:100px;border-radius:50%;
            border:3px solid rgba(34,197,94,0.4);border-style:dashed;
            display:flex;flex-direction:column;align-items:center;justify-content:center;
            background:rgba(34,197,94,0.04);margin:0 auto 8px;
            box-shadow:0 0 20px rgba(34,197,94,0.1);">
            <div style="font-size:20px;margin-bottom:2px;">✅</div>
            <div style="font-size:8px;font-weight:800;color:#22c55e;text-align:center;line-height:1.4;">تقرير<br>معتمد</div>
          </div>
          <div style="font-size:9px;color:#475569;">ختم رقمي</div>
        </div>

        ${signCrQR ? `<div style="text-align:center;">
          <div style="background:white;padding:8px;border-radius:12px;display:inline-block;
            box-shadow:0 0 20px rgba(14,165,233,0.2);margin-bottom:8px;">
            <img src="${signCrQR}" width="90" height="90" style="display:block;border-radius:4px;" />
          </div>
          <div style="font-size:10px;color:#94a3b8;font-weight:600;">سجل تجاري</div>
          <div style="font-size:9px;color:#475569;margin-top:2px;">${coCommercialReg}</div>
        </div>` : ''}
      </div>

      <!-- Legal disclaimer -->
      <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);
        border-radius:12px;padding:16px 20px;">
        <div style="font-size:9px;color:#475569;line-height:1.8;text-align:center;">
          هذا التقرير سري ومخصص حصريًا لعناية العميل المذكور أعلاه ويحظر توزيعه أو نسخه دون إذن كتابي مسبق من ${coName}.
          جميع التحليلات والتوصيات الواردة في هذا التقرير هي آراء مهنية مبنية على بيانات متاحة وقت إعداده ولا تمثل ضمانًا لنتائج محددة.
          رقم التقرير: <strong style="color:#22c55e;font-family:monospace;">${reportRef}</strong> &nbsp;·&nbsp; تاريخ الإصدار: ${reportDate}
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div style="position:absolute;bottom:0;left:0;right:0;padding:10px 40px;
      background:rgba(0,0,0,0.3);border-top:1px solid rgba(255,255,255,0.04);
      display:flex;align-items:center;justify-content:space-between;">
      <div style="font-size:9px;color:#334155;">حصري من ${coName} — جميع الحقوق محفوظة © ${new Date().getFullYear()}</div>
      <div style="font-size:9px;color:#334155;font-family:monospace;">${reportRef}</div>
    </div>
  `, false); // آخر صفحة — بدون page-break

  // ═══════════════════════════════════════════════════════════════════════
  //  DYNAMIC PAGE ASSEMBLY — حذف الصفحات الفارغة تلقائياً
  // ═══════════════════════════════════════════════════════════════════════

  // تحديد الصفحات الفعلية بناءً على البيانات المتاحة
  const hasWebsiteData = websiteAnalysis !== null && websiteAnalysis !== undefined;
  const hasSocialData = socialAnalyses.length > 0;
  const hasDigitalData = hasWebsiteData || hasSocialData;
  const hasCompetitors = competitors.length > 0;

  // بناء قائمة الصفحات الديناميكية
  const activePages: Array<{ key: string; html: string }> = [];
  activePages.push({ key: 'p0', html: p0 }); // صفحة استقبال مكسب دائماً
  activePages.push({ key: 'p1', html: p1 }); // الغلاف دائماً
  activePages.push({ key: 'p2', html: p2 }); // الملخص التنفيذي دائماً
  if (hasDigitalData) activePages.push({ key: 'p3', html: p3 }); // التحليل الرقمي فقط إذا كانت هناك بيانات
  if (hasSocialData && p_social) activePages.push({ key: 'p_social', html: p_social }); // تحليل السوشيال التفصيلي
  if (hasBrandData && p_brand) activePages.push({ key: 'p_brand', html: p_brand }); // الهوية البصرية فقط إذا كانت هناك بيانات
  if (hasCompetitors) activePages.push({ key: 'p5', html: p5 }); // المنافسون قبل التوصيات
  activePages.push({ key: 'p4', html: p4 }); // التوصيات دائماً
  activePages.push({ key: 'pSign', html: pSign }); // صفحة التوقيع الرقمي دائماً في الآخر

  const totalPages = activePages.length;

  // تحديث أرقام الصفحات ديناميكياً في HTML
  function updatePageNumbers(html: string, pageNum: number, total: number): string {
    return html
      .replace(/صفحة \d+\/\d+/g, `صفحة ${pageNum}/${total}`)
      .replace(/صفحة (\d+) من (\d+)/g, `صفحة ${pageNum} من ${total}`)
      .replace(/CONFIDENTIAL · صفحة (\d+) من (\d+)/g, `CONFIDENTIAL · صفحة ${pageNum} من ${total}`);
  }

  const pagesHTML = activePages
    .map((p, i) => `<div class="page-wrapper">${updatePageNumbers(p.html, i + 1, totalPages)}</div>`)
    .join('\n  ');

  const printHTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>${fileName}</title>
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Tajawal', 'Arial', sans-serif;
    direction: rtl;
    text-align: right;
    background: #0a0f1e;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }
  @media print {
    body { background: #020810; margin: 0; padding: 0; }
    .page-wrapper { box-shadow: none !important; margin: 0 !important; }
  }
  @page {
    size: A4 portrait;
    margin: 0;
  }
  #print-toolbar { display: none !important; }
  .pages-container {
    padding: 20px 20px 30px;
    display: flex; flex-direction: column; align-items: center; gap: 24px;
  }
  @media print {
    .pages-container { padding: 0; gap: 0; }
  }
  .page-wrapper {
    width: 210mm;
    box-shadow: 0 8px 40px rgba(0,0,0,0.6), 0 0 60px rgba(34,197,94,0.04);
  }
</style>
</head>
<body>
<div id="print-toolbar">
  <div class="info">
    <div class="title">📄 ${fileName}</div>
    <div class="hint">⚠️ عند الطباعة: فعّل "رسومات الخلفية" (Background graphics) لتظهر الألوان والتأثيرات</div>
  </div>
  <div class="actions">
    <button class="btn-print" onclick="window.print()">⬇️ حفظ PDF</button>
    <button class="btn-close" onclick="window.close()">✕ إغلاق</button>
  </div>
</div>
<div class="pages-container">
  ${pagesHTML}
</div>
</body>
</html>`;

  // فتح التقرير بدون نوافذ منبثقة عبر Blob URL
  const blob = new Blob([printHTML], { type: 'text/html;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);

  // محاولة فتح نافذة جديدة أولاً (قد يعمل في بعض المتصفحات)
  const newWin = window.open(blobUrl, '_blank');
  if (newWin) {
    // تنظيف الذاكرة بعد 60 ثانية
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  } else {
    // النافذة محجوبة — تنزيل مباشر كملف HTML
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `${fileName}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  previewLeadPDF — نفس generateLeadPDF
// ═══════════════════════════════════════════════════════════════════════
export async function previewLeadPDF(options: GeneratePDFOptions): Promise<void> {
  await generateLeadPDF(options);
}
