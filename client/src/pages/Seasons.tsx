import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Plus, Edit2, Trash2, Save, X, ChevronDown, ChevronUp,
  Calendar, Tag, Sparkles, ToggleLeft, ToggleRight, Loader2,
  AlertTriangle, CheckCircle, Info
} from "lucide-react";
import { toast } from "sonner";

// ===== أنواع الأنشطة الشائعة =====
const BUSINESS_TYPES = [
  "مطعم", "كافيه", "مقهى", "ملابس", "إلكترونيات", "صالون", "عيادة", "صيدلية",
  "بقالة", "سوبرماركت", "تعليم", "رياضة", "سياحة", "نقل", "عقارات", "تصميم",
  "برمجة", "تسويق", "محاسبة", "محامي", "مستشفى", "فندق", "شاليه", "حلويات",
  "مخبز", "عطور", "مجوهرات", "أثاث", "ديكور", "سيارات", "خدمات منزلية",
];

// ===== الألوان المتاحة =====
const COLORS = [
  { value: "#8b5cf6", label: "بنفسجي" },
  { value: "#f59e0b", label: "ذهبي" },
  { value: "#22c55e", label: "أخضر" },
  { value: "#ef4444", label: "أحمر" },
  { value: "#3b82f6", label: "أزرق" },
  { value: "#6366f1", label: "نيلي" },
  { value: "#ec4899", label: "وردي" },
  { value: "#1e293b", label: "أسود" },
  { value: "#0ea5e9", label: "سماوي" },
  { value: "#14b8a6", label: "فيروزي" },
];

// ===== الأيقونات المتاحة =====
const ICONS = ["🌙", "🇸🇦", "☀️", "🎒", "🎉", "❄️", "🛍️", "⭐", "🌺", "🎊", "🏆", "💡", "🎯", "🌟", "🔥"];

// ===== نموذج فارغ =====
const emptyForm = {
  name: "",
  startDate: "",
  endDate: "",
  year: null as number | null,
  opportunities: [""],
  relatedBusinessTypes: [] as string[],
  description: "",
  color: "#f59e0b",
  icon: "🌙",
  isActive: true,
  priority: 5,
  urgencyText: "",
  tipText: "",
};

type FormState = typeof emptyForm;

