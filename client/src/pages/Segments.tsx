import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Layers, Plus, Pencil, Trash2, Users, Clock, ChevronRight,
  Search, UserPlus, X, CheckCircle2, Filter, Send,
} from "lucide-react";

// ===== أوقات الإرسال المثلى =====
const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = i % 12 === 0 ? 12 : i % 12;
  const period = i < 12 ? "ص" : "م";
  return { value: i, label: `${h} ${period}` };
});

type Segment = {
  id: number;
  name: string;
  description: string | null;
  color: string;
  optimalSendTimes: { day: number; hour: number; label: string }[] | null;
  filterCriteria: Record<string, unknown> | null;
  isActive: boolean;
  leadCount: number;
  createdAt: Date;
};

type Lead = {
  id: number;
  companyName: string;
  phone: string | null;
  city: string;
  businessType: string;
  hasWhatsapp: "yes" | "no" | "unknown";
};

export default function Segments() {
  const [selectedSegment, setSelectedSegment] = useState<Segment | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showAddLeadsDialog, setShowAddLeadsDialog] = useState(false);
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null);
  const [deletingSegment, setDeletingSegment] = useState<Segment | null>(null);

  // فلترة البحث في قائمة الشرائح
  const [searchQuery, setSearchQuery] = useState("");

  // نموذج إنشاء/تعديل الشريحة
  const [form, setForm] = useState({
    name: "",
    description: "",
    color: "#3b82f6",
    optimalSendTimes: [] as { day: number; hour: number; label: string }[],
  });

  // فلترة العملاء في dialog الإضافة
  const [leadsSearch, setLeadsSearch] = useState("");
  const [leadsCity, setLeadsCity] = useState("all");
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<number>>(new Set());

  // ===== Queries =====
  const { data: segmentsList, refetch: refetchList } = trpc.segments.list.useQuery();
  const { data: segmentDetail, refetch: refetchDetail } = trpc.segments.getById.useQuery(
    { id: selectedSegment?.id ?? 0 },
    { enabled: !!selectedSegment }
  );
  const { data: availableLeads } = trpc.segments.availableLeads.useQuery(
    {
      segmentId: selectedSegment?.id ?? 0,
      search: leadsSearch || undefined,
      city: leadsCity !== "all" ? leadsCity : undefined,
      limit: 100,
    },
    { enabled: showAddLeadsDialog && !!selectedSegment }
  );

  // ===== Mutations =====
  const createMutation = trpc.segments.create.useMutation({
    onSuccess: () => { toast.success("تم إنشاء الشريحة"); setShowCreateDialog(false); refetchList(); resetForm(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.segments.update.useMutation({
    onSuccess: () => { toast.success("تم تحديث الشريحة"); setShowEditDialog(false); refetchList(); refetchDetail(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.segments.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف الشريحة");
      setShowDeleteDialog(false);
      setSelectedSegment(null);
      refetchList();
    },
    onError: (e) => toast.error(e.message),
  });
  const addLeadsMutation = trpc.segments.addLeads.useMutation({
    onSuccess: (data) => {
      toast.success(`تمت إضافة ${data.added} عميل`);
      setShowAddLeadsDialog(false);
      setSelectedLeadIds(new Set());
      refetchDetail();
      refetchList();
    },
    onError: (e) => toast.error(e.message),
  });
  const removeLeadMutation = trpc.segments.removeLead.useMutation({
    onSuccess: () => { toast.success("تمت إزالة العميل من الشريحة"); refetchDetail(); refetchList(); },
    onError: (e) => toast.error(e.message),
  });

  // ===== Helpers =====
  const resetForm = () => setForm({ name: "", description: "", color: "#3b82f6", optimalSendTimes: [] });

  const openEdit = (seg: Segment) => {
    setEditingSegment(seg);
    setForm({
      name: seg.name,
      description: seg.description ?? "",
      color: seg.color,
      optimalSendTimes: seg.optimalSendTimes ?? [],
    });
    setShowEditDialog(true);
  };

  const toggleTime = (day: number, hour: number) => {
    const label = `${DAYS[day]} ${HOURS[hour].label}`;
    const exists = form.optimalSendTimes.some((t) => t.day === day && t.hour === hour);
    if (exists) {
      setForm((f) => ({ ...f, optimalSendTimes: f.optimalSendTimes.filter((t) => !(t.day === day && t.hour === hour)) }));
    } else {
      setForm((f) => ({ ...f, optimalSendTimes: [...f.optimalSendTimes, { day, hour, label }] }));
    }
  };

  const filteredSegments = useMemo(() =>
    (segmentsList ?? []).filter((s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase())
    ), [segmentsList, searchQuery]);

  const toggleLeadSelection = (id: number) => {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ===== Render =====
  return (
    <div className="flex h-full gap-0" dir="rtl">
      {/* ===== القائمة الجانبية =====  */}
      <div className="w-72 border-l border-border flex flex-col bg-card">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              الشرائح
            </h2>
            <Button size="sm" onClick={() => { resetForm(); setShowCreateDialog(true); }}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute right-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="بحث في الشرائح..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-9 text-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredSegments.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-8">
              لا توجد شرائح بعد
            </div>
          )}
          {filteredSegments.map((seg) => (
            <button
              key={seg.id}
              onClick={() => setSelectedSegment(seg)}
              className={`w-full text-right p-3 rounded-lg transition-colors flex items-center gap-3 ${
                selectedSegment?.id === seg.id
                  ? "bg-primary/10 border border-primary/30"
                  : "hover:bg-muted"
              }`}
            >
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: seg.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{seg.name}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Users className="w-3 h-3" />
                  {seg.leadCount} عميل
                  {(seg.optimalSendTimes ?? []).length > 0 && (
                    <>
                      <Clock className="w-3 h-3 mr-1" />
                      {(seg.optimalSendTimes ?? []).length} وقت
                    </>
                  )}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            </button>
          ))}
        </div>

        {/* إحصائيات سريعة */}
        <div className="p-3 border-t border-border">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-muted rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-primary">{segmentsList?.length ?? 0}</div>
              <div className="text-xs text-muted-foreground">شريحة</div>
            </div>
            <div className="bg-muted rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-green-500">
                {segmentsList?.reduce((s, x) => s + x.leadCount, 0) ?? 0}
              </div>
              <div className="text-xs text-muted-foreground">عميل مصنف</div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== المحتوى الرئيسي ===== */}
      <div className="flex-1 overflow-y-auto p-6">
        {!selectedSegment ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Layers className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-xl font-semibold text-muted-foreground mb-2">اختر شريحة</h3>
            <p className="text-muted-foreground text-sm max-w-sm">
              قسّم عملاءك إلى شرائح مستهدفة وحدد أوقات الإرسال المثلى لكل شريحة
            </p>
            <Button className="mt-4" onClick={() => { resetForm(); setShowCreateDialog(true); }}>
              <Plus className="w-4 h-4 ml-2" />
              إنشاء شريحة جديدة
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* رأس الصفحة */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-5 h-5 rounded-full"
                  style={{ backgroundColor: selectedSegment.color }}
                />
                <div>
                  <h1 className="text-2xl font-bold">{selectedSegment.name}</h1>
                  {selectedSegment.description && (
                    <p className="text-muted-foreground text-sm mt-0.5">{selectedSegment.description}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(selectedSegment)}>
                  <Pencil className="w-4 h-4 ml-1" /> تعديل
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => { setDeletingSegment(selectedSegment); setShowDeleteDialog(true); }}
                >
                  <Trash2 className="w-4 h-4 ml-1" /> حذف
                </Button>
              </div>
            </div>

            {/* إحصائيات */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-4 text-center">
                  <div className="text-3xl font-bold text-primary">{segmentDetail?.leads?.length ?? 0}</div>
                  <div className="text-sm text-muted-foreground mt-1">إجمالي العملاء</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <div className="text-3xl font-bold text-green-500">
                    {segmentDetail?.leads?.filter((l) => l.hasWhatsapp === "yes").length ?? 0}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">لديهم واتساب</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <div className="text-3xl font-bold text-amber-500">
                    {(selectedSegment.optimalSendTimes ?? []).length}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">أوقات الإرسال</div>
                </CardContent>
              </Card>
            </div>

            {/* أوقات الإرسال المثلى */}
            {(selectedSegment.optimalSendTimes ?? []).length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-500" />
                    أوقات الإرسال المثلى
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {(selectedSegment.optimalSendTimes ?? []).map((t, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {t.label}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* قائمة العملاء */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    عملاء الشريحة ({segmentDetail?.leads?.length ?? 0})
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setLeadsSearch("");
                        setLeadsCity("all");
                        setSelectedLeadIds(new Set());
                        setShowAddLeadsDialog(true);
                      }}
                    >
                      <UserPlus className="w-4 h-4 ml-1" />
                      إضافة عملاء
                    </Button>
                    {(segmentDetail?.leads?.length ?? 0) > 0 && (
                      <Button size="sm" asChild>
                        <a href={`/whatsapp?segmentId=${selectedSegment.id}`}>
                          <Send className="w-4 h-4 ml-1" />
                          إرسال للشريحة
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {(!segmentDetail?.leads || segmentDetail.leads.length === 0) ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">لا يوجد عملاء في هذه الشريحة بعد</p>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => { setLeadsSearch(""); setLeadsCity("all"); setSelectedLeadIds(new Set()); setShowAddLeadsDialog(true); }}
                    >
                      أضف عملاء الآن
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">اسم الشركة</TableHead>
                        <TableHead className="text-right">المدينة</TableHead>
                        <TableHead className="text-right">نوع النشاط</TableHead>
                        <TableHead className="text-right">واتساب</TableHead>
                        <TableHead className="text-right">تاريخ الإضافة</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {segmentDetail.leads.map((lead) => (
                        <TableRow key={lead.id}>
                          <TableCell className="font-medium">{lead.companyName}</TableCell>
                          <TableCell>{lead.city}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{lead.businessType}</TableCell>
                          <TableCell>
                            {lead.hasWhatsapp === "yes" ? (
                              <Badge className="bg-green-500/10 text-green-600 text-xs">✓ متاح</Badge>
                            ) : lead.hasWhatsapp === "no" ? (
                              <Badge variant="secondary" className="text-xs">غير متاح</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">غير محدد</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {new Date(lead.addedAt).toLocaleDateString("ar-SA")}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => removeLeadMutation.mutate({ segmentId: selectedSegment.id, leadId: lead.id })}
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* ===== Dialog إنشاء شريحة ===== */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>إنشاء شريحة جديدة</DialogTitle>
          </DialogHeader>
          <SegmentForm form={form} setForm={setForm} toggleTime={toggleTime} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>إلغاء</Button>
            <Button
              onClick={() => createMutation.mutate(form)}
              disabled={!form.name || createMutation.isPending}
            >
              {createMutation.isPending ? "جاري الإنشاء..." : "إنشاء"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Dialog تعديل شريحة ===== */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل الشريحة</DialogTitle>
          </DialogHeader>
          <SegmentForm form={form} setForm={setForm} toggleTime={toggleTime} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>إلغاء</Button>
            <Button
              onClick={() => editingSegment && updateMutation.mutate({ id: editingSegment.id, ...form })}
              disabled={!form.name || updateMutation.isPending}
            >
              {updateMutation.isPending ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Dialog حذف ===== */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            هل أنت متأكد من حذف شريحة <strong>{deletingSegment?.name}</strong>؟
            سيتم إزالة جميع العملاء من هذه الشريحة.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>إلغاء</Button>
            <Button
              variant="destructive"
              onClick={() => deletingSegment && deleteMutation.mutate({ id: deletingSegment.id })}
              disabled={deleteMutation.isPending}
            >
              حذف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Dialog إضافة عملاء ===== */}
      <Dialog open={showAddLeadsDialog} onOpenChange={setShowAddLeadsDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              إضافة عملاء إلى "{selectedSegment?.name}"
            </DialogTitle>
          </DialogHeader>

          {/* فلاتر البحث */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="بحث بالاسم أو الهاتف..."
                value={leadsSearch}
                onChange={(e) => setLeadsSearch(e.target.value)}
                className="pr-9"
              />
            </div>
            <Select value={leadsCity} onValueChange={setLeadsCity}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="المدينة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المدن</SelectItem>
                {["الرياض", "جدة", "مكة المكرمة", "المدينة المنورة", "الدمام", "الخبر", "تبوك", "أبها", "القصيم"].map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* قائمة العملاء */}
          <div className="flex-1 overflow-y-auto border rounded-lg">
            {!availableLeads || availableLeads.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                لا يوجد عملاء متاحون للإضافة
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead className="text-right">الشركة</TableHead>
                    <TableHead className="text-right">المدينة</TableHead>
                    <TableHead className="text-right">واتساب</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {availableLeads.map((lead: Lead) => (
                    <TableRow
                      key={lead.id}
                      className="cursor-pointer"
                      onClick={() => toggleLeadSelection(lead.id)}
                    >
                      <TableCell>
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          selectedLeadIds.has(lead.id)
                            ? "bg-primary border-primary"
                            : "border-muted-foreground"
                        }`}>
                          {selectedLeadIds.has(lead.id) && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-sm">{lead.companyName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{lead.city}</TableCell>
                      <TableCell>
                        {lead.hasWhatsapp === "yes" ? (
                          <span className="text-green-500 text-xs">✓</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-sm text-muted-foreground">
              {selectedLeadIds.size > 0 ? `تم اختيار ${selectedLeadIds.size} عميل` : "لم يتم اختيار أي عميل"}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowAddLeadsDialog(false)}>إلغاء</Button>
              <Button
                onClick={() => selectedSegment && addLeadsMutation.mutate({
                  segmentId: selectedSegment.id,
                  leadIds: Array.from(selectedLeadIds),
                })}
                disabled={selectedLeadIds.size === 0 || addLeadsMutation.isPending}
              >
                {addLeadsMutation.isPending ? "جاري الإضافة..." : `إضافة ${selectedLeadIds.size} عميل`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== مكوّن نموذج الشريحة =====
const FORM_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
];

function SegmentForm({
  form,
  setForm,
  toggleTime,
}: {
  form: { name: string; description: string; color: string; optimalSendTimes: { day: number; hour: number; label: string }[] };
  setForm: React.Dispatch<React.SetStateAction<typeof form>>;
  toggleTime: (day: number, hour: number) => void;
}) {
  const DAYS_LOCAL = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  const HOURS_DISPLAY = [
    { value: 8, label: "8 ص" }, { value: 9, label: "9 ص" }, { value: 10, label: "10 ص" },
    { value: 11, label: "11 ص" }, { value: 12, label: "12 م" }, { value: 13, label: "1 م" },
    { value: 14, label: "2 م" }, { value: 15, label: "3 م" }, { value: 16, label: "4 م" },
    { value: 17, label: "5 م" }, { value: 18, label: "6 م" }, { value: 19, label: "7 م" },
    { value: 20, label: "8 م" }, { value: 21, label: "9 م" },
  ];

  return (
    <div className="space-y-4" dir="rtl">
      <div>
        <label className="text-sm font-medium mb-1 block">اسم الشريحة *</label>
        <Input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="مثال: عملاء الرياض المهتمون"
        />
      </div>

      <div>
        <label className="text-sm font-medium mb-1 block">الوصف</label>
        <Input
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="وصف مختصر للشريحة"
        />
      </div>

      <div>
        <label className="text-sm font-medium mb-2 block">لون الشريحة</label>
        <div className="flex gap-2 flex-wrap">
          {FORM_COLORS.map((c: string) => (
            <button
              key={c}
              type="button"
              className={`w-7 h-7 rounded-full border-2 transition-transform ${
                form.color === c ? "border-foreground scale-110" : "border-transparent"
              }`}
              style={{ backgroundColor: c }}
              onClick={() => setForm((f) => ({ ...f, color: c }))}
            />
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium mb-2 block flex items-center gap-1">
          <Clock className="w-4 h-4" />
          أوقات الإرسال المثلى
          <span className="text-muted-foreground font-normal text-xs">(اختياري)</span>
        </label>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted">
                <th className="p-1.5 text-right font-medium">اليوم</th>
                {HOURS_DISPLAY.map((h) => (
                  <th key={h.value} className="p-1 text-center font-medium min-w-[32px]">{h.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS_LOCAL.map((day, dayIdx) => (
                <tr key={dayIdx} className="border-t">
                  <td className="p-1.5 font-medium text-muted-foreground">{day}</td>
                  {HOURS_DISPLAY.map((h) => {
                    const active = form.optimalSendTimes.some((t) => t.day === dayIdx && t.hour === h.value);
                    return (
                      <td key={h.value} className="p-0.5 text-center">
                        <button
                          type="button"
                          onClick={() => toggleTime(dayIdx, h.value)}
                          className={`w-6 h-6 rounded text-xs transition-colors ${
                            active
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-muted"
                          }`}
                        >
                          {active ? "✓" : ""}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {form.optimalSendTimes.length > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            تم اختيار {form.optimalSendTimes.length} وقت
          </p>
        )}
      </div>
    </div>
  );
}

