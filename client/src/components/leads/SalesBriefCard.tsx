/**
 * SalesBriefCard — PHASE 6C
 *
 * Responsibilities:
 * - Display generated SalesBrief (deterministic, no LLM)
 * - Trigger brief generation via onGenerateBrief callback (owned by LeadDetail)
 * - Show loading/empty/error states
 * - Copy-to-clipboard for firstMessageHint
 * - Send contact + brief as subscriber note to Whatchimp
 *
 * Owns: nothing — all state comes from props
 */
import { FileText, Loader2, RefreshCw, Copy, CheckCircle, AlertTriangle, Phone, Instagram, MessageCircle, Mail, Linkedin, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export type SalesBriefResult = {
  leadId: number;
  success: boolean;
  brief: {
    businessName: string;
    city?: string;
    category?: string;
    topFindings: string[];
    topOpportunity: string;
    leadScore: number;
    priority: "A" | "B" | "C" | "D";
    bestContactChannel: "whatsapp" | "phone" | "instagram" | "email" | "linkedin";
    salesAngle: string;
    firstMessageHint: string;
  } | null;
  score: { value: number; priority: "A" | "B" | "C" | "D" } | null;
  failedSteps: Array<{ step: string; error: string }>;
};

type Props = {
  briefResult: SalesBriefResult | null;
  isGenerating: boolean;
  scoreResult: { score: { value: number; priority: "A" | "B" | "C" | "D" } | null } | null;
  onGenerateBrief: () => void;
};

const CHANNEL_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  whatsapp:  { label: "واتساب",   icon: <MessageCircle className="w-3.5 h-3.5" />, color: "oklch(0.65 0.2 145)" },
  phone:     { label: "هاتف",     icon: <Phone className="w-3.5 h-3.5" />,         color: "oklch(0.65 0.18 200)" },
  instagram: { label: "إنستغرام", icon: <Instagram className="w-3.5 h-3.5" />,     color: "oklch(0.65 0.18 320)" },
  email:     { label: "بريد",     icon: <Mail className="w-3.5 h-3.5" />,           color: "oklch(0.78 0.16 75)" },
  linkedin:  { label: "لينكد إن", icon: <Linkedin className="w-3.5 h-3.5" />,      color: "oklch(0.65 0.18 220)" },
};

const PRIORITY_COLORS: Record<"A" | "B" | "C" | "D", string> = {
  A: "oklch(0.65 0.2 145)",
  B: "oklch(0.78 0.16 75)",
  C: "oklch(0.65 0.18 200)",
  D: "oklch(0.55 0.05 240)",
};

