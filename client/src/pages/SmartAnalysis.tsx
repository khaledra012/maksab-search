/**
 * SmartAnalysis - صفحة التحليل الذكي الشامل
 * تجمع: التحليل القطاعي + التحليل الجماعي + تقارير PDF + إعدادات التأسيس
 */
import { useState, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  Brain,
  Zap,
  BarChart3,
  FileText,
  Play,
  Pause,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  Target,
  Layers,
  ChevronRight,
  Settings,
  X,
  Save,
  Download,
  Eye,
  ExternalLink,
} from "lucide-react";

const SECTOR_LABELS: Record<string, string> = {
  restaurants: "🍽️ مطاعم وكافيهات",
  medical: "🏥 طبي وصحي",
  ecommerce: "🛒 تجارة إلكترونية",
  digital_products: "💻 منتجات رقمية",
  general: "🏢 عام",
};

const LANGUAGE_MODES = [
  { value: "saudi_sales_tone", label: "🇸🇦 أسلوب بيعي سعودي" },
  { value: "msa_formal", label: "📝 عربي فصيح رسمي" },
  { value: "arabic_sales_brief", label: "⚡ مختصر بيعي" },
];

const URGENCY_COLORS: Record<string, string> = {
  high: "text-red-400 bg-red-500/10 border-red-500/30",
  medium: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
  low: "text-green-400 bg-green-500/10 border-green-500/30",
};

const URGENCY_LABELS: Record<string, string> = {
  high: "عاجل",
  medium: "متوسط",
  low: "منخفض",
};

