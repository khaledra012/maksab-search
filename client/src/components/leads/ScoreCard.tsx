/**
 * ScoreCard — PHASE 6B
 *
 * Responsibilities:
 * - Display scoring result (value, priority, reasons, breakdown)
 * - Show empty/loading/error states
 * - Trigger scoring via onRunScore callback (owned by LeadDetail)
 *
 * Owns: nothing — all state comes from props
 */
import { Loader2, Target, RefreshCw, AlertTriangle } from "lucide-react";

export type ScoringPipelineResult = {
  leadId: number;
  success: boolean;
  completedSteps: string[];
  failedSteps: Array<{ step: string; error: string }>;
  score: {
    value: number;
    priority: "A" | "B" | "C" | "D";
    reasons: string[];
    breakdown: {
      contactability: number;
      digitalPresence: number;
      commercialClarity: number;
      gapSeverity: number;
      opportunityFit: number;
      evidenceQuality: number;
    };
  } | null;
  opportunities: Array<{
    id: string;
    type: string;
    severity: "low" | "medium" | "high";
    evidence: string[];
    businessImpact: string;
    suggestedAction: string;
  }>;
  readinessState: string | null;
  dbUpdated: boolean;
  dbSkipReason?: string | null;
};

type Props = {
  scoreResult: ScoringPipelineResult | null;
  isScoring: boolean;
  onRunScore: () => void;
};

const PRIORITY_CONFIG: Record<"A" | "B" | "C" | "D", { label: string; color: string; bg: string }> = {
  A: { label: "أولوية A", color: "oklch(0.65 0.2 145)", bg: "oklch(0.65 0.2 145 / 0.15)" },
  B: { label: "أولوية B", color: "oklch(0.78 0.16 75)", bg: "oklch(0.78 0.16 75 / 0.15)" },
  C: { label: "أولوية C", color: "oklch(0.65 0.18 200)", bg: "oklch(0.65 0.18 200 / 0.15)" },
  D: { label: "أولوية D", color: "oklch(0.55 0.05 240)", bg: "oklch(0.55 0.05 240 / 0.15)" },
};

const BREAKDOWN_LABELS: Record<string, string> = {
  contactability: "قابلية التواصل",
  digitalPresence: "الحضور الرقمي",
  commercialClarity: "وضوح النشاط",
  gapSeverity: "حجم الفجوات",
  opportunityFit: "ملاءمة الفرص",
  evidenceQuality: "جودة الأدلة",
};

function getScoreColor(value: number): string {
  if (value >= 70) return "oklch(0.65 0.2 145)";
  if (value >= 50) return "oklch(0.78 0.16 75)";
  if (value >= 30) return "oklch(0.65 0.18 200)";
  return "oklch(0.58 0.22 25)";
}

