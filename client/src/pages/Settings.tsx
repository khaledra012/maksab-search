import React, { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Bot, Database, MessageSquare, User, Bell, Shield,
  ChevronRight, Settings2, Zap, Key, Globe, FileText,
  Users, Smartphone, Brain, RefreshCw, CheckCircle2,
  AlertCircle, Info, ExternalLink, Download, Upload,
  BarChart2, Activity, Layers, Tag, Building2, MapPin,
  Link, Table, Sheet, Cpu, Save, TestTube2, Lock,
  Mail, Phone, Star, TrendingUp, Target, Palette, Send, UserPlus, UserCheck,
  Trash2, Copy, Clock, XCircle, CheckCircle, Instagram, Camera, Heart,
  AtSign, Hash, Image, Video, MessageCircle, ThumbsUp, Eye,
} from "lucide-react";

// ===== أنواع التبويبات =====
type SettingsTab = 
  | "general"
  | "ai"
  | "users-management"
  | "data"
  | "google-sheets"
  | "notifications"
  | "security"
  | "account"
  | "report-style"
  | "whatchimp";

interface TabConfig {
  id: SettingsTab;
  label: string;
  icon: React.ElementType;
  description: string;
  badge?: string;
}

const TABS: TabConfig[] = [
  { id: "general", label: "عام", icon: Settings2, description: "الإعدادات العامة للنظام" },
  { id: "ai", label: "الذكاء الاصطناعي", icon: Brain, description: "إعدادات AI والرد التلقائي", badge: "مهم" },
  { id: "users-management", label: "إدارة المستخدمين", icon: Users, description: "الموظفون والصلاحيات" },
  { id: "data", label: "البيانات", icon: Database, description: "أنواع الأعمال والمدن والتصنيفات" },
  { id: "google-sheets", label: "Google Sheets", icon: Sheet, description: "ربط جداول البيانات", badge: "جديد" },
  { id: "notifications", label: "الإشعارات", icon: Bell, description: "إعدادات التنبيهات" },
  { id: "security", label: "الأمان", icon: Shield, description: "الصلاحيات والمستخدمين" },
  { id: "account", label: "الحساب", icon: User, description: "معلومات حسابك الشخصي" },
  { id: "report-style", label: "أسلوب التقارير", icon: FileText, description: "تهيئة طريقة كتابة التقارير والفرص", badge: "جديد" },
  { id: "whatchimp", label: "Whatchimp", icon: MessageSquare, description: "ربط Whatchimp للإرسال عبر واتساب", badge: "جديد" },
];

