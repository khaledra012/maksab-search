/**
 * LeadEditPanel — لوحة التعديل اليدوي الكامل لبيانات العميل
 * تشمل: البيانات الأساسية، روابط السوشيال، التصنيف، الملاحظات
 * مع دعم إعادة التحليل بعد الحفظ
 */
import { useState } from "react";
import {
  Save, X, RefreshCw, Building2, Phone, Globe, MapPin,
  Instagram, Twitter, Facebook, Linkedin, Hash, FileText,
  ChevronDown, ChevronUp, Zap
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// أيقونة تيك توك مخصصة
const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z"/>
  </svg>
);

// أيقونة سناب شات
const SnapchatIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301.165-.088.344-.104.464-.104.182 0 .359.029.509.09.45.149.734.479.734.838.015.449-.39.839-1.213 1.168-.089.029-.209.075-.344.119-.45.135-1.139.36-1.333.81-.09.224-.061.524.12.868l.015.015c.06.136 1.526 3.475 4.791 4.014.255.044.435.27.42.509 0 .075-.015.149-.045.225-.24.569-1.273.988-3.146 1.271-.059.091-.12.375-.164.57-.029.179-.074.36-.134.553-.076.271-.27.405-.555.405h-.03c-.135 0-.313-.031-.538-.074-.36-.075-.765-.135-1.273-.135-.3 0-.599.015-.913.074-.6.104-1.123.464-1.723.884-.853.599-1.826 1.288-3.294 1.288-.06 0-.119-.015-.18-.015h-.149c-1.468 0-2.427-.675-3.279-1.288-.599-.42-1.107-.779-1.707-.884-.314-.045-.629-.074-.928-.074-.54 0-.958.089-1.272.149-.211.043-.391.074-.54.074-.374 0-.523-.224-.583-.42-.061-.192-.09-.389-.135-.567-.046-.181-.105-.494-.166-.57-1.918-.222-2.95-.642-3.189-1.226-.031-.063-.052-.15-.055-.225-.015-.243.165-.465.42-.509 3.264-.54 4.73-3.879 4.791-4.02l.016-.029c.18-.345.224-.645.119-.869-.195-.434-.884-.658-1.332-.809-.121-.029-.24-.074-.346-.119-1.107-.435-1.257-.93-1.197-1.273.09-.479.674-.793 1.168-.793.146 0 .27.029.383.074.42.194.789.3 1.104.3.234 0 .384-.06.465-.105l-.046-.569c-.098-1.626-.225-3.651.307-4.837C7.392 1.077 10.739.807 11.727.807l.419-.015h.06z"/>
  </svg>
);

const STAGE_OPTIONS = [
  { value: "new", label: "جديد", color: "oklch(0.65 0.05 240)" },
  { value: "contacted", label: "تم التواصل", color: "oklch(0.65 0.15 200)" },
  { value: "interested", label: "مهتم", color: "oklch(0.65 0.18 145)" },
  { value: "price_offer", label: "عرض سعر", color: "oklch(0.65 0.18 60)" },
  { value: "meeting", label: "اجتماع", color: "oklch(0.65 0.18 280)" },
  { value: "won", label: "تم الإغلاق", color: "oklch(0.65 0.18 145)" },
  { value: "lost", label: "خسرنا", color: "oklch(0.55 0.18 25)" },
];

const PRIORITY_OPTIONS = [
  { value: "high", label: "عالية", color: "oklch(0.65 0.22 25)" },
  { value: "medium", label: "متوسطة", color: "oklch(0.65 0.18 60)" },
  { value: "low", label: "منخفضة", color: "oklch(0.65 0.05 240)" },
];

interface LeadEditPanelProps {
  lead: any;
  onClose: () => void;
  onSaved: () => void;
}

