/**
 * PlatformCoverageCard
 * يُظهر بوضوح: ما الذي وُجد من كل منصة وما الذي لم يُوجد
 * مع نسبة تغطية إجمالية
 */
import { CheckCircle2, XCircle, Globe, Instagram, Video, Camera, Twitter, Linkedin, Users, Map, ExternalLink } from "lucide-react";

interface PlatformCoverageCardProps {
  lead: {
    website?: string | null;
    instagramUrl?: string | null;
    tiktokUrl?: string | null;
    snapchatUrl?: string | null;
    twitterUrl?: string | null;
    linkedinUrl?: string | null;
    facebookUrl?: string | null;
    googleMapsUrl?: string | null;
    verifiedPhone?: string | null;
  };
  socialAnalyses?: Array<{ platform: string; overallScore?: number | null }>;
}

const PLATFORM_DEFS = [
  { key: "googleMapsUrl", label: "Google Maps", icon: Map, color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/30" },
  { key: "website", label: "موقع إلكتروني", icon: Globe, color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/30" },
  { key: "instagramUrl", label: "إنستجرام", icon: Instagram, color: "text-pink-400", bg: "bg-pink-500/10", border: "border-pink-500/30" },
  { key: "tiktokUrl", label: "تيك توك", icon: Video, color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/30" },
  { key: "snapchatUrl", label: "سناب شات", icon: Camera, color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30" },
  { key: "twitterUrl", label: "تويتر / X", icon: Twitter, color: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/30" },
  { key: "linkedinUrl", label: "لينكدإن", icon: Linkedin, color: "text-blue-500", bg: "bg-blue-600/10", border: "border-blue-600/30" },
  { key: "facebookUrl", label: "فيسبوك", icon: Users, color: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-400/30" },
] as const;

export function PlatformCoverageCard({ lead, socialAnalyses = [] }: PlatformCoverageCardProps) {
  const platforms = PLATFORM_DEFS.map(p => {
    const url = (lead as any)[p.key] as string | null | undefined;
    const analysis = socialAnalyses.find(s => {
      if (p.key === "instagramUrl") return s.platform === "instagram";
      if (p.key === "tiktokUrl") return s.platform === "tiktok";
      if (p.key === "snapchatUrl") return s.platform === "snapchat";
      if (p.key === "twitterUrl") return s.platform === "twitter";
      if (p.key === "linkedinUrl") return s.platform === "linkedin";
      if (p.key === "facebookUrl") return s.platform === "facebook";
      return false;
    });
    return { ...p, url: url || null, hasData: !!url, score: analysis?.overallScore };
  });

  const found = platforms.filter(p => p.hasData).length;
  const total = platforms.length;
  const pct = Math.round((found / total) * 100);

  const coverageColor =
    pct >= 75 ? "text-green-400" :
    pct >= 50 ? "text-yellow-400" :
    pct >= 25 ? "text-orange-400" :
    "text-red-400";

  const coverageBarColor =
    pct >= 75 ? "bg-green-500" :
    pct >= 50 ? "bg-yellow-500" :
    pct >= 25 ? "bg-orange-500" :
    "bg-red-500";

  return (
    <div className="rounded-2xl border border-border p-4 space-y-3" style={{ background: "oklch(0.12 0.015 240)" }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">تغطية المنصات</h3>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold ${coverageColor}`}>{found}/{total}</span>
          <span className="text-xs text-muted-foreground">منصة</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="h-1.5 w-full bg-muted/30 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${coverageBarColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>تغطية {pct}%</span>
          <span>{total - found} منصة غير مرتبطة</span>
        </div>
      </div>

      {/* Grid المنصات */}
      <div className="grid grid-cols-2 gap-1.5">
        {platforms.map(p => (
          <div
            key={p.key}
            className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border transition-all ${
              p.hasData
                ? `${p.bg} ${p.border}`
                : "bg-muted/10 border-border/40 opacity-50"
            }`}
          >
            {/* أيقونة المنصة */}
            <p.icon className={`w-3.5 h-3.5 shrink-0 ${p.hasData ? p.color : "text-muted-foreground"}`} />

            {/* الاسم والنتيجة */}
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium truncate leading-tight">
                {p.label}
              </p>
              {p.hasData && p.score != null && (
                <p className="text-[10px] text-green-400 font-bold">{p.score.toFixed(1)}/10</p>
              )}
            </div>

            {/* حالة الوجود */}
            <div className="shrink-0 flex items-center gap-1">
              {p.hasData ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                  {p.url && (
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                    >
                      <ExternalLink className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                    </a>
                  )}
                </>
              ) : (
                <XCircle className="w-3.5 h-3.5 text-muted-foreground/40" />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Phone indicator */}
      {lead.verifiedPhone && (
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border bg-green-500/10 border-green-500/30">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
          <span className="text-[11px] font-medium text-green-400">رقم هاتف موثّق</span>
          <span className="text-[11px] text-muted-foreground mr-auto font-mono" dir="ltr">{lead.verifiedPhone}</span>
        </div>
      )}
    </div>
  );
}
