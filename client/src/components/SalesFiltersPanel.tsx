/**
 * SalesFiltersPanel — لوحة الفلاتر الذكية البيعية
 * ==================================================
 * تُصفّي نتائج البحث حسب معايير الفرصة البيعية
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  SlidersHorizontal, Globe, Phone, Users, Clock, Star,
  MessageSquare, Share2, AlertCircle, Calendar, X, Zap,
  TrendingDown, Target, ChevronDown
} from "lucide-react";
import { useSearch, type SalesFilters } from "@/contexts/SearchContext";

// ─── تعريف الفلاتر ────────────────────────────────────────────────────────────

interface FilterDef {
  key: keyof SalesFilters;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  thresholdKey?: keyof SalesFilters;
  thresholdLabel?: string;
  thresholdMin?: number;
  thresholdMax?: number;
  thresholdStep?: number;
  thresholdUnit?: string;
}

const FILTER_DEFS: FilterDef[] = [
  {
    key: "noWebsite",
    label: "بدون موقع إلكتروني",
    description: "نشاطات لا تملك موقع ويب",
    icon: Globe,
    color: "text-red-400",
    bgColor: "bg-red-500/10 border-red-500/30",
  },
  {
    key: "noPhone",
    label: "بدون رقم هاتف",
    description: "نشاطات لا يظهر لها رقم تواصل",
    icon: Phone,
    color: "text-orange-400",
    bgColor: "bg-orange-500/10 border-orange-500/30",
  },
  {
    key: "lowFollowers",
    label: "متابعون أقل من الحد",
    description: "حسابات بحضور ضعيف",
    icon: Users,
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/10 border-yellow-500/30",
    thresholdKey: "lowFollowersThreshold",
    thresholdLabel: "الحد الأقصى للمتابعين",
    thresholdMin: 100,
    thresholdMax: 10000,
    thresholdStep: 100,
    thresholdUnit: "متابع",
  },
  {
    key: "inactiveAccount",
    label: "حساب غير نشط",
    description: "آخر نشر قبل فترة طويلة",
    icon: Clock,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10 border-blue-500/30",
    thresholdKey: "inactiveDays",
    thresholdLabel: "أيام الخمول",
    thresholdMin: 7,
    thresholdMax: 180,
    thresholdStep: 7,
    thresholdUnit: "يوم",
  },
  {
    key: "lowRating",
    label: "تقييم Google منخفض",
    description: "نشاطات تحتاج تحسين سمعتها",
    icon: Star,
    color: "text-amber-400",
    bgColor: "bg-amber-500/10 border-amber-500/30",
    thresholdKey: "lowRatingThreshold",
    thresholdLabel: "أقل من",
    thresholdMin: 1,
    thresholdMax: 5,
    thresholdStep: 0.5,
    thresholdUnit: "نجمة",
  },
  {
    key: "fewReviews",
    label: "تعليقات قليلة",
    description: "نشاطات بدون مراجعات كافية",
    icon: MessageSquare,
    color: "text-purple-400",
    bgColor: "bg-purple-500/10 border-purple-500/30",
    thresholdKey: "fewReviewsThreshold",
    thresholdLabel: "أقل من",
    thresholdMin: 5,
    thresholdMax: 100,
    thresholdStep: 5,
    thresholdUnit: "تعليق",
  },
  {
    key: "noSocialMedia",
    label: "بدون سوشيال ميديا",
    description: "نشاطات غائبة عن المنصات",
    icon: Share2,
    color: "text-pink-400",
    bgColor: "bg-pink-500/10 border-pink-500/30",
  },
  {
    key: "missingFields",
    label: "بيانات ناقصة",
    description: "نشاطات تحتاج إثراء بيانات",
    icon: AlertCircle,
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10 border-cyan-500/30",
  },
  {
    key: "newAccount",
    label: "حساب جديد",
    description: "نشاطات حديثة تحتاج دعم تسويقي",
    icon: Calendar,
    color: "text-green-400",
    bgColor: "bg-green-500/10 border-green-500/30",
    thresholdKey: "newAccountMonths",
    thresholdLabel: "أقل من",
    thresholdMin: 1,
    thresholdMax: 24,
    thresholdStep: 1,
    thresholdUnit: "شهر",
  },
];

// ─── مكون بطاقة فلتر واحد ────────────────────────────────────────────────────

function FilterCard({ def, filters, onUpdate }: {
  def: FilterDef;
  filters: SalesFilters;
  onUpdate: <K extends keyof SalesFilters>(key: K, value: SalesFilters[K]) => void;
}) {
  const isActive = filters[def.key] as boolean;
  const Icon = def.icon;

  return (
    <div className={`rounded-lg border p-3 transition-all ${isActive ? def.bgColor : "bg-muted/20 border-border"}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? def.color : "text-muted-foreground"}`} />
          <div className="min-w-0">
            <p className={`text-xs font-medium leading-tight ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
              {def.label}
            </p>
            <p className="text-[10px] text-muted-foreground/70 leading-tight mt-0.5 truncate">
              {def.description}
            </p>
          </div>
        </div>
        <Switch
          checked={isActive}
          onCheckedChange={(v) => onUpdate(def.key, v as any)}
          className="shrink-0 scale-90"
        />
      </div>

      {/* Threshold Slider */}
      {isActive && def.thresholdKey && (
        <div className="mt-2.5 pt-2.5 border-t border-border/50">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-muted-foreground">{def.thresholdLabel}</span>
            <span className={`text-[11px] font-bold ${def.color}`}>
              {filters[def.thresholdKey] as number} {def.thresholdUnit}
            </span>
          </div>
          <Slider
            value={[filters[def.thresholdKey] as number]}
            min={def.thresholdMin}
            max={def.thresholdMax}
            step={def.thresholdStep}
            onValueChange={([v]) => onUpdate(def.thresholdKey!, v as any)}
            className="w-full"
          />
        </div>
      )}
    </div>
  );
}

