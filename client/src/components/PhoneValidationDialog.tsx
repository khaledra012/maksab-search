import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Phone,
  Loader2,
  RefreshCw,
} from "lucide-react";

interface PhoneRow {
  leadId: number;
  companyName: string;
  rawPhone: string;
  normalizedPhone: string;
  valid: boolean;
  warning: string | null;
  country: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leadIds: number[];
  /** يُستدعى بعد المراجعة للمتابعة بالإرسال */
  onConfirm: (validLeadIds: number[]) => void;
  actionLabel?: string;
}

const COUNTRY_FLAGS: Record<string, string> = {
  SA: "🇸🇦",
  AE: "🇦🇪",
  KW: "🇰🇼",
  BH: "🇧🇭",
  QA: "🇶🇦",
  OM: "🇴🇲",
  JO: "🇯🇴",
  EG: "🇪🇬",
};

export default function PhoneValidationDialog({
  open,
  onOpenChange,
  leadIds,
  onConfirm,
  actionLabel = "متابعة الإرسال",
}: Props) {
  const [overrides, setOverrides] = useState<Record<number, string>>({});

  const { data: rows, isLoading, refetch } = trpc.whatchimp.validatePhones.useQuery(
    { leadIds },
    { enabled: open && leadIds.length > 0 }
  );

  // دمج النتائج مع التعديلات اليدوية
  const displayRows: PhoneRow[] = useMemo(() => {
    if (!rows) return [];
    return rows.map((r) => {
      const override = overrides[r.leadId];
      if (override !== undefined) {
        // إعادة التحقق من الرقم المُعدَّل
        const digits = override.replace(/\D/g, "");
        let normalized = digits;
        let valid = false;
        let warning: string | null = null;
        let country: string | null = null;

        if (digits.startsWith("966") && digits.length === 12) {
          normalized = digits; valid = true; country = "SA";
        } else if (digits.startsWith("0") && digits.length === 10) {
          normalized = "966" + digits.slice(1); valid = true; country = "SA";
        } else if (digits.length === 9 && digits.startsWith("5")) {
          normalized = "966" + digits; valid = true; country = "SA";
        } else if (digits.startsWith("971") && digits.length === 12) {
          normalized = digits; valid = true; country = "AE";
        } else if (digits.startsWith("965") && digits.length === 11) {
          normalized = digits; valid = true; country = "KW";
        } else if (digits.length < 7) {
          warning = `الرقم قصير جداً (${digits.length} أرقام)`;
        } else if (digits.length > 15) {
          warning = `الرقم طويل جداً (${digits.length} أرقام)`;
        } else {
          warning = "تنسيق غير معروف — أضف رمز الدولة (مثال: 9665XXXXXXXX)";
        }

        return { ...r, rawPhone: override, normalizedPhone: normalized, valid, warning, country };
      }
      return r;
    });
  }, [rows, overrides]);

  const validCount = displayRows.filter((r) => r.valid).length;
  const invalidCount = displayRows.filter((r) => !r.valid).length;

  const handleConfirm = () => {
    const validIds = displayRows.filter((r) => r.valid).map((r) => r.leadId);
    onConfirm(validIds);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="w-4 h-4" />
            مراجعة أرقام الواتساب
          </DialogTitle>
        </DialogHeader>

        {/* ملخص */}
        {!isLoading && rows && (
          <div className="flex items-center gap-3 px-1">
            <div className="flex items-center gap-1.5 text-sm">
              <CheckCircle2 className="w-4 h-4" style={{ color: "oklch(0.65 0.18 145)" }} />
              <span style={{ color: "oklch(0.65 0.18 145)" }}>{validCount} صالح</span>
            </div>
            {invalidCount > 0 && (
              <div className="flex items-center gap-1.5 text-sm">
                <XCircle className="w-4 h-4" style={{ color: "oklch(0.65 0.2 25)" }} />
                <span style={{ color: "oklch(0.65 0.2 25)" }}>{invalidCount} يحتاج تصحيح</span>
              </div>
            )}
            <button
              onClick={() => refetch()}
              className="mr-auto text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              تحديث
            </button>
          </div>
        )}

        {/* قائمة الأرقام */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              جاري التحقق من الأرقام...
            </div>
          ) : displayRows.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">لا توجد أرقام للمراجعة</p>
          ) : (
            displayRows.map((row) => (
              <div
                key={row.leadId}
                className="rounded-xl p-3 space-y-2"
                style={{
                  background: row.valid
                    ? "oklch(0.55 0.18 145 / 0.08)"
                    : "oklch(0.55 0.2 25 / 0.08)",
                  border: `1px solid ${row.valid ? "oklch(0.55 0.18 145 / 0.2)" : "oklch(0.55 0.2 25 / 0.2)"}`,
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {row.valid ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: "oklch(0.65 0.18 145)" }} />
                    ) : (
                      <XCircle className="w-4 h-4 shrink-0" style={{ color: "oklch(0.65 0.2 25)" }} />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{row.companyName}</p>
                      {row.valid && (
                        <p className="text-xs text-muted-foreground">
                          {row.country && COUNTRY_FLAGS[row.country]} {row.normalizedPhone}
                        </p>
                      )}
                    </div>
                  </div>
                  {row.valid ? (
                    <Badge
                      variant="outline"
                      className="text-xs shrink-0"
                      style={{ color: "oklch(0.65 0.18 145)", borderColor: "oklch(0.55 0.18 145 / 0.3)" }}
                    >
                      {row.country ?? "دولي"}
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-xs shrink-0"
                      style={{ color: "oklch(0.65 0.2 25)", borderColor: "oklch(0.55 0.2 25 / 0.3)" }}
                    >
                      غير صالح
                    </Badge>
                  )}
                </div>

                {/* تحذير + حقل تصحيح */}
                {!row.valid && (
                  <div className="space-y-1.5">
                    {row.warning && (
                      <div className="flex items-center gap-1.5 text-xs" style={{ color: "oklch(0.75 0.15 50)" }}>
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        {row.warning}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Input
                        dir="ltr"
                        placeholder={`الرقم الحالي: ${row.rawPhone || "—"}`}
                        value={overrides[row.leadId] ?? row.rawPhone}
                        onChange={(e) =>
                          setOverrides((prev) => ({ ...prev, [row.leadId]: e.target.value }))
                        }
                        className="h-8 text-sm font-mono"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      صحّح الرقم هنا (مثال: 966512345678) — التصحيح مؤقت لهذه العملية فقط
                    </p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <DialogFooter className="gap-2 pt-2 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          {invalidCount > 0 && validCount > 0 && (
            <Button
              variant="outline"
              onClick={handleConfirm}
              style={{ color: "oklch(0.75 0.15 50)", borderColor: "oklch(0.55 0.15 50 / 0.4)" }}
            >
              إرسال الصالحين فقط ({validCount})
            </Button>
          )}
          <Button
            disabled={validCount === 0 || isLoading}
            onClick={handleConfirm}
          >
            {actionLabel} ({validCount})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