export default function SalesBriefCard({ briefResult, isGenerating, scoreResult, onGenerateBrief }: Props) {
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);

  const sendBriefMutation = trpc.whatchimp.sendBriefAsContact.useMutation({
    onSuccess: () => {
      setSent(true);
      toast.success("تم إرسال جهة الاتصال والبريف إلى Whatchimp بنجاح");
      setTimeout(() => setSent(false), 4000);
    },
    onError: (err) => {
      toast.error(err.message ?? "فشل الإرسال إلى Whatchimp");
    },
  });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.success("تم النسخ");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSendToWhatchimp = () => {
    if (!briefResult?.brief || !briefResult.leadId) return;
    const { brief } = briefResult;
    sendBriefMutation.mutate({
      leadId: briefResult.leadId,
      brief: {
        topOpportunity: brief.topOpportunity,
        salesAngle: brief.salesAngle,
        firstMessageHint: brief.firstMessageHint,
        priority: brief.priority,
        leadScore: brief.leadScore,
        bestContactChannel: brief.bestContactChannel,
      },
    });
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isGenerating) {
    return (
      <div className="rounded-2xl p-5 border border-border space-y-3" style={{ background: "oklch(0.12 0.015 240)" }}>
        <div className="flex items-center gap-3">
          <div className="relative">
            <FileText className="w-5 h-5" style={{ color: "oklch(0.65 0.18 200 / 0.3)" }} />
            <Loader2 className="w-3 h-3 animate-spin absolute -top-0.5 -right-0.5" style={{ color: "oklch(0.75 0.18 200)" }} />
          </div>
          <span className="text-sm font-semibold text-foreground">جاري إنشاء الـ Brief...</span>
        </div>
        <p className="text-xs text-muted-foreground">يتضمن تشغيل التقييم الكامل</p>
      </div>
    );
  }

  // ── Empty state — no score yet ─────────────────────────────────────────────
  if (!briefResult && !scoreResult?.score) {
    return (
      <div className="rounded-2xl p-5 border border-border space-y-3 text-center" style={{ background: "oklch(0.12 0.015 240)" }}>
        <FileText className="w-8 h-8 mx-auto text-muted-foreground opacity-25" />
        <div>
          <p className="text-sm font-medium text-foreground">ملخص المبيعات</p>
          <p className="text-xs text-muted-foreground mt-1">يتطلب تشغيل التقييم أولاً — أو اضغط لتشغيلهما معاً</p>
        </div>
        <button
          onClick={onGenerateBrief}
          className="flex items-center justify-center gap-2 mx-auto px-4 py-2 rounded-xl text-sm font-semibold transition-all"
          style={{ background: "oklch(0.65 0.18 200 / 0.15)", color: "oklch(0.75 0.18 200)", border: "1px solid oklch(0.65 0.18 200 / 0.3)" }}
        >
          <FileText className="w-4 h-4" />
          إنشاء ملخص المبيعات
        </button>
      </div>
    );
  }

  // ── Empty state — score exists but no brief yet ────────────────────────────
  if (!briefResult && scoreResult?.score) {
    return (
      <div className="rounded-2xl p-5 border border-border space-y-3 text-center" style={{ background: "oklch(0.12 0.015 240)" }}>
        <FileText className="w-8 h-8 mx-auto text-muted-foreground opacity-25" />
        <div>
          <p className="text-sm font-medium text-foreground">ملخص المبيعات جاهز للإنشاء</p>
          <p className="text-xs text-muted-foreground mt-1">التقييم مكتمل — اضغط لإنشاء الملخص</p>
        </div>
        <button
          onClick={onGenerateBrief}
          className="flex items-center justify-center gap-2 mx-auto px-4 py-2 rounded-xl text-sm font-semibold transition-all"
          style={{ background: "oklch(0.65 0.18 200 / 0.15)", color: "oklch(0.75 0.18 200)", border: "1px solid oklch(0.65 0.18 200 / 0.3)" }}
        >
          <FileText className="w-4 h-4" />
          إنشاء ملخص المبيعات
        </button>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (briefResult && (!briefResult.success || !briefResult.brief)) {
    const firstError = briefResult.failedSteps[0];
    return (
      <div className="rounded-2xl p-5 border space-y-3" style={{ background: "oklch(0.12 0.015 240)", borderColor: "oklch(0.58 0.22 25 / 0.3)" }}>
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: "oklch(0.65 0.18 25)" }} />
          <span className="text-sm font-semibold text-foreground">فشل إنشاء الملخص</span>
        </div>
        {firstError && (
          <p className="text-xs text-muted-foreground font-mono bg-black/20 px-3 py-2 rounded-lg">
            {firstError.step}: {firstError.error}
          </p>
        )}
        <button
          onClick={onGenerateBrief}
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
  if (!briefResult?.brief) return null;
  const { brief } = briefResult;
  const channelCfg = CHANNEL_CONFIG[brief.bestContactChannel] ?? CHANNEL_CONFIG.phone;
  const priorityColor = PRIORITY_COLORS[brief.priority];
  const isSending = sendBriefMutation.isPending;

  return (
    <div className="rounded-2xl border border-border overflow-hidden" style={{ background: "oklch(0.12 0.015 240)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <FileText className="w-4 h-4" style={{ color: "oklch(0.65 0.18 200)" }} />
          ملخص المبيعات
        </h4>
        <div className="flex items-center gap-1">
          {/* زر الإرسال إلى Whatchimp */}
          <button
            onClick={handleSendToWhatchimp}
            disabled={isSending || sent}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-60"
            style={
              sent
                ? { background: "oklch(0.65 0.2 145 / 0.15)", color: "oklch(0.65 0.2 145)", border: "1px solid oklch(0.65 0.2 145 / 0.3)" }
                : { background: "oklch(0.65 0.2 145 / 0.12)", color: "oklch(0.65 0.2 145)", border: "1px solid oklch(0.65 0.2 145 / 0.25)" }
            }
            title="إرسال جهة الاتصال والبريف إلى Whatchimp"
          >
            {isSending ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : sent ? (
              <CheckCircle className="w-3 h-3" />
            ) : (
              <Send className="w-3 h-3" />
            )}
            {isSending ? "جاري الإرسال..." : sent ? "تم الإرسال" : "إرسال لواتشمب"}
          </button>

          <button
            onClick={onGenerateBrief}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-all"
            title="إعادة الإنشاء"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Score + Priority + Channel row */}
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className="text-xs font-bold px-2.5 py-1 rounded-lg"
            style={{ background: `${priorityColor}22`, color: priorityColor }}
          >
            أولوية {brief.priority}
          </span>
          <span className="text-xs text-muted-foreground">
            درجة: <strong className="text-foreground">{brief.leadScore}</strong>/100
          </span>
          <span
            className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg"
            style={{ background: `${channelCfg.color}18`, color: channelCfg.color }}
          >
            {channelCfg.icon}
            {channelCfg.label}
          </span>
        </div>

        {/* Top opportunity */}
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground">الفرصة الرئيسية</p>
          <p className="text-sm font-medium text-foreground">{brief.topOpportunity}</p>
        </div>

        {/* Sales angle */}
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground">زاوية البيع</p>
          <p className="text-xs text-foreground leading-relaxed">{brief.salesAngle}</p>
        </div>

        {/* Top findings */}
        {brief.topFindings.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground">أبرز النقاط</p>
            {brief.topFindings.map((f, i) => (
              <p key={i} className="text-xs text-foreground flex items-start gap-2">
                <span className="mt-0.5 flex-shrink-0 w-1.5 h-1.5 rounded-full" style={{ background: "oklch(0.65 0.18 200)" }} />
                {f}
              </p>
            ))}
          </div>
        )}

        {/* First message hint */}
        <div
          className="space-y-2 p-3 rounded-xl"
          style={{ background: "oklch(0.65 0.18 200 / 0.06)", border: "1px solid oklch(0.65 0.18 200 / 0.15)" }}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold" style={{ color: "oklch(0.75 0.18 200)" }}>
              اقتراح الرسالة الأولى
            </p>
            <button
              onClick={() => handleCopy(brief.firstMessageHint)}
              className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg transition-all"
              style={{ color: copied ? "oklch(0.65 0.2 145)" : "oklch(0.65 0.18 200)" }}
            >
              {copied ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? "تم النسخ" : "نسخ"}
            </button>
          </div>
          <p className="text-xs text-foreground leading-relaxed">{brief.firstMessageHint}</p>
        </div>

        {/* Whatchimp send hint */}
        <p className="text-xs text-muted-foreground text-center opacity-60">
          زر "إرسال لواتشمب" يحفظ جهة الاتصال + البريف كـ note في Whatchimp
        </p>
      </div>
    </div>
  );
}
