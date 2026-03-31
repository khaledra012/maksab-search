import { trpc } from "@/lib/trpc";
import { useState, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowRight, Save, Globe, Instagram, Twitter, Phone, MapPin, Building2, Tag, MessageCircle, CheckCircle2, XCircle, HelpCircle, TrendingUp, Flag, Calendar, ChevronDown, Loader2, Sparkles, Wand2, AlertTriangle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { COUNTRIES_DATA } from "../../../shared/countries";
import { skipToken } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const FALLBACK_BUSINESS_TYPES = [
  "ملحمة", "أغنام", "ماعز", "لحوم", "ذبح وتجهيز", "توصيل لحوم",
  "مزرعة أغنام", "سوق ماشية", "أضاحي", "مشاوي ولحوم", "مطعم", "صيدلية", "بقالة", "مقهى", "صالون", "أخرى"
];

export default function AddLead() {
  const [, navigate] = useLocation();
  const { data: zones } = trpc.zones.list.useQuery();
  const { data: businessTypesData } = trpc.dataSettings.getByCategory.useQuery({ category: "businessType" });
  const businessTypes = businessTypesData?.length ? businessTypesData.map(b => b.label) : FALLBACK_BUSINESS_TYPES;
  const createLead = trpc.leads.create.useMutation();
  const parseBioMutation = trpc.leadIntelligence.parseBio.useMutation();
  const utils = trpc.useUtils();
  const [bioText, setBioText] = useState("");
  const [showBioPanel, setShowBioPanel] = useState(false);
  const [bioResult, setBioResult] = useState<any>(null);

  const [selectedCountry, setSelectedCountry] = useState("السعودية");
  const availableCities = COUNTRIES_DATA.find(c => c.name === selectedCountry)?.cities ?? [];

  const [form, setForm] = useState({
    companyName: "",
    businessType: "ملحمة",
    country: "السعودية",
    city: "الرياض",
    district: "",
    zoneId: undefined as number | undefined,
    zoneName: "",
    verifiedPhone: "",
    hasWhatsapp: "unknown" as "yes" | "no" | "unknown",
    website: "",
    googleMapsUrl: "",
    instagramUrl: "",
    twitterUrl: "",
    snapchatUrl: "",
    tiktokUrl: "",
    facebookUrl: "",
    reviewCount: 0,
    socialSince: "",
    notes: "",
    additionalNotes: "",
    stage: "new" as "new" | "contacted" | "interested" | "price_offer" | "meeting" | "won" | "lost",
    priority: "medium" as "high" | "medium" | "low",
    nextStep: "",
    nextFollowup: undefined as number | undefined,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleParseBio = async () => {
    if (!bioText.trim()) return;
    try {
      const result = await parseBioMutation.mutateAsync({ bio: bioText });
      setBioResult(result);
      // تعبئة الحقول تلقائياً
      const updates: Record<string, any> = {};
      if (result.companyName) updates.companyName = result.companyName;
      if (result.businessType) updates.businessType = result.businessType;
      if (result.city) updates.city = result.city;
      if (result.district) updates.district = result.district;
      if (result.verifiedPhone) updates.verifiedPhone = result.verifiedPhone;
      if (result.website) updates.website = result.website;
      if (result.instagramUrl) updates.instagramUrl = result.instagramUrl;
      if (result.twitterUrl) updates.twitterUrl = result.twitterUrl;
      if (result.snapchatUrl) updates.snapchatUrl = result.snapchatUrl;
      if (result.tiktokUrl) updates.tiktokUrl = result.tiktokUrl;
      if (result.facebookUrl) updates.facebookUrl = result.facebookUrl;
      if (result.notes) updates.notes = result.notes;
      setForm(f => ({ ...f, ...updates }));
      const filled = result.extractedFields?.length || 0;
      toast.success(`تم استخراج ${filled} حقل تلقائياً`, { description: `نسبة الثقة: ${result.confidence}%` });
    } catch (err) {
      toast.error("فشل تحليل البايو");
    }
  };

  // جلب تفاصيل Google Maps تلقائياً
  const [currentPlaceId, setCurrentPlaceId] = useState<string | null>(null);
  const [isFetchingFromUrl, setIsFetchingFromUrl] = useState(false);
  const placeDetailsQuery = trpc.search.getPlaceDetails.useQuery(
    currentPlaceId ? { placeId: currentPlaceId } : skipToken,
    { enabled: !!currentPlaceId, staleTime: 5 * 60 * 1000 }
  );

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

  // معالجة تغيير رابط Google Maps مع debounce
  const handleGoogleMapsUrlChange = useCallback((url: string) => {
    set("googleMapsUrl", url);
    if (!url.trim()) return;
    // انتظر حتى يكتمل الرابط (الحد الأدنى لطول place_id هو 27 حرفاً)
    const placeId = extractPlaceIdFromUrl(url);
    if (placeId && placeId.length >= 20 && placeId !== currentPlaceId) {
      setCurrentPlaceId(placeId);
      setIsFetchingFromUrl(true);
    }
  }, [currentPlaceId, extractPlaceIdFromUrl]);

  // تحديث الحقول تلقائياً عند جلب تفاصيل Google Maps
  useEffect(() => {
    if (placeDetailsQuery.data && currentPlaceId) {
      const d = placeDetailsQuery.data as any;
      const phone = d.formatted_phone_number || d.international_phone_number || "";
      const website = d.website || "";
      const name = d.name || "";
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
        companyName: f.companyName || name,
        city: city ? city : f.city,
        district: district ? district : f.district,
      }));
      if (isFetchingFromUrl) {
        setIsFetchingFromUrl(false);
        const filled = [phone && 'رقم الهاتف ✓', website && 'الموقع ✓', name && 'الاسم ✓', city && 'المدينة ✓'].filter(Boolean).join(' ');
        if (filled) {
          toast.success("تم جلب بيانات Google Maps تلقائياً", { description: filled });
        }
      }
    }
  }, [placeDetailsQuery.data, currentPlaceId, isFetchingFromUrl]);

  const STAGE_OPTIONS = [
    { value: "new", label: "جديد", color: "oklch(0.65 0.05 240)" },
    { value: "contacted", label: "تم التواصل", color: "oklch(0.65 0.15 200)" },
    { value: "interested", label: "مهتم", color: "oklch(0.65 0.18 145)" },
    { value: "price_offer", label: "عرض سعر", color: "oklch(0.65 0.18 60)" },
    { value: "meeting", label: "اجتماع", color: "oklch(0.65 0.18 280)" },
    { value: "won", label: "عميل فعلي", color: "oklch(0.65 0.18 145)" },
    { value: "lost", label: "خسرناه", color: "oklch(0.55 0.18 25)" },
  ] as const;

  const PRIORITY_OPTIONS = [
    { value: "high", label: "عالية", color: "oklch(0.65 0.18 25)" },
    { value: "medium", label: "متوسطة", color: "oklch(0.65 0.18 60)" },
    { value: "low", label: "منخفضة", color: "oklch(0.65 0.05 240)" },
  ] as const;

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!form.companyName.trim()) newErrors.companyName = "اسم النشاط مطلوب";
    if (form.verifiedPhone && !/^(\+966|05)\d{8,9}$/.test(form.verifiedPhone.replace(/\s/g, ""))) {
      newErrors.verifiedPhone = "رقم الهاتف يجب أن يبدأ بـ +966 أو 05";
    }
    if (form.stage === "interested" && !form.nextFollowup) {
      newErrors.nextFollowup = "عند تحديد العميل كمهتم يجب تحديد موعد متابعة";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    // حفظ مباشر بدون مراجعة
    await handleConfirmSave();
  };

  // حالة dialog التكرار
  const [duplicateDialog, setDuplicateDialog] = useState<{
    open: boolean;
    existingLead: { id: number; companyName: string; businessType: string; city: string; verifiedPhone?: string | null; stage?: string | null } | null;
    reason: string;
  }>({ open: false, existingLead: null, reason: "" });

  const handleConfirmSave = async () => {
    const selectedZone = zones?.find(z => z.id === form.zoneId);
    try {
      const result = await createLead.mutateAsync({
        ...form,
        zoneName: selectedZone?.name || form.zoneName || undefined,
      });
      // فحص إذا كان العميل مكرراً
      if ((result as any).isDuplicate) {
        setDuplicateDialog({
          open: true,
          existingLead: (result as any).existingLead,
          reason: (result as any).duplicateReason || "",
        });
        return;
      }
      toast.success("تم إضافة العميل — جاري التحليل التلقائي في الخلفية...");
      utils.leads.list.invalidate();
      utils.leads.stats.invalidate();
      navigate(`/leads/${result.id}`);
    } catch (err) {
      toast.error("حدث خطأ أثناء الحفظ");
    }
  };

  const set = (field: string, value: any) => {
    setForm(f => ({ ...f, [field]: value }));
    if (errors[field]) setErrors(e => ({ ...e, [field]: "" }));
  };

  const whatsappOptions = [
    { value: "yes", label: "لديه واتساب", icon: CheckCircle2, color: "oklch(0.65 0.18 145)", bg: "oklch(0.65 0.18 145 / 0.15)", border: "oklch(0.65 0.18 145 / 0.5)" },
    { value: "no", label: "ليس لديه", icon: XCircle, color: "oklch(0.65 0.18 25)", bg: "oklch(0.65 0.18 25 / 0.15)", border: "oklch(0.65 0.18 25 / 0.5)" },
    { value: "unknown", label: "غير محدد", icon: HelpCircle, color: "oklch(0.65 0.05 240)", bg: "oklch(0.65 0.05 240 / 0.1)", border: "oklch(0.65 0.05 240 / 0.3)" },
  ] as const;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/leads")} className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all">
          <ArrowRight className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">إضافة Lead جديد</h1>
          <p className="text-muted-foreground text-sm mt-0.5">أدخل بيانات النشاط التجاري</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* ===== AI Bio Parser ===== */}
        <div className="rounded-2xl border-2 overflow-hidden" style={{ borderColor: "oklch(0.65 0.18 280 / 0.4)", background: "oklch(0.10 0.015 240)" }}>
          <button
            type="button"
            onClick={() => setShowBioPanel(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3 transition-all"
            style={{ background: showBioPanel ? "oklch(0.65 0.18 280 / 0.1)" : "oklch(0.65 0.18 280 / 0.06)" }}
          >
            <div className="flex items-center gap-2">
              <Wand2 className="w-4 h-4" style={{ color: "oklch(0.72 0.18 280)" }} />
              <span className="font-semibold text-sm" style={{ color: "oklch(0.72 0.18 280)" }}>تحليل البايو بالذكاء الاصطناعي</span>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "oklch(0.65 0.18 280 / 0.15)", color: "oklch(0.72 0.18 280)" }}>جديد</span>
            </div>
            <span className="text-xs text-muted-foreground">{showBioPanel ? "▲ إخفاء" : "▼ الصق بايو إنستغرام أو وصف النشاط"}</span>
          </button>
          {showBioPanel && (
            <div className="p-4 space-y-3">
              <p className="text-xs text-muted-foreground">الصق بايو حساب إنستغرام أو أي وصف للنشاط، وسيقوم الذكاء الاصطناعي بملء الحقول تلقائياً.</p>
              <textarea
                value={bioText}
                onChange={e => setBioText(e.target.value)}
                rows={4}
                className="w-full px-4 py-2.5 rounded-xl text-sm border border-border bg-background text-foreground focus:outline-none focus:border-primary resize-none"
                placeholder="مثال: مطعم الأصيل • الرياض حي النزهة • هاتف: 0501234567 • إنستغرام: @alaseel_rest"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleParseBio}
                  disabled={parseBioMutation.isPending || !bioText.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                  style={{ background: parseBioMutation.isPending ? "oklch(0.65 0.18 280 / 0.1)" : "oklch(0.65 0.18 280 / 0.2)", color: "oklch(0.72 0.18 280)", border: "1px solid oklch(0.65 0.18 280 / 0.4)" }}
                >
                  {parseBioMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {parseBioMutation.isPending ? "جاري التحليل..." : "تحليل وملء الحقول"}
                </button>
                {bioResult && (
                  <span className="text-xs" style={{ color: "oklch(0.65 0.18 145)" }}>
                    ✓ تم استخراج {bioResult.extractedFields?.length || 0} حقل (ثقة: {bioResult.confidence}%)
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
        {/* ===== END AI Bio Parser ===== */}
        {/* Basic info */}
        <div className="rounded-2xl p-5 border border-border space-y-4" style={{ background: "oklch(0.12 0.015 240)" }}>
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Building2 className="w-4 h-4" style={{ color: "var(--brand-cyan)" }} />
            المعلومات الأساسية
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1.5 block">اسم النشاط التجاري *</label>
              <input value={form.companyName} onChange={e => set("companyName", e.target.value)}
                className={`w-full px-4 py-2.5 rounded-xl text-sm border bg-background text-foreground focus:outline-none focus:border-primary transition-colors ${errors.companyName ? "border-red-500" : "border-border"}`}
                placeholder="مثال: ملحمة الأصيل" />
              {errors.companyName && <p className="text-xs mt-1" style={{ color: "var(--brand-red)" }}>{errors.companyName}</p>}
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">نوع النشاط *</label>
              <select value={form.businessType} onChange={e => set("businessType", e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-sm border border-border bg-background text-foreground focus:outline-none focus:border-primary">
                {businessTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">الدولة</label>
              <select value={selectedCountry} onChange={e => {
                setSelectedCountry(e.target.value);
                set("country", e.target.value);
                const firstCity = COUNTRIES_DATA.find(c => c.name === e.target.value)?.cities[0] ?? "";
                set("city", firstCity);
              }}
                className="w-full px-4 py-2.5 rounded-xl text-sm border border-border bg-background text-foreground focus:outline-none focus:border-primary">
                {COUNTRIES_DATA.map(c => <option key={c.code} value={c.name}>{c.flag} {c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">المدينة *</label>
              <select value={form.city} onChange={e => set("city", e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-sm border border-border bg-background text-foreground focus:outline-none focus:border-primary">
                {availableCities.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">الحي / المنطقة الفرعية</label>
              <input value={form.district} onChange={e => set("district", e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-sm border border-border bg-background text-foreground focus:outline-none focus:border-primary"
                placeholder="مثال: حي النزهة" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">منطقة الشبكة</label>
              <select value={form.zoneId ?? ""} onChange={e => set("zoneId", e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-4 py-2.5 rounded-xl text-sm border border-border bg-background text-foreground focus:outline-none focus:border-primary">
                <option value="">اختر المنطقة</option>
                {zones?.map(z => <option key={z.id} value={z.id}>{z.name} ({z.region})</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Contact info */}
        <div className="rounded-2xl p-5 border border-border space-y-4" style={{ background: "oklch(0.12 0.015 240)" }}>
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Phone className="w-4 h-4" style={{ color: "var(--brand-gold)" }} />
            معلومات الاتصال
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">رقم الهاتف المُتحقق</label>
              <input value={form.verifiedPhone} onChange={e => set("verifiedPhone", e.target.value)}
                className={`w-full px-4 py-2.5 rounded-xl text-sm border bg-background text-foreground focus:outline-none focus:border-primary transition-colors ${errors.verifiedPhone ? "border-red-500" : "border-border"}`}
                placeholder="+966501234567" dir="ltr" />
              {errors.verifiedPhone && <p className="text-xs mt-1" style={{ color: "var(--brand-red)" }}>{errors.verifiedPhone}</p>}
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">عدد تقييمات Google</label>
              <input type="number" value={form.reviewCount} onChange={e => set("reviewCount", Number(e.target.value))}
                className="w-full px-4 py-2.5 rounded-xl text-sm border border-border bg-background text-foreground focus:outline-none focus:border-primary"
                min={0} />
            </div>
          </div>

          {/* حالة واتساب - يدوي */}
          <div>
            <label className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
              <MessageCircle className="w-3.5 h-3.5" style={{ color: "oklch(0.65 0.18 145)" }} />
              حالة واتساب (يدوي)
            </label>
            <div className="flex gap-2">
              {whatsappOptions.map(opt => {
                const Icon = opt.icon;
                const isSelected = form.hasWhatsapp === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => set("hasWhatsapp", opt.value)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all border"
                    style={{
                      background: isSelected ? opt.bg : "transparent",
                      borderColor: isSelected ? opt.border : "var(--border)",
                      color: isSelected ? opt.color : "var(--muted-foreground)",
                      boxShadow: isSelected ? `0 0 0 1px ${opt.border}` : "none",
                    }}
                  >
                    <Icon className="w-4 h-4" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {form.hasWhatsapp === "yes" && (
              <p className="text-xs mt-1.5" style={{ color: "oklch(0.65 0.18 145)" }}>
                ✓ سيُضاف لقائمة الإرسال عبر واتساب تلقائياً
              </p>
            )}
          </div>
        </div>

        {/* Digital presence */}
        <div className="rounded-2xl p-5 border border-border space-y-4" style={{ background: "oklch(0.12 0.015 240)" }}>
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Globe className="w-4 h-4" style={{ color: "var(--brand-cyan)" }} />
            الحضور الرقمي
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {/* حقل Google Maps مع استدعاء تلقائي */}
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" style={{ color: isFetchingFromUrl || placeDetailsQuery.isFetching ? 'oklch(0.65 0.18 145)' : undefined }} />
                رابط Google Maps
                {(isFetchingFromUrl || placeDetailsQuery.isFetching) && (
                  <span className="flex items-center gap-1 text-[10px] animate-pulse" style={{ color: 'oklch(0.65 0.18 145)' }}>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    جاري جلب البيانات...
                  </span>
                )}
                {!placeDetailsQuery.isFetching && currentPlaceId && placeDetailsQuery.data && (
                  <span className="flex items-center gap-1 text-[10px]" style={{ color: 'oklch(0.65 0.18 145)' }}>
                    <CheckCircle2 className="w-3 h-3" />
                    تم جلب البيانات
                  </span>
                )}
              </label>
              <input
                value={form.googleMapsUrl}
                onChange={e => handleGoogleMapsUrlChange(e.target.value)}
                className={`w-full px-4 py-2.5 rounded-xl text-sm border bg-background text-foreground focus:outline-none transition-colors ${
                  currentPlaceId && placeDetailsQuery.data ? 'border-green-500/50' : 'border-border focus:border-primary'
                }`}
                placeholder="الصق رابط Google Maps هنا لجلب البيانات تلقائياً..."
                dir="ltr"
              />
              {!currentPlaceId && (
                <p className="text-[10px] text-muted-foreground mt-1">الصق رابط المكان من Google Maps لجلب الهاتف والموقع والمدينة تلقائياً</p>
              )}
            </div>
            {[
              { field: "website", label: "الموقع الإلكتروني", placeholder: "https://example.com", icon: Globe },
              { field: "instagramUrl", label: "إنستغرام", placeholder: "https://instagram.com/...", icon: Instagram },
              { field: "twitterUrl", label: "تويتر / X", placeholder: "https://twitter.com/...", icon: Twitter },
              { field: "snapchatUrl", label: "سناب شات", placeholder: "https://snapchat.com/...", icon: Globe },
              { field: "tiktokUrl", label: "تيك توك", placeholder: "https://tiktok.com/...", icon: Globe },
            ].map(({ field, label, placeholder, icon: Icon }) => (
              <div key={field}>
                <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </label>
                <input value={(form as any)[field]} onChange={e => set(field, e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl text-sm border border-border bg-background text-foreground focus:outline-none focus:border-primary"
                  placeholder={placeholder} dir="ltr" />
              </div>
            ))}
          </div>
          {/* تاريخ الظهور على السوشيال */}
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" />
              تاريخ الظهور على السوشيال ميديا (اختياري)
            </label>
            <input
              value={form.socialSince}
              onChange={e => set("socialSince", e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl text-sm border border-border bg-background text-foreground focus:outline-none focus:border-primary"
              placeholder="مثال: 2019 أو 2020-05"
              dir="ltr"
            />
            <p className="text-xs text-muted-foreground mt-1">السنة أو الشهر-السنة التي بدأ فيها النشاط على السوشيال</p>
          </div>
        </div>

        {/* التصنيف الإلزامي */}
        <div className="rounded-2xl p-5 border-2 space-y-4" style={{ background: "oklch(0.12 0.015 240)", borderColor: "oklch(0.65 0.18 60 / 0.4)" }}>
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <TrendingUp className="w-4 h-4" style={{ color: "oklch(0.65 0.18 60)" }} />
            التصنيف والمتابعة
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "oklch(0.65 0.18 60 / 0.15)", color: "oklch(0.65 0.18 60)" }}>مهم</span>
          </h3>
          {/* مرحلة العميل */}
          <div>
            <label className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" />
              مرحلة العميل
            </label>
            <div className="flex flex-wrap gap-2">
              {STAGE_OPTIONS.map(opt => (
                <button key={opt.value} type="button" onClick={() => set("stage", opt.value)}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all border"
                  style={{
                    background: form.stage === opt.value ? `${opt.color} / 0.15` : "transparent",
                    borderColor: form.stage === opt.value ? opt.color : "var(--border)",
                    color: form.stage === opt.value ? opt.color : "var(--muted-foreground)",
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {/* الأولوية */}
          <div>
            <label className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
              <Flag className="w-3.5 h-3.5" />
              الأولوية
            </label>
            <div className="flex gap-2">
              {PRIORITY_OPTIONS.map(opt => (
                <button key={opt.value} type="button" onClick={() => set("priority", opt.value)}
                  className="flex-1 py-2 rounded-lg text-sm font-medium transition-all border"
                  style={{
                    background: form.priority === opt.value ? `${opt.color} / 0.15` : "transparent",
                    borderColor: form.priority === opt.value ? opt.color : "var(--border)",
                    color: form.priority === opt.value ? opt.color : "var(--muted-foreground)",
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {/* الخطوة التالية */}
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <ChevronDown className="w-3.5 h-3.5" />
              الخطوة التالية (اختياري)
            </label>
            <input value={form.nextStep} onChange={e => set("nextStep", e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl text-sm border border-border bg-background text-foreground focus:outline-none focus:border-primary"
              placeholder="مثال: إرسال عرض سعر غداً" />
          </div>
          {/* موعد المتابعة */}
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              موعد المتابعة {form.stage === "interested" && <span style={{ color: "oklch(0.65 0.18 25)" }}>*</span>}
            </label>
            <input type="datetime-local"
              value={form.nextFollowup ? new Date(form.nextFollowup).toISOString().slice(0, 16) : ""}
              onChange={e => set("nextFollowup", e.target.value ? new Date(e.target.value).getTime() : undefined)}
              className={`w-full px-4 py-2.5 rounded-xl text-sm border bg-background text-foreground focus:outline-none focus:border-primary ${errors.nextFollowup ? "border-red-500" : "border-border"}`}
              dir="ltr" />
            {errors.nextFollowup && <p className="text-xs mt-1" style={{ color: "var(--brand-red)" }}>{errors.nextFollowup}</p>}
          </div>
        </div>

        {/* Notes for AI */}
        <div className="rounded-2xl p-5 border-2 overflow-hidden" style={{ borderColor: "oklch(0.65 0.18 60 / 0.4)", background: "oklch(0.10 0.015 240)" }}>
          <label className="text-xs font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: "oklch(0.72 0.18 60)" }}>
            <Sparkles className="w-3.5 h-3.5" />
            ملاحظات للذكاء الاصطناعي
          </label>
          <p className="text-xs text-muted-foreground mb-2">يقرأها الـ AI قبل التحليل — أضف أي توجيهات خاصة (مثل: "ركز على ضعف الإنستغرام" أو "العميل مهتم بالإعلانات")</p>
          <textarea value={form.notes} onChange={e => set("notes", e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl text-sm border border-border bg-background text-foreground focus:outline-none focus:border-primary resize-none"
            rows={3} placeholder="مثال: العميل يريد التوسع في تيك توك، لديه ميزانية محدودة، منافسه الرئيسي هو..." />
        </div>

        {/* تعليقات المحلل - تُدمج في التقرير */}
        <div className="rounded-2xl p-5 border-2 overflow-hidden" style={{ borderColor: "oklch(0.65 0.18 280 / 0.4)", background: "oklch(0.10 0.015 280 / 0.3)" }}>
          <label className="text-xs font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: "oklch(0.75 0.18 280)" }}>
            <MessageCircle className="w-3.5 h-3.5" />
            تعليقات المحلل (تُدمج في التقرير)
          </label>
          <p className="text-xs text-muted-foreground mb-2">تعليقاتك الشخصية كمحلل — يقرأها الـ AI ويدمجها فكرياً في التقرير النهائي (مثل: "العميل لديه إمكانات عالية لكن تصميمه ضعيف" أو "ركز على فرصة رمضان")</p>
          <textarea value={form.additionalNotes} onChange={e => set("additionalNotes", e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl text-sm border border-border bg-background text-foreground focus:outline-none focus:border-primary resize-none"
            rows={3} placeholder="مثال: رأيت حساب الإنستغرام شخصياً — المحتوى جيد لكن لا يوجد CTA واضح. أنصح بالتركيز على الريلز والتسعير..." />
        </div>

        {/* Submit */}
        <div className="flex gap-3">
          <button type="submit" disabled={createLead.isPending}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, oklch(0.65 0.18 200), oklch(0.55 0.15 200))" }}>
            <Save className="w-4 h-4" />
            {createLead.isPending ? "جاري الحفظ..." : "حفظ + تحليل تلقائي"}
          </button>
          <button type="button" onClick={() => navigate("/leads")}
            className="px-6 py-3 rounded-xl text-sm text-muted-foreground border border-border hover:bg-white/5 transition-all">
            إلغاء
          </button>
        </div>
      </form>

      {/* ديالوج العميل المكرر */}
      <Dialog open={duplicateDialog.open} onOpenChange={(open) => setDuplicateDialog(d => ({ ...d, open }))}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-400">
              <AlertTriangle className="w-5 h-5" />
              عميل موجود مسبقاً
            </DialogTitle>
            <DialogDescription className="text-right">
              تم اكتشاف عميل مطابق للبيانات التي أدخلتها
            </DialogDescription>
          </DialogHeader>
          {duplicateDialog.existingLead && (
            <div className="rounded-xl p-4 border border-amber-500/30 bg-amber-500/5 space-y-2">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-foreground">{duplicateDialog.existingLead.companyName}</span>
              </div>
              {duplicateDialog.existingLead.businessType && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Tag className="w-3.5 h-3.5" />
                  <span>{duplicateDialog.existingLead.businessType}</span>
                </div>
              )}
              {duplicateDialog.existingLead.city && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{duplicateDialog.existingLead.city}</span>
                </div>
              )}
              {duplicateDialog.existingLead.verifiedPhone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="w-3.5 h-3.5" />
                  <span dir="ltr">{duplicateDialog.existingLead.verifiedPhone}</span>
                </div>
              )}
              {duplicateDialog.existingLead.stage && (
                <div className="text-xs text-muted-foreground mt-1">
                  الحالة: <span className="text-amber-400 font-medium">{duplicateDialog.existingLead.stage === 'new' ? 'جديد' : duplicateDialog.existingLead.stage === 'contacted' ? 'تم التواصل' : duplicateDialog.existingLead.stage === 'interested' ? 'مهتم' : duplicateDialog.existingLead.stage === 'won' ? 'عميل فعلي' : duplicateDialog.existingLead.stage}</span>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex gap-2 flex-row-reverse">
            <Button
              onClick={() => {
                if (duplicateDialog.existingLead) {
                  navigate(`/leads/${duplicateDialog.existingLead.id}`);
                }
              }}
              className="flex items-center gap-2"
              style={{ background: "linear-gradient(135deg, oklch(0.65 0.18 200), oklch(0.55 0.15 200))" }}
            >
              <ExternalLink className="w-4 h-4" />
              الانتقال للعميل الموجود
            </Button>
            <Button
              variant="outline"
              onClick={() => setDuplicateDialog(d => ({ ...d, open: false }))}
            >
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