export default function ScoreCard({ scoreResult, isScoring, onRunScore }: Props) {
  // ── Loading state ──────────────────────────────────────────────────────────
  if (isScoring) {
    return (
      <div className="rounded-2xl p-5 border border-border space-y-3" style={{ background: "oklch(0.12 0.015 240)" }}>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Target className="w-5 h-5" style={{ color: "oklch(0.65 0.18 200 / 0.3)" }} />
            <Loader2 className="w-3 h-3 animate-spin absolute -top-0.5 -right-0.5" style={{ color: "oklch(0.75 0.18 200)" }} />
          </div>
          <span className="text-sm font-semibold text-foreground">جاري التقييم...</span>
        </div>
        <p className="text-xs text-muted-foreground">يستغرق 5-15 ثانية</p>
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!scoreResult) {
    return (
      <div className="rounded-2xl p-5 border border-border space-y-3 text-center" style={{ background: "oklch(0.12 0.015 240)" }}>
        <Target className="w-8 h-8 mx-auto text-muted-foreground opacity-30" />
        <div>
          <p className="text-sm font-medium text-foreground">لم يتم التقييم بعد</p>
          <p className="text-xs text-muted-foreground mt-1">شغّل التقييم لمعرفة درجة هذا العميل والفرص المتاحة</p>
        </div>
        <button
          onClick={onRunScore}
          className="flex items-center justify-center gap-2 mx-auto px-4 py-2 rounded-xl text-sm font-semibold transition-all"
          style={{ background: "oklch(0.65 0.18 200 / 0.15)", color: "oklch(0.75 0.18 200)", border: "1px solid oklch(0.65 0.18 200 / 0.3)" }}
        >
          <Target className="w-4 h-4" />
          تشغيل التقييم
        </button>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (!scoreResult.success || !scoreResult.score) {
    const firstError = scoreResult.failedSteps?.[0];
    return (
      <div className="rounded-2xl p-5 border space-y-3" style={{ background: "oklch(0.12 0.015 240)", borderColor: "oklch(0.58 0.22 25 / 0.3)" }}>
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: "oklch(0.65 0.18 25)" }} />
          <span className="text-sm font-semibold text-foreground">فشل التقييم</span>
        </div>
        {firstError && (
          <p className="text-xs text-muted-foreground font-mono bg-black/20 px-3 py-2 rounded-lg">
            {firstError.step}: {firstError.error}
          </p>
        )}
        <button
          onClick={onRunScore}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
          style={{ background: "oklch(0.65 0.18 200 / 0.1)", color: "oklch(0.65 0.18 200)", border: "1px solid oklch(0.65 0.18 200 / 0.25)" }}
        >
          <RefreshCw className="w-3 h-3" />
          إعادة المحاولة
        </button>
      </div>
    );
  }

  // ── Success state ──────────────────────────────────────────────────────────
  const { score } = scoreResult;
  const scoreColor = getScoreColor(score.value);
  const priorityCfg = PRIORITY_CONFIG[score.priority];

  return (
    <div className="rounded-2xl p-5 border border-border space-y-4" style={{ background: "oklch(0.12 0.015 240)" }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Target className="w-4 h-4" style={{ color: "oklch(0.65 0.18 200)" }} />
          نتيجة التقييم
        </h4>
        <button
          onClick={onRunScore}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-all"
          title="إعادة التقييم"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Score + Priority */}
      <div className="flex items-center gap-4">
        {/* Score circle */}
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-2xl border-2 flex-shrink-0"
          style={{ borderColor: scoreColor, color: scoreColor, background: "oklch(0.14 0.015 240)" }}
        >
          {score.value}
        </div>
        <div className="space-y-1.5">
          <span
            className="inline-block text-xs font-bold px-2.5 py-1 rounded-lg"
            style={{ background: priorityCfg.bg, color: priorityCfg.color }}
          >
            {priorityCfg.label}
          </span>
          <p className="text-xs text-muted-foreground">من 100 نقطة</p>
        </div>
      </div>

      {/* Breakdown bars */}
      <div className="space-y-2">
        {Object.entries(score.breakdown).map(([key, val]) => {
          // val is 0..1 (raw ratio), convert to 0..100 percentage for display
          const pct = Math.round(Math.min(val * 100, 100));
          const barColor = pct >= 70 ? "oklch(0.65 0.2 145)" : pct >= 40 ? "oklch(0.78 0.16 75)" : "oklch(0.58 0.22 25)";
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-28 flex-shrink-0">{BREAKDOWN_LABELS[key] ?? key}</span>
              <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "oklch(0.18 0.02 240)" }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, background: barColor }}
                />
              </div>
              <span className="text-xs font-mono w-8 text-right" style={{ color: barColor }}>{pct}%</span>
            </div>
          );
        })}
      </div>

      {/* Top reasons */}
      {score.reasons.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-border">
          <p className="text-xs font-semibold text-muted-foreground">أبرز الأسباب</p>
          {score.reasons.slice(0, 3).map((r, i) => (
            <p key={i} className="text-xs text-foreground flex items-start gap-2">
              <span className="mt-0.5 flex-shrink-0 w-1.5 h-1.5 rounded-full" style={{ background: scoreColor }} />
              {r}
            </p>
          ))}
        </div>
      )}

      {/* DB update indicator */}
      {scoreResult.dbUpdated && (
        <p className="text-xs text-muted-foreground opacity-60">✓ تم تحديث الأولوية في قاعدة البيانات</p>
      )}
      {scoreResult.dbSkipReason && (
        <p className="text-xs text-muted-foreground opacity-60">⚠ لم تُحدَّث الأولوية: {scoreResult.dbSkipReason}</p>
      )}
    </div>
  );
}
