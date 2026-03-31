/**
 * MissingFieldsPanel — PHASE 6B
 *
 * Responsibilities:
 * - Display missing fields from lead.missingDataFlags (DB field, no recomputation)
 * - Presentation-only adapter: maps field keys to Arabic labels
 * - Show success state if no fields are missing
 *
 * Owns: nothing — reads from missingDataFlags prop only
 */
import { CheckCircle, AlertTriangle, Info } from "lucide-react";

// Presentation-only adapter: field key → Arabic label + severity tier
// Mirrors the field classification in server/autofill/detectMissingFields.ts
// but is kept client-side to avoid server imports in the bundle
const FIELD_CONFIG: Record<string, { label: string; tier: "critical" | "important" | "optional" }> = {
  // Critical
  companyName:    { label: "اسم النشاط", tier: "critical" },
  businessType:   { label: "نوع النشاط", tier: "critical" },
  city:           { label: "المدينة", tier: "critical" },
  // Important
  verifiedPhone:  { label: "رقم الهاتف المؤكد", tier: "important" },
  website:        { label: "الموقع الإلكتروني", tier: "important" },
  instagramUrl:   { label: "حساب إنستغرام", tier: "important" },
  googleMapsUrl:  { label: "خرائط Google", tier: "important" },
  // Optional
  twitterUrl:     { label: "حساب تويتر/X", tier: "optional" },
  tiktokUrl:      { label: "حساب تيك توك", tier: "optional" },
  snapchatUrl:    { label: "حساب سناب شات", tier: "optional" },
  facebookUrl:    { label: "حساب فيسبوك", tier: "optional" },
  linkedinUrl:    { label: "حساب لينكد إن", tier: "optional" },
  crNumber:       { label: "رقم السجل التجاري", tier: "optional" },
};

const TIER_CONFIG = {
  critical: { label: "حرجة", color: "oklch(0.58 0.22 25)", bg: "oklch(0.58 0.22 25 / 0.12)" },
  important: { label: "مهمة", color: "oklch(0.78 0.16 75)", bg: "oklch(0.78 0.16 75 / 0.12)" },
  optional: { label: "اختيارية", color: "oklch(0.65 0.05 240)", bg: "oklch(0.65 0.05 240 / 0.12)" },
};

type Props = {
  missingDataFlags: string[] | null | undefined;
};

export default function MissingFieldsPanel({ missingDataFlags }: Props) {
  const flags = missingDataFlags ?? [];

  // ── Success state ──────────────────────────────────────────────────────────
  if (flags.length === 0) {
    return (
      <div
        className="rounded-2xl p-4 flex items-center gap-3"
        style={{ background: "oklch(0.65 0.2 145 / 0.08)", border: "1px solid oklch(0.65 0.2 145 / 0.25)" }}
      >
        <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: "oklch(0.65 0.2 145)" }} />
        <div>
          <p className="text-sm font-semibold" style={{ color: "oklch(0.65 0.2 145)" }}>
            جميع البيانات الأساسية متوفرة
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">لا توجد حقول ناقصة تؤثر على التحليل</p>
        </div>
      </div>
    );
  }

  // Group by tier
  const grouped: Record<"critical" | "important" | "optional", string[]> = {
    critical: [],
    important: [],
    optional: [],
  };
  for (const key of flags) {
    const cfg = FIELD_CONFIG[key];
    if (cfg) {
      grouped[cfg.tier].push(key);
    } else {
      // Unknown field — treat as important
      grouped.important.push(key);
    }
  }

  const hasCritical = grouped.critical.length > 0;
  const hasImportant = grouped.important.length > 0;

  return (
    <div className="rounded-2xl border border-border overflow-hidden" style={{ background: "oklch(0.12 0.015 240)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          {hasCritical ? (
            <AlertTriangle className="w-4 h-4" style={{ color: "oklch(0.58 0.22 25)" }} />
          ) : (
            <Info className="w-4 h-4" style={{ color: "oklch(0.78 0.16 75)" }} />
          )}
          الحقول الناقصة
        </h4>
        <span
          className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{
            background: hasCritical ? "oklch(0.58 0.22 25 / 0.15)" : "oklch(0.78 0.16 75 / 0.15)",
            color: hasCritical ? "oklch(0.65 0.18 25)" : "oklch(0.78 0.16 75)",
          }}
        >
          {flags.length} حقل
        </span>
      </div>

      {/* Grouped fields */}
      <div className="p-4 space-y-3">
        {(["critical", "important", "optional"] as const).map((tier) => {
          const keys = grouped[tier];
          if (keys.length === 0) return null;
          const tierCfg = TIER_CONFIG[tier];
          return (
            <div key={tier} className="space-y-1.5">
              <p className="text-xs font-semibold" style={{ color: tierCfg.color }}>
                {tierCfg.label}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {keys.map((key) => {
                  const fieldCfg = FIELD_CONFIG[key];
                  const label = fieldCfg?.label ?? key;
                  return (
                    <span
                      key={key}
                      className="text-xs px-2 py-0.5 rounded-lg"
                      style={{ background: tierCfg.bg, color: tierCfg.color }}
                    >
                      {label}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