export default function LeadEditPanel({ lead, onClose, onSaved }: LeadEditPanelProps) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState({
    companyName: lead.companyName || "",
    businessType: lead.businessType || "",
    city: lead.city || "",
    district: lead.district || "",
    verifiedPhone: lead.verifiedPhone || "",
    email: (lead as any).email || "",
    website: lead.website || "",
    googleMapsUrl: lead.googleMapsUrl || "",
    instagramUrl: lead.instagramUrl || "",
    twitterUrl: lead.twitterUrl || "",
    snapchatUrl: (lead as any).snapchatUrl || "",
    tiktokUrl: (lead as any).tiktokUrl || "",
    facebookUrl: (lead as any).facebookUrl || "",
    linkedinUrl: (lead as any).linkedinUrl || "",
    crNumber: (lead as any).crNumber || "",
    notes: lead.notes || "",
    stage: (lead as any).stage || "new",
    priority: (lead as any).priority || "medium",
    nextStep: (lead as any).nextStep || "",
    nextFollowup: (lead as any).nextFollowup || undefined as number | undefined,
  });

  const [reAnalyze, setReAnalyze] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>("basic");

  const updateLead = trpc.leads.update.useMutation();
  const analyzeAllPlatforms = trpc.brightDataAnalysis.analyzeAllPlatforms.useMutation();

  const set = (key: string, value: unknown) => setForm(f => ({ ...f, [key]: value }));

  const handleSave = async () => {
    try {
      await updateLead.mutateAsync({ id: lead.id, ...form });

      if (reAnalyze) {
        toast.info("جاري إعادة التحليل...");
        await analyzeAllPlatforms.mutateAsync({ leadId: lead.id });
        toast.success("تم الحفظ وإعادة التحليل بنجاح");
      } else {
        toast.success("تم حفظ البيانات");
      }

      utils.leads.getFullDetails.invalidate({ id: lead.id });
      onSaved();
    } catch (err) {
      toast.error("حدث خطأ أثناء الحفظ");
    }
  };

  const Section = ({
    id, title, icon, children
  }: { id: string; title: string; icon: React.ReactNode; children: React.ReactNode }) => (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setExpandedSection(expandedSection === id ? null : id)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-white/3 transition-colors"
      >
        <div className="flex items-center gap-2 text-foreground">
          {icon}
          {title}
        </div>
        {expandedSection === id
          ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
          : <ChevronDown className="w-4 h-4 text-muted-foreground" />
        }
      </button>
      {expandedSection === id && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-border">
          {children}
        </div>
      )}
    </div>
  );

  const Field = ({
    label, fieldKey, placeholder, type = "text", dir = "rtl"
  }: { label: string; fieldKey: string; placeholder?: string; type?: string; dir?: string }) => (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      <input
        type={type}
        value={(form as any)[fieldKey] || ""}
        onChange={e => set(fieldKey, e.target.value)}
        placeholder={placeholder}
        dir={dir}
        className="w-full px-3 py-2 rounded-lg text-sm border border-border bg-background text-foreground focus:outline-none focus:border-primary transition-colors"
      />
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 pb-8 px-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col"
        style={{ background: "oklch(0.12 0.01 240)", maxHeight: "calc(100vh - 8rem)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-foreground">تعديل بيانات العميل</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{lead.companyName}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-3">
          {/* البيانات الأساسية */}
          <Section id="basic" title="البيانات الأساسية" icon={<Building2 className="w-4 h-4" />}>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Field label="اسم النشاط *" fieldKey="companyName" placeholder="مثال: مطعم الأصيل" />
              </div>
              <Field label="نوع النشاط *" fieldKey="businessType" placeholder="مثال: مطعم، صالون" />
              <Field label="المدينة *" fieldKey="city" placeholder="مثال: الرياض" />
              <Field label="الحي / المنطقة" fieldKey="district" placeholder="مثال: العليا" />
              <Field label="رقم السجل التجاري" fieldKey="crNumber" placeholder="1010..." dir="ltr" />
            </div>
          </Section>

          {/* بيانات التواصل */}
          <Section id="contact" title="بيانات التواصل" icon={<Phone className="w-4 h-4" />}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="رقم الهاتف" fieldKey="verifiedPhone" placeholder="+966..." dir="ltr" />
              <Field label="البريد الإلكتروني" fieldKey="email" placeholder="example@domain.com" dir="ltr" type="email" />
              <Field label="الموقع الإلكتروني" fieldKey="website" placeholder="https://..." dir="ltr" />
              <div className="col-span-2">
                <Field label="رابط Google Maps" fieldKey="googleMapsUrl" placeholder="https://maps.google.com/..." dir="ltr" />
              </div>
            </div>
          </Section>

          {/* روابط السوشيال ميديا */}
          <Section id="social" title="روابط السوشيال ميديا" icon={<Globe className="w-4 h-4" />}>
            <div className="space-y-2">
              {[
                { key: "instagramUrl", label: "إنستغرام", icon: <Instagram className="w-3.5 h-3.5" />, placeholder: "https://instagram.com/..." },
                { key: "tiktokUrl", label: "تيك توك", icon: <TikTokIcon />, placeholder: "https://tiktok.com/@..." },
                { key: "snapchatUrl", label: "سناب شات", icon: <SnapchatIcon />, placeholder: "https://snapchat.com/add/..." },
                { key: "twitterUrl", label: "تويتر / X", icon: <Twitter className="w-3.5 h-3.5" />, placeholder: "https://x.com/..." },
                { key: "facebookUrl", label: "فيسبوك", icon: <Facebook className="w-3.5 h-3.5" />, placeholder: "https://facebook.com/..." },
                { key: "linkedinUrl", label: "لينكد إن", icon: <Linkedin className="w-3.5 h-3.5" />, placeholder: "https://linkedin.com/company/..." },
              ].map(({ key, label, icon, placeholder }) => (
                <div key={key} className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "oklch(0.18 0.02 240)", color: "oklch(0.65 0.05 240)" }}>
                    {icon}
                  </div>
                  <div className="flex-1">
                    <input
                      value={(form as any)[key] || ""}
                      onChange={e => set(key, e.target.value)}
                      placeholder={placeholder}
                      dir="ltr"
                      className="w-full px-3 py-1.5 rounded-lg text-xs border border-border bg-background text-foreground focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  {(form as any)[key] && (
                    <button
                      onClick={() => set(key, "")}
                      className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </Section>

          {/* التصنيف والمتابعة */}
          <Section id="crm" title="التصنيف والمتابعة" icon={<MapPin className="w-4 h-4" />}>
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">مرحلة العميل</label>
              <div className="flex flex-wrap gap-1.5">
                {STAGE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => set("stage", opt.value)}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all border"
                    style={{
                      background: form.stage === opt.value ? `color-mix(in oklch, ${opt.color} 15%, transparent)` : "transparent",
                      borderColor: form.stage === opt.value ? opt.color : "var(--border)",
                      color: form.stage === opt.value ? opt.color : "var(--muted-foreground)",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">الأولوية</label>
                <div className="flex gap-1.5">
                  {PRIORITY_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => set("priority", opt.value)}
                      className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all border"
                      style={{
                        background: form.priority === opt.value ? `color-mix(in oklch, ${opt.color} 15%, transparent)` : "transparent",
                        borderColor: form.priority === opt.value ? opt.color : "var(--border)",
                        color: form.priority === opt.value ? opt.color : "var(--muted-foreground)",
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">موعد المتابعة</label>
                <input
                  type="datetime-local"
                  value={form.nextFollowup ? new Date(form.nextFollowup).toISOString().slice(0, 16) : ""}
                  onChange={e => set("nextFollowup", e.target.value ? new Date(e.target.value).getTime() : undefined)}
                  className="w-full px-3 py-1.5 rounded-lg text-xs border border-border bg-background text-foreground focus:outline-none"
                  dir="ltr"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">الخطوة التالية</label>
              <input
                value={form.nextStep}
                onChange={e => set("nextStep", e.target.value)}
                placeholder="مثال: إرسال عرض سعر"
                className="w-full px-3 py-2 rounded-lg text-sm border border-border bg-background text-foreground focus:outline-none"
              />
            </div>
          </Section>

          {/* الملاحظات */}
          <Section id="notes" title="الملاحظات" icon={<FileText className="w-4 h-4" />}>
            <textarea
              value={form.notes}
              onChange={e => set("notes", e.target.value)}
              placeholder="أضف ملاحظاتك هنا..."
              rows={4}
              className="w-full px-3 py-2 rounded-lg text-sm border border-border bg-background text-foreground focus:outline-none resize-none"
            />
          </Section>

          {/* خيار إعادة التحليل */}
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all"
            style={{
              borderColor: reAnalyze ? "oklch(0.65 0.18 200)" : "var(--border)",
              background: reAnalyze ? "color-mix(in oklch, oklch(0.65 0.18 200) 8%, transparent)" : "transparent",
            }}
            onClick={() => setReAnalyze(!reAnalyze)}
          >
            <div
              className="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all"
              style={{
                borderColor: reAnalyze ? "oklch(0.65 0.18 200)" : "var(--border)",
                background: reAnalyze ? "oklch(0.65 0.18 200)" : "transparent",
              }}
            >
              {reAnalyze && <div className="w-2 h-2 rounded-sm bg-white" />}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" style={{ color: "oklch(0.85 0.18 75)" }} />
                إعادة التحليل بعد الحفظ
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                سيُعاد تحليل العميل تلقائياً بالبيانات المحدّثة
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-border flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm border border-border text-muted-foreground hover:bg-white/5 transition-colors"
          >
            إلغاء
          </button>
          <button
            onClick={handleSave}
            disabled={updateLead.isPending || analyzeAllPlatforms.isPending}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
            style={{ background: "oklch(0.65 0.18 200)" }}
          >
            {updateLead.isPending || analyzeAllPlatforms.isPending ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {reAnalyze ? "حفظ وإعادة التحليل" : "حفظ التعديلات"}
          </button>
        </div>
      </div>
    </div>
  );
}
