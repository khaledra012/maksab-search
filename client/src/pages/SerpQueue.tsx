/**
 * صفحة إدارة مهام البحث المتقدم (SERP Queue)
 * - إنشاء مهام بحث متعددة المنصات
 * - متابعة التقدم في الوقت الفعلي
 * - عرض النتائج مع فلاتر متقدمة
 * - تصدير Excel
 */

import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Search, Play, Pause, Trash2, Plus, RefreshCw, Download,
  Instagram, Video, Camera, Users, Globe, Linkedin, Twitter,
  CheckCircle2, XCircle, Clock, Loader2, BarChart2, Filter,
  ExternalLink, Phone, Mail, Star, ChevronRight, ChevronDown,
  Zap, Target, TrendingUp, Eye, AlertTriangle, CheckCheck,
} from "lucide-react";

// ===== Constants =====
const PLATFORMS = [
  { id: "instagram", label: "إنستجرام", icon: Instagram, color: "text-pink-400", bg: "bg-pink-500/10" },
  { id: "tiktok", label: "تيك توك", icon: Video, color: "text-cyan-400", bg: "bg-cyan-500/10" },
  { id: "snapchat", label: "سناب شات", icon: Camera, color: "text-yellow-400", bg: "bg-yellow-500/10" },
  { id: "facebook", label: "فيسبوك", icon: Users, color: "text-blue-400", bg: "bg-blue-500/10" },
  { id: "twitter", label: "تويتر/X", icon: Twitter, color: "text-sky-400", bg: "bg-sky-500/10" },
  { id: "linkedin", label: "لينكدإن", icon: Linkedin, color: "text-indigo-400", bg: "bg-indigo-500/10" },
];

const SAUDI_CITIES = [
  "السعودية", "الرياض", "جدة", "مكة المكرمة", "المدينة المنورة",
  "الدمام", "الخبر", "الطائف", "تبوك", "أبها", "القصيم",
  "حائل", "نجران", "جازان", "الأحساء", "الجبيل", "ينبع",
];

const STATUS_CONFIG = {
  pending: { label: "في الانتظار", color: "text-yellow-400", bg: "bg-yellow-500/10", icon: Clock },
  running: { label: "قيد التنفيذ", color: "text-blue-400", bg: "bg-blue-500/10", icon: Loader2 },
  paused: { label: "متوقف", color: "text-orange-400", bg: "bg-orange-500/10", icon: Pause },
  completed: { label: "مكتمل", color: "text-green-400", bg: "bg-green-500/10", icon: CheckCircle2 },
  failed: { label: "فشل", color: "text-red-400", bg: "bg-red-500/10", icon: XCircle },
};

const PRIORITY_CONFIG = {
  high: { label: "عالية", color: "text-red-400", bg: "bg-red-500/10" },
  medium: { label: "متوسطة", color: "text-yellow-400", bg: "bg-yellow-500/10" },
  low: { label: "منخفضة", color: "text-gray-400", bg: "bg-gray-500/10" },
};

