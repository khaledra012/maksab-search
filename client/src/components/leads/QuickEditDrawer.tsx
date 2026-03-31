import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2, Phone, MapPin, Globe, Instagram, Twitter,
  Music2, Camera, Facebook, Linkedin, Save, Loader2, Link2, Mail,
} from "lucide-react";
import { COUNTRIES_DATA } from "../../../../shared/countries";

interface QuickEditDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: {
    id: number;
    companyName: string;
    businessType?: string | null;
    city?: string | null;
    district?: string | null;
    verifiedPhone?: string | null;
    website?: string | null;
    googleMapsUrl?: string | null;
    instagramUrl?: string | null;
    twitterUrl?: string | null;
    snapchatUrl?: string | null;
    tiktokUrl?: string | null;
    facebookUrl?: string | null;
    linkedinUrl?: string | null;
    email?: string | null;
    notes?: string | null;
  } | null;
  onSaved?: () => void;
}

export default function QuickEditDrawer({ open, onOpenChange, lead, onSaved }: QuickEditDrawerProps) {
  const utils = trpc.useUtils();

  const [form, setForm] = useState({
    companyName: "",
    businessType: "",
    city: "",
    district: "",
    verifiedPhone: "",
    email: "",
    website: "",
    googleMapsUrl: "",
    instagramUrl: "",
    twitterUrl: "",
    snapchatUrl: "",
    tiktokUrl: "",
    facebookUrl: "",
    linkedinUrl: "",
    notes: "",
  });

  // تحديد المدن بناءً على المملكة العربية السعودية
  const saudiCities = COUNTRIES_DATA.find(c => c.name === "المملكة العربية السعودية")?.cities ?? [];

  useEffect(() => {
    if (lead) {
      setForm({
        companyName: lead.companyName ?? "",
        businessType: lead.businessType ?? "",
        city: lead.city ?? "",
        district: lead.district ?? "",
        verifiedPhone: lead.verifiedPhone ?? "",
        email: (lead as any).email ?? "",
        website: lead.website ?? "",
        googleMapsUrl: lead.googleMapsUrl ?? "",
        instagramUrl: lead.instagramUrl ?? "",
        twitterUrl: lead.twitterUrl ?? "",
        snapchatUrl: lead.snapchatUrl ?? "",
        tiktokUrl: lead.tiktokUrl ?? "",
        facebookUrl: lead.facebookUrl ?? "",
        linkedinUrl: lead.linkedinUrl ?? "",
        notes: lead.notes ?? "",
      });
    }
  }, [lead]);

  const updateLead = trpc.leads.update.useMutation({
    onSuccess: () => {
      toast.success("تم حفظ التعديلات بنجاح");
      utils.leads.list.invalidate();
      utils.leads.getById.invalidate({ id: lead?.id });
      onOpenChange(false);
      onSaved?.();
    },
    onError: (err) => {
      toast.error("فشل الحفظ: " + err.message);
    },
  });

  const handleSave = () => {
    if (!lead) return;
    if (!form.companyName.trim()) {
      toast.error("اسم النشاط مطلوب");
      return;
    }
    updateLead.mutate({
      id: lead.id,
      companyName: form.companyName || undefined,
      businessType: form.businessType || undefined,
      city: form.city || undefined,
      district: form.district || undefined,
      verifiedPhone: form.verifiedPhone || undefined,
      email: form.email || undefined,
      website: form.website || undefined,
      googleMapsUrl: form.googleMapsUrl || undefined,
      instagramUrl: form.instagramUrl || undefined,
      twitterUrl: form.twitterUrl || undefined,
      snapchatUrl: form.snapchatUrl || undefined,
      tiktokUrl: form.tiktokUrl || undefined,
      facebookUrl: form.facebookUrl || undefined,
      linkedinUrl: form.linkedinUrl || undefined,
      notes: form.notes || undefined,
    });
  };

  const f = (key: keyof typeof form, val: string) => setForm(p => ({ ...p, [key]: val }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full sm:max-w-md p-0 flex flex-col h-full overflow-hidden" style={{ background: "oklch(0.12 0.01 240)", borderRight: "1px solid oklch(0.22 0.02 240)" }}>
        <SheetHeader className="px-5 pt-5 pb-3 border-b" style={{ borderColor: "oklch(0.22 0.02 240)" }}>
          <SheetTitle className="text-right text-base font-bold" style={{ color: "oklch(0.9 0.01 240)" }}>
            ✏️ تعديل سريع
          </SheetTitle>
          {lead && (
            <p className="text-xs text-right" style={{ color: "oklch(0.55 0.01 240)" }}>
              {lead.companyName}
            </p>
          )}
        </SheetHeader>

        <ScrollArea className="flex-1 min-h-0 px-5 py-4">
          <div className="flex flex-col gap-4">

            {/* اسم النشاط */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "oklch(0.7 0.01 240)" }}>
                <Building2 className="w-3.5 h-3.5" /> اسم النشاط *
              </Label>
              <Input
                value={form.companyName}
                onChange={e => f("companyName", e.target.value)}
                placeholder="اسم النشاط التجاري"
                className="text-sm h-9"
                style={{ background: "oklch(0.16 0.01 240)", border: "1px solid oklch(0.25 0.02 240)", color: "oklch(0.9 0.01 240)" }}
              />
            </div>

            {/* نوع النشاط */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold" style={{ color: "oklch(0.7 0.01 240)" }}>
                نوع النشاط
              </Label>
              <Input
                value={form.businessType}
                onChange={e => f("businessType", e.target.value)}
                placeholder="مثال: مطعم، صالون، مقهى..."
                className="text-sm h-9"
                style={{ background: "oklch(0.16 0.01 240)", border: "1px solid oklch(0.25 0.02 240)", color: "oklch(0.9 0.01 240)" }}
              />
            </div>

            {/* المدينة والحي */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "oklch(0.7 0.01 240)" }}>
                  <MapPin className="w-3.5 h-3.5" /> المدينة
                </Label>
                <Select value={form.city} onValueChange={v => f("city", v)}>
                  <SelectTrigger className="h-9 text-sm" style={{ background: "oklch(0.16 0.01 240)", border: "1px solid oklch(0.25 0.02 240)", color: "oklch(0.9 0.01 240)" }}>
                    <SelectValue placeholder="اختر..." />
                  </SelectTrigger>
                  <SelectContent>
                    {saudiCities.map(city => (
                      <SelectItem key={city} value={city}>{city}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold" style={{ color: "oklch(0.7 0.01 240)" }}>الحي</Label>
                <Input
                  value={form.district}
                  onChange={e => f("district", e.target.value)}
                  placeholder="اسم الحي"
                  className="text-sm h-9"
                  style={{ background: "oklch(0.16 0.01 240)", border: "1px solid oklch(0.25 0.02 240)", color: "oklch(0.9 0.01 240)" }}
                />
              </div>
            </div>

            {/* رقم الهاتف */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "oklch(0.7 0.01 240)" }}>
                <Phone className="w-3.5 h-3.5" /> رقم الهاتف
              </Label>
              <Input
                value={form.verifiedPhone}
                onChange={e => f("verifiedPhone", e.target.value)}
                placeholder="05xxxxxxxx"
                dir="ltr"
                className="text-sm h-9"
                style={{ background: "oklch(0.16 0.01 240)", border: "1px solid oklch(0.25 0.02 240)", color: "oklch(0.9 0.01 240)" }}
              />
            </div>

            {/* البريد الإلكتروني */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "oklch(0.7 0.01 240)" }}>
                <Mail className="w-3.5 h-3.5" /> البريد الإلكتروني
              </Label>
              <Input
                value={form.email}
                onChange={e => f("email", e.target.value)}
                placeholder="example@domain.com"
                type="email"
                dir="ltr"
                className="text-sm h-9"
                style={{ background: "oklch(0.16 0.01 240)", border: "1px solid oklch(0.25 0.02 240)", color: "oklch(0.9 0.01 240)" }}
              />
            </div>

            {/* فاصل */}
            <div className="border-t pt-3" style={{ borderColor: "oklch(0.22 0.02 240)" }}>
              <p className="text-xs font-bold mb-3" style={{ color: "oklch(0.55 0.01 240)" }}>🔗 الروابط الرقمية</p>
            </div>

            {/* الموقع */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "oklch(0.7 0.01 240)" }}>
                <Globe className="w-3.5 h-3.5" /> الموقع الإلكتروني
              </Label>
              <Input
                value={form.website}
                onChange={e => f("website", e.target.value)}
                placeholder="https://..."
                dir="ltr"
                className="text-sm h-9"
                style={{ background: "oklch(0.16 0.01 240)", border: "1px solid oklch(0.25 0.02 240)", color: "oklch(0.9 0.01 240)" }}
              />
            </div>

            {/* خرائط جوجل */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "oklch(0.7 0.01 240)" }}>
                <MapPin className="w-3.5 h-3.5" /> رابط خرائط جوجل
              </Label>
              <Input
                value={form.googleMapsUrl}
                onChange={e => f("googleMapsUrl", e.target.value)}
                placeholder="https://maps.google.com/..."
                dir="ltr"
                className="text-sm h-9"
                style={{ background: "oklch(0.16 0.01 240)", border: "1px solid oklch(0.25 0.02 240)", color: "oklch(0.9 0.01 240)" }}
              />
            </div>

            {/* انستغرام */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "oklch(0.7 0.01 240)" }}>
                <Instagram className="w-3.5 h-3.5" style={{ color: "#e1306c" }} /> انستغرام
              </Label>
              <Input
                value={form.instagramUrl}
                onChange={e => f("instagramUrl", e.target.value)}
                placeholder="https://instagram.com/..."
                dir="ltr"
                className="text-sm h-9"
                style={{ background: "oklch(0.16 0.01 240)", border: "1px solid oklch(0.25 0.02 240)", color: "oklch(0.9 0.01 240)" }}
              />
            </div>

            {/* تيك توك */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "oklch(0.7 0.01 240)" }}>
                <Music2 className="w-3.5 h-3.5" style={{ color: "#69c9d0" }} /> تيك توك
              </Label>
              <Input
                value={form.tiktokUrl}
                onChange={e => f("tiktokUrl", e.target.value)}
                placeholder="https://tiktok.com/@..."
                dir="ltr"
                className="text-sm h-9"
                style={{ background: "oklch(0.16 0.01 240)", border: "1px solid oklch(0.25 0.02 240)", color: "oklch(0.9 0.01 240)" }}
              />
            </div>

            {/* سناب شات */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "oklch(0.7 0.01 240)" }}>
                <Camera className="w-3.5 h-3.5" style={{ color: "#fffc00" }} /> سناب شات
              </Label>
              <Input
                value={form.snapchatUrl}
                onChange={e => f("snapchatUrl", e.target.value)}
                placeholder="https://snapchat.com/add/..."
                dir="ltr"
                className="text-sm h-9"
                style={{ background: "oklch(0.16 0.01 240)", border: "1px solid oklch(0.25 0.02 240)", color: "oklch(0.9 0.01 240)" }}
              />
            </div>

            {/* تويتر / X */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "oklch(0.7 0.01 240)" }}>
                <Twitter className="w-3.5 h-3.5" style={{ color: "#1da1f2" }} /> X (تويتر)
              </Label>
              <Input
                value={form.twitterUrl}
                onChange={e => f("twitterUrl", e.target.value)}
                placeholder="https://x.com/..."
                dir="ltr"
                className="text-sm h-9"
                style={{ background: "oklch(0.16 0.01 240)", border: "1px solid oklch(0.25 0.02 240)", color: "oklch(0.9 0.01 240)" }}
              />
            </div>

            {/* فيسبوك */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "oklch(0.7 0.01 240)" }}>
                <Facebook className="w-3.5 h-3.5" style={{ color: "#1877f2" }} /> فيسبوك
              </Label>
              <Input
                value={form.facebookUrl}
                onChange={e => f("facebookUrl", e.target.value)}
                placeholder="https://facebook.com/..."
                dir="ltr"
                className="text-sm h-9"
                style={{ background: "oklch(0.16 0.01 240)", border: "1px solid oklch(0.25 0.02 240)", color: "oklch(0.9 0.01 240)" }}
              />
            </div>

            {/* لينكدإن */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "oklch(0.7 0.01 240)" }}>
                <Linkedin className="w-3.5 h-3.5" style={{ color: "#0a66c2" }} /> لينكدإن
              </Label>
              <Input
                value={form.linkedinUrl}
                onChange={e => f("linkedinUrl", e.target.value)}
                placeholder="https://linkedin.com/..."
                dir="ltr"
                className="text-sm h-9"
                style={{ background: "oklch(0.16 0.01 240)", border: "1px solid oklch(0.25 0.02 240)", color: "oklch(0.9 0.01 240)" }}
              />
            </div>

            {/* ملاحظات */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold" style={{ color: "oklch(0.7 0.01 240)" }}>
                ملاحظات
              </Label>
              <textarea
                value={form.notes}
                onChange={e => f("notes", e.target.value)}
                placeholder="ملاحظات إضافية..."
                rows={3}
                className="w-full rounded-md px-3 py-2 text-sm resize-none outline-none focus:ring-1"
                style={{
                  background: "oklch(0.16 0.01 240)",
                  border: "1px solid oklch(0.25 0.02 240)",
                  color: "oklch(0.9 0.01 240)",
                  fontFamily: "inherit",
                }}
              />
            </div>

          </div>
        </ScrollArea>

        <SheetFooter className="px-5 py-4 border-t flex gap-2" style={{ borderColor: "oklch(0.22 0.02 240)" }}>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={updateLead.isPending}
            style={{ background: "oklch(0.16 0.01 240)", border: "1px solid oklch(0.25 0.02 240)", color: "oklch(0.7 0.01 240)" }}
          >
            إلغاء
          </Button>
          <Button
            size="sm"
            className="flex-1 gap-2"
            onClick={handleSave}
            disabled={updateLead.isPending}
            style={{ background: "oklch(0.55 0.18 145)", color: "#000", fontWeight: 700 }}
          >
            {updateLead.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            حفظ التعديلات
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
