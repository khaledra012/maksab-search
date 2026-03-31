/**
 * AddLeadModal - نافذة إضافة عميل موحدة
 * نموذج واحد بدون تبويبات - جميع الحقول ظاهرة مباشرةً
 * التحليل يدوي فقط (لا استهلاك تلقائي للكريدت)
 */
import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { skipToken } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import {
  Loader2, CheckCircle2, Search, Instagram, Globe, Phone, MapPin,
  Building2, Star, ExternalLink, ChevronDown, ChevronUp, Sparkles,
  Twitter, Linkedin, Facebook, User, Hash, RefreshCw, X
} from "lucide-react";

// أيقونة TikTok
const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.26 8.26 0 004.83 1.56V6.79a4.85 4.85 0 01-1.06-.1z"/>
  </svg>
);

// أيقونة Snapchat
const SnapchatIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
    <path d="M12.166.5C8.917.5 6.09 2.5 6.09 6.5v.5c-.5.2-1.5.3-2 .5-.3.1-.5.3-.5.6s.2.5.5.6c.5.2 1.5.5 2 .8.2 1 .8 2 1.5 2.7-.5.3-1.2.5-2 .5-.5 0-1 .3-1 .8s.5.8 1 .8c1.5 0 3-.5 4.5-1.5.5.2 1 .3 1.5.3s1-.1 1.5-.3c1.5 1 3 1.5 4.5 1.5.5 0 1-.3 1-.8s-.5-.8-1-.8c-.8 0-1.5-.2-2-.5.7-.7 1.3-1.7 1.5-2.7.5-.3 1.5-.6 2-.8.3-.1.5-.3.5-.6s-.2-.5-.5-.6c-.5-.2-1.5-.3-2-.5V6.5C17.91 2.5 15.41.5 12.166.5z"/>
  </svg>
);

interface AddLeadModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (leadId: number) => void;
  initialData?: {
    companyName?: string;
    businessType?: string;
    city?: string;
    phone?: string;
    website?: string;
    googleMapsUrl?: string;
    instagramUrl?: string;
    tiktokUrl?: string;
    snapchatUrl?: string;
    twitterUrl?: string;
    linkedinUrl?: string;
    facebookUrl?: string;
    notes?: string;
    reviewCount?: number;
    placeId?: string;
    rating?: number;
    address?: string;
    availablePhones?: string[];
    availableWebsites?: string[];
    username?: string;
    platform?: string;
    bio?: string;
    followersCount?: number;
  };
}

const STAGES = [
  { value: "new", label: "جديد" },
  { value: "contacted", label: "تم التواصل" },
  { value: "interested", label: "مهتم" },
  { value: "price_offer", label: "عرض سعر" },
  { value: "meeting", label: "اجتماع" },
  { value: "won", label: "تم الإغلاق" },
  { value: "lost", label: "خسارة" },
];

const PRIORITIES = [
  { value: "high", label: "عالية", color: "text-red-400" },
  { value: "medium", label: "متوسطة", color: "text-yellow-400" },
  { value: "low", label: "منخفضة", color: "text-green-400" },
];

const DRAFT_STORAGE_KEY = "addLeadModal_draft";

const socialPlatforms = [
  { key: "instagramUrl", platform: "instagram", label: "Instagram", icon: <Instagram className="w-4 h-4" />, placeholder: "https://instagram.com/username", color: "text-pink-400" },
  { key: "tiktokUrl", platform: "tiktok", label: "TikTok", icon: <TikTokIcon />, placeholder: "https://tiktok.com/@username", color: "text-cyan-400" },
  { key: "snapchatUrl", platform: "snapchat", label: "Snapchat", icon: <SnapchatIcon />, placeholder: "https://snapchat.com/add/username", color: "text-yellow-400" },
  { key: "twitterUrl", platform: "twitter", label: "Twitter / X", icon: <Twitter className="w-4 h-4" />, placeholder: "https://x.com/username", color: "text-sky-400" },
  { key: "linkedinUrl", platform: "linkedin", label: "LinkedIn", icon: <Linkedin className="w-4 h-4" />, placeholder: "https://linkedin.com/company/name", color: "text-blue-400" },
  { key: "facebookUrl", platform: "facebook", label: "Facebook", icon: <Facebook className="w-4 h-4" />, placeholder: "https://facebook.com/pagename", color: "text-blue-500" },
];

