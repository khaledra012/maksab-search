import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Save, CheckCircle2, Loader2, Clock, User, Phone, Globe,
  MapPin, Instagram, Facebook, Send, ExternalLink, Zap,
  ChevronDown, Trash2, RotateCcw
} from "lucide-react";

// Platform shortcuts for quick navigation
const PLATFORMS = [
  {
    id: "instagram",
    label: "إنستغرام",
    color: "text-pink-400",
    bg: "bg-pink-500/10",
    border: "border-pink-500/30",
    icon: <Instagram className="w-4 h-4" />,
    url: "https://www.instagram.com/",
  },
  {
    id: "facebook",
    label: "فيسبوك",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    icon: <Facebook className="w-4 h-4" />,
    url: "https://www.facebook.com/",
  },
  {
    id: "telegram",
    label: "تيليغرام",
    color: "text-sky-400",
    bg: "bg-sky-500/10",
    border: "border-sky-500/30",
    icon: <Send className="w-4 h-4" />,
    url: "https://web.telegram.org/",
  },
  {
    id: "tiktok",
    label: "تيك توك",
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z"/>
      </svg>
    ),
    url: "https://www.tiktok.com/",
  },
  {
    id: "snapchat",
    label: "سناب شات",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301.165-.088.344-.104.464-.104.182 0 .359.029.509.09.45.149.734.479.734.838.015.449-.39.839-1.213 1.168-.089.029-.209.075-.344.119-.45.135-1.139.36-1.333.81-.09.224-.061.524.12.868l.015.015c.06.136 1.526 3.475 4.791 4.014.255.044.435.27.42.509 0 .075-.015.149-.045.225-.24.569-1.273.988-3.146 1.271-.059.091-.12.375-.164.57-.029.179-.074.36-.134.553-.076.271-.27.405-.555.405h-.03c-.135 0-.313-.031-.538-.074-.36-.075-.765-.135-1.273-.135-.3 0-.599.015-.913.074-.6.104-1.123.464-1.723.884-.853.599-1.826 1.288-3.294 1.288-.06 0-.119-.015-.18-.015h-.149c-1.468 0-2.427-.675-3.279-1.288-.599-.42-1.107-.779-1.707-.884-.314-.045-.629-.074-.928-.074-.54 0-.958.089-1.272.149-.211.043-.391.074-.54.074-.374 0-.523-.224-.583-.42-.061-.192-.09-.389-.135-.567-.046-.181-.105-.494-.166-.57-1.918-.222-2.95-.642-3.189-1.226-.031-.063-.052-.15-.055-.225-.015-.243.165-.465.42-.509 3.264-.54 4.73-3.879 4.791-4.02l.016-.029c.18-.345.224-.645.119-.869-.195-.434-.884-.658-1.332-.809-.121-.029-.24-.074-.346-.119-1.107-.435-1.257-.93-1.197-1.273.09-.479.674-.793 1.168-.793.146 0 .27.029.383.074.42.194.789.3 1.104.3.234 0 .384-.06.465-.105l-.046-.569c-.098-1.626-.225-3.651.307-4.837C7.392 1.077 10.739.807 11.727.807l.419-.015h.06z"/>
      </svg>
    ),
    url: "https://www.snapchat.com/",
  },
  {
    id: "googlemaps",
    label: "Google Maps",
    color: "text-blue-300",
    bg: "bg-blue-400/10",
    border: "border-blue-400/30",
    icon: <MapPin className="w-4 h-4" />,
    url: "https://www.google.com/maps/",
  },
];

const SAUDI_CITIES = [
  "الرياض", "جدة", "مكة المكرمة", "المدينة المنورة", "الدمام",
  "الخبر", "الطائف", "تبوك", "بريدة", "أبها", "خميس مشيط",
  "نجران", "جازان", "حائل", "ينبع", "الجبيل", "الأحساء",
];

type FormData = {
  companyName: string;
  businessType: string;
  city: string;
  verifiedPhone: string;
  website: string;
  instagramUrl: string;
  facebookUrl: string;
  snapchatUrl: string;
  tiktokUrl: string;
  twitterUrl: string;
  telegramUrl: string;
  notes: string;
  sourceUrl: string;
};

