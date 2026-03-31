import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Map, Plus, CheckCircle, Clock, Play, Trash2, Edit2, X, Save } from "lucide-react";
import { toast } from "sonner";

const statusLabels: Record<string, { label: string; color: string; bg: string }> = {
  not_started: { label: "لم تُبدأ", color: "oklch(0.55 0.01 240)", bg: "oklch(0.18 0.02 240)" },
  in_progress: { label: "قيد التنفيذ", color: "oklch(0.85 0.16 75)", bg: "oklch(0.78 0.16 75 / 0.15)" },
  completed: { label: "مكتملة", color: "oklch(0.75 0.18 145)", bg: "oklch(0.65 0.18 145 / 0.15)" },
};

const regions = ["الرياض", "جدة", "مكة المكرمة", "المدينة المنورة", "المنطقة الشرقية", "القصيم", "حائل", "تبوك", "عسير", "نجران", "جازان", "الجوف", "الحدود الشمالية", "الباحة"];

export default function Zones() {
  const { data: zones, isLoading, refetch } = trpc.zones.list.useQuery();
  const seedZones = trpc.zones.seed.useMutation();
  const createZone = trpc.zones.create.useMutation();
  const updateZone = trpc.zones.update.useMutation();
  const deleteZone = trpc.zones.delete.useMutation();
  const utils = trpc.useUtils();

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [filterRegion, setFilterRegion] = useState<string>("all");
  const [form, setForm] = useState({ name: "", nameEn: "", region: "الرياض", targetLeads: 20 });
  const [editForm, setEditForm] = useState<any>({});

  const handleSeed = async () => {
    const result = await seedZones.mutateAsync();
    toast.success(result.message);
    utils.zones.list.invalidate();
  };

  const handleCreate = async () => {
    if (!form.name.trim()) { toast.error("اسم المنطقة مطلوب"); return; }
    await createZone.mutateAsync(form);
    toast.success("تم إنشاء المنطقة بنجاح");
    setShowAddForm(false);
    setForm({ name: "", nameEn: "", region: "الرياض", targetLeads: 20 });
    utils.zones.list.invalidate();
  };

  const handleStatusChange = async (id: number, status: "not_started" | "in_progress" | "completed") => {
    await updateZone.mutateAsync({ id, status });
    utils.zones.list.invalidate();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذه المنطقة؟")) return;
    await deleteZone.mutateAsync({ id });
    toast.success("تم حذف المنطقة");
    utils.zones.list.invalidate();
  };

  const handleEdit = (zone: any) => {
    setEditingId(zone.id);
    setEditForm({ name: zone.name, nameEn: zone.nameEn || "", region: zone.region, targetLeads: zone.targetLeads, notes: zone.notes || "" });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    await updateZone.mutateAsync({ id: editingId, ...editForm });
    toast.success("تم تحديث المنطقة");
    setEditingId(null);
    utils.zones.list.invalidate();
  };

  const filteredZones = filterRegion === "all" ? (zones ?? []) : (zones ?? []).filter(z => z.region === filterRegion);
  const uniqueRegions = Array.from(new Set((zones ?? []).map(z => z.region)));

  const stats = {
    total: zones?.length ?? 0,
    completed: zones?.filter(z => z.status === "completed").length ?? 0,
    inProgress: zones?.filter(z => z.status === "in_progress").length ?? 0,
    notStarted: zones?.filter(z => z.status === "not_started").length ?? 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">المناطق الجغرافية</h1>
          <p className="text-muted-foreground text-sm mt-1">إدارة شبكة التغطية الكثيفة للسعودية (20+ منطقة)</p>
        </div>
        <div className="flex items-center gap-2">
          {(zones?.length ?? 0) === 0 && (
            <button
              onClick={handleSeed}
              disabled={seedZones.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{ background: "oklch(0.78 0.16 75 / 0.15)", color: "var(--brand-gold)", border: "1px solid oklch(0.78 0.16 75 / 0.3)" }}
            >
              {seedZones.isPending ? "جاري الإنشاء..." : "إنشاء 22 منطقة تلقائياً"}
            </button>
          )}
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ background: "linear-gradient(135deg, oklch(0.65 0.18 200), oklch(0.55 0.15 200))" }}
          >
            <Plus className="w-4 h-4" />
            منطقة جديدة
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "الإجمالي", value: stats.total, color: "var(--brand-cyan)" },
          { label: "مكتملة", value: stats.completed, color: "var(--brand-green)" },
          { label: "قيد التنفيذ", value: stats.inProgress, color: "var(--brand-gold)" },
          { label: "لم تُبدأ", value: stats.notStarted, color: "oklch(0.55 0.01 240)" },
        ].map((s, i) => (
          <div key={i} className="rounded-xl p-3 border border-border text-center" style={{ background: "oklch(0.12 0.015 240)" }}>
            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="rounded-2xl p-5 border border-border" style={{ background: "oklch(0.12 0.015 240)", borderColor: "oklch(0.65 0.18 200 / 0.3)" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">إضافة منطقة جديدة</h3>
            <button onClick={() => setShowAddForm(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">اسم المنطقة *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl text-sm border border-border bg-background text-foreground focus:outline-none focus:border-primary"
                placeholder="مثال: شمال الرياض" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">الاسم بالإنجليزية</label>
              <input value={form.nameEn} onChange={e => setForm(f => ({ ...f, nameEn: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl text-sm border border-border bg-background text-foreground focus:outline-none focus:border-primary"
                placeholder="North Riyadh" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">المنطقة الإدارية</label>
              <select value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl text-sm border border-border bg-background text-foreground focus:outline-none focus:border-primary">
                {regions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">الهدف (عدد Leads)</label>
              <input type="number" value={form.targetLeads} onChange={e => setForm(f => ({ ...f, targetLeads: Number(e.target.value) }))}
                className="w-full px-3 py-2 rounded-xl text-sm border border-border bg-background text-foreground focus:outline-none focus:border-primary"
                min={1} max={100} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleCreate} disabled={createZone.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: "oklch(0.65 0.18 200)" }}>
              <Save className="w-4 h-4" />
              {createZone.isPending ? "جاري الحفظ..." : "حفظ"}
            </button>
            <button onClick={() => setShowAddForm(false)} className="px-4 py-2 rounded-xl text-sm text-muted-foreground border border-border hover:bg-white/5">إلغاء</button>
          </div>
        </div>
      )}

      {/* Filter */}
      {uniqueRegions.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setFilterRegion("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterRegion === "all" ? "text-white" : "text-muted-foreground border border-border hover:bg-white/5"}`}
            style={filterRegion === "all" ? { background: "oklch(0.65 0.18 200)" } : {}}>
            الكل ({zones?.length ?? 0})
          </button>
          {uniqueRegions.map(r => (
            <button key={r} onClick={() => setFilterRegion(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterRegion === r ? "text-white" : "text-muted-foreground border border-border hover:bg-white/5"}`}
              style={filterRegion === r ? { background: "oklch(0.65 0.18 200)" } : {}}>
              {r} ({zones?.filter(z => z.region === r).length ?? 0})
            </button>
          ))}
        </div>
      )}

      {/* Zones grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl p-4 border border-border animate-pulse" style={{ background: "oklch(0.12 0.015 240)", height: 140 }} />
          ))}
        </div>
      ) : filteredZones.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Map className="w-16 h-16 text-muted-foreground opacity-20" />
          <p className="text-muted-foreground">لا توجد مناطق</p>
          <button onClick={handleSeed} disabled={seedZones.isPending}
            className="px-4 py-2 rounded-xl text-sm font-medium"
            style={{ background: "oklch(0.65 0.18 200 / 0.15)", color: "var(--brand-cyan)", border: "1px solid oklch(0.65 0.18 200 / 0.3)" }}>
            إنشاء المناطق الافتراضية
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredZones.map((zone) => {
            const progress = Math.min(100, (zone.leadsCount / zone.targetLeads) * 100);
            const statusInfo = statusLabels[zone.status];
            const isEditing = editingId === zone.id;
            return (
              <div key={zone.id} className="rounded-2xl p-4 border border-border transition-all hover:border-opacity-50" style={{ background: "oklch(0.12 0.015 240)" }}>
                {isEditing ? (
                  <div className="space-y-3">
                    <input value={editForm.name} onChange={e => setEditForm((f: any) => ({ ...f, name: e.target.value }))}
                      className="w-full px-3 py-1.5 rounded-lg text-sm border border-border bg-background text-foreground focus:outline-none focus:border-primary" />
                    <select value={editForm.region} onChange={e => setEditForm((f: any) => ({ ...f, region: e.target.value }))}
                      className="w-full px-3 py-1.5 rounded-lg text-sm border border-border bg-background text-foreground focus:outline-none focus:border-primary">
                      {regions.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <button onClick={handleSaveEdit} className="flex-1 py-1.5 rounded-lg text-xs font-medium text-white" style={{ background: "oklch(0.65 0.18 200)" }}>حفظ</button>
                      <button onClick={() => setEditingId(null)} className="flex-1 py-1.5 rounded-lg text-xs border border-border text-muted-foreground hover:bg-white/5">إلغاء</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-foreground text-sm">{zone.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{zone.region}</p>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: statusInfo.bg, color: statusInfo.color }}>
                        {statusInfo.label}
                      </span>
                    </div>
                    <div className="mb-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">التقدم</span>
                        <span className="font-medium text-foreground">{zone.leadsCount}/{zone.targetLeads}</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "oklch(0.18 0.02 240)" }}>
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${progress}%`, background: zone.status === "completed" ? "oklch(0.65 0.18 145)" : "oklch(0.65 0.18 200)" }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {zone.status !== "in_progress" && (
                        <button onClick={() => handleStatusChange(zone.id, "in_progress")}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs transition-all"
                          style={{ background: "oklch(0.78 0.16 75 / 0.1)", color: "var(--brand-gold)", border: "1px solid oklch(0.78 0.16 75 / 0.2)" }}>
                          <Play className="w-3 h-3" /> ابدأ
                        </button>
                      )}
                      {zone.status !== "completed" && (
                        <button onClick={() => handleStatusChange(zone.id, "completed")}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs transition-all"
                          style={{ background: "oklch(0.65 0.18 145 / 0.1)", color: "var(--brand-green)", border: "1px solid oklch(0.65 0.18 145 / 0.2)" }}>
                          <CheckCircle className="w-3 h-3" /> أكمل
                        </button>
                      )}
                      {zone.status !== "not_started" && (
                        <button onClick={() => handleStatusChange(zone.id, "not_started")}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs transition-all"
                          style={{ background: "oklch(0.18 0.02 240)", color: "oklch(0.55 0.01 240)", border: "1px solid oklch(0.22 0.02 240)" }}>
                          <Clock className="w-3 h-3" /> إعادة
                        </button>
                      )}
                      <button onClick={() => handleEdit(zone)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(zone.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 transition-all" style={{ color: "var(--brand-red)" }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