export function AddLeadModal({ open, onClose, onSuccess, initialData }: AddLeadModalProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSearchingAccounts, setIsSearchingAccounts] = useState(false);
  const [socialSearchResults, setSocialSearchResults] = useState<Record<string, any[]>>({});
  const [hasDraft, setHasDraft] = useState(false);
  const [isFetchingFromUrl, setIsFetchingFromUrl] = useState(false);
  const [currentPlaceId, setCurrentPlaceId] = useState<string | null>(null);

  const [form, setForm] = useState({
    companyName: "",
    businessType: "",
    city: "",
    country: "SA",
    district: "",
    crNumber: "",
    verifiedPhone: "",
    website: "",
    googleMapsUrl: "",
    instagramUrl: "",
    tiktokUrl: "",
    snapchatUrl: "",
    twitterUrl: "",
    linkedinUrl: "",
    facebookUrl: "",
    stage: "new" as string,
    priority: "medium" as string,
    notes: "",
    socialSince: "",
  });

  const placeDetailsQuery = trpc.search.getPlaceDetails.useQuery(
    currentPlaceId ? { placeId: currentPlaceId } : skipToken,
    { enabled: !!currentPlaceId, staleTime: 5 * 60 * 1000 }
  );

  const createLead = trpc.leads.create.useMutation();
  const smartFindMut = trpc.brightDataSearch.smartFindSocialAccounts.useMutation();

  const setField = useCallback((field: string, value: string) => {
    setForm(f => ({ ...f, [field]: value }));
  }, []);

  // حفظ تلقائي في localStorage
  useEffect(() => {
    if (!open) return;
    const hasData = form.companyName || form.businessType || form.city || form.verifiedPhone ||
      form.website || form.instagramUrl || form.tiktokUrl || form.snapchatUrl || form.twitterUrl;
    if (hasData) {
      try { localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(form)); } catch (e) {}
    }
  }, [form, open]);

  // تعبئة النموذج من البيانات المبدئية
  useEffect(() => {
    if (!open) return;
    if (initialData) {
      setForm(f => ({
        ...f,
        companyName: initialData.companyName || "",
        businessType: initialData.businessType || "",
        city: initialData.city || "",
        verifiedPhone: initialData.phone || "",
        website: initialData.website || "",
        googleMapsUrl: initialData.googleMapsUrl || "",
        instagramUrl: initialData.instagramUrl || (initialData.platform === "instagram" && initialData.username ? `https://instagram.com/${initialData.username}` : ""),
        tiktokUrl: initialData.tiktokUrl || (initialData.platform === "tiktok" && initialData.username ? `https://tiktok.com/@${initialData.username}` : ""),
        snapchatUrl: initialData.snapchatUrl || (initialData.platform === "snapchat" && initialData.username ? `https://snapchat.com/add/${initialData.username}` : ""),
        twitterUrl: initialData.twitterUrl || (initialData.platform === "twitter" && initialData.username ? `https://x.com/${initialData.username}` : ""),
        linkedinUrl: initialData.linkedinUrl || "",
        facebookUrl: initialData.facebookUrl || "",
        notes: initialData.notes || initialData.bio || "",
      }));
      if (initialData.placeId) setCurrentPlaceId(initialData.placeId);
      setSocialSearchResults({});
      setHasDraft(false);
      try { localStorage.removeItem(DRAFT_STORAGE_KEY); } catch (e) {}
    } else {
      try {
        const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
        if (saved) {
          const draft = JSON.parse(saved);
          if (draft.companyName || draft.businessType || draft.city) {
            setForm(f => ({ ...f, ...draft }));
            setHasDraft(true);
          }
        }
      } catch (e) {}
    }
  }, [open, initialData]);

  // جلب بيانات Google Maps تلقائياً عند توفر placeId
  useEffect(() => {
    if (placeDetailsQuery.data && open) {
      const d = placeDetailsQuery.data as any;
      const phone = d.formatted_phone_number || d.international_phone_number || "";
      const website = d.website || "";
      let city = "";
      let district = "";
      if (d.formatted_address) {
        const parts = d.formatted_address.split(",").map((p: string) => p.trim());
        if (parts.length >= 3) {
          city = parts[parts.length - 2] || "";
          district = parts.length >= 4 ? parts[parts.length - 3] : "";
        } else if (parts.length === 2) {
          city = parts[0];
        }
      }
      setForm(f => ({
        ...f,
        verifiedPhone: f.verifiedPhone || phone,
        website: f.website || website,
        city: f.city || city,
        district: f.district || district,
        companyName: f.companyName || d.name || "",
        businessType: f.businessType || (d.types?.[0] || ""),
      }));
      if (isFetchingFromUrl && (phone || website || city)) {
        toast.success("تم جلب بيانات Google Maps تلقائياً");
        setIsFetchingFromUrl(false);
      }
    }
  }, [placeDetailsQuery.data, open, isFetchingFromUrl]);

  // استخراج place_id من رابط Google Maps
  const extractPlaceIdFromUrl = useCallback((url: string): string | null => {
    if (!url) return null;
    const directMatch = url.match(/[?&]q=place_id:([A-Za-z0-9_-]+)/);
    if (directMatch) return directMatch[1];
    const placeMatch = url.match(/\/place\/[^/]+\/([A-Za-z0-9_-]{20,})/);
    if (placeMatch) return placeMatch[1];
    const dataMatch = url.match(/!1s([A-Za-z0-9_-]{20,})/);
    if (dataMatch) return dataMatch[1];
    return null;
  }, []);

  const handleGoogleMapsUrlChange = useCallback((url: string) => {
    setField("googleMapsUrl", url);
    if (!url.trim()) return;
    const placeId = extractPlaceIdFromUrl(url);
    if (placeId && placeId.length >= 20 && placeId !== currentPlaceId) {
      setCurrentPlaceId(placeId);
      setIsFetchingFromUrl(true);
    }
  }, [currentPlaceId, extractPlaceIdFromUrl, setField]);

  // بحث ذكي يدوي عن حسابات السوشيال ميديا
  const handleSmartSearch = async () => {
    if (!form.companyName.trim()) {
      toast.error("أدخل اسم النشاط أولاً");
      return;
    }
    setIsSearchingAccounts(true);
    setSocialSearchResults({});
    try {
      const result = await smartFindMut.mutateAsync({
        companyName: form.companyName,
        city: form.city,
        businessType: form.businessType,
      });
      setSocialSearchResults(result.results);
      if (result.totalFound > 0) {
        toast.success(`تم العثور على ${result.totalFound} حساب`);
        // تطبيق اقتراحات AI تلقائياً
        if (result.aiSuggestions) {
          const s = result.aiSuggestions;
          setForm(f => ({
            ...f,
            instagramUrl: f.instagramUrl || (s.instagram ? `https://instagram.com/${s.instagram}` : ""),
            tiktokUrl: f.tiktokUrl || (s.tiktok ? `https://tiktok.com/@${s.tiktok}` : ""),
            snapchatUrl: f.snapchatUrl || (s.snapchat ? `https://snapchat.com/add/${s.snapchat}` : ""),
            twitterUrl: f.twitterUrl || (s.twitter ? `https://x.com/${s.twitter}` : ""),
            linkedinUrl: f.linkedinUrl || (s.linkedin ? `https://linkedin.com/company/${s.linkedin}` : ""),
          }));
        }
      } else {
        toast.info("لم يتم العثور على حسابات — أدخل الروابط يدوياً");
      }
    } catch (e: any) {
      toast.error("خطأ في البحث", { description: e.message });
    } finally {
      setIsSearchingAccounts(false);
    }
  };

  const applyAccount = (platform: string, account: any) => {
    const username = account.username || account.displayName || account.name || "";
    let fullUrl = account.profileUrl || account.url || "";
    if (!fullUrl && username) {
      switch (platform) {
        case "instagram": fullUrl = `https://instagram.com/${username}`; break;
        case "tiktok": fullUrl = `https://tiktok.com/@${username}`; break;
        case "snapchat": fullUrl = `https://snapchat.com/add/${username}`; break;
        case "twitter": fullUrl = `https://x.com/${username}`; break;
        case "linkedin": fullUrl = `https://linkedin.com/company/${username}`; break;
        case "facebook": fullUrl = `https://facebook.com/${username}`; break;
      }
    }
    const fieldMap: Record<string, string> = {
      instagram: "instagramUrl", tiktok: "tiktokUrl", snapchat: "snapchatUrl",
      twitter: "twitterUrl", linkedin: "linkedinUrl", facebook: "facebookUrl",
    };
    if (fieldMap[platform]) {
      setField(fieldMap[platform], fullUrl);
      toast.success(`تم تطبيق حساب ${platform}`);
    }
  };

  const handleSubmit = async () => {
    if (!form.companyName.trim()) { toast.error("اسم النشاط مطلوب"); return; }
    if (!form.businessType.trim()) { toast.error("نوع النشاط مطلوب"); return; }
    if (!form.city.trim()) { toast.error("المدينة مطلوبة"); return; }
    try {
      const result = await createLead.mutateAsync({
        companyName: form.companyName.trim(),
        businessType: form.businessType.trim(),
        city: form.city.trim(),
        country: form.country || undefined,
        district: form.district || undefined,
        crNumber: form.crNumber || undefined,
        verifiedPhone: form.verifiedPhone || undefined,
        website: form.website || undefined,
        googleMapsUrl: form.googleMapsUrl || undefined,
        instagramUrl: form.instagramUrl || undefined,
        tiktokUrl: form.tiktokUrl || undefined,
        snapchatUrl: form.snapchatUrl || undefined,
        twitterUrl: form.twitterUrl || undefined,
        linkedinUrl: form.linkedinUrl || undefined,
        facebookUrl: form.facebookUrl || undefined,
        notes: form.notes || undefined,
        socialSince: form.socialSince || undefined,
        stage: form.stage as any,
        priority: form.priority as any,
      });
      toast.success("تمت إضافة العميل بنجاح", { description: form.companyName });
      try { localStorage.removeItem(DRAFT_STORAGE_KEY); } catch (e) {}
      setHasDraft(false);
      onSuccess?.(result.id);
      onClose();
    } catch (e: any) {
      toast.error("خطأ في الإضافة", { description: e.message });
    }
  };

  const connectedPlatforms = socialPlatforms.filter(p => !!(form as any)[p.key]);

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" dir="rtl">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Building2 className="w-5 h-5 text-primary" />
            إضافة عميل محتمل
            {connectedPlatforms.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {connectedPlatforms.length} منصة مرتبطة
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* إشعار المسودة */}
        {hasDraft && !initialData && (
          <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs shrink-0">
            <div className="flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" />
              <span>تم استعادة مسودة محفوظة</span>
            </div>
            <button
              onClick={() => {
                setForm({ companyName: "", businessType: "", city: "", country: "SA", district: "", crNumber: "", verifiedPhone: "", website: "", googleMapsUrl: "", instagramUrl: "", tiktokUrl: "", snapchatUrl: "", twitterUrl: "", linkedinUrl: "", facebookUrl: "", notes: "", socialSince: "", stage: "new", priority: "medium" });
                try { localStorage.removeItem(DRAFT_STORAGE_KEY); } catch (e) {}
                setHasDraft(false);
              }}
              className="flex items-center gap-1 hover:text-amber-300 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              <span>مسح</span>
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">

          {/* ===== القسم الأول: البيانات الأساسية ===== */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">البيانات الأساسية</p>

            {/* اسم النشاط */}
            <div>
              <Label className="text-xs mb-1 block">اسم النشاط التجاري *</Label>
              <div className="relative">
                <Input
                  value={form.companyName}
                  onChange={e => setField("companyName", e.target.value)}
                  placeholder="اسم النشاط..."
                  className="pl-10"
                />
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              </div>
            </div>

            {/* نوع النشاط + المدينة */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">نوع النشاط *</Label>
                <Input
                  value={form.businessType}
                  onChange={e => setField("businessType", e.target.value)}
                  placeholder="مطعم، صالون، متجر..."
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">المدينة *</Label>
                <div className="relative">
                  <Input
                    value={form.city}
                    onChange={e => setField("city", e.target.value)}
                    placeholder="الرياض"
                    className="pl-8"
                  />
                  <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                </div>
              </div>
            </div>

            {/* رقم الهاتف */}
            <div>
              <Label className="text-xs mb-1 flex items-center gap-1.5">
                رقم الهاتف
                {placeDetailsQuery.isFetching && (
                  <span className="flex items-center gap-1 text-[10px] text-blue-400 animate-pulse">
                    <Loader2 className="w-3 h-3 animate-spin" />جاري الجلب...
                  </span>
                )}
              </Label>
              {initialData?.availablePhones && initialData.availablePhones.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-1.5 p-2 rounded-lg bg-green-500/5 border border-green-500/20">
                  <p className="w-full text-[10px] text-green-400/70 mb-1">أرقام متاحة — اضغط للاختيار:</p>
                  {initialData.availablePhones.map((p: string) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setField("verifiedPhone", p)}
                      className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${form.verifiedPhone === p ? "bg-green-500/20 border-green-500/50 text-green-300" : "border-border/50 hover:bg-muted/50"}`}
                      dir="ltr"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
              <div className="relative">
                <Input
                  value={form.verifiedPhone}
                  onChange={e => setField("verifiedPhone", e.target.value)}
                  placeholder="+966 5X XXX XXXX"
                  dir="ltr"
                  className="pl-8"
                />
                <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              </div>
            </div>

            {/* الموقع الإلكتروني */}
            <div>
              <Label className="text-xs mb-1 block">الموقع الإلكتروني</Label>
              <div className="relative">
                <Input
                  value={form.website}
                  onChange={e => setField("website", e.target.value)}
                  placeholder="https://example.com"
                  dir="ltr"
                  className="pl-8"
                />
                <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              </div>
            </div>

            {/* رابط Google Maps */}
            <div>
              <Label className="text-xs mb-1 flex items-center gap-1.5">
                رابط Google Maps
                {(placeDetailsQuery.isFetching || isFetchingFromUrl) && (
                  <span className="flex items-center gap-1 text-[10px] text-green-400 animate-pulse">
                    <Loader2 className="w-3 h-3 animate-spin" />جاري جلب البيانات...
                  </span>
                )}
                {!placeDetailsQuery.isFetching && currentPlaceId && placeDetailsQuery.data && (
                  <span className="flex items-center gap-1 text-[10px] text-green-400">
                    <CheckCircle2 className="w-3 h-3" />تم جلب البيانات
                  </span>
                )}
              </Label>
              <div className="relative">
                <Input
                  value={form.googleMapsUrl}
                  onChange={e => handleGoogleMapsUrlChange(e.target.value)}
                  placeholder="الصق رابط Google Maps لجلب البيانات تلقائياً..."
                  dir="ltr"
                  className={`pl-8 text-xs ${currentPlaceId && placeDetailsQuery.data ? "border-green-500/50" : ""}`}
                />
                <MapPin className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${currentPlaceId && placeDetailsQuery.data ? "text-green-400" : "text-muted-foreground"}`} />
              </div>
            </div>
          </div>

          {/* ===== القسم الثاني: السوشيال ميديا ===== */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                السوشيال ميديا
                {connectedPlatforms.length > 0 && (
                  <span className="mr-2 text-green-400 normal-case font-normal">({connectedPlatforms.length} مرتبطة)</span>
                )}
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleSmartSearch}
                disabled={isSearchingAccounts || !form.companyName.trim()}
                className="h-7 text-xs gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
              >
                {isSearchingAccounts ? (
                  <><Loader2 className="w-3 h-3 animate-spin" />جاري البحث...</>
                ) : (
                  <><Search className="w-3 h-3" />بحث تلقائي</>
                )}
              </Button>
            </div>

            {/* نتائج البحث الذكي */}
            {Object.values(socialSearchResults).flat().length > 0 && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-2 space-y-1">
                <p className="text-[10px] text-primary/70 mb-1.5">نتائج البحث — اضغط لتطبيق الحساب:</p>
                {Object.entries(socialSearchResults).map(([platform, accounts]) => {
                  if (!accounts.length) return null;
                  const pInfo = socialPlatforms.find(p => p.platform === platform);
                  return (
                    <div key={platform} className="flex flex-wrap gap-1.5">
                      <span className={`text-[10px] font-medium ${pInfo?.color || ""} flex items-center gap-1`}>
                        {pInfo?.icon}{pInfo?.label || platform}:
                      </span>
                      {accounts.slice(0, 3).map((acc: any, idx: number) => {
                        const username = acc.username || acc.displayName || acc.name || "";
                        const fieldKey = pInfo?.key || "";
                        const isApplied = !!(form as any)[fieldKey] && ((form as any)[fieldKey].includes(username));
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => applyAccount(platform, acc)}
                            className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                              isApplied
                                ? "bg-green-500/20 border-green-500/40 text-green-300"
                                : "border-border/50 hover:bg-muted/50 text-muted-foreground"
                            }`}
                          >
                            {isApplied ? <CheckCircle2 className="w-2.5 h-2.5 inline ml-1" /> : null}
                            @{username}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}

            {/* حقول المنصات - ظاهرة مباشرةً */}
            <div className="grid grid-cols-1 gap-2">
              {socialPlatforms.map(({ key, platform, label, icon, color, placeholder }) => (
                <div key={key} className="flex items-center gap-2">
                  <div className={`shrink-0 w-20 flex items-center gap-1.5 text-xs font-medium ${color}`}>
                    {icon}
                    <span className="truncate">{label}</span>
                  </div>
                  <div className="flex-1 flex gap-1">
                    <Input
                      value={(form as any)[key]}
                      onChange={e => setField(key, e.target.value)}
                      placeholder={placeholder}
                      dir="ltr"
                      className={`flex-1 text-xs h-8 ${(form as any)[key] ? "border-green-500/40 bg-green-500/5" : ""}`}
                    />
                    {(form as any)[key] && (
                      <>
                        <a
                          href={(form as any)[key]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 p-1.5 rounded border border-border/50 hover:bg-muted/50 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                        </a>
                        <button
                          type="button"
                          onClick={() => setField(key, "")}
                          className="shrink-0 p-1.5 rounded border border-border/50 hover:bg-red-500/10 hover:border-red-500/30 transition-colors"
                        >
                          <X className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ===== القسم الثالث: التصنيف (قابل للطي) ===== */}
          <div className="border border-border/40 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAdvanced(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted/30 transition-colors"
            >
              <span className="uppercase tracking-wide">التصنيف والملاحظات</span>
              {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {showAdvanced && (
              <div className="p-3 space-y-3 border-t border-border/40">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs mb-1 block">مرحلة العميل</Label>
                    <Select value={form.stage} onValueChange={v => setField("stage", v)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STAGES.map(s => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block">الأولوية</Label>
                    <Select value={form.priority} onValueChange={v => setField("priority", v)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map(p => (
                          <SelectItem key={p.value} value={p.value}>
                            <span className={p.color}>{p.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs mb-1 block">الحي / المنطقة</Label>
                  <Input
                    value={form.district}
                    onChange={e => setField("district", e.target.value)}
                    placeholder="حي النزهة..."
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">تاريخ الظهور على السوشيال</Label>
                  <Input
                    value={form.socialSince}
                    onChange={e => setField("socialSince", e.target.value)}
                    placeholder="مثال: 2020، أو منذ 3 سنوات"
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">ملاحظات</Label>
                  <Textarea
                    value={form.notes}
                    onChange={e => setField("notes", e.target.value)}
                    placeholder="أي ملاحظات إضافية عن العميل..."
                    className="text-xs resize-none"
                    rows={3}
                  />
                </div>
              </div>
            )}
          </div>

        </div>

        {/* أزرار الإجراءات */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-border/50 shrink-0">
          <Button variant="outline" onClick={onClose} size="sm">
            إلغاء
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!form.companyName || !form.businessType || !form.city || createLead.isPending}
            size="sm"
            className="gap-2"
          >
            {createLead.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" />جاري الحفظ...</>
            ) : (
              <><CheckCircle2 className="w-4 h-4" />حفظ العميل</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
