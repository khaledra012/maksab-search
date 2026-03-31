import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Link } from "wouter";
import {
  Plus, Search, Filter, Download, Trash2, Eye, Globe, Instagram, Phone, Mail,
  MapPin, ChevronDown, Layers, CheckSquare, Square, Zap,
  Loader2, Upload, AlertTriangle, ArrowRightLeft, UserCheck, Users, Send, MessageSquare,
  Target, FileText, CheckCircle2, Pencil, Clock, XCircle, FileDown, BrainCircuit,
} from "lucide-react";
import BulkImport from "./BulkImport";
import { BulkImportInline } from "./BulkImport";
import PhoneValidationDialog from "@/components/PhoneValidationDialog";
import { toast } from "sonner";
import { COUNTRIES_DATA } from "../../../shared/countries";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import QuickEditDrawer from "@/components/leads/QuickEditDrawer";

const statusColors: Record<string, { color: string; bg: string; label: string }> = {
  pending: { color: "oklch(0.55 0.01 240)", bg: "oklch(0.18 0.02 240)", label: "معلق" },
  analyzing: { color: "oklch(0.85 0.16 75)", bg: "oklch(0.78 0.16 75 / 0.15)", label: "جاري التحليل" },
  completed: { color: "oklch(0.75 0.18 145)", bg: "oklch(0.65 0.18 145 / 0.15)", label: "مُحلَّل" },
  failed: { color: "oklch(0.7 0.22 25)", bg: "oklch(0.58 0.22 25 / 0.15)", label: "فشل" },
};

// المراحل التي تعني "تم التواصل" أو ما بعدها
const CONTACTED_STAGES = ["contacted", "interested", "price_offer", "meeting", "won", "lost"];

