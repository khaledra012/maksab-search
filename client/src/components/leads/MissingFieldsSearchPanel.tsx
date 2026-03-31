/**
 * MissingFieldsSearchPanel
 * ========================
 * لوحة "البحث المخصص على النواقص"
 * تعرض زر "ابحث عن النواقص" وتُشغّل البحث التلقائي عبر SERP API
 * ثم تعرض النتائج للمراجعة والحفظ.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Search, CheckCircle, XCircle, AlertCircle, ExternalLink,
  ChevronDown, ChevronUp, Loader2, Sparkles, Link2
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ===== أنواع =====
interface Candidate {
  url: string;
  displayName: string;
  username?: string;
  bio?: string;
  confidence: "high" | "medium" | "low";
  source: string;
}

interface FieldResult {
  field: string;
  label: string;
  candidates: Candidate[];
  status: "found" | "not_found" | "error";
  errorMessage?: string;
}

// ===== ألوان الثقة =====
const CONFIDENCE_CONFIG = {
  high: { label: "تطابق عالي", color: "oklch(0.65 0.2 145)", bg: "oklch(0.65 0.2 145 / 0.12)" },
  medium: { label: "تطابق متوسط", color: "oklch(0.78 0.16 75)", bg: "oklch(0.78 0.16 75 / 0.12)" },
  low: { label: "تطابق منخفض", color: "oklch(0.65 0.05 240)", bg: "oklch(0.65 0.05 240 / 0.12)" },
};

// ===== أيقونات المنصات =====
const PLATFORM_ICONS: Record<string, string> = {
  instagramUrl: "📸",
  tiktokUrl: "🎵",
  snapchatUrl: "👻",
  twitterUrl: "🐦",
  facebookUrl: "📘",
  website: "🌐",
  googleMapsUrl: "📍",
};

// ===== مكوّن بطاقة نتيجة واحدة =====
function CandidateCard({
  candidate,
  field,
  leadId,
  onApplied,
}: {
  candidate: Candidate;
  field: string;
  leadId: number;
  onApplied: (field: string, url: string) => void;
}) {
  const applyMutation = trpc.missingFieldsSearch.applyMissingFieldResult.useMutation({
    onSuccess: (data) => {
      toast.success(`تم حفظ ${candidate.displayName} بنجاح`);
      onApplied(data.field, data.value);
    },
    onError: (err) => {
      toast.error(`فشل الحفظ: ${err.message}`);
    },
  });

  const conf = CONFIDENCE_CONFIG[candidate.confidence];

  return (
    <div
      className="rounded-xl p-3 border transition-all hover:border-opacity-60"
      style={{
        background: "oklch(0.14 0.015 240)",
        borderColor: "oklch(0.25 0.02 240)",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        {/* المعلومات */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground truncate">
              {candidate.displayName}
            </span>
            {candidate.username && (
              <span className="text-xs text-muted-foreground">@{candidate.username}</span>
            )}
            {/* شارة الثقة */}
            <span
              className="text-xs px-1.5 py-0.5 rounded-md font-medium flex-shrink-0"
              style={{ background: conf.bg, color: conf.color }}
            >
              {conf.label}
            </span>
          </div>
          {candidate.bio && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{candidate.bio}</p>
          )}
          <a
            href={candidate.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs mt-1 flex items-center gap-1 hover:underline"
            style={{ color: "oklch(0.65 0.15 240)" }}
          >
            <ExternalLink className="w-3 h-3" />
            <span className="truncate max-w-[220px]">{candidate.url}</span>
          </a>
        </div>

        {/* زر الحفظ */}
        <Button
          size="sm"
          variant="outline"
          className="flex-shrink-0 text-xs h-8 px-3"
          style={{
            borderColor: "oklch(0.65 0.2 145 / 0.4)",
            color: "oklch(0.65 0.2 145)",
          }}
          disabled={applyMutation.isPending}
          onClick={() => applyMutation.mutate({ leadId, field, value: candidate.url })}
        >
          {applyMutation.isPending ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <>
              <CheckCircle className="w-3 h-3 mr-1" />
              حفظ
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ===== مكوّن نتيجة حقل واحد =====
function FieldResultCard({
  result,
  leadId,
  appliedFields,
  onApplied,
}: {
  result: FieldResult;
  leadId: number;
  appliedFields: Set<string>;
  onApplied: (field: string, url: string) => void;
}) {
  const [expanded, setExpanded] = useState(result.candidates.length > 0 && result.status === "found");
  const icon = PLATFORM_ICONS[result.field] || "🔗";
  const isApplied = appliedFields.has(result.field);

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{
        borderColor: isApplied
          ? "oklch(0.65 0.2 145 / 0.4)"
          : result.status === "found"
          ? "oklch(0.65 0.15 240 / 0.3)"
          : result.status === "error"
          ? "oklch(0.58 0.22 25 / 0.3)"
          : "oklch(0.25 0.02 240)",
        background: "oklch(0.12 0.015 240)",
      }}
    >
      {/* رأس الحقل */}
      <button
        className="w-full flex items-center justify-between px-3 py-2.5 text-right"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <span className="text-sm font-medium text-foreground">{result.label}</span>
          {/* حالة النتيجة */}
          {isApplied ? (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "oklch(0.65 0.2 145 / 0.15)", color: "oklch(0.65 0.2 145)" }}>
              ✓ تم الحفظ
            </span>
          ) : result.status === "found" ? (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "oklch(0.65 0.15 240 / 0.15)", color: "oklch(0.65 0.15 240)" }}>
              {result.candidates.length} نتيجة
            </span>
          ) : result.status === "not_found" ? (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "oklch(0.65 0.05 240 / 0.15)", color: "oklch(0.65 0.05 240)" }}>
              لم يُعثر
            </span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "oklch(0.58 0.22 25 / 0.15)", color: "oklch(0.65 0.18 25)" }}>
              خطأ
            </span>
          )}
        </div>
        {result.candidates.length > 0 && !isApplied && (
          expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {/* قائمة المرشحين */}
      {expanded && !isApplied && result.candidates.length > 0 && (
        <div className="px-3 pb-3 space-y-2 border-t border-border">
          <p className="text-xs text-muted-foreground pt-2">اختر الحساب المناسب وانقر "حفظ":</p>
          {result.candidates.map((c, i) => (
            <CandidateCard
              key={i}
              candidate={c}
              field={result.field}
              leadId={leadId}
              onApplied={onApplied}
            />
          ))}
        </div>
      )}

      {/* رسالة الخطأ */}
      {result.status === "error" && result.errorMessage && (
        <div className="px-3 pb-2 border-t border-border">
          <p className="text-xs text-muted-foreground pt-1.5">{result.errorMessage}</p>
        </div>
      )}
    </div>
  );
}

