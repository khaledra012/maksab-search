import { useState } from "react";
import { useLocation } from "wouter";
import InterestKeywords from "./InterestKeywords";
import Segments from "./Segments";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus, Trash2, Pencil, Settings2, Tag, Building2, MapPin, Globe, Layers,
  ChevronDown, ChevronUp, GripVertical, Check, X, Search, Users, ArrowLeft
} from "lucide-react";

// ===== أنواع البيانات =====
type DataItem = {
  id: number;
  category: string;
  value: string;
  label: string;
  parentValue: string | null;
  sortOrder: number;
  isActive: boolean;
};

type CategoryConfig = {
  key: "businessType" | "city" | "district" | "source" | "tag";
  label: string;
  icon: React.ElementType;
  color: string;
  description: string;
  placeholder: string;
};

const CATEGORIES: CategoryConfig[] = [
  {
    key: "businessType",
    label: "أنواع الأعمال",
    icon: Building2,
    color: "oklch(0.75 0.18 200)",
    description: "أنواع الأنشطة التجارية المستخدمة في قوائم العملاء",
    placeholder: "مثال: مطعم، صيدلية، بقالة...",
  },
  {
    key: "city",
    label: "المدن",
    icon: MapPin,
    color: "oklch(0.75 0.18 145)",
    description: "المدن المتاحة في قوائم الاختيار",
    placeholder: "مثال: الرياض، جدة، مكة...",
  },
  {
    key: "district",
    label: "الأحياء",
    icon: Globe,
    color: "oklch(0.85 0.16 75)",
    description: "الأحياء والمناطق داخل المدن",
    placeholder: "مثال: العليا، النزهة، الملز...",
  },
  {
    key: "source",
    label: "مصادر البيانات",
    icon: Layers,
    color: "oklch(0.75 0.18 300)",
    description: "مصادر جمع بيانات العملاء",
    placeholder: "مثال: خرائط جوجل، إنستغرام، يدوي...",
  },
  {
    key: "tag",
    label: "التصنيفات والعلامات",
    icon: Tag,
    color: "oklch(0.7 0.22 25)",
    description: "علامات تصنيف العملاء",
    placeholder: "مثال: عميل مميز، أولوية عالية...",
  },
];