// ===== مكوّن بطاقة موسم =====
function SeasonCard({
  season,
  onEdit,
  onDelete,
  onToggle,
}: {
  season: any;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const opportunities = (season.opportunities as string[]) || [];
  const related = (season.relatedBusinessTypes as string[]) || [];

  // حساب حالة الموسم
  const today = new Date();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const todayStr = `${mm}-${dd}`;
  const isCurrentlyActive =
    season.isActive &&
    todayStr >= season.startDate &&
    todayStr <= season.endDate;

  return (
    <div
      className="rounded-2xl border transition-all duration-200"
      style={{
        background: isCurrentlyActive
          ? `${season.color}15`
          : "oklch(0.12 0.015 240)",
        borderColor: isCurrentlyActive ? `${season.color}60` : "oklch(0.2 0.02 240)",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
          style={{ background: `${season.color}25` }}
        >
          {season.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-foreground text-sm">{season.name}</h3>
            {isCurrentlyActive && (
              <span
                className="text-xs px-2 py-0.5 rounded-full font-semibold animate-pulse"
                style={{ background: `${season.color}30`, color: season.color }}
              >
                نشط الآن
              </span>
            )}
            {!season.isActive && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                معطّل
              </span>
            )}
            {related.length > 0 && (
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1"
                style={{ background: "oklch(0.18 0.04 260)", color: "oklch(0.65 0.12 260)", border: "1px solid oklch(0.28 0.06 260)" }}
                title={`مخصص لـ: ${related.join('، ')}`}
              >
                <Tag className="w-2.5 h-2.5" />
                {related.length} نوع نشاط
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {season.startDate} — {season.endDate}
              {season.year ? ` (${season.year})` : " (سنوي)"}
            </span>
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              {opportunities.length} فرصة
            </span>
            {related.length === 0 && (
              <span className="flex items-center gap-1 text-muted-foreground/60">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500/60 inline-block" />
                يشمل جميع الأنشطة
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg transition-all hover:bg-white/5"
            title={season.isActive ? "إيقاف" : "تفعيل"}
          >
            {season.isActive ? (
              <ToggleRight className="w-5 h-5" style={{ color: season.color }} />
            ) : (
              <ToggleLeft className="w-5 h-5 text-muted-foreground" />
            )}
          </button>
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg transition-all hover:bg-white/5 text-muted-foreground hover:text-foreground"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg transition-all hover:bg-red-500/10 text-muted-foreground hover:text-red-400"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg transition-all hover:bg-white/5 text-muted-foreground"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: "oklch(0.2 0.02 240)" }}>
          {season.description && (
            <p className="text-xs text-muted-foreground mt-3">{season.description}</p>
          )}
          <div>
            <div className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" style={{ color: season.color }} />
              الفرص التسويقية
            </div>
            <div className="space-y-1.5">
              {opportunities.map((opp: string, i: number) => (
                <div
                  key={i}
                  className="flex items-start gap-2 text-xs"
                  style={{ color: "oklch(0.75 0.01 240)" }}
                >
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5 font-bold"
                    style={{ background: `${season.color}25`, color: season.color }}
                  >
                    {i + 1}
                  </span>
                  {opp}
                </div>
              ))}
            </div>
          </div>
          {related.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <Tag className="w-3 h-3 text-muted-foreground" />
                أنواع الأنشطة المرتبطة
              </div>
              <div className="flex flex-wrap gap-1.5">
                {related.map((bt: string) => (
                  <span
                    key={bt}
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: "oklch(0.18 0.02 240)", color: "oklch(0.65 0.01 240)" }}
                  >
                    {bt}
                  </span>
                ))}
              </div>
            </div>
          )}
          {related.length === 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Info className="w-3 h-3" />
              يشمل جميع أنواع الأنشطة
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ===== نموذج الإضافة/التعديل =====
function SeasonForm({
  initial,
  onSave,
  onCancel,
  isLoading,
}: {
  initial: FormState;
  onSave: (data: FormState) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [form, setForm] = useState<FormState>(initial);

  const addOpportunity = () => setForm(f => ({ ...f, opportunities: [...f.opportunities, ""] }));
  const removeOpportunity = (i: number) =>
    setForm(f => ({ ...f, opportunities: f.opportunities.filter((_, idx) => idx !== i) }));
  const updateOpportunity = (i: number, val: string) =>
    setForm(f => ({ ...f, opportunities: f.opportunities.map((o, idx) => idx === i ? val : o) }));

  const toggleBt = (bt: string) =>
    setForm(f => ({
      ...f,
      relatedBusinessTypes: f.relatedBusinessTypes.includes(bt)
        ? f.relatedBusinessTypes.filter(b => b !== bt)
        : [...f.relatedBusinessTypes, bt],
    }));

  const handleSubmit = () => {
    if (!form.name.trim()) { toast.error("اسم الموسم مطلوب"); return; }
    if (!form.startDate.match(/^\d{2}-\d{2}$/)) { toast.error("تاريخ البداية يجب أن يكون بصيغة MM-DD"); return; }
    if (!form.endDate.match(/^\d{2}-\d{2}$/)) { toast.error("تاريخ النهاية يجب أن يكون بصيغة MM-DD"); return; }
    const validOpps = form.opportunities.filter(o => o.trim());
    if (validOpps.length === 0) { toast.error("أضف فرصة تسويقية واحدة على الأقل"); return; }
    onSave({ ...form, opportunities: validOpps });
  };

  return (
    <div
      className="rounded-2xl border p-5 space-y-5"
      style={{ background: "oklch(0.10 0.015 240)", borderColor: "oklch(0.25 0.02 240)" }}
    >
      <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-amber-400" />
        {initial.name ? "تعديل الموسم" : "إضافة موسم جديد"}
      </h3>

      {/* الاسم والأيقونة واللون */}
      <div className="grid grid-cols-1 gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">اسم الموسم *</label>
          <input
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="مثال: شهر رمضان المبارك"
            className="w-full px-3 py-2 rounded-xl text-sm border border-border bg-background text-foreground focus:outline-none focus:border-primary"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">تاريخ البداية (MM-DD) *</label>
            <input
              value={form.startDate}
              onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
              placeholder="مثال: 03-01"
              maxLength={5}
              className="w-full px-3 py-2 rounded-xl text-sm border border-border bg-background text-foreground focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">تاريخ النهاية (MM-DD) *</label>
            <input
              value={form.endDate}
              onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
              placeholder="مثال: 03-30"
              maxLength={5}
              className="w-full px-3 py-2 rounded-xl text-sm border border-border bg-background text-foreground focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">السنة (اتركه فارغاً للتكرار السنوي)</label>
            <input
              type="number"
              value={form.year ?? ""}
              onChange={e => setForm(f => ({ ...f, year: e.target.value ? Number(e.target.value) : null }))}
              placeholder="مثال: 2026"
              className="w-full px-3 py-2 rounded-xl text-sm border border-border bg-background text-foreground focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">الأولوية (1 = أعلى)</label>
            <input
              type="number"
              min={1}
              max={10}
              value={form.priority}
              onChange={e => setForm(f => ({ ...f, priority: Number(e.target.value) }))}
              className="w-full px-3 py-2 rounded-xl text-sm border border-border bg-background text-foreground focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* الأيقونة واللون */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">الأيقونة</label>
            <div className="flex flex-wrap gap-1.5">
              {ICONS.map(icon => (
                <button
                  key={icon}
                  onClick={() => setForm(f => ({ ...f, icon }))}
                  className="w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-all"
                  style={{
                    background: form.icon === icon ? "oklch(0.25 0.05 240)" : "oklch(0.15 0.015 240)",
                    border: form.icon === icon ? "2px solid oklch(0.55 0.15 240)" : "1px solid oklch(0.2 0.02 240)",
                  }}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">اللون</label>
            <div className="flex flex-wrap gap-1.5">
              {COLORS.map(c => (
                <button
                  key={c.value}
                  onClick={() => setForm(f => ({ ...f, color: c.value }))}
                  className="w-7 h-7 rounded-full transition-all"
                  style={{
                    background: c.value,
                    outline: form.color === c.value ? `3px solid ${c.value}` : "none",
                    outlineOffset: "2px",
                  }}
                  title={c.label}
                />
              ))}
            </div>
          </div>
        </div>

        {/* الوصف */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">وصف الموسم (اختياري)</label>
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="وصف مختصر للموسم وأهميته التسويقية..."
            rows={2}
            className="w-full px-3 py-2 rounded-xl text-sm border border-border bg-background text-foreground resize-none focus:outline-none focus:border-primary"
          />
        </div>
        {/* نص الإلحاح في التقرير */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">🚨 نص الإلحاح في التقرير (اختياري)</label>
          <input
            value={form.urgencyText}
            onChange={e => setForm(f => ({ ...f, urgencyText: e.target.value }))}
            placeholder="مثال: الموسم الأعلى إنفاقاً — الوقت المثالي لإطلاق عروض الإفطار..."
            className="w-full px-3 py-2 rounded-xl text-sm border border-border bg-background text-foreground focus:outline-none focus:border-primary"
          />
        </div>
        {/* نصيحة التقرير */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">💡 نصيحة التقرير (اختياري)</label>
          <textarea
            value={form.tipText}
            onChange={e => setForm(f => ({ ...f, tipText: e.target.value }))}
            placeholder="نصيحة تفصيلية تظهر في التقرير للعميل..."
            rows={3}
            className="w-full px-3 py-2 rounded-xl text-sm border border-border bg-background text-foreground resize-none focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* الفرص التسويقية */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-amber-400" />
            الفرص التسويقية *
          </label>
          <button
            onClick={addOpportunity}
            className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg transition-all"
            style={{ background: "oklch(0.18 0.02 240)", color: "oklch(0.65 0.15 240)" }}
          >
            <Plus className="w-3 h-3" /> إضافة فرصة
          </button>
        </div>
        <div className="space-y-2">
          {form.opportunities.map((opp, i) => (
            <div key={i} className="flex gap-2">
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-2"
                style={{ background: `${form.color}25`, color: form.color }}
              >
                {i + 1}
              </span>
              <input
                value={opp}
                onChange={e => updateOpportunity(i, e.target.value)}
                placeholder={`فرصة تسويقية ${i + 1}...`}
                className="flex-1 px-3 py-2 rounded-xl text-sm border border-border bg-background text-foreground focus:outline-none focus:border-primary"
              />
              {form.opportunities.length > 1 && (
                <button
                  onClick={() => removeOpportunity(i)}
                  className="p-2 rounded-lg text-muted-foreground hover:text-red-400 transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* أنواع الأنشطة */}
      <div>
        <label className="text-xs font-semibold text-foreground mb-2 block flex items-center gap-1.5">
          <Tag className="w-3 h-3 text-muted-foreground" />
          أنواع الأنشطة المرتبطة
          <span className="text-muted-foreground font-normal">(اتركه فارغاً ليشمل الكل)</span>
        </label>
        <div className="flex flex-wrap gap-1.5">
          {BUSINESS_TYPES.map(bt => (
            <button
              key={bt}
              onClick={() => toggleBt(bt)}
              className="text-xs px-2.5 py-1 rounded-full transition-all"
              style={
                form.relatedBusinessTypes.includes(bt)
                  ? { background: `${form.color}25`, color: form.color, border: `1px solid ${form.color}60` }
                  : { background: "oklch(0.15 0.015 240)", color: "oklch(0.55 0.01 240)", border: "1px solid oklch(0.22 0.02 240)" }
              }
            >
              {bt}
            </button>
          ))}
        </div>
      </div>

      {/* أزرار الحفظ */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={handleSubmit}
          disabled={isLoading}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{ background: form.color, color: "white", opacity: isLoading ? 0.7 : 1 }}
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          حفظ الموسم
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2.5 rounded-xl text-sm transition-all border border-border text-muted-foreground hover:text-foreground"
        >
          إلغاء
        </button>
      </div>
    </div>
  );
}

// ===== الصفحة الرئيسية =====
export default function Seasons() {
  const [showForm, setShowForm] = useState(false);
  const [editingSeason, setEditingSeason] = useState<any | null>(null);
  const utils = trpc.useUtils();

  const { data: seasons = [], isLoading } = trpc.seasons.list.useQuery();
  const createMutation = trpc.seasons.create.useMutation({
    onSuccess: () => { toast.success("تم إضافة الموسم بنجاح"); utils.seasons.list.invalidate(); setShowForm(false); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.seasons.update.useMutation({
    onSuccess: () => { toast.success("تم تحديث الموسم"); utils.seasons.list.invalidate(); setEditingSeason(null); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.seasons.delete.useMutation({
    onSuccess: () => { toast.success("تم حذف الموسم"); utils.seasons.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const seedMutation = trpc.seasons.seedDefaults.useMutation({
    onSuccess: (r) => { toast.success(r.message); utils.seasons.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const handleSave = (data: FormState) => {
    const payload = {
      ...data,
      opportunities: data.opportunities.filter(o => o.trim()),
      relatedBusinessTypes: data.relatedBusinessTypes.length > 0 ? data.relatedBusinessTypes : null,
      description: data.description || null,
      year: data.year || null,
      urgencyText: data.urgencyText || null,
      tipText: data.tipText || null,
    };
    if (editingSeason) {
      updateMutation.mutate({ id: editingSeason.id, ...payload });
    } else {
      createMutation.mutate(payload as any);
    }
  };

  const handleToggle = (season: any) => {
    updateMutation.mutate({ id: season.id, isActive: !season.isActive });
  };

  const handleDelete = (id: number) => {
    if (confirm("هل أنت متأكد من حذف هذا الموسم؟")) {
      deleteMutation.mutate({ id });
    }
  };

  const startEdit = (season: any) => {
    setEditingSeason(season);
    setShowForm(false);
  };

  // حساب الموسم النشط حالياً
  const today = new Date();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const todayStr = `${mm}-${dd}`;
  const activeSeasonsNow = seasons.filter(s =>
    s.isActive && todayStr >= s.startDate && todayStr <= s.endDate
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            🌙 المواسم التسويقية
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            ربط الفرص التسويقية بالمواسم لتعزيز التقارير وتنبيه العملاء
          </p>
        </div>
        <div className="flex gap-2">
          {seasons.length === 0 && (
            <button
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{ background: "oklch(0.18 0.02 240)", color: "oklch(0.65 0.15 240)", border: "1px solid oklch(0.25 0.02 240)" }}
            >
              {seedMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              إضافة مواسم سعودية افتراضية
            </button>
          )}
          <button
            onClick={() => { setShowForm(true); setEditingSeason(null); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{ background: "oklch(0.55 0.2 240)", color: "white" }}
          >
            <Plus className="w-4 h-4" />
            موسم جديد
          </button>
        </div>
      </div>

      {/* تنبيه المواسم النشطة */}
      {activeSeasonsNow.length > 0 && (
        <div
          className="rounded-2xl p-4 flex items-start gap-3"
          style={{ background: "oklch(0.65 0.18 60 / 0.1)", border: "1px solid oklch(0.65 0.18 60 / 0.3)" }}
        >
          <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "oklch(0.65 0.18 60)" }} />
          <div>
            <div className="text-sm font-bold" style={{ color: "oklch(0.75 0.18 60)" }}>
              {activeSeasonsNow.length === 1
                ? `موسم "${activeSeasonsNow[0].name}" نشط الآن`
                : `${activeSeasonsNow.length} مواسم نشطة الآن`}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              ستظهر الفرص الموسمية تلقائياً في تقارير العملاء المرتبطة بهذه المواسم
            </div>
          </div>
        </div>
      )}

      {/* نموذج الإضافة */}
      {showForm && (
        <SeasonForm
          initial={emptyForm}
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
          isLoading={createMutation.isPending}
        />
      )}

      {/* نموذج التعديل */}
      {editingSeason && (
        <SeasonForm
          initial={{
            name: editingSeason.name,
            startDate: editingSeason.startDate,
            endDate: editingSeason.endDate,
            year: editingSeason.year ?? null,
            opportunities: (editingSeason.opportunities as string[]) || [""],
            relatedBusinessTypes: (editingSeason.relatedBusinessTypes as string[]) || [],
            description: editingSeason.description || "",
            color: editingSeason.color || "#f59e0b",
            icon: editingSeason.icon || "🌙",
            isActive: editingSeason.isActive ?? true,
            priority: editingSeason.priority ?? 5,
            urgencyText: editingSeason.urgency_text || "",
            tipText: editingSeason.tip_text || "",
          }}
          onSave={handleSave}
          onCancel={() => setEditingSeason(null)}
          isLoading={updateMutation.isPending}
        />
      )}

      {/* قائمة المواسم */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin ml-2" />
          جاري التحميل...
        </div>
      ) : seasons.length === 0 ? (
        <div
          className="rounded-2xl p-10 text-center border border-dashed"
          style={{ borderColor: "oklch(0.25 0.02 240)" }}
        >
          <div className="text-4xl mb-3">🌙</div>
          <div className="font-bold text-foreground mb-1">لا توجد مواسم بعد</div>
          <div className="text-sm text-muted-foreground mb-4">
            أضف مواسم تسويقية لربطها بالتقارير وتنبيه العملاء بالفرص القادمة
          </div>
          <button
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{ background: "oklch(0.55 0.2 240)", color: "white" }}
          >
            {seedMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            إضافة المواسم السعودية الافتراضية
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {seasons.map(season => (
            <SeasonCard
              key={season.id}
              season={season}
              onEdit={() => startEdit(season)}
              onDelete={() => handleDelete(season.id)}
              onToggle={() => handleToggle(season)}
            />
          ))}
        </div>
      )}

      {/* ملاحظة توضيحية */}
      {seasons.length > 0 && (
        <div
          className="rounded-xl p-3 flex items-start gap-2 text-xs"
          style={{ background: "oklch(0.12 0.015 240)", border: "1px solid oklch(0.2 0.02 240)" }}
        >
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-muted-foreground" />
          <span className="text-muted-foreground">
            المواسم المرتبطة بأنواع أنشطة محددة ستظهر فقط في تقارير تلك الأنشطة.
            المواسم بدون تحديد نوع النشاط ستظهر في جميع التقارير.
            يتم تحديد الموسم النشط تلقائياً بناءً على التاريخ الحالي.
          </span>
        </div>
      )}
    </div>
  );
}