export default function SmartAnalysis() {
  const [, navigate] = useLocation();
  const [selectedLanguageMode, setSelectedLanguageMode] = useState("saudi_sales_tone");
  const [selectedSector, setSelectedSector] = useState<string | undefined>(undefined);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState<number[]>([]);
  const [showSettings, setShowSettings] = useState(false);

  // Settings form state
  const [settingsForm, setSettingsForm] = useState({
    salesGoalMonthly: 50,
    primarySector: "general",
    communicationStyle: "professional" as "professional" | "friendly" | "direct" | "formal",
    targetCities: "",
    salesApproach: "sa_arabic" as "sa_arabic" | "gulf_arabic" | "msa_formal" | "english",
    reportLanguage: "arabic" as "arabic" | "english" | "bilingual",
    autoAnalyzeOnAdd: true,
    priorityThreshold: 7,
    customInstructions: "",
  });

  // Queries
  const bulkStats = trpc.bulkAnalysis.getBulkStats.useQuery(undefined, {
    refetchInterval: activeBatchId ? 2000 : 10000,
  });

  const sectorStats = trpc.sectorAnalysis.getSectorStats.useQuery();

  const unanalyzedLeads = trpc.bulkAnalysis.getUnanalyzedLeads.useQuery({
    limit: 50,
    sector: selectedSector as any,
  });

  const batchStatus = trpc.bulkAnalysis.getBatchStatus.useQuery(
    { batchId: activeBatchId! },
    {
      enabled: !!activeBatchId,
      refetchInterval: activeBatchId ? 1500 : false,
    }
  );

  const currentSettings = trpc.analysisSettings.get.useQuery();
  const analyzedLeads = trpc.pdfReport.listAnalyzedLeads.useQuery({ limit: 50 });

  // Load settings into form
  useEffect(() => {
    if (currentSettings.data) {
      setSettingsForm({
        salesGoalMonthly: currentSettings.data.salesGoalMonthly ?? 50,
        primarySector: currentSettings.data.primarySector ?? "general",
        communicationStyle: (currentSettings.data.communicationStyle as any) ?? "professional",
        targetCities: currentSettings.data.targetCities ?? "",
        salesApproach: (currentSettings.data.salesApproach as any) ?? "sa_arabic",
        reportLanguage: (currentSettings.data.reportLanguage as any) ?? "arabic",
        autoAnalyzeOnAdd: currentSettings.data.autoAnalyzeOnAdd ?? true,
        priorityThreshold: currentSettings.data.priorityThreshold ?? 7,
        customInstructions: currentSettings.data.customInstructions ?? "",
      });
    }
  }, [currentSettings.data]);

  // Mutations
  const startBatch = trpc.bulkAnalysis.startBatch.useMutation({
    onSuccess: (data) => {
      setActiveBatchId(data.batchId);
      toast.success(`بدأ تحليل ${data.total} عميل`);
      bulkStats.refetch();
    },
    onError: (err) => toast.error(`فشل بدء التحليل: ${err.message}`),
  });

  const pauseBatch = trpc.bulkAnalysis.pauseBatch.useMutation({
    onSuccess: () => toast.info("تم إيقاف التحليل مؤقتاً"),
  });

  const resumeBatch = trpc.bulkAnalysis.resumeBatch.useMutation({
    onSuccess: () => toast.success("تم استئناف التحليل"),
  });

  const analyzeAllPending = trpc.bulkAnalysis.analyzeAllPending.useMutation({
    onSuccess: (data) => {
      if (data.batchId) {
        setActiveBatchId(data.batchId);
        toast.success(data.message);
      } else {
        toast.info(data.message);
      }
      bulkStats.refetch();
    },
    onError: (err) => toast.error(`فشل: ${err.message}`),
  });

  const saveSettings = trpc.analysisSettings.save.useMutation({
    onSuccess: () => {
      toast.success("تم حفظ إعدادات التأسيس");
      setShowSettings(false);
      currentSettings.refetch();
    },
    onError: (err) => toast.error(`فشل حفظ الإعدادات: ${err.message}`),
  });

  const generatePdf = trpc.pdfReport.generateAndSave.useMutation({
    onSuccess: () => {
      toast.success("تم توليد التقرير");
      analyzedLeads.refetch();
    },
    onError: (err) => toast.error(`فشل توليد التقرير: ${err.message}`),
  });

  const handleStartSelected = useCallback(() => {
    if (selectedLeadIds.length === 0) {
      toast.error("اختر عملاء أولاً");
      return;
    }
    startBatch.mutate({ leadIds: selectedLeadIds, languageMode: selectedLanguageMode as any });
  }, [selectedLeadIds, selectedLanguageMode, startBatch]);

  const handleAnalyzeAll = useCallback(() => {
    analyzeAllPending.mutate({ languageMode: selectedLanguageMode as any, maxCount: 50 });
  }, [selectedLanguageMode, analyzeAllPending]);

  const toggleLeadSelection = (leadId: number) => {
    setSelectedLeadIds(prev =>
      prev.includes(leadId) ? prev.filter(id => id !== leadId) : [...prev, leadId]
    );
  };

  const selectAll = () => {
    const ids = unanalyzedLeads.data?.map(l => l.id) || [];
    setSelectedLeadIds(ids);
  };

  const clearSelection = () => setSelectedLeadIds([]);

  const handleSaveSettings = () => {
    saveSettings.mutate(settingsForm);
  };

  // Batch progress
  const batchProgress = batchStatus.data?.progress || 0;
  const isBatchRunning = batchStatus.data?.status === "running";
  const isBatchPaused = batchStatus.data?.status === "paused";
  const isBatchDone = batchStatus.data?.status === "completed";

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 flex items-center justify-center">
            <Brain className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">التحليل الذكي</h1>
            <p className="text-sm text-slate-400">تحليل قطاعي + جماعي + تقارير PDF</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedLanguageMode} onValueChange={setSelectedLanguageMode}>
            <SelectTrigger className="w-52 bg-slate-800/50 border-slate-700 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGE_MODES.map(m => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className={`border-slate-600 gap-2 ${showSettings ? "bg-cyan-600/20 border-cyan-500/50 text-cyan-400" : "text-slate-400"}`}
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings className="w-4 h-4" />
            إعدادات التأسيس
          </Button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <Card className="bg-slate-800/60 border-cyan-500/30 shadow-lg shadow-cyan-500/5">
          <CardHeader className="pb-3 border-b border-slate-700">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                <Settings className="w-4 h-4 text-cyan-400" />
                إعدادات التأسيس — تُمرَّر للـ AI في كل تحليل
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-400 hover:text-white"
                onClick={() => setShowSettings(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* هدف المبيعات */}
              <div className="space-y-2">
                <Label className="text-sm text-slate-300">🎯 هدف المبيعات الشهري (عدد العملاء)</Label>
                <Input
                  type="number"
                  min={1}
                  max={10000}
                  value={settingsForm.salesGoalMonthly}
                  onChange={e => setSettingsForm(prev => ({ ...prev, salesGoalMonthly: parseInt(e.target.value) || 50 }))}
                  className="bg-slate-900/50 border-slate-600 text-white"
                />
                <p className="text-xs text-slate-500">يُستخدم لضبط حدة التوصيات البيعية</p>
              </div>

              {/* القطاع الرئيسي */}
              <div className="space-y-2">
                <Label className="text-sm text-slate-300">🏢 القطاع الرئيسي المستهدف</Label>
                <Select
                  value={settingsForm.primarySector}
                  onValueChange={v => setSettingsForm(prev => ({ ...prev, primarySector: v }))}
                >
                  <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SECTOR_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* أسلوب التواصل */}
              <div className="space-y-2">
                <Label className="text-sm text-slate-300">💬 أسلوب التواصل المفضل</Label>
                <Select
                  value={settingsForm.communicationStyle}
                  onValueChange={v => setSettingsForm(prev => ({ ...prev, communicationStyle: v as any }))}
                >
                  <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">احترافي رسمي</SelectItem>
                    <SelectItem value="friendly">ودّي غير رسمي</SelectItem>
                    <SelectItem value="direct">مباشر وموجز</SelectItem>
                    <SelectItem value="formal">رسمي مؤسسي</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* أسلوب البيع */}
              <div className="space-y-2">
                <Label className="text-sm text-slate-300">🇸🇦 أسلوب البيع الإقليمي</Label>
                <Select
                  value={settingsForm.salesApproach}
                  onValueChange={v => setSettingsForm(prev => ({ ...prev, salesApproach: v as any }))}
                >
                  <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sa_arabic">سعودي عامي بيعي</SelectItem>
                    <SelectItem value="gulf_arabic">خليجي عام</SelectItem>
                    <SelectItem value="msa_formal">فصيح رسمي</SelectItem>
                    <SelectItem value="english">إنجليزي</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* لغة التقرير */}
              <div className="space-y-2">
                <Label className="text-sm text-slate-300">📄 لغة التقارير</Label>
                <Select
                  value={settingsForm.reportLanguage}
                  onValueChange={v => setSettingsForm(prev => ({ ...prev, reportLanguage: v as any }))}
                >
                  <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="arabic">عربي فقط</SelectItem>
                    <SelectItem value="english">إنجليزي فقط</SelectItem>
                    <SelectItem value="bilingual">ثنائي اللغة</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* حد الأولوية */}
              <div className="space-y-2">
                <Label className="text-sm text-slate-300">⚡ حد الأولوية العالية (1-10)</Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={settingsForm.priorityThreshold}
                    onChange={e => setSettingsForm(prev => ({ ...prev, priorityThreshold: parseInt(e.target.value) || 7 }))}
                    className="bg-slate-900/50 border-slate-600 text-white w-20"
                  />
                  <span className="text-xs text-slate-500">العملاء فوق هذا الحد = أولوية عالية</span>
                </div>
              </div>

              {/* المدن المستهدفة */}
              <div className="space-y-2 md:col-span-2">
                <Label className="text-sm text-slate-300">🗺️ المدن المستهدفة (مفصولة بفاصلة)</Label>
                <Input
                  value={settingsForm.targetCities}
                  onChange={e => setSettingsForm(prev => ({ ...prev, targetCities: e.target.value }))}
                  placeholder="الرياض، جدة، الدمام، مكة..."
                  className="bg-slate-900/50 border-slate-600 text-white"
                />
              </div>

              {/* تحليل تلقائي */}
              <div className="space-y-2 flex items-center gap-3">
                <Switch
                  checked={settingsForm.autoAnalyzeOnAdd}
                  onCheckedChange={v => setSettingsForm(prev => ({ ...prev, autoAnalyzeOnAdd: v }))}
                />
                <div>
                  <Label className="text-sm text-slate-300">تحليل تلقائي عند إضافة عميل</Label>
                  <p className="text-xs text-slate-500">يُشغّل التحليل فور الحفظ</p>
                </div>
              </div>

              {/* تعليمات مخصصة */}
              <div className="space-y-2 md:col-span-3">
                <Label className="text-sm text-slate-300">📝 تعليمات مخصصة للـ AI (اختياري)</Label>
                <Textarea
                  value={settingsForm.customInstructions}
                  onChange={e => setSettingsForm(prev => ({ ...prev, customInstructions: e.target.value }))}
                  placeholder="مثال: ركّز على خدمات السوشيال ميديا، تجنب ذكر المنافسين بالاسم، استخدم أمثلة من السوق السعودي..."
                  className="bg-slate-900/50 border-slate-600 text-white resize-none"
                  rows={3}
                  maxLength={2000}
                />
                <p className="text-xs text-slate-500">{settingsForm.customInstructions.length}/2000 حرف</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-slate-700">
              <Button
                variant="ghost"
                className="text-slate-400"
                onClick={() => setShowSettings(false)}
              >
                إلغاء
              </Button>
              <Button
                className="bg-cyan-600 hover:bg-cyan-700 gap-2"
                onClick={handleSaveSettings}
                disabled={saveSettings.isPending}
              >
                <Save className="w-4 h-4" />
                {saveSettings.isPending ? "جارٍ الحفظ..." : "حفظ الإعدادات"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Settings Summary Bar (when settings panel is closed) */}
      {!showSettings && currentSettings.data && (
        <div className="flex items-center gap-4 px-4 py-2 bg-slate-800/30 rounded-lg border border-slate-700/50 text-xs text-slate-400">
          <span>🎯 هدف: <span className="text-white">{currentSettings.data.salesGoalMonthly} عميل/شهر</span></span>
          <span>🏢 القطاع: <span className="text-white">{SECTOR_LABELS[currentSettings.data.primarySector ?? "general"] || "عام"}</span></span>
          <span>🇸🇦 الأسلوب: <span className="text-white">{
            { sa_arabic: "سعودي بيعي", gulf_arabic: "خليجي", msa_formal: "فصيح", english: "إنجليزي" }[currentSettings.data.salesApproach ?? "sa_arabic"]
          }</span></span>
          {currentSettings.data.targetCities && (
            <span>🗺️ المدن: <span className="text-white">{currentSettings.data.targetCities}</span></span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="mr-auto text-cyan-400 hover:text-cyan-300 text-xs h-6 px-2"
            onClick={() => setShowSettings(true)}
          >
            تعديل
          </Button>
        </div>
      )}

      {/* Stats Overview */}
      {bulkStats.data && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard
            label="إجمالي العملاء"
            value={bulkStats.data.total}
            icon={<Layers className="w-4 h-4" />}
            color="blue"
          />
          <StatCard
            label="تم تحليلهم"
            value={bulkStats.data.analyzed}
            icon={<CheckCircle className="w-4 h-4" />}
            color="green"
          />
          <StatCard
            label="بانتظار التحليل"
            value={bulkStats.data.pending}
            icon={<Clock className="w-4 h-4" />}
            color="yellow"
          />
          <StatCard
            label="قيد التحليل"
            value={bulkStats.data.analyzing}
            icon={<RefreshCw className="w-4 h-4 animate-spin" />}
            color="cyan"
          />
          <StatCard
            label="نسبة الإنجاز"
            value={`${bulkStats.data.analysisRate}%`}
            icon={<TrendingUp className="w-4 h-4" />}
            color="purple"
          />
        </div>
      )}

      {/* Active Batch Progress */}
      {activeBatchId && batchStatus.data && !isBatchDone && (
        <Card className="bg-slate-800/50 border-cyan-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isBatchRunning ? "bg-green-400 animate-pulse" : "bg-yellow-400"}`} />
                <span className="text-sm font-medium text-white">
                  {isBatchRunning ? "جارٍ التحليل..." : "متوقف مؤقتاً"}
                </span>
                <span className="text-xs text-slate-400">
                  {batchStatus.data.processed}/{batchStatus.data.total} عميل
                </span>
              </div>
              <div className="flex gap-2">
                {isBatchRunning && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
                    onClick={() => pauseBatch.mutate({ batchId: activeBatchId })}
                  >
                    <Pause className="w-3 h-3 ml-1" />
                    إيقاف
                  </Button>
                )}
                {isBatchPaused && (
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => resumeBatch.mutate({ batchId: activeBatchId })}
                  >
                    <Play className="w-3 h-3 ml-1" />
                    استئناف
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-slate-400"
                  onClick={() => { setActiveBatchId(null); bulkStats.refetch(); }}
                >
                  ✕
                </Button>
              </div>
            </div>
            <Progress value={batchProgress} className="h-2" />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>{batchProgress}% مكتمل</span>
              {batchStatus.data.failed > 0 && (
                <span className="text-red-400">{batchStatus.data.failed} فشل</span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {isBatchDone && (
        <Card className="bg-green-500/10 border-green-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="text-green-300 font-medium">
              اكتمل التحليل! تم تحليل {batchStatus.data?.processed} عميل
              {(batchStatus.data?.failed || 0) > 0 && ` (${batchStatus.data?.failed} فشل)`}
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="mr-auto text-slate-400"
              onClick={() => { setActiveBatchId(null); bulkStats.refetch(); unanalyzedLeads.refetch(); }}
            >
              ✕ إغلاق
            </Button>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="bulk" className="space-y-4">
        <TabsList className="bg-slate-800/50 border border-slate-700">
          <TabsTrigger value="bulk" className="data-[state=active]:bg-cyan-600">
            <Zap className="w-4 h-4 ml-2" />
            التحليل الجماعي
          </TabsTrigger>
          <TabsTrigger value="sectors" className="data-[state=active]:bg-cyan-600">
            <BarChart3 className="w-4 h-4 ml-2" />
            إحصائيات القطاعات
          </TabsTrigger>
          <TabsTrigger value="reports" className="data-[state=active]:bg-cyan-600">
            <FileText className="w-4 h-4 ml-2" />
            التقارير
          </TabsTrigger>
        </TabsList>

        {/* Bulk Analysis Tab */}
        <TabsContent value="bulk" className="space-y-4">
          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              className="bg-cyan-600 hover:bg-cyan-700"
              onClick={handleAnalyzeAll}
              disabled={analyzeAllPending.isPending || !!activeBatchId}
            >
              <Zap className="w-4 h-4 ml-2" />
              تحليل جميع المنتظرين ({bulkStats.data?.pending || 0})
            </Button>

            {selectedLeadIds.length > 0 && (
              <Button
                variant="outline"
                className="border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
                onClick={handleStartSelected}
                disabled={startBatch.isPending || !!activeBatchId}
              >
                <Target className="w-4 h-4 ml-2" />
                تحليل المحددين ({selectedLeadIds.length})
              </Button>
            )}

            <div className="flex items-center gap-2 mr-auto">
              <Select value={selectedSector || "all"} onValueChange={v => setSelectedSector(v === "all" ? undefined : v)}>
                <SelectTrigger className="w-44 bg-slate-800/50 border-slate-700 text-sm">
                  <SelectValue placeholder="كل القطاعات" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل القطاعات</SelectItem>
                  {Object.entries(SECTOR_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Unanalyzed Leads List */}
          <Card className="bg-slate-800/30 border-slate-700">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-slate-300">
                  العملاء بانتظار التحليل ({unanalyzedLeads.data?.length || 0})
                </CardTitle>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" className="text-xs text-slate-400" onClick={selectAll}>
                    تحديد الكل
                  </Button>
                  {selectedLeadIds.length > 0 && (
                    <Button size="sm" variant="ghost" className="text-xs text-slate-500" onClick={clearSelection}>
                      إلغاء التحديد
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {unanalyzedLeads.isLoading ? (
                <div className="p-8 text-center text-slate-500">جارٍ التحميل...</div>
              ) : (unanalyzedLeads.data?.length || 0) === 0 ? (
                <div className="p-8 text-center">
                  <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                  <p className="text-slate-400 text-sm">جميع العملاء تم تحليلهم!</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-700/50 max-h-96 overflow-y-auto">
                  {unanalyzedLeads.data?.map(lead => (
                    <div
                      key={lead.id}
                      className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                        selectedLeadIds.includes(lead.id)
                          ? "bg-cyan-500/10 border-r-2 border-cyan-500"
                          : "hover:bg-slate-700/30"
                      }`}
                      onClick={() => toggleLeadSelection(lead.id)}
                    >
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                        selectedLeadIds.includes(lead.id)
                          ? "bg-cyan-500 border-cyan-500"
                          : "border-slate-600"
                      }`}>
                        {selectedLeadIds.includes(lead.id) && (
                          <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 12 12">
                            <path d="M10.28 2.28L3.989 8.575 1.695 6.28A1 1 0 00.28 7.695l3 3a1 1 0 001.414 0l7-7A1 1 0 0010.28 2.28z" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white truncate">{lead.companyName}</span>
                          {lead.sectorMain && (
                            <span className="text-xs text-slate-500">
                              {SECTOR_LABELS[lead.sectorMain] || lead.sectorMain}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {lead.businessType} · {lead.city}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            lead.analysisStatus === "failed"
                              ? "border-red-500/50 text-red-400"
                              : "border-slate-600 text-slate-500"
                          }`}
                        >
                          {lead.analysisStatus === "failed" ? "فشل" : "منتظر"}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs text-cyan-400 hover:text-cyan-300 p-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/leads/${lead.id}`);
                          }}
                        >
                          <ChevronRight className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sector Stats Tab */}
        <TabsContent value="sectors" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sectorStats.data?.map(stat => (
              <SectorStatCard key={stat.sector} stat={stat} />
            ))}
          </div>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-300">
              العملاء المحللون — جاهزون للتقرير ({analyzedLeads.data?.length || 0})
            </h3>
            <Button
              size="sm"
              variant="ghost"
              className="text-slate-400 gap-1"
              onClick={() => analyzedLeads.refetch()}
            >
              <RefreshCw className="w-3 h-3" />
              تحديث
            </Button>
          </div>

          {analyzedLeads.isLoading ? (
            <div className="p-8 text-center text-slate-500">جارٍ التحميل...</div>
          ) : (analyzedLeads.data?.length || 0) === 0 ? (
            <Card className="bg-slate-800/30 border-slate-700">
              <CardContent className="p-8 text-center">
                <FileText className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                <p className="text-slate-400 text-sm mb-4">
                  لا يوجد عملاء محللون بعد. قم بتحليل عملاء أولاً من تبويب "التحليل الجماعي"
                </p>
                <Button
                  variant="outline"
                  className="border-slate-600"
                  onClick={() => navigate("/leads")}
                >
                  الذهاب إلى قائمة العملاء
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {analyzedLeads.data?.map((lead: any) => (
                <Card key={lead.id} className="bg-slate-800/30 border-slate-700 hover:border-slate-600 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-white text-sm truncate">{lead.companyName}</span>
                          {lead.urgencyLevel && (
                            <Badge
                              variant="outline"
                              className={`text-xs ${URGENCY_COLORS[lead.urgencyLevel] || ""}`}
                            >
                              {URGENCY_LABELS[lead.urgencyLevel] || lead.urgencyLevel}
                            </Badge>
                          )}
                          {lead.leadPriorityScore && (
                            <Badge variant="outline" className="text-xs border-cyan-500/30 text-cyan-400">
                              {lead.leadPriorityScore.toFixed(1)}/10
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-slate-500">
                          {lead.businessType} · {lead.city}
                          {lead.pdfGenerationStatus === "ready" && (
                            <span className="mr-2 text-green-400">✓ تقرير جاهز</span>
                          )}
                        </div>
                        {lead.iceBreaker && (
                          <p className="text-xs text-slate-400 mt-1 truncate">
                            💬 {lead.iceBreaker}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {lead.pdfFileUrl ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-green-500/50 text-green-400 hover:bg-green-500/10 gap-1 text-xs"
                              onClick={() => window.open(lead.pdfFileUrl, "_blank")}
                            >
                              <Eye className="w-3 h-3" />
                              معاينة
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10 gap-1 text-xs"
                              onClick={() => {
                                const a = document.createElement("a");
                                a.href = lead.pdfFileUrl;
                                a.download = `تقرير-${lead.companyName}.html`;
                                a.click();
                              }}
                            >
                              <Download className="w-3 h-3" />
                              تحميل
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            className="bg-cyan-600 hover:bg-cyan-700 gap-1 text-xs"
                            onClick={() => generatePdf.mutate({
                              leadId: lead.id,
                              reportType: "internal",
                            })}
                            disabled={generatePdf.isPending}
                          >
                            <FileText className="w-3 h-3" />
                            توليد تقرير
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-slate-400 p-1"
                          onClick={() => navigate(`/leads/${lead.id}`)}
                        >
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ===== Sub Components =====

function StatCard({ label, value, icon, color }: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: "blue" | "green" | "yellow" | "cyan" | "purple" | "red";
}) {
  const colorMap = {
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    green: "text-green-400 bg-green-500/10 border-green-500/20",
    yellow: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
    cyan: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    purple: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    red: "text-red-400 bg-red-500/10 border-red-500/20",
  };

  return (
    <div className={`rounded-xl border p-4 ${colorMap[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs opacity-70">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

function SectorStatCard({ stat }: { stat: any }) {
  const label = SECTOR_LABELS[stat.sector] || stat.sector;
  const progress = stat.total > 0 ? Math.round((stat.analyzed / stat.total) * 100) : 0;

  return (
    <Card className="bg-slate-800/30 border-slate-700">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-white">{label}</span>
          <span className="text-xs text-slate-500">{stat.total} عميل</span>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-slate-400">
            <span>نسبة التحليل</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="text-center">
            <div className="text-sm font-bold text-green-400">{stat.analyzed}</div>
            <div className="text-xs text-slate-500">محلّل</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-bold text-red-400">{stat.urgent}</div>
            <div className="text-xs text-slate-500">عاجل</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-bold text-yellow-400">{stat.highPriority}</div>
            <div className="text-xs text-slate-500">أولوية عالية</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