// ===== مكون بطاقة الإعداد =====
function SettingCard({ 
  title, 
  description, 
  icon: Icon, 
  children,
  badge,
}: { 
  title: string; 
  description?: string; 
  icon?: React.ElementType; 
  children: React.ReactNode;
  badge?: string;
}) {
  return (
    <Card className="border border-border/50 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon className="w-5 h-5 text-primary" />
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">{title}</CardTitle>
              {badge && <Badge variant="secondary" className="text-xs">{badge}</Badge>}
            </div>
            {description && <CardDescription className="text-xs mt-0.5">{description}</CardDescription>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

// ===== تبويب عام =====
function GeneralTab() {
  const { data: companyData, refetch } = trpc.companySettings.get.useQuery();
  const [companyName, setCompanyName] = React.useState("");
  const [companyDescription, setCompanyDescription] = React.useState("");
  const [city, setCity] = React.useState("");
  const [region, setRegion] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [website, setWebsite] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [licenseNumber, setLicenseNumber] = React.useState("");
  const [commercialRegistration, setCommercialRegistration] = React.useState("");
  const [analystName, setAnalystName] = React.useState("");
  const [analystTitle, setAnalystTitle] = React.useState("");
  const [logoUrl, setLogoUrl] = React.useState("");
  const [primaryColor, setPrimaryColor] = React.useState("#1a56db");
  const [secondaryColor, setSecondaryColor] = React.useState("#0e9f6e");
  const [reportHeaderText, setReportHeaderText] = React.useState("");
  const [reportFooterText, setReportFooterText] = React.useState("");
  const [reportIntroText, setReportIntroText] = React.useState("");
  const [instagramUrl, setInstagramUrl] = React.useState("");
  const [twitterUrl, setTwitterUrl] = React.useState("");
  const [linkedinUrl, setLinkedinUrl] = React.useState("");
  const [isUploadingLogo, setIsUploadingLogo] = React.useState(false);
  const [isSavingCompany, setIsSavingCompany] = React.useState(false);
  const logoInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (companyData) {
      setCompanyName(companyData.companyName || "مكسب KSA");
      setCompanyDescription(companyData.companyDescription || "");
      setCity(companyData.city || "الرياض");
      setRegion(companyData.region || "المنطقة الوسطى");
      setPhone(companyData.phone || "");
      setEmail(companyData.email || "");
      setWebsite(companyData.website || "");
      setAddress(companyData.address || "");
      setLicenseNumber(companyData.licenseNumber || "");
      setCommercialRegistration((companyData as any).commercialRegistration || "");
      setAnalystName((companyData as any).analystName || "");
      setAnalystTitle((companyData as any).analystTitle || "");
      setLogoUrl(companyData.logoUrl || "");
      setPrimaryColor(companyData.primaryColor || "#1a56db");
      setSecondaryColor(companyData.secondaryColor || "#0e9f6e");
      setReportHeaderText(companyData.reportHeaderText || "");
      setReportFooterText(companyData.reportFooterText || "");
      setReportIntroText(companyData.reportIntroText || "");
      setInstagramUrl(companyData.instagramUrl || "");
      setTwitterUrl(companyData.twitterUrl || "");
      setLinkedinUrl(companyData.linkedinUrl || "");
    }
  }, [companyData]);

  const uploadLogo = trpc.companySettings.uploadLogo.useMutation({
    onSuccess: (data) => {
      setLogoUrl(data.url);
      toast.success("تم رفع الشعار بنجاح ✅");
      refetch();
    },
    onError: (e) => toast.error("فشل رفع الشعار: " + e.message),
  });

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("حجم الشعار يجب أن يكون أقل من 2MB"); return; }
    setIsUploadingLogo(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      await uploadLogo.mutateAsync({ base64, mimeType: file.type });
      setIsUploadingLogo(false);
    };
    reader.readAsDataURL(file);
  };

  const saveCompany = trpc.companySettings.save.useMutation({
    onSuccess: () => { toast.success("تم حفظ معلومات الشركة بنجاح ✅"); refetch(); },
    onError: (e) => toast.error("فشل الحفظ: " + e.message),
  });

  const handleSaveCompany = async () => {
    if (!companyName.trim()) { toast.error("اسم الشركة مطلوب"); return; }
    setIsSavingCompany(true);
    await saveCompany.mutateAsync({
      companyName: companyName.trim(),
      companyDescription: companyDescription.trim() || undefined,
      city: city.trim() || undefined,
      region: region.trim() || undefined,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      website: website.trim() || undefined,
      address: address.trim() || undefined,
      licenseNumber: licenseNumber.trim() || undefined,
      commercialRegistration: commercialRegistration.trim() || undefined,
      analystName: analystName.trim() || undefined,
      analystTitle: analystTitle.trim() || undefined,
      logoUrl: logoUrl || undefined,
      primaryColor: primaryColor || undefined,
      secondaryColor: secondaryColor || undefined,
      reportHeaderText: reportHeaderText.trim() || undefined,
      reportFooterText: reportFooterText.trim() || undefined,
      reportIntroText: reportIntroText.trim() || undefined,
      instagramUrl: instagramUrl.trim() || undefined,
      twitterUrl: twitterUrl.trim() || undefined,
      linkedinUrl: linkedinUrl.trim() || undefined,
    });
    setIsSavingCompany(false);
  };

  return (
    <div className="space-y-4">
      {/* بطاقة الشعار والهوية */}
      <SettingCard title="شعار الشركة" description="الشعار الذي يظهر في التقارير والواجهة" icon={Image}>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/30 overflow-hidden shrink-0">
            {logoUrl ? (
              <img src={logoUrl} alt="شعار" className="w-full h-full object-contain" />
            ) : (
              <Building2 className="w-8 h-8 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 space-y-2">
            <p className="text-sm font-medium">صورة الشعار</p>
            <p className="text-xs text-muted-foreground">PNG, JPG, SVG - حجم أقصى 2MB</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => logoInputRef.current?.click()} disabled={isUploadingLogo}>
                {isUploadingLogo ? <><span className="animate-spin ml-1">⏳</span> جاري الرفع...</> : <><Upload className="w-3.5 h-3.5 ml-1.5" />رفع شعار</>}
              </Button>
              {logoUrl && (
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setLogoUrl("")}>
                  حذف
                </Button>
              )}
            </div>
            <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
          </div>
        </div>
      </SettingCard>

      {/* معلومات الشركة الأساسية */}
      <SettingCard title="معلومات الشركة" description="البيانات الأساسية التي تظهر في التقارير" icon={Building2}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-sm font-medium mb-1 block">اسم الشركة *</label>
              <Input placeholder="مثال: مكسب KSA" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium mb-1 block">وصف النشاط التجاري</label>
              <Textarea placeholder="وصف مختصر للنشاط التجاري..." rows={2} value={companyDescription} onChange={(e) => setCompanyDescription(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">رقم الجوال</label>
              <Input placeholder="+966 5x xxx xxxx" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">البريد الإلكتروني</label>
              <Input placeholder="info@company.com" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">الموقع الإلكتروني</label>
              <Input placeholder="https://company.com" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">رقم السجل التجاري <span className="text-xs text-muted-foreground">(يظهر كـ QR في التقرير)</span></label>
              <Input placeholder="1010xxxxxx" value={commercialRegistration} onChange={(e) => setCommercialRegistration(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">رقم الترخيص</label>
              <Input placeholder="1010xxxxxx" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">اسم المحلل <span className="text-xs text-muted-foreground">(يظهر كتوقيع في التقرير)</span></label>
              <Input placeholder="محمد العمري" value={analystName} onChange={(e) => setAnalystName(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">لقب المحلل <span className="text-xs text-muted-foreground">(يظهر تحت التوقيع)</span></label>
              <Input placeholder="محلل تسويق رقمي" value={analystTitle} onChange={(e) => setAnalystTitle(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">المدينة</label>
              <Input placeholder="الرياض" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">المنطقة</label>
              <Input placeholder="المنطقة الوسطى" value={region} onChange={(e) => setRegion(e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium mb-1 block">العنوان الكامل</label>
              <Input placeholder="الرياض, حي الملقا, شارع الأمير..." value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
          </div>
        </div>
      </SettingCard>

      {/* حسابات السوشيال ميديا */}
      <SettingCard title="حسابات السوشيال ميديا" description="روابط حسابات الشركة على منصات التواصل" icon={Link}>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1 flex items-center gap-1.5"><Instagram className="w-4 h-4 text-pink-500" />إنستجرام</label>
            <Input placeholder="https://instagram.com/yourcompany" value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 flex items-center gap-1.5"><AtSign className="w-4 h-4 text-sky-500" />تويتر / X</label>
            <Input placeholder="https://x.com/yourcompany" value={twitterUrl} onChange={(e) => setTwitterUrl(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 flex items-center gap-1.5"><Link className="w-4 h-4 text-blue-600" />لينكد إن</label>
            <Input placeholder="https://linkedin.com/company/yourcompany" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} />
          </div>
        </div>
      </SettingCard>

      {/* تخصيص التقارير */}
      <SettingCard title="تخصيص التقارير" description="النصوص والألوان التي تظهر في تقارير PDF" icon={FileText}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">اللون الرئيسي</label>
              <div className="flex items-center gap-2">
                <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-10 h-9 rounded border border-border cursor-pointer" />
                <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="font-mono text-sm" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">اللون الثانوي</label>
              <div className="flex items-center gap-2">
                <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="w-10 h-9 rounded border border-border cursor-pointer" />
                <Input value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="font-mono text-sm" />
              </div>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">نص رأس التقرير</label>
            <Input placeholder="مثال: تقرير تحليل العميل - سري" value={reportHeaderText} onChange={(e) => setReportHeaderText(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">مقدمة التقرير</label>
            <Textarea placeholder="نص يظهر في بداية كل تقرير..." rows={2} value={reportIntroText} onChange={(e) => setReportIntroText(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">نص تذييل التقرير</label>
            <Input placeholder="مثال: جميع الحقوق محفوظة لشركة مكسب 2025" value={reportFooterText} onChange={(e) => setReportFooterText(e.target.value)} />
          </div>
        </div>
      </SettingCard>

      {/* زر الحفظ الشامل */}
      <Button className="w-full" size="lg" onClick={handleSaveCompany} disabled={isSavingCompany || saveCompany.isPending}>
        {isSavingCompany || saveCompany.isPending ? (
          <><span className="animate-spin ml-2">⏳</span> جاري الحفظ...</>
        ) : (
          <><Save className="w-4 h-4 ml-2" />حفظ جميع بيانات الشركة</>
        )}
      </Button>

      <SettingCard title="إعدادات اللغة والمنطقة الزمنية" icon={Globe}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">اللغة الافتراضية</p>
              <p className="text-xs text-muted-foreground">العربية (السعودية)</p>
            </div>
            <Badge>ar-SA</Badge>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">المنطقة الزمنية</p>
              <p className="text-xs text-muted-foreground">Asia/Riyadh (UTC+3)</p>
            </div>
            <Badge variant="outline">+3</Badge>
          </div>
        </div>
      </SettingCard>

      <SettingCard title="إعدادات الواجهة" icon={Palette}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">الوضع الداكن</p>
              <p className="text-xs text-muted-foreground">تغيير مظهر الواجهة</p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">الإشعارات الصوتية</p>
              <p className="text-xs text-muted-foreground">تشغيل صوت عند وصول رسالة جديدة</p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">تحديث تلقائي للبيانات</p>
              <p className="text-xs text-muted-foreground">تحديث لوحة التحكم كل دقيقة</p>
            </div>
            <Switch defaultChecked />
          </div>
        </div>
      </SettingCard>
    </div>
  );
}

// ===== تبويب الذكاء الاصطناعي =====
function AITab() {
  const [, navigate] = useLocation();
  
  return (
    <div className="space-y-4">
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-primary mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium">إعدادات الذكاء الاصطناعي التفصيلية</p>
          <p className="text-xs text-muted-foreground mt-1">
            يمكنك الوصول للإعدادات التفصيلية من صفحة إعدادات الذكاء المتقدمة
          </p>
          <Button size="sm" variant="outline" className="mt-2" onClick={() => navigate("/ai-settings")}>
            <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
            فتح الإعدادات المتقدمة
          </Button>
        </div>
      </div>

      <SettingCard title="مزود الذكاء الاصطناعي" icon={Cpu} badge="نشط">
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg border border-green-500/20">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium">Gemini المباشر من السيرفر</span>
            </div>
            <Badge className="bg-green-500/20 text-green-600 border-green-500/30">نشط</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            يستخدم النظام حالياً Gemini مباشرة من السيرفر. يمكنك تغييره إلى OpenAI من الإعدادات المتقدمة.
          </p>
        </div>
      </SettingCard>

      <SettingCard title="الرد التلقائي الذكي" icon={Bot}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">تفعيل الرد التلقائي</p>
              <p className="text-xs text-muted-foreground">الرد على الرسائل الواردة تلقائياً</p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">تحليل نية العميل</p>
              <p className="text-xs text-muted-foreground">تحديد اهتمام العميل تلقائياً</p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">الرد بالصوت</p>
              <p className="text-xs text-muted-foreground">تحويل الردود النصية لرسائل صوتية</p>
            </div>
            <Switch />
          </div>
        </div>
      </SettingCard>

      <SettingCard title="قاعدة المعرفة (RAG)" icon={Brain} badge="جديد">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            دّرب الذكاء الاصطناعي على بيانات شركتك لردود أكثر دقة وتخصيصاً
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Button size="sm" variant="outline" onClick={() => navigate("/knowledge-base")}>
              <FileText className="w-4 h-4 ml-1.5" />
              إدارة المستندات
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/settings?tab=google-sheets")}>
              <Sheet className="w-4 h-4 ml-1.5" />
              ربط Google Sheets
            </Button>
          </div>
        </div>
      </SettingCard>

      <SettingCard title="كلمات الاهتمام" icon={Key}>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            الكلمات التي تُفعّل الرد التلقائي عند ذكرها في المحادثة
          </p>
          <Button size="sm" variant="outline" className="w-full" onClick={() => navigate("/interest-keywords")}>
            <Key className="w-4 h-4 ml-1.5" />
            إدارة كلمات الاهتمام
          </Button>
        </div>
      </SettingCard>
    </div>
  );
}

// ===== تبويب البيانات =====
function DataTab() {
  const [, navigate] = useLocation();
  
  return (
    <div className="space-y-4">
      <SettingCard title="تصنيفات البيانات" icon={Layers} description="إدارة أنواع الأعمال والمدن والمناطق">
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "أنواع الأعمال", icon: Building2, path: "/data-settings" },
            { label: "المدن والمناطق", icon: MapPin, path: "/data-settings" },
            { label: "المصادر", icon: Globe, path: "/data-settings" },
            { label: "التصنيفات", icon: Tag, path: "/data-settings" },
          ].map((item) => (
            <Button
              key={item.label}
              variant="outline"
              size="sm"
              className="h-auto py-3 flex-col gap-1.5"
              onClick={() => navigate(item.path)}
            >
              <item.icon className="w-5 h-5 text-primary" />
              <span className="text-xs">{item.label}</span>
            </Button>
          ))}
        </div>
        <Button size="sm" variant="outline" className="w-full mt-3" onClick={() => navigate("/data-settings")}>
          <Settings2 className="w-4 h-4 ml-1.5" />
          إدارة جميع التصنيفات
        </Button>
      </SettingCard>

      <SettingCard title="المناطق الجغرافية" icon={MapPin}>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">إدارة المناطق والأحياء المستخدمة في تصنيف العملاء</p>
          <Button size="sm" variant="outline" className="w-full" onClick={() => navigate("/zones")}>
            <MapPin className="w-4 h-4 ml-1.5" />
            إدارة المناطق
          </Button>
        </div>
      </SettingCard>

      <SettingCard title="استيراد وتصدير البيانات" icon={Download}>
        <div className="grid grid-cols-2 gap-3">
          <Button size="sm" variant="outline" onClick={() => navigate("/bulk-import")}>
            <Upload className="w-4 h-4 ml-1.5" />
            استيراد CSV
          </Button>
          <Button size="sm" variant="outline">
            <Download className="w-4 h-4 ml-1.5" />
            تصدير البيانات
          </Button>
        </div>
      </SettingCard>

      <SettingCard title="شرائح العملاء" icon={Layers}>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">تقسيم العملاء إلى مجموعات للاستهداف الدقيق</p>
          <Button size="sm" variant="outline" className="w-full" onClick={() => navigate("/segments")}>
            <Layers className="w-4 h-4 ml-1.5" />
            إدارة الشرائح
          </Button>
        </div>
      </SettingCard>
    </div>
  );
}

// ===== تبويب Google Sheets =====
function GoogleSheetsTab() {
  const [sheetUrl, setSheetUrl] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectedSheets, setConnectedSheets] = useState<Array<{
    id: string; name: string; type: string; lastSync: string; rows: number;
  }>>([
    // بيانات تجريبية
  ]);

  const handleConnect = async () => {
    if (!sheetUrl.trim()) {
      toast.error("أدخل رابط Google Sheet أولاً");
      return;
    }
    if (!sheetUrl.includes("docs.google.com/spreadsheets")) {
      toast.error("الرابط غير صحيح. يجب أن يكون رابط Google Sheets");
      return;
    }
    setIsConnecting(true);
    await new Promise(r => setTimeout(r, 1500));
    setIsConnecting(false);
    toast.success("تم ربط الجدول بنجاح! سيتم مزامنة البيانات خلال دقائق");
    setSheetUrl("");
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4 flex items-start gap-3">
        <Sheet className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-blue-600">ربط Google Sheets</p>
          <p className="text-xs text-muted-foreground mt-1">
            اربط جداول Google Sheets لاستيراد بيانات العملاء والمنتجات وتدريب الذكاء الاصطناعي تلقائياً
          </p>
        </div>
      </div>

      <SettingCard title="ربط جدول جديد" icon={Link}>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1 block">رابط Google Sheet</label>
            <Input
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              dir="ltr"
            />
            <p className="text-xs text-muted-foreground mt-1">
              تأكد من أن الجدول مشارك للعموم أو مشارك مع حسابك
            </p>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">نوع البيانات</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "leads", label: "عملاء", icon: Users },
                { id: "products", label: "منتجات", icon: Tag },
                { id: "knowledge", label: "معرفة AI", icon: Brain },
              ].map((type) => (
                <button
                  key={type.id}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors text-sm"
                >
                  <type.icon className="w-4 h-4" />
                  {type.label}
                </button>
              ))}
            </div>
          </div>
          <Button
            className="w-full"
            onClick={handleConnect}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <><RefreshCw className="w-4 h-4 ml-2 animate-spin" />جاري الربط...</>
            ) : (
              <><Link className="w-4 h-4 ml-2" />ربط الجدول</>
            )}
          </Button>
        </div>
      </SettingCard>

      <SettingCard title="الجداول المربوطة" icon={Table}>
        {connectedSheets.length > 0 ? (
          <div className="space-y-3">
            {connectedSheets.map((sheet) => (
              <div key={sheet.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <Sheet className="w-4 h-4 text-green-500" />
                  <div>
                    <p className="text-sm font-medium">{sheet.name}</p>
                    <p className="text-xs text-muted-foreground">{sheet.rows} صف • آخر مزامنة: {sheet.lastSync}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="ghost" className="h-7 w-7">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <Sheet className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">لا توجد جداول مربوطة بعد</p>
            <p className="text-xs mt-1">أضف رابط Google Sheet أعلاه للبدء</p>
          </div>
        )}
      </SettingCard>

      <SettingCard title="كيفية الربط" icon={Info}>
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center shrink-0 mt-0.5">1</span>
            <p>افتح جدول Google Sheets وانقر على "مشاركة"</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center shrink-0 mt-0.5">2</span>
            <p>اختر "أي شخص لديه الرابط" أو أضف البريد الإلكتروني</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center shrink-0 mt-0.5">3</span>
            <p>انسخ الرابط والصقه في الحقل أعلاه</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center shrink-0 mt-0.5">4</span>
            <p>اختر نوع البيانات واضغط "ربط الجدول"</p>
          </div>
        </div>
      </SettingCard>
    </div>
  );
}

// ===== تبويب الإشعارات =====
function NotificationsTab() {
  return (
    <div className="space-y-4">
      <SettingCard title="إشعارات واتساب" icon={MessageSquare}>
        <div className="space-y-3">
          {[
            { label: "رسائل جديدة", desc: "إشعار عند وصول رسالة جديدة", checked: true },
            { label: "عميل جديد", desc: "إشعار عند إضافة عميل جديد", checked: true },
            { label: "فشل الإرسال", desc: "إشعار عند فشل إرسال رسالة", checked: true },
            { label: "انقطاع الاتصال", desc: "إشعار عند انقطاع اتصال واتساب", checked: true },
          ].map((item, i) => (
            <div key={i}>
              {i > 0 && <Separator className="my-2" />}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <Switch defaultChecked={item.checked} />
              </div>
            </div>
          ))}
        </div>
      </SettingCard>

      <SettingCard title="إشعارات النظام" icon={Bell}>
        <div className="space-y-3">
          {[
            { label: "تذكيرات المتابعة", desc: "تنبيه عند وجود عملاء لم يُتابَعوا", checked: true },
            { label: "التقرير الأسبوعي", desc: "إرسال تقرير أسبوعي تلقائي", checked: false },
            { label: "تحديثات النظام", desc: "إشعار عند توفر تحديثات جديدة", checked: true },
          ].map((item, i) => (
            <div key={i}>
              {i > 0 && <Separator className="my-2" />}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <Switch defaultChecked={item.checked} />
              </div>
            </div>
          ))}
        </div>
      </SettingCard>
    </div>
  );
}

// ===== تبويب إنستجرام =====
function UsersManagementTab() {
  const [, navigate] = useLocation();
  // إدارة المستخدمين - بيانات الأدوار ثابتة

  return (
    <div className="space-y-4">
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4 flex items-start gap-3">
        <Users className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium">إدارة الموظفين والصلاحيات</p>
          <p className="text-xs text-muted-foreground mt-1">
            أضف موظفين جدد وحدد صلاحياتهم وتابع أداءهم
          </p>
          <Button size="sm" variant="outline" className="mt-2 border-blue-500/30 text-blue-600" onClick={() => navigate("/users")}>
            <Users className="w-3.5 h-3.5 ml-1.5" />
            فتح إدارة المستخدمين الكاملة
          </Button>
        </div>
      </div>

      <SettingCard title="الأدوار والصلاحيات" icon={Shield}>
        <div className="space-y-3">
          {[
            { role: "مدير", desc: "صلاحيات كاملة على جميع الميزات", color: "bg-red-500/20 text-red-600", count: 1 },
            { role: "موظف مبيعات", desc: "الوصول للعملاء والمحادثات والبحث", color: "bg-blue-500/20 text-blue-600", count: 3 },
            { role: "موظف دعم", desc: "الوصول للمحادثات فقط", color: "bg-green-500/20 text-green-600", count: 2 },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30">
              <div>
                <p className="text-sm font-medium">{item.role}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={item.color}>{item.count} مستخدم</Badge>
              </div>
            </div>
          ))}
        </div>
      </SettingCard>

      <SettingCard title="إضافة موظف جديد" icon={UserPlus}>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">دعوة موظف جديد عبر رابط الدعوة</p>
          <Button size="sm" className="w-full" onClick={() => navigate("/users")}>
            <UserPlus className="w-4 h-4 ml-1.5" />
            إرسال دعوة جديدة
          </Button>
        </div>
      </SettingCard>

      <SettingCard title="أداء الموظفين" icon={UserCheck}>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">متابعة إحصائيات كل موظف وعدد المحادثات والعملاء</p>
          <Button size="sm" variant="outline" className="w-full" onClick={() => navigate("/employee-performance")}>
            <UserCheck className="w-4 h-4 ml-1.5" />
            تقرير الأداء
          </Button>
        </div>
      </SettingCard>
    </div>
  );
}

// ===== تبويب الأمان =====
function SecurityTab() {
  const [, navigate] = useLocation();
  
  return (
    <div className="space-y-4">
      <SettingCard title="إدارة المستخدمين" icon={Users}>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">إضافة وإدارة صلاحيات الموظفين والمستخدمين</p>
          <Button size="sm" variant="outline" className="w-full" onClick={() => navigate("/users")}>
            <Users className="w-4 h-4 ml-1.5" />
            إدارة المستخدمين
          </Button>
        </div>
      </SettingCard>

      <SettingCard title="الصلاحيات والأدوار" icon={Shield}>
        <div className="space-y-3">
          {[
            { role: "مدير", desc: "صلاحيات كاملة على جميع الميزات", color: "bg-red-500/20 text-red-600" },
            { role: "موظف مبيعات", desc: "الوصول للعملاء والمحادثات", color: "bg-blue-500/20 text-blue-600" },
            { role: "موظف دعم", desc: "الوصول للمحادثات فقط", color: "bg-green-500/20 text-green-600" },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
              <div>
                <p className="text-sm font-medium">{item.role}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <Badge className={item.color}>{item.role}</Badge>
            </div>
          ))}
        </div>
      </SettingCard>

      <SettingCard title="سجل النشاط" icon={Activity}>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">مراجعة جميع العمليات التي تمت في النظام</p>
          <Button size="sm" variant="outline" className="w-full">
            <Activity className="w-4 h-4 ml-1.5" />
            عرض سجل النشاط
          </Button>
        </div>
      </SettingCard>
    </div>
  );
}

// ===== تبويب الحساب =====
function AccountTab() {
  const { data: me } = trpc.auth.me.useQuery();
  
  return (
    <div className="space-y-4">
      <SettingCard title="معلومات الحساب" icon={User}>
        <div className="space-y-3">
          <div className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-xl font-bold text-primary">
              {me?.name?.charAt(0) ?? "م"}
            </div>
            <div>
              <p className="font-medium">{me?.name ?? "المستخدم"}</p>
              <p className="text-sm text-muted-foreground">{me?.email ?? ""}</p>
              <Badge className="mt-1 text-xs" variant="secondary">
                {me?.role === "admin" ? "مدير" : "موظف"}
              </Badge>
            </div>
          </div>
          <div className="space-y-2">
            <div>
              <label className="text-sm font-medium mb-1 block">الاسم</label>
              <Input defaultValue={me?.name ?? ""} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">البريد الإلكتروني</label>
              <Input defaultValue={me?.email ?? ""} dir="ltr" />
            </div>
          </div>
          <Button size="sm" className="w-full">
            <Save className="w-4 h-4 ml-2" />
            حفظ التغييرات
          </Button>
        </div>
      </SettingCard>

      <SettingCard title="إحصائيات الحساب" icon={BarChart2}>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "تاريخ الانضمام", value: me?.createdAt ? new Date(me.createdAt).toLocaleDateString('ar-SA') : "-" },
            { label: "آخر دخول", value: me?.lastSignedIn ? new Date(me.lastSignedIn).toLocaleDateString('ar-SA') : "-" },
            { label: "الدور", value: me?.role === "admin" ? "مدير" : "موظف" },
            { label: "طريقة الدخول", value: me?.loginMethod ?? "-" },
          ].map((stat, i) => (
            <div key={i} className="p-3 bg-muted/30 rounded-lg">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="text-sm font-medium mt-0.5">{stat.value}</p>
            </div>
          ))}
        </div>
      </SettingCard>
    </div>
  );
}

// ===== تبويب أسلوب الكتابة =====
function ReportStyleTab() {
  const { data, refetch } = trpc.reportStyle.get.useQuery();
  const saveMutation = trpc.reportStyle.save.useMutation({
    onSuccess: () => { toast.success("تم حفظ إعدادات أسلوب التقارير"); refetch(); },
    onError: (e) => toast.error("فشل الحفظ", { description: e.message }),
  });

  const [tone, setTone] = React.useState("professional");
  const [brandKeywords, setBrandKeywords] = React.useState("");
  const [customInstructions, setCustomInstructions] = React.useState("");
  const [opportunityCommentStyle, setOpportunityCommentStyle] = React.useState("");
  const [closingStatement, setClosingStatement] = React.useState("");
  const [mentionCompanyName, setMentionCompanyName] = React.useState(true);
  const [includeSeasonSection, setIncludeSeasonSection] = React.useState(true);
  const [includeCompetitorsSection, setIncludeCompetitorsSection] = React.useState(true);
  const [detailLevel, setDetailLevel] = React.useState("standard");

  React.useEffect(() => {
    if (data) {
      setTone(data.tone || "professional");
      setBrandKeywords(((data.brandKeywords as string[]) || []).join("، "));
      setCustomInstructions(data.customInstructions || "");
      setOpportunityCommentStyle(data.opportunityCommentStyle || "");
      setClosingStatement(data.closingStatement || "");
      setMentionCompanyName(data.mentionCompanyName ?? true);
      setIncludeSeasonSection(data.includeSeasonSection ?? true);
      setIncludeCompetitorsSection(data.includeCompetitorsSection ?? true);
      setDetailLevel(data.detailLevel || "standard");
    }
  }, [data]);

  const handleSave = () => {
    saveMutation.mutate({
      tone: tone as any,
      brandKeywords: brandKeywords.split(/[،,]+/).map(k => k.trim()).filter(Boolean),
      customInstructions,
      opportunityCommentStyle,
      closingStatement,
      mentionCompanyName,
      includeSeasonSection,
      includeCompetitorsSection,
      detailLevel: detailLevel as any,
    });
  };

  const TONES = [
    { value: "professional", label: "احترافي رسمي", desc: "لغة مؤسسية رصينة تناسب الشركات الكبيرة" },
    { value: "consultative", label: "استشاري", desc: "أسلوب مستشار خبير يقدم توصيات مدروسة" },
    { value: "direct", label: "مباشر وحازم", desc: "نقاط واضحة وصريحة بدون مقدمات" },
    { value: "friendly", label: "ودي ومحفز", desc: "أسلوب دافئ يشجع العميل على التحرك" },
  ];

  const DETAIL_LEVELS = [
    { value: "brief", label: "موجز", desc: "نقاط رئيسية فقط" },
    { value: "standard", label: "معياري", desc: "توازن بين التفصيل والإيجاز" },
    { value: "detailed", label: "مفصّل", desc: "شرح وافٍ لكل نقطة" },
  ];

  return (
    <div className="space-y-5">
      {/* نبرة التقرير */}
      <SettingCard title="نبرة الكتابة" icon={FileText} description="كيف يتحدث التقرير مع العميل">
        <div className="grid grid-cols-2 gap-3">
          {TONES.map(t => (
            <button
              key={t.value}
              onClick={() => setTone(t.value)}
              className={`p-3 rounded-xl text-right border-2 transition-all ${
                tone === t.value
                  ? "border-primary bg-primary/10"
                  : "border-border bg-muted/20 hover:border-primary/40"
              }`}
            >
              <p className={`text-sm font-semibold ${tone === t.value ? "text-primary" : "text-foreground"}`}>{t.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
            </button>
          ))}
        </div>
      </SettingCard>

      {/* مستوى التفصيل */}
      <SettingCard title="مستوى التفصيل" icon={Layers} description="مقدار الشرح في كل نقطة">
        <div className="flex gap-3">
          {DETAIL_LEVELS.map(d => (
            <button
              key={d.value}
              onClick={() => setDetailLevel(d.value)}
              className={`flex-1 p-3 rounded-xl text-center border-2 transition-all ${
                detailLevel === d.value
                  ? "border-primary bg-primary/10"
                  : "border-border bg-muted/20 hover:border-primary/40"
              }`}
            >
              <p className={`text-sm font-semibold ${detailLevel === d.value ? "text-primary" : "text-foreground"}`}>{d.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{d.desc}</p>
            </button>
          ))}
        </div>
      </SettingCard>

      {/* الكلمات المفتاحية للبراند */}
      <SettingCard title="كلمات مفتاحية للبراند" icon={Tag} description="كلمات تُدمج في نصوص التقرير لتعكس هوية شركتك">
        <div className="space-y-2">
          <Input
            value={brandKeywords}
            onChange={e => setBrandKeywords(e.target.value)}
            placeholder="مثال: مكسب، استشارات، نمو، تحول رقمي (افصل بفاصلة)"
            dir="rtl"
          />
          <p className="text-xs text-muted-foreground">ستُدرج هذه الكلمات بشكل طبيعي في توصيات التقرير</p>
        </div>
      </SettingCard>

      {/* تعليمات مخصصة للـ AI */}
      <SettingCard title="تعليمات مخصصة للذكاء الاصطناعي" icon={Brain} description="توجيهات إضافية يتبعها الـ AI عند كتابة التوصيات">
        <Textarea
          value={customInstructions}
          onChange={e => setCustomInstructions(e.target.value)}
          placeholder="مثال: ركز دائماً على الفرص الموسمية. اذكر أهمية SEO في كل تقرير. لا تذكر المنافسين بالاسم..."
          rows={4}
          dir="rtl"
          className="text-sm"
        />
      </SettingCard>

      {/* أسلوب التعليق على الفرص */}
      <SettingCard title="أسلوب التعليق على الفرص" icon={TrendingUp} description="كيف يُعلّق التقرير على كل فرصة تسويقية">
        <Textarea
          value={opportunityCommentStyle}
          onChange={e => setOpportunityCommentStyle(e.target.value)}
          placeholder="مثال: اربط كل فرصة بالعائد المالي المتوقع. استخدم أرقاماً تقديرية. اذكر المدة الزمنية للتنفيذ..."
          rows={3}
          dir="rtl"
          className="text-sm"
        />
      </SettingCard>

      {/* جملة الختام */}
      <SettingCard title="جملة الختام المخصصة" icon={Star} description="النص الذي يظهر في نهاية كل تقرير">
        <Textarea
          value={closingStatement}
          onChange={e => setClosingStatement(e.target.value)}
          placeholder="مثال: نحن في مكسب نؤمن أن كل تحدي رقمي هو فرصة نمو. تواصل معنا لنبدأ رحلتك..."
          rows={3}
          dir="rtl"
          className="text-sm"
        />
      </SettingCard>

      {/* خيارات الأقسام */}
      <SettingCard title="أقسام التقرير" icon={Layers} description="تحكم في الأقسام التي تظهر في كل تقرير">
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
            <div>
              <p className="text-sm font-medium">قسم المواسم التسويقية</p>
              <p className="text-xs text-muted-foreground">يُظهر الموسم الحالي وفرصه المخصصة لنوع النشاط</p>
            </div>
            <Switch checked={includeSeasonSection} onCheckedChange={setIncludeSeasonSection} />
          </div>
          <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
            <div>
              <p className="text-sm font-medium">قسم مقارنة المنافسين</p>
              <p className="text-xs text-muted-foreground">يُقارن العميل بأقرب المنافسين في نفس المدينة</p>
            </div>
            <Switch checked={includeCompetitorsSection} onCheckedChange={setIncludeCompetitorsSection} />
          </div>
          <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
            <div>
              <p className="text-sm font-medium">ذكر اسم شركتك في التقرير</p>
              <p className="text-xs text-muted-foreground">يُذكر اسم الشركة في الخاتمة وبعض التوصيات</p>
            </div>
            <Switch checked={mentionCompanyName} onCheckedChange={setMentionCompanyName} />
          </div>
        </div>
      </SettingCard>

      <Button onClick={handleSave} disabled={saveMutation.isPending} className="w-full">
        {saveMutation.isPending ? <RefreshCw className="w-4 h-4 ml-2 animate-spin" /> : <Save className="w-4 h-4 ml-2" />}
        حفظ إعدادات أسلوب التقارير
      </Button>
    </div>
  );
}

// ===== تبويب Whatchimp =====
function WhatchimpSettingsTab() {
  const { data: user } = trpc.auth.me.useQuery();
  const isAdmin = (user as { role?: string } | null)?.role === "admin";

  const { data: settings, isLoading, refetch } = trpc.whatchimp.getSettings.useQuery(undefined, { enabled: isAdmin });
  const { data: labelsData } = trpc.whatchimp.getLabels.useQuery(undefined, { enabled: isAdmin && !!settings });
  const { data: configured } = trpc.whatchimp.isConfigured.useQuery();

  const [apiToken, setApiToken] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [botFlowUniqueId, setBotFlowUniqueId] = useState("");
  const [selectedLabelId, setSelectedLabelId] = useState<number | undefined>(undefined);
  const [selectedLabelName, setSelectedLabelName] = useState("");
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const saveMutation = trpc.whatchimp.saveSettings.useMutation({
    onSuccess: () => { toast.success("تم حفظ إعدادات Whatchimp بنجاح"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const testMutation = trpc.whatchimp.testConnection.useMutation({
    onSuccess: (res) => setTestResult(res),
    onError: (e) => setTestResult({ success: false, message: e.message }),
  });

  if (!isAdmin) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>هذه الإعدادات متاحة للأدمن فقط</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* حالة الاتصال */}
      <SettingCard title="حالة الاتصال" description="حالة ربط Whatchimp بالنظام">
        <div className="flex items-center gap-3">
          {configured?.configured ? (
            <><CheckCircle2 className="w-5 h-5 text-green-500" /><span className="text-green-600 font-medium">متصل ومفعّل</span></>
          ) : (
            <><AlertCircle className="w-5 h-5 text-yellow-500" /><span className="text-yellow-600 font-medium">غير مربوط بعد</span></>
          )}
        </div>
      </SettingCard>

      {/* إعدادات الاتصال */}
      <SettingCard title="إعدادات الاتصال" description="أدخل بيانات حساب Whatchimp">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">API Token</label>
            <Input
              type="password"
              placeholder={settings ? "••••••••••••••••••••" : "أدخل API Token"}
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              dir="ltr"
            />
            {settings && <p className="text-xs text-muted-foreground mt-1">مخزّن: {settings.apiToken}</p>}
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Phone Number ID</label>
            <Input
              placeholder={settings?.phoneNumberId ?? "أدخل Phone Number ID"}
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
              dir="ltr"
            />
          </div>

          {/* Bot Flow ID لإرسال تقرير PDF */}
          <div>
            <label className="text-sm font-medium mb-1 block">
              Bot Flow Unique ID
              <span className="text-xs text-muted-foreground mr-2">(لإرسال تقرير PDF عبر القالب المعتمد)</span>
            </label>
            <Input
              placeholder={settings?.botFlowUniqueId ?? "أدخل Bot Flow Unique ID من WhatChimp"}
              value={botFlowUniqueId}
              onChange={(e) => setBotFlowUniqueId(e.target.value)}
              dir="ltr"
            />
            {settings?.botFlowUniqueId && !botFlowUniqueId && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">✅ محفوظ: {settings.botFlowUniqueId}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">معرّف الـ Flow الذي يحتوي على قالب digital_anal_report</p>
          </div>

          {/* اختيار Label */}
          {labelsData && labelsData.length > 0 && (
            <div>
              <label className="text-sm font-medium mb-1 block">التصنيف الافتراضي (اختياري)</label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={selectedLabelId ?? ""}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  const label = labelsData.find(l => l.id === id);
                  setSelectedLabelId(id || undefined);
                  setSelectedLabelName(label?.label_name ?? "");
                }}
              >
                <option value="">-- بدون تصنيف --</option>
                {labelsData.map(l => (
                  <option key={l.id} value={l.id}>{l.label_name}</option>
                ))}
              </select>
              {settings?.defaultLabelName && (
                <p className="text-xs text-muted-foreground mt-1">الحالي: {settings.defaultLabelName}</p>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => testMutation.mutate({ apiToken: apiToken || "", phoneNumberId: phoneNumberId || settings?.phoneNumberId || "" })}
              disabled={testMutation.isPending || (!apiToken && !settings)}
            >
              {testMutation.isPending ? <RefreshCw className="w-4 h-4 ml-2 animate-spin" /> : <TestTube2 className="w-4 h-4 ml-2" />}
              اختبار الاتصال
            </Button>
            <Button
              onClick={() => {
                // Only send apiToken if user typed a new one
                // Never send the masked version (settings?.apiToken) back to the server
                if (!apiToken && settings) {
                  // Update only label/phoneNumberId without touching the stored token
                  saveMutation.mutate({
                    apiToken: "__KEEP__",
                    phoneNumberId: phoneNumberId || settings.phoneNumberId || "",
                    defaultLabelId: selectedLabelId ?? settings?.defaultLabelId ?? undefined,
                    defaultLabelName: selectedLabelName || settings?.defaultLabelName || undefined,
                    botFlowUniqueId: botFlowUniqueId || settings?.botFlowUniqueId || undefined,
                  });
                } else {
                  saveMutation.mutate({
                    apiToken: apiToken,
                    phoneNumberId: phoneNumberId || settings?.phoneNumberId || "",
                    defaultLabelId: selectedLabelId ?? settings?.defaultLabelId ?? undefined,
                    defaultLabelName: selectedLabelName || settings?.defaultLabelName || undefined,
                    botFlowUniqueId: botFlowUniqueId || settings?.botFlowUniqueId || undefined,
                  });
                }
              }}
              disabled={saveMutation.isPending || (!apiToken && !settings)}
            >
              {saveMutation.isPending ? <RefreshCw className="w-4 h-4 ml-2 animate-spin" /> : <Save className="w-4 h-4 ml-2" />}
              حفظ الإعدادات
            </Button>
          </div>

          {testResult && (
            <div className={`flex items-center gap-2 text-sm p-3 rounded-lg ${testResult.success ? "bg-green-50 text-green-700 dark:bg-green-950" : "bg-red-50 text-red-700 dark:bg-red-950"}`}>
              {testResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {testResult.message}
            </div>
          )}
        </div>
      </SettingCard>

      {/* معلومات */}
      <SettingCard title="كيفية الاستخدام" description="خطوات ربط Whatchimp">
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex gap-2"><span className="font-bold text-foreground">1.</span> ادخل API Token من إعدادات حساب Whatchimp</div>
          <div className="flex gap-2"><span className="font-bold text-foreground">2.</span> أدخل Phone Number ID من لوحة Whatchimp</div>
          <div className="flex gap-2"><span className="font-bold text-foreground">3.</span> اختبر الاتصال ثم احفظ</div>
          <div className="flex gap-2"><span className="font-bold text-foreground">4.</span> في صفحة العميل ستجد زر "إرسال إلى Whatchimp"</div>
          <div className="flex gap-2"><span className="font-bold text-foreground">5.</span> في قائمة العملاء يمكنك تحديد عدة عملاء وإرسالهم دفعة واحدة</div>
        </div>
      </SettingCard>
    </div>
  );
}

// ===== الصفحة الرئيسية =====
export default function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");

  const renderContent = () => {
    switch (activeTab) {
      case "general": return <GeneralTab />;
      case "ai": return <AITab />;
      case "users-management": return <UsersManagementTab />;
      case "data": return <DataTab />;
      case "google-sheets": return <GoogleSheetsTab />;
      case "notifications": return <NotificationsTab />;
      case "security": return <SecurityTab />;
      case "account": return <AccountTab />;
      case "report-style": return <ReportStyleTab />;
      case "whatchimp": return <WhatchimpSettingsTab />;
      default: return <GeneralTab />;
    }
  };

  const activeTabConfig = TABS.find(t => t.id === activeTab);

  return (
    <div className="flex h-full">
      {/* القائمة الجانبية للإعدادات */}
      <div className="w-56 shrink-0 border-l border-border/50 bg-muted/20 p-3 space-y-1">
        <p className="text-xs font-semibold text-muted-foreground px-2 mb-3 uppercase tracking-wider">الإعدادات</p>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all text-right ${
              activeTab === tab.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "hover:bg-muted text-foreground/80 hover:text-foreground"
            }`}
          >
            <tab.icon className="w-4 h-4 shrink-0" />
            <span className="flex-1">{tab.label}</span>
            {tab.badge && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === tab.id 
                  ? "bg-white/20 text-white" 
                  : "bg-primary/10 text-primary"
              }`}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* المحتوى الرئيسي */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-2xl">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Settings2 className="w-4 h-4" />
              <span>الإعدادات</span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-foreground">{activeTabConfig?.label}</span>
            </div>
            <h1 className="text-2xl font-bold">{activeTabConfig?.label}</h1>
            <p className="text-muted-foreground text-sm mt-1">{activeTabConfig?.description}</p>
          </div>

          {renderContent()}
        </div>
      </div>
    </div>
  );
}