// ─── المكون الرئيسي ───────────────────────────────────────────────────────────

export function SalesFiltersPanel() {
  const { salesFilters, updateSalesFilter, setSalesFilters, activeSalesFiltersCount, totalFiltered, totalResults } = useSearch();
  const [open, setOpen] = useState(false);

  const resetFilters = () => {
    setSalesFilters({
      noWebsite: false, noPhone: false,
      lowFollowers: false, lowFollowersThreshold: 1000,
      inactiveAccount: false, inactiveDays: 30,
      lowRating: false, lowRatingThreshold: 3.5,
      noSocialMedia: false,
      fewReviews: false, fewReviewsThreshold: 10,
      missingFields: false,
      newAccount: false, newAccountMonths: 6,
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-9 gap-1.5 text-xs relative ${activeSalesFiltersCount > 0 ? "border-amber-500/50 text-amber-400 bg-amber-500/10 hover:bg-amber-500/15" : ""}`}
        >
          <Target className="w-3.5 h-3.5" />
          فلاتر بيعية
          {activeSalesFiltersCount > 0 && (
            <Badge className="h-4 w-4 p-0 text-[9px] bg-amber-500 text-white absolute -top-1.5 -right-1.5 flex items-center justify-center rounded-full">
              {activeSalesFiltersCount}
            </Badge>
          )}
          <ChevronDown className="w-3 h-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0 shadow-xl border-border"
        align="end"
        sideOffset={8}
      >
        {/* رأس اللوحة */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-semibold">فلاتر الفرصة البيعية</span>
            {activeSalesFiltersCount > 0 && (
              <Badge className="text-[10px] bg-amber-500/20 text-amber-400 border-amber-500/40 border">
                {activeSalesFiltersCount} نشط
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {activeSalesFiltersCount > 0 && (
              <Button variant="ghost" size="sm" onClick={resetFilters} className="h-6 text-[10px] text-muted-foreground hover:text-foreground px-2">
                <X className="w-3 h-3 mr-1" />إعادة تعيين
              </Button>
            )}
          </div>
        </div>

        {/* إحصائية الفلترة */}
        {totalResults > 0 && (
          <div className="px-4 py-2 bg-muted/30 border-b border-border">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">النتائج المُصفّاة</span>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-amber-400">{totalFiltered}</span>
                <span className="text-muted-foreground">من</span>
                <span className="font-medium">{totalResults}</span>
                {activeSalesFiltersCount > 0 && (
                  <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-500/30 text-amber-400">
                    <TrendingDown className="w-2.5 h-2.5 mr-0.5" />
                    {Math.round((totalFiltered / totalResults) * 100)}%
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}

        {/* قائمة الفلاتر */}
        <div className="p-3 space-y-2 max-h-96 overflow-y-auto">
          {/* مجموعة: الحضور الرقمي */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-1">
              الحضور الرقمي
            </p>
            <div className="space-y-1.5">
              {FILTER_DEFS.slice(0, 4).map(def => (
                <FilterCard key={def.key} def={def} filters={salesFilters} onUpdate={updateSalesFilter} />
              ))}
            </div>
          </div>

          <Separator className="my-2" />

          {/* مجموعة: التفاعل والسمعة */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-1">
              التفاعل والسمعة
            </p>
            <div className="space-y-1.5">
              {FILTER_DEFS.slice(4, 7).map(def => (
                <FilterCard key={def.key} def={def} filters={salesFilters} onUpdate={updateSalesFilter} />
              ))}
            </div>
          </div>

          <Separator className="my-2" />

          {/* مجموعة: فرص الإثراء */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-1">
              فرص الإثراء
            </p>
            <div className="space-y-1.5">
              {FILTER_DEFS.slice(7).map(def => (
                <FilterCard key={def.key} def={def} filters={salesFilters} onUpdate={updateSalesFilter} />
              ))}
            </div>
          </div>
        </div>

        {/* تذييل */}
        {activeSalesFiltersCount > 0 && (
          <div className="px-4 py-2.5 border-t border-border bg-amber-500/5">
            <div className="flex items-center gap-1.5 text-xs text-amber-400">
              <Zap className="w-3 h-3" />
              <span>{activeSalesFiltersCount} فلتر نشط — يعرض الفرص البيعية فقط</span>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
