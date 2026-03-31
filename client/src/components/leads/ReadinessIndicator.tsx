/**
 * ReadinessIndicator — PHASE 6B
 *
 * Responsibilities:
 * - Display analysis readiness state using existing DB fields (no recomputation)
 * - Distinguish clearly between 4 states:
 *   1. ready_for_analysis     → analysisReadyFlag === true
 *   2. partially_analyzable   → partialAnalysisFlag === true && !analysisReadyFlag
 *   3. missing_critical_data  → !analysisReadyFlag && !partialAnalysisFlag && confidenceScore > 0
 *   4. not_analyzable         → !analysisReadyFlag && !partialAnalysisFlag && confidenceScore === 0
 *
 * IMPORTANT: States 3 and 4 are visually distinct — "partially analyzable" means
 * some analysis is possible but degraded; "not analyzable" means analysis cannot run at all.
 *
 * Owns: nothing — reads from lead props only
 */
import { CheckCircle, AlertTriangle, XCircle, Clock } from "lucide-react";

type Props = {
  analysisReadyFlag: boolean | null | undefined;
  partialAnalysisFlag: boolean | null | undefined;
  analysisConfidenceScore: number | null | undefined;
};

type ReadinessState = "ready" | "partial" | "missing_critical" | "not_analyzable";

function deriveState(
  analysisReadyFlag: boolean | null | undefined,
  partialAnalysisFlag: boolean | null | undefined,
  analysisConfidenceScore: number | null | undefined
): ReadinessState {
  if (analysisReadyFlag === true) return "ready";
  if (partialAnalysisFlag === true) return "partial";
  const score = analysisConfidenceScore ?? 0;
  if (score > 0) return "missing_critical";
  return "not_analyzable";
}

const STATE_CONFIG: Record<ReadinessState, {
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  border: string;
}> = {
  ready: {
    label: "جاهز للتحليل",
    sublabel: "البيانات الأساسية متوفرة — يمكن تشغيل التقييم الكامل",
    icon: <CheckCircle className="w-4 h-4" />,
    color: "oklch(0.65 0.2 145)",
    bg: "oklch(0.65 0.2 145 / 0.1)",
    border: "oklch(0.65 0.2 145 / 0.3)",
  },
  partial: {
    label: "قابل للتحليل جزئياً",
    sublabel: "بعض البيانات ناقصة — التحليل ممكن لكن بدقة أقل",
    icon: <Clock className="w-4 h-4" />,
    color: "oklch(0.78 0.16 75)",
    bg: "oklch(0.78 0.16 75 / 0.1)",
    border: "oklch(0.78 0.16 75 / 0.3)",
  },
  missing_critical: {
    label: "بيانات حرجة ناقصة",
    sublabel: "حقول أساسية مفقودة — التحليل سيكون محدوداً جداً",
    icon: <AlertTriangle className="w-4 h-4" />,
    color: "oklch(0.65 0.18 25)",
    bg: "oklch(0.65 0.18 25 / 0.1)",
    border: "oklch(0.65 0.18 25 / 0.3)",
  },
  not_analyzable: {
    label: "غير قابل للتحليل",
    sublabel: "البيانات غير كافية لإجراء أي تحليل — أضف بيانات أساسية أولاً",
    icon: <XCircle className="w-4 h-4" />,
    color: "oklch(0.55 0.22 25)",
    bg: "oklch(0.55 0.22 25 / 0.08)",
    border: "oklch(0.55 0.22 25 / 0.3)",
  },
};

export default function ReadinessIndicator({
  analysisReadyFlag,
  partialAnalysisFlag,
  analysisConfidenceScore,
}: Props) {
  const state = deriveState(analysisReadyFlag, partialAnalysisFlag, analysisConfidenceScore);
  const cfg = STATE_CONFIG[state];
  const confidence = Math.round((analysisConfidenceScore ?? 0) * 100);

  return (
    <div
      className="rounded-2xl p-4 space-y-3"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
    >
      {/* State badge */}
      <div className="flex items-center gap-2">
        <span style={{ color: cfg.color }}>{cfg.icon}</span>
        <span className="text-sm font-semibold" style={{ color: cfg.color }}>
          {cfg.label}
        </span>
      </div>

      {/* Sublabel */}
      <p className="text-xs text-muted-foreground leading-relaxed">{cfg.sublabel}</p>

      {/* Confidence bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">درجة الثقة</span>
          <span className="text-xs font-bold" style={{ color: cfg.color }}>{confidence}%</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "oklch(0.18 0.02 240)" }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${confidence}%`, background: cfg.color }}
          />
        </div>
      </div>
    </div>
  );
}
