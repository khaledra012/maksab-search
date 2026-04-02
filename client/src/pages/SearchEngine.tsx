import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { useSearch, type PlatformId as SearchHubPlatformId } from "@/contexts/SearchContext";
import {
  Play, Pause, Trash2, Plus, Bot, CheckCircle2, AlertCircle,
  Info, XCircle, RefreshCw, Zap, Search, Globe, MapPin,
  TrendingUp, Users, Clock, ChevronDown, ChevronUp, ExternalLink,
  Camera, Instagram, Facebook, Music2, MessageCircle, Twitter
} from "lucide-react";
import { COUNTRIES_DATA } from "../../../shared/countries";

type JobStatus = "pending" | "running" | "paused" | "completed" | "failed";
type LogEntry = { time: string; message: string; type: "info" | "success" | "warning" | "error" };

// ====== إعدادات المنصات ======
type PlatformMode = "auto" | "manual";

interface Platform {
  id: string;
  name: string;
  nameAr: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  mode: PlatformMode;
  modeLabel: string;
  description: string;
  buildSearchUrl?: (query: string, city: string) => string;
}

const PLATFORMS: Platform[] = [
  {
    id: "google_maps",
    name: "Google Maps",
    nameAr: "خرائط جوجل",
    icon: <MapPin className="w-5 h-5" />,
    color: "text-green-400",
    bgColor: "bg-green-900/30",
    borderColor: "border-green-700",
    mode: "auto",
    modeLabel: "🤖 تلقائي كامل",
    description: "يبحث تلقائياً ويجلب الاسم والهاتف والموقع بدون تدخل",
  },
  {
    id: "snapchat",
    name: "Snapchat",
    nameAr: "سناب شات",
    icon: <Camera className="w-5 h-5" />,
    color: "text-yellow-400",
    bgColor: "bg-yellow-900/30",
    borderColor: "border-yellow-700",
    mode: "manual",
    modeLabel: "👤 يدوي مساعد",
    description: "يفتح بحث سناب شات ويساعدك على استخراج البيانات يدوياً",
    buildSearchUrl: (q, city) => `https://www.snapchat.com/search?q=${encodeURIComponent(q + " " + city)}`,
  },
  {
    id: "instagram",
    name: "Instagram",
    nameAr: "إنستغرام",
    icon: <Instagram className="w-5 h-5" />,
    color: "text-pink-400",
    bgColor: "bg-pink-900/30",
    borderColor: "border-pink-700",
    mode: "manual",
    modeLabel: "👤 يدوي مساعد",
    description: "يفتح بحث إنستغرام ويساعدك على استخراج البيانات يدوياً",
    buildSearchUrl: (q, city) => `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(q + " " + city)}`,
  },
  {
    id: "tiktok",
    name: "TikTok",
    nameAr: "تيك توك",
    icon: <Music2 className="w-5 h-5" />,
    color: "text-cyan-400",
    bgColor: "bg-cyan-900/30",
    borderColor: "border-cyan-700",
    mode: "manual",
    modeLabel: "👤 يدوي مساعد",
    description: "يفتح بحث تيك توك ويساعدك على استخراج البيانات يدوياً",
    buildSearchUrl: (q, city) => `https://www.tiktok.com/search?q=${encodeURIComponent(q + " " + city)}`,
  },
  {
    id: "facebook",
    name: "Facebook",
    nameAr: "فيسبوك",
    icon: <Facebook className="w-5 h-5" />,
    color: "text-blue-400",
    bgColor: "bg-blue-900/30",
    borderColor: "border-blue-700",
    mode: "manual",
    modeLabel: "👤 يدوي مساعد",
    description: "يفتح بحث فيسبوك للأنشطة التجارية ويساعدك على الاستخراج",
    buildSearchUrl: (q, city) => `https://www.facebook.com/search/pages/?q=${encodeURIComponent(q + " " + city)}`,
  },
  {
    id: "twitter",
    name: "Twitter / X",
    nameAr: "تويتر / X",
    icon: <Twitter className="w-5 h-5" />,
    color: "text-sky-400",
    bgColor: "bg-sky-900/30",
    borderColor: "border-sky-700",
    mode: "auto",
    modeLabel: "تلقائي بالمحرك الجديد",
    description: "يستخدم مسار تويتر / X في محرك البحث الجديد بدل مسار الصفحة القديم",
    buildSearchUrl: (q, city) => `https://x.com/search?q=${encodeURIComponent(q + " " + city)}&src=typed_query`,
  },
  {
    id: "maroof",
    name: "Maroof.sa",
    nameAr: "معروف",
    icon: <MessageCircle className="w-5 h-5" />,
    color: "text-emerald-400",
    bgColor: "bg-emerald-900/30",
    borderColor: "border-emerald-700",
    mode: "manual",
    modeLabel: "👤 يدوي مساعد",
    description: "يفتح منصة معروف.sa لاستعراض الأنشطة المرخصة في السعودية",
    buildSearchUrl: (q) => `https://maroof.sa/businesses?search=${encodeURIComponent(q)}`,
  },
  {
    id: "all",
    name: "الكل",
    nameAr: "جميع المنصات",
    icon: <Globe className="w-5 h-5" />,
    color: "text-purple-400",
    bgColor: "bg-purple-900/30",
    borderColor: "border-purple-700",
    mode: "auto",
    modeLabel: "🤖 تلقائي + يدوي",
    description: "يشغّل Google Maps تلقائياً ويفتح باقي المنصات في تبويبات",
  },
];