// ===== المكوّن الرئيسي =====
interface Props {
  leadId: number;
  missingDataFlags: string[] | null | undefined;
  onFieldSaved?: () => void;
}

export default function MissingFieldsSearchPanel({ leadId, missingDataFlags, onFieldSaved }: Props) {
  const [results, setResults] = useState<FieldResult[] | null>(null);
  const [appliedFields, setAppliedFields] = useState<Set<string>>(new Set());
  const [isSearching, setIsSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");

  const searchMutation = trpc.missingFieldsSearch.searchMissingFields.useMutation({
    onSuccess: (data) => {
      setResults(data.results as FieldResult[]);
      setSearchMessage(data.message);
      setIsSearching(false);
      if (data.results.length === 0) {
        toast.info(data.message);
      } else {
        const found = data.results.filter(r => r.status === "found").length;
        toast.success(`اكتمل البحث — عُثر على نتائج لـ ${found} من أصل ${data.results.length} حقل`);
      }
    },
    onError: (err) => {
      setIsSearching(false);
      toast.error(`فشل البحث: ${err.message}`);
    },
  });

  const handleSearch = () => {
    setIsSearching(true);
    setResults(null);
    setAppliedFields(new Set());
    searchMutation.mutate({ leadId });
  };

  const handleApplied = (field: string, _url: string) => {
    setAppliedFields(prev => { const next = new Set(Array.from(prev)); next.add(field); return next; });
    onFieldSaved?.();
  };

  // إذا لم تكن هناك حقول ناقصة قابلة للبحث
  const searchableFlags = (missingDataFlags ?? []).filter(f =>
    ["instagramUrl", "tiktokUrl", "snapchatUrl", "twitterUrl", "facebookUrl", "website", "googleMapsUrl"].includes(f)
  );

  if (searchableFlags.length === 0) return null;

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{
        background: "oklch(0.10 0.015 240)",
        borderColor: "oklch(0.65 0.15 240 / 0.25)",
      }}
    >
      {/* رأس اللوحة */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{
          borderColor: "oklch(0.65 0.15 240 / 0.2)",
          background: "oklch(0.65 0.15 240 / 0.06)",
        }}
      >
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="w-4 h-4" style={{ color: "oklch(0.65 0.15 240)" }} />
          البحث المخصص على النواقص
        </h4>
        <span
          className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{
            background: "oklch(0.65 0.15 240 / 0.15)",
            color: "oklch(0.65 0.15 240)",
          }}
        >
          {searchableFlags.length} حقل قابل للبحث
        </span>
      </div>

      <div className="p-4 space-y-3">
        {/* وصف الميزة */}
        {!results && !isSearching && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            سيبحث النظام تلقائياً عن الحقول الناقصة ({searchableFlags.length} حقل) عبر Google وSERP API ويعرض لك أفضل المرشحين للمراجعة والحفظ.
          </p>
        )}

        {/* زر البحث */}
        {!results && (
          <Button
            className="w-full h-10 text-sm font-semibold"
            style={{
              background: isSearching
                ? "oklch(0.65 0.15 240 / 0.3)"
                : "linear-gradient(135deg, oklch(0.55 0.2 240), oklch(0.45 0.2 270))",
              color: "white",
              border: "none",
            }}
            disabled={isSearching}
            onClick={handleSearch}
          >
            {isSearching ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                جاري البحث عن النواقص...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Search className="w-4 h-4" />
                ابحث عن النواقص تلقائياً
              </span>
            )}
          </Button>
        )}

        {/* شريط التقدم أثناء البحث */}
        {isSearching && (
          <div className="space-y-2">
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "oklch(0.2 0.02 240)" }}>
              <div
                className="h-full rounded-full animate-pulse"
                style={{ width: "60%", background: "linear-gradient(90deg, oklch(0.55 0.2 240), oklch(0.65 0.15 240))" }}
              />
            </div>
            <p className="text-xs text-center text-muted-foreground">
              يبحث في إنستغرام، تيك توك، سناب، فيسبوك، تويتر، Google...
            </p>
          </div>
        )}

        {/* النتائج */}
        {results && results.length > 0 && (
          <div className="space-y-2">
            {/* ملخص */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{searchMessage}</p>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs h-7 px-2"
                onClick={handleSearch}
                disabled={isSearching}
              >
                <Search className="w-3 h-3 mr-1" />
                إعادة البحث
              </Button>
            </div>
            {/* بطاقات النتائج */}
            {results.map((result) => (
              <FieldResultCard
                key={result.field}
                result={result}
                leadId={leadId}
                appliedFields={appliedFields}
                onApplied={handleApplied}
              />
            ))}
          </div>
        )}

        {/* لا نتائج */}
        {results && results.length === 0 && (
          <div
            className="rounded-xl p-3 flex items-center gap-3"
            style={{ background: "oklch(0.65 0.05 240 / 0.08)", border: "1px solid oklch(0.65 0.05 240 / 0.2)" }}
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: "oklch(0.65 0.05 240)" }} />
            <p className="text-xs text-muted-foreground">{searchMessage || "لم يُعثر على نتائج للحقول الناقصة"}</p>
          </div>
        )}
      </div>
    </div>
  );
}
