/**
 * AuditSummaryCard — PHASE 6B
 *
 * NAME CLARITY: This is a PRESENTATION SURFACE for existing lead analysis data.
 * It is NOT a full audit engine output display. It organizes existing lead fields
 * (website analysis, social analysis, marketing gaps) into a structured summary.
 *
 * Responsibilities:
 * - Display website presence signals (website, SSL, speed score if available)
 * - Display social presence signals (instagram, twitter, tiktok, snapchat, linkedin)
 * - Display marketing gap summary from lead.marketingGapSummary
 * - Display sales entry angle from lead.salesEntryAngle
 *
 * Owns: nothing — reads from lead prop only
 */
import { Globe, Instagram, Twitter, BarChart3, Target, ExternalLink } from "lucide-react";

type Lead = {
  website?: string | null;
  instagramUrl?: string | null;
  twitterUrl?: string | null;
  tiktokUrl?: string | null;
  snapchatUrl?: string | null;
  facebookUrl?: string | null;
  linkedinUrl?: string | null;
  marketingGapSummary?: string | null;
  salesEntryAngle?: string | null;
  websiteSpeedScore?: number | null;
  websiteSslStatus?: string | null;
  websiteMobileScore?: number | null;
};

type Props = {
  lead: Lead;
};

function PresenceRow({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
  href?: string | null;
}) {
  const present = !!value;
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground opacity-60">{icon}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      {present ? (
        href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs font-medium hover:underline"
            style={{ color: "oklch(0.65 0.2 145)" }}
          >
            موجود
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        ) : (
          <span className="text-xs font-medium" style={{ color: "oklch(0.65 0.2 145)" }}>موجود</span>
        )
      ) : (
        <span className="text-xs text-muted-foreground opacity-50">غير موجود</span>
      )}
    </div>
  );
}

export default function AuditSummaryCard({ lead }: Props) {
  const hasSocial = !!(lead.instagramUrl || lead.twitterUrl || lead.tiktokUrl || lead.snapchatUrl || lead.facebookUrl || lead.linkedinUrl);
  const hasWebsite = !!lead.website;
  const hasGaps = !!lead.marketingGapSummary;
  const hasAngle = !!lead.salesEntryAngle;

  return (
    <div className="rounded-2xl border border-border overflow-hidden" style={{ background: "oklch(0.12 0.015 240)" }}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <BarChart3 className="w-4 h-4" style={{ color: "oklch(0.65 0.18 200)" }} />
          ملخص بيانات التحليل
        </h4>
        <p className="text-xs text-muted-foreground mt-0.5">بيانات الحضور الرقمي المتوفرة لهذا العميل</p>
      </div>

      <div className="p-4 space-y-4">
        {/* Web presence */}
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground mb-1">الموقع الإلكتروني</p>
          <PresenceRow
            icon={<Globe className="w-3.5 h-3.5" />}
            label="الموقع"
            value={lead.website}
            href={lead.website}
          />
          {hasWebsite && (
            <>
              {lead.websiteSpeedScore != null && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-xs text-muted-foreground">سرعة الموقع</span>
                  <span
                    className="text-xs font-bold"
                    style={{
                      color: lead.websiteSpeedScore >= 70
                        ? "oklch(0.65 0.2 145)"
                        : lead.websiteSpeedScore >= 40
                        ? "oklch(0.78 0.16 75)"
                        : "oklch(0.58 0.22 25)",
                    }}
                  >
                    {lead.websiteSpeedScore}/100
                  </span>
                </div>
              )}
              {lead.websiteSslStatus && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-xs text-muted-foreground">شهادة SSL</span>
                  <span
                    className="text-xs font-medium"
                    style={{ color: lead.websiteSslStatus === "valid" ? "oklch(0.65 0.2 145)" : "oklch(0.58 0.22 25)" }}
                  >
                    {lead.websiteSslStatus === "valid" ? "فعّالة" : lead.websiteSslStatus}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Social presence */}
        <div className="space-y-1 pt-2 border-t border-border">
          <p className="text-xs font-semibold text-muted-foreground mb-1">السوشيال ميديا</p>
          <PresenceRow icon={<Instagram className="w-3.5 h-3.5" />} label="إنستغرام" value={lead.instagramUrl} href={lead.instagramUrl} />
          <PresenceRow icon={<Twitter className="w-3.5 h-3.5" />} label="تويتر/X" value={lead.twitterUrl} href={lead.twitterUrl} />
          <PresenceRow
            icon={<span className="text-xs font-bold opacity-60">TT</span>}
            label="تيك توك"
            value={lead.tiktokUrl}
            href={lead.tiktokUrl}
          />
          <PresenceRow
            icon={<span className="text-xs font-bold opacity-60">SC</span>}
            label="سناب شات"
            value={lead.snapchatUrl}
            href={lead.snapchatUrl}
          />
          <PresenceRow
            icon={<span className="text-xs font-bold opacity-60">LI</span>}
            label="لينكد إن"
            value={lead.linkedinUrl}
            href={lead.linkedinUrl}
          />
          {!hasSocial && (
            <p className="text-xs text-muted-foreground opacity-50 py-1">لا توجد حسابات سوشيال مسجّلة</p>
          )}
        </div>

        {/* Marketing gap summary */}
        {hasGaps && (
          <div className="pt-2 border-t border-border space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Target className="w-3 h-3" />
              ملخص الفجوات التسويقية
            </p>
            <p className="text-xs text-foreground leading-relaxed">{lead.marketingGapSummary}</p>
          </div>
        )}

        {/* Sales entry angle */}
        {hasAngle && (
          <div className="pt-2 border-t border-border space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground">زاوية الدخول للمبيعات</p>
            <p
              className="text-xs leading-relaxed px-3 py-2 rounded-lg"
              style={{ background: "oklch(0.65 0.18 200 / 0.06)", color: "oklch(0.75 0.18 200)", border: "1px solid oklch(0.65 0.18 200 / 0.15)" }}
            >
              {lead.salesEntryAngle}
            </p>
          </div>
        )}

        {/* Empty fallback */}
        {!hasWebsite && !hasSocial && !hasGaps && !hasAngle && (
          <p className="text-xs text-muted-foreground text-center py-2 opacity-50">
            لا توجد بيانات تحليلية متوفرة بعد
          </p>
        )}
      </div>
    </div>
  );
}
