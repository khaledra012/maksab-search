import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Upload, Download, FileSpreadsheet, CheckCircle2, XCircle,
  AlertCircle, ChevronDown, ChevronUp, Loader2, ArrowLeft, Info
} from "lucide-react";
import { useLocation } from "wouter";
import * as XLSX from "xlsx";

// ===== أنواع البيانات =====
type ImportRow = {
  companyName: string;
  businessType: string;
  city: string;
  country?: string;
  district?: string;
  verifiedPhone?: string;
  website?: string;
  googleMapsUrl?: string;
  instagramUrl?: string;
  twitterUrl?: string;
  snapchatUrl?: string;
  tiktokUrl?: string;
  facebookUrl?: string;
  reviewCount?: number;
  notes?: string;
  hasWhatsapp?: "yes" | "no" | "unknown";
  _rowIndex?: number;
  _error?: string;
};

// ===== تعريف الأعمدة =====
const COLUMNS = [
  { key: "companyName", label: "اسم النشاط *", required: true },
  { key: "businessType", label: "نوع النشاط *", required: true },
  { key: "city", label: "المدينة *", required: true },
  { key: "country", label: "الدولة", required: false },
  { key: "district", label: "الحي", required: false },
  { key: "verifiedPhone", label: "رقم الهاتف", required: false },
  { key: "website", label: "الموقع الإلكتروني", required: false },
  { key: "googleMapsUrl", label: "رابط خرائط جوجل", required: false },
  { key: "instagramUrl", label: "انستغرام", required: false },
  { key: "twitterUrl", label: "تويتر/X", required: false },
  { key: "snapchatUrl", label: "سناب شات", required: false },
  { key: "tiktokUrl", label: "تيك توك", required: false },
  { key: "facebookUrl", label: "فيسبوك", required: false },
  { key: "reviewCount", label: "عدد التقييمات", required: false },
  { key: "notes", label: "ملاحظات", required: false },
  { key: "hasWhatsapp", label: "واتساب (yes/no/unknown)", required: false },
];

// ===== تحميل Template =====
function downloadTemplate() {
  const headers = COLUMNS.map(c => c.label);
  const exampleRow = [
    "مطعم الأصيل",
    "مطعم",
    "الرياض",
    "السعودية",
    "العليا",
    "0501234567",
    "https://example.com",
    "https://maps.google.com/?q=...",
    "https://instagram.com/example",
    "",
    "",
    "",
    "",
    "150",
    "عميل مميز",
    "yes",
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
  // تنسيق عرض الأعمدة
  ws["!cols"] = COLUMNS.map(() => ({ wch: 22 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "العملاء");
  XLSX.writeFile(wb, "template_leads.xlsx");
}

// ===== تحليل ملف Excel/CSV =====
function parseFile(file: File): Promise<ImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(ws, { defval: "" });

        const parsed: ImportRow[] = rows.map((row, idx) => {
          // تطبيع مفاتيح الأعمدة (دعم الأسماء العربية والإنجليزية)
          const get = (arabicLabel: string, englishKey: string): string => {
            const val = row[arabicLabel] ?? row[englishKey] ?? "";
            return String(val).trim();
          };

          const companyName = get("اسم النشاط *", "companyName") || get("اسم النشاط", "companyName");
          const businessType = get("نوع النشاط *", "businessType") || get("نوع النشاط", "businessType");
          const city = get("المدينة *", "city") || get("المدينة", "city");
          const hasWhatsappRaw = get("واتساب (yes/no/unknown)", "hasWhatsapp").toLowerCase();
          const hasWhatsapp: "yes" | "no" | "unknown" =
            hasWhatsappRaw === "yes" || hasWhatsappRaw === "نعم" ? "yes" :
            hasWhatsappRaw === "no" || hasWhatsappRaw === "لا" ? "no" : "unknown";

          const reviewCountRaw = get("عدد التقييمات", "reviewCount");
          const reviewCount = reviewCountRaw ? parseInt(reviewCountRaw) || undefined : undefined;

          const item: ImportRow = {
            companyName,
            businessType,
            city,
            country: get("الدولة", "country") || undefined,
            district: get("الحي", "district") || undefined,
            verifiedPhone: get("رقم الهاتف", "verifiedPhone") || undefined,
            website: get("الموقع الإلكتروني", "website") || undefined,
            googleMapsUrl: get("رابط خرائط جوجل", "googleMapsUrl") || undefined,
            instagramUrl: get("انستغرام", "instagramUrl") || undefined,
            twitterUrl: get("تويتر/X", "twitterUrl") || undefined,
            snapchatUrl: get("سناب شات", "snapchatUrl") || undefined,
            tiktokUrl: get("تيك توك", "tiktokUrl") || undefined,
            facebookUrl: get("فيسبوك", "facebookUrl") || undefined,
            reviewCount,
            notes: get("ملاحظات", "notes") || undefined,
            hasWhatsapp,
            _rowIndex: idx + 2,
          };

          // التحقق من الحقول المطلوبة
          if (!item.companyName) item._error = "اسم النشاط مطلوب";
          else if (!item.businessType) item._error = "نوع النشاط مطلوب";
          else if (!item.city) item._error = "المدينة مطلوبة";

          return item;
        });

        resolve(parsed.filter(r => r.companyName || r._error));
      } catch (err) {
        reject(new Error("فشل قراءة الملف. تأكد من أنه ملف Excel أو CSV صحيح."));
      }
    };
    reader.onerror = () => reject(new Error("فشل قراءة الملف"));
    reader.readAsArrayBuffer(file);
  });
}

