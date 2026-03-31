/**
 * OpportunityList — PHASE 6B
 *
 * Responsibilities:
 * - Display discovered opportunities from scoring pipeline
 * - Show empty/not-run states clearly
 *
 * Owns: nothing — all data comes from props
 */
import { TrendingUp } from "lucide-react";

// Arabic labels for OpportunityType — mirrors OPPORTUNITY_LABELS in templates.ts
// Kept here to avoid server-side import in client bundle
const OPPORTUNITY_LABELS: Record<string, string> = {
  local_seo: "تحسين السيو المحلي",
  technical_seo: "إصلاح السيو التقني",
  content_strategy: "استراتيجية المحتوى",
  social_optimization: "تحسين السوشيال ميديا",
  branding: "بناء الهوية البصرية",
  landing_page: "صفحة هبوط احترافية",
  paid_tracking: "تتبع الإعلانات المدفوعة",
  retargeting: "إعادة الاستهداف",
  whatsapp_funnel: "قمع واتساب للمبيعات",
  reputation_management: "إدارة السمعة الرقمية",
  conversion_optimization: "تحسين معدل التحويل",
};

const SEVERITY_CONFIG = {
  high: { label: "عالية", color: "oklch(0.58 0.22 25)", bg: "oklch(0.58 0.22 25 / 0.12)" },
  medium: { label: "متوسطة", color: "oklch(0.78 0.16 75)", bg: "oklch(0.78 0.16 75 / 0.12)" },
  low: { label: "منخفضة", color: "oklch(0.65 0.18 200)", bg: "oklch(0.65 0.18 200 / 0.12)" },
};

type Opportunity = {
  id: string;
  type: string;
  severity: "low" | "medium" | "high";
  evidence: string[];
  businessImpact: string;
  suggestedAction: string;
};

type Props = {
  opportunities: Opportunity[] | undefined;
};

export default function OpportunityList({ opportunities }: Props) {
  // ── Not-run state ──────────────────────────────────────────────────────────
  if (opportunities === undefined) {
    return (
      <div className="rounded-2xl p-5 border border-border text-center space-y-2" style={{ background: "oklch(0.12 0.015 240)" }}>
        <TrendingUp className="w-7 h-7 mx-auto text-muted-foreground opacity-25" />
        <p className="text-sm font-medium text-foreground">شغّل التقييم أولاً</p>
        <p className="text-xs text-muted-foreground">ستظهر الفرص المكتشفة هنا بعد تشغيل التقييم</p>
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  if (opportunities.length === 0) {
    return (
      <div className="rounded-2xl p-5 border border-border text-center space-y-2" style={{ background: "oklch(0.12 0.015 240)" }}>
        <TrendingUp className="w-7 h-7 mx-auto text-muted-foreground opacity-25" />
        <p className="text-sm font-medium text-foreground">لم تُكتشف فرص</p>
        <p className="text-xs text-muted-foreground">لم تُكتشف فرص تسويقية واضحة لهذا العميل بناءً على البيانات المتاحة</p>
      </div>
    );
  }

  // ── List state ─────────────────────────────────────────────────────────────
  // Sort: high → medium → low
  const sorted = [...opportunities].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.severity] - order[b.severity];
  });

  return (
    <div className="rounded-2xl border border-border overflow-hidden" style={{ background: "oklch(0.12 0.015 240)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <TrendingUp className="w-4 h-4" style={{ color: "oklch(0.65 0.18 145)" }} />
          الفرص المكتشفة
        </h4>
        <span
          className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{ background: "oklch(0.65 0.18 145 / 0.15)", color: "oklch(0.65 0.18 145)" }}
        >
          {opportunities.length} فرصة
        </span>
      </div>

      {/* Opportunity rows */}
      <div className="divide-y divide-border">
        {sorted.map((opp) => {
          const sevCfg = SEVERITY_CONFIG[opp.severity];
          const label = OPPORTUNITY_LABELS[opp.type] ?? opp.type;
          return (
            <div key={opp.id} className="px-4 py-3 space-y-2">
              {/* Row header */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground">{label}</span>
                <span
                  className="text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium"
                  style={{ background: sevCfg.bg, color: sevCfg.color }}
                >
                  {sevCfg.label}
                </span>
              </div>
              {/* Business impact */}
              <p className="text-xs text-muted-foreground leading-relaxed">{opp.businessImpact}</p>
              {/* Suggested action */}
              <p
                className="text-xs px-3 py-2 rounded-lg leading-relaxed"
                style={{ background: "oklch(0.65 0.18 200 / 0.06)", color: "oklch(0.75 0.18 200)", border: "1px solid oklch(0.65 0.18 200 / 0.15)" }}
              >
                ← {opp.suggestedAction}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