const EMPTY_FORM: FormData = {
  companyName: "", businessType: "", city: "الرياض",
  verifiedPhone: "", website: "", instagramUrl: "", facebookUrl: "",
  snapchatUrl: "", tiktokUrl: "", twitterUrl: "", telegramUrl: "",
  notes: "", sourceUrl: "",
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function ScoutPage() {
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [savedCount, setSavedCount] = useState(0);
  const [lastSavedName, setLastSavedName] = useState<string | null>(null);
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasContentRef = useRef(false);

  const addLeadMutation = trpc.leads.create.useMutation();
  const utils = trpc.useUtils();

  const updateField = useCallback((field: keyof FormData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  // Auto-save logic: triggers 2 seconds after user stops typing, only if companyName is filled
  const saveLead = useCallback(async (data: FormData, isAuto = false) => {
    if (!data.companyName.trim()) return;
    if (saveStatus === "saving") return;

    setSaveStatus("saving");
    try {
      await addLeadMutation.mutateAsync({
        companyName: data.companyName.trim(),
        businessType: data.businessType || "نشاط تجاري",
        city: data.city,
        verifiedPhone: data.verifiedPhone || undefined,
        website: data.website || undefined,
        instagramUrl: data.instagramUrl || undefined,
        facebookUrl: data.facebookUrl || undefined,
        snapchatUrl: data.snapchatUrl || undefined,
        tiktokUrl: data.tiktokUrl || undefined,
        twitterUrl: data.twitterUrl || undefined,
        notes: [
          data.notes,
          data.telegramUrl ? `تيليغرام: ${data.telegramUrl}` : "",
          data.sourceUrl ? `المصدر: ${data.sourceUrl}` : "",
        ].filter(Boolean).join(" | ") || undefined,
      });

      setSaveStatus("saved");
      setSavedCount(prev => prev + 1);
      setLastSavedName(data.companyName.trim());
      utils.leads.list.invalidate();
      utils.leads.stats.invalidate();

      if (isAuto) {
        toast.success(`💾 تم الحفظ التلقائي: "${data.companyName.trim()}"`, { duration: 2000 });
      } else {
        toast.success(`✅ تم الحفظ: "${data.companyName.trim()}"`, { duration: 3000 });
      }

      // Reset form after save
      setTimeout(() => {
        setForm(EMPTY_FORM);
        setSaveStatus("idle");
        hasContentRef.current = false;
      }, 800);
    } catch (err: any) {
      setSaveStatus("error");
      toast.error(err?.message || "فشل الحفظ");
      setTimeout(() => setSaveStatus("idle"), 2000);
    }
  }, [addLeadMutation, utils, saveStatus]);

  // Auto-save: 2 seconds after typing stops, if companyName is filled
  useEffect(() => {
    if (!form.companyName.trim()) return;
    hasContentRef.current = true;

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      saveLead(form, true);
    }, 2500);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [form]);

  const handleReset = () => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    setForm(EMPTY_FORM);
    setSaveStatus("idle");
    hasContentRef.current = false;
  };

  const saveStatusConfig = {
    idle: { icon: <Clock className="w-4 h-4" />, text: "في انتظار البيانات...", color: "text-muted-foreground" },
    saving: { icon: <Loader2 className="w-4 h-4 animate-spin" />, text: "جاري الحفظ...", color: "text-cyan-400" },
    saved: { icon: <CheckCircle2 className="w-4 h-4" />, text: `تم الحفظ ✓`, color: "text-emerald-400" },
    error: { icon: <Zap className="w-4 h-4" />, text: "فشل الحفظ", color: "text-red-400" },
  };

  const statusInfo = saveStatusConfig[saveStatus];

  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30 flex items-center justify-center">
                <User className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">استخراج يدوي</h1>
                <p className="text-sm text-muted-foreground">تصفح أي منصة وأدخل البيانات — تُحفظ تلقائياً</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {savedCount > 0 && (
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                  <CheckCircle2 className="w-3 h-3 ml-1" />
                  {savedCount} محفوظ
                </Badge>
              )}
              <div className={`flex items-center gap-1.5 text-xs font-medium ${statusInfo.color}`}>
                {statusInfo.icon}
                <span>{statusInfo.text}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: Platform shortcuts */}
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-2xl border border-border/50 bg-card/40 p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-muted-foreground" />
              فتح المنصات
            </h2>
            <div className="space-y-2">
              {PLATFORMS.map(p => (
                <a
                  key={p.id}
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all hover:scale-[1.02] ${p.bg} ${p.border}`}
                >
                  <span className={p.color}>{p.icon}</span>
                  <span className={`text-sm font-medium ${p.color}`}>{p.label}</span>
                  <ExternalLink className="w-3 h-3 text-muted-foreground mr-auto" />
                </a>
              ))}
            </div>
          </div>

          {/* Instructions */}
          <div className="rounded-2xl border border-border/50 bg-card/40 p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3">كيفية الاستخدام</h2>
            <ol className="space-y-2 text-xs text-muted-foreground">
              <li className="flex gap-2"><span className="text-cyan-400 font-bold shrink-0">1.</span>افتح المنصة المطلوبة من الروابط أعلاه</li>
              <li className="flex gap-2"><span className="text-cyan-400 font-bold shrink-0">2.</span>ابحث عن العميل يدوياً في المنصة</li>
              <li className="flex gap-2"><span className="text-cyan-400 font-bold shrink-0">3.</span>ارجع هنا وأدخل اسم النشاط على الأقل</li>
              <li className="flex gap-2"><span className="text-emerald-400 font-bold shrink-0">4.</span>سيتم الحفظ تلقائياً بعد 2.5 ثانية من توقفك</li>
              <li className="flex gap-2"><span className="text-violet-400 font-bold shrink-0">5.</span>تُفرَّغ الحقول تلقائياً لإدخال العميل التالي</li>
            </ol>
          </div>

          {/* Last saved */}
          {lastSavedName && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
              <p className="text-xs text-muted-foreground mb-1">آخر عميل محفوظ</p>
              <p className="text-sm font-semibold text-emerald-400">{lastSavedName}</p>
              <p className="text-xs text-muted-foreground mt-1">إجمالي هذه الجلسة: {savedCount}</p>
            </div>
          )}
        </div>

        {/* RIGHT: Data entry form */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-border/50 bg-card/40 p-5 space-y-4">
            {/* Auto-save indicator */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition-all ${
              saveStatus === "saving" ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400" :
              saveStatus === "saved" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" :
              saveStatus === "error" ? "bg-red-500/10 border-red-500/30 text-red-400" :
              "bg-muted/20 border-border/40 text-muted-foreground"
            }`}>
              {statusInfo.icon}
              <span className="font-medium">
                {saveStatus === "idle" && form.companyName ? "سيتم الحفظ تلقائياً بعد 2.5 ثانية..." : statusInfo.text}
              </span>
              {form.companyName && saveStatus === "idle" && (
                <span className="mr-auto text-muted-foreground">أدخل الاسم للبدء</span>
              )}
            </div>

            {/* Required: Company name */}
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block font-medium">
                اسم النشاط التجاري <span className="text-red-400">*</span>
                <span className="text-muted-foreground/60 font-normal mr-1">(مطلوب للحفظ التلقائي)</span>
              </label>
              <Input
                value={form.companyName}
                onChange={e => updateField("companyName", e.target.value)}
                placeholder="مثال: ملحمة الأصيل، مطعم البيت..."
                className="h-11 bg-background/50 border-border/60 rounded-xl text-sm focus:border-violet-500/60"
                dir="rtl"
                autoFocus
              />
            </div>

            {/* Business type + City */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">نوع النشاط</label>
                <Input
                  value={form.businessType}
                  onChange={e => updateField("businessType", e.target.value)}
                  placeholder="مطعم، ملحمة، صالون..."
                  className="h-10 bg-background/50 border-border/60 rounded-xl text-sm"
                  dir="rtl"
                />
              </div>
              <div className="relative">
                <label className="text-xs text-muted-foreground mb-1.5 block">المدينة</label>
                <button
                  type="button"
                  onClick={() => setShowCityDropdown(!showCityDropdown)}
                  className="w-full h-10 px-3 rounded-xl border border-border/60 bg-background/50 text-sm text-right flex items-center justify-between hover:border-violet-500/40 transition-colors"
                >
                  <span>{form.city}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
                {showCityDropdown && (
                  <div className="absolute top-full mt-1 right-0 left-0 bg-card border border-border/60 rounded-xl shadow-2xl z-50 max-h-48 overflow-y-auto">
                    {SAUDI_CITIES.map(c => (
                      <button
                        key={c}
                        className={`w-full text-right px-3 py-2 text-sm hover:bg-accent/50 transition-colors ${c === form.city ? "text-violet-400 bg-violet-500/10" : "text-foreground"}`}
                        onClick={() => { updateField("city", c); setShowCityDropdown(false); }}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Phone + Website */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Phone className="w-3 h-3" /> رقم الهاتف
                </label>
                <Input
                  value={form.verifiedPhone}
                  onChange={e => updateField("verifiedPhone", e.target.value)}
                  placeholder="05XXXXXXXX"
                  className="h-10 bg-background/50 border-border/60 rounded-xl text-sm font-mono"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Globe className="w-3 h-3" /> الموقع الإلكتروني
                </label>
                <Input
                  value={form.website}
                  onChange={e => updateField("website", e.target.value)}
                  placeholder="www.example.com"
                  className="h-10 bg-background/50 border-border/60 rounded-xl text-sm"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Social media */}
            <div>
              <label className="text-xs text-muted-foreground mb-2 block font-medium">حسابات السوشيال ميديا</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { field: "instagramUrl" as keyof FormData, icon: <Instagram className="w-3.5 h-3.5" />, label: "إنستغرام", placeholder: "@username", color: "text-pink-400" },
                  { field: "facebookUrl" as keyof FormData, icon: <Facebook className="w-3.5 h-3.5" />, label: "فيسبوك", placeholder: "facebook.com/page", color: "text-blue-400" },
                  { field: "snapchatUrl" as keyof FormData, icon: <span className="text-yellow-400 text-xs font-bold">SC</span>, label: "سناب شات", placeholder: "@snapuser", color: "text-yellow-400" },
                  { field: "tiktokUrl" as keyof FormData, icon: <span className="text-red-400 text-xs font-bold">TK</span>, label: "تيك توك", placeholder: "@tiktokuser", color: "text-red-400" },
                  { field: "twitterUrl" as keyof FormData, icon: <span className="text-sky-400 text-xs font-bold">X</span>, label: "تويتر / X", placeholder: "@twitteruser", color: "text-sky-400" },
                  { field: "telegramUrl" as keyof FormData, icon: <Send className="w-3.5 h-3.5" />, label: "تيليغرام", placeholder: "t.me/channel", color: "text-sky-300" },
                ].map(({ field, icon, label, placeholder, color }) => (
                  <div key={field} className="flex items-center gap-2 bg-background/30 border border-border/40 rounded-xl px-3 py-2">
                    <span className={color}>{icon}</span>
                    <input
                      value={form[field]}
                      onChange={e => updateField(field, e.target.value)}
                      placeholder={placeholder}
                      className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/50 outline-none min-w-0"
                      dir="ltr"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Notes + Source */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">ملاحظات</label>
                <Input
                  value={form.notes}
                  onChange={e => updateField("notes", e.target.value)}
                  placeholder="أي ملاحظات إضافية..."
                  className="h-10 bg-background/50 border-border/60 rounded-xl text-sm"
                  dir="rtl"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">رابط المصدر</label>
                <Input
                  value={form.sourceUrl}
                  onChange={e => updateField("sourceUrl", e.target.value)}
                  placeholder="رابط الحساب أو الصفحة"
                  className="h-10 bg-background/50 border-border/60 rounded-xl text-sm"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => saveLead(form, false)}
                disabled={!form.companyName.trim() || saveStatus === "saving"}
                className="flex-1 h-11 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {saveStatus === "saving" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                حفظ الآن
              </button>
              <button
                onClick={handleReset}
                className="h-11 px-4 rounded-xl border border-border/60 bg-card/50 text-muted-foreground hover:text-foreground hover:border-border transition-colors flex items-center gap-2 text-sm"
              >
                <RotateCcw className="w-4 h-4" />
                مسح
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