// ===== مكوّن Inline للاستخدام داخل Dialog =====
export function BulkImportInline({ onClose }: { onClose: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [parsedRows, setParsedRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; failed: number; errors: string[] } | null>(null);
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");

  const bulkImport = trpc.leads.bulkImport.useMutation({
    onSuccess: (data) => {
      setImportResult(data);
      setStep("done");
      if (data.created > 0) toast.success(`تم رفع ${data.created} عميل بنجاح`);
      if (data.failed > 0) toast.error(`فشل رفع ${data.failed} عميل`);
    },
    onError: (e) => toast.error(e.message),
  });

  const validRows = parsedRows.filter(r => !r._error);
  const errorRows = parsedRows.filter(r => r._error);

  const handleFile = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast.error("يُقبل فقط ملفات Excel (.xlsx, .xls) أو CSV");
      return;
    }
    setFileName(file.name);
    try {
      const rows = await parseFile(file);
      setParsedRows(rows);
      setStep("preview");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطأ في قراءة الملف");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleImport = () => {
    if (validRows.length === 0) return;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const leads = validRows.map(({ _rowIndex, _error, ...rest }) => rest);
    bulkImport.mutate({ leads });
  };

  return (
    <div className="space-y-4" dir="rtl">
      {step === "upload" && (
        <div className="space-y-4">
          <div className="rounded-2xl p-4 border text-sm space-y-2"
            style={{ background: "oklch(0.13 0.015 240)", borderColor: "oklch(0.65 0.18 200 / 0.2)" }}>
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <Info className="w-4 h-4" style={{ color: "oklch(0.75 0.18 200)" }} />
              تعليمات الرفع
            </div>
            <ul className="text-muted-foreground space-y-1 list-disc list-inside text-xs">
              <li>حمّل نموذج Excel أولاً واملأ البيانات</li>
              <li>الحقول المطلوبة: اسم النشاط، نوع النشاط، المدينة</li>
              <li>يمكن رفع حتى 1000 عميل في المرة الواحدة</li>
            </ul>
          </div>
          <Button variant="outline" onClick={downloadTemplate} className="gap-2">
            <Download className="w-4 h-4" />
            تحميل نموذج Excel
          </Button>
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all"
            style={{
              borderColor: isDragging ? "oklch(0.65 0.18 145)" : "oklch(0.25 0.02 240)",
              background: isDragging ? "oklch(0.65 0.18 145 / 0.05)" : "oklch(0.11 0.015 240)",
            }}
          >
            <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-base font-medium">اسحب الملف هنا أو اضغط للاختيار</p>
            <p className="text-sm text-muted-foreground mt-1">Excel (.xlsx, .xls) أو CSV</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </div>
        </div>
      )}

      {step === "preview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl p-3 border border-border bg-card text-center">
              <div className="text-xl font-bold">{parsedRows.length}</div>
              <div className="text-xs text-muted-foreground">إجمالي الصفوف</div>
            </div>
            <div className="rounded-xl p-3 border border-green-500/20 bg-green-500/5 text-center">
              <div className="text-xl font-bold text-green-400">{validRows.length}</div>
              <div className="text-xs text-muted-foreground">صالح للرفع</div>
            </div>
            <div className="rounded-xl p-3 border border-red-500/20 bg-red-500/5 text-center">
              <div className="text-xl font-bold text-red-400">{errorRows.length}</div>
              <div className="text-xs text-muted-foreground">بها أخطاء</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileSpreadsheet className="w-4 h-4" />
            <span>{fileName}</span>
          </div>
          {errorRows.length > 0 && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 overflow-hidden">
              <button
                className="w-full flex items-center justify-between p-3 text-sm font-medium text-red-400"
                onClick={() => setShowErrors(!showErrors)}
              >
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {errorRows.length} صف بها أخطاء
                </div>
                {showErrors ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showErrors && (
                <div className="border-t border-red-500/20 p-3 space-y-1 max-h-32 overflow-y-auto">
                  {errorRows.map((r) => (
                    <div key={r._rowIndex} className="text-xs text-muted-foreground">
                      <span className="text-red-400">صف {r._rowIndex}:</span> {r._error}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="flex gap-3">
            <Button
              onClick={handleImport}
              disabled={validRows.length === 0 || bulkImport.isPending}
              className="gap-2 flex-1"
            >
              {bulkImport.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> جاري الرفع...</>
              ) : (
                <><Upload className="w-4 h-4" /> رفع {validRows.length} عميل</>
              )}
            </Button>
            <Button variant="outline" onClick={() => { setStep("upload"); setParsedRows([]); setFileName(""); }}>
              رجوع
            </Button>
          </div>
        </div>
      )}

      {step === "done" && importResult && (
        <div className="space-y-4">
          <div className="rounded-2xl border p-8 text-center space-y-4"
            style={{ background: "oklch(0.11 0.015 240)", borderColor: "oklch(0.25 0.02 240)" }}>
            {importResult.created > 0 ? (
              <CheckCircle2 className="w-14 h-14 mx-auto text-green-400" />
            ) : (
              <XCircle className="w-14 h-14 mx-auto text-red-400" />
            )}
            <div>
              <h2 className="text-xl font-bold">اكتمل الرفع</h2>
              <p className="text-muted-foreground mt-1">
                تم رفع <span className="text-green-400 font-bold">{importResult.created}</span> عميل بنجاح
                {importResult.failed > 0 && (
                  <> وفشل <span className="text-red-400 font-bold">{importResult.failed}</span> عميل</>
                )}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button onClick={onClose} className="flex-1 gap-2">
              العودة لقائمة العملاء
            </Button>
            <Button variant="outline" onClick={() => { setStep("upload"); setParsedRows([]); setFileName(""); setImportResult(null); }}>
              رفع ملف آخر
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== الصفحة الرئيسية =====
export default function BulkImport() {
  const [, navigate] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [parsedRows, setParsedRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; failed: number; errors: string[] } | null>(null);
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");

  const bulkImport = trpc.leads.bulkImport.useMutation({
    onSuccess: (data) => {
      setImportResult(data);
      setStep("done");
      if (data.created > 0) toast.success(`تم رفع ${data.created} عميل بنجاح`);
      if (data.failed > 0) toast.error(`فشل رفع ${data.failed} عميل`);
    },
    onError: (e) => toast.error(e.message),
  });

  const validRows = parsedRows.filter(r => !r._error);
  const errorRows = parsedRows.filter(r => r._error);

  const handleFile = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast.error("يُقبل فقط ملفات Excel (.xlsx, .xls) أو CSV");
      return;
    }
    setFileName(file.name);
    try {
      const rows = await parseFile(file);
      setParsedRows(rows);
      setStep("preview");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطأ في قراءة الملف");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleImport = () => {
    if (validRows.length === 0) return;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const leads = validRows.map(({ _rowIndex, _error, ...rest }) => rest);
    bulkImport.mutate({ leads });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate("/leads")}
          className="w-9 h-9 rounded-xl border border-border flex items-center justify-center hover:bg-muted/30 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
          style={{ background: "oklch(0.65 0.18 145 / 0.15)", border: "1px solid oklch(0.65 0.18 145 / 0.3)" }}>
          <FileSpreadsheet className="w-5 h-5" style={{ color: "oklch(0.75 0.18 145)" }} />
        </div>
        <div>
          <h1 className="text-xl font-bold">رفع عملاء جماعي</h1>
          <p className="text-sm text-muted-foreground">استيراد بيانات العملاء من ملف Excel أو CSV</p>
        </div>
      </div>

      {/* Step: Upload */}
      {step === "upload" && (
        <div className="space-y-4">
          {/* بطاقة التعليمات */}
          <div className="rounded-2xl p-4 border text-sm space-y-2"
            style={{ background: "oklch(0.13 0.015 240)", borderColor: "oklch(0.65 0.18 200 / 0.2)" }}>
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <Info className="w-4 h-4" style={{ color: "oklch(0.75 0.18 200)" }} />
              تعليمات الرفع
            </div>
            <ul className="text-muted-foreground space-y-1 list-disc list-inside">
              <li>حمّل نموذج Excel أولاً واملأ البيانات</li>
              <li>الحقول المطلوبة: اسم النشاط، نوع النشاط، المدينة</li>
              <li>يمكن رفع حتى 1000 عميل في المرة الواحدة</li>
              <li>بعد الرفع يتم التحليل التلقائي لكل عميل</li>
            </ul>
          </div>

          {/* زر تحميل النموذج */}
          <Button
            variant="outline"
            onClick={downloadTemplate}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            تحميل نموذج Excel
          </Button>

          {/* منطقة رفع الملف */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all"
            style={{
              borderColor: isDragging ? "oklch(0.65 0.18 145)" : "oklch(0.25 0.02 240)",
              background: isDragging ? "oklch(0.65 0.18 145 / 0.05)" : "oklch(0.11 0.015 240)",
            }}
          >
            <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-base font-medium">اسحب الملف هنا أو اضغط للاختيار</p>
            <p className="text-sm text-muted-foreground mt-1">Excel (.xlsx, .xls) أو CSV</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </div>
        </div>
      )}

      {/* Step: Preview */}
      {step === "preview" && (
        <div className="space-y-4">
          {/* ملخص */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl p-4 border border-border bg-card text-center">
              <div className="text-2xl font-bold text-foreground">{parsedRows.length}</div>
              <div className="text-xs text-muted-foreground mt-1">إجمالي الصفوف</div>
            </div>
            <div className="rounded-xl p-4 border border-green-500/20 bg-green-500/5 text-center">
              <div className="text-2xl font-bold text-green-400">{validRows.length}</div>
              <div className="text-xs text-muted-foreground mt-1">صالح للرفع</div>
            </div>
            <div className="rounded-xl p-4 border border-red-500/20 bg-red-500/5 text-center">
              <div className="text-2xl font-bold text-red-400">{errorRows.length}</div>
              <div className="text-xs text-muted-foreground mt-1">بها أخطاء</div>
            </div>
          </div>

          {/* اسم الملف */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileSpreadsheet className="w-4 h-4" />
            <span>{fileName}</span>
          </div>

          {/* أخطاء */}
          {errorRows.length > 0 && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 overflow-hidden">
              <button
                className="w-full flex items-center justify-between p-3 text-sm font-medium text-red-400"
                onClick={() => setShowErrors(!showErrors)}
              >
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {errorRows.length} صف بها أخطاء (سيتم تخطيها)
                </div>
                {showErrors ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showErrors && (
                <div className="border-t border-red-500/20 p-3 space-y-1 max-h-40 overflow-y-auto">
                  {errorRows.map((r) => (
                    <div key={r._rowIndex} className="text-xs text-muted-foreground">
                      <span className="text-red-400">صف {r._rowIndex}:</span> {r._error} ({r.companyName || "بدون اسم"})
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* معاينة البيانات */}
          {validRows.length > 0 && (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="p-3 border-b border-border bg-muted/20 text-sm font-medium">
                معاينة أول 5 صفوف
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="p-2 text-right text-muted-foreground font-medium">اسم النشاط</th>
                      <th className="p-2 text-right text-muted-foreground font-medium">النشاط</th>
                      <th className="p-2 text-right text-muted-foreground font-medium">المدينة</th>
                      <th className="p-2 text-right text-muted-foreground font-medium">الهاتف</th>
                      <th className="p-2 text-right text-muted-foreground font-medium">واتساب</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validRows.slice(0, 5).map((r, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-muted/10">
                        <td className="p-2 font-medium">{r.companyName}</td>
                        <td className="p-2 text-muted-foreground">{r.businessType}</td>
                        <td className="p-2 text-muted-foreground">{r.city}</td>
                        <td className="p-2 text-muted-foreground">{r.verifiedPhone || "-"}</td>
                        <td className="p-2">
                          {r.hasWhatsapp === "yes" ? (
                            <Badge className="text-xs bg-green-500/10 text-green-400 border-green-500/20">لديه</Badge>
                          ) : r.hasWhatsapp === "no" ? (
                            <Badge className="text-xs bg-red-500/10 text-red-400 border-red-500/20">ليس لديه</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">غير محدد</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {validRows.length > 5 && (
                  <div className="p-2 text-center text-xs text-muted-foreground border-t border-border">
                    + {validRows.length - 5} صف إضافي
                  </div>
                )}
              </div>
            </div>
          )}

          {/* أزرار الإجراء */}
          <div className="flex gap-3">
            <Button
              onClick={handleImport}
              disabled={validRows.length === 0 || bulkImport.isPending}
              className="gap-2 flex-1"
            >
              {bulkImport.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> جاري الرفع...</>
              ) : (
                <><Upload className="w-4 h-4" /> رفع {validRows.length} عميل</>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => { setStep("upload"); setParsedRows([]); setFileName(""); }}
            >
              إلغاء
            </Button>
          </div>
        </div>
      )}

      {/* Step: Done */}
      {step === "done" && importResult && (
        <div className="space-y-4">
          <div className="rounded-2xl border p-8 text-center space-y-4"
            style={{ background: "oklch(0.11 0.015 240)", borderColor: "oklch(0.25 0.02 240)" }}>
            {importResult.created > 0 ? (
              <CheckCircle2 className="w-16 h-16 mx-auto text-green-400" />
            ) : (
              <XCircle className="w-16 h-16 mx-auto text-red-400" />
            )}
            <div>
              <h2 className="text-xl font-bold">اكتمل الرفع</h2>
              <p className="text-muted-foreground mt-1">
                تم رفع <span className="text-green-400 font-bold">{importResult.created}</span> عميل بنجاح
                {importResult.failed > 0 && (
                  <> وفشل <span className="text-red-400 font-bold">{importResult.failed}</span> عميل</>
                )}
              </p>
            </div>
            {importResult.errors.length > 0 && (
              <div className="text-right rounded-xl border border-red-500/20 bg-red-500/5 p-3 max-h-40 overflow-y-auto">
                {importResult.errors.slice(0, 10).map((e, i) => (
                  <div key={i} className="text-xs text-red-400 py-0.5">{e}</div>
                ))}
                {importResult.errors.length > 10 && (
                  <div className="text-xs text-muted-foreground">+ {importResult.errors.length - 10} خطأ إضافي</div>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <Button onClick={() => navigate("/leads")} className="flex-1 gap-2">
              <ArrowLeft className="w-4 h-4" />
              الذهاب إلى قائمة العملاء
            </Button>
            <Button
              variant="outline"
              onClick={() => { setStep("upload"); setParsedRows([]); setFileName(""); setImportResult(null); }}
            >
              رفع ملف آخر
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