export default function Leads() {
  const [search, setSearch] = useState("");
  const [filterCountry, setFilterCountry] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterZone, setFilterZone] = useState<number | undefined>();
  const [showFilters, setShowFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [filterWhatsapp, setFilterWhatsapp] = useState<"" | "yes" | "no" | "unknown">("")
  const [filterStage, setFilterStage] = useState("")
  const [filterPriority, setFilterPriority] = useState("");
  const [filterScoringPriority, setFilterScoringPriority] = useState<"" | "A" | "B" | "C" | "D">("");
  const [filterSentToWhatchimp, setFilterSentToWhatchimp] = useState<"" | "yes" | "no">("")
  const [filterContactedWhatchimp, setFilterContactedWhatchimp] = useState<"" | "sent" | "not_sent">("");
  const [showSegmentDialog, setShowSegmentDialog] = useState(false);
  const [targetSegmentId, setTargetSegmentId] = useState<string>("");
  const [showBulkImportDialog, setShowBulkImportDialog] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showMigrateConfirm, setShowMigrateConfirm] = useState(false);
  const [showWhatchimpMigrateDialog, setShowWhatchimpMigrateDialog] = useState(false);
  const [lastWhatchimpSentIds, setLastWhatchimpSentIds] = useState<number[]>([]);
  const [lastWhatchimpResult, setLastWhatchimpResult] = useState<{ success: number; skipped: number; failed: number } | null>(null);
  const [showBulkTemplateDialog, setShowBulkTemplateDialog] = useState(false);
  const [bulkSelectedTemplate, setBulkSelectedTemplate] = useState<string>("");
  const [showPhoneValidation, setShowPhoneValidation] = useState(false);
  const [pendingAction, setPendingAction] = useState<"contact" | "template" | null>(null);
  // التبويب النشط: "all" = قائمة العملاء الجديدة | "contacted" = تم التواصل | "deferred" = مؤجلين | "cancelled" = ملغي التواصل
  const [activeListTab, setActiveListTab] = useState<"all" | "contacted" | "deferred" | "cancelled">("all");
  const [quickEditLead, setQuickEditLead] = useState<NonNullable<typeof allLeads>[number] | null>(null);
  const [showQuickEdit, setShowQuickEdit] = useState(false);

  const availableFilterCities = filterCountry
    ? (COUNTRIES_DATA.find(c => c.name === filterCountry)?.cities ?? [])
    : [];

  // جلب كل العملاء بدون فلتر stage (نصفّي في الـ frontend)
  const { data: allLeads, isLoading } = trpc.leads.list.useQuery({
    search: search || undefined,
    city: filterCity || undefined,
    analysisStatus: filterStatus || undefined,
    zoneId: filterZone,
    hasWhatsapp: filterWhatsapp || undefined,
    priority: (filterPriority || undefined) as "high" | "medium" | "low" | undefined,
    sentToWhatchimp: (filterSentToWhatchimp || undefined) as "yes" | "no" | undefined,
  });

  // تصفية حسب التبويب النشط
  const leads = (() => {
    if (!allLeads) return [];
    if (activeListTab === "contacted") {
      return allLeads.filter(l => CONTACTED_STAGES.includes((l as any).stage ?? ""));
    }
    if (activeListTab === "deferred") {
      return allLeads.filter(l => (l as any).stage === "deferred");
    }
    if (activeListTab === "cancelled") {
      return allLeads.filter(l => (l as any).stage === "cancelled");
    }
    // التبويب الرئيسي: العملاء الجدد (stage = new أو فارغ) - بدون deferred وcancelled
    return allLeads.filter(l => !CONTACTED_STAGES.includes((l as any).stage ?? "") && (l as any).stage !== "deferred" && (l as any).stage !== "cancelled");
  })();

  // تطبيق فلتر stage الإضافي داخل التبويب
  const filteredLeads = (() => {
    let result = filterStage ? leads.filter(l => (l as any).stage === filterStage) : leads;
    // فلتر Whatchimp في تبويب "تم التواصل"
    if (activeListTab === "contacted" && filterContactedWhatchimp === "sent") {
      result = result.filter(l => (l as any).sentToWhatchimp === true);
    } else if (activeListTab === "contacted" && filterContactedWhatchimp === "not_sent") {
      result = result.filter(l => !(l as any).sentToWhatchimp);
    }
    // فلتر أولوية التقييم (A/B/C/D)
    if (filterScoringPriority) {
      result = result.filter(l => (l as any).scoringPriority === filterScoringPriority);
    }
    return result;
  })();

  const { data: zones } = trpc.zones.list.useQuery();
  const { data: segmentsList } = trpc.segments.list.useQuery();
  const deleteLead = trpc.leads.delete.useMutation();
  const bulkDelete = trpc.leads.bulkDelete.useMutation({
    onSuccess: (data) => {
      toast.success(`✅ تم حذف ${data.deleted} عميل بنجاح`);
      setSelectedIds(new Set());
      setShowBulkDeleteConfirm(false);
      utils.leads.list.invalidate();
      utils.leads.stats.invalidate();
    },
    onError: (e) => toast.error("فشل الحذف: " + e.message),
  });
  const bulkUpdateStage = trpc.leads.bulkUpdateStage.useMutation({
    onSuccess: (data) => {
      toast.success(`✅ تم ترحيل ${data.updated} عميل إلى قائمة "تم التواصل"`);
      setSelectedIds(new Set());
      setShowMigrateConfirm(false);
      utils.leads.list.invalidate();
      utils.leads.stats.invalidate();
    },
    onError: (e) => toast.error("فشل الترحيل: " + e.message),
  });
  const bulkReturnToNew = trpc.leads.bulkUpdateStage.useMutation({
    onSuccess: (data) => {
      toast.success(`✅ تم إرجاع ${data.updated} عميل للقائمة الرئيسية`);
      setSelectedIds(new Set());
      utils.leads.list.invalidate();
      utils.leads.stats.invalidate();
    },
    onError: (e) => toast.error("فشل الإرجاع: " + e.message),
  });
  const bulkMoveDeferred = trpc.leads.bulkUpdateStage.useMutation({
    onSuccess: (data) => {
      toast.success(`⏸️ تم ترحيل ${data.updated} عميل إلى المؤجلين`);
      setSelectedIds(new Set());
      utils.leads.list.invalidate();
      utils.leads.stats.invalidate();
    },
    onError: (e) => toast.error("فشل الترحيل: " + e.message),
  });
  const bulkMoveCancelled = trpc.leads.bulkUpdateStage.useMutation({
    onSuccess: (data) => {
      toast.success(`🚫 تم ترحيل ${data.updated} عميل إلى ملغي التواصل`);
      setSelectedIds(new Set());
      utils.leads.list.invalidate();
      utils.leads.stats.invalidate();
    },
    onError: (e) => toast.error("فشل الترحيل: " + e.message),
  });
  const exportCSV = trpc.export.exportCSV.useMutation();
  const bulkGeneratePDF = trpc.pdfReport.generateBulk.useMutation({
    onSuccess: (data) => {
      toast.success(`تم إرسال ${data.queued} تقرير للتوليد في الخلفية`);
      setSelectedIds(new Set());
      setTimeout(() => utils.leads.list.invalidate(), 3000);
    },
    onError: (e) => toast.error("فشل توليد PDF: " + e.message),
  });
  // تحليل عميل واحد من القائمة
  const [analyzingLeadId, setAnalyzingLeadId] = useState<number | null>(null);
  const singleAnalyze = trpc.analysis.bulkAnalyze.useMutation({
    onSuccess: (data) => {
      toast.success(`تم إرسال العميل للتحليل في الخلفية`);
      setAnalyzingLeadId(null);
      setTimeout(() => utils.leads.list.invalidate(), 2000);
    },
    onError: (e) => { toast.error("فشل التحليل: " + e.message); setAnalyzingLeadId(null); },
  });
  // توليد PDF لعميل واحد من القائمة
  const [generatingPdfLeadId, setGeneratingPdfLeadId] = useState<number | null>(null);
  const singleGeneratePDF = trpc.pdfReport.generateAndSave.useMutation({
    onSuccess: (data) => {
      toast.success("تم توليد التقرير بنجاح");
      if (data.reportUrl) window.open(data.reportUrl, "_blank");
      setGeneratingPdfLeadId(null);
      setTimeout(() => utils.leads.list.invalidate(), 1000);
    },
    onError: (e) => { toast.error("فشل توليد PDF: " + e.message); setGeneratingPdfLeadId(null); },
  });
  const bulkAnalyze = trpc.analysis.bulkAnalyze.useMutation({
    onSuccess: (data) => {
      toast.success(`تم إرسال ${data.queued} عميل للتحليل في الخلفية`);
      setSelectedIds(new Set());
      setTimeout(() => utils.leads.list.invalidate(), 2000);
    },
    onError: (e) => toast.error("فشل التحليل: " + e.message),
  });
  const bulkSendTemplate = trpc.whatchimp.bulkSendTemplate.useMutation({
    onSuccess: (res) => {
      toast.success(`✅ تم إرسال Template لـ ${res.sent} عميل بنجاح (${res.skipped} تم تخطيه)`);
      setSelectedIds(new Set());
      setShowBulkTemplateDialog(false);
      setBulkSelectedTemplate("");
      utils.leads.list.invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });
  const { data: bulkTemplates, isLoading: bulkTemplatesLoading } = trpc.whatchimp.getTemplates.useQuery(
    undefined,
    { enabled: showBulkTemplateDialog }
  );
  const bulkSendPdfViaBot = trpc.whatchimp.bulkSendPdfViaBot.useMutation({
    onSuccess: (res) => {
      toast.success(`✅ تم إرسال PDF لـ ${res.sent} عميل (تم تخطي ${res.skipped})`);
      setSelectedIds(new Set());
      utils.leads.list.invalidate();
    },
    onError: (e: any) => toast.error("فشل إرسال PDF: " + e.message),
  });
  const bulkSendWhatchimp = trpc.whatchimp.sendBulk.useMutation({
    onSuccess: (res) => {
      const sentIds = Array.from(selectedIds);
      setLastWhatchimpSentIds(sentIds);
      setLastWhatchimpResult({ success: res.success, skipped: res.skipped, failed: res.failed ?? 0 });
      setSelectedIds(new Set());
      utils.leads.list.invalidate();
      if (res.success > 0) {
        setShowWhatchimpMigrateDialog(true);
      } else {
        toast.info(`Whatchimp: تم تخطي ${res.skipped} عميل (لا يوجد هاتف)`);
      }
    },
    onError: (e: any) => toast.error(e.message),
  });
  const { data: whatchimpConfigured } = trpc.whatchimp.isConfigured.useQuery();
  const addToSegment = trpc.segments.addLeads.useMutation({
    onSuccess: (data) => {
      toast.success(`تمت إضافة ${data.added} عميل للشريحة`);
      setShowSegmentDialog(false);
      setSelectedIds(new Set());
      setTargetSegmentId("");
    },
    onError: (e) => toast.error(e.message),
  });
  const utils = trpc.useUtils();

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف "${name}"؟`)) return;
    await deleteLead.mutateAsync({ id });
    toast.success("تم حذف العميل");
    utils.leads.list.invalidate();
    utils.leads.stats.invalidate();
  };

  const handleExport = async () => {
    toast.info("جاري تجهيز البيانات مع التحليل...");
    const result = await exportCSV.mutateAsync({ city: filterCity || undefined, analysisStatus: filterStatus || undefined, includeAnalysis: true });
    const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads_مع_تحليل_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`✅ تم تصدير ${result.count} سجل بالتحليل الكامل في صف واحد`);
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredLeads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredLeads.map((l) => l.id)));
    }
  };

  const handleAddToSegment = async () => {
    if (!targetSegmentId || selectedIds.size === 0) return;
    await addToSegment.mutateAsync({
      segmentId: Number(targetSegmentId),
      leadIds: Array.from(selectedIds),
    });
  };

  // عدد العملاء في كل تبويب
  const newCount = (allLeads ?? []).filter(l => !CONTACTED_STAGES.includes((l as any).stage ?? "") && (l as any).stage !== "deferred" && (l as any).stage !== "cancelled").length;
  const contactedCount = (allLeads ?? []).filter(l => CONTACTED_STAGES.includes((l as any).stage ?? "")).length;
  const deferredCount = (allLeads ?? []).filter(l => (l as any).stage === "deferred").length;
  const cancelledCount = (allLeads ?? []).filter(l => (l as any).stage === "cancelled").length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">قائمة العملاء</h1>
          <p className="text-muted-foreground text-sm mt-1">{allLeads?.length ?? 0} عميل مسجل</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {selectedIds.size > 0 && (
            <>
              {/* زر الترحيل — يظهر فقط في التبويب الرئيسي */}
              {activeListTab === "all" && (
                <button
                  onClick={() => setShowMigrateConfirm(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all"
                  style={{ background: "oklch(0.65 0.18 200 / 0.15)", color: "oklch(0.75 0.18 200)", border: "1px solid oklch(0.65 0.18 200 / 0.3)" }}
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  ترحيل {selectedIds.size} للمتواصَل معهم
                </button>
              )}
              {/* زر الإرجاع — يظهر فقط في تبويب "تم التواصل" أو "مؤجلين" أو "ملغي" */}
              {(activeListTab === "contacted" || activeListTab === "deferred" || activeListTab === "cancelled") && (
                <button
                  onClick={() => bulkReturnToNew.mutate({ ids: Array.from(selectedIds), stage: "new" })}
                  disabled={bulkReturnToNew.isPending}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all"
                  style={{ background: "oklch(0.78 0.16 75 / 0.15)", color: "oklch(0.85 0.16 75)", border: "1px solid oklch(0.78 0.16 75 / 0.3)" }}
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  {bulkReturnToNew.isPending ? "جاري الإرجاع..." : `إرجاع ${selectedIds.size} للقائمة الرئيسية`}
                </button>
              )}
              {/* زر ترحيل مؤجلين — يظهر في كل التبويبات عدا مؤجلين */}
              {activeListTab !== "deferred" && (
                <button
                  onClick={() => bulkMoveDeferred.mutate({ ids: Array.from(selectedIds), stage: "deferred" })}
                  disabled={bulkMoveDeferred.isPending}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all"
                  style={{ background: "oklch(0.75 0.15 55 / 0.15)", color: "oklch(0.85 0.15 55)", border: "1px solid oklch(0.75 0.15 55 / 0.3)" }}
                >
                  <Clock className="w-4 h-4" />
                  {bulkMoveDeferred.isPending ? "جاري الترحيل..." : `⏸️ مؤجلين (${selectedIds.size})`}
                </button>
              )}
              {/* زر ترحيل ملغي التواصل — يظهر في كل التبويبات عدا ملغي */}
              {activeListTab !== "cancelled" && (
                <button
                  onClick={() => bulkMoveCancelled.mutate({ ids: Array.from(selectedIds), stage: "cancelled" })}
                  disabled={bulkMoveCancelled.isPending}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all"
                  style={{ background: "oklch(0.58 0.22 25 / 0.15)", color: "oklch(0.75 0.18 25)", border: "1px solid oklch(0.58 0.22 25 / 0.3)" }}
                >
                  <XCircle className="w-4 h-4" />
                  {bulkMoveCancelled.isPending ? "جاري الترحيل..." : `🚫 ملغي التواصل (${selectedIds.size})`}
                </button>
              )}
              <button
                onClick={() => bulkAnalyze.mutate({ leadIds: Array.from(selectedIds) })}
                disabled={bulkAnalyze.isPending}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all"
                style={{ background: "oklch(0.85 0.16 75 / 0.15)", color: "oklch(0.85 0.16 75)", border: "1px solid oklch(0.85 0.16 75 / 0.3)" }}
              >
                <Zap className="w-4 h-4" />
                {bulkAnalyze.isPending ? "جاري التحليل..." : `تحليل ${selectedIds.size} عميل`}
              </button>
              <button
                onClick={() => bulkGeneratePDF.mutate({ leadIds: Array.from(selectedIds), reportType: "client_facing" })}
                disabled={bulkGeneratePDF.isPending}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all"
                style={{ background: "oklch(0.55 0.18 280 / 0.15)", color: "oklch(0.75 0.18 280)", border: "1px solid oklch(0.55 0.18 280 / 0.3)" }}
              >
                {bulkGeneratePDF.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                {bulkGeneratePDF.isPending ? "جاري توليد التقارير..." : `تقرير PDF لـ ${selectedIds.size}`}
              </button>
              <button
                onClick={() => setShowSegmentDialog(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all"
                style={{ background: "oklch(0.65 0.18 200 / 0.15)", color: "var(--brand-cyan)", border: "1px solid oklch(0.65 0.18 200 / 0.3)" }}
              >
                <Layers className="w-4 h-4" />
                إضافة {selectedIds.size} للشريحة
              </button>
              {whatchimpConfigured?.configured && (
                <>
                  <button
                    onClick={() => { setPendingAction("contact"); setShowPhoneValidation(true); }}
                    disabled={bulkSendWhatchimp.isPending}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all"
                    style={{ background: "oklch(0.55 0.2 145 / 0.15)", color: "oklch(0.65 0.2 145)", border: "1px solid oklch(0.55 0.2 145 / 0.3)" }}
                  >
                    {bulkSendWhatchimp.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {bulkSendWhatchimp.isPending ? "جاري الإرسال..." : `إرسال ${selectedIds.size} Contact`}
                  </button>
                  <button
                    onClick={() => { setPendingAction("template"); setShowPhoneValidation(true); }}
                    disabled={bulkSendTemplate.isPending}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all"
                    style={{ background: "oklch(0.55 0.2 250 / 0.15)", color: "oklch(0.65 0.2 250)", border: "1px solid oklch(0.55 0.2 250 / 0.3)" }}
                  >
                    {bulkSendTemplate.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                    {bulkSendTemplate.isPending ? "جاري الإرسال..." : `إرسال Template لـ ${selectedIds.size}`}
                  </button>
                  <button
                    onClick={() => bulkSendPdfViaBot.mutate({ leadIds: Array.from(selectedIds) })}
                    disabled={bulkSendPdfViaBot.isPending}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all"
                    style={{ background: "oklch(0.45 0.2 145 / 0.15)", color: "oklch(0.65 0.2 145)", border: "1px solid oklch(0.45 0.2 145 / 0.3)" }}
                  >
                    {bulkSendPdfViaBot.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                    {bulkSendPdfViaBot.isPending ? "جاري إرسال PDF..." : `إرسال PDF Bot لـ ${selectedIds.size}`}
                  </button>
                </>
              )}
              <button
                onClick={() => setShowBulkDeleteConfirm(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all"
                style={{ background: "oklch(0.58 0.22 25 / 0.15)", color: "oklch(0.7 0.22 25)", border: "1px solid oklch(0.58 0.22 25 / 0.3)" }}
              >
                <Trash2 className="w-4 h-4" />
                حذف {selectedIds.size} عميل
              </button>
            </>
          )}
          <button
            onClick={() => {
              const allIds = filteredLeads.map(l => l.id);
              setSelectedIds(new Set(allIds));
              setTimeout(() => bulkAnalyze.mutate({ leadIds: allIds }), 100);
            }}
            disabled={bulkAnalyze.isPending || !filteredLeads.length}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all"
            style={{ background: "oklch(0.85 0.16 75 / 0.1)", color: "oklch(0.85 0.16 75)", border: "1px solid oklch(0.85 0.16 75 / 0.25)" }}
          >
            {bulkAnalyze.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
            تحليل الكل ({filteredLeads.length})
          </button>
          <button
            onClick={handleExport}
            disabled={exportCSV.isPending || !allLeads?.length}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all"
            style={{ background: "oklch(0.65 0.18 145 / 0.1)", color: "var(--brand-green)", border: "1px solid oklch(0.65 0.18 145 / 0.25)" }}
          >
            <Download className="w-4 h-4" />
            تصدير CSV
          </button>
          <button
            onClick={() => setShowBulkImportDialog(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all"
            style={{ background: "oklch(0.65 0.18 75 / 0.1)", color: "oklch(0.85 0.16 75)", border: "1px solid oklch(0.65 0.18 75 / 0.25)" }}
          >
            <Upload className="w-4 h-4" />
            رفع جماعي
          </button>
          <Link href="/leads/add">
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-all"
              style={{ background: "linear-gradient(135deg, oklch(0.65 0.18 200), oklch(0.55 0.15 200))" }}>
              <Plus className="w-4 h-4" />
              إضافة Lead
            </button>
          </Link>
        </div>
      </div>

      {/* ===== تبويبات القائمة ===== */}
      <div className="flex items-center gap-1 p-1 rounded-xl border border-border" style={{ background: "oklch(0.10 0.015 240)", width: "fit-content" }}>
        <button
          onClick={() => { setActiveListTab("all"); setSelectedIds(new Set()); setFilterStage(""); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
          style={activeListTab === "all"
            ? { background: "oklch(0.65 0.18 200)", color: "white" }
            : { color: "oklch(0.6 0.01 240)" }}
        >
          <Users className="w-4 h-4" />
          العملاء الجدد
          <span className="px-1.5 py-0.5 rounded-full text-xs font-bold"
            style={activeListTab === "all"
              ? { background: "oklch(1 0 0 / 0.2)", color: "white" }
              : { background: "oklch(0.65 0.18 200 / 0.15)", color: "oklch(0.65 0.18 200)" }}>
            {newCount}
          </span>
        </button>
        <button
          onClick={() => { setActiveListTab("contacted"); setSelectedIds(new Set()); setFilterStage(""); setFilterContactedWhatchimp(""); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
          style={activeListTab === "contacted"
            ? { background: "oklch(0.65 0.18 145)", color: "white" }
            : { color: "oklch(0.6 0.01 240)" }}
        >
          <UserCheck className="w-4 h-4" />
          تم التواصل
          <span className="px-1.5 py-0.5 rounded-full text-xs font-bold"
            style={activeListTab === "contacted"
              ? { background: "oklch(1 0 0 / 0.2)", color: "white" }
              : { background: "oklch(0.65 0.18 145 / 0.15)", color: "oklch(0.65 0.18 145)" }}>
            {contactedCount}
          </span>
        </button>
        <button
          onClick={() => { setActiveListTab("deferred"); setSelectedIds(new Set()); setFilterStage(""); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
          style={activeListTab === "deferred"
            ? { background: "oklch(0.65 0.18 60)", color: "white" }
            : { color: "oklch(0.6 0.01 240)" }}
        >
          <Clock className="w-4 h-4" />
          مؤجلين
          <span className="px-1.5 py-0.5 rounded-full text-xs font-bold"
            style={activeListTab === "deferred"
              ? { background: "oklch(1 0 0 / 0.2)", color: "white" }
              : { background: "oklch(0.65 0.18 60 / 0.15)", color: "oklch(0.65 0.18 60)" }}>
            {deferredCount}
          </span>
        </button>
        <button
          onClick={() => { setActiveListTab("cancelled"); setSelectedIds(new Set()); setFilterStage(""); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
          style={activeListTab === "cancelled"
            ? { background: "oklch(0.55 0.2 25)", color: "white" }
            : { color: "oklch(0.6 0.01 240)" }}
        >
          <XCircle className="w-4 h-4" />
          ملغي التواصل
          <span className="px-1.5 py-0.5 rounded-full text-xs font-bold"
            style={activeListTab === "cancelled"
              ? { background: "oklch(1 0 0 / 0.2)", color: "white" }
              : { background: "oklch(0.55 0.2 25 / 0.15)", color: "oklch(0.55 0.2 25)" }}>
            {cancelledCount}
          </span>
        </button>
      </div>

      {/* فلتر سريع بأولوية التقييم A/B/C/D */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">أولوية التقييم:</span>
        {["", "A", "B", "C", "D"].map(p => {
          const labels: Record<string, string> = { "": "الكل", A: "أ ممتاز", B: "ب جيد", C: "ج متوسط", D: "د ضعيف" };
          const colors: Record<string, { active: string; bg: string }> = {
            "": { active: "oklch(0.65 0.18 200)", bg: "oklch(0.65 0.18 200 / 0.15)" },
            A: { active: "oklch(0.65 0.2 145)", bg: "oklch(0.65 0.2 145 / 0.15)" },
            B: { active: "oklch(0.65 0.18 200)", bg: "oklch(0.65 0.18 200 / 0.15)" },
            C: { active: "oklch(0.78 0.16 75)", bg: "oklch(0.78 0.16 75 / 0.15)" },
            D: { active: "oklch(0.58 0.22 25)", bg: "oklch(0.58 0.22 25 / 0.15)" },
          };
          const isActive = filterScoringPriority === p;
          const cfg = colors[p];
          return (
            <button key={p} onClick={() => setFilterScoringPriority(p as any)}
              className="text-xs px-2.5 py-1 rounded-full font-medium transition-all"
              style={isActive
                ? { background: cfg.bg, color: cfg.active, border: `1px solid ${cfg.active}` }
                : { background: "oklch(0.12 0.015 240)", color: "oklch(0.5 0.02 240)", border: "1px solid oklch(0.2 0.02 240)" }
              }>
              {labels[p]}
            </button>
          );
        })}
      </div>

      {/* Search & Filters */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="بحث باسم النشاط..."
              className="w-full pr-10 pl-4 py-2.5 rounded-xl text-sm border border-border bg-card text-foreground focus:outline-none focus:border-primary"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-all ${showFilters ? "text-white" : "text-muted-foreground border border-border hover:bg-white/5"}`}
            style={showFilters ? { background: "oklch(0.65 0.18 200)" } : {}}
          >
            <Filter className="w-4 h-4" />
            فلترة
            <ChevronDown className={`w-3 h-3 transition-transform ${showFilters ? "rotate-180" : ""}`} />
          </button>
        </div>
        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 rounded-xl border border-border" style={{ background: "oklch(0.12 0.015 240)" }}>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">الدولة</label>
              <select value={filterCountry} onChange={e => { setFilterCountry(e.target.value); setFilterCity(""); }}
                className="w-full px-3 py-2 rounded-lg text-sm border border-border bg-background text-foreground focus:outline-none">
                <option value="">كل الدول</option>
                {COUNTRIES_DATA.map(c => <option key={c.code} value={c.name}>{c.flag} {c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">المدينة</label>
              <select value={filterCity} onChange={e => setFilterCity(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm border border-border bg-background text-foreground focus:outline-none">
                <option value="">كل المدن</option>
                {availableFilterCities.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">حالة التحليل</label>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm border border-border bg-background text-foreground focus:outline-none">
                <option value="">الكل</option>
                <option value="pending">معلق</option>
                <option value="analyzing">جاري التحليل</option>
                <option value="completed">مُحلَّل</option>
                <option value="failed">فشل</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">المنطقة</label>
              <select value={filterZone ?? ""} onChange={e => setFilterZone(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-3 py-2 rounded-lg text-sm border border-border bg-background text-foreground focus:outline-none">
                <option value="">الكل</option>
                {zones?.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">واتساب</label>
              <select value={filterWhatsapp} onChange={e => setFilterWhatsapp(e.target.value as "" | "yes" | "no" | "unknown")}
                className="w-full px-3 py-2 rounded-lg text-sm border border-border bg-background text-foreground focus:outline-none">
                <option value="">الكل</option>
                <option value="yes">✅ واتساب فعّال</option>
                <option value="no">❌ ليس لديه واتساب</option>
                <option value="unknown">❓ غير محدد</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">مرحلة العميل</label>
              <select value={filterStage} onChange={e => setFilterStage(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm border border-border bg-background text-foreground focus:outline-none">
                <option value="">الكل</option>
                {activeListTab === "all" && <option value="new">جديد</option>}
                {activeListTab === "contacted" && (
                  <>
                    <option value="contacted">تم التواصل</option>
                    <option value="interested">مهتم</option>
                    <option value="price_offer">عرض سعر</option>
                    <option value="meeting">اجتماع</option>
                    <option value="won">عميل فعلي</option>
                    <option value="lost">خسرناه</option>
                  </>
                )}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">الأولوية</label>
              <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm border border-border bg-background text-foreground focus:outline-none">
                <option value="">الكل</option>
                <option value="high">عالية</option>
                <option value="medium">متوسطة</option>
                <option value="low">منخفضة</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">حالة Whatchimp</label>
              <select value={filterSentToWhatchimp} onChange={e => setFilterSentToWhatchimp(e.target.value as "" | "yes" | "no")}
                className="w-full px-3 py-2 rounded-lg text-sm border border-border bg-background text-foreground focus:outline-none">
                <option value="">الكل</option>
                <option value="yes">📤 أُرسل إلى Whatchimp</option>
                <option value="no">💭 لم يُرسَل بعد</option>
              </select>
            </div>
            {/* فلتر Whatchimp الخاص بتبويب "تم التواصل" */}
            {activeListTab === "contacted" && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">رد على Whatchimp</label>
                <select value={filterContactedWhatchimp} onChange={e => setFilterContactedWhatchimp(e.target.value as "" | "sent" | "not_sent")}
                  className="w-full px-3 py-2 rounded-lg text-sm border border-border bg-background text-foreground focus:outline-none"
                  style={{ borderColor: filterContactedWhatchimp ? "oklch(0.55 0.2 145 / 0.5)" : undefined }}>
                  <option value="">الكل</option>
                  <option value="sent">📤 أُرسل لـ Whatchimp</option>
                  <option value="not_sent">⏳ لم يُرسَل لـ Whatchimp</option>
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {filteredLeads.length > 0 && (
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl border border-border text-sm" style={{ background: "oklch(0.12 0.015 240)" }}>
          <button onClick={toggleSelectAll} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            {selectedIds.size === filteredLeads.length && filteredLeads.length > 0
              ? <CheckSquare className="w-4 h-4 text-primary" />
              : <Square className="w-4 h-4" />}
            تحديد الكل
          </button>
          {selectedIds.size > 0 && (
            <span className="text-muted-foreground">
              — تم تحديد <span className="text-foreground font-medium">{selectedIds.size}</span> عميل
            </span>
          )}
        </div>
      )}

      {/* Leads table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl animate-pulse border border-border" style={{ background: "oklch(0.12 0.015 240)" }} />
          ))}
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          {activeListTab === "contacted"
            ? <UserCheck className="w-16 h-16 text-muted-foreground opacity-20" />
            : <Search className="w-16 h-16 text-muted-foreground opacity-20" />}
          <p className="text-muted-foreground">
            {activeListTab === "contacted"
              ? "لا يوجد عملاء في قائمة التواصل بعد — رحّل عملاء من القائمة الرئيسية"
              : "لا توجد نتائج"}
          </p>
          {activeListTab === "all" && (
            <Link href="/leads/add">
              <button className="px-4 py-2 rounded-xl text-sm font-medium"
                style={{ background: "oklch(0.65 0.18 200 / 0.15)", color: "var(--brand-cyan)", border: "1px solid oklch(0.65 0.18 200 / 0.3)" }}>
                أضف أول Lead
              </button>
            </Link>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-border overflow-hidden" style={{ background: "oklch(0.12 0.015 240)" }}>
          {/* Table header */}
          <div className="grid grid-cols-12 gap-3 px-4 py-3 border-b border-border text-xs text-muted-foreground font-medium">
            <div className="col-span-1 flex items-center justify-center">
              <button onClick={toggleSelectAll} className="text-muted-foreground hover:text-foreground transition-colors">
                {selectedIds.size === filteredLeads.length && filteredLeads.length > 0
                  ? <CheckSquare className="w-4 h-4 text-primary" />
                  : <Square className="w-4 h-4" />}
              </button>
            </div>
            <div className="col-span-3">النشاط</div>
            <div className="col-span-2">المدينة / المنطقة</div>
            <div className="col-span-2">الاتصال</div>
            <div className="col-span-2">الحضور الرقمي</div>
            <div className="col-span-1">التشخيص</div>
            <div className="col-span-1 text-center">إجراء</div>
          </div>
          {/* Table rows */}
          <div className="divide-y divide-border">
            {filteredLeads.map((lead) => {
              const statusInfo = statusColors[lead.analysisStatus];
              const isSelected = selectedIds.has(lead.id);
              return (
                <div
                  key={lead.id}
                  className={`grid grid-cols-12 gap-3 px-4 py-3.5 items-center hover:bg-white/3 transition-colors group ${isSelected ? "bg-primary/5" : ""}`}
                >
                  {/* Checkbox */}
                  <div className="col-span-1 flex items-center justify-center">
                    <button onClick={() => toggleSelect(lead.id)} className="text-muted-foreground hover:text-foreground transition-colors">
                      {isSelected
                        ? <CheckSquare className="w-4 h-4 text-primary" />
                        : <Square className="w-4 h-4" />}
                    </button>
                  </div>
                  {/* Name & type */}
                  <div className="col-span-3 flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold"
                      style={{ background: "oklch(0.65 0.18 200 / 0.15)", color: "var(--brand-cyan)" }}>
                      {lead.companyName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-foreground truncate">{lead.companyName}</p>
                        {(lead as any).sentToWhatchimp && (
                          <span
                            title="تم الإرسال لـ Whatchimp"
                            className="flex-shrink-0 cursor-help inline-flex items-center justify-center w-4 h-4 rounded-full"
                            style={{ background: "oklch(0.45 0.18 145 / 0.2)", color: "oklch(0.65 0.18 145)" }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5">
                              <path d="M22 2L11 13" /><path d="M22 2L15 22l-4-9-9-4 20-7z" />
                            </svg>
                          </span>
                        )}
                        {(!lead.businessType || !lead.city) && (
                          <span
                            title={[
                              !lead.businessType ? "نوع النشاط غير محدد" : "",
                              !lead.city ? "المدينة غير محددة" : "",
                            ].filter(Boolean).join(" • ")}
                            className="flex-shrink-0 cursor-help"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" style={{ color: "oklch(0.75 0.18 60)" }} />
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {lead.businessType
                          ? <span className="text-xs text-muted-foreground truncate">{lead.businessType}</span>
                          : <span className="text-xs" style={{ color: "oklch(0.65 0.15 60)" }}>✕ نوع النشاط</span>
                        }
                        <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: statusInfo.bg, color: statusInfo.color }}>
                          {statusInfo.label}
                        </span>
                        {(lead as any).stage && (lead as any).stage !== "new" && (() => {
                          const stageColors: Record<string, string> = { contacted: "oklch(0.65 0.15 200)", interested: "oklch(0.65 0.18 145)", price_offer: "oklch(0.65 0.18 60)", meeting: "oklch(0.65 0.18 280)", won: "oklch(0.65 0.18 145)", lost: "oklch(0.55 0.18 25)" };
                          const stageLabels: Record<string, string> = { contacted: "تم التواصل", interested: "مهتم", price_offer: "عرض سعر", meeting: "اجتماع", won: "عميل فعلي", lost: "خسرناه" };
                          const c = stageColors[(lead as any).stage] ?? "oklch(0.65 0.05 240)";
                          return <span key="stage" className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: `color-mix(in oklch, ${c} 15%, transparent)`, color: c }}>{stageLabels[(lead as any).stage] ?? (lead as any).stage}</span>;
                        })()}
                        {(lead as any).priority === "high" && <span key="priority" className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "oklch(0.65 0.18 25 / 0.15)", color: "oklch(0.65 0.18 25)" }}>أولوية عالية</span>}
                      </div>
                    </div>
                  </div>
                  {/* City / Zone */}
                  <div className="col-span-2">
                    {lead.city
                      ? <p className="text-sm text-foreground">{lead.city}</p>
                      : <span className="text-xs flex items-center gap-1" style={{ color: "oklch(0.65 0.15 60)" }}><AlertTriangle className="w-3 h-3" />غير محددة</span>
                    }
                    {lead.zoneName && <p className="text-xs text-muted-foreground truncate">{lead.zoneName}</p>}
                  </div>
                  {/* Contact */}
                  <div className="col-span-2">
                    <div className="flex flex-col gap-0.5">
                      {lead.verifiedPhone ? (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="text-xs text-foreground font-mono">{lead.verifiedPhone}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">لا يوجد هاتف</span>
                      )}
                      {(lead as any).email && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="text-xs font-mono truncate max-w-[130px]" style={{ color: "oklch(0.75 0.18 200)" }} title={(lead as any).email}>{(lead as any).email}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Digital presence */}
                  <div className="col-span-2 flex items-center gap-2">
                    {lead.website && (
                      <a href={lead.website} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                        <Globe className="w-4 h-4 transition-colors" style={{ color: "var(--brand-cyan)" }} />
                      </a>
                    )}
                    {lead.instagramUrl && (
                      <a href={lead.instagramUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                        <Instagram className="w-4 h-4 transition-colors" style={{ color: "var(--brand-purple)" }} />
                      </a>
                    )}
                    {lead.googleMapsUrl && (
                      <a href={lead.googleMapsUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                        <MapPin className="w-4 h-4 transition-colors" style={{ color: "var(--brand-red)" }} />
                      </a>
                    )}
                    {!lead.website && !lead.instagramUrl && !lead.googleMapsUrl && (
                      <span className="text-xs text-muted-foreground">لا يوجد</span>
                    )}
                  </div>
                  {/* Diagnosis column */}
                  <div className="col-span-1 flex flex-col gap-1.5">
                    {/* Scoring Priority Badge (A/B/C/D) */}
                    {(() => {
                      const sp = (lead as any).scoringPriority;
                      const sv = (lead as any).scoringValue;
                      if (sp) {
                        const priorityConfig: Record<string, { bg: string; color: string; label: string }> = {
                          A: { bg: "oklch(0.65 0.2 145 / 0.2)", color: "oklch(0.65 0.2 145)", label: "أ ممتاز" },
                          B: { bg: "oklch(0.65 0.18 200 / 0.2)", color: "oklch(0.65 0.18 200)", label: "ب جيد" },
                          C: { bg: "oklch(0.78 0.16 75 / 0.2)", color: "oklch(0.78 0.16 75)", label: "ج متوسط" },
                          D: { bg: "oklch(0.58 0.22 25 / 0.2)", color: "oklch(0.58 0.22 25)", label: "د ضعيف" },
                        };
                        const cfg = priorityConfig[sp] ?? priorityConfig.C;
                        return (
                          <div className="flex items-center gap-1">
                            <span className="text-xs px-1.5 py-0.5 rounded-full font-bold" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                            {sv != null && <span className="text-xs font-bold" style={{ color: cfg.color }}>{sv}</span>}
                          </div>
                        );
                      }
                      // fallback: leadPriorityScore القديم
                      if ((lead as any).leadPriorityScore) {
                        const score = Number((lead as any).leadPriorityScore);
                        const c = score >= 70 ? "oklch(0.65 0.2 145)" : score >= 50 ? "oklch(0.78 0.16 75)" : "oklch(0.58 0.22 25)";
                        return (
                          <div className="flex items-center gap-1">
                            <Target className="w-2.5 h-2.5 flex-shrink-0" style={{ color: c }} />
                            <span className="text-xs font-bold" style={{ color: c }}>{score.toFixed(0)}</span>
                          </div>
                        );
                      }
                      return <span className="text-xs opacity-30 text-muted-foreground">لم يُقيَّم</span>;
                    })()}
                    {/* Readiness badge */}
                    {(lead as any).analysisReadyFlag ? (
                      <span className="text-xs px-1.5 py-0.5 rounded-full inline-flex items-center gap-1 w-fit" style={{ background: "oklch(0.65 0.2 145 / 0.15)", color: "oklch(0.65 0.2 145)" }}>
                        <CheckCircle2 className="w-2.5 h-2.5" />جاهز
                      </span>
                    ) : (lead as any).partialAnalysisFlag ? (
                      <span className="text-xs px-1.5 py-0.5 rounded-full inline-flex items-center gap-1 w-fit" style={{ background: "oklch(0.78 0.16 75 / 0.15)", color: "oklch(0.78 0.16 75)" }}>
                        <AlertTriangle className="w-2.5 h-2.5" />جزئي
                      </span>
                    ) : null}
                    {/* Brief indicator */}
                    {(lead as any).salesBriefGeneratedAt && (
                      <span className="text-xs inline-flex items-center gap-0.5" style={{ color: "oklch(0.65 0.18 200)" }}>
                        <FileText className="w-2.5 h-2.5" />brief
                      </span>
                    )}
                  </div>
                  {/* Actions */}
                  <div className="col-span-1 flex items-center justify-center gap-1">
                    <Link href={`/leads/${lead.id}`}>
                      <button className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all" title="عرض التفاصيل">
                        <Eye className="w-4 h-4" />
                      </button>
                    </Link>
                    {/* زر تحليل شامل */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setAnalyzingLeadId(lead.id);
                        singleAnalyze.mutate({ leadIds: [lead.id] });
                      }}
                      disabled={analyzingLeadId === lead.id || lead.analysisStatus === "analyzing"}
                      className="p-1.5 rounded-lg hover:bg-white/5 transition-all"
                      style={{ color: analyzingLeadId === lead.id ? "oklch(0.75 0.18 75)" : "oklch(0.65 0.15 280)" }}
                      title="تحليل شامل"
                    >
                      {analyzingLeadId === lead.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <BrainCircuit className="w-4 h-4" />
                      )}
                    </button>
                    {/* زر تحميل PDF */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if ((lead as any).pdfReportUrl) {
                          window.open((lead as any).pdfReportUrl, "_blank");
                        } else {
                          setGeneratingPdfLeadId(lead.id);
                          singleGeneratePDF.mutate({ leadId: lead.id, reportType: "client_facing" });
                        }
                      }}
                      disabled={generatingPdfLeadId === lead.id}
                      className="p-1.5 rounded-lg hover:bg-white/5 transition-all"
                      style={{ color: (lead as any).pdfReportUrl ? "oklch(0.75 0.18 280)" : "oklch(0.55 0.1 240)" }}
                      title={(lead as any).pdfReportUrl ? "تحميل التقرير" : "توليد تقرير PDF"}
                    >
                      {generatingPdfLeadId === lead.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <FileDown className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setQuickEditLead(lead); setShowQuickEdit(true); }}
                      className="p-1.5 rounded-lg hover:bg-white/5 transition-all opacity-0 group-hover:opacity-100"
                      style={{ color: "oklch(0.75 0.18 220)" }}
                      title="تعديل سريع"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(lead.id, lead.companyName)}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                      style={{ color: "var(--brand-red)" }}
                      title="حذف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== نافذة التعديل السريع ===== */}
      <QuickEditDrawer
        open={showQuickEdit}
        onOpenChange={(v) => { setShowQuickEdit(v); if (!v) setQuickEditLead(null); }}
        lead={quickEditLead}
      />

      {/* ===== نافذة مراجعة أرقام الواتساب ===== */}
      <PhoneValidationDialog
        open={showPhoneValidation}
        onOpenChange={(v) => { setShowPhoneValidation(v); if (!v) setPendingAction(null); }}
        leadIds={Array.from(selectedIds)}
        actionLabel={pendingAction === "template" ? "متابعة إرسال Template" : "متابعة إرسال Contact"}
        onConfirm={(validIds) => {
          if (validIds.length === 0) {
            toast.error("لا يوجد أرقام صالحة - تأكد من إدخال أرقام الهاتف للعملاء المحددين");
            setPendingAction(null);
            return;
          }
          if (pendingAction === "contact") {
            bulkSendWhatchimp.mutate({ leadIds: validIds });
          } else if (pendingAction === "template") {
            setShowBulkTemplateDialog(true);
          }
          setPendingAction(null);
        }}
      />

      {/* ===== نافذة تأكيد الترحيل ===== */}
      <Dialog open={showMigrateConfirm} onOpenChange={setShowMigrateConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5" style={{ color: "oklch(0.75 0.18 200)" }} />
              تأكيد الترحيل
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 text-center space-y-3">
            <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center"
              style={{ background: "oklch(0.65 0.18 200 / 0.15)", border: "2px solid oklch(0.65 0.18 200 / 0.3)" }}>
              <UserCheck className="w-8 h-8" style={{ color: "oklch(0.75 0.18 200)" }} />
            </div>
            <p className="text-base font-semibold">ترحيل {selectedIds.size} عميل إلى قائمة "تم التواصل"</p>
            <p className="text-sm text-muted-foreground">
              سيتم نقل هؤلاء العملاء من القائمة الرئيسية إلى قائمة "تم التواصل" مع الإبقاء على جميع بياناتهم.
              يمكنك إرجاعهم في أي وقت.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowMigrateConfirm(false)}
              disabled={bulkUpdateStage.isPending}>
              إلغاء
            </Button>
            <Button
              onClick={() => bulkUpdateStage.mutate({ ids: Array.from(selectedIds), stage: "contacted" })}
              disabled={bulkUpdateStage.isPending}
              style={{ background: "oklch(0.65 0.18 200)", color: "white" }}
            >
              {bulkUpdateStage.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin ml-2" /> جاري الترحيل...</>
              ) : (
                <><ArrowRightLeft className="w-4 h-4 ml-2" /> ترحيل {selectedIds.size} عميل</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog إضافة للشريحة */}
      <Dialog open={showSegmentDialog} onOpenChange={setShowSegmentDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>إضافة {selectedIds.size} عميل لشريحة</DialogTitle>
          </DialogHeader>
          <div className="py-3">
            <label className="text-sm text-muted-foreground mb-2 block">اختر الشريحة</label>
            <select
              value={targetSegmentId}
              onChange={e => setTargetSegmentId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm border border-border bg-background text-foreground focus:outline-none focus:border-primary"
            >
              <option value="">-- اختر شريحة --</option>
              {segmentsList?.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.leadCount} عميل)
                </option>
              ))}
            </select>
            {(!segmentsList || segmentsList.length === 0) && (
              <p className="text-xs text-muted-foreground mt-2">
                لا توجد شرائح بعد.{" "}
                <Link href="/segments">
                  <span className="text-primary cursor-pointer hover:underline">أنشئ شريحة أولاً</span>
                </Link>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSegmentDialog(false)}>إلغاء</Button>
            <Button
              onClick={handleAddToSegment}
              disabled={!targetSegmentId || addToSegment.isPending}
            >
              {addToSegment.isPending ? "جاري الإضافة..." : "إضافة للشريحة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== نافذة تأكيد الحذف الجماعي ===== */}
      <Dialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5" style={{ color: "oklch(0.7 0.22 25)" }} />
              تأكيد الحذف الجماعي
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 text-center space-y-3">
            <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center"
              style={{ background: "oklch(0.58 0.22 25 / 0.15)", border: "2px solid oklch(0.58 0.22 25 / 0.3)" }}>
              <Trash2 className="w-8 h-8" style={{ color: "oklch(0.7 0.22 25)" }} />
            </div>
            <p className="text-base font-semibold">هل أنت متأكد من حذف {selectedIds.size} عميل؟</p>
            <p className="text-sm text-muted-foreground">هذا الإجراء لا يمكن التراجع عنه. سيتم حذف جميع البيانات المرتبطة بهؤلاء العملاء نهائياً.</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowBulkDeleteConfirm(false)}
              disabled={bulkDelete.isPending}>
              إلغاء
            </Button>
            <Button
              onClick={() => bulkDelete.mutate({ ids: Array.from(selectedIds) })}
              disabled={bulkDelete.isPending}
              style={{ background: "oklch(0.58 0.22 25)", color: "white" }}
            >
              {bulkDelete.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin ml-2" /> جاري الحذف...</>
              ) : (
                <><Trash2 className="w-4 h-4 ml-2" /> حذف {selectedIds.size} عميل نهائياً</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== نافذة ترحيل بعد إرسال Whatchimp ===== */}
      <Dialog open={showWhatchimpMigrateDialog} onOpenChange={setShowWhatchimpMigrateDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" style={{ color: "oklch(0.65 0.2 145)" }} />
              تم الإرسال لـ Whatchimp ✔
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 text-center space-y-3">
            <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center"
              style={{ background: "oklch(0.55 0.2 145 / 0.15)", border: "2px solid oklch(0.55 0.2 145 / 0.3)" }}>
              <Send className="w-8 h-8" style={{ color: "oklch(0.65 0.2 145)" }} />
            </div>
            {lastWhatchimpResult && (
              <div className="space-y-1">
                <p className="text-base font-semibold">
                  تم إرسال <span style={{ color: "oklch(0.65 0.2 145)" }}>{lastWhatchimpResult.success}</span> عميل بنجاح
                </p>
                {lastWhatchimpResult.skipped > 0 && (
                  <p className="text-sm text-muted-foreground">تم تخطي {lastWhatchimpResult.skipped} (لا يوجد هاتف)</p>
                )}
                {lastWhatchimpResult.failed > 0 && (
                  <p className="text-sm" style={{ color: "oklch(0.7 0.22 25)" }}>فشل {lastWhatchimpResult.failed}</p>
                )}
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              هل تريد ترحيل هؤلاء العملاء إلى قائمة “تم التواصل” أيضاً؟
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => {
              setShowWhatchimpMigrateDialog(false);
              toast.success(`✅ Whatchimp: تم إرسال ${lastWhatchimpResult?.success ?? 0} عميل`);
            }}>
              لا، شكراً
            </Button>
            <Button
              onClick={() => {
                if (lastWhatchimpSentIds.length > 0) {
                  bulkUpdateStage.mutate({ ids: lastWhatchimpSentIds, stage: "contacted" });
                }
                setShowWhatchimpMigrateDialog(false);
              }}
              disabled={bulkUpdateStage.isPending}
              style={{ background: "oklch(0.65 0.18 200)", color: "white" }}
            >
              {bulkUpdateStage.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin ml-2" /> جاري...</>
              ) : (
                <><ArrowRightLeft className="w-4 h-4 ml-2" /> نعم، رحّلهم لـ "تم التواصل"</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== نافذة إرسال Template جماعي ===== */}
      <Dialog open={showBulkTemplateDialog} onOpenChange={setShowBulkTemplateDialog}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" style={{ color: "oklch(0.65 0.2 250)" }} />
              إرسال Template لـ {selectedIds.size} عميل
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              اختر الـ Template المعتمد وسيتم إرساله لجميع العملاء المحددين عبر WhatsApp
            </p>
            {bulkTemplatesLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                جاري تحميل الـ Templates...
              </div>
            ) : (
              <Select value={bulkSelectedTemplate} onValueChange={setBulkSelectedTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر Template..." />
                </SelectTrigger>
                <SelectContent>
                  {bulkTemplates?.map((t) => (
                    <SelectItem key={t.id} value={t.name}>
                      <div className="flex flex-col items-start gap-0.5">
                        <span className="font-medium">{t.name}</span>
                        {t.category && (
                          <span className="text-xs text-muted-foreground">{t.category}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                  {bulkTemplates?.length === 0 && (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      لا توجد templates معتمدة
                    </div>
                  )}
                </SelectContent>
              </Select>
            )}
            {bulkSelectedTemplate && (
              <div
                className="text-xs p-3 rounded-lg"
                style={{ background: "oklch(0.55 0.2 250 / 0.1)", border: "1px solid oklch(0.55 0.2 250 / 0.2)" }}
              >
                <p className="text-muted-foreground">
                  سيتم إرسال <strong className="text-foreground">{bulkSelectedTemplate}</strong> لـ <strong className="text-foreground">{selectedIds.size}</strong> عميل مع ملء بياناتهم تلقائياً.
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowBulkTemplateDialog(false); setBulkSelectedTemplate(""); }}>
              إلغاء
            </Button>
            <Button
              disabled={!bulkSelectedTemplate || bulkSendTemplate.isPending}
              onClick={() => bulkSendTemplate.mutate({
                leadIds: Array.from(selectedIds),
                templateName: bulkSelectedTemplate,
                languageCode: "ar",
              })}
              style={{ background: "oklch(0.55 0.2 250)", color: "white" }}
            >
              {bulkSendTemplate.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin ml-1" /> جاري الإرسال...</>
              ) : (
                <><MessageSquare className="w-4 h-4 ml-1" /> إرسال لـ {selectedIds.size} عميل</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== نافذة الرفع الجماعي (BulkImport Dialog) ===== */}
      <Dialog open={showBulkImportDialog} onOpenChange={setShowBulkImportDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" style={{ color: "oklch(0.85 0.16 75)" }} />
              رفع عملاء جماعي
            </DialogTitle>
          </DialogHeader>
          <BulkImportInline onClose={() => {
            setShowBulkImportDialog(false);
            utils.leads.list.invalidate();
            utils.leads.stats.invalidate();
          }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
