/**
 * AutoSearchPanel — واجهة Auto Search Mode
 * تعرض: شريط التقدم، الخطوات الجارية، المرشحين، أزرار التحكم
 */
import { useState, useEffect, useRef } from "react";
import {
  Zap, Square, Pause, Play, CheckCircle2, XCircle, Clock,
  AlertCircle, ExternalLink, Check, X, ChevronDown, ChevronUp,
  Layers, Globe, Instagram, Twitter, Facebook, Linkedin, Phone, MapPin
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import type { AutoSearchSession, SearchCandidate, SearchStep } from "../../../../server/lib/autoSearchEngine";

// أيقونات المنصات
const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z"/>
  </svg>
);

const SnapchatIcon = () => (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
    <path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301.165-.088.344-.104.464-.104.182 0 .359.029.509.09.45.149.734.479.734.838.015.449-.39.839-1.213 1.168-.089.029-.209.075-.344.119-.45.135-1.139.36-1.333.81-.09.224-.061.524.12.868l.015.015c.06.136 1.526 3.475 4.791 4.014.255.044.435.27.42.509 0 .075-.015.149-.045.225-.24.569-1.273.988-3.146 1.271-.059.091-.12.375-.164.57-.029.179-.074.36-.134.553-.076.271-.27.405-.555.405h-.03c-.135 0-.313-.031-.538-.074-.36-.075-.765-.135-1.273-.135-.3 0-.599.015-.913.074-.6.104-1.123.464-1.723.884-.853.599-1.826 1.288-3.294 1.288-.06 0-.119-.015-.18-.015h-.149c-1.468 0-2.427-.675-3.279-1.288-.599-.42-1.107-.779-1.707-.884-.314-.045-.629-.074-.928-.074-.54 0-.958.089-1.272.149-.211.043-.391.074-.54.074-.374 0-.523-.224-.583-.42-.061-.192-.09-.389-.135-.567-.046-.181-.105-.494-.166-.57-1.918-.222-2.95-.642-3.189-1.226-.031-.063-.052-.15-.055-.225-.015-.243.165-.465.42-.509 3.264-.54 4.73-3.879 4.791-4.02l.016-.029c.18-.345.224-.645.119-.869-.195-.434-.884-.658-1.332-.809-.121-.029-.24-.074-.346-.119-1.107-.435-1.257-.93-1.197-1.273.09-.479.674-.793 1.168-.793.146 0 .27.029.383.074.42.194.789.3 1.104.3.234 0 .384-.06.465-.105l-.046-.569c-.098-1.626-.225-3.651.307-4.837C7.392 1.077 10.739.807 11.727.807l.419-.015h.06z"/>
  </svg>
);

const FIELD_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  googleMapsUrl: { label: "Google Maps", icon: <MapPin className="w-3.5 h-3.5" />, color: "oklch(0.65 0.18 145)" },
  phone: { label: "الهاتف", icon: <Phone className="w-3.5 h-3.5" />, color: "oklch(0.65 0.18 200)" },
  website: { label: "الموقع", icon: <Globe className="w-3.5 h-3.5" />, color: "oklch(0.65 0.15 240)" },
  instagramUrl: { label: "إنستغرام", icon: <Instagram className="w-3.5 h-3.5" />, color: "oklch(0.65 0.22 340)" },
  tiktokUrl: { label: "تيك توك", icon: <TikTokIcon />, color: "oklch(0.65 0.05 240)" },
  snapchatUrl: { label: "سناب شات", icon: <SnapchatIcon />, color: "oklch(0.85 0.18 75)" },
  facebookUrl: { label: "فيسبوك", icon: <Facebook className="w-3.5 h-3.5" />, color: "oklch(0.65 0.18 240)" },
  twitterUrl: { label: "تويتر", icon: <Twitter className="w-3.5 h-3.5" />, color: "oklch(0.65 0.15 220)" },
  linkedinUrl: { label: "لينكد إن", icon: <Linkedin className="w-3.5 h-3.5" />, color: "oklch(0.65 0.18 230)" },
};

const LAYER_META: Record<string, { label: string; color: string }> = {
  serp: { label: "Google SERP", color: "oklch(0.65 0.18 145)" },
  brightdata_dataset: { label: "Bright Data", color: "oklch(0.65 0.22 280)" },
  google_maps: { label: "Google Maps", color: "oklch(0.65 0.18 200)" },
  ai_guided: { label: "AI-Guided", color: "oklch(0.85 0.18 75)" },
};