// ===== مكوّن بطاقة الفئة =====
function CategoryCard({ category }: { category: CategoryConfig }) {
  const [expanded, setExpanded] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DataItem | null>(null);

  const { data: items = [], refetch } = trpc.dataSettings.getByCategory.useQuery(
    { category: category.key },
    { enabled: expanded }
  );

  const createItem = trpc.dataSettings.create.useMutation({
    onSuccess: () => { refetch(); setNewLabel(""); setAddMode(false); toast.success("تم الإضافة"); },
    onError: (e) => toast.error(e.message),
  });
  const updateItem = trpc.dataSettings.update.useMutation({
    onSuccess: () => { refetch(); setEditingId(null); toast.success("تم التحديث"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteItem = trpc.dataSettings.delete.useMutation({
    onSuccess: () => { refetch(); setDeleteTarget(null); toast.success("تم الحذف"); },
    onError: (e) => toast.error(e.message),
  });

  const handleAdd = () => {
    if (!newLabel.trim()) return;
    createItem.mutate({
      category: category.key,
      value: newLabel.trim().toLowerCase().replace(/\s+/g, "_"),
      label: newLabel.trim(),
      sortOrder: items.length,
    });
  };

  const handleEdit = (item: DataItem) => {
    setEditingId(item.id);
    setEditLabel(item.label);
  };

  const handleSaveEdit = () => {
    if (!editLabel.trim() || editingId === null) return;
    updateItem.mutate({ id: editingId, label: editLabel.trim() });
  };

  const Icon = category.icon;

  return (
    <div
      className="rounded-2xl border overflow-hidden transition-all"
      style={{ borderColor: "oklch(0.25 0.02 240)", background: "oklch(0.11 0.015 240)" }}
    >
      {/* رأس البطاقة */}
      <button
        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-all"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: `${category.color}20`, border: `1px solid ${category.color}40` }}
          >
            <Icon className="w-4 h-4" style={{ color: category.color }} />
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold text-foreground">{category.label}</div>
            <div className="text-xs text-muted-foreground">{category.description}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {expanded && items.length > 0 && (
            <Badge variant="secondary" className="text-xs">{items.length} عنصر</Badge>
          )}
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* المحتوى */}
      {expanded && (
        <div className="border-t" style={{ borderColor: "oklch(0.2 0.02 240)" }}>
          {/* قائمة العناصر */}
          <div className="p-3 space-y-1.5 max-h-64 overflow-y-auto">
            {items.length === 0 && !addMode && (
              <div className="text-center py-6 text-muted-foreground text-sm">
                لا توجد عناصر بعد. أضف أول عنصر!
              </div>
            )}
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 px-3 py-2 rounded-xl group"
                style={{ background: "oklch(0.14 0.015 240)" }}
              >
                <GripVertical className="w-3.5 h-3.5 text-muted-foreground opacity-40" />
                {editingId === item.id ? (
                  <div className="flex-1 flex items-center gap-2">
                    <Input
                      value={editLabel}
                      onChange={e => setEditLabel(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") handleSaveEdit(); if (e.key === "Escape") setEditingId(null); }}
                      className="h-7 text-sm flex-1"
                      autoFocus
                    />
                    <button onClick={handleSaveEdit} className="text-green-400 hover:text-green-300">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-foreground">{item.label}</span>
                    <span className="text-xs text-muted-foreground font-mono opacity-50">{item.value}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEdit(item)}
                        className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(item)}
                        className="p-1 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* إضافة عنصر جديد */}
          {addMode ? (
            <div className="px-3 pb-3 flex items-center gap-2">
              <Input
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") { setAddMode(false); setNewLabel(""); } }}
                placeholder={category.placeholder}
                className="flex-1 h-9 text-sm"
                autoFocus
              />
              <Button
                size="sm"
                onClick={handleAdd}
                disabled={!newLabel.trim() || createItem.isPending}
              >
                {createItem.isPending ? "..." : "إضافة"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setAddMode(false); setNewLabel(""); }}
              >
                إلغاء
              </Button>
            </div>
          ) : (
            <div className="px-3 pb-3">
              <button
                onClick={() => setAddMode(true)}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground border border-dashed transition-all"
                style={{ borderColor: "oklch(0.25 0.02 240)" }}
              >
                <Plus className="w-4 h-4" />
                إضافة عنصر جديد
              </button>
            </div>
          )}
        </div>
      )}

      {/* Dialog تأكيد الحذف */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            هل أنت متأكد من حذف <strong className="text-foreground">"{deleteTarget?.label}"</strong>؟
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>إلغاء</Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteItem.mutate({ id: deleteTarget.id })}
              disabled={deleteItem.isPending}
            >
              {deleteItem.isPending ? "جاري الحذف..." : "حذف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== الصفحة الرئيسية =====
export default function DataSettings() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<"data" | "interest" | "segments">("data");
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center"
          style={{ background: "oklch(0.65 0.18 200 / 0.15)", border: "1px solid oklch(0.65 0.18 200 / 0.3)" }}
        >
          <Settings2 className="w-5 h-5" style={{ color: "oklch(0.75 0.18 200)" }} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">إعدادات البيانات</h1>
          <p className="text-sm text-muted-foreground">إدارة القوائم المنسدلة وكشف اهتمام العملاء</p>
        </div>
      </div>
      {/* تبويبات */}
      <div className="flex gap-1 p-1 rounded-xl border border-border" style={{ background: "oklch(0.13 0.012 240)" }}>
        {[
          { id: "data", label: "إعدادات البيانات", icon: Settings2 },
          { id: "interest", label: "كشف الاهتمام", icon: Search },
          { id: "segments", label: "شرائح العملاء", icon: Layers },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as "data" | "interest" | "segments")}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
            style={activeTab === (tab.id as string) ? {
              background: "oklch(0.65 0.18 200 / 0.15)",
              border: "1px solid oklch(0.65 0.18 200 / 0.3)",
              color: "oklch(0.75 0.18 200)",
            } : { color: "var(--muted-foreground)" }}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>
      {/* تبويب إعدادات البيانات */}
      {activeTab === "data" && (
        <div className="space-y-6">
          <div
            className="rounded-2xl p-4 border text-sm text-muted-foreground"
            style={{ background: "oklch(0.13 0.015 240)", borderColor: "oklch(0.65 0.18 200 / 0.2)" }}
          >
            <p>
              هذه الصفحة تتيح لك تخصيص القوائم المنسدلة في نماذج إضافة وتعديل العملاء.
              يمكنك إضافة أنواع أعمال جديدة، مدن، أحياء، ومصادر بيانات حسب احتياجاتك.
              التغييرات تُطبَّق فوراً على جميع النماذج في النظام.
            </p>
          </div>
          {/* روابط سريعة */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate("/segments")}
              className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:bg-muted/30 transition-all text-right group"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5 text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">شرائح العملاء</p>
                <p className="text-xs text-muted-foreground mt-0.5">تجميع العملاء في مجموعات مستهدفة</p>
              </div>
              <ArrowLeft className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </button>
            <button
              onClick={() => navigate("/leads")}
              className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:bg-muted/30 transition-all text-right group"
            >
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                <Layers className="w-5 h-5 text-cyan-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">رفع جماعي</p>
                <p className="text-xs text-muted-foreground mt-0.5">استيراد عملاء من ملف Excel/CSV</p>
              </div>
              <ArrowLeft className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </button>
          </div>
          {/* بطاقات الفئات */}
          <div className="space-y-3">
            {CATEGORIES.map((cat) => (
              <CategoryCard key={cat.key} category={cat} />
            ))}
          </div>
        </div>
      )}
      {/* تبويب كشف الاهتمام */}
      {activeTab === "interest" && <InterestKeywords />}
      {/* تبويب شرائح العملاء */}
      {activeTab === "segments" && <Segments />}
    </div>
  );
}