const STATUS_CONFIG: Record<JobStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending:   { label: "في الانتظار", color: "bg-zinc-700 text-zinc-300", icon: <Clock className="w-3 h-3" /> },
  running:   { label: "يعمل الآن",   color: "bg-blue-900 text-blue-300 animate-pulse", icon: <Zap className="w-3 h-3" /> },
  paused:    { label: "متوقف مؤقتاً", color: "bg-yellow-900 text-yellow-300", icon: <Pause className="w-3 h-3" /> },
  completed: { label: "مكتمل",       color: "bg-green-900 text-green-300", icon: <CheckCircle2 className="w-3 h-3" /> },
  failed:    { label: "فشل",         color: "bg-red-900 text-red-300", icon: <XCircle className="w-3 h-3" /> },
};

const LOG_ICONS: Record<string, React.ReactNode> = {
  info:    <Info className="w-3 h-3 text-blue-400 mt-0.5 shrink-0" />,
  success: <CheckCircle2 className="w-3 h-3 text-green-400 mt-0.5 shrink-0" />,
  warning: <AlertCircle className="w-3 h-3 text-yellow-400 mt-0.5 shrink-0" />,
  error:   <XCircle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />,
};

const BUSINESS_PRESETS = [
  "ملحمة", "مطعم", "صيدلية", "بقالة", "مقهى", "صالون",
  "محل ملابس", "محل إلكترونيات", "مغسلة", "حلويات", "مخبز",
  "محل أغنام", "مزرعة دواجن", "محل عطور", "محل أثاث", "محل ذهب",
  "مدرسة تعليم قيادة", "مركز طبي", "عيادة أسنان", "صالة رياضية",
];

const SEARCH_ENGINE_PLATFORM_MAP: Record<string, SearchHubPlatformId[] | null> = {
  google_maps: ["googleWeb"],
  instagram: ["instagram"],
  tiktok: ["tiktok"],
  snapchat: ["snapchat"],
  twitter: ["twitter"],
  facebook: ["facebook"],
  all: ["googleWeb", "instagram", "tiktok", "snapchat", "twitter", "facebook"],
  maroof: null,
};

function getSearchHubPlatforms(platformId: string): SearchHubPlatformId[] | null {
  return SEARCH_ENGINE_PLATFORM_MAP[platformId] ?? null;
}

