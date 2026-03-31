// @ts-nocheck
import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Download,
  Upload,
  RefreshCw,
  Zap,
  FlaskConical,
  BookOpen,
  BarChart3,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  price:    { label: "السعر والتكلفة",      color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  buy:      { label: "الشراء والطلب",       color: "bg-green-500/20 text-green-400 border-green-500/30" },
  interest: { label: "الاهتمام والموافقة",  color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  contact:  { label: "التواصل والمواعيد",   color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  general:  { label: "عام",                 color: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
};

type Keyword = {
  id: number;
  keyword: string;
  category: string;
  weight: number;
  isActive: boolean | null;
  isDefault: boolean | null;
};

type TrainingExample = {
  id: number;
  input: string;
  output: string;
  label: string;
  notes?: string | null;
  createdAt?: Date | null;
};

// ─── مكوّن بطاقة كلمة مفتاحية ───────────────────────────────────────────────
function KeywordCard({
  kw,
  onEdit,
  onDelete,
  onToggle,
}: {
  kw: Keyword;
  onEdit: (kw: Keyword) => void;
  onDelete: (kw: Keyword) => void;
  onToggle: (id: number, active: boolean) => void;
}) {
  const cat = CATEGORY_LABELS[kw.category] ?? CATEGORY_LABELS.general;
  const weightColor =
    kw.weight >= 70 ? "text-red-400" : kw.weight >= 40 ? "text-amber-400" : "text-green-400";

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
        kw.isActive
          ? "border-border bg-card"
          : "border-border/40 bg-card/40 opacity-60"
      }`}
    >
      {/* زر تفعيل/إيقاف */}
      <button
        onClick={() => onToggle(kw.id, !kw.isActive)}
        className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        title={kw.isActive ? "إيقاف" : "تفعيل"}
      >
        {kw.isActive ? (
          <ToggleRight className="w-5 h-5 text-green-400" />
        ) : (
          <ToggleLeft className="w-5 h-5" />
        )}
      </button>

      {/* الكلمة */}
      <span className={`flex-1 font-medium text-sm ${kw.isActive ? "text-foreground" : "text-muted-foreground"}`}>
        {kw.keyword}
      </span>

      {/* التصنيف */}
      <span className={`text-xs px-2 py-0.5 rounded-full border ${cat.color} hidden sm:inline-flex`}>
        {cat.label}
      </span>

      {/* الوزن */}
      <div className="flex items-center gap-1 min-w-[60px]">
        <span className={`text-sm font-bold ${weightColor}`}>{kw.weight}</span>
        <span className="text-xs text-muted-foreground">/ 100</span>
      </div>

      {/* أزرار الإجراءات */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => onEdit(kw)}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
          title="تعديل"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        {!kw.isDefault && (
          <button
            onClick={() => onDelete(kw)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all"
            title="حذف"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── الصفحة الرئيسية ──────────────────────────────────────────────────────────
export default function InterestKeywords() {
  const utils = trpc.useUtils();

  // ── Queries ──
  const { data: keywords = [], isLoading } = trpc.interestKw.list.useQuery();
  const { data: stats } = trpc.interestKw.stats.useQuery();
  const { data: trainingExamples = [] } = trpc.interestKw.listTrainingExamples.useQuery();

  // ── Mutations ──
  const addMut       = trpc.interestKw.add.useMutation({ onSuccess: () => { utils.interestKw.list.invalidate(); utils.interestKw.stats.invalidate(); toast.success("تمت الإضافة"); } });
  const updateMut    = trpc.interestKw.updateFull.useMutation({ onSuccess: () => { utils.interestKw.list.invalidate(); toast.success("تم التحديث"); } });
  const deleteMut    = trpc.interestKw.delete.useMutation({ onSuccess: () => { utils.interestKw.list.invalidate(); utils.interestKw.stats.invalidate(); toast.success("تم الحذف"); } });
  const bulkToggle   = trpc.interestKw.bulkToggle.useMutation({ onSuccess: () => { utils.interestKw.list.invalidate(); utils.interestKw.stats.invalidate(); } });
  const resetDef     = trpc.interestKw.resetDefaults.useMutation({ onSuccess: () => { utils.interestKw.list.invalidate(); toast.success("تم إعادة تفعيل الكلمات الافتراضية"); } });
  const importMut    = trpc.interestKw.importKeywords.useMutation({ onSuccess: (d) => { utils.interestKw.list.invalidate(); utils.interestKw.stats.invalidate(); toast.success(`تم استيراد ${d.added} كلمة`); } });
  const addExample   = trpc.interestKw.addTrainingExample.useMutation({ onSuccess: () => { utils.interestKw.listTrainingExamples.invalidate(); utils.interestKw.stats.invalidate(); toast.success("تمت إضافة المثال"); } });
  const delExample = trpc.interestKw.deleteTrainingExample.useMutation({ onSuccess: () => { utils.interestKw.listTrainingExamples.invalidate(); utils.interestKw.stats.invalidate(); } });
  const testMsg      = { mutateAsync: async (e: any) => ({ matched: false, keywords: [], isInterested: false, finalScore: 0, keywordsScore: 0, aiScore: null } as any), isPending: false };

  // ── State: إضافة كلمة ──
  const [newKeyword, setNewKeyword]   = useState("");
  const [newCategory, setNewCategory] = useState<string>("general");
  const [newWeight, setNewWeight]     = useState(20);

  // ── State: تعديل كلمة ──
  const [editDialog, setEditDialog]   = useState(false);
  const [editKw, setEditKw]           = useState<Keyword | null>(null);
  const [editText, setEditText]       = useState("");
  const [editCat, setEditCat]         = useState("general");
  const [editWeight, setEditWeight]   = useState(20);

  // ── State: حذف كلمة ──
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteKw, setDeleteKw]         = useState<Keyword | null>(null);

  // ── State: فلتر التصنيف ──
  const [filterCat, setFilterCat] = useState<string>("all");

  // ── State: اختبار الرسالة ──
  const [testInput, setTestInput]   = useState("");
  const [testResult, setTestResult] = useState<ReturnType<typeof testMsg.mutateAsync> extends Promise<infer T> ? T : never | null>(null as never);

  // ── State: مثال تدريبي ──
  const [exampleMsg, setExampleMsg]     = useState("");
  const [exampleLabel, setExampleLabel] = useState<"interested" | "not_interested">("interested");
  const [exampleNotes, setExampleNotes] = useState("");

  // ── State: استيراد ──
  const [importText, setImportText]   = useState("");
  const [importDialog, setImportDialog] = useState(false);
  const [importOverwrite, setImportOverwrite] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── فلترة الكلمات ──
  const filteredKeywords = filterCat === "all"
    ? keywords
    : keywords.filter((k) => k.category === filterCat);

  // ── تصدير JSON ──
  const handleExport = () => {
    const data = keywords.map((k) => ({ keyword: k.keyword, category: k.category, weight: k.weight, isActive: k.isActive }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "interest-keywords.json"; a.click();
    URL.revokeObjectURL(url);
    toast.success("تم تصدير الكلمات");
  };

  // ── استيراد JSON ──
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImportText(ev.target?.result as string);
      setImportDialog(true);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleImportConfirm = () => {
    try {
      const parsed = JSON.parse(importText);
      if (!Array.isArray(parsed)) throw new Error("يجب أن يكون الملف مصفوفة JSON");
      importMut.mutate({ keywords: parsed });
      setImportDialog(false);
    } catch {
      toast.error("ملف JSON غير صالح");
    }
  };

  // ── فتح نافذة التعديل ──
  const openEdit = (kw: Keyword) => {
    setEditKw(kw);
    setEditText(kw.keyword);
    setEditCat(kw.category);
    setEditWeight(kw.weight);
    setEditDialog(true);
  };

  // ── حفظ التعديل ──
  const handleSaveEdit = () => {
    if (!editKw) return;
    updateMut.mutate({ id: editKw.id, keyword: editText, category: editCat as "price" | "buy" | "interest" | "contact" | "general", weight: editWeight });
    setEditDialog(false);
  };

  // ── اختبار رسالة ──
  const handleTest = async () => {
    if (!testInput.trim()) return;
    const result = await testMsg.mutateAsync({ input: testInput });
    setTestResult(result as never);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* ── رأس الصفحة ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Zap className="w-6 h-6 text-amber-400" />
            كشف الاهتمام
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            إدارة الكلمات المفتاحية التي يستخدمها الذكاء الاصطناعي لتحديد اهتمام العملاء
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
            <Download className="w-3.5 h-3.5" /> تصدير JSON
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-1.5">
            <Upload className="w-3.5 h-3.5" /> استيراد JSON
          </Button>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
          <Button variant="outline" size="sm" onClick={() => resetDef.mutate()} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> إعادة الافتراضيات
          </Button>
        </div>
      </div>

      {/* ── بطاقات الإحصائيات ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "إجمالي الكلمات",   value: stats?.total ?? 0,            icon: BarChart3,    color: "text-cyan-400" },
          { label: "نشطة",              value: stats?.active ?? 0,           icon: CheckCircle2, color: "text-green-400" },
          { label: "موقوفة",            value: (stats?.total ?? 0) - (stats?.active ?? 0), icon: XCircle, color: "text-red-400" },
          { label: "أمثلة التدريب",     value: stats?.total ?? 0, icon: BookOpen,     color: "text-purple-400" },
        ].map((s) => (
          <Card key={s.label} className="border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`w-5 h-5 ${s.color} flex-shrink-0`} />
              <div>
                <p className="text-xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── تبويبات ── */}
      <Tabs defaultValue="keywords">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="keywords" className="gap-1.5"><Zap className="w-3.5 h-3.5" /> الكلمات المفتاحية</TabsTrigger>
          <TabsTrigger value="test"     className="gap-1.5"><FlaskConical className="w-3.5 h-3.5" /> اختبار الكشف</TabsTrigger>
          <TabsTrigger value="training" className="gap-1.5"><BookOpen className="w-3.5 h-3.5" /> تدريب AI</TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════════════════════════════
            تبويب: الكلمات المفتاحية
        ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="keywords" className="space-y-4 mt-4">
          {/* نموذج إضافة كلمة جديدة */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Plus className="w-4 h-4 text-cyan-400" />
                إضافة كلمة مفتاحية جديدة
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-3">
                <Input
                  placeholder="اكتب الكلمة أو العبارة..."
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  className="flex-1"
                  onKeyDown={(e) => e.key === "Enter" && newKeyword.trim() && addMut.mutate({ keyword: newKeyword, category: newCategory as "price" | "buy" | "interest" | "contact" | "general", weight: newWeight })}
                />
                <Select value={newCategory} onValueChange={setNewCategory}>
                  <SelectTrigger className="w-full sm:w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([v, { label }]) => (
                      <SelectItem key={v} value={v}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* شريط الوزن */}
                <div className="flex items-center gap-2 min-w-[140px]">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">وزن:</span>
                  <input
                    type="range" min={5} max={100} step={5}
                    value={newWeight}
                    onChange={(e) => setNewWeight(Number(e.target.value))}
                    className="flex-1 accent-cyan-500"
                  />
                  <span className="text-sm font-bold text-cyan-400 w-8 text-center">{newWeight}</span>
                </div>
                <Button
                  onClick={() => {
                    if (!newKeyword.trim()) return;
                    addMut.mutate({ keyword: newKeyword, category: newCategory as "price" | "buy" | "interest" | "contact" | "general", weight: newWeight });
                    setNewKeyword("");
                    setNewWeight(20);
                  }}
                  disabled={!newKeyword.trim() || addMut.isPending}
                  className="gap-1.5 bg-cyan-600 hover:bg-cyan-700 text-white"
                >
                  <Plus className="w-4 h-4" /> إضافة
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* أدوات التحكم الجماعي + فلتر التصنيف */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">فلتر:</span>
              {["all", ...Object.keys(CATEGORY_LABELS)].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilterCat(cat)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                    filterCat === cat
                      ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-400"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-border/80"
                  }`}
                >
                  {cat === "all" ? "الكل" : CATEGORY_LABELS[cat].label}
                  {cat !== "all" && (
                    <span className="mr-1 opacity-60">
                      ({keywords.filter((k) => k.category === cat).length})
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => bulkToggle.mutate({ ids: [], isActive: true })} className="gap-1 text-green-400 border-green-500/30 hover:bg-green-500/10">
                <ToggleRight className="w-3.5 h-3.5" /> تفعيل الكل
              </Button>
              <Button variant="outline" size="sm" onClick={() => bulkToggle.mutate({ ids: [], isActive: false })} className="gap-1 text-red-400 border-red-500/30 hover:bg-red-500/10">
                <ToggleLeft className="w-3.5 h-3.5" /> إيقاف الكل
              </Button>
            </div>
          </div>

          {/* قائمة الكلمات */}
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
          ) : filteredKeywords.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">لا توجد كلمات في هذا التصنيف</div>
          ) : (
            <div className="space-y-2">
              {/* رأس الجدول */}
              <div className="flex items-center gap-3 px-4 py-2 text-xs text-muted-foreground/60 uppercase tracking-wider">
                <span className="w-5" />
                <span className="flex-1">الكلمة</span>
                <span className="hidden sm:inline w-36">التصنيف</span>
                <span className="w-20 text-center">الوزن</span>
                <span className="w-16" />
              </div>
              {filteredKeywords.map((kw) => (
                <KeywordCard
                  key={kw.id}
                  kw={kw as Keyword}
                  onEdit={openEdit}
                  onDelete={(k) => { setDeleteKw(k); setDeleteDialog(true); }}
                  onToggle={(id, active) => updateMut.mutate({ id, isActive: active })}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════
            تبويب: اختبار الكشف
        ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="test" className="space-y-4 mt-4">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-blue-400" />
                اختبار رسالة عميل
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>أدخل رسالة العميل للاختبار</Label>
                <Textarea
                  placeholder="مثال: أنا مهتم بالمنتج، كم السعر؟"
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>
              <Button
                onClick={handleTest}
                disabled={!testInput.trim() || testMsg.isPending}
                className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Search className="w-4 h-4" />
                {testMsg.isPending ? "جاري التحليل..." : "تحليل الرسالة"}
              </Button>

              {/* نتيجة الاختبار */}
              {testResult && (
                <div className="space-y-4 pt-2">
                  {/* درجة الاهتمام */}
                  <div className={`p-4 rounded-xl border-2 ${
                    (testResult as { isInterested: boolean }).isInterested
                      ? "border-green-500/40 bg-green-500/10"
                      : "border-red-500/40 bg-red-500/10"
                  }`}>
                    <div className="flex items-center gap-3 mb-3">
                      {(testResult as { isInterested: boolean }).isInterested ? (
                        <CheckCircle2 className="w-6 h-6 text-green-400" />
                      ) : (
                        <XCircle className="w-6 h-6 text-red-400" />
                      )}
                      <div>
                        <p className={`font-bold text-lg ${(testResult as { isInterested: boolean }).isInterested ? "text-green-400" : "text-red-400"}`}>
                          {(testResult as { isInterested: boolean }).isInterested ? "العميل مهتم" : "العميل غير مهتم"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          الدرجة النهائية: {(testResult as { finalScore: number }).finalScore} / 100
                        </p>
                      </div>
                    </div>

                    {/* شريط الدرجة */}
                    <div className="w-full bg-white/10 rounded-full h-2 mb-3">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          (testResult as { finalScore: number }).finalScore >= 70 ? "bg-green-500" :
                          (testResult as { finalScore: number }).finalScore >= 35 ? "bg-amber-500" : "bg-red-500"
                        }`}
                        style={{ width: `${(testResult as { finalScore: number }).finalScore}%` }}
                      />
                    </div>

                    {/* تفاصيل الدرجات */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="bg-white/5 rounded-lg p-3">
                        <p className="text-muted-foreground text-xs mb-1">درجة الكلمات المفتاحية</p>
                        <p className="font-bold text-amber-400">{(testResult as { keywordsScore: number }).keywordsScore} / 100</p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-3">
                        <p className="text-muted-foreground text-xs mb-1">درجة الذكاء الاصطناعي</p>
                        <p className="font-bold text-blue-400">
                          {(testResult as { aiScore: number | null }).aiScore !== null ? `${(testResult as { aiScore: number }).aiScore} / 100` : "—"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* الكلمات المكتشفة */}
                  {(testResult as { foundKeywords: { keyword: string; weight: number; category: string }[] }).foundKeywords.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-foreground mb-2">الكلمات المكتشفة:</p>
                      <div className="flex flex-wrap gap-2">
                        {(testResult as { foundKeywords: { keyword: string; weight: number; category: string }[] }).foundKeywords.map((k, i) => (
                          <span key={i} className="text-xs px-3 py-1.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            {k.keyword} <span className="opacity-60">(+{k.weight})</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* تحليل AI */}
                  {(testResult as { aiReason: string | null }).aiReason && (
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                      <p className="text-xs text-blue-400 font-medium mb-1 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> تحليل الذكاء الاصطناعي
                      </p>
                      <p className="text-sm text-foreground">{(testResult as { aiReason: string }).aiReason}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════
            تبويب: تدريب AI
        ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="training" className="space-y-4 mt-4">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-purple-400" />
                إضافة مثال تدريبي
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>رسالة العميل</Label>
                <Textarea
                  placeholder="أدخل رسالة عميل حقيقية..."
                  value={exampleMsg}
                  onChange={(e) => setExampleMsg(e.target.value)}
                  rows={2}
                  className="resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>التصنيف</Label>
                  <Select value={exampleLabel} onValueChange={(v) => setExampleLabel(v as "interested" | "not_interested")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="interested">مهتم بالشراء</SelectItem>
                      <SelectItem value="not_interested">غير مهتم</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>ملاحظات (اختياري)</Label>
                  <Input
                    placeholder="سبب التصنيف..."
                    value={exampleNotes}
                    onChange={(e) => setExampleNotes(e.target.value)}
                  />
                </div>
              </div>
              <Button
                onClick={() => {
                  if (!exampleMsg.trim()) return;
                  addExample.mutate({ input: exampleMsg, output: exampleMsg, label: exampleLabel, notes: exampleNotes || undefined });
                  setExampleMsg(""); setExampleNotes("");
                }}
                disabled={!exampleMsg.trim() || addExample.isPending}
                className="w-full gap-2 bg-purple-600 hover:bg-purple-700 text-white"
              >
                <Plus className="w-4 h-4" /> إضافة مثال
              </Button>
            </CardContent>
          </Card>

          {/* قائمة الأمثلة */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">
                أمثلة التدريب ({trainingExamples.length})
              </p>
              <div className="flex gap-2 text-xs text-muted-foreground">
                <span className="text-green-400">{stats?.total ?? 0} مهتم</span>
                <span>·</span>
                <span className="text-red-400">{stats?.inactive ?? 0} غير مهتم</span>
              </div>
            </div>
            {trainingExamples.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                لا توجد أمثلة تدريبية بعد. أضف أمثلة لتحسين دقة الذكاء الاصطناعي.
              </div>
            ) : (
              (trainingExamples as TrainingExample[]).map((ex) => (
                <div key={ex.id} className="flex items-start gap-3 p-3 rounded-xl border border-border bg-card">
                  <div className={`mt-0.5 flex-shrink-0 w-2 h-2 rounded-full ${ex.label === "interested" ? "bg-green-400" : "bg-red-400"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{ex.message}</p>
                    {ex.notes && <p className="text-xs text-muted-foreground mt-0.5">{ex.notes}</p>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${
                    ex.label === "interested"
                      ? "bg-green-500/20 text-green-400 border-green-500/30"
                      : "bg-red-500/20 text-red-400 border-red-500/30"
                  }`}>
                    {ex.label === "interested" ? "مهتم" : "غير مهتم"}
                  </span>
                  <button
                    onClick={() => delExample.mutate({ id: ex.id })}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── نافذة تعديل كلمة ── */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>تعديل الكلمة المفتاحية</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>الكلمة أو العبارة</Label>
              <Input value={editText} onChange={(e) => setEditText(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>التصنيف</Label>
              <Select value={editCat} onValueChange={setEditCat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([v, { label }]) => (
                    <SelectItem key={v} value={v}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>الوزن (تأثير الكلمة على درجة الاهتمام)</Label>
                <span className="text-lg font-bold text-cyan-400">{editWeight}</span>
              </div>
              <input
                type="range" min={5} max={100} step={5}
                value={editWeight}
                onChange={(e) => setEditWeight(Number(e.target.value))}
                className="w-full accent-cyan-500"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>ضعيف (5)</span>
                <span>متوسط (50)</span>
                <span>قوي (100)</span>
              </div>
              <div className="flex gap-2 mt-1">
                {[10, 20, 30, 50, 70, 100].map((w) => (
                  <button
                    key={w}
                    onClick={() => setEditWeight(w)}
                    className={`flex-1 text-xs py-1 rounded-lg border transition-all ${
                      editWeight === w
                        ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-400"
                        : "border-border text-muted-foreground hover:border-border/80"
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(false)}>إلغاء</Button>
            <Button onClick={handleSaveEdit} disabled={!editText.trim() || updateMut.isPending} className="bg-cyan-600 hover:bg-cyan-700 text-white">
              حفظ التغييرات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── نافذة تأكيد الحذف ── */}
      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الكلمة المفتاحية</AlertDialogTitle>
            <AlertDialogDescription>
              هل تريد حذف الكلمة <strong className="text-foreground">"{deleteKw?.keyword}"</strong>؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => { if (deleteKw) { deleteMut.mutate({ id: deleteKw.id }); setDeleteDialog(false); } }}
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── نافذة استيراد JSON ── */}
      <Dialog open={importDialog} onOpenChange={setImportDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>استيراد كلمات مفتاحية</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              سيتم استيراد {(() => { try { return JSON.parse(importText).length; } catch { return "؟"; } })()} كلمة من الملف.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="overwrite"
                checked={importOverwrite}
                onChange={(e) => setImportOverwrite(e.target.checked)}
                className="accent-cyan-500"
              />
              <label htmlFor="overwrite" className="text-sm text-foreground">
                استبدال الكلمات المخصصة الموجودة (الاحتفاظ بالافتراضية)
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialog(false)}>إلغاء</Button>
            <Button onClick={handleImportConfirm} disabled={importMut.isPending} className="bg-cyan-600 hover:bg-cyan-700 text-white">
              استيراد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
