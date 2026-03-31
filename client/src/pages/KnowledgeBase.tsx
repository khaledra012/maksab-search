// @ts-nocheck
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen, Plus, Search, Trash2, Edit2, Save, X, Bot, Sparkles,
  MessageSquare, FileText, RefreshCw, ChevronDown, ChevronUp,
  Star, CheckCircle, AlertCircle, Brain, Settings, Layers,
  BarChart2, Zap, Shield, Info, Table2, Link, ExternalLink, Download,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// ===== أنواع المستندات =====
const DOC_TYPES = [
  { value: "text", label: "نص معلوماتي", icon: FileText, color: "text-blue-400", bg: "bg-blue-500/10" },
  { value: "faq", label: "أسئلة وأجوبة", icon: MessageSquare, color: "text-green-400", bg: "bg-green-500/10" },
  { value: "product", label: "منتج/خدمة", icon: Layers, color: "text-purple-400", bg: "bg-purple-500/10" },
  { value: "policy", label: "سياسة/شروط", icon: Shield, color: "text-orange-400", bg: "bg-orange-500/10" },
  { value: "example", label: "مثال رد", icon: MessageSquare, color: "text-cyan-400", bg: "bg-cyan-500/10" },
  { value: "tone", label: "أسلوب الكتابة", icon: Sparkles, color: "text-pink-400", bg: "bg-pink-500/10" },
];

const TONE_OPTIONS = [
  { value: "friendly", label: "ودي" },
  { value: "formal", label: "رسمي" },
  { value: "direct", label: "مباشر" },
  { value: "persuasive", label: "مقنع" },
];

const CATEGORIES = ["general", "sales", "support", "pricing", "products", "policies", "greetings", "objections"];
const CATEGORY_LABELS: Record<string, string> = {
  general: "عام", sales: "مبيعات", support: "دعم", pricing: "أسعار",
  products: "منتجات", policies: "سياسات", greetings: "ترحيب", objections: "اعتراضات",
};