// ====== نموذج الاستخراج اليدوي ======
function ManualExtractForm({ platform, query, city, onClose }: {
  platform: Platform;
  query: string;
  city: string;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    companyName: "",
    verifiedPhone: "",
    businessType: query,
    city: city,
    website: "",
    instagramUrl: "",
    snapchatUrl: "",
    tiktokUrl: "",
    facebookUrl: "",
    notes: "",
  });
  const [strategy, setStrategy] = useState<any>(null);
  const [evaluation, setEvaluation] = useState<any>(null);
  const [showStrategy, setShowStrategy] = useState(false);

  const createLead = trpc.leads.create.useMutation({
    onSuccess: () => {
      toast.success("✅ تم حفظ العميل بنجاح!");
      setForm(f => ({ ...f, companyName: "", verifiedPhone: "", website: "", notes: "" }));
      setEvaluation(null);
    },
    onError: (e) => toast.error(`خطأ: ${e.message}`),
  });

  const generateStrategy = trpc.aiSearch.generateStrategy.useMutation({
    onSuccess: (data) => {
      setStrategy(data);
      setShowStrategy(true);
      toast.success("✨ تم توليد استراتيجية البحث!");
    },
    onError: (e) => toast.error(`خطأ AI: ${e.message}`),
  });

  const evaluateLead = trpc.aiSearch.evaluateLead.useMutation({
    onSuccess: (data) => {
      setEvaluation(data);
      toast.success("✨ تم تقييم العميل!");
    },
    onError: (e) => toast.error(`خطأ AI: ${e.message}`),
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.companyName.trim()) return toast.error("أدخل اسم النشاط");
    createLead.mutate({
      companyName: form.companyName,
      businessType: form.businessType,
      city: form.city,
      verifiedPhone: form.verifiedPhone || undefined,
      website: form.website || undefined,
      instagramUrl: form.instagramUrl || undefined,
      snapchatUrl: form.snapchatUrl || undefined,
      tiktokUrl: form.tiktokUrl || undefined,
      facebookUrl: form.facebookUrl || undefined,
      notes: form.notes || undefined,
    });
  };

  const platformColor = platform.id === "instagram" ? "bg-pink-700 hover:bg-pink-600" :
    platform.id === "snapchat" ? "bg-yellow-700 hover:bg-yellow-600" :
    platform.id === "tiktok" ? "bg-cyan-700 hover:bg-cyan-600" :
    platform.id === "twitter" ? "bg-sky-700 hover:bg-sky-600" :
    platform.id === "facebook" ? "bg-blue-700 hover:bg-blue-600" :
    platform.id === "maroof" ? "bg-emerald-700 hover:bg-emerald-600" :
    "bg-zinc-700 hover:bg-zinc-600";

  return (
    <div className="space-y-3">
      {/* AI Strategy Panel */}
      <Card className="border border-violet-700 bg-violet-900/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <Bot className="w-4 h-4 text-violet-400" />
            مساعد الذكاء الاصطناعي — {platform.nameAr}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            onClick={() => generateStrategy.mutate({ platform: platform.id, businessType: query, city, country: "السعودية" })}
            disabled={generateStrategy.isPending}
            variant="outline"
            className="w-full gap-2 border-violet-600 text-violet-300 hover:bg-violet-800/40 text-sm"
          >
            {generateStrategy.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {generateStrategy.isPending ? "جاري توليد استراتيجية البحث..." : "✨ ولّد استراتيجية بحث بالذكاء الاصطناعي"}
          </Button>

          {strategy && showStrategy && (
            <div className="space-y-2 text-xs">
              {/* Keywords */}
              <div className="bg-zinc-800/60 rounded-lg p-3">
                <p className="text-violet-400 font-medium mb-2">🔍 كلمات البحث والهاشتاقات:</p>
                <div className="flex flex-wrap gap-1">
                  {strategy.keywords?.map((kw: string, i: number) => (
                    <span key={i} className="px-2 py-0.5 rounded-full bg-violet-800/50 text-violet-200 border border-violet-700">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
              {/* Strategy */}
              <div className="bg-zinc-800/60 rounded-lg p-3">
                <p className="text-violet-400 font-medium mb-1">📋 استراتيجية البحث:</p>
                <p className="text-zinc-300 leading-relaxed whitespace-pre-line">{strategy.strategy}</p>
              </div>
              {/* Quality Signals */}
              <div className="bg-zinc-800/60 rounded-lg p-3">
                <p className="text-violet-400 font-medium mb-1">✅ علامات الحساب التجاري الحقيقي:</p>
                <ul className="space-y-0.5">
                  {strategy.qualitySignals?.map((s: string, i: number) => (
                    <li key={i} className="text-zinc-300 flex items-start gap-1"><span className="text-green-400 mt-0.5">•</span>{s}</li>
                  ))}
                </ul>
              </div>
              {/* Contact Angle */}
              <div className="bg-zinc-800/60 rounded-lg p-3">
                <p className="text-violet-400 font-medium mb-1">🎯 زاوية التواصل:</p>
                <p className="text-zinc-300">{strategy.contactAngle}</p>
              </div>
              {/* Platform Tips */}
              <div className="bg-zinc-800/60 rounded-lg p-3">
                <p className="text-violet-400 font-medium mb-1">💡 نصائح {platform.nameAr}:</p>
                <p className="text-zinc-300">{strategy.platformTips}</p>
              </div>
              <button onClick={() => setShowStrategy(false)} className="text-zinc-500 text-xs hover:text-zinc-300">↑ إخفاء الاستراتيجية</button>
            </div>
          )}
          {strategy && !showStrategy && (
            <button onClick={() => setShowStrategy(true)} className="text-violet-400 text-xs hover:text-violet-300">↓ عرض الاستراتيجية</button>
          )}
        </CardContent>
      </Card>

      {/* Manual Form */}
      <Card className={`border ${platform.borderColor} ${platform.bgColor}`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <span className={platform.color}>{platform.icon}</span>
            نموذج استخراج البيانات — {platform.nameAr}
            <button onClick={onClose} className="mr-auto text-zinc-500 hover:text-white">
              <XCircle className="w-4 h-4" />
            </button>
          </CardTitle>
          <p className="text-zinc-500 text-xs">
            ابحث في {platform.nameAr} ثم انسخ البيانات هنا — الذكاء الاصطناعي يقيّم العميل قبل الحفظ
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-zinc-400 text-xs mb-1 block">اسم النشاط *</label>
              <Input value={form.companyName} onChange={e => set("companyName", e.target.value)}
                placeholder="اسم الحساب أو النشاط"
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 h-8 text-sm" />
            </div>
            <div>
              <label className="text-zinc-400 text-xs mb-1 block">رقم الهاتف</label>
              <Input value={form.verifiedPhone} onChange={e => set("verifiedPhone", e.target.value)}
                placeholder="+966..."
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 h-8 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-zinc-400 text-xs mb-1 block">رابط الموقع</label>
              <Input value={form.website} onChange={e => set("website", e.target.value)}
                placeholder="https://..."
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 h-8 text-sm" />
            </div>
            <div>
              <label className="text-zinc-400 text-xs mb-1 block">رابط الحساب على {platform.nameAr}</label>
              <Input
                value={platform.id === "instagram" ? form.instagramUrl : platform.id === "snapchat" ? form.snapchatUrl : platform.id === "tiktok" ? form.tiktokUrl : form.facebookUrl}
                onChange={e => set(
                  platform.id === "instagram" ? "instagramUrl" : platform.id === "snapchat" ? "snapchatUrl" : platform.id === "tiktok" ? "tiktokUrl" : "facebookUrl",
                  e.target.value
                )}
                placeholder={`رابط حساب ${platform.nameAr}`}
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 h-8 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-zinc-400 text-xs mb-1 block">ملاحظات</label>
            <Input value={form.notes} onChange={e => set("notes", e.target.value)}
              placeholder="أي ملاحظات إضافية..."
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 h-8 text-sm" />
          </div>

          {/* AI Evaluate Button */}
          {form.companyName && (
            <Button
              onClick={() => evaluateLead.mutate({
                companyName: form.companyName,
                platform: platform.id,
                businessType: form.businessType,
                profileUrl: platform.id === "instagram" ? form.instagramUrl : platform.id === "snapchat" ? form.snapchatUrl : platform.id === "tiktok" ? form.tiktokUrl : form.facebookUrl,
                notes: form.notes,
              })}
              disabled={evaluateLead.isPending}
              variant="outline"
              className="w-full gap-2 border-amber-600 text-amber-300 hover:bg-amber-900/30 text-sm"
            >
              {evaluateLead.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
              {evaluateLead.isPending ? "جاري تقييم العميل..." : "🤖 قيّم هذا العميل بالذكاء الاصطناعي"}
            </Button>
          )}

          {/* AI Evaluation Result */}
          {evaluation && (
            <div className="bg-amber-900/20 border border-amber-700 rounded-lg p-3 space-y-2 text-xs">
              <p className="text-amber-400 font-medium">🤖 تقييم الذكاء الاصطناعي:</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-zinc-800/60 rounded p-2">
                  <p className="text-zinc-500">درجة الجودة</p>
                  <p className="text-amber-300 font-bold text-lg">{evaluation.qualityScore}/10</p>
                </div>
                <div className="bg-zinc-800/60 rounded p-2">
                  <p className="text-zinc-500">مستوى الاهتمام</p>
                  <p className="text-amber-300 font-medium">{evaluation.interestLevel}</p>
                </div>
              </div>
              <div className="bg-zinc-800/60 rounded p-2">
                <p className="text-zinc-500 mb-0.5">نقطة الضعف التسويقية:</p>
                <p className="text-red-300">{evaluation.mainWeakness}</p>
              </div>
              <div className="bg-zinc-800/60 rounded p-2">
                <p className="text-zinc-500 mb-0.5">توصية التواصل:</p>
                <p className="text-green-300">{evaluation.recommendation}</p>
              </div>
            </div>
          )}

          <Button
            onClick={handleSave}
            disabled={createLead.isPending}
            className={`w-full gap-2 text-white ${platformColor}`}
          >
            {createLead.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            حفظ العميل
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ====== الصفحة الرئيسية ======
export default function SearchEngine() {
  const [, navigate] = useLocation();
  const {
    clearSession,
    setSelectedPlatforms,
    setTargetCount: setSearchTargetCount,
    setAutoSave,
    setAutoMerge,
  } = useSearch();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>(PLATFORMS[0]);
  const [selectedCountry, setSelectedCountry] = useState("السعودية");
  const [selectedCity, setSelectedCity] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [jobName, setJobName] = useState("");
  const [targetCount, setTargetCount] = useState(50);
  const [expandedJob, setExpandedJob] = useState<number | null>(null);
  const [manualPlatform, setManualPlatform] = useState<Platform | null>(null);

  const cities = COUNTRIES_DATA.find(c => c.name === selectedCountry)?.cities ?? [];

  const { data: jobs = [], refetch } = trpc.searchJobs.list.useQuery(undefined, {
    refetchInterval: 3000,
  });

  const createMutation = trpc.searchJobs.create.useMutation({
    onSuccess: (data) => {
      toast.success(`تم إنشاء المهمة بـ ${data.keywords.length} كلمات بحث`);
      setShowCreateForm(false);
      setJobName("");
      setBusinessType("");
      refetch();
    },
    onError: (err) => toast.error(`خطأ: ${err.message}`),
  });

  const startMutation = trpc.searchJobs.start.useMutation({
    onSuccess: () => { toast.success("بدأ محرك البحث!"); refetch(); },
    onError: (err) => toast.error(`خطأ: ${err.message}`),
  });

  const pauseMutation = trpc.searchJobs.pause.useMutation({
    onSuccess: () => { toast.info("تم إيقاف المهمة مؤقتاً"); refetch(); },
  });

  const deleteMutation = trpc.searchJobs.delete.useMutation({
    onSuccess: () => { toast.success("تم حذف المهمة"); refetch(); },
  });

  const handleCreate = () => {
    if (!businessType.trim()) return toast.error("أدخل نوع النشاط");
    if (!selectedCity) return toast.error("اختر المدينة");

    const hubPlatforms = getSearchHubPlatforms(selectedPlatform.id);
    if (hubPlatforms && hubPlatforms.length > 0) {
      const effectiveLimit = Math.min(targetCount, 50);
      if (targetCount > 50) {
        toast.info("المحرك الجديد يدعم حتى 50 نتيجة في التشغيل الواحد حاليًا", {
          description: `سيتم استخدام ${effectiveLimit} نتيجة بدلًا من ${targetCount}`,
        });
      }

      clearSession();
      setSelectedPlatforms(hubPlatforms);
      setSearchTargetCount(effectiveLimit);
      setAutoSave(false);
      setAutoMerge(false);

      const params = new URLSearchParams({
        keyword: businessType.trim(),
        city: selectedCity,
        limit: String(effectiveLimit),
        targetCount: String(effectiveLimit),
        tab: hubPlatforms[0],
        platforms: hubPlatforms.join(","),
        autorun: "1",
        from: "search-engine",
      });

      setManualPlatform(null);
      setShowCreateForm(false);
      navigate(`/search-hub?${params.toString()}`);
      return;
    }

    // المنصات اليدوية: افتح رابط البحث + أظهر نموذج الاستخراج
    if (selectedPlatform.mode === "manual" && selectedPlatform.id !== "all") {
      const url = selectedPlatform.buildSearchUrl?.(businessType, selectedCity);
      if (url) window.open(url, "_blank");
      setManualPlatform(selectedPlatform);
      setShowCreateForm(false);
      return;
    }

    // Google Maps أو الكل: أنشئ مهمة تلقائية
    if (selectedPlatform.id === "all") {
      // افتح المنصات اليدوية في تبويبات
      PLATFORMS.filter(p => p.mode === "manual" && p.id !== "all").forEach(p => {
        const url = p.buildSearchUrl?.(businessType, selectedCity);
        if (url) window.open(url, "_blank");
      });
    }

    const name = jobName || `${businessType} - ${selectedCity} (${selectedPlatform.nameAr})`;
    createMutation.mutate({
      jobName: name,
      country: selectedCountry,
      city: selectedCity,
      businessType: businessType.trim(),
      targetCount,
    });
  };

  const totalAdded = jobs.reduce((s, j) => s + (j.totalAdded ?? 0), 0);
  const runningCount = jobs.filter(j => j.status === "running").length;
  const completedCount = jobs.filter(j => j.status === "completed").length;
  const selectedPlatformHubTargets = getSearchHubPlatforms(selectedPlatform.id);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bot className="w-7 h-7 text-blue-400" />
            محرك البحث الذكي
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            ابحث عن العملاء عبر منصات متعددة — تلقائي أو يدوي مساعد
          </p>
        </div>
        <Button
          onClick={() => { setShowCreateForm(!showCreateForm); setManualPlatform(null); }}
          className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
        >
          <Plus className="w-4 h-4" />
          مهمة بحث جديدة
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-blue-900/50 rounded-lg"><Zap className="w-5 h-5 text-blue-400" /></div>
            <div><p className="text-zinc-400 text-xs">مهام نشطة</p><p className="text-white text-xl font-bold">{runningCount}</p></div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-green-900/50 rounded-lg"><Users className="w-5 h-5 text-green-400" /></div>
            <div><p className="text-zinc-400 text-xs">إجمالي العملاء المُضافين</p><p className="text-white text-xl font-bold">{totalAdded}</p></div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-purple-900/50 rounded-lg"><CheckCircle2 className="w-5 h-5 text-purple-400" /></div>
            <div><p className="text-zinc-400 text-xs">مهام مكتملة</p><p className="text-white text-xl font-bold">{completedCount}</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <Card className="bg-zinc-900 border-zinc-700 border-dashed">
          <CardHeader>
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Search className="w-4 h-4 text-blue-400" />
              إنشاء مهمة بحث جديدة
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Platform Selector */}
            <div>
              <label className="text-zinc-400 text-xs mb-2 block">اختر المنصة</label>
              <div className="grid grid-cols-4 gap-2">
                {PLATFORMS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPlatform(p)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                      selectedPlatform.id === p.id
                        ? `${p.bgColor} ${p.borderColor} ${p.color}`
                        : "bg-zinc-800 border-zinc-700 text-zinc-500 hover:border-zinc-500"
                    }`}
                  >
                    <span className={selectedPlatform.id === p.id ? p.color : "text-zinc-500"}>{p.icon}</span>
                    <span className="text-xs font-medium">{p.nameAr}</span>
                    <span className={`text-[10px] ${selectedPlatform.id === p.id ? "opacity-80" : "opacity-50"}`}>
                      {p.mode === "auto" ? "🤖 تلقائي" : "👤 يدوي"}
                    </span>
                  </button>
                ))}
              </div>

              {/* Platform description */}
              <div className={`mt-2 p-3 rounded-lg border ${selectedPlatform.bgColor} ${selectedPlatform.borderColor}`}>
                <p className={`text-xs font-medium ${selectedPlatform.color}`}>{selectedPlatform.modeLabel} — {selectedPlatform.nameAr}</p>
                <p className="text-zinc-400 text-xs mt-1">{selectedPlatform.description}</p>
              </div>
            </div>

            {/* Country + City */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-zinc-400 text-xs mb-1 block">الدولة</label>
                <Select value={selectedCountry} onValueChange={(v) => { setSelectedCountry(v); setSelectedCity(""); }}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    {COUNTRIES_DATA.map(c => (
                      <SelectItem key={c.code} value={c.name} className="text-white hover:bg-zinc-700">
                        {c.flag} {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-zinc-400 text-xs mb-1 block">المدينة</label>
                <Select value={selectedCity} onValueChange={setSelectedCity}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                    <SelectValue placeholder="اختر المدينة..." />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700 max-h-60">
                    {cities.map(city => (
                      <SelectItem key={city} value={city} className="text-white hover:bg-zinc-700">{city}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Business Type */}
            <div>
              <label className="text-zinc-400 text-xs mb-1 block">نوع النشاط التجاري</label>
              <Input
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                placeholder="مثال: ملحمة، مطعم، صيدلية..."
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {BUSINESS_PRESETS.map(p => (
                  <button key={p} onClick={() => setBusinessType(p)}
                    className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                      businessType === p
                        ? "bg-blue-600 border-blue-500 text-white"
                        : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"
                    }`}>{p}</button>
                ))}
              </div>
            </div>

            {/* Target count (only for auto) */}
            {(selectedPlatform.mode === "auto" || selectedPlatform.id === "all") && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 text-xs mb-1 block">اسم المهمة (اختياري)</label>
                  <Input value={jobName} onChange={(e) => setJobName(e.target.value)}
                    placeholder="اسم وصفي للمهمة..."
                    className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500" />
                </div>
                <div>
                  <label className="text-zinc-400 text-xs mb-1 block">عدد العملاء المستهدف</label>
                  <Select value={String(targetCount)} onValueChange={(v) => setTargetCount(Number(v))}>
                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-zinc-800 border-zinc-700">
                      {[10, 25, 50, 100, 150, 200, 300, 400, 500, 750, 1000].map(n => (
                        <SelectItem key={n} value={String(n)} className="text-white hover:bg-zinc-700">{n} عميل</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleCreate}
                disabled={createMutation.isPending}
                className={`gap-2 text-white ${selectedPlatform.id === "google_maps" || selectedPlatform.id === "all" ? "bg-blue-600 hover:bg-blue-700" : selectedPlatform.id === "instagram" ? "bg-pink-700 hover:bg-pink-600" : selectedPlatform.id === "snapchat" ? "bg-yellow-700 hover:bg-yellow-600" : selectedPlatform.id === "tiktok" ? "bg-cyan-700 hover:bg-cyan-600" : selectedPlatform.id === "twitter" ? "bg-sky-700 hover:bg-sky-600" : selectedPlatform.id === "facebook" ? "bg-blue-700 hover:bg-blue-600" : "bg-emerald-700 hover:bg-emerald-600"}`}
              >
                {createMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> :
                  selectedPlatformHubTargets ? <Search className="w-4 h-4" /> :
                  selectedPlatform.mode === "manual" ? <ExternalLink className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {selectedPlatformHubTargets ? "ابدأ بالمحرك الجديد" :
                  selectedPlatform.mode === "manual" ? `افتح ${selectedPlatform.nameAr}` : "ابدأ البحث التلقائي"}
              </Button>
              <Button variant="outline" onClick={() => setShowCreateForm(false)}
                className="border-zinc-700 text-zinc-400 hover:text-white bg-transparent">إلغاء</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manual Extraction Form */}
      {manualPlatform && (
        <ManualExtractForm
          platform={manualPlatform}
          query={businessType}
          city={selectedCity}
          onClose={() => setManualPlatform(null)}
        />
      )}

      {/* Quick Manual Access */}
      {!showCreateForm && !manualPlatform && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <p className="text-zinc-400 text-xs mb-3 flex items-center gap-1">
              <ExternalLink className="w-3 h-3" /> وصول سريع للمنصات اليدوية
            </p>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.filter(p => p.mode === "manual" && p.id !== "all").map(p => (
                <button
                  key={p.id}
                  onClick={() => setManualPlatform(p)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-all ${p.bgColor} ${p.borderColor} ${p.color} hover:opacity-80`}
                >
                  {p.icon}
                  {p.nameAr}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Jobs List */}
      <div className="space-y-3">
        <h2 className="text-zinc-300 text-sm font-medium flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          مهام البحث التلقائي (Google Maps)
        </h2>
        {jobs.length === 0 ? (
          <div className="text-center py-12 text-zinc-500">
            <Bot className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg">لا توجد مهام بحث تلقائي بعد</p>
            <p className="text-sm mt-1">أنشئ مهمة جديدة واختر "خرائط جوجل" للبحث التلقائي</p>
          </div>
        ) : (
          jobs.map((job) => {
            const cfg = STATUS_CONFIG[job.status as JobStatus] ?? STATUS_CONFIG.pending;
            const progress = job.targetCount > 0 ? Math.min(100, (job.totalAdded / job.targetCount) * 100) : 0;
            const logs = (job.log as LogEntry[]) ?? [];
            const isExpanded = expandedJob === job.id;

            return (
              <Card key={job.id} className="bg-zinc-900 border-zinc-800 overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-white font-semibold text-sm truncate">{job.jobName}</h3>
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${cfg.color}`}>
                          {cfg.icon} {cfg.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                        <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> {job.country}</span>
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {job.city}</span>
                        <span className="flex items-center gap-1"><Search className="w-3 h-3" /> {job.businessType}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {(job.status === "pending" || job.status === "paused") && (
                        <Button size="sm" onClick={() => startMutation.mutate({ id: job.id })}
                          disabled={startMutation.isPending}
                          className="bg-green-700 hover:bg-green-600 text-white h-7 px-3 text-xs gap-1">
                          <Play className="w-3 h-3" /> ابدأ
                        </Button>
                      )}
                      {job.status === "running" && (
                        <Button size="sm" onClick={() => pauseMutation.mutate({ id: job.id })}
                          className="bg-yellow-700 hover:bg-yellow-600 text-white h-7 px-3 text-xs gap-1">
                          <Pause className="w-3 h-3" /> إيقاف
                        </Button>
                      )}
                      <Button size="sm" variant="ghost"
                        onClick={() => setExpandedJob(isExpanded ? null : job.id)}
                        className="text-zinc-400 hover:text-white h-7 px-2">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                      <Button size="sm" variant="ghost"
                        onClick={() => deleteMutation.mutate({ id: job.id })}
                        className="text-red-500 hover:text-red-400 hover:bg-red-900/20 h-7 px-2">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-xs text-zinc-500">
                      <span>
                        {job.status === "running" && job.currentKeyword && (
                          <span className="text-blue-400">🔍 "{job.currentKeyword}"</span>
                        )}
                      </span>
                      <span>{job.totalAdded} / {job.targetCount} عميل</span>
                    </div>
                    <Progress value={progress} className="h-1.5 bg-zinc-800" />
                    <div className="flex gap-4 text-xs text-zinc-600">
                      <span>✅ مضاف: <span className="text-green-400">{job.totalAdded}</span></span>
                      <span>⚡ مكرر: <span className="text-yellow-400">{job.totalDuplicates}</span></span>
                      <span>🔍 فُحص: <span className="text-zinc-400">{job.totalSearched}</span></span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 border-t border-zinc-800 pt-3">
                      <p className="text-zinc-500 text-xs mb-2 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> سجل العمليات
                      </p>
                      <div className="bg-zinc-950 rounded-lg p-3 max-h-48 overflow-y-auto space-y-1 font-mono">
                        {logs.length === 0 ? (
                          <p className="text-zinc-600 text-xs">لا توجد سجلات بعد...</p>
                        ) : (
                          [...logs].reverse().map((entry, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs">
                              {LOG_ICONS[entry.type] ?? LOG_ICONS.info}
                              <span className="text-zinc-500 shrink-0">
                                {new Date(entry.time).toLocaleTimeString("ar-SA")}
                              </span>
                              <span className={
                                entry.type === "success" ? "text-green-400" :
                                entry.type === "warning" ? "text-yellow-400" :
                                entry.type === "error" ? "text-red-400" : "text-zinc-300"
                              }>{entry.message}</span>
                            </div>
                          ))
                        )}
                      </div>
                      {job.searchKeywords && (
                        <div className="mt-2">
                          <p className="text-zinc-500 text-xs mb-1">كلمات البحث المستخدمة:</p>
                          <div className="flex flex-wrap gap-1">
                            {(job.searchKeywords as string[]).map((kw, i) => (
                              <span key={i} className={`text-xs px-2 py-0.5 rounded-full ${
                                job.currentKeyword === kw ? "bg-blue-800 text-blue-200" : "bg-zinc-800 text-zinc-400"
                              }`}>{kw}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Info */}
      <Card className="bg-zinc-900/50 border-zinc-800 border-dashed">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div className="text-sm text-zinc-400 space-y-2">
              <p className="text-white font-medium">الفرق بين التلقائي واليدوي المساعد</p>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2 bg-green-900/20 border border-green-800 rounded-lg">
                  <p className="text-green-400 font-medium mb-1">🤖 تلقائي كامل (Google Maps)</p>
                  <p>يعمل في الخلفية بدون تدخل. يجلب الاسم والهاتف والموقع تلقائياً.</p>
                </div>
                <div className="p-2 bg-yellow-900/20 border border-yellow-800 rounded-lg">
                  <p className="text-yellow-400 font-medium mb-1">👤 يدوي مساعد (سناب، إنستغرام، إلخ)</p>
                  <p>يفتح المنصة ببحث جاهز. أنت تتصفح وتنسخ البيانات في النموذج المساعد.</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