// ===== Helper: تصدير Excel =====
function exportToExcel(data: any[], filename: string) {
  const headers = [
    "المنصة", "اسم المستخدم", "الاسم الظاهر", "الوصف",
    "رابط الملف", "رقم الهاتف", "البريد الإلكتروني",
    "نوع النشاط", "الأولوية", "قابل للتواصل", "درجة الملاءمة",
    "الكلمة المفتاحية", "الموقع", "تاريخ الاكتشاف",
  ];

  const rows = data.map((r) => [
    r.platform,
    r.username,
    r.displayName || "",
    (r.bio || "").replace(/\n/g, " ").slice(0, 200),
    r.profileUrl,
    r.phone || "",
    r.email || "",
    r.businessType || "",
    r.priority === "high" ? "عالية" : r.priority === "medium" ? "متوسطة" : "منخفضة",
    r.isContactable ? "نعم" : "لا",
    r.relevanceScore || "",
    r.keyword,
    r.location || "السعودية",
    new Date(r.discoveredAt).toLocaleDateString("ar-SA"),
  ]);

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const bom = "\uFEFF"; // BOM for Arabic support in Excel
  const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ===== Component: Create Job Dialog =====
function CreateJobDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    taskName: "",
    keyword: "",
    location: "السعودية",
    platforms: ["instagram", "tiktok", "snapchat"] as string[],
    targetCount: 50,
    priority: 5,
    runNow: true,
  });

  const createJob = trpc.serpQueue.createJob.useMutation({
    onSuccess: (data) => {
      toast.success(`تم إنشاء المهمة #${data.jobId} بنجاح`);
      onCreated();
      onClose();
      setForm({ taskName: "", keyword: "", location: "السعودية", platforms: ["instagram", "tiktok", "snapchat"], targetCount: 50, priority: 5, runNow: true });
    },
    onError: (err) => toast.error(`خطأ: ${err.message}`),
  });

  const togglePlatform = (id: string) => {
    setForm((f) => ({
      ...f,
      platforms: f.platforms.includes(id) ? f.platforms.filter((p) => p !== id) : [...f.platforms, id],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-gray-900 border-gray-700 text-white" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-400" />
            إنشاء مهمة بحث جديدة
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-gray-300 text-sm">اسم المهمة</Label>
            <Input
              value={form.taskName}
              onChange={(e) => setForm((f) => ({ ...f, taskName: e.target.value }))}
              placeholder="مثال: مطاعم الرياض - يناير 2026"
              className="bg-gray-800 border-gray-600 text-white mt-1"
            />
          </div>

          <div>
            <Label className="text-gray-300 text-sm">الكلمة المفتاحية</Label>
            <Input
              value={form.keyword}
              onChange={(e) => setForm((f) => ({ ...f, keyword: e.target.value }))}
              placeholder="مثال: مطعم، محل ملابس، صالون..."
              className="bg-gray-800 border-gray-600 text-white mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-300 text-sm">الموقع</Label>
              <Select value={form.location} onValueChange={(v) => setForm((f) => ({ ...f, location: v }))}>
                <SelectTrigger className="bg-gray-800 border-gray-600 text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600">
                  {SAUDI_CITIES.map((c) => (
                    <SelectItem key={c} value={c} className="text-white">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-300 text-sm">الهدف (عدد النتائج)</Label>
              <Input
                type="number"
                value={form.targetCount}
                onChange={(e) => setForm((f) => ({ ...f, targetCount: parseInt(e.target.value) || 50 }))}
                min={10}
                max={500}
                className="bg-gray-800 border-gray-600 text-white mt-1"
              />
            </div>
          </div>

          <div>
            <Label className="text-gray-300 text-sm mb-2 block">المنصات</Label>
            <div className="grid grid-cols-3 gap-2">
              {PLATFORMS.map((p) => {
                const Icon = p.icon;
                const selected = form.platforms.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => togglePlatform(p.id)}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-sm transition-all ${
                      selected
                        ? `${p.bg} border-current ${p.color}`
                        : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-xs">{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="runNow"
              checked={form.runNow}
              onCheckedChange={(v) => setForm((f) => ({ ...f, runNow: !!v }))}
            />
            <Label htmlFor="runNow" className="text-gray-300 text-sm cursor-pointer">
              تشغيل فوري بعد الإنشاء
            </Label>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="border-gray-600 text-gray-300">
            إلغاء
          </Button>
          <Button
            onClick={() => createJob.mutate(form as any)}
            disabled={!form.keyword || !form.taskName || form.platforms.length === 0 || createJob.isPending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {createJob.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Plus className="w-4 h-4 ml-2" />}
            إنشاء المهمة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== Component: Job Card =====
function JobCard({ job, onRefresh }: { job: any; onRefresh: () => void }) {
  const statusCfg = STATUS_CONFIG[job.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
  const StatusIcon = statusCfg.icon;
  const platforms = (job.platforms as string[]) || [];
  const logs = (job.log as any[]) || [];
  const [showLogs, setShowLogs] = useState(false);

  const runJob = trpc.serpQueue.runJob.useMutation({
    onSuccess: () => { toast.success("تم بدء التنفيذ"); onRefresh(); },
    onError: (err) => toast.error(err.message),
  });

  const pauseJob = trpc.serpQueue.pauseJob.useMutation({
    onSuccess: () => { toast.success("تم الإيقاف"); onRefresh(); },
    onError: (err) => toast.error(err.message),
  });

  const deleteJob = trpc.serpQueue.deleteJob.useMutation({
    onSuccess: () => { toast.success("تم الحذف"); onRefresh(); },
    onError: (err) => toast.error(err.message),
  });

  const progress = job.targetCount > 0 ? Math.min(100, (job.totalFound / job.targetCount) * 100) : 0;

  return (
    <Card className="bg-gray-800/50 border-gray-700 hover:border-gray-600 transition-all">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${statusCfg.bg} ${statusCfg.color}`}>
                <StatusIcon className={`w-3 h-3 ${job.status === "running" ? "animate-spin" : ""}`} />
                {statusCfg.label}
              </span>
              {job.isActive && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 animate-pulse">
                  جاري...
                </span>
              )}
            </div>
            <h3 className="text-white font-medium text-sm truncate">{job.taskName}</h3>
            <p className="text-gray-400 text-xs mt-0.5">
              <span className="text-blue-300">{job.keyword}</span>
              {" · "}
              <span>{job.location}</span>
            </p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {(job.status === "pending" || job.status === "paused" || job.status === "failed") && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => runJob.mutate({ jobId: job.id })}
                disabled={runJob.isPending}
                className="h-7 w-7 p-0 text-green-400 hover:text-green-300 hover:bg-green-500/10"
              >
                <Play className="w-3.5 h-3.5" />
              </Button>
            )}
            {job.status === "running" && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => pauseJob.mutate({ jobId: job.id })}
                disabled={pauseJob.isPending}
                className="h-7 w-7 p-0 text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10"
              >
                <Pause className="w-3.5 h-3.5" />
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => deleteJob.mutate({ jobId: job.id })}
              disabled={deleteJob.isPending}
              className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Progress */}
        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>النتائج: {job.totalFound}</span>
            <span>الهدف: {job.targetCount}</span>
          </div>
          <Progress value={progress} className="h-1.5 bg-gray-700" />
        </div>

        {/* Platforms */}
        <div className="flex gap-1 mt-2 flex-wrap">
          {platforms.map((p) => {
            const platform = PLATFORMS.find((pl) => pl.id === p);
            if (!platform) return null;
            const Icon = platform.icon;
            return (
              <span key={p} className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${platform.bg} ${platform.color}`}>
                <Icon className="w-3 h-3" />
                {platform.label}
              </span>
            );
          })}
        </div>

        {/* Current platform */}
        {job.currentPlatform && job.status === "running" && (
          <p className="text-xs text-blue-400 mt-2 animate-pulse">
            ⟳ جاري البحث في: {PLATFORMS.find((p) => p.id === job.currentPlatform)?.label || job.currentPlatform}
          </p>
        )}

        {/* Logs toggle */}
        {logs.length > 0 && (
          <button
            onClick={() => setShowLogs((v) => !v)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 mt-2 transition-colors"
          >
            {showLogs ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            سجل العمليات ({logs.length})
          </button>
        )}
        {showLogs && (
          <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
            {logs.slice(-10).reverse().map((log: any, i: number) => (
              <p key={i} className={`text-xs ${
                log.type === "error" ? "text-red-400" :
                log.type === "success" ? "text-green-400" :
                log.type === "warning" ? "text-yellow-400" :
                "text-gray-400"
              }`}>
                {new Date(log.time).toLocaleTimeString("ar-SA")} - {log.message}
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ===== Component: Results Table =====
function ResultsTable({ filters }: { filters: any }) {
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const { data, isLoading, refetch } = trpc.serpQueue.getResults.useQuery({
    ...filters,
    page,
    limit: 50,
  });

  const updateStatus = trpc.serpQueue.updateResultStatus.useMutation({
    onSuccess: () => refetch(),
  });

  const exportData = trpc.serpQueue.exportResults.useQuery(filters, { enabled: false });

  const handleExport = async () => {
    const result = await exportData.refetch();
    if (result.data) {
      exportToExcel(result.data, `نتائج_البحث_${filters.keyword || "كل"}`);
      toast.success(`تم تصدير ${result.data.length} نتيجة`);
    }
  };

  const getPlatformConfig = (platform: string) => PLATFORMS.find((p) => p.id === platform);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
        <span className="text-gray-400 mr-2">جاري تحميل النتائج...</span>
      </div>
    );
  }

  const results = data?.results || [];
  const total = data?.total || 0;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-gray-400 text-sm">
          إجمالي النتائج: <span className="text-white font-medium">{total}</span>
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={handleExport}
          disabled={exportData.isFetching || total === 0}
          className="border-green-500/30 text-green-400 hover:bg-green-500/10"
        >
          {exportData.isFetching ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Download className="w-4 h-4 ml-1" />}
          تصدير Excel ({total})
        </Button>
      </div>

      {/* Results Grid */}
      {results.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>لا توجد نتائج</p>
          <p className="text-xs mt-1">أنشئ مهمة بحث جديدة لبدء جمع البيانات</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {results.map((result) => {
            const platformCfg = getPlatformConfig(result.platform);
            const priorityCfg = PRIORITY_CONFIG[result.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.medium;
            const PlatformIcon = platformCfg?.icon || Globe;

            return (
              <div
                key={result.id}
                className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 hover:border-gray-600 transition-all"
              >
                <div className="flex items-start gap-3">
                  {/* Platform Icon */}
                  <div className={`w-8 h-8 rounded-lg ${platformCfg?.bg || "bg-gray-700"} flex items-center justify-center shrink-0`}>
                    <PlatformIcon className={`w-4 h-4 ${platformCfg?.color || "text-gray-400"}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-medium text-sm">{result.displayName || result.username}</span>
                      <span className="text-gray-500 text-xs">@{result.username}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${priorityCfg.bg} ${priorityCfg.color}`}>
                        {priorityCfg.label}
                      </span>
                      {result.isContactable && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/10 text-green-400">
                          ✓ قابل للتواصل
                        </span>
                      )}
                      {result.relevanceScore && (
                        <span className="text-xs text-yellow-400">★ {result.relevanceScore}/10</span>
                      )}
                    </div>

                    {result.bio && (
                      <p className="text-gray-400 text-xs mt-1 line-clamp-2">{result.bio}</p>
                    )}

                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {result.phone && (
                        <span className="flex items-center gap-1 text-xs text-green-400">
                          <Phone className="w-3 h-3" />
                          {result.phone}
                        </span>
                      )}
                      {result.email && (
                        <span className="flex items-center gap-1 text-xs text-blue-400">
                          <Mail className="w-3 h-3" />
                          {result.email}
                        </span>
                      )}
                      {result.businessType && (
                        <span className="text-xs text-gray-500">{result.businessType}</span>
                      )}
                      <a
                        href={result.profileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                      >
                        <ExternalLink className="w-3 h-3" />
                        فتح الملف
                      </a>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1 shrink-0">
                    <Select
                      value={result.status}
                      onValueChange={(v) => updateStatus.mutate({ resultId: result.id, status: v as any })}
                    >
                      <SelectTrigger className="h-7 text-xs bg-gray-700 border-gray-600 text-gray-300 w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-600">
                        <SelectItem value="new" className="text-white text-xs">جديد</SelectItem>
                        <SelectItem value="reviewed" className="text-white text-xs">مراجع</SelectItem>
                        <SelectItem value="converted" className="text-white text-xs">محوّل</SelectItem>
                        <SelectItem value="rejected" className="text-white text-xs">مرفوض</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {total > 50 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="border-gray-600 text-gray-300"
          >
            السابق
          </Button>
          <span className="text-gray-400 text-sm">
            صفحة {page} من {data?.totalPages || 1}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= (data?.totalPages || 1)}
            className="border-gray-600 text-gray-300"
          >
            التالي
          </Button>
        </div>
      )}
    </div>
  );
}

// ===== Main Page =====
export default function SerpQueue() {
  const [activeTab, setActiveTab] = useState("jobs");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [filters, setFilters] = useState({
    platform: undefined as string | undefined,
    status: undefined as string | undefined,
    priority: undefined as string | undefined,
    isContactable: undefined as boolean | undefined,
    keyword: undefined as string | undefined,
    search: undefined as string | undefined,
  });
  const [searchInput, setSearchInput] = useState("");

  // Jobs list
  const { data: jobsData, isLoading: jobsLoading, refetch: refetchJobs } = trpc.serpQueue.listJobs.useQuery({
    page: 1,
    limit: 20,
  });

  // Stats
  const { data: stats, refetch: refetchStats } = trpc.serpQueue.getStats.useQuery({});

  // Auto-refresh when there are running jobs
  useEffect(() => {
    const hasRunning = jobsData?.jobs.some((j) => j.status === "running" || j.isActive);
    if (!hasRunning) return;
    const interval = setInterval(() => {
      refetchJobs();
      refetchStats();
    }, 3000);
    return () => clearInterval(interval);
  }, [jobsData?.jobs, refetchJobs, refetchStats]);

  const handleRefresh = useCallback(() => {
    refetchJobs();
    refetchStats();
  }, [refetchJobs, refetchStats]);

  return (
    <div className="min-h-screen bg-gray-950 text-white" dir="rtl">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Zap className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h1 className="text-white font-bold text-base">محرك البحث المتقدم</h1>
              <p className="text-gray-400 text-xs">SERP Queue - جمع بيانات العملاء تلقائياً</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleRefresh}
              className="text-gray-400 hover:text-white"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              onClick={() => setShowCreateDialog(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-4 h-4 ml-1" />
              مهمة جديدة
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-white">{stats.total}</p>
                <p className="text-gray-400 text-xs mt-0.5">إجمالي النتائج</p>
              </CardContent>
            </Card>
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-green-400">{stats.contactable}</p>
                <p className="text-gray-400 text-xs mt-0.5">قابل للتواصل</p>
              </CardContent>
            </Card>
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-red-400">{stats.byPriority?.high || 0}</p>
                <p className="text-gray-400 text-xs mt-0.5">أولوية عالية</p>
              </CardContent>
            </Card>
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-blue-400">{jobsData?.jobs.filter((j) => j.status === "running").length || 0}</p>
                <p className="text-gray-400 text-xs mt-0.5">مهام نشطة</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Platform Stats */}
        {stats && Object.keys(stats.byPlatform || {}).length > 0 && (
          <div className="flex gap-2 mb-4 flex-wrap">
            {PLATFORMS.map((p) => {
              const count = stats.byPlatform[p.id] || 0;
              if (!count) return null;
              const Icon = p.icon;
              return (
                <button
                  key={p.id}
                  onClick={() => setFilters((f) => ({ ...f, platform: f.platform === p.id ? undefined : p.id as any }))}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-all ${
                    filters.platform === p.id
                      ? `${p.bg} border-current ${p.color}`
                      : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {p.label}: {count}
                </button>
              );
            })}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-gray-800 border-gray-700 mb-4">
            <TabsTrigger value="jobs" className="data-[state=active]:bg-gray-700 text-gray-300">
              <Target className="w-4 h-4 ml-1" />
              المهام ({jobsData?.total || 0})
            </TabsTrigger>
            <TabsTrigger value="results" className="data-[state=active]:bg-gray-700 text-gray-300">
              <BarChart2 className="w-4 h-4 ml-1" />
              النتائج ({stats?.total || 0})
            </TabsTrigger>
          </TabsList>

          {/* Jobs Tab */}
          <TabsContent value="jobs">
            {jobsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
              </div>
            ) : (jobsData?.jobs.length || 0) === 0 ? (
              <div className="text-center py-16">
                <Target className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                <p className="text-gray-400">لا توجد مهام بحث</p>
                <p className="text-gray-500 text-sm mt-1">أنشئ مهمة جديدة لبدء جمع البيانات</p>
                <Button
                  onClick={() => setShowCreateDialog(true)}
                  className="mt-4 bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4 ml-1" />
                  إنشاء مهمة
                </Button>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {jobsData?.jobs.map((job) => (
                  <JobCard key={job.id} job={job} onRefresh={handleRefresh} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Results Tab */}
          <TabsContent value="results">
            {/* Filters */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Filter className="w-4 h-4 text-gray-400 shrink-0" />

                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && setFilters((f) => ({ ...f, search: searchInput || undefined }))}
                  placeholder="بحث في النتائج..."
                  className="h-8 text-sm bg-gray-700 border-gray-600 text-white w-48"
                />

                <Select
                  value={filters.platform || "all"}
                  onValueChange={(v) => setFilters((f) => ({ ...f, platform: v === "all" ? undefined : v as any }))}
                >
                  <SelectTrigger className="h-8 text-xs bg-gray-700 border-gray-600 text-white w-32">
                    <SelectValue placeholder="المنصة" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600">
                    <SelectItem value="all" className="text-white text-xs">كل المنصات</SelectItem>
                    {PLATFORMS.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-white text-xs">{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={filters.priority || "all"}
                  onValueChange={(v) => setFilters((f) => ({ ...f, priority: v === "all" ? undefined : v as any }))}
                >
                  <SelectTrigger className="h-8 text-xs bg-gray-700 border-gray-600 text-white w-32">
                    <SelectValue placeholder="الأولوية" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600">
                    <SelectItem value="all" className="text-white text-xs">كل الأولويات</SelectItem>
                    <SelectItem value="high" className="text-white text-xs">عالية</SelectItem>
                    <SelectItem value="medium" className="text-white text-xs">متوسطة</SelectItem>
                    <SelectItem value="low" className="text-white text-xs">منخفضة</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={filters.status || "all"}
                  onValueChange={(v) => setFilters((f) => ({ ...f, status: v === "all" ? undefined : v as any }))}
                >
                  <SelectTrigger className="h-8 text-xs bg-gray-700 border-gray-600 text-white w-32">
                    <SelectValue placeholder="الحالة" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600">
                    <SelectItem value="all" className="text-white text-xs">كل الحالات</SelectItem>
                    <SelectItem value="new" className="text-white text-xs">جديد</SelectItem>
                    <SelectItem value="reviewed" className="text-white text-xs">مراجع</SelectItem>
                    <SelectItem value="converted" className="text-white text-xs">محوّل</SelectItem>
                    <SelectItem value="rejected" className="text-white text-xs">مرفوض</SelectItem>
                  </SelectContent>
                </Select>

                <button
                  onClick={() => setFilters((f) => ({ ...f, isContactable: f.isContactable === true ? undefined : true }))}
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition-all ${
                    filters.isContactable
                      ? "bg-green-500/10 border-green-500/30 text-green-400"
                      : "bg-gray-700 border-gray-600 text-gray-400"
                  }`}
                >
                  <Phone className="w-3 h-3" />
                  قابل للتواصل فقط
                </button>

                {(filters.platform || filters.priority || filters.status || filters.isContactable || filters.search) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setFilters({ platform: undefined, status: undefined, priority: undefined, isContactable: undefined, keyword: undefined, search: undefined });
                      setSearchInput("");
                    }}
                    className="h-8 text-xs text-red-400 hover:text-red-300"
                  >
                    <XCircle className="w-3 h-3 ml-1" />
                    مسح الفلاتر
                  </Button>
                )}
              </div>
            </div>

            <ResultsTable filters={filters} />
          </TabsContent>
        </Tabs>
      </div>

      <CreateJobDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreated={handleRefresh}
      />
    </div>
  );
}
