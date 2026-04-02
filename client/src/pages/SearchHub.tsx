/**
 * مركز البحث الاحترافي - نسخة 3.0
 * Layout ثنائي الأعمدة: نتائج البحث + ماكينة المقارنة والدمج
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Search, MapPin, Instagram, Loader2, Plus, Star, Phone, Globe,
  Building2, ExternalLink, Bot, Video, Camera,
  Users, Zap, CheckCircle2, RefreshCw, X, Target,
  Layers, SlidersHorizontal, CheckCheck, AlertTriangle,
  RotateCcw, Brain, TrendingUp, Sparkles, Clock,
  UserPlus,
  SearchCheck, Link2, BarChart2, Shield, Twitter, Linkedin, Mail,
  Merge, GitMerge, Eye, ArrowRight, ChevronRight
} from "lucide-react";
import { CrossPlatformPanel, type MergedLeadData } from "@/components/CrossPlatformPanel";
import { useSearch } from "@/contexts/SearchContext";
import { SalesFiltersPanel } from "@/components/SalesFiltersPanel";
import { SearchSettingsPanel } from "@/components/SearchSettingsPanel";

// ===== ثوابت =====
const SAUDI_CITIES = [
  "الرياض", "جدة", "مكة المكرمة", "المدينة المنورة", "الدمام",
  "الخبر", "الطائف", "تبوك", "أبها", "القصيم",
  "حائل", "نجران", "جازان", "الجوف", "عرعر",
  "الأحساء", "الجبيل", "ينبع",
  "بريدة", "عنيزة", "خميس مشيط", "الباحة",
  "سكاكا", "القطيف", "الخرج", "الطائف الهدا"
];

const PLATFORMS = [
  { id: "googleWeb",  label: "Google Search", icon: SearchCheck, color: "text-orange-400", bgColor: "bg-orange-500/10", borderColor: "border-orange-500/30", badgeColor: "bg-orange-500/20 text-orange-400 border-orange-500/40" },
  { id: "instagram",  label: "إنستجرام",      icon: Instagram,  color: "text-pink-400",   bgColor: "bg-pink-500/10",   borderColor: "border-pink-500/30",   badgeColor: "bg-pink-500/20 text-pink-400 border-pink-500/40" },
  { id: "tiktok",     label: "تيك توك",       icon: Video,      color: "text-purple-400", bgColor: "bg-purple-500/10", borderColor: "border-purple-500/30", badgeColor: "bg-purple-500/20 text-purple-400 border-purple-500/40" },
  { id: "snapchat",   label: "سناب شات",      icon: Camera,     color: "text-yellow-400", bgColor: "bg-yellow-500/10", borderColor: "border-yellow-500/30", badgeColor: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40" },
  { id: "twitter",    label: "تويتر / X",     icon: Twitter,    color: "text-sky-400",    bgColor: "bg-sky-500/10",    borderColor: "border-sky-500/30",    badgeColor: "bg-sky-500/20 text-sky-400 border-sky-500/40" },
  { id: "linkedin",   label: "لينكدإن",       icon: Linkedin,   color: "text-blue-500",   bgColor: "bg-blue-600/10",   borderColor: "border-blue-600/30",   badgeColor: "bg-blue-600/20 text-blue-500 border-blue-600/40" },
  { id: "facebook",   label: "فيسبوك",        icon: Users,      color: "text-blue-400",   bgColor: "bg-blue-400/10",   borderColor: "border-blue-400/30",   badgeColor: "bg-blue-400/20 text-blue-400 border-blue-400/40" },
] as const;

type PlatformId = typeof PLATFORMS[number]["id"];
const SEARCH_FETCH_LIMIT_OPTIONS = [10, 20, 50] as const;
type SearchFetchLimit = typeof SEARCH_FETCH_LIMIT_OPTIONS[number];

function isPlatformId(value: string | null): value is PlatformId {
  return !!value && PLATFORMS.some((platform) => platform.id === value);
}

function parsePlatformIds(value: string | null): PlatformId[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(isPlatformId);
}

function isSearchFetchLimit(value: number): value is SearchFetchLimit {
  return SEARCH_FETCH_LIMIT_OPTIONS.includes(value as SearchFetchLimit);
}

function getVerificationBadge(result: any): {
  label: string;
  className: string;
  icon: typeof Shield;
} | null {
  switch (result.verificationLevel) {
    case "dataset":
      return {
        label: "موثوق",
        className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
        icon: Shield,
      };
    case "browser_verified":
      return {
        label: "متحقق",
        className: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
        icon: SearchCheck,
      };
    case "candidate_only":
      return {
        label: "مرشح",
        className: "bg-amber-500/15 text-amber-400 border-amber-500/30",
        icon: Target,
      };
    case "serp_fallback":
      return {
        label: "احتياطي",
        className: "bg-slate-500/15 text-slate-300 border-slate-500/30",
        icon: AlertTriangle,
      };
    default:
      return null;
  }
}

// ===== مكون بطاقة نتيجة =====
function ResultCard({ result, onAdd, isDuplicate, platform }: {
  result: any; onAdd: (r: any) => void; isDuplicate?: boolean; platform: typeof PLATFORMS[number];
}) {
  const verificationBadge = getVerificationBadge(result);

  return (
    <Card className={`group transition-all duration-200 ${isDuplicate ? "opacity-60 border-orange-500/30 bg-orange-500/5" : "hover:border-primary/40 hover:shadow-sm"}`}>
      <CardContent className="p-3">
        <div className="flex items-start gap-2.5">
          <div className={`w-8 h-8 rounded-lg ${platform.bgColor} ${platform.borderColor} border flex items-center justify-center shrink-0 mt-0.5`}>
            <platform.icon className={`w-3.5 h-3.5 ${platform.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground text-sm leading-tight truncate">
                  {result.name || result.fullName || result.username || "غير معروف"}
                </h3>
                {result.username && (result.name || result.fullName) && (
                  <p className="text-xs text-muted-foreground">@{result.username}</p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {result.rating && (
                  <span className="flex items-center gap-0.5 text-xs text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded">
                    <Star className="w-2.5 h-2.5 fill-current" />{result.rating}
                  </span>
                )}
                {verificationBadge && (
                  <Badge variant="outline" className={`text-[10px] gap-1 ${verificationBadge.className}`}>
                    <verificationBadge.icon className="w-2.5 h-2.5" />
                    {verificationBadge.label}
                  </Badge>
                )}
                {isDuplicate && (
                  <Badge variant="outline" className="text-xs bg-orange-500/20 text-orange-400 border-orange-400/40 gap-1">
                    <AlertTriangle className="w-2.5 h-2.5" />موجود
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground mb-2">
              {(result.formatted_address || result.city) && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-2.5 h-2.5 shrink-0" />
                  <span className="truncate max-w-[160px]">{result.formatted_address || result.city}</span>
                </span>
              )}
              {(result.phone || result.formatted_phone_number) && (
                <span className="flex items-center gap-1 text-green-400 font-medium">
                  <Phone className="w-2.5 h-2.5 shrink-0" />
                  <span dir="ltr">{result.phone || result.formatted_phone_number}</span>
                </span>
              )}
              {result.followersCount > 0 && (
                <span className="flex items-center gap-1">
                  <Users className="w-2.5 h-2.5 shrink-0" />
                  {result.followersCount.toLocaleString()}
                </span>
              )}
            </div>
            {(result.bio || result.description) && (
              <p className="text-xs text-muted-foreground line-clamp-1 mb-2">{result.bio || result.description}</p>
            )}
            <div className="flex items-center gap-1.5">
              <Button size="sm" onClick={() => onAdd(result)} disabled={isDuplicate} className="h-6 text-xs gap-1 px-2.5">
                {isDuplicate ? <><CheckCheck className="w-3 h-3" />موجود</> : <><Plus className="w-3 h-3" />إضافة</>}
              </Button>
              {(result.url || result.profileUrl) && (
                <Button size="sm" variant="outline" className="h-6 text-xs gap-1 px-2" onClick={() => window.open(result.url || result.profileUrl, "_blank")}>
                  <ExternalLink className="w-2.5 h-2.5" />فتح
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ===== المكون الرئيسي =====
export default function SearchHub() {
  const {
    startSearch, updateResults, updateLoading, updateError,
    getFilteredResults, session, isAnyLoading: ctxAnyLoading,
    totalResults: ctxTotalResults, totalFiltered,
    targetCount, autoSave, autoMerge, selectedPlatforms,
    setSelectedPlatforms, setTargetCount: setSearchTargetCount,
    activeSalesFiltersCount,
  } = useSearch();

  const [keyword, setKeyword] = useState(session?.keyword || "");
  const [city, setCity] = useState(session?.city || "الرياض");
  const [activeTab, setActiveTab] = useState<PlatformId>("googleWeb");
  const [showFilters, setShowFilters] = useState(false);
  const [onlyWithPhone, setOnlyWithPhone] = useState(false);
  const [fetchLimit, setFetchLimit] = useState<SearchFetchLimit>(10);
  const [resultLimit, setResultLimit] = useState(25);

  // نتائج البحث
  const [results, setResults] = useState<Record<PlatformId, any[]>>({
    googleWeb: [], instagram: [], tiktok: [], snapchat: [], twitter: [], linkedin: [], facebook: []
  });
  const [loading, setLoading] = useState<Record<PlatformId, boolean>>({
    googleWeb: false, instagram: false, tiktok: false, snapchat: false, twitter: false, linkedin: false, facebook: false
  });

  // إضافة عميل
  const [addDialog, setAddDialog] = useState<{ open: boolean; result: any | null; platform: PlatformId | "" }>({ open: false, result: null, platform: "" });
  const [addForm, setAddForm] = useState({
    companyName: "", businessType: "", city: "", phone: "", email: "", website: "", notes: "",
    instagramUrl: "", tiktokUrl: "", snapchatUrl: "", twitterUrl: "", facebookUrl: "", linkedinUrl: "",
  });
  const [addedNames, setAddedNames] = useState<Set<string>>(new Set());
  const parsedLaunchRef = useRef(false);
  const autoRunRequestRef = useRef<null | {
    keyword: string;
    city: string;
    limit: SearchFetchLimit;
    tab: PlatformId;
    platforms: PlatformId[];
  }>(null);
  const autoRunStartedRef = useRef(false);

  // API
  const searchInstagramMut = trpc.brightDataSearch.searchInstagramDataset.useMutation();
  const searchTiktokMut = trpc.brightDataSearch.searchTikTokVerified.useMutation();
  const searchSnapchatMut = trpc.brightDataSearch.searchSnapchatVerified.useMutation();
  const searchTwitterMut = trpc.brightDataSearch.searchTwitterVerified.useMutation();
  const searchLinkedInMut = trpc.brightDataSearch.searchLinkedInVerified.useMutation();
  const searchFacebookMut = trpc.brightDataSearch.searchFacebookVerified.useMutation();
  const googleWebSearchMut = trpc.googleSearch.searchWeb.useMutation();
  const suggestHashtagsMut = trpc.socialSearch.suggestSocialHashtags.useMutation();
  const brightDataConnectionQuery = trpc.brightDataSearch.checkConnection.useQuery();
  const createLead = trpc.leads.create.useMutation();
  const enhanceQueryMut = trpc.searchBehavior.enhanceQuery.useMutation();
  const logSearchSessionMut = trpc.searchBehavior.logSearchSession.useMutation();
  const [suggestedHashtags, setSuggestedHashtags] = useState<string[]>([]);
  const [googleWebSearchType, setGoogleWebSearchType] = useState<"businesses" | "general">("businesses");

  // منع التكرار
  const existingLeadsQuery = trpc.leads.getNames.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const existingNames = new Set((existingLeadsQuery.data || []).map((l: any) => (l.name || "").trim().toLowerCase()));
  const isExistingLead = (result: any): boolean => {
    const name = (result.name || result.fullName || "").trim().toLowerCase();
    return name.length > 0 && existingNames.has(name);
  };

  useEffect(() => {
    if (parsedLaunchRef.current) return;
    parsedLaunchRef.current = true;

    const params = new URLSearchParams(window.location.search);
    if (params.get("autorun") !== "1") return;

    const nextKeyword = (params.get("keyword") || "").trim();
    const nextCity = (params.get("city") || "").trim();
    if (!nextKeyword || !nextCity) return;

    const nextLimitRaw = Number(params.get("limit"));
    const nextLimit = isSearchFetchLimit(nextLimitRaw) ? nextLimitRaw : 10;
    const nextTabParam = params.get("tab");
    const nextTab = isPlatformId(nextTabParam) ? nextTabParam : "googleWeb";
    const nextPlatforms = parsePlatformIds(params.get("platforms"));
    const nextTargetCountRaw = Number(params.get("targetCount"));

    setKeyword(nextKeyword);
    setCity(nextCity);
    setFetchLimit(nextLimit);
    setResultLimit(nextLimit);
    setActiveTab(nextTab);

    if (nextPlatforms.length > 0) {
      setSelectedPlatforms(nextPlatforms);
    }

    if (Number.isFinite(nextTargetCountRaw) && nextTargetCountRaw > 0) {
      setSearchTargetCount(Math.min(nextTargetCountRaw, 50));
    }

    autoRunRequestRef.current = {
      keyword: nextKeyword,
      city: nextCity,
      limit: nextLimit,
      tab: nextTab,
      platforms: nextPlatforms,
    };
    autoRunStartedRef.current = false;
  }, [setSearchTargetCount, setSelectedPlatforms]);

  useEffect(() => {
    setResultLimit(fetchLimit);
  }, [fetchLimit]);

  // ===== دوال البحث =====
  const setLoadingPlatform = (platform: PlatformId, val: boolean) => setLoading(prev => ({ ...prev, [platform]: val }));
  const setResultsPlatform = (platform: PlatformId, data: any[]) => setResults(prev => ({ ...prev, [platform]: data }));

  const handleBrightDataError = (e: any, platform: string) => {
    const msg = e?.message || "";
    if (msg.includes("رصيد Bright Data غير كاف")) {
      toast.error("رصيد Bright Data غير كافٍ", { description: "اذهب إلى brightdata.com واشحن حسابك", duration: 8000 });
    } else if (msg.includes("حجبت الوصول")) {
      toast.warning(`المنصة حجبت الوصول مؤقتًا`, { description: "حاول مرة أخرى بعد دقيقة" });
    } else {
      toast.error(`خطأ في ${platform}`, { description: msg });
    }
  };

  const searchGoogleWeb = useCallback(async () => {
    if (!keyword.trim()) return;
    setLoadingPlatform("googleWeb", true); updateLoading("googleWeb", true);
    setResultsPlatform("googleWeb", []); updateResults("googleWeb", []);
    try {
      const res = await googleWebSearchMut.mutateAsync({ keyword, city, searchType: googleWebSearchType, page: 1 });
      const data = res.results || [];
      setResultsPlatform("googleWeb", data); updateResults("googleWeb", data);
      if (!data.length) toast.info("لا توجد نتائج في Google Search");
      else toast.success(`${data.length} نتيجة من Google Search`);
    } catch (e: any) { toast.error("خطأ في Google Search", { description: e.message }); updateError("googleWeb", e.message); }
    finally { setLoadingPlatform("googleWeb", false); updateLoading("googleWeb", false); }
  }, [keyword, city, googleWebSearchType, updateLoading, updateResults, updateError]);

  const searchInstagram = useCallback(async () => {
    if (!keyword.trim()) return;
    setLoadingPlatform("instagram", true); updateLoading("instagram", true);
    setResultsPlatform("instagram", []); updateResults("instagram", []);
    try {
      const res = await searchInstagramMut.mutateAsync({ keyword, location: city, limit: fetchLimit });
      const data = (res as any)?.results || res || [];
      setResultsPlatform("instagram", data); updateResults("instagram", data);
      if (!data.length) toast.info("لا توجد نتائج في إنستجرام");
      else toast.success(`${data.length} نتيجة من إنستجرام`);
    } catch (e: any) { handleBrightDataError(e, "إنستجرام"); updateError("instagram", e.message); }
    finally { setLoadingPlatform("instagram", false); updateLoading("instagram", false); }
  }, [keyword, city, fetchLimit, updateLoading, updateResults, updateError]);

  const searchTiktok = useCallback(async () => {
    if (!keyword.trim()) return;
    setLoadingPlatform("tiktok", true); updateLoading("tiktok", true);
    setResultsPlatform("tiktok", []); updateResults("tiktok", []);
    try {
      const res = await searchTiktokMut.mutateAsync({ keyword, location: city, limit: fetchLimit });
      const data = (res as any)?.results || res || [];
      setResultsPlatform("tiktok", data); updateResults("tiktok", data);
      if (!data.length) toast.info("لا توجد نتائج في تيك توك");
      else toast.success(`${data.length} نتيجة من تيك توك`);
    } catch (e: any) { handleBrightDataError(e, "تيك توك"); updateError("tiktok", e.message); }
    finally { setLoadingPlatform("tiktok", false); updateLoading("tiktok", false); }
  }, [keyword, city, fetchLimit, updateLoading, updateResults, updateError]);

  const searchSnapchat = useCallback(async () => {
    if (!keyword.trim()) return;
    setLoadingPlatform("snapchat", true); updateLoading("snapchat", true);
    setResultsPlatform("snapchat", []); updateResults("snapchat", []);
    try {
      const res = await searchSnapchatMut.mutateAsync({ keyword, location: city, limit: fetchLimit });
      const data = res.results || [];
      setResultsPlatform("snapchat", data); updateResults("snapchat", data);
      if (!data.length) toast.info("لا توجد نتائج في سناب شات");
      else toast.success(`${data.length} نتيجة من سناب شات`);
    } catch (e: any) { handleBrightDataError(e, "سناب شات"); updateError("snapchat", e.message); }
    finally { setLoadingPlatform("snapchat", false); updateLoading("snapchat", false); }
  }, [keyword, city, fetchLimit, updateLoading, updateResults, updateError]);

  const searchTwitter = useCallback(async () => {
    if (!keyword.trim()) return;
    setLoadingPlatform("twitter", true); updateLoading("twitter", true);
    setResultsPlatform("twitter", []); updateResults("twitter", []);
    try {
      const res = await searchTwitterMut.mutateAsync({ keyword, location: city, limit: fetchLimit });
      const data = res.results || [];
      setResultsPlatform("twitter", data); updateResults("twitter", data);
      if (!data.length) toast.info("لا توجد نتائج في تويتر");
      else toast.success(`${data.length} نتيجة من تويتر`);
    } catch (e: any) { handleBrightDataError(e, "تويتر"); updateError("twitter", e.message); }
    finally { setLoadingPlatform("twitter", false); updateLoading("twitter", false); }
  }, [keyword, city, fetchLimit, updateLoading, updateResults, updateError]);

  const searchLinkedIn = useCallback(async () => {
    if (!keyword.trim()) return;
    setLoadingPlatform("linkedin", true); updateLoading("linkedin", true);
    setResultsPlatform("linkedin", []); updateResults("linkedin", []);
    try {
      const res = await searchLinkedInMut.mutateAsync({ keyword, location: city, limit: fetchLimit });
      const data = res.results || [];
      setResultsPlatform("linkedin", data); updateResults("linkedin", data);
      if (!data.length) toast.info("لا توجد نتائج في لينكدإن");
      else toast.success(`${data.length} نتيجة من لينكدإن`);
    } catch (e: any) { handleBrightDataError(e, "لينكدإن"); updateError("linkedin", e.message); }
    finally { setLoadingPlatform("linkedin", false); updateLoading("linkedin", false); }
  }, [keyword, city, fetchLimit, updateLoading, updateResults, updateError]);

  const searchFacebook = useCallback(async () => {
    if (!keyword.trim()) return;
    setLoadingPlatform("facebook", true); updateLoading("facebook", true);
    setResultsPlatform("facebook", []); updateResults("facebook", []);
    try {
      const res = await searchFacebookMut.mutateAsync({ keyword, location: city, limit: fetchLimit });
      const data = res.results || [];
      setResultsPlatform("facebook", data); updateResults("facebook", data);
      if (!data.length) toast.info("لا توجد نتائج في فيسبوك");
      else toast.success(`${data.length} نتيجة من فيسبوك`);
    } catch (e: any) { handleBrightDataError(e, "فيسبوك"); updateError("facebook", e.message); }
    finally { setLoadingPlatform("facebook", false); updateLoading("facebook", false); }
  }, [keyword, city, fetchLimit, updateLoading, updateResults, updateError]);

  const handleSearchAll = useCallback(() => {
    if (!keyword.trim()) { toast.error("أدخل كلمة البحث أولاً"); return; }
    // بدء جلسة بحث جديدة في Context
    startSearch(keyword, city);
    // تشغيل المنصات المختارة فقط
    const platformFns: Record<string, () => void> = {
      googleWeb: searchGoogleWeb, instagram: searchInstagram,
      tiktok: searchTiktok, snapchat: searchSnapchat, twitter: searchTwitter,
      linkedin: searchLinkedIn, facebook: searchFacebook,
    };
    const toRun = selectedPlatforms.length > 0 ? selectedPlatforms : Object.keys(platformFns);
    toRun.forEach(p => platformFns[p]?.());
    toast.info(`بدأ البحث في ${toRun.length} منصة`, {
      description: `حتى ${fetchLimit} نتيجة لكل منصة${fetchLimit > 10 ? "، وقد يستغرق وقتًا أطول" : ""}`,
    });
  }, [keyword, city, fetchLimit, startSearch, selectedPlatforms, searchGoogleWeb, searchInstagram, searchTiktok, searchSnapchat, searchTwitter, searchLinkedIn, searchFacebook]);

  useEffect(() => {
    const request = autoRunRequestRef.current;
    if (!request || autoRunStartedRef.current) return;

    const platformsReady =
      request.platforms.length === 0 ||
      (
        request.platforms.length === selectedPlatforms.length &&
        request.platforms.every((platform) => selectedPlatforms.includes(platform))
      );

    if (
      keyword !== request.keyword ||
      city !== request.city ||
      fetchLimit !== request.limit ||
      !platformsReady
    ) {
      return;
    }

    autoRunStartedRef.current = true;
    setActiveTab(request.tab);
    handleSearchAll();
    autoRunRequestRef.current = null;

    if (window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [keyword, city, fetchLimit, selectedPlatforms, handleSearchAll]);

  const handleSearch = () => {
    const searchFns: Record<PlatformId, () => void> = {
      googleWeb: searchGoogleWeb, instagram: searchInstagram,
      tiktok: searchTiktok, snapchat: searchSnapchat, twitter: searchTwitter,
      linkedin: searchLinkedIn, facebook: searchFacebook,
    };
    searchFns[activeTab]();
  };

  const handleOpenAddDialog = (result: any, platform: PlatformId) => {
    setAddDialog({ open: true, result, platform });
    const username = result.username || result.user_name || result.screen_name || "";
    // بناء روابط المنصات تلقائياً من نتيجة البحث
    const instagramUrl = platform === "instagram" ? (result.profile_url || (username ? `https://instagram.com/${username}` : "")) : "";
    const tiktokUrl = platform === "tiktok" ? (result.profile_url || result.url || (username ? `https://tiktok.com/@${username}` : "")) : "";
    const snapchatUrl = platform === "snapchat" ? (result.profile_url || result.url || (username ? `https://snapchat.com/add/${username}` : "")) : "";
    const twitterUrl = platform === "twitter" ? (result.profile_url || result.url || (username ? `https://twitter.com/${username}` : "")) : "";
    const facebookUrl = platform === "facebook" ? (result.profile_url || result.url || "") : "";
    const linkedinUrl = platform === "linkedin" ? (result.profile_url || result.url || "") : "";
    setAddForm({
      companyName: result.name || result.fullName || result.username || "",
      businessType: result.businessCategory || result.types?.[0] || "",
      city: result.city || city,
      phone: result.phone || result.formatted_phone_number || "",
      email: result.email || "",
      website: result.website || "",
      notes: result.bio || result.description || "",
      instagramUrl, tiktokUrl, snapchatUrl, twitterUrl, facebookUrl, linkedinUrl,
    });
  };

  const handleAddLead = async () => {
    if (!addDialog.result || !addForm.companyName) return;
    try {
      const r = addDialog.result;
      const username = r.username || r.user_name || r.screen_name || "";
      // استخدام الروابط من addForm (قابلة للتعديل من المستخدم)
      const cleanUrls: Record<string, string> = {};
      if (addForm.instagramUrl) cleanUrls.instagramUrl = addForm.instagramUrl;
      if (addForm.tiktokUrl) cleanUrls.tiktokUrl = addForm.tiktokUrl;
      if (addForm.snapchatUrl) cleanUrls.snapchatUrl = addForm.snapchatUrl;
      if (addForm.twitterUrl) cleanUrls.twitterUrl = addForm.twitterUrl;
      if (addForm.facebookUrl) cleanUrls.facebookUrl = addForm.facebookUrl;
      if (addForm.linkedinUrl) cleanUrls.linkedinUrl = addForm.linkedinUrl;
      await createLead.mutateAsync({
        companyName: addForm.companyName,
        businessType: addForm.businessType || "غير محدد",
        city: addForm.city || "غير محدد",
        verifiedPhone: addForm.phone || undefined,
        email: addForm.email || undefined,
        website: addForm.website || undefined,
        notes: addForm.notes || undefined,
        ...cleanUrls,
      });
      setAddedNames(prev => { const next = new Set(prev); next.add(addForm.companyName); return next; });
      toast.success("تمت الإضافة كعميل محتمل", { description: addForm.companyName });
      setAddDialog({ open: false, result: null, platform: "" });
    } catch (e: any) { toast.error("خطأ في الإضافة", { description: e.message }); }
  };

  const handleMergedAdd = async (data: MergedLeadData) => {
    try {
      await createLead.mutateAsync({
        companyName: data.companyName, businessType: data.businessType || "غير محدد", city: data.city || city || "غير محدد",
        verifiedPhone: data.phone || undefined, website: data.website || undefined,
        instagramUrl: data.instagramUrl || undefined, tiktokUrl: data.tiktokUrl || undefined,
        snapchatUrl: data.snapchatUrl || undefined, twitterUrl: data.twitterUrl || undefined,
        linkedinUrl: data.linkedinUrl || undefined, facebookUrl: data.facebookUrl || undefined,
        googleMapsUrl: data.googleMapsUrl || undefined,
        notes: data.sources?.length > 1 ? `تم الدمج من: ${data.sources.join(", ")}` : undefined,
      });
      setAddedNames(prev => { const next = new Set(prev); next.add(data.companyName); return next; });
      toast.success("تمت الإضافة كعميل محتمل", { description: data.sources?.length > 1 ? `${data.companyName} — مدمج من ${data.sources.length} منصات` : data.companyName });
    } catch (e: any) { toast.error("خطأ في الإضافة", { description: e.message }); }
  };

  // إحصائيات
  const totalResults = Object.values(results).reduce((s, r) => s + r.length, 0);
  const isAnyLoading = Object.values(loading).some(Boolean);
  const currentPlatform = PLATFORMS.find(p => p.id === activeTab)!;
  const currentResults = results[activeTab];
  // الفلترة: Context filters أولاً ثم onlyWithPhone المحلي
  const ctxFiltered = getFilteredResults(activeTab);
  const filteredResults = (ctxFiltered.length > 0 || session ? ctxFiltered : currentResults).filter((r: any) => {
    if (onlyWithPhone) {
      const hasPhone = r.phone || r.formatted_phone_number || r.phones?.length > 0;
      if (!hasPhone) return false;
    }
    return true;
  }).slice(0, resultLimit);

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">

      {/* ===== رأس الصفحة ===== */}
      <div className="border-b border-border bg-card px-5 py-3.5 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Target className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground">مركز البحث والاستهداف</h1>
              <p className="text-xs text-muted-foreground">بحث في 7 منصات + مقارنة + دمج ذكي</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* مؤشر البحث في الخلفية */}
            {ctxAnyLoading && (
              <Badge variant="outline" className="text-xs gap-1.5 border-blue-500/40 text-blue-400 bg-blue-500/10 animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" />بحث نشط
              </Badge>
            )}
            {brightDataConnectionQuery.data?.connected ? (
              <Badge variant="outline" className="text-xs gap-1.5 border-green-500/40 text-green-400 bg-green-500/10">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />Bright Data نشط
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs gap-1.5 border-yellow-500/40 text-yellow-400 bg-yellow-500/10">
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />وضع محدود
              </Badge>
            )}
            {totalResults > 0 && (
              <Badge className="text-xs px-2.5 py-1 gap-1.5">
                <Zap className="w-3 h-3" />
                {activeSalesFiltersCount > 0 ? `${totalFiltered} / ${ctxTotalResults}` : ctxTotalResults || totalResults} نتيجة
              </Badge>
            )}
            {/* مكونات الإعدادات */}
            <SalesFiltersPanel />
            <SearchSettingsPanel />
          </div>
        </div>

        {/* شريط البحث الرئيسي */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder="ابحث عن: مطاعم، صالونات، محلات ملابس، عيادات..."
              className="pr-9 text-sm h-10"
              dir="rtl"
            />
          </div>
          <Select value={city} onValueChange={setCity}>
            <SelectTrigger className="w-36 h-10 text-sm shrink-0">
              <MapPin className="w-3.5 h-3.5 ml-1 text-muted-foreground shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="جميع المدن"><span className="font-semibold text-primary">جميع المدن</span></SelectItem>
              <SelectSeparator />
              {SAUDI_CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(fetchLimit)} onValueChange={(value) => setFetchLimit(Number(value) as SearchFetchLimit)}>
            <SelectTrigger className="w-28 h-10 text-sm shrink-0" title="زيادة العدد ترفع وقت وتكلفة البحث">
              <BarChart2 className="w-3.5 h-3.5 ml-1 text-muted-foreground shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SEARCH_FETCH_LIMIT_OPTIONS.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option} نتيجة
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleSearch} disabled={!keyword.trim() || loading[activeTab]} className="h-10 gap-2 px-4 shrink-0">
            {loading[activeTab] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            بحث
          </Button>
          <Button
            variant="outline"
            onClick={handleSearchAll}
            disabled={!keyword.trim() || isAnyLoading}
            className="h-10 gap-2 px-4 shrink-0 border-primary/40 text-primary hover:bg-primary/10"
            title="بحث في كل المنصات الثماني دفعة واحدة"
          >
            {isAnyLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
            بحث في الكل
          </Button>
        </div>

        {/* شريط المنصات السريع */}
        <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
          {PLATFORMS.map(p => {
            const count = results[p.id].length;
            const isLoading = loading[p.id];
            return (
              <button
                key={p.id}
                onClick={() => setActiveTab(p.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
                  activeTab === p.id
                    ? `${p.bgColor} ${p.borderColor} ${p.color}`
                    : "bg-muted/30 border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {isLoading ? <Loader2 className={`w-3 h-3 animate-spin ${p.color}`} /> : <p.icon className={`w-3 h-3 ${activeTab === p.id ? p.color : ""}`} />}
                {p.label}
                {count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${activeTab === p.id ? p.badgeColor : "bg-muted text-muted-foreground"}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
          <div className="mr-auto flex items-center gap-1.5">
            <button
              onClick={() => setOnlyWithPhone(!onlyWithPhone)}
              className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition-all ${onlyWithPhone ? "bg-green-500/15 border-green-500/40 text-green-400" : "bg-muted/30 border-border text-muted-foreground hover:text-foreground"}`}
            >
              <Phone className="w-3 h-3" />{onlyWithPhone ? "✓ أرقام فقط" : "أرقام فقط"}
            </button>
          </div>
        </div>

        {/* هاشتاقات مقترحة */}
        {suggestedHashtags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5 items-center">
            <span className="text-xs text-muted-foreground">مقترح:</span>
            {suggestedHashtags.map((h, i) => (
              <button key={i} onClick={() => { setKeyword(h.replace(/^#/, "")); setSuggestedHashtags([]); }} className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/20">
                #{h.replace(/^#/, "")}
              </button>
            ))}
            <button onClick={() => setSuggestedHashtags([])} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}
      </div>

      {/* ===== المحتوى الرئيسي — عمودان ===== */}
      <div className="flex-1 min-h-0 flex overflow-hidden">

        {/* ===== العمود الأيسر: نتائج البحث ===== */}
        <div className="flex-1 min-w-0 flex flex-col border-l border-border overflow-hidden">
          {/* شريط أدوات المنصة الحالية */}
          <div className={`flex items-center justify-between gap-3 px-4 py-2.5 ${currentPlatform.bgColor} border-b ${currentPlatform.borderColor} shrink-0`}>
            <div className="flex items-center gap-2">
              <currentPlatform.icon className={`w-4 h-4 ${currentPlatform.color}`} />
              <span className="text-sm font-semibold text-foreground">{currentPlatform.label}</span>
              {loading[activeTab] ? (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" />جاري البحث...
                </span>
              ) : currentResults.length > 0 ? (
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${currentPlatform.badgeColor}`}>
                  {currentResults.length} نتيجة
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-1.5">
              {(activeTab === "instagram" || activeTab === "tiktok" || activeTab === "snapchat") && (
                <Button variant="ghost" size="sm" onClick={async () => {
                  if (!keyword.trim()) return;
                  try {
                    const res = await suggestHashtagsMut.mutateAsync({ keyword, platform: activeTab });
                    setSuggestedHashtags((res as any)?.hashtags || res || []);
                  } catch { toast.error("خطأ في اقتراح الهاشتاقات"); }
                }} disabled={!keyword.trim() || suggestHashtagsMut.isPending} className="h-7 text-xs gap-1">
                  {suggestHashtagsMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />}
                  هاشتاقات AI
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={async () => {
                if (!keyword.trim()) return;
                try {
                  const res = await enhanceQueryMut.mutateAsync({ query: keyword, platform: activeTab });
                  if (res.suggestions?.length) setSuggestedHashtags(res.suggestions);
                  toast.success("تم تحسين الاستعلام", { description: res.enhanced || "" });
                } catch { toast.error("خطأ في تحسين الاستعلام"); }
              }} disabled={!keyword.trim() || enhanceQueryMut.isPending} className="h-7 text-xs gap-1">
                {enhanceQueryMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                تحسين AI
              </Button>
              {currentResults.length > 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setResultsPlatform(activeTab, [])}>
                  <RotateCcw className="w-3 h-3" />مسح
                </Button>
              )}
            </div>
          </div>

          {/* قائمة النتائج */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            {loading[activeTab] ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className={`w-8 h-8 animate-spin ${currentPlatform.color}`} />
                <p className="text-sm text-muted-foreground">جاري البحث في {currentPlatform.label}...</p>
              </div>
            ) : filteredResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <div className={`w-14 h-14 rounded-2xl ${currentPlatform.bgColor} ${currentPlatform.borderColor} border flex items-center justify-center`}>
                  <currentPlatform.icon className={`w-7 h-7 ${currentPlatform.color}`} />
                </div>
                {keyword ? (
                  <>
                    <h3 className="font-semibold text-foreground">ابدأ البحث في {currentPlatform.label}</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">اضغط "بحث" للعثور على الأنشطة التجارية المرتبطة بـ "{keyword}"</p>
                    <Button onClick={handleSearch} className="gap-2 mt-1">
                      <Search className="w-4 h-4" />بحث في {currentPlatform.label}
                    </Button>
                  </>
                ) : (
                  <>
                    <h3 className="font-semibold text-foreground">أدخل كلمة البحث</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">اكتب نوع النشاط التجاري في شريط البحث أعلاه</p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                {/* شريط إضافة الكل */}
                {filteredResults.length > 1 && (
                  <div className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg border border-border mb-3">
                    <span className="text-xs text-muted-foreground">{filteredResults.length} نتيجة — {filteredResults.filter(r => !isExistingLead(r)).length} جديدة</span>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={async () => {
                      const newOnes = filteredResults.filter(r => !isExistingLead(r));
                      if (!newOnes.length) { toast.info("جميع النتائج موجودة مسبقاً"); return; }
                      let added = 0;
                      for (const r of newOnes.slice(0, 20)) {
                        try {
                          await createLead.mutateAsync({ companyName: r.name || r.fullName || r.username || "غير معروف", businessType: r.businessCategory || "غير محدد", city: r.city || city || "غير محدد", verifiedPhone: r.phone || r.formatted_phone_number || undefined, website: r.website || undefined });
                          added++;
                        } catch { /* تجاهل */ }
                      }
                      toast.success(`تمت إضافة ${added} عميل دفعة واحدة`);
                      existingLeadsQuery.refetch();
                    }}>
                      <UserPlus className="w-3 h-3" />إضافة الكل ({Math.min(filteredResults.filter(r => !isExistingLead(r)).length, 20)})
                    </Button>
                  </div>
                )}
                {filteredResults.map((result: any, i: number) => (
                  <ResultCard
                    key={result.place_id || result.id || result.username || i}
                    result={result}
                    onAdd={r => handleOpenAddDialog(r, activeTab)}
                    isDuplicate={isExistingLead(result)}
                    platform={currentPlatform}
                  />
                ))}
                {currentResults.length > resultLimit && (
                  <div className="text-center pt-2">
                    <Button variant="ghost" size="sm" onClick={() => setResultLimit(l => l + 25)} className="text-xs gap-1">
                      عرض المزيد ({currentResults.length - resultLimit} متبقية)
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ===== العمود الأيمن: ماكينة المقارنة والدمج ===== */}
        <div className="w-[420px] shrink-0 flex flex-col border-r border-border bg-card/50 overflow-hidden">
          {/* رأس اللوحة */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border bg-gradient-to-l from-primary/5 to-transparent shrink-0">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <GitMerge className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold text-foreground">ماكينة المقارنة والدمج</h2>
              <p className="text-xs text-muted-foreground">يجمع نفس النشاط من منصات مختلفة ويدمجها في lead واحد</p>
            </div>
            {isAnyLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />}
          </div>

          {/* شريط حالة البحث في المنصات */}
          <div className="grid grid-cols-4 gap-1 p-3 border-b border-border shrink-0">
            {PLATFORMS.map(p => {
              const count = results[p.id].length;
              const isLoading = loading[p.id];
              return (
                <div key={p.id} className={`flex flex-col items-center gap-1 p-1.5 rounded-lg border text-center transition-all ${count > 0 ? `${p.bgColor} ${p.borderColor}` : "bg-muted/20 border-border"}`}>
                  {isLoading ? <Loader2 className={`w-3.5 h-3.5 animate-spin ${p.color}`} /> : <p.icon className={`w-3.5 h-3.5 ${count > 0 ? p.color : "text-muted-foreground/40"}`} />}
                  <span className={`text-[9px] font-medium leading-tight ${count > 0 ? p.color : "text-muted-foreground/40"}`}>{p.label.split(" ")[0]}</span>
                  <span className={`text-[10px] font-bold ${count > 0 ? p.color : "text-muted-foreground/30"}`}>{isLoading ? "..." : count}</span>
                </div>
              );
            })}
          </div>

          {/* CrossPlatformPanel */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {totalResults === 0 && !isAnyLoading ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <GitMerge className="w-8 h-8 text-primary/60" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">ابدأ البحث لتفعيل الدمج</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed max-w-[260px]">
                    ابحث في منصة واحدة أو أكثر، وستظهر هنا المجموعات المتطابقة تلقائياً مع إمكانية دمجها في عميل واحد
                  </p>
                </div>
                <div className="flex flex-col gap-2 w-full max-w-[200px]">
                  <Button onClick={handleSearchAll} disabled={!keyword.trim()} className="gap-2 w-full">
                    <Layers className="w-4 h-4" />بحث في الكل
                  </Button>
                  <p className="text-[10px] text-muted-foreground">يبحث في 7 منصات دفعة واحدة</p>
                </div>
                {/* شرح الخطوات */}
                <div className="w-full border border-border rounded-xl p-3 text-right space-y-2 mt-2">
                  <p className="text-xs font-semibold text-foreground mb-2">كيف يعمل الدمج الذكي؟</p>
                  {[
                    { step: "1", label: "ابحث في كل المنصات", icon: Search },
                    { step: "2", label: "يكتشف النظام التطابقات", icon: Eye },
                    { step: "3", label: "اضغط دمج لتوحيد البيانات", icon: Merge },
                    { step: "4", label: "يُحفظ كعميل محتمل واحد", icon: CheckCircle2 },
                  ].map(({ step, label, icon: Icon }) => (
                    <div key={step} className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-primary">{step}</span>
                      </div>
                      <Icon className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-3">
                <CrossPlatformPanel
                  results={results}
                  loading={loading}
                  keyword={keyword}
                  city={city}
                  onAddLead={handleMergedAdd}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== نافذة إضافة عميل ===== */}
      <Dialog open={addDialog.open} onOpenChange={open => !open && setAddDialog({ open: false, result: null, platform: "" })}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-primary" />
              إضافة كعميل محتمل
              {addDialog.platform && (
                <span className="text-xs text-muted-foreground font-normal">
                  — من {PLATFORMS.find(p => p.id === addDialog.platform)?.label}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* البيانات الأساسية */}
            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">البيانات الأساسية</p>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">اسم النشاط *</Label>
                <Input value={addForm.companyName} onChange={e => setAddForm(f => ({ ...f, companyName: e.target.value }))} className="h-9 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">نوع النشاط</Label>
                  <Input value={addForm.businessType} onChange={e => setAddForm(f => ({ ...f, businessType: e.target.value }))} className="h-9 text-sm" placeholder="مطعم، صالون..." />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">المدينة</Label>
                  <Input value={addForm.city} onChange={e => setAddForm(f => ({ ...f, city: e.target.value }))} className="h-9 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1"><Phone className="w-3 h-3" />رقم الهاتف</Label>
                  <Input value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} className="h-9 text-sm font-mono" dir="ltr" placeholder="+966..." />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1"><Mail className="w-3 h-3" />الإيميل</Label>
                  <Input value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} className="h-9 text-sm" dir="ltr" placeholder="info@example.com" type="email" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1"><Globe className="w-3 h-3" />الموقع الإلكتروني</Label>
                <Input value={addForm.website} onChange={e => setAddForm(f => ({ ...f, website: e.target.value }))} className="h-9 text-sm" dir="ltr" placeholder="https://..." />
              </div>
            </div>

            {/* روابط السوشيال */}
            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">روابط السوشيال ميديا</p>
              {(addForm.instagramUrl || addDialog.platform === "instagram") && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1"><Instagram className="w-3 h-3 text-pink-400" />إنستجرام</Label>
                  <Input value={addForm.instagramUrl} onChange={e => setAddForm(f => ({ ...f, instagramUrl: e.target.value }))} className="h-8 text-xs" dir="ltr" placeholder="https://instagram.com/..." />
                </div>
              )}
              {(addForm.tiktokUrl || addDialog.platform === "tiktok") && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1"><Video className="w-3 h-3 text-purple-400" />تيك توك</Label>
                  <Input value={addForm.tiktokUrl} onChange={e => setAddForm(f => ({ ...f, tiktokUrl: e.target.value }))} className="h-8 text-xs" dir="ltr" placeholder="https://tiktok.com/@..." />
                </div>
              )}
              {(addForm.snapchatUrl || addDialog.platform === "snapchat") && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1"><Camera className="w-3 h-3 text-yellow-400" />سناب شات</Label>
                  <Input value={addForm.snapchatUrl} onChange={e => setAddForm(f => ({ ...f, snapchatUrl: e.target.value }))} className="h-8 text-xs" dir="ltr" placeholder="https://snapchat.com/add/..." />
                </div>
              )}
              {(addForm.twitterUrl || addDialog.platform === "twitter") && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1"><Twitter className="w-3 h-3 text-sky-400" />تويتر / X</Label>
                  <Input value={addForm.twitterUrl} onChange={e => setAddForm(f => ({ ...f, twitterUrl: e.target.value }))} className="h-8 text-xs" dir="ltr" placeholder="https://twitter.com/..." />
                </div>
              )}
              {(addForm.facebookUrl || addDialog.platform === "facebook") && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1"><Users className="w-3 h-3 text-blue-400" />فيسبوك</Label>
                  <Input value={addForm.facebookUrl} onChange={e => setAddForm(f => ({ ...f, facebookUrl: e.target.value }))} className="h-8 text-xs" dir="ltr" placeholder="https://facebook.com/..." />
                </div>
              )}
              {(addForm.linkedinUrl || addDialog.platform === "linkedin") && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1"><Linkedin className="w-3 h-3 text-blue-500" />لينكدإن</Label>
                  <Input value={addForm.linkedinUrl} onChange={e => setAddForm(f => ({ ...f, linkedinUrl: e.target.value }))} className="h-8 text-xs" dir="ltr" placeholder="https://linkedin.com/..." />
                </div>
              )}
              {/* إضافة روابط منصات إضافية */}
              <div className="flex flex-wrap gap-1 pt-1">
                {!addForm.instagramUrl && addDialog.platform !== "instagram" && (
                  <Button type="button" variant="ghost" size="sm" className="h-6 text-xs px-2 text-pink-400 hover:bg-pink-500/10" onClick={() => setAddForm(f => ({ ...f, instagramUrl: "https://instagram.com/" }))}>
                    <Instagram className="w-3 h-3 mr-1" />+ إنستجرام
                  </Button>
                )}
                {!addForm.tiktokUrl && addDialog.platform !== "tiktok" && (
                  <Button type="button" variant="ghost" size="sm" className="h-6 text-xs px-2 text-purple-400 hover:bg-purple-500/10" onClick={() => setAddForm(f => ({ ...f, tiktokUrl: "https://tiktok.com/@" }))}>
                    <Video className="w-3 h-3 mr-1" />+ تيك توك
                  </Button>
                )}
                {!addForm.snapchatUrl && addDialog.platform !== "snapchat" && (
                  <Button type="button" variant="ghost" size="sm" className="h-6 text-xs px-2 text-yellow-400 hover:bg-yellow-500/10" onClick={() => setAddForm(f => ({ ...f, snapchatUrl: "https://snapchat.com/add/" }))}>
                    <Camera className="w-3 h-3 mr-1" />+ سناب
                  </Button>
                )}
                {!addForm.twitterUrl && addDialog.platform !== "twitter" && (
                  <Button type="button" variant="ghost" size="sm" className="h-6 text-xs px-2 text-sky-400 hover:bg-sky-500/10" onClick={() => setAddForm(f => ({ ...f, twitterUrl: "https://twitter.com/" }))}>
                    <Twitter className="w-3 h-3 mr-1" />+ تويتر
                  </Button>
                )}
                {!addForm.facebookUrl && addDialog.platform !== "facebook" && (
                  <Button type="button" variant="ghost" size="sm" className="h-6 text-xs px-2 text-blue-400 hover:bg-blue-500/10" onClick={() => setAddForm(f => ({ ...f, facebookUrl: "https://facebook.com/" }))}>
                    <Users className="w-3 h-3 mr-1" />+ فيسبوك
                  </Button>
                )}
                {!addForm.linkedinUrl && addDialog.platform !== "linkedin" && (
                  <Button type="button" variant="ghost" size="sm" className="h-6 text-xs px-2 text-blue-500 hover:bg-blue-600/10" onClick={() => setAddForm(f => ({ ...f, linkedinUrl: "https://linkedin.com/company/" }))}>
                    <Linkedin className="w-3 h-3 mr-1" />+ لينكدإن
                  </Button>
                )}
              </div>
            </div>

            {/* الملاحظات */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">ملاحظات</Label>
              <textarea
                value={addForm.notes}
                onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full h-16 text-xs bg-background border border-input rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="ملاحظات إضافية..."
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAddDialog({ open: false, result: null, platform: "" })}>إلغاء</Button>
            <Button onClick={handleAddLead} disabled={!addForm.companyName || createLead.isPending} className="gap-2">
              {createLead.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              إضافة كعميل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
