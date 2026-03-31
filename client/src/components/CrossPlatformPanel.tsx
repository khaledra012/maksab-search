/**
 * CrossPlatformPanel — Search → Compare → Merge Pipeline
 * =======================================================
 * يُظهر نتائج البحث من كل المنصات مقارنةً ويتيح الدمج في lead واحدة
 * باستخدام Identity Linkage من الـ backend.
 *
 * Pipeline:
 *   1. groupCandidates       → تجميع النتائج الخام في مجموعات (backend)
 *   2. checkDuplicateBatch   → فحص التكرار ضد قاعدة البيانات (backend)
 *   3. getMergePreview       → معاينة الـ lead الموحد قبل الحفظ (backend)
 *   4. createFromMerge       → حفظ الـ lead الموحد في قاعدة البيانات (backend)
 */
import { useState, useMemo, useEffect } from "react";
import {
  Map, Instagram, Video, Camera, Twitter, Linkedin, Users, SearchCheck,
  CheckCircle2, XCircle, Layers, Plus, Merge, ChevronDown, ChevronUp,
  Phone, Globe, MapPin, ExternalLink, Star, AlertTriangle, Link2,
  Loader2, Sparkles, Eye, Save, RefreshCw, Columns, FileText, Copy,
  Check, AlertCircle, Database
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { canonicalizeRawResults } from "@/lib/sourceRegistry";

// ===== Types =====
export interface MergedLeadData {
  companyName: string;
  businessType?: string;
  city?: string;
  phone?: string;
  website?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  snapchatUrl?: string;
  twitterUrl?: string;
  linkedinUrl?: string;
  facebookUrl?: string;
  googleMapsUrl?: string;
  sources: string[];
}

interface PlatformResult {
  name?: string;
  fullName?: string;
  username?: string;
  phone?: string;
  formatted_phone_number?: string;
  website?: string;
  city?: string;
  formatted_address?: string;
  followersCount?: number;
  rating?: number;
  profileUrl?: string;
  url?: string;
  businessCategory?: string;
  bio?: string;
  description?: string;
  place_id?: string;
  id?: string;
}

interface Props {
  results: Record<string, PlatformResult[]>;
  loading: Record<string, boolean>;
  keyword: string;
  city?: string;
  onAddLead: (data: MergedLeadData) => void;
}

// ===== Platform definitions =====
const PLATFORM_META: Record<string, { label: string; icon: any; color: string; bg: string; border: string; badge: string }> = {
  google:     { label: "Google Maps",   icon: Map,        color: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/30",  badge: "bg-green-500/20 text-green-400 border-green-500/40" },
  googleWeb:  { label: "Google Search", icon: SearchCheck, color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30", badge: "bg-orange-500/20 text-orange-400 border-orange-500/40" },
  instagram:  { label: "إنستجرام",      icon: Instagram,  color: "text-pink-400",   bg: "bg-pink-500/10",   border: "border-pink-500/30",   badge: "bg-pink-500/20 text-pink-400 border-pink-500/40" },
  tiktok:     { label: "تيك توك",       icon: Video,      color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/30", badge: "bg-purple-500/20 text-purple-400 border-purple-500/40" },
  snapchat:   { label: "سناب شات",      icon: Camera,     color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30", badge: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40" },
  twitter:    { label: "تويتر / X",     icon: Twitter,    color: "text-sky-400",    bg: "bg-sky-500/10",    border: "border-sky-500/30",    badge: "bg-sky-500/20 text-sky-400 border-sky-500/40" },
  linkedin:   { label: "لينكدإن",       icon: Linkedin,   color: "text-blue-500",   bg: "bg-blue-600/10",   border: "border-blue-600/30",   badge: "bg-blue-600/20 text-blue-500 border-blue-600/40" },
  facebook:   { label: "فيسبوك",        icon: Users,      color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/30", badge: "bg-indigo-500/20 text-indigo-400 border-indigo-500/40" },
};

const PLATFORM_IDS = Object.keys(PLATFORM_META);

// ===== Helper: get display name from result =====
function getResultName(r: PlatformResult): string {
  return r.name || r.fullName || r.username || "";
}

// ===== Helper: get URL from result for a platform =====
function getResultUrl(r: PlatformResult, platformId: string): string | undefined {
  if (r.profileUrl) return r.profileUrl;
  if (r.url) return r.url;
  if (r.username) {
    if (platformId === "instagram") return `https://instagram.com/${r.username}`;
    if (platformId === "tiktok") return `https://tiktok.com/@${r.username}`;
    if (platformId === "snapchat") return `https://snapchat.com/add/${r.username}`;
    if (platformId === "twitter") return `https://twitter.com/${r.username}`;
    if (platformId === "linkedin") return `https://linkedin.com/company/${r.username}`;
    if (platformId === "facebook") return `https://facebook.com/${r.username}`;
  }
  return undefined;
}

// ===== Helper: get phone from result =====
function getResultPhone(r: PlatformResult): string | undefined {
  return r.phone || r.formatted_phone_number || undefined;
}

// ===== FieldRow: صف حقل واحد في المقارنة جنباً إلى جنب =====
function FieldRow({
  label,
  values,
  selectedSource,
  onSelect,
  isUrl = false,
}: {
  label: string;
  values: Array<{ source: string; value: string }>;
  selectedSource: string | null;
  onSelect: (source: string, value: string) => void;
  isUrl?: boolean;
}) {
  const nonEmpty = values.filter(v => v.value);
  if (nonEmpty.length === 0) return null;

  return (
    <div className="border-b border-border/30 last:border-0">
      <div className="px-3 py-1.5 bg-muted/10">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
      </div>
      <div className="divide-y divide-border/20">
        {nonEmpty.map(({ source, value }, idx) => {
          const meta = PLATFORM_META[source];
          const isSelected = selectedSource === source;
          return (
            <button
              key={`${source}-${idx}`}
              onClick={() => onSelect(source, value)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-right transition-colors ${
                isSelected
                  ? "bg-primary/15 border-r-2 border-primary"
                  : "hover:bg-muted/20"
              }`}
            >
              {meta && (
                <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${meta.bg} ${meta.border} border`}>
                  <meta.icon className={`w-2.5 h-2.5 ${meta.color}`} />
                </div>
              )}
              <span
                className={`flex-1 text-xs truncate text-right ${isUrl ? "font-mono text-blue-400" : ""} ${isSelected ? "text-foreground font-medium" : "text-muted-foreground"}`}
                dir={isUrl ? "ltr" : "rtl"}
              >
                {value}
              </span>
              {isSelected && <Check className="w-3 h-3 text-primary shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ===== MergePreviewDialog =====
function MergePreviewDialog({
  candidatesJson,
  city,
  onConfirm,
  onClose,
}: {
  candidatesJson: string;
  city?: string;
  onConfirm: (overrides: Partial<MergedLeadData>) => Promise<void>;
  onClose: () => void;
}) {
  const previewMut = trpc.leadIntelligence.getMergePreview.useMutation();
  const [preview, setPreview] = useState<any>(null);
  const [form, setForm] = useState<Partial<MergedLeadData>>({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"edit" | "compare">("compare");

  // بيانات المقارنة: قيمة كل حقل من كل مصدر
  const [candidates, setCandidates] = useState<any[]>([]);

  // الاختيارات في تبويب المقارنة
  const [selectedSources, setSelectedSources] = useState<Record<string, { source: string; value: string }>>({});

  useEffect(() => {
    let parsed: any[] = [];
    try {
      parsed = JSON.parse(candidatesJson);
      setCandidates(parsed);
    } catch {}

    previewMut.mutateAsync({ candidatesJson }).then(res => {
      setPreview(res);
      const l = res.lead;
      const initialForm = {
        companyName: l.businessName || "",
        businessType: l.category || "",
        city: l.city || city || "",
        phone: l.verifiedPhones?.[0] || l.candidatePhones?.[0] || "",
        website: l.verifiedWebsite || l.candidateWebsites?.[0] || "",
        instagramUrl: l.socialProfiles?.instagram || "",
        tiktokUrl: l.socialProfiles?.tiktok || "",
        snapchatUrl: l.socialProfiles?.snapchat || "",
        twitterUrl: l.socialProfiles?.x || "",
        linkedinUrl: l.socialProfiles?.linkedin || "",
        facebookUrl: l.socialProfiles?.facebook || "",
        googleMapsUrl: l.googleMapsUrl || "",
      };
      setForm(initialForm);

      // تهيئة الاختيارات الافتراضية من fieldSources
      const fs = res.fieldSources || {};
      const initSelected: Record<string, { source: string; value: string }> = {};
      if (fs.businessName) initSelected.companyName = { source: fs.businessName, value: initialForm.companyName || "" };
      if (fs.phone) initSelected.phone = { source: fs.phone, value: initialForm.phone || "" };
      if (fs.website) initSelected.website = { source: fs.website, value: initialForm.website || "" };
      if (fs.city) initSelected.city = { source: fs.city, value: initialForm.city || "" };
      setSelectedSources(initSelected);

      setLoaded(true);
    }).catch(() => {
      setLoaded(true);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sources = preview?.sources || [];
  const confidence = preview?.mergeConfidence || 0;
  const fieldSources = preview?.fieldSources || {};

  // بناء قيم كل حقل من كل مصدر للمقارنة
  const fieldValues = useMemo(() => {
    const fields: Record<string, Array<{ source: string; value: string }>> = {
      companyName: [],
      phone: [],
      website: [],
      city: [],
      category: [],
      instagram: [],
      tiktok: [],
      snapchat: [],
      twitter: [],
      linkedin: [],
      facebook: [],
      googleMaps: [],
    };

    for (const c of candidates) {
      const src = c.source || "unknown";
      const name = c.businessNameHint || c.nameHint || "";
      const phone = c.verifiedPhones?.[0] || c.candidatePhones?.[0] || "";
      const website = c.verifiedWebsite || c.candidateWebsites?.[0] || "";
      const cityVal = c.cityHint || "";
      const cat = c.categoryHint || "";
      const url = c.url || "";

      if (name && !fields.companyName.find(v => v.value === name)) fields.companyName.push({ source: src, value: name });
      if (phone && !fields.phone.find(v => v.value === phone)) fields.phone.push({ source: src, value: phone });
      if (website && !fields.website.find(v => v.value === website)) fields.website.push({ source: src, value: website });
      if (cityVal && !fields.city.find(v => v.value === cityVal)) fields.city.push({ source: src, value: cityVal });
      if (cat && !fields.category.find(v => v.value === cat)) fields.category.push({ source: src, value: cat });

      // روابط السوشيال
      if (src === "instagram" && url) fields.instagram.push({ source: src, value: url });
      if (src === "tiktok" && url) fields.tiktok.push({ source: src, value: url });
      if (src === "snapchat" && url) fields.snapchat.push({ source: src, value: url });
      if (src === "x" && url) fields.twitter.push({ source: src, value: url });
      if (src === "linkedin" && url) fields.linkedin.push({ source: src, value: url });
      if (src === "facebook" && url) fields.facebook.push({ source: src, value: url });
      if ((src === "maps" || src === "google") && url) fields.googleMaps.push({ source: src, value: url });
    }

    return fields;
  }, [candidates]);

  // تطبيق اختيار من تبويب المقارنة على النموذج
  const handleFieldSelect = (fieldKey: string, source: string, value: string) => {
    setSelectedSources(prev => ({ ...prev, [fieldKey]: { source, value } }));
    const formKeyMap: Record<string, keyof MergedLeadData> = {
      companyName: "companyName",
      phone: "phone",
      website: "website",
      city: "city",
      category: "businessType",
      instagram: "instagramUrl",
      tiktok: "tiktokUrl",
      snapchat: "snapchatUrl",
      twitter: "twitterUrl",
      linkedin: "linkedinUrl",
      facebook: "facebookUrl",
      googleMaps: "googleMapsUrl",
    };
    const formKey = formKeyMap[fieldKey];
    if (formKey) {
      setForm(f => ({ ...f, [formKey]: value }));
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" dir="rtl">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Eye className="w-4 h-4 text-primary" />
            معاينة الدمج الذكي
          </DialogTitle>
        </DialogHeader>

        {!loaded ? (
          <div className="flex items-center justify-center py-8 gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">جاري تحليل البيانات...</span>
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0 gap-3">
            {/* Platform badges + confidence */}
            <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-border shrink-0">
              {sources.map((src: string) => {
                const meta = PLATFORM_META[src] || PLATFORM_META.google;
                return (
                  <span key={src} className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${meta.badge}`}>
                    <meta.icon className="w-3 h-3" />
                    {meta.label}
                  </span>
                );
              })}
              {confidence > 0 && (
                <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${
                  confidence >= 80 ? "bg-green-500/20 text-green-400 border-green-500/40" :
                  confidence >= 50 ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/40" :
                  "bg-muted/30 text-muted-foreground border-border"
                }`}>
                  <Sparkles className="w-2.5 h-2.5 inline ml-1" />
                  ثقة {confidence}%
                </span>
              )}
              <span className="mr-auto text-xs text-muted-foreground">
                {candidates.length} مصدر → lead واحد
              </span>
            </div>

            {/* Merge Signals */}
            {preview?.mergeSignals && preview.mergeSignals.length > 0 && (
              <div className="flex flex-wrap gap-1.5 shrink-0">
                {preview.mergeSignals.map((sig: { type: string; description: string; strength: string }, i: number) => (
                  <span key={`sig-${sig.type}-${i}`} className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${
                    sig.strength === "strong" ? "bg-green-500/10 text-green-400 border-green-500/30" :
                    sig.strength === "moderate" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" :
                    "bg-muted/20 text-muted-foreground border-border/50"
                  }`}>
                    {sig.strength === "strong" ? "⚡" : sig.strength === "moderate" ? "≈" : "•"} {sig.description}
                  </span>
                ))}
              </div>
            )}

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)} className="flex-1 flex flex-col min-h-0">
              <TabsList className="grid grid-cols-2 h-8 shrink-0">
                <TabsTrigger value="compare" className="text-xs gap-1.5">
                  <Columns className="w-3 h-3" />
                  مقارنة المصادر
                </TabsTrigger>
                <TabsTrigger value="edit" className="text-xs gap-1.5">
                  <FileText className="w-3 h-3" />
                  تعديل البيانات
                </TabsTrigger>
              </TabsList>

              {/* ===== تبويب المقارنة جنباً إلى جنب ===== */}
              <TabsContent value="compare" className="flex-1 overflow-y-auto mt-2">
                <div className="rounded-xl border border-border overflow-hidden">
                  {/* Header */}
                  <div className="bg-muted/20 px-3 py-2 border-b border-border">
                    <p className="text-xs text-muted-foreground">
                      اضغط على أي قيمة لاختيارها كمصدر رئيسي للحقل. القيم المختارة تُطبَّق تلقائياً في تبويب التعديل.
                    </p>
                  </div>

                  <FieldRow
                    label="اسم النشاط"
                    values={fieldValues.companyName}
                    selectedSource={selectedSources.companyName?.source || null}
                    onSelect={(src, val) => handleFieldSelect("companyName", src, val)}
                  />
                  <FieldRow
                    label="رقم الهاتف"
                    values={fieldValues.phone}
                    selectedSource={selectedSources.phone?.source || null}
                    onSelect={(src, val) => handleFieldSelect("phone", src, val)}
                    isUrl={false}
                  />
                  <FieldRow
                    label="الموقع الإلكتروني"
                    values={fieldValues.website}
                    selectedSource={selectedSources.website?.source || null}
                    onSelect={(src, val) => handleFieldSelect("website", src, val)}
                    isUrl
                  />
                  <FieldRow
                    label="المدينة"
                    values={fieldValues.city}
                    selectedSource={selectedSources.city?.source || null}
                    onSelect={(src, val) => handleFieldSelect("city", src, val)}
                  />
                  <FieldRow
                    label="نوع النشاط"
                    values={fieldValues.category}
                    selectedSource={selectedSources.category?.source || null}
                    onSelect={(src, val) => handleFieldSelect("category", src, val)}
                  />
                  <FieldRow
                    label="إنستجرام"
                    values={fieldValues.instagram}
                    selectedSource={selectedSources.instagram?.source || null}
                    onSelect={(src, val) => handleFieldSelect("instagram", src, val)}
                    isUrl
                  />
                  <FieldRow
                    label="تيك توك"
                    values={fieldValues.tiktok}
                    selectedSource={selectedSources.tiktok?.source || null}
                    onSelect={(src, val) => handleFieldSelect("tiktok", src, val)}
                    isUrl
                  />
                  <FieldRow
                    label="سناب شات"
                    values={fieldValues.snapchat}
                    selectedSource={selectedSources.snapchat?.source || null}
                    onSelect={(src, val) => handleFieldSelect("snapchat", src, val)}
                    isUrl
                  />
                  <FieldRow
                    label="تويتر / X"
                    values={fieldValues.twitter}
                    selectedSource={selectedSources.twitter?.source || null}
                    onSelect={(src, val) => handleFieldSelect("twitter", src, val)}
                    isUrl
                  />
                  <FieldRow
                    label="لينكدإن"
                    values={fieldValues.linkedin}
                    selectedSource={selectedSources.linkedin?.source || null}
                    onSelect={(src, val) => handleFieldSelect("linkedin", src, val)}
                    isUrl
                  />
                  <FieldRow
                    label="فيسبوك"
                    values={fieldValues.facebook}
                    selectedSource={selectedSources.facebook?.source || null}
                    onSelect={(src, val) => handleFieldSelect("facebook", src, val)}
                    isUrl
                  />
                  <FieldRow
                    label="Google Maps"
                    values={fieldValues.googleMaps}
                    selectedSource={selectedSources.googleMaps?.source || null}
                    onSelect={(src, val) => handleFieldSelect("googleMaps", src, val)}
                    isUrl
                  />
                </div>

                {/* ملخص الاختيارات */}
                {Object.keys(selectedSources).length > 0 && (
                  <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <p className="text-xs font-semibold text-primary mb-2">الاختيارات الحالية:</p>
                    <div className="space-y-1">
                      {Object.entries(selectedSources).map(([field, { source, value }]) => {
                        const meta = PLATFORM_META[source];
                        const fieldLabels: Record<string, string> = {
                          companyName: "الاسم", phone: "الهاتف", website: "الموقع",
                          city: "المدينة", category: "النوع", instagram: "إنستجرام",
                          tiktok: "تيك توك", snapchat: "سناب", twitter: "تويتر",
                          linkedin: "لينكدإن", facebook: "فيسبوك", googleMaps: "Maps",
                        };
                        return (
                          <div key={field} className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground w-16 shrink-0">{fieldLabels[field] || field}:</span>
                            {meta && <meta.icon className={`w-3 h-3 ${meta.color} shrink-0`} />}
                            <span className="text-foreground truncate">{value}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* ===== تبويب التعديل ===== */}
              <TabsContent value="edit" className="flex-1 overflow-y-auto mt-2">
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Label className="text-xs text-muted-foreground mb-1 block">
                        اسم النشاط
                        {fieldSources.businessName && (
                          <span className="mr-1 text-[10px] text-muted-foreground/60">
                            (من {PLATFORM_META[fieldSources.businessName]?.label || fieldSources.businessName})
                          </span>
                        )}
                      </Label>
                      <Input
                        value={form.companyName || ""}
                        onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">نوع النشاط</Label>
                      <Input
                        value={form.businessType || ""}
                        onChange={e => setForm(f => ({ ...f, businessType: e.target.value }))}
                        className="h-8 text-sm"
                        placeholder="مطعم، صالون، متجر..."
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">
                        المدينة
                        {fieldSources.city && (
                          <span className="mr-1 text-[10px] text-muted-foreground/60">
                            (من {PLATFORM_META[fieldSources.city]?.label || fieldSources.city})
                          </span>
                        )}
                      </Label>
                      <Input
                        value={form.city || ""}
                        onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">
                        رقم الهاتف
                        {fieldSources.phone && (
                          <span className="mr-1 text-[10px] text-muted-foreground/60">
                            (من {PLATFORM_META[fieldSources.phone]?.label || fieldSources.phone})
                          </span>
                        )}
                      </Label>
                      <Input
                        value={form.phone || ""}
                        onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                        className="h-8 text-sm font-mono"
                        dir="ltr"
                        placeholder="+966..."
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">
                        الموقع الإلكتروني
                        {fieldSources.website && (
                          <span className="mr-1 text-[10px] text-muted-foreground/60">
                            (من {PLATFORM_META[fieldSources.website]?.label || fieldSources.website})
                          </span>
                        )}
                      </Label>
                      <Input
                        value={form.website || ""}
                        onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                        className="h-8 text-sm"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  {/* Social URLs */}
                  <div className="space-y-2 pt-1 border-t border-border">
                    <p className="text-xs text-muted-foreground font-medium">روابط المنصات</p>
                    {[
                      { key: "instagramUrl" as const, label: "إنستجرام", platformId: "instagram" },
                      { key: "tiktokUrl" as const, label: "تيك توك", platformId: "tiktok" },
                      { key: "snapchatUrl" as const, label: "سناب شات", platformId: "snapchat" },
                      { key: "twitterUrl" as const, label: "تويتر", platformId: "twitter" },
                      { key: "linkedinUrl" as const, label: "لينكدإن", platformId: "linkedin" },
                      { key: "facebookUrl" as const, label: "فيسبوك", platformId: "facebook" },
                      { key: "googleMapsUrl" as const, label: "Google Maps", platformId: "google" },
                    ].map(({ key, label, platformId }) => {
                      const meta = PLATFORM_META[platformId];
                      const val = form[key] || "";
                      const hasSrc = sources.includes(platformId);
                      return (
                        <div key={key} className="flex items-center gap-2">
                          <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${meta.bg} ${meta.border} border`}>
                            <meta.icon className={`w-3 h-3 ${meta.color}`} />
                          </div>
                          <Input
                            value={val}
                            onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                            className={`h-7 text-xs flex-1 ${hasSrc ? "" : "opacity-50"}`}
                            dir="ltr"
                            placeholder={`رابط ${label}`}
                          />
                          {hasSrc && val && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}

        <DialogFooter className="flex gap-2 pt-2 shrink-0 border-t border-border mt-2">
          <Button variant="outline" onClick={onClose} className="flex-1 h-8 text-sm">
            إلغاء
          </Button>
          <Button
            onClick={() => { if (!saving) { setSaving(true); onConfirm(form).finally(() => setSaving(false)); } }}
            disabled={!loaded || !form.companyName?.trim() || saving}
            className="flex-1 h-8 text-sm gap-1.5"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? 'جاري الحفظ...' : 'حفظ كعميل'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== CandidateGroupCard =====
interface GroupData {
  primaryName: string;
  primarySource: string;
  primaryUrl?: string;
  primaryPhone?: string;
  primaryWebsite?: string;
  primaryCity?: string;
  primaryCategory?: string;
  mergeConfidence: number;
  sources: string[];
  duplicateCount: number;
  duplicates: Array<{ name: string; source: string; url?: string; phone?: string }>;
  _candidatesJson: string;
  // حالة التكرار
  isDuplicate?: boolean;
  existingLeadId?: number | null;
  duplicateReason?: string;
}

interface SingleData {
  name: string;
  source: string;
  url?: string;
  phone?: string;
  website?: string;
  city?: string;
  category?: string;
  _candidateJson: string;
  // حالة التكرار
  isDuplicate?: boolean;
  existingLeadId?: number | null;
  duplicateReason?: string;
}

function CandidateGroupCard({
  group,
  city,
  onMerge,
  onAddSingle,
}: {
  group: GroupData;
  city?: string;
  onMerge: (g: GroupData) => void;
  onAddSingle: (candidateJson: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`rounded-xl border transition-all ${
      group.isDuplicate
        ? "border-amber-500/40 bg-amber-500/5"
        : "border-primary/30 bg-primary/5"
    }`}>
      {/* Header */}
      <div className="flex items-start gap-3 p-3">
        {/* Platform icons */}
        <div className="flex flex-col gap-1 shrink-0 mt-0.5">
          {group.sources.slice(0, 3).map(src => {
            const meta = PLATFORM_META[src];
            if (!meta) return null;
            return (
              <div key={src} className={`w-6 h-6 rounded-md ${meta.bg} ${meta.border} border flex items-center justify-center`}>
                <meta.icon className={`w-3 h-3 ${meta.color}`} />
              </div>
            );
          })}
          {group.sources.length > 3 && (
            <div className="w-6 h-6 rounded-md bg-muted/30 border border-border flex items-center justify-center">
              <span className="text-[9px] text-muted-foreground font-bold">+{group.sources.length - 3}</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-semibold text-sm text-foreground leading-tight truncate">{group.primaryName}</h4>
                {/* شارة التكرار */}
                {group.isDuplicate && (
                  <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 shrink-0">
                    <Database className="w-2.5 h-2.5" />
                    موجود مسبقاً
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                {group.primaryCity && <span className="flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{group.primaryCity}</span>}
                {group.primaryPhone && <span className="flex items-center gap-0.5 text-green-400"><Phone className="w-2.5 h-2.5" /><span dir="ltr">{group.primaryPhone}</span></span>}
                {group.primaryWebsite && <span className="flex items-center gap-0.5 text-blue-400 truncate max-w-[120px]"><Globe className="w-2.5 h-2.5 shrink-0" />{group.primaryWebsite}</span>}
              </div>
              {/* سبب التكرار */}
              {group.isDuplicate && group.duplicateReason && (
                <p className="text-[10px] text-amber-400/80 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-2.5 h-2.5 shrink-0" />
                  {group.duplicateReason === "phone_match" ? "تطابق رقم الهاتف" :
                   group.duplicateReason === "name_match" ? "تطابق الاسم" :
                   group.duplicateReason === "website_match" ? "تطابق الموقع" :
                   group.duplicateReason}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <Badge className="text-[10px] px-1.5 py-0 bg-primary/20 text-primary border-primary/30">
                {group.sources.length} منصات
              </Badge>
              <span className={`text-[10px] px-1.5 py-0 rounded-full border font-semibold ${
                group.mergeConfidence >= 80 ? "bg-green-500/20 text-green-400 border-green-500/40" :
                group.mergeConfidence >= 50 ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/40" :
                "bg-muted/30 text-muted-foreground border-border"
              }`}>
                <Sparkles className="w-2 h-2 inline ml-0.5" />
                {group.mergeConfidence}%
              </span>
            </div>
          </div>

          {/* Platform chips */}
          <div className="flex flex-wrap gap-1 mt-2">
            {group.sources.map(src => {
              const meta = PLATFORM_META[src];
              if (!meta) return null;
              return (
                <span key={src} className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${meta.badge}`}>
                  <meta.icon className="w-2.5 h-2.5" />
                  {meta.label}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 px-3 pb-3 pt-0">
        <Button
          size="sm"
          className={`flex-1 h-7 text-xs gap-1.5 ${group.isDuplicate ? "bg-amber-500/80 hover:bg-amber-500" : ""}`}
          onClick={() => onMerge(group)}
        >
          <Merge className="w-3 h-3" />
          {group.isDuplicate ? "دمج وتحديث" : "دمج ذكي وإضافة"}
        </Button>
        <button
          onClick={() => setExpanded(v => !v)}
          className="h-7 w-7 flex items-center justify-center rounded-lg border border-border hover:bg-muted/30 transition-colors"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-border/50 pt-3 space-y-2">
          {/* Primary */}
          <div className={`rounded-lg p-2.5 border ${PLATFORM_META[group.primarySource]?.bg || "bg-muted/10"} ${PLATFORM_META[group.primarySource]?.border || "border-border"}`}>
            <div className="flex items-center gap-1.5 mb-1">
              {PLATFORM_META[group.primarySource] && (
                <>
                  {(() => { const M = PLATFORM_META[group.primarySource]; return <M.icon className={`w-3 h-3 ${M.color}`} />; })()}
                  <span className={`text-[11px] font-semibold ${PLATFORM_META[group.primarySource].color}`}>{PLATFORM_META[group.primarySource].label}</span>
                </>
              )}
              <Badge className="text-[9px] px-1 py-0 bg-primary/20 text-primary border-primary/30 mr-auto">رئيسي</Badge>
            </div>
            <p className="text-xs font-medium">{group.primaryName}</p>
            {group.primaryPhone && <p className="text-[10px] text-green-400 font-mono" dir="ltr">{group.primaryPhone}</p>}
            {group.primaryUrl && (
              <a href={group.primaryUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 flex items-center gap-0.5 mt-0.5">
                <ExternalLink className="w-2.5 h-2.5" />
                <span className="truncate max-w-[200px]">{group.primaryUrl}</span>
              </a>
            )}
          </div>
          {/* Duplicates */}
          {group.duplicates.map((d, i) => {
            const meta = PLATFORM_META[d.source];
            return (
              <div key={i} className={`rounded-lg p-2.5 border ${meta?.bg || "bg-muted/10"} ${meta?.border || "border-border"}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  {meta && <meta.icon className={`w-3 h-3 ${meta.color}`} />}
                  <span className={`text-[11px] font-semibold ${meta?.color || "text-muted-foreground"}`}>{meta?.label || d.source}</span>
                </div>
                <p className="text-xs font-medium">{d.name}</p>
                {d.phone && <p className="text-[10px] text-green-400 font-mono" dir="ltr">{d.phone}</p>}
                {d.url && (
                  <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 flex items-center gap-0.5 mt-0.5">
                    <ExternalLink className="w-2.5 h-2.5" />
                    <span className="truncate max-w-[200px]">{d.url}</span>
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ===== SingleCandidateCard =====
function SingleCandidateCard({
  single,
  onAdd,
}: {
  single: SingleData;
  onAdd: (candidateJson: string) => void;
}) {
  const meta = PLATFORM_META[single.source];
  return (
    <div className={`rounded-xl border flex items-center gap-3 px-3 py-2.5 ${
      single.isDuplicate
        ? "border-amber-500/30 bg-amber-500/5"
        : "border-border bg-card/50"
    }`}>
      {meta && (
        <div className={`w-7 h-7 rounded-lg ${meta.bg} ${meta.border} border flex items-center justify-center shrink-0`}>
          <meta.icon className={`w-3.5 h-3.5 ${meta.color}`} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{single.name || "غير معروف"}</p>
          {single.isDuplicate && (
            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 shrink-0">
              <Database className="w-2.5 h-2.5" />
              موجود
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
          {single.city && <span className="flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{single.city}</span>}
          {single.phone && <span className="flex items-center gap-0.5 text-green-400"><Phone className="w-2.5 h-2.5" /><span dir="ltr">{single.phone}</span></span>}
          {single.url && (
            <a href={single.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 text-blue-400 hover:underline truncate max-w-[120px]">
              <Link2 className="w-2.5 h-2.5 shrink-0" />
              <span className="truncate">{single.url.replace(/https?:\/\/(www\.)?/, "")}</span>
            </a>
          )}
        </div>
      </div>
      <Button
        size="sm"
        variant={single.isDuplicate ? "outline" : "outline"}
        className={`h-7 text-xs gap-1 shrink-0 ${single.isDuplicate ? "border-amber-500/40 text-amber-400 hover:bg-amber-500/10" : ""}`}
        onClick={() => onAdd(single._candidateJson)}
      >
        <Plus className="w-3 h-3" />
        {single.isDuplicate ? "تحديث" : "إضافة"}
      </Button>
    </div>
  );
}

// ===== Main CrossPlatformPanel =====
export function CrossPlatformPanel({ results, loading, keyword, city, onAddLead }: Props) {
  const groupCandidatesMut = trpc.leadIntelligence.groupCandidates.useMutation();
  const createFromMergeMut = trpc.leadIntelligence.createFromMerge.useMutation();
  const checkDuplicateBatchMut = trpc.leadIntelligence.checkDuplicateBatch.useMutation();

  const [aiEnrichmentSummary, setAiEnrichmentSummary] = useState<{
    totalProcessed: number;
    successCount: number;
    failureCount: number;
    fieldsExtracted: { phones: number; websites: number; socialHandles: number; cities: number; categories: number };
    processingMs: number;
  } | null>(null);

  const [groupedData, setGroupedData] = useState<{
    groups: GroupData[];
    singles: SingleData[];
    stats: { totalCandidates: number; totalGroups: number; mergedCount: number };
    aiEnrichment?: { totalProcessed: number; successCount: number; failureCount: number; fieldsExtracted: { phones: number; websites: number; socialHandles: number; cities: number }; processingMs: number } | null;
    diagnostics?: Array<{
      platform: string;
      rawCount: number;
      parsedCount: number;
      withPhone: number;
      withWebsite: number;
      withUsername: number;
      withCity: number;
      dataQuality: "rich" | "moderate" | "sparse" | "empty";
    }>;
  } | null>(null);
  const [isGrouping, setIsGrouping] = useState(false);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [mergeTarget, setMergeTarget] = useState<GroupData | null>(null);
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);
  const [isMergingAll, setIsMergingAll] = useState(false);
  const [mergeAllProgress, setMergeAllProgress] = useState<{ done: number; total: number; created: number; skipped: number } | null>(null);

  // حساب Platform Coverage
  const coverage = useMemo(() => {
    return PLATFORM_IDS.map(id => ({
      id,
      meta: PLATFORM_META[id],
      count: (results[id] || []).length,
      isLoading: loading[id] || false,
    }));
  }, [results, loading]);

  const totalFound = coverage.filter(c => c.count > 0).length;
  const totalResults = coverage.reduce((s, c) => s + c.count, 0);
  const isAnyLoading = Object.values(loading).some(Boolean);

  // فحص التكرار بعد التجميع
  const checkDuplicates = async (data: {
    groups: GroupData[];
    singles: SingleData[];
    stats: any;
  }) => {
    setIsCheckingDuplicates(true);
    try {
      // بناء قائمة للفحص من المجموعات والمفردات
      const checkItems: Array<{ id: string; companyName?: string; phone?: string; website?: string }> = [];

      data.groups.forEach((g, i) => {
        checkItems.push({
          id: `group-${i}`,
          companyName: g.primaryName,
          phone: g.primaryPhone,
          website: g.primaryWebsite,
        });
      });

      data.singles.forEach((s, i) => {
        checkItems.push({
          id: `single-${i}`,
          companyName: s.name,
          phone: s.phone,
          website: s.website,
        });
      });

      if (checkItems.length === 0) {
        setGroupedData(data);
        return;
      }

      // استدعاء checkDuplicateBatch عبر mutation
      const dupResults = await checkDuplicateBatchMut.mutateAsync(checkItems);

      // تطبيق نتائج الفحص على المجموعات والمفردات
      const updatedGroups = data.groups.map((g, i) => {
        const dup = dupResults[`group-${i}`];
        return {
          ...g,
          isDuplicate: dup?.isDuplicate || false,
          existingLeadId: dup?.existingLeadId || null,
          duplicateReason: dup?.reason || "",
        };
      });

      const updatedSingles = data.singles.map((s, i) => {
        const dup = dupResults[`single-${i}`];
        return {
          ...s,
          isDuplicate: dup?.isDuplicate || false,
          existingLeadId: dup?.existingLeadId || null,
          duplicateReason: dup?.reason || "",
        };
      });

      setGroupedData({ ...data, groups: updatedGroups, singles: updatedSingles });
    } catch {
      // fallback: عرض البيانات بدون شارات تكرار
      setGroupedData(data);
    } finally {
      setIsCheckingDuplicates(false);
    }
  };

  // تشغيل groupCandidates تلقائياً عند تغيير النتائج
  useEffect(() => {
    if (totalResults === 0 || isAnyLoading) return;

    const rawResults: Record<string, Record<string, unknown>[]> = {};
    for (const [platform, platformResults] of Object.entries(results)) {
      if (platformResults.length > 0) {
        rawResults[platform] = platformResults.map(r => {
          const url = getResultUrl(r, platform);
          return {
            ...r,
            url: url || r.url || r.profileUrl,
            phone: getResultPhone(r),
          } as Record<string, unknown>;
        });
      }
    }

    if (Object.keys(rawResults).length === 0) return;

    setIsGrouping(true);
    setAiEnrichmentSummary(null);
    groupCandidatesMut.mutateAsync({ rawResults })
      .then(data => {
        // حفظ ملخص AI Enrichment
        if ((data as any).aiEnrichment) {
          setAiEnrichmentSummary((data as any).aiEnrichment);
        }
        // تمرير platformDiagnostics إلى checkDuplicates
        const enrichedData = {
          ...data,
          diagnostics: (data as any).platformDiagnostics || [],
        };
        checkDuplicates(enrichedData as any);
      })
      .catch(() => {})
      .finally(() => setIsGrouping(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalResults, isAnyLoading]);

  // معالج الدمج الذكي
  const handleMerge = (group: GroupData) => {
    setMergeTarget(group);
  };

  // معالج إضافة مفرد
  const handleAddSingle = async (candidateJson: string) => {
    try {
      const result = await createFromMergeMut.mutateAsync({
        candidatesJson: `[${candidateJson}]`,
      });
      if (result.status === "duplicate") {
        toast.warning("العميل موجود مسبقاً", {
          description: `"${result.companyName}" مدرج بالفعل في قاعدة البيانات`,
          action: result.existingId ? {
            label: "عرض العميل",
            onClick: () => window.open(`/leads/${result.existingId}`, "_blank"),
          } : undefined,
        });
        return;
      }
      toast.success("تمت الإضافة كعميل محتمل", {
        description: result.companyName,
      });
      onAddLead({
        companyName: result.companyName,
        city: result.city,
        phone: result.phone,
        website: result.website,
        sources: result.sources,
      });
    } catch (e: any) {
      toast.error("خطأ في الإضافة", { description: e.message });
    }
  };

  // معالج تأكيد الدمج من Dialog
  const handleMergeConfirm = async (overrides: Partial<MergedLeadData>) => {
    if (!mergeTarget) return;
    try {
      const result = await createFromMergeMut.mutateAsync({
        candidatesJson: mergeTarget._candidatesJson,
        overrides: {
          companyName: overrides.companyName,
          businessType: overrides.businessType,
          city: overrides.city,
          phone: overrides.phone,
          website: overrides.website,
          instagramUrl: overrides.instagramUrl,
          tiktokUrl: overrides.tiktokUrl,
          snapchatUrl: overrides.snapchatUrl,
          twitterUrl: overrides.twitterUrl,
          linkedinUrl: overrides.linkedinUrl,
          facebookUrl: overrides.facebookUrl,
          googleMapsUrl: overrides.googleMapsUrl,
        },
      });

      if (result.status === "duplicate") {
        toast.warning("العميل موجود مسبقاً في قاعدة البيانات", {
          description: `"${result.companyName}" مدرج بالفعل — لا يمكن إضافة تكرار`,
          action: result.existingId ? {
            label: "عرض العميل الموجود",
            onClick: () => window.open(`/leads/${result.existingId}`, "_blank"),
          } : undefined,
          duration: 6000,
        });
        setMergeTarget(null);
        return;
      }

      toast.success("تم الدمج والحفظ بنجاح", {
        description: `${result.companyName} — مدمج من ${result.sources.length} منصات (ثقة ${result.mergeConfidence}%)`,
      });
      onAddLead({
        companyName: result.companyName,
        city: result.city,
        phone: result.phone,
        website: result.website,
        sources: result.sources,
      });
      setMergeTarget(null);
    } catch (e: any) {
      toast.error("خطأ في الدمج", { description: e.message });
    }
  };

  // دمج الكل تلقائياً — يعالج المجموعات والمفردات غير المكررة دفعة واحدة
  const handleMergeAll = async () => {
    if (!groupedData) return;
    const newGroups = groupedData.groups.filter(g => !g.isDuplicate);
    const newSingles = groupedData.singles.filter(s => !s.isDuplicate);
    const total = newGroups.length + newSingles.length;
    if (total === 0) {
      toast.info("لا توجد نتائج جديدة للدمج", { description: "جميع النتائج موجودة مسبقاً في قاعدة البيانات" });
      return;
    }
    setIsMergingAll(true);
    setMergeAllProgress({ done: 0, total, created: 0, skipped: 0 });
    let created = 0;
    let skipped = 0;
    // دمج المجموعات أولاً
    for (const group of newGroups) {
      try {
        const result = await createFromMergeMut.mutateAsync({ candidatesJson: group._candidatesJson });
        if (result.status === "duplicate") {
          skipped++;
        } else {
          created++;
          onAddLead({ companyName: result.companyName, city: result.city, phone: result.phone, website: result.website, sources: result.sources });
        }
      } catch { skipped++; }
      setMergeAllProgress(p => p ? { ...p, done: p.done + 1, created, skipped } : null);
    }
    // ثم المفردات
    for (const single of newSingles) {
      try {
        const result = await createFromMergeMut.mutateAsync({ candidatesJson: `[${single._candidateJson}]` });
        if (result.status === "duplicate") {
          skipped++;
        } else {
          created++;
          onAddLead({ companyName: result.companyName, city: result.city, phone: result.phone, website: result.website, sources: result.sources });
        }
      } catch { skipped++; }
      setMergeAllProgress(p => p ? { ...p, done: p.done + 1, created, skipped } : null);
    }
    setIsMergingAll(false);
    toast.success(`تم دمج ${created} عميل بنجاح`, {
      description: skipped > 0 ? `تم تخطي ${skipped} مكرر` : "جميع النتائج أُضيفت بنجاح",
    });
    setTimeout(() => setMergeAllProgress(null), 3000);
  };

  if (totalResults === 0 && !isAnyLoading) {
    return null;
  }

  // إحصاءات التكرار
  const duplicateGroupsCount = groupedData?.groups.filter(g => g.isDuplicate).length || 0;
  const duplicateSinglesCount = groupedData?.singles.filter(s => s.isDuplicate).length || 0;
  const totalDuplicates = duplicateGroupsCount + duplicateSinglesCount;

  // فلترة حسب التكرار
  const displayedGroups = showDuplicatesOnly
    ? (groupedData?.groups || []).filter(g => g.isDuplicate)
    : (groupedData?.groups || []);
  const displayedSingles = showDuplicatesOnly
    ? (groupedData?.singles || []).filter(s => s.isDuplicate)
    : (groupedData?.singles || []);

  return (
    <div className="space-y-4">
      {/* ===== Platform Coverage Summary ===== */}
      <div className="rounded-xl border border-border p-3 space-y-2" style={{ background: "oklch(0.10 0.015 240)" }}>
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-primary" />
            تغطية المنصات
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {totalFound}/{PLATFORM_IDS.length} منصة — {totalResults} نتيجة
            </span>
            {!isAnyLoading && totalResults > 0 && (
              <button
                onClick={() => {
                  const rawResults: Record<string, Record<string, unknown>[]> = {};
                  for (const [platform, platformResults] of Object.entries(results)) {
                    if (platformResults.length > 0) {
                      rawResults[platform] = platformResults.map(r => ({
                        ...r,
                        url: getResultUrl(r, platform) || r.url || r.profileUrl,
                        phone: getResultPhone(r),
                      } as Record<string, unknown>));
                    }
                  }
                  setIsGrouping(true);
                  groupCandidatesMut.mutateAsync({ rawResults })
                    .then(data => checkDuplicates(data as any))
                    .catch(() => {})
                    .finally(() => setIsGrouping(false));
                }}
                className="text-[10px] text-primary hover:text-primary/80 flex items-center gap-0.5"
                title="إعادة التجميع"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {coverage.map(c => (
            <div
              key={c.id}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${
                c.isLoading
                  ? "border-primary/30 bg-primary/5 animate-pulse"
                  : c.count > 0
                    ? `${c.meta.bg} ${c.meta.border}`
                    : "bg-muted/10 border-border/30 opacity-40"
              }`}
            >
              <c.meta.icon className={`w-3.5 h-3.5 ${c.count > 0 ? c.meta.color : "text-muted-foreground"}`} />
              <span className="text-[9px] font-medium text-center leading-tight">{c.meta.label}</span>
              {c.isLoading ? (
                <span className="text-[9px] text-primary">جاري...</span>
              ) : c.count > 0 ? (
                <span className={`text-[10px] font-bold ${c.meta.color}`}>{c.count}</span>
              ) : (
                <XCircle className="w-3 h-3 text-muted-foreground/40" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ===== Identity Linkage Status ===== */}
      {(isGrouping || isCheckingDuplicates) && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20 text-xs">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
          <span className="text-muted-foreground">
            {isGrouping ? "جاري تحليل البيانات وإثراءها بالذكاء الاصطناعي..." : "جاري فحص التكرار في قاعدة البيانات..."}
          </span>
        </div>
      )}

      {/* ===== AI Enrichment Summary ===== */}
      {aiEnrichmentSummary && !isGrouping && !isCheckingDuplicates && (
        aiEnrichmentSummary.successCount > 0 || (
          aiEnrichmentSummary.fieldsExtracted.phones +
          aiEnrichmentSummary.fieldsExtracted.websites +
          aiEnrichmentSummary.fieldsExtracted.socialHandles +
          aiEnrichmentSummary.fieldsExtracted.cities
        ) > 0
      ) && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-500/5 border border-violet-500/20 text-xs">
          <Sparkles className="w-3.5 h-3.5 text-violet-400 shrink-0" />
          <span className="text-violet-300 font-medium">إثراء AI:</span>
          <div className="flex items-center gap-2 flex-wrap">
            {aiEnrichmentSummary.fieldsExtracted.phones > 0 && (
              <span className="flex items-center gap-1 text-green-400">
                <Phone className="w-3 h-3" />{aiEnrichmentSummary.fieldsExtracted.phones} هاتف
              </span>
            )}
            {aiEnrichmentSummary.fieldsExtracted.websites > 0 && (
              <span className="flex items-center gap-1 text-blue-400">
                <Globe className="w-3 h-3" />{aiEnrichmentSummary.fieldsExtracted.websites} موقع
              </span>
            )}
            {aiEnrichmentSummary.fieldsExtracted.socialHandles > 0 && (
              <span className="flex items-center gap-1 text-pink-400">
                <Link2 className="w-3 h-3" />{aiEnrichmentSummary.fieldsExtracted.socialHandles} سوشيال
              </span>
            )}
            {aiEnrichmentSummary.fieldsExtracted.cities > 0 && (
              <span className="flex items-center gap-1 text-yellow-400">
                <MapPin className="w-3 h-3" />{aiEnrichmentSummary.fieldsExtracted.cities} مدينة
              </span>
            )}
          </div>
          <span className="mr-auto text-muted-foreground/60 text-[10px]">
            {aiEnrichmentSummary.successCount}/{aiEnrichmentSummary.totalProcessed} عملية · {(aiEnrichmentSummary.processingMs / 1000).toFixed(1)}ث
          </span>
        </div>
      )}

      {/* ===== Stats Bar ===== */}
      {groupedData && !isGrouping && !isCheckingDuplicates && (
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-xs text-muted-foreground px-1 flex-wrap">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-primary" />
              <span className="text-foreground font-medium">{groupedData.stats.totalCandidates}</span> مرشح
            </span>
            <span className="text-border">→</span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-green-400" />
              <span className="text-green-400 font-medium">{groupedData.groups.length}</span> مجموعة
            </span>
            <span className="flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-yellow-400" />
              <span className="text-yellow-400 font-medium">{groupedData.singles.length}</span> مفرد
            </span>
            {totalDuplicates > 0 && (
              <>
                <span className="text-border">|</span>
                <button
                  onClick={() => setShowDuplicatesOnly(v => !v)}
                  className={`flex items-center gap-1 transition-colors ${showDuplicatesOnly ? "text-amber-400" : "text-muted-foreground hover:text-amber-400"}`}
                >
                  <Database className="w-3 h-3" />
                  <span className={`font-medium ${showDuplicatesOnly ? "text-amber-400" : ""}`}>{totalDuplicates}</span>
                  <span>موجود مسبقاً</span>
                  {showDuplicatesOnly && <span className="text-[10px] bg-amber-500/20 px-1 rounded">فلتر نشط</span>}
                </button>
              </>
            )}
            {/* زر دمج الكل تلقائياً */}
            <div className="mr-auto">
              <Button
                size="sm"
                onClick={handleMergeAll}
                disabled={isMergingAll || (groupedData.groups.filter(g => !g.isDuplicate).length + groupedData.singles.filter(s => !s.isDuplicate).length === 0)}
                className="h-7 text-xs gap-1.5 bg-primary/90 hover:bg-primary"
              >
                {isMergingAll ? (
                  <><Loader2 className="w-3 h-3 animate-spin" />دمج الكل...</>
                ) : (
                  <><Merge className="w-3 h-3" />دمج الكل تلقائياً ({groupedData.groups.filter(g => !g.isDuplicate).length + groupedData.singles.filter(s => !s.isDuplicate).length})</>
                )}
              </Button>
            </div>
          </div>
          {/* شريط تقدم دمج الكل */}
          {mergeAllProgress && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">جاري الدمج التلقائي...</span>
                <span className="text-foreground font-medium">{mergeAllProgress.done}/{mergeAllProgress.total}</span>
              </div>
              <div className="w-full bg-muted/30 rounded-full h-1.5">
                <div
                  className="bg-primary h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${(mergeAllProgress.done / mergeAllProgress.total) * 100}%` }}
                />
              </div>
              <div className="flex gap-3 text-[10px]">
                <span className="text-green-400">✔ {mergeAllProgress.created} أُضيف</span>
                {mergeAllProgress.skipped > 0 && <span className="text-amber-400">↷ {mergeAllProgress.skipped} تخطي</span>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== Pipeline Diagnostics ===== */}
      {groupedData?.diagnostics && groupedData.diagnostics.length > 0 && !isGrouping && (
        <details className="group">
          <summary className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors px-1 py-1 select-none">
            <span className="text-[10px] bg-muted/40 border border-border/50 rounded px-1.5 py-0.5 font-mono">PIPELINE</span>
            <span>جودة البيانات لكل منصة</span>
            <ChevronDown className="w-3 h-3 group-open:rotate-180 transition-transform ml-auto" />
          </summary>
          <div className="mt-2 rounded-lg border border-border/40 bg-muted/10 overflow-hidden">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-border/30 text-muted-foreground">
                  <th className="text-right px-3 py-1.5 font-medium">المنصة</th>
                  <th className="text-center px-2 py-1.5 font-medium">خام</th>
                  <th className="text-center px-2 py-1.5 font-medium">هاتف</th>
                  <th className="text-center px-2 py-1.5 font-medium">موقع</th>
                  <th className="text-center px-2 py-1.5 font-medium">@user</th>
                  <th className="text-center px-2 py-1.5 font-medium">مدينة</th>
                  <th className="text-center px-2 py-1.5 font-medium">جودة</th>
                </tr>
              </thead>
              <tbody>
                {groupedData.diagnostics.map((d, i) => (
                  <tr key={`diag-${d.platform}-${i}`} className="border-b border-border/20 last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-1.5 font-medium text-foreground">{d.platform}</td>
                    <td className="text-center px-2 py-1.5 text-muted-foreground">{d.rawCount}</td>
                    <td className="text-center px-2 py-1.5">
                      <span className={d.withPhone > 0 ? "text-green-400" : "text-muted-foreground/40"}>{d.withPhone}</span>
                    </td>
                    <td className="text-center px-2 py-1.5">
                      <span className={d.withWebsite > 0 ? "text-blue-400" : "text-muted-foreground/40"}>{d.withWebsite}</span>
                    </td>
                    <td className="text-center px-2 py-1.5">
                      <span className={d.withUsername > 0 ? "text-purple-400" : "text-muted-foreground/40"}>{d.withUsername}</span>
                    </td>
                    <td className="text-center px-2 py-1.5">
                      <span className={d.withCity > 0 ? "text-yellow-400" : "text-muted-foreground/40"}>{d.withCity}</span>
                    </td>
                    <td className="text-center px-2 py-1.5">
                      <span className={{
                        rich: "text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded text-[10px]",
                        moderate: "text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded text-[10px]",
                        sparse: "text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded text-[10px]",
                        empty: "text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded text-[10px]",
                      }[d.dataQuality]}>
                        {d.dataQuality === "rich" ? "غني" : d.dataQuality === "moderate" ? "متوسط" : d.dataQuality === "sparse" ? "ضعيف" : "فارغ"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {/* ===== Multi-platform groups ===== */}
      {groupedData && displayedGroups.length > 0 && !isGrouping && !isCheckingDuplicates && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
              تطابقات عبر منصات متعددة
            </h3>
            <Badge className="text-[10px] px-1.5 py-0 bg-green-500/20 text-green-400 border-green-500/30">
              {displayedGroups.length}
            </Badge>
            {duplicateGroupsCount > 0 && (
              <Badge className="text-[10px] px-1.5 py-0 bg-amber-500/20 text-amber-400 border-amber-500/30">
                <Database className="w-2.5 h-2.5 inline ml-0.5" />
                {duplicateGroupsCount} موجود
              </Badge>
            )}
          </div>
          {displayedGroups.map((group, i) => (
            <CandidateGroupCard
              key={i}
              group={group}
              city={city}
              onMerge={handleMerge}
              onAddSingle={handleAddSingle}
            />
          ))}
        </div>
      )}

      {/* ===== Single-platform results ===== */}
      {groupedData && displayedSingles.length > 0 && !isGrouping && !isCheckingDuplicates && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />
              نتائج منصة واحدة
            </h3>
            <Badge className="text-[10px] px-1.5 py-0 bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
              {displayedSingles.length}
            </Badge>
            {duplicateSinglesCount > 0 && (
              <Badge className="text-[10px] px-1.5 py-0 bg-amber-500/20 text-amber-400 border-amber-500/30">
                <Database className="w-2.5 h-2.5 inline ml-0.5" />
                {duplicateSinglesCount} موجود
              </Badge>
            )}
          </div>
          {displayedSingles.slice(0, 10).map((single, i) => (
            <SingleCandidateCard
              key={i}
              single={single}
              onAdd={handleAddSingle}
            />
          ))}
          {displayedSingles.length > 10 && (
            <p className="text-xs text-muted-foreground text-center py-1">
              + {displayedSingles.length - 10} نتيجة أخرى
            </p>
          )}
        </div>
      )}

      {/* ===== Merge Preview Dialog ===== */}
      {mergeTarget && (
        <MergePreviewDialog
          candidatesJson={mergeTarget._candidatesJson}
          city={city}
          onConfirm={handleMergeConfirm}
          onClose={() => setMergeTarget(null)}
        />
      )}
    </div>
  );
}
