/**
 * SearchSettingsPanel — إعدادات البحث المتقدمة
 * ===============================================
 * التحكم في: عدد النتائج + المنصات + التنفيذ الأوتوماتيكي
 */
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Settings2, Layers, Zap, Save, GitMerge, ChevronDown,
  Search, Instagram, Video, Camera, Twitter, Linkedin, Users,
  Hash, CheckCheck
} from "lucide-react";
import { useSearch, type PlatformId } from "@/contexts/SearchContext";

// ─── تعريف المنصات ────────────────────────────────────────────────────────────

const PLATFORM_DEFS: { id: PlatformId; label: string; icon: React.ElementType; color: string }[] = [
  { id: "googleWeb", label: "Google Search", icon: Search,    color: "text-orange-400" },
  { id: "instagram", label: "إنستجرام",      icon: Instagram, color: "text-pink-400" },
  { id: "tiktok",    label: "تيك توك",       icon: Video,     color: "text-purple-400" },
  { id: "snapchat",  label: "سناب شات",      icon: Camera,    color: "text-yellow-400" },
  { id: "twitter",   label: "تويتر / X",     icon: Twitter,   color: "text-sky-400" },
  { id: "linkedin",  label: "لينكدإن",       icon: Linkedin,  color: "text-blue-500" },
  { id: "facebook",  label: "فيسبوك",        icon: Users,     color: "text-blue-400" },
];

// ─── المكون الرئيسي ───────────────────────────────────────────────────────────

export function SearchSettingsPanel() {
  const {
    targetCount, setTargetCount,
    autoSave, setAutoSave,
    autoMerge, setAutoMerge,
    selectedPlatforms, setSelectedPlatforms,
    session,
  } = useSearch();

  const togglePlatform = (id: PlatformId) => {
    setSelectedPlatforms(
      selectedPlatforms.includes(id)
        ? selectedPlatforms.filter(p => p !== id)
        : [...selectedPlatforms, id]
    );
  };

  const selectAll = () => setSelectedPlatforms(PLATFORM_DEFS.map(p => p.id));
  const selectNone = () => setSelectedPlatforms([]);

  const isAutoActive = autoSave || autoMerge;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-9 gap-1.5 text-xs ${isAutoActive ? "border-primary/50 text-primary bg-primary/10 hover:bg-primary/15" : ""}`}
        >
          <Settings2 className="w-3.5 h-3.5" />
          إعدادات البحث
          {isAutoActive && (
            <Badge className="text-[9px] bg-primary/20 text-primary border-primary/30 border px-1 py-0">
              أوتو
            </Badge>
          )}
          <ChevronDown className="w-3 h-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0 shadow-xl border-border" align="end" sideOffset={8}>

        {/* رأس اللوحة */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Settings2 className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">إعدادات البحث</span>
        </div>

        <div className="p-4 space-y-4">

          {/* ─── عدد النتائج المستهدفة ─────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">عدد النتائج لكل منصة</span>
              </div>
              <span className="text-sm font-bold text-primary">{targetCount}</span>
            </div>
            <Slider
              value={[targetCount]}
              min={5}
              max={100}
              step={5}
              onValueChange={([v]) => setTargetCount(v)}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>5</span>
              <span>25</span>
              <span>50</span>
              <span>100</span>
            </div>
          </div>

          <Separator />

          {/* ─── المنصات المُفعّلة ─────────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">المنصات المُفعّلة</span>
              </div>
              <div className="flex gap-1">
                <button onClick={selectAll} className="text-[10px] text-primary hover:underline">الكل</button>
                <span className="text-muted-foreground text-[10px]">/</span>
                <button onClick={selectNone} className="text-[10px] text-muted-foreground hover:text-foreground hover:underline">لا شيء</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {PLATFORM_DEFS.map(p => {
                const Icon = p.icon;
                const isSelected = selectedPlatforms.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => togglePlatform(p.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-all ${
                      isSelected
                        ? "bg-primary/10 border-primary/30 text-foreground"
                        : "bg-muted/20 border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className={`w-3 h-3 ${isSelected ? p.color : ""}`} />
                    <span className="truncate">{p.label}</span>
                    {isSelected && <CheckCheck className="w-2.5 h-2.5 text-primary ml-auto shrink-0" />}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
              {selectedPlatforms.length} من {PLATFORM_DEFS.length} منصات مُفعّلة
            </p>
          </div>

          <Separator />

          {/* ─── التنفيذ الأوتوماتيكي ─────────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <Zap className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-medium">التنفيذ الأوتوماتيكي</span>
            </div>

            {/* دمج تلقائي */}
            <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/20 border border-border mb-2">
              <div className="flex items-center gap-2">
                <GitMerge className="w-3.5 h-3.5 text-purple-400" />
                <div>
                  <p className="text-xs font-medium">دمج تلقائي</p>
                  <p className="text-[10px] text-muted-foreground">يدمج النتائج المتشابهة تلقائياً</p>
                </div>
              </div>
              <Switch
                checked={autoMerge}
                onCheckedChange={setAutoMerge}
                className="scale-90"
              />
            </div>

            {/* حفظ تلقائي */}
            <div className={`flex items-center justify-between py-2 px-3 rounded-lg border transition-all ${
              autoSave ? "bg-green-500/10 border-green-500/30" : "bg-muted/20 border-border"
            }`}>
              <div className="flex items-center gap-2">
                <Save className={`w-3.5 h-3.5 ${autoSave ? "text-green-400" : "text-muted-foreground"}`} />
                <div>
                  <p className="text-xs font-medium">حفظ تلقائي</p>
                  <p className="text-[10px] text-muted-foreground">يحفظ النتائج المستقرة تلقائياً</p>
                </div>
              </div>
              <Switch
                checked={autoSave}
                onCheckedChange={setAutoSave}
                className="scale-90"
              />
            </div>

            {autoSave && (
              <p className="text-[10px] text-amber-400 mt-1.5 flex items-center gap-1">
                <Zap className="w-2.5 h-2.5" />
                سيحفظ النتائج المستقرة فقط (بعد فحص الهوية)
              </p>
            )}
          </div>

        </div>

        {/* حالة الجلسة الحالية */}
        {session && (
          <div className="px-4 py-2.5 border-t border-border bg-muted/20">
            <p className="text-[10px] text-muted-foreground">
              جلسة نشطة: <span className="text-foreground font-medium">"{session.keyword}"</span>
              {" · "}{session.totalFound} نتيجة
            </p>
          </div>
        )}

      </PopoverContent>
    </Popover>
  );
}