// ===== مكوّن بطاقة المستند =====
function DocumentCard({
  doc, onEdit, onDelete,
}: {
  doc: any; onEdit: (d: any) => void; onDelete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const typeInfo = DOC_TYPES.find(t => t.value === doc.docType) || DOC_TYPES[0];
  const Icon = typeInfo.icon;

  return (
    <div className="rounded-xl border p-4 transition-all hover:border-white/20" style={{ background: "#1e2a32", borderColor: "rgba(255,255,255,0.08)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${typeInfo.bg}`}>
            <Icon className={`w-4 h-4 ${typeInfo.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-semibold text-sm text-white truncate">{doc.title}</h3>
              {!doc.isActive && <Badge variant="outline" className="text-xs border-red-500/40 text-red-400">معطّل</Badge>}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full ${typeInfo.bg} ${typeInfo.color}`}>{typeInfo.label}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-[#8696a0]">
                {CATEGORY_LABELS[doc.category] || doc.category}
              </span>
              <span className="text-xs text-[#8696a0]">{doc.content.length} حرف</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-[#8696a0] hover:text-white" onClick={() => setExpanded(p => !p)}>
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-[#8696a0] hover:text-[#25D366]" onClick={() => onEdit(doc)}>
            <Edit2 className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-[#8696a0] hover:text-red-400" onClick={() => onDelete(doc.id)}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      {expanded && (
        <div className="mt-3 pt-3 border-t border-white/5">
          {doc.description && <p className="text-xs text-[#8696a0] mb-2">{doc.description}</p>}
          <pre className="text-xs text-white/80 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">{doc.content}</pre>
        </div>
      )}
    </div>
  );
}

// ===== مكوّن بطاقة مثال المحادثة =====
function ExampleCard({
  example, onEdit, onDelete,
}: {
  example: any; onEdit: (e: any) => void; onDelete: (id: number) => void;
}) {
  const toneInfo = TONE_OPTIONS.find(t => t.value === example.tone) || TONE_OPTIONS[0];

  return (
    <div className="rounded-xl border p-4 transition-all hover:border-white/20" style={{ background: "#1e2a32", borderColor: "rgba(255,255,255,0.08)" }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400">{toneInfo.label}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-[#8696a0]">
            {CATEGORY_LABELS[example.category] || example.category}
          </span>
          {example.rating && (
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className={`w-3 h-3 ${i < example.rating ? "text-yellow-400 fill-yellow-400" : "text-white/10"}`} />
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-[#8696a0] hover:text-[#25D366]" onClick={() => onEdit(example)}>
            <Edit2 className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-[#8696a0] hover:text-red-400" onClick={() => onDelete(example.id)}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <div className="rounded-lg p-2.5" style={{ background: "#202c33" }}>
          <p className="text-xs text-[#8696a0] mb-1">رسالة العميل:</p>
          <p className="text-sm text-white">{example.customerMessage}</p>
        </div>
        <div className="rounded-lg p-2.5" style={{ background: "rgba(37,211,102,0.08)", border: "1px solid rgba(37,211,102,0.2)" }}>
          <p className="text-xs text-[#25D366] mb-1">الرد المثالي:</p>
          <p className="text-sm text-white">{example.idealResponse}</p>
        </div>
        {example.context && <p className="text-xs text-[#8696a0] italic">{example.context}</p>}
      </div>
    </div>
  );
}

// ===== مكوّن Google Sheets =====
function GoogleSheetsTab() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "", sheetUrl: "", tabName: "",
    purpose: "rag_training" as "rag_training" | "leads_import" | "products" | "faq",
  });

  const { data: sheets = [], refetch } = trpc.ragKnowledge.listGoogleSheets.useQuery();
  const addSheet = trpc.ragKnowledge.addGoogleSheet.useMutation({
    onSuccess: () => { toast.success("تم إضافة الاتصال"); setShowForm(false); setForm({ name: "", sheetUrl: "", tabName: "", purpose: "rag_training" }); refetch(); },
    onError: (e) => toast.error("خطأ", { description: e.message }),
  });
  const syncSheet = trpc.ragKnowledge.syncGoogleSheet.useMutation({
    onSuccess: (data) => { toast.success(`تم استيراد ${data.success ? 1 : 0} صف بنجاح`); refetch(); },
    onError: (e) => toast.error("فشل المزامنة", { description: e.message }),
  });
  const deleteSheet = trpc.ragKnowledge.deleteGoogleSheet.useMutation({
    onSuccess: () => { toast.success("تم حذف الاتصال"); refetch(); },
    onError: (e) => toast.error("خطأ", { description: e.message }),
  });

  const PURPOSE_LABELS: Record<string, string> = {
    rag_training: "تدريب AI", leads_import: "استيراد عملاء", products: "منتجات", faq: "أسئلة وأجوبة",
  };
  const PURPOSE_COLORS: Record<string, string> = {
    rag_training: "text-purple-400 bg-purple-500/10", leads_import: "text-blue-400 bg-blue-500/10",
    products: "text-orange-400 bg-orange-500/10", faq: "text-green-400 bg-green-500/10",
  };

  return (
    <div className="space-y-4">
      {/* رأس القسم */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-semibold text-base">ربط Google Sheets</h2>
          <p className="text-xs text-[#8696a0] mt-0.5">استيراد بيانات من جداول Google Sheets لتدريب AI أو استيراد العملاء</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-1.5 text-white" style={{ background: "#25D366" }}>
          <Plus className="w-4 h-4" />
          ربط جدول جديد
        </Button>
      </div>

      {/* تعليمات */}
      <div className="rounded-xl p-4 border" style={{ background: "rgba(37,211,102,0.05)", borderColor: "rgba(37,211,102,0.2)" }}>
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 text-[#25D366] mt-0.5 flex-shrink-0" />
          <div className="text-xs text-[#8696a0] space-y-1">
            <p className="text-white font-medium">كيفية الاستخدام:</p>
            <p>1. افتح Google Sheet وتأكد من أنه <strong className="text-white">عام (Public)</strong> أو شارك الرابط</p>
            <p>2. انسخ رابط الجدول وأضفه هنا</p>
            <p>3. اضغط "مزامنة" لاستيراد البيانات مباشرة إلى قاعدة المعرفة</p>
          </div>
        </div>
      </div>

      {/* نموذج إضافة */}
      {showForm && (
        <div className="rounded-xl border p-5 space-y-4" style={{ background: "#1e2a32", borderColor: "rgba(37,211,102,0.3)" }}>
          <h3 className="text-white font-medium">ربط جدول Google Sheets جديد</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#8696a0] mb-1 block">اسم الاتصال *</label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="مثال: قائمة المنتجات" className="border-0 text-white text-sm h-9" style={{ background: "#202c33" }} />
            </div>
            <div>
              <label className="text-xs text-[#8696a0] mb-1 block">الغرض</label>
              <select value={form.purpose} onChange={e => setForm(p => ({ ...p, purpose: e.target.value as any }))}
                className="w-full h-9 rounded-md px-3 text-sm text-white border-0" style={{ background: "#202c33" }}>
                <option value="rag_training">تدريب AI</option>
                <option value="leads_import">استيراد عملاء</option>
                <option value="products">منتجات</option>
                <option value="faq">أسئلة وأجوبة</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-[#8696a0] mb-1 block">رابط Google Sheet *</label>
            <Input value={form.sheetUrl} onChange={e => setForm(p => ({ ...p, sheetUrl: e.target.value }))}
              placeholder="https://docs.google.com/spreadsheets/d/..." className="border-0 text-white text-sm h-9" style={{ background: "#202c33" }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#8696a0] mb-1 block">اسم التبويب (اختياري)</label>
              <Input value={form.tabName} onChange={e => setForm(p => ({ ...p, tabName: e.target.value }))}
                placeholder="Sheet1" className="border-0 text-white text-sm h-9" style={{ background: "#202c33" }} />
            </div>
            <div className="flex items-end gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={(form as any).autoSync ?? false} onChange={e => setForm(p => ({ ...p, autoSync: e.target.checked }))}
                  className="w-4 h-4 rounded" />
                <span className="text-sm text-white">مزامنة تلقائية</span>
              </label>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => addSheet.mutate({ ...form, sheetId: form.sheetUrl.match(/\/d\/([^/]+)/)?.[1] ?? "" })} disabled={!form.name || !form.sheetUrl || addSheet.isPending}
              className="gap-1.5 text-white" style={{ background: "#25D366" }}>
              <Link className="w-4 h-4" />
              {addSheet.isPending ? "جاري الربط..." : "ربط الجدول"}
            </Button>
            <Button variant="ghost" onClick={() => setShowForm(false)} className="text-[#8696a0] hover:text-white">إلغاء</Button>
          </div>
        </div>
      )}

      {/* قائمة الاتصالات */}
      {sheets.length === 0 && !showForm ? (
        <div className="text-center py-16">
          <Table2 className="w-12 h-12 text-[#8696a0] mx-auto mb-3" />
          <p className="text-white font-medium">لا توجد جداول مربوطة</p>
          <p className="text-sm text-[#8696a0] mt-1">اربط Google Sheet لاستيراد البيانات تلقائياً</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sheets.map((sheet: any) => (
            <div key={sheet.id} className="rounded-xl border p-4" style={{ background: "#1e2a32", borderColor: "rgba(255,255,255,0.08)" }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "rgba(37,211,102,0.1)" }}>
                    <Table2 className="w-5 h-5 text-[#25D366]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-white font-medium text-sm">{sheet.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${PURPOSE_COLORS[sheet.purpose] || 'text-gray-400 bg-gray-500/10'}`}>
                        {PURPOSE_LABELS[sheet.purpose] || sheet.purpose}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <a href={sheet.sheetUrl} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-[#25D366] hover:underline flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" />
                        فتح الجدول
                      </a>
                      {sheet.tabName && <span className="text-xs text-[#8696a0]">تبويب: {sheet.tabName}</span>}
                      {sheet.lastSyncAt && (
                        <span className="text-xs text-[#8696a0]">
                          آخر مزامنة: {new Date(sheet.lastSyncAt).toLocaleDateString('ar-SA')}
                        </span>
                      )}
                      {sheet.success ? 1 : 0 > 0 && (
                        <span className="text-xs text-green-400">{sheet.success ? 1 : 0} صف مستورد</span>
                      )}
                    </div>
                    {sheet.lastSyncStatus === 'failed' && (
                      <p className="text-xs text-red-400 mt-1">{sheet.lastSyncError}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => syncSheet.mutate({ id: sheet.id })}
                    disabled={syncSheet.isPending} className="h-8 gap-1.5 text-xs border-[#25D366]/40 text-[#25D366] hover:bg-[#25D366]/10">
                    <Download className="w-3.5 h-3.5" />
                    {syncSheet.isPending ? "جاري..." : "مزامنة"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteSheet.mutate({ id: sheet.id })}
                    className="h-8 w-8 p-0 text-[#8696a0] hover:text-red-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===== الصفحة الرئيسية =====
export default function KnowledgeBase() {
  const [activeTab, setActiveTab] = useState("documents");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");

  // نماذج المستندات
  const [showDocForm, setShowDocForm] = useState(false);
  const [editingDoc, setEditingDoc] = useState<any>(null);
  const [docForm, setDocForm] = useState({
    title: "", description: "", content: "", isActive: true,
  });

  // نماذج الأمثلة
  const [showExampleForm, setShowExampleForm] = useState(false);
  const [editingExample, setEditingExample] = useState<any>(null);
  const [exampleForm, setExampleForm] = useState({
    customerMessage: "", idealResponse: "", context: "", tone: "friendly" as any, rating: 5, isActive: true,
  });

  // شخصية AI
  const [showPersonalityForm, setShowPersonalityForm] = useState(false);
  const [personalityForm, setPersonalityForm] = useState({
    name: "مساعد المبيعات", role: "مساعد مبيعات احترافي", businessContext: "",
    defaultTone: "friendly" as any, language: "ar", systemPrompt: "",
    rules: [] as string[], forbiddenTopics: [] as string[],
    greetingMessage: "", closingMessage: "", isActive: true,
  });
  const [newRule, setNewRule] = useState("");
  const [newForbidden, setNewForbidden] = useState("");

  // AI توليد
  const [showAiGenerate, setShowAiGenerate] = useState(false);
  const [aiGenerateTopic, setAiGenerateTopic] = useState("");
  const [aiGenerateType, setAiGenerateType] = useState<any>("text");
  const [aiGeneratedContent, setAiGeneratedContent] = useState("");

  // ===== جلب البيانات =====
  const { data: documents = [], refetch: refetchDocs } = trpc.ragKnowledge.listDocuments.useQuery({});
  const { data: examples = [], refetch: refetchExamples } = trpc.ragKnowledge.listExamples.useQuery({});
  const { data: personality, refetch: refetchPersonality } = trpc.ragKnowledge.getPersonality.useQuery();
  const { data: stats, refetch: refetchStats } = trpc.ragKnowledge.getStats.useQuery();

  // تحديث نموذج الشخصية عند جلب البيانات
  useMemo(() => {
    if (personality) {
      setPersonalityForm({
        name: personality.name || "مساعد المبيعات",
        role: personality.role || "مساعد مبيعات احترافي",
        businessContext: personality.businessContext || "",
        defaultTone: personality.defaultTone || "friendly",
        language: personality.language || "ar",
        systemPrompt: personality.systemPrompt || "",
        rules: (personality.rules as string[]) || [],
        forbiddenTopics: (personality.forbiddenTopics as string[]) || [],
        greetingMessage: personality.greetingMessage || "",
        closingMessage: personality.closingMessage || "",
        isActive: personality.isActive ?? true,
      });
    }
  }, [personality]);

  // ===== Mutations =====
  const createDoc = trpc.ragKnowledge.createDocument.useMutation({
    onSuccess: () => { toast.success("تم إضافة المستند"); setShowDocForm(false); resetDocForm(); refetchDocs(); refetchStats(); },
    onError: (e) => toast.error("خطأ", { description: e.message }),
  });
  const updateDoc = trpc.ragKnowledge.updateDocument.useMutation({
    onSuccess: () => { toast.success("تم تحديث المستند"); setShowDocForm(false); setEditingDoc(null); resetDocForm(); refetchDocs(); },
    onError: (e) => toast.error("خطأ", { description: e.message }),
  });
  const deleteDoc = trpc.ragKnowledge.deleteDocument.useMutation({
    onSuccess: () => { toast.success("تم حذف المستند"); refetchDocs(); refetchStats(); },
    onError: (e) => toast.error("خطأ", { description: e.message }),
  });

  const createExample = trpc.ragKnowledge.createExample.useMutation({
    onSuccess: () => { toast.success("تم إضافة المثال"); setShowExampleForm(false); resetExampleForm(); refetchExamples(); refetchStats(); },
    onError: (e) => toast.error("خطأ", { description: e.message }),
  });
  const updateExample = trpc.ragKnowledge.updateExample.useMutation({
    onSuccess: () => { toast.success("تم تحديث المثال"); setShowExampleForm(false); setEditingExample(null); resetExampleForm(); refetchExamples(); },
    onError: (e) => toast.error("خطأ", { description: e.message }),
  });
  const deleteExample = trpc.ragKnowledge.deleteExample.useMutation({
    onSuccess: () => { toast.success("تم حذف المثال"); refetchExamples(); refetchStats(); },
    onError: (e) => toast.error("خطأ", { description: e.message }),
  });

  const savePersonality = trpc.ragKnowledge.savePersonality.useMutation({
    onSuccess: () => { toast.success("تم حفظ شخصية AI"); setShowPersonalityForm(false); refetchPersonality(); },
    onError: (e) => toast.error("خطأ", { description: e.message }),
  });

  const generateWithAI = { mutateAsync: async (data: any) => { const c = typeof data.content === 'string' ? data.content : ''; setAiGeneratedContent(c); setDocForm((p: any) => ({ ...p, title: data.title, content: c })); }, isPending: false };

  const analyzeKB = { mutateAsync: async (data: any) => { toast.success("تحليل قاعدة المعرفة", { description: (typeof data.analysis === 'string' ? data.analysis.substring(0, 200) : '') + "..." }); }, isPending: false };

  // ===== مساعدات =====
  const resetDocForm = () => setDocForm({ title: "", description: "", content: "", isActive: true });
  const resetExampleForm = () => setExampleForm({ customerMessage: "", idealResponse: "", context: "", tone: "friendly", rating: 5, isActive: true });

  const handleEditDoc = (doc: any) => {
    setEditingDoc(doc);
    setDocForm({ title: doc.title, description: doc.description || "", content: doc.content, isActive: doc.isActive });
    setShowDocForm(true);
  };

  const handleEditExample = (ex: any) => {
    setEditingExample(ex);
    setExampleForm({ customerMessage: ex.customerMessage, idealResponse: ex.idealResponse, context: ex.context || "", tone: ex.tone, rating: ex.rating || 5, isActive: ex.isActive });
    setShowExampleForm(true);
  };

  const handleSaveDoc = () => {
    if (!docForm.title.trim() || !docForm.content.trim()) { toast.error("العنوان والمحتوى مطلوبان"); return; }
    if (editingDoc) updateDoc.mutate({ id: editingDoc.id, ...docForm });
    else createDoc.mutate(docForm);
  };

  const handleSaveExample = () => {
    if (!exampleForm.customerMessage.trim() || !exampleForm.idealResponse.trim()) { toast.error("رسالة العميل والرد المثالي مطلوبان"); return; }
    if (editingExample) updateExample.mutate({ id: editingExample.id, ...exampleForm });
    else createExample.mutate(exampleForm);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "#111b21" }}>
      {/* ===== رأس الصفحة ===== */}
      <div className="px-6 py-4 border-b border-white/10 flex-shrink-0" style={{ background: "#202c33" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(37,211,102,0.15)" }}>
              <Brain className="w-5 h-5 text-[#25D366]" />
            </div>
            <div>
              <h1 className="font-bold text-white text-lg">قاعدة معرفة AI</h1>
              <p className="text-xs text-[#8696a0]">تدريب الذكاء الاصطناعي على الردود الاحترافية</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* إحصائيات سريعة */}
            {stats && (
              <div className="flex items-center gap-3 mr-2">
                <div className="text-center">
                  <p className="text-lg font-bold text-[#25D366]">{stats.documents}</p>
                  <p className="text-[10px] text-[#8696a0]">مستند</p>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div className="text-center">
                  <p className="text-lg font-bold text-cyan-400">{stats.examples}</p>
                  <p className="text-[10px] text-[#8696a0]">مثال</p>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div className="text-center">
                  <p className="text-lg font-bold text-purple-400">{stats.chunks}</p>
                  <p className="text-[10px] text-[#8696a0]">جزء</p>
                </div>
              </div>
            )}
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs border-white/10 text-[#8696a0] hover:text-white"
              onClick={() => analyzeKB.mutateAsync({ query: "تحليل قاعدة المعرفة" })} disabled={analyzeKB.isPending}>
              {analyzeKB.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <BarChart2 className="w-3.5 h-3.5" />}
              تحليل AI
            </Button>
            <Button size="sm" className="h-8 gap-1.5 text-xs text-white" style={{ background: "#25D366" }}
              onClick={() => setShowPersonalityForm(true)}>
              <Settings className="w-3.5 h-3.5" />
              شخصية AI
            </Button>
          </div>
        </div>
      </div>

      {/* ===== المحتوى ===== */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          {/* شريط التبويبات والبحث */}
          <div className="px-6 pt-4 pb-3 flex-shrink-0 border-b border-white/5">
            <div className="flex items-center justify-between gap-4">
              <TabsList className="h-9" style={{ background: "#202c33" }}>
                <TabsTrigger value="documents" className="text-xs gap-1.5 data-[state=active]:text-white data-[state=active]:bg-[#2a3942]">
                  <FileText className="w-3.5 h-3.5" />
                  المستندات ({documents.length})
                </TabsTrigger>
                <TabsTrigger value="examples" className="text-xs gap-1.5 data-[state=active]:text-white data-[state=active]:bg-[#2a3942]">
                  <MessageSquare className="w-3.5 h-3.5" />
                  أمثلة المحادثات ({examples.length})
                </TabsTrigger>
                <TabsTrigger value="google-sheets" className="text-xs gap-1.5 data-[state=active]:text-white data-[state=active]:bg-[#2a3942]">
                  <Table2 className="w-3.5 h-3.5" />
                  Google Sheets
                </TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8696a0]" />
                  <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    placeholder="بحث..." className="pr-8 h-8 w-48 text-xs border-0 text-white placeholder:text-[#8696a0]"
                    style={{ background: "#202c33" }} />
                </div>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="h-8 w-28 text-xs border-0 text-white" style={{ background: "#202c33" }}>
                    <SelectValue placeholder="التصنيف" />
                  </SelectTrigger>
                  <SelectContent style={{ background: "#233138", border: "1px solid rgba(255,255,255,0.1)" }}>
                    <SelectItem value="all" className="text-white hover:bg-white/10">الكل</SelectItem>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c} value={c} className="text-white hover:bg-white/10">{CATEGORY_LABELS[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {activeTab === "documents" && (
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="h-8 w-28 text-xs border-0 text-white" style={{ background: "#202c33" }}>
                      <SelectValue placeholder="النوع" />
                    </SelectTrigger>
                    <SelectContent style={{ background: "#233138", border: "1px solid rgba(255,255,255,0.1)" }}>
                      <SelectItem value="all" className="text-white hover:bg-white/10">الكل</SelectItem>
                      {DOC_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value} className="text-white hover:bg-white/10">{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button size="sm" className="h-8 gap-1.5 text-xs text-white" style={{ background: "#25D366" }}
                  onClick={() => {
                    if (activeTab === "documents") { setEditingDoc(null); resetDocForm(); setShowDocForm(true); }
                    else { setEditingExample(null); resetExampleForm(); setShowExampleForm(true); }
                  }}>
                  <Plus className="w-3.5 h-3.5" />
                  {activeTab === "documents" ? "مستند جديد" : "مثال جديد"}
                </Button>
              </div>
            </div>
          </div>

          {/* ===== المستندات ===== */}
          <TabsContent value="documents" className="flex-1 overflow-y-auto p-6 m-0">
            {documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-[#8696a0]">
                <BookOpen className="w-16 h-16 mb-4 opacity-20" />
                <p className="text-sm font-medium text-white mb-1">لا توجد مستندات بعد</p>
                <p className="text-xs mb-4 opacity-50">أضف مستندات لتدريب AI على معلومات نشاطك التجاري</p>
                <div className="flex gap-2">
                  <Button size="sm" className="text-white text-xs" style={{ background: "#25D366" }}
                    onClick={() => { setEditingDoc(null); resetDocForm(); setShowDocForm(true); }}>
                    <Plus className="w-3.5 h-3.5 ml-1" /> إضافة مستند
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs border-white/10 text-[#8696a0] hover:text-white"
                    onClick={() => setShowAiGenerate(true)}>
                    <Sparkles className="w-3.5 h-3.5 ml-1" /> توليد بـ AI
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {documents.map((doc: any) => (
                  <DocumentCard key={doc.id} doc={doc}
                    onEdit={handleEditDoc}
                    onDelete={(id) => { if (confirm("حذف هذا المستند؟")) deleteDoc.mutate({ id }); }}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* ===== أمثلة المحادثات ===== */}
          <TabsContent value="examples" className="flex-1 overflow-y-auto p-6 m-0">
            {examples.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-[#8696a0]">
                <MessageSquare className="w-16 h-16 mb-4 opacity-20" />
                <p className="text-sm font-medium text-white mb-1">لا توجد أمثلة بعد</p>
                <p className="text-xs mb-4 opacity-50">أضف أمثلة على محادثات احترافية لتدريب AI</p>
                <Button size="sm" className="text-white text-xs" style={{ background: "#25D366" }}
                  onClick={() => { setEditingExample(null); resetExampleForm(); setShowExampleForm(true); }}>
                  <Plus className="w-3.5 h-3.5 ml-1" /> إضافة مثال
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {examples.map((ex: any) => (
                  <ExampleCard key={ex.id} example={ex}
                    onEdit={handleEditExample}
                    onDelete={(id) => { if (confirm("حذف هذا المثال؟")) deleteExample.mutate({ id }); }}
                  />
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="google-sheets" className="flex-1 overflow-y-auto p-6 m-0">
            <GoogleSheetsTab />
          </TabsContent>
        </Tabs>
      </div>

      {/* ===== نموذج المستند ===== */}
      <Dialog open={showDocForm} onOpenChange={(open) => { if (!open) { setShowDocForm(false); setEditingDoc(null); resetDocForm(); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" style={{ background: "#233138", border: "1px solid rgba(255,255,255,0.1)" }}>
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#25D366]" />
              {editingDoc ? "تعديل المستند" : "إضافة مستند جديد"}
            </DialogTitle>
            <DialogDescription className="text-[#8696a0]">
              أضف معلومات عن نشاطك التجاري لتدريب AI على الردود الاحترافية
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="text-xs border-white/10 text-[#8696a0] hover:text-white gap-1.5"
                onClick={() => setShowAiGenerate(true)}>
                <Sparkles className="w-3.5 h-3.5 text-[#25D366]" />
                توليد بـ AI
              </Button>
            </div>

            <div>
              <label className="text-sm text-[#8696a0] mb-1.5 block">العنوان *</label>
              <Input value={docForm.title} onChange={e => setDocForm(p => ({ ...p, title: e.target.value }))}
                placeholder="مثال: سياسة الإرجاع والاستبدال"
                className="text-white border-0" style={{ background: "#2a3942" }} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-[#8696a0] mb-1.5 block">نوع المستند</label>
                <Select value={docForm.docType} onValueChange={v => setDocForm(p => ({ ...p}))}>
                  <SelectTrigger className="text-white border-0" style={{ background: "#2a3942" }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={{ background: "#233138", border: "1px solid rgba(255,255,255,0.1)" }}>
                    {DOC_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value} className="text-white hover:bg-white/10">{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-[#8696a0] mb-1.5 block">التصنيف</label>
                <Select value={docForm.category} onValueChange={v => setDocForm(p => ({ ...p}))}>
                  <SelectTrigger className="text-white border-0" style={{ background: "#2a3942" }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={{ background: "#233138", border: "1px solid rgba(255,255,255,0.1)" }}>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c} value={c} className="text-white hover:bg-white/10">{CATEGORY_LABELS[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm text-[#8696a0] mb-1.5 block">وصف مختصر (اختياري)</label>
              <Input value={docForm.description} onChange={e => setDocForm(p => ({ ...p, description: e.target.value }))}
                placeholder="وصف مختصر للمستند"
                className="text-white border-0" style={{ background: "#2a3942" }} />
            </div>

            <div>
              <label className="text-sm text-[#8696a0] mb-1.5 block">المحتوى *</label>
              <Textarea value={docForm.content} onChange={e => setDocForm(p => ({ ...p, content: e.target.value }))}
                placeholder="أدخل محتوى المستند هنا... يمكن أن يكون نصاً طويلاً، أسئلة وأجوبة، وصف منتجات، سياسات، إلخ."
                className="text-white border-0 min-h-[200px] text-sm leading-relaxed"
                style={{ background: "#2a3942" }} />
              <p className="text-xs text-[#8696a0] mt-1">{docForm.content.length} حرف</p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <div
                  className="w-10 h-5 rounded-full transition-all relative cursor-pointer"
                  style={{ background: docForm.isActive ? "#25D366" : "#374151" }}
                  onClick={() => setDocForm(p => ({ ...p, isActive: !p.isActive }))}
                >
                  <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                    style={{ left: docForm.isActive ? "22px" : "2px" }} />
                </div>
                <span className="text-sm text-white">مفعّل</span>
              </label>
              <div className="flex gap-2">
                <Button variant="ghost" className="text-[#8696a0] hover:text-white" onClick={() => { setShowDocForm(false); setEditingDoc(null); resetDocForm(); }}>
                  إلغاء
                </Button>
                <Button className="text-white gap-1.5" style={{ background: "#25D366" }}
                  onClick={handleSaveDoc} disabled={createDoc.isPending || updateDoc.isPending}>
                  {(createDoc.isPending || updateDoc.isPending) ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  حفظ
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== نموذج مثال المحادثة ===== */}
      <Dialog open={showExampleForm} onOpenChange={(open) => { if (!open) { setShowExampleForm(false); setEditingExample(null); resetExampleForm(); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" style={{ background: "#233138", border: "1px solid rgba(255,255,255,0.1)" }}>
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-cyan-400" />
              {editingExample ? "تعديل المثال" : "إضافة مثال محادثة"}
            </DialogTitle>
            <DialogDescription className="text-[#8696a0]">
              أضف أمثلة على ردود احترافية لتدريب AI على أسلوب التواصل المطلوب
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm text-[#8696a0] mb-1.5 block">رسالة العميل *</label>
              <Textarea value={exampleForm.customerMessage} onChange={e => setExampleForm(p => ({ ...p, customerMessage: e.target.value }))}
                placeholder="مثال: كم سعر المنتج؟ أو: هل يوجد توصيل لجدة؟"
                className="text-white border-0 min-h-[80px]" style={{ background: "#2a3942" }} />
            </div>

            <div>
              <label className="text-sm text-[#8696a0] mb-1.5 block">الرد المثالي *</label>
              <Textarea value={exampleForm.idealResponse} onChange={e => setExampleForm(p => ({ ...p, idealResponse: e.target.value }))}
                placeholder="اكتب الرد الاحترافي المثالي الذي تريد من AI تعلّمه..."
                className="text-white border-0 min-h-[120px]" style={{ background: "#2a3942" }} />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm text-[#8696a0] mb-1.5 block">أسلوب الرد</label>
                <Select value={exampleForm.tone} onValueChange={v => setExampleForm(p => ({ ...p, tone: v as any }))}>
                  <SelectTrigger className="text-white border-0" style={{ background: "#2a3942" }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={{ background: "#233138", border: "1px solid rgba(255,255,255,0.1)" }}>
                    {TONE_OPTIONS.map(t => (
                      <SelectItem key={t.value} value={t.value} className="text-white hover:bg-white/10">{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-[#8696a0] mb-1.5 block">التصنيف</label>
                <Select value={exampleForm.category} onValueChange={v => setExampleForm(p => ({ ...p}))}>
                  <SelectTrigger className="text-white border-0" style={{ background: "#2a3942" }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={{ background: "#233138", border: "1px solid rgba(255,255,255,0.1)" }}>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c} value={c} className="text-white hover:bg-white/10">{CATEGORY_LABELS[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-[#8696a0] mb-1.5 block">التقييم</label>
                <div className="flex items-center gap-1 h-10 px-3 rounded-lg" style={{ background: "#2a3942" }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <Star key={n} className={`w-4 h-4 cursor-pointer transition-colors ${n <= exampleForm.rating ? "text-yellow-400 fill-yellow-400" : "text-white/20"}`}
                      onClick={() => setExampleForm(p => ({ ...p, rating: n }))} />
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm text-[#8696a0] mb-1.5 block">السياق (اختياري)</label>
              <Input value={exampleForm.context} onChange={e => setExampleForm(p => ({ ...p, context: e.target.value }))}
                placeholder="مثال: عميل جديد يسأل عن المنتج لأول مرة"
                className="text-white border-0" style={{ background: "#2a3942" }} />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div />
              <div className="flex gap-2">
                <Button variant="ghost" className="text-[#8696a0] hover:text-white" onClick={() => { setShowExampleForm(false); setEditingExample(null); resetExampleForm(); }}>
                  إلغاء
                </Button>
                <Button className="text-white gap-1.5" style={{ background: "#25D366" }}
                  onClick={handleSaveExample} disabled={createExample.isPending || updateExample.isPending}>
                  {(createExample.isPending || updateExample.isPending) ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  حفظ
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== نموذج شخصية AI ===== */}
      <Dialog open={showPersonalityForm} onOpenChange={setShowPersonalityForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" style={{ background: "#233138", border: "1px solid rgba(255,255,255,0.1)" }}>
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Bot className="w-5 h-5 text-[#25D366]" />
              شخصية AI وإعداداته
            </DialogTitle>
            <DialogDescription className="text-[#8696a0]">
              حدد هوية وأسلوب الذكاء الاصطناعي وقواعد التواصل
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-[#8696a0] mb-1.5 block">اسم المساعد</label>
                <Input value={personalityForm.name} onChange={e => setPersonalityForm(p => ({ ...p, name: e.target.value }))}
                  className="text-white border-0" style={{ background: "#2a3942" }} />
              </div>
              <div>
                <label className="text-sm text-[#8696a0] mb-1.5 block">الدور الوظيفي</label>
                <Input value={personalityForm.role} onChange={e => setPersonalityForm(p => ({ ...p, role: e.target.value }))}
                  placeholder="مساعد مبيعات احترافي"
                  className="text-white border-0" style={{ background: "#2a3942" }} />
              </div>
            </div>

            <div>
              <label className="text-sm text-[#8696a0] mb-1.5 block">وصف النشاط التجاري</label>
              <Textarea value={personalityForm.businessContext} onChange={e => setPersonalityForm(p => ({ ...p, businessContext: e.target.value }))}
                placeholder="اكتب وصفاً شاملاً لنشاطك التجاري: المنتجات، الخدمات، الأسعار، ساعات العمل، السياسات..."
                className="text-white border-0 min-h-[100px]" style={{ background: "#2a3942" }} />
            </div>

            <div>
              <label className="text-sm text-[#8696a0] mb-1.5 block">System Prompt مخصص (اختياري)</label>
              <Textarea value={personalityForm.systemPrompt} onChange={e => setPersonalityForm(p => ({ ...p, systemPrompt: e.target.value }))}
                placeholder="أدخل system prompt مخصص لتحكم كامل في سلوك AI..."
                className="text-white border-0 min-h-[80px] text-sm font-mono" style={{ background: "#2a3942" }} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-[#8696a0] mb-1.5 block">رسالة الترحيب</label>
                <Textarea value={personalityForm.greetingMessage} onChange={e => setPersonalityForm(p => ({ ...p, greetingMessage: e.target.value }))}
                  placeholder="مرحباً! كيف يمكنني مساعدتك؟"
                  className="text-white border-0 min-h-[70px] text-sm" style={{ background: "#2a3942" }} />
              </div>
              <div>
                <label className="text-sm text-[#8696a0] mb-1.5 block">رسالة الإنهاء</label>
                <Textarea value={personalityForm.closingMessage} onChange={e => setPersonalityForm(p => ({ ...p, closingMessage: e.target.value }))}
                  placeholder="شكراً لتواصلك معنا! نتمنى لك يوماً سعيداً."
                  className="text-white border-0 min-h-[70px] text-sm" style={{ background: "#2a3942" }} />
              </div>
            </div>

            {/* القواعد */}
            <div>
              <label className="text-sm text-[#8696a0] mb-1.5 block">قواعد يجب الالتزام بها</label>
              <div className="space-y-1.5 mb-2">
                {personalityForm.rules.map((rule, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "#2a3942" }}>
                    <CheckCircle className="w-3.5 h-3.5 text-[#25D366] flex-shrink-0" />
                    <span className="text-sm text-white flex-1">{rule}</span>
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-[#8696a0] hover:text-red-400"
                      onClick={() => setPersonalityForm(p => ({ ...p, rules: p.rules.filter((_, j) => j !== i) }))}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input value={newRule} onChange={e => setNewRule(e.target.value)}
                  placeholder="مثال: دائماً رد باللغة العربية"
                  className="text-white border-0 text-sm" style={{ background: "#2a3942" }}
                  onKeyDown={e => { if (e.key === "Enter" && newRule.trim()) { setPersonalityForm(p => ({ ...p, rules: [...p.rules, newRule.trim()] })); setNewRule(""); } }}
                />
                <Button size="sm" variant="outline" className="border-white/10 text-[#8696a0] hover:text-white flex-shrink-0"
                  onClick={() => { if (newRule.trim()) { setPersonalityForm(p => ({ ...p, rules: [...p.rules, newRule.trim()] })); setNewRule(""); } }}>
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* المواضيع المحظورة */}
            <div>
              <label className="text-sm text-[#8696a0] mb-1.5 block">مواضيع محظورة</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {personalityForm.forbiddenTopics.map((topic, i) => (
                  <span key={i} className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                    {topic}
                    <button onClick={() => setPersonalityForm(p => ({ ...p, forbiddenTopics: p.forbiddenTopics.filter((_, j) => j !== i) }))}>
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input value={newForbidden} onChange={e => setNewForbidden(e.target.value)}
                  placeholder="مثال: السياسة، المنافسين"
                  className="text-white border-0 text-sm" style={{ background: "#2a3942" }}
                  onKeyDown={e => { if (e.key === "Enter" && newForbidden.trim()) { setPersonalityForm(p => ({ ...p, forbiddenTopics: [...p.forbiddenTopics, newForbidden.trim()] })); setNewForbidden(""); } }}
                />
                <Button size="sm" variant="outline" className="border-white/10 text-[#8696a0] hover:text-white flex-shrink-0"
                  onClick={() => { if (newForbidden.trim()) { setPersonalityForm(p => ({ ...p, forbiddenTopics: [...p.forbiddenTopics, newForbidden.trim()] })); setNewForbidden(""); } }}>
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" className="text-[#8696a0] hover:text-white" onClick={() => setShowPersonalityForm(false)}>
                إلغاء
              </Button>
              <Button className="text-white gap-1.5" style={{ background: "#25D366" }}
                onClick={() => savePersonality.mutate(personalityForm)} disabled={savePersonality.isPending}>
                {savePersonality.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                حفظ الشخصية
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== نافذة توليد AI ===== */}
      <Dialog open={showAiGenerate} onOpenChange={setShowAiGenerate}>
        <DialogContent className="max-w-xl" style={{ background: "#233138", border: "1px solid rgba(255,255,255,0.1)" }}>
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#25D366]" />
              توليد مستند بالذكاء الاصطناعي
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm text-[#8696a0] mb-1.5 block">موضوع المستند</label>
              <Input value={aiGenerateTopic} onChange={e => setAiGenerateTopic(e.target.value)}
                placeholder="مثال: سياسة الإرجاع، أسعار المنتجات، ساعات العمل..."
                className="text-white border-0" style={{ background: "#2a3942" }} />
            </div>
            <div>
              <label className="text-sm text-[#8696a0] mb-1.5 block">نوع المستند</label>
              <Select value={aiGenerateType} onValueChange={setAiGenerateType}>
                <SelectTrigger className="text-white border-0" style={{ background: "#2a3942" }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={{ background: "#233138", border: "1px solid rgba(255,255,255,0.1)" }}>
                  {DOC_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value} className="text-white hover:bg-white/10">{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {aiGeneratedContent && (
              <div className="rounded-xl p-3 border" style={{ background: "#182229", borderColor: "rgba(37,211,102,0.3)" }}>
                <p className="text-xs text-[#25D366] mb-2 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> تم التوليد - سيتم إضافته للنموذج
                </p>
                <pre className="text-xs text-white/80 whitespace-pre-wrap max-h-32 overflow-y-auto">{aiGeneratedContent.substring(0, 300)}...</pre>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" className="text-[#8696a0] hover:text-white" onClick={() => setShowAiGenerate(false)}>
                إلغاء
              </Button>
              <Button className="text-white gap-1.5" style={{ background: "#25D366" }}
                onClick={() => {
                  if (!aiGenerateTopic.trim()) { toast.error("أدخل موضوع المستند"); return; }
                  generateWithAI.mutateAsync({ topic: aiGenerateTopic});
                }}
                disabled={generateWithAI.isPending}>
                {generateWithAI.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {generateWithAI.isPending ? "جاري التوليد..." : "توليد"}
              </Button>
              {aiGeneratedContent && (
                <Button className="text-white gap-1.5 bg-blue-600 hover:bg-blue-700"
                  onClick={() => { setShowAiGenerate(false); setEditingDoc(null); setShowDocForm(true); }}>
                  <Plus className="w-4 h-4" />
                  فتح في النموذج
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