const CONFIDENCE_META = {
  high: { label: "ثقة عالية", color: "oklch(0.65 0.18 145)", bg: "color-mix(in oklch, oklch(0.65 0.18 145) 12%, transparent)" },
  medium: { label: "ثقة متوسطة", color: "oklch(0.65 0.18 60)", bg: "color-mix(in oklch, oklch(0.65 0.18 60) 12%, transparent)" },
  low: { label: "ثقة منخفضة", color: "oklch(0.65 0.05 240)", bg: "color-mix(in oklch, oklch(0.65 0.05 240) 12%, transparent)" },
};

interface AutoSearchPanelProps {
  leadId: number;
  leadName: string;
  onFieldApplied: () => void;
}

export default function AutoSearchPanel({ leadId, leadName, onFieldApplied }: AutoSearchPanelProps) {
  const utils = trpc.useUtils();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<AutoSearchSession | null>(null);
  const [showSteps, setShowSteps] = useState(false);
  const [appliedValues, setAppliedValues] = useState<Set<string>>(new Set());
  const [rejectedValues, setRejectedValues] = useState<Set<string>>(new Set());
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startSearch = trpc.autoSearch.start.useMutation();
  const stopSearch = trpc.autoSearch.stop.useMutation();
  const pauseSearch = trpc.autoSearch.pause.useMutation();
  const getStatus = trpc.autoSearch.getStatus.useQuery(
    { sessionId: sessionId! },
    { enabled: !!sessionId, refetchInterval: sessionId && session?.status === "running" ? 3000 : false }
  );
  const applyCandidate = trpc.autoSearch.applyCandidate.useMutation();
  const rejectCandidate = trpc.autoSearch.rejectCandidate.useMutation();
  const completeness = trpc.autoSearch.getDataCompleteness.useQuery({ leadId });

  // تحديث الجلسة عند جلب البيانات
  useEffect(() => {
    if (getStatus.data) {
      setSession(getStatus.data as AutoSearchSession);
    }
  }, [getStatus.data]);

  // إيقاف الـ polling عند اكتمال الجلسة
  useEffect(() => {
    if (session?.status === "completed" || session?.status === "stopped") {
      if (pollingRef.current) clearInterval(pollingRef.current);
    }
  }, [session?.status]);

  const handleStart = async () => {
    try {
      const result = await startSearch.mutateAsync({ leadId });
      setSessionId(result.sessionId);
      toast.success(`بدأ البحث التلقائي — ${result.totalSteps} خطوة`);
    } catch (err: any) {
      toast.error(err.message || "فشل بدء البحث");
    }
  };

  const handleStop = async () => {
    if (!sessionId) return;
    await stopSearch.mutateAsync({ sessionId });
    toast.info("تم إيقاف البحث");
  };

  const handleApply = async (candidate: SearchCandidate) => {
    if (!sessionId) return;
    try {
      await applyCandidate.mutateAsync({
        leadId,
        sessionId,
        field: candidate.field as any,
        value: candidate.value,
      });
      setAppliedValues(prev => { const next = new Set(prev); next.add(candidate.value); return next; });
      toast.success(`تم حفظ ${FIELD_META[candidate.field]?.label || candidate.field}`);
      onFieldApplied();
      completeness.refetch();
    } catch {
      toast.error("فشل حفظ البيانات");
    }
  };

  const handleReject = async (candidate: SearchCandidate) => {
    if (!sessionId) return;
    await rejectCandidate.mutateAsync({ sessionId, field: candidate.field, value: candidate.value });
    setRejectedValues(prev => { const next = new Set(prev); next.add(candidate.value); return next; });
  };

  const progressPercent = session
    ? Math.round((session.completedSteps / Math.max(session.totalSteps, 1)) * 100)
    : 0;

  const visibleCandidates = session?.candidates.filter(
    c => !rejectedValues.has(c.value)
  ) || [];

  const highConfidenceCandidates = visibleCandidates.filter(c => c.confidence === "high");
  const otherCandidates = visibleCandidates.filter(c => c.confidence !== "high");

  const isRunning = session?.status === "running";
  const isCompleted = session?.status === "completed" || session?.status === "stopped";

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ background: "oklch(0.11 0.015 240)", borderColor: "oklch(0.22 0.03 240)" }}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b" style={{ borderColor: "oklch(0.22 0.03 240)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "color-mix(in oklch, oklch(0.65 0.18 280) 15%, transparent)" }}
            >
              <Zap className="w-4 h-4" style={{ color: "oklch(0.65 0.18 280)" }} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">البحث التلقائي الذكي</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {completeness.data
                  ? `اكتمال البيانات: ${completeness.data.completeness}% · ${completeness.data.missingFields.length} حقل مفقود`
                  : "يبحث عبر 3 طبقات: SERP + Bright Data + Google Maps"
                }
              </p>
            </div>
          </div>

          {/* أزرار التحكم */}
          <div className="flex items-center gap-2">
            {!session && (
              <button
                onClick={handleStart}
                disabled={startSearch.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
                style={{ background: "oklch(0.65 0.18 280)" }}
              >
                <Zap className="w-4 h-4" />
                {startSearch.isPending ? "جاري البدء..." : "ابدأ البحث التلقائي"}
              </button>
            )}

            {isRunning && (
              <>
                <button
                  onClick={handleStop}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all"
                  style={{ borderColor: "oklch(0.65 0.18 25)", color: "oklch(0.65 0.18 25)" }}
                >
                  <Square className="w-3.5 h-3.5" />
                  إيقاف
                </button>
              </>
            )}

            {isCompleted && (
              <button
                onClick={handleStart}
                disabled={startSearch.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all"
                style={{ borderColor: "oklch(0.65 0.18 280)", color: "oklch(0.65 0.18 280)" }}
              >
                <Play className="w-3.5 h-3.5" />
                بحث جديد
              </button>
            )}
          </div>
        </div>

        {/* شريط التقدم */}
        {session && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {session.completedSteps} / {session.totalSteps} خطوة
              </span>
              <div className="flex items-center gap-2">
                {isRunning && (
                  <span className="flex items-center gap-1" style={{ color: "oklch(0.65 0.18 280)" }}>
                    <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "oklch(0.65 0.18 280)" }} />
                    جاري البحث...
                  </span>
                )}
                {session.status === "completed" && (
                  <span className="flex items-center gap-1" style={{ color: "oklch(0.65 0.18 145)" }}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    اكتمل البحث
                  </span>
                )}
                {session.status === "stopped" && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Square className="w-3.5 h-3.5" />
                    أُوقف البحث
                  </span>
                )}
                <span className="font-medium text-foreground">{progressPercent}%</span>
              </div>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "oklch(0.18 0.02 240)" }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progressPercent}%`,
                  background: isCompleted
                    ? "oklch(0.65 0.18 145)"
                    : "oklch(0.65 0.18 280)",
                }}
              />
            </div>

            {/* الطبقات النشطة */}
            <div className="flex items-center gap-2 mt-1">
              {Object.entries(LAYER_META).map(([key, meta]) => {
                const hasSteps = session.steps.some(s => s.layer === key);
                const doneSteps = session.steps.filter(s => s.layer === key && s.status === "done").length;
                const totalSteps = session.steps.filter(s => s.layer === key).length;
                if (!hasSteps) return null;
                return (
                  <div key={key} className="flex items-center gap-1 text-xs">
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: doneSteps === totalSteps ? meta.color : "oklch(0.35 0.02 240)" }}
                    />
                    <span style={{ color: doneSteps === totalSteps ? meta.color : "oklch(0.5 0.02 240)" }}>
                      {meta.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* المرشحون */}
      {visibleCandidates.length > 0 && (
        <div className="p-4 space-y-3">
          <p className="text-xs font-medium text-muted-foreground">
            النتائج المُكتشفة ({visibleCandidates.length})
          </p>

          {/* الثقة العالية أولاً */}
          {highConfidenceCandidates.length > 0 && (
            <div className="space-y-2">
              {highConfidenceCandidates.map((candidate, i) => (
                <CandidateCard
                  key={i}
                  candidate={candidate}
                  isApplied={appliedValues.has(candidate.value)}
                  onApply={() => handleApply(candidate)}
                  onReject={() => handleReject(candidate)}
                />
              ))}
            </div>
          )}

          {/* باقي النتائج */}
          {otherCandidates.length > 0 && (
            <div className="space-y-2">
              {highConfidenceCandidates.length > 0 && (
                <p className="text-xs text-muted-foreground pt-1">نتائج أخرى</p>
              )}
              {otherCandidates.map((candidate, i) => (
                <CandidateCard
                  key={i}
                  candidate={candidate}
                  isApplied={appliedValues.has(candidate.value)}
                  onApply={() => handleApply(candidate)}
                  onReject={() => handleReject(candidate)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* لا نتائج */}
      {session && visibleCandidates.length === 0 && isCompleted && (
        <div className="px-5 py-6 text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-50" />
          <p className="text-sm text-muted-foreground">
            {session.stopReason || "لم تُعثر على نتائج في المسارات المتاحة"}
          </p>
          <p className="text-xs text-muted-foreground mt-1 opacity-70">
            يمكنك إضافة البيانات يدوياً عبر زر "تعديل"
          </p>
        </div>
      )}

      {/* سجل الخطوات */}
      {session && session.steps.length > 0 && (
        <div className="border-t" style={{ borderColor: "oklch(0.22 0.03 240)" }}>
          <button
            onClick={() => setShowSteps(!showSteps)}
            className="w-full flex items-center justify-between px-5 py-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              سجل الخطوات ({session.steps.length})
            </span>
            {showSteps ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showSteps && (
            <div className="px-5 pb-4 space-y-1.5">
              {session.steps.map((step, i) => (
                <StepRow key={i} step={step} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ===== مكوّن بطاقة المرشح =====
function CandidateCard({
  candidate, isApplied, onApply, onReject
}: {
  candidate: SearchCandidate;
  isApplied: boolean;
  onApply: () => void;
  onReject: () => void;
}) {
  const meta = FIELD_META[candidate.field];
  const conf = CONFIDENCE_META[candidate.confidence];
  const layer = LAYER_META[candidate.source];

  const displayValue = candidate.value.length > 55
    ? candidate.value.slice(0, 52) + "..."
    : candidate.value;

  return (
    <div
      className="flex items-start gap-3 p-3 rounded-xl border transition-all"
      style={{
        borderColor: isApplied ? "oklch(0.65 0.18 145)" : "oklch(0.22 0.03 240)",
        background: isApplied
          ? "color-mix(in oklch, oklch(0.65 0.18 145) 6%, transparent)"
          : "oklch(0.14 0.02 240)",
      }}
    >
      {/* أيقونة المنصة */}
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: `color-mix(in oklch, ${meta?.color || "oklch(0.65 0.05 240)"} 15%, transparent)`, color: meta?.color || "oklch(0.65 0.05 240)" }}
      >
        {meta?.icon || <Globe className="w-3.5 h-3.5" />}
      </div>

      {/* المحتوى */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-foreground">{meta?.label || candidate.field}</span>
          <span
            className="text-xs px-1.5 py-0.5 rounded-md"
            style={{ background: conf.bg, color: conf.color }}
          >
            {conf.label} · {candidate.confidenceScore}%
          </span>
          {layer && (
            <span className="text-xs text-muted-foreground opacity-60">
              {layer.label}
            </span>
          )}
        </div>
        <p className="text-xs mt-1 font-mono" style={{ color: "oklch(0.75 0.05 240)" }} dir="ltr">
          {displayValue}
        </p>
        {candidate.matchReason && (
          <p className="text-xs text-muted-foreground mt-0.5 opacity-70">
            {candidate.matchReason}
          </p>
        )}
        {/* بيانات إضافية من Bright Data */}
        {candidate.rawData && (candidate.rawData as any).followers && (
          <p className="text-xs mt-1" style={{ color: "oklch(0.65 0.05 240)" }}>
            {Number((candidate.rawData as any).followers).toLocaleString("ar")} متابع
            {(candidate.rawData as any).isBusinessAccount && " · حساب تجاري"}
          </p>
        )}
      </div>

      {/* أزرار الإجراء */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {isApplied ? (
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs"
            style={{ background: "color-mix(in oklch, oklch(0.65 0.18 145) 15%, transparent)", color: "oklch(0.65 0.18 145)" }}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            تم الحفظ
          </div>
        ) : (
          <>
            <a
              href={candidate.value.startsWith("http") ? candidate.value : `https://${candidate.value}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              onClick={onReject}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: "oklch(0.65 0.18 25)" }}
              title="رفض"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onApply}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white transition-all"
              style={{ background: "oklch(0.65 0.18 145)" }}
            >
              <Check className="w-3.5 h-3.5" />
              حفظ
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ===== مكوّن صف الخطوة =====
function StepRow({ step }: { step: SearchStep }) {
  const layer = LAYER_META[step.layer];
  const field = FIELD_META[step.field];

  const statusIcon = {
    pending: <Clock className="w-3 h-3 text-muted-foreground opacity-50" />,
    running: <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: "oklch(0.65 0.18 280)" }} />,
    done: <CheckCircle2 className="w-3 h-3" style={{ color: "oklch(0.65 0.18 145)" }} />,
    failed: <XCircle className="w-3 h-3" style={{ color: "oklch(0.65 0.18 25)" }} />,
    skipped: <div className="w-3 h-3 rounded-full opacity-30" style={{ background: "oklch(0.65 0.05 240)" }} />,
  }[step.status];

  return (
    <div className="flex items-center gap-2 py-1">
      {statusIcon}
      <span className="text-xs" style={{ color: layer?.color || "oklch(0.5 0.02 240)" }}>
        {layer?.label}
      </span>
      <span className="text-xs text-muted-foreground">→</span>
      <span className="text-xs text-foreground opacity-70">{field?.label || step.field}</span>
      {step.candidatesFound > 0 && (
        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "color-mix(in oklch, oklch(0.65 0.18 145) 12%, transparent)", color: "oklch(0.65 0.18 145)" }}>
          {step.candidatesFound} نتيجة
        </span>
      )}
      {step.error && (
        <span className="text-xs text-muted-foreground opacity-60 truncate max-w-32">{step.error}</span>
      )}
    </div>
  );
}
