/**
 * صفحة مقارنة العملاء - مقارنة بصرية جنباً إلى جنب
 * تعرض Screenshots المواقع + بيانات السوشيال ميديا + الدرجات
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import {
  Globe, Instagram, Twitter, Users, Star, TrendingUp,
  Plus, X, ExternalLink, Monitor, BarChart3, ChevronRight
} from "lucide-react";

// ===== مكوّن بطاقة عميل واحد في المقارنة =====
function LeadCompareCard({ leadId, onRemove }: { leadId: number; onRemove: () => void }) {
  const { data, isLoading } = trpc.leads.getFullDetails.useQuery({ id: leadId });

  if (isLoading) {
    return (
      <Card className="flex-1 min-w-[280px] max-w-[380px] bg-slate-900 border-slate-700">
        <CardContent className="p-4 space-y-3">
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const { lead, websiteAnalysis, socialAnalyses } = data;
  const instagram = socialAnalyses?.find(s => s.platform === "instagram");
  const twitter = socialAnalyses?.find(s => s.platform === "twitter");
  const tiktok = socialAnalyses?.find(s => s.platform === "tiktok");

  const websiteScore = websiteAnalysis?.overallScore ?? null;
  const instagramFollowers = instagram?.followersCount ?? 0;
  const twitterFollowers = twitter?.followersCount ?? 0;
  const tiktokFollowers = tiktok?.followersCount ?? 0;
  const totalFollowers = instagramFollowers + twitterFollowers + tiktokFollowers;

  const scoreColor = (score: number | null) => {
    if (!score) return "text-slate-500";
    if (score >= 7) return "text-emerald-400";
    if (score >= 5) return "text-amber-400";
    return "text-red-400";
  };

  const formatFollowers = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  return (
    <Card className="flex-1 min-w-[280px] max-w-[380px] bg-slate-900 border-slate-700 relative">
      {/* زر الإزالة */}
      <button
        onClick={onRemove}
        className="absolute top-2 left-2 z-10 w-6 h-6 rounded-full bg-red-500/20 hover:bg-red-500/40 flex items-center justify-center transition-colors"
      >
        <X className="w-3 h-3 text-red-400" />
      </button>

      <CardContent className="p-4 space-y-4">
        {/* Screenshot الموقع */}
        <div className="relative rounded-lg overflow-hidden bg-slate-800 border border-slate-700">
          {websiteAnalysis?.screenshotUrl ? (
            <img
              src={websiteAnalysis.screenshotUrl}
              alt={`موقع ${lead.companyName}`}
              className="w-full h-44 object-cover object-top"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-44 flex flex-col items-center justify-center gap-2 text-slate-600">
              <Monitor className="w-10 h-10" />
              <span className="text-xs">لا يوجد لقطة شاشة</span>
              {lead.website && (
                <span className="text-xs text-slate-500 truncate max-w-[200px]">{lead.website}</span>
              )}
            </div>
          )}
          {/* درجة الموقع */}
          {websiteScore !== null && (
            <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1">
              <Star className="w-3 h-3 text-amber-400" />
              <span className={`text-xs font-bold ${scoreColor(websiteScore)}`}>{websiteScore}/10</span>
            </div>
          )}
        </div>

        {/* اسم العميل والنوع */}
        <div>
          <h3 className="font-bold text-white text-sm leading-tight">{lead.companyName}</h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">{lead.businessType}</Badge>
            {lead.city && <span className="text-xs text-slate-500">{lead.city}</span>}
          </div>
        </div>

        {/* إحصائيات السوشيال ميديا */}
        <div className="grid grid-cols-3 gap-2">
          {/* إنستغرام */}
          <div className="bg-slate-800 rounded-lg p-2 text-center border border-slate-700">
            <Instagram className="w-4 h-4 text-pink-400 mx-auto mb-1" />
            <div className="text-xs font-bold text-white">
              {instagramFollowers > 0 ? formatFollowers(instagramFollowers) : "—"}
            </div>
            <div className="text-[10px] text-slate-500">إنستغرام</div>
          </div>
          {/* تويتر */}
          <div className="bg-slate-800 rounded-lg p-2 text-center border border-slate-700">
            <Twitter className="w-4 h-4 text-sky-400 mx-auto mb-1" />
            <div className="text-xs font-bold text-white">
              {twitterFollowers > 0 ? formatFollowers(twitterFollowers) : "—"}
            </div>
            <div className="text-[10px] text-slate-500">تويتر</div>
          </div>
          {/* تيك توك */}
          <div className="bg-slate-800 rounded-lg p-2 text-center border border-slate-700">
            <TrendingUp className="w-4 h-4 text-purple-400 mx-auto mb-1" />
            <div className="text-xs font-bold text-white">
              {tiktokFollowers > 0 ? formatFollowers(tiktokFollowers) : "—"}
            </div>
            <div className="text-[10px] text-slate-500">تيك توك</div>
          </div>
        </div>

        {/* إجمالي المتابعين + حالة التحليل */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs text-slate-400">
              {totalFollowers > 0 ? `${formatFollowers(totalFollowers)} متابع` : "لا يوجد بيانات"}
            </span>
          </div>
          <Badge
            variant="outline"
            className={`text-xs ${
              lead.analysisStatus === "completed"
                ? "border-emerald-600 text-emerald-400"
                : lead.analysisStatus === "analyzing"
                ? "border-amber-600 text-amber-400"
                : "border-slate-600 text-slate-400"
            }`}
          >
            {lead.analysisStatus === "completed" ? "مكتمل" :
             lead.analysisStatus === "analyzing" ? "جاري" : "معلق"}
          </Badge>
        </div>

        {/* روابط سريعة */}
        <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
          {lead.website && (
            <a
              href={lead.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              <Globe className="w-3 h-3" />
              الموقع
            </a>
          )}
          <a
            href={`/leads/${lead.id}`}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors mr-auto"
          >
            <ChevronRight className="w-3 h-3" />
            التفاصيل
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

// ===== مكوّن البحث عن عميل =====
function LeadSearchInput({ onAdd, existingIds }: { onAdd: (id: number) => void; existingIds: number[] }) {
  const [query, setQuery] = useState("");
  const { data: leads, isLoading } = trpc.leads.list.useQuery(
    { search: query },
    { enabled: query.length >= 2 }
  );

  const filtered = leads?.filter(l => !existingIds.includes(l.id)).slice(0, 8) ?? [];

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="ابحث عن عميل للإضافة..."
          className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 text-sm"
          dir="rtl"
        />
        <Plus className="w-4 h-4 text-slate-400 shrink-0" />
      </div>
      {query.length >= 2 && (
        <div className="absolute top-full mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
          {isLoading ? (
            <div className="p-3 text-sm text-slate-400 text-center">جاري البحث...</div>
          ) : filtered.length === 0 ? (
            <div className="p-3 text-sm text-slate-400 text-center">لا توجد نتائج</div>
          ) : (
            filtered.map(lead => (
              <button
                key={lead.id}
                onClick={() => { onAdd(lead.id); setQuery(""); }}
                className="w-full text-right px-3 py-2 hover:bg-slate-700 transition-colors flex items-center justify-between gap-2"
              >
                <div>
                  <div className="text-sm text-white font-medium">{lead.companyName}</div>
                  <div className="text-xs text-slate-400">{lead.businessType} · {lead.city}</div>
                </div>
                <Badge variant="outline" className="text-xs border-slate-600 text-slate-400 shrink-0">
                  {lead.analysisStatus === "completed" ? "محلل" : "معلق"}
                </Badge>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ===== الصفحة الرئيسية =====
export default function CompareLeads() {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [, navigate] = useLocation();

  const addLead = (id: number) => {
    if (selectedIds.length >= 4) return; // حد أقصى 4 عملاء
    if (!selectedIds.includes(id)) {
      setSelectedIds(prev => [...prev, id]);
    }
  };

  const removeLead = (id: number) => {
    setSelectedIds(prev => prev.filter(x => x !== id));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6" dir="rtl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-blue-400" />
          </div>
          <h1 className="text-xl font-bold text-white">مقارنة العملاء</h1>
          <Badge variant="outline" className="border-blue-600 text-blue-400 text-xs">
            {selectedIds.length}/4
          </Badge>
        </div>
        <p className="text-sm text-slate-400">
          قارن بين مواقع وحسابات السوشيال ميديا لعملاء متعددين جنباً إلى جنب
        </p>
      </div>

      {/* Search Bar */}
      <div className="mb-6 max-w-sm">
        <LeadSearchInput onAdd={addLead} existingIds={selectedIds} />
        {selectedIds.length >= 4 && (
          <p className="text-xs text-amber-400 mt-1">الحد الأقصى 4 عملاء في المقارنة</p>
        )}
      </div>

      {/* Empty State */}
      {selectedIds.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
            <BarChart3 className="w-8 h-8 text-slate-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-300 mb-2">ابدأ المقارنة</h3>
          <p className="text-sm text-slate-500 max-w-sm">
            ابحث عن عملاء وأضفهم للمقارنة. يمكنك مقارنة حتى 4 عملاء في نفس الوقت.
          </p>
        </div>
      )}

      {/* Comparison Grid */}
      {selectedIds.length > 0 && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {selectedIds.map(id => (
            <LeadCompareCard
              key={id}
              leadId={id}
              onRemove={() => removeLead(id)}
            />
          ))}

          {/* Add More Button */}
          {selectedIds.length < 4 && (
            <div className="flex-1 min-w-[200px] max-w-[280px] flex items-center justify-center">
              <div className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center w-full">
                <Plus className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-500">أضف عميلاً آخر</p>
                <p className="text-xs text-slate-600 mt-1">ابحث في الأعلى</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Summary Bar */}
      {selectedIds.length >= 2 && (
        <div className="mt-6 p-4 bg-slate-900 border border-slate-700 rounded-xl">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-semibold text-white">ملخص المقارنة</span>
          </div>
          <p className="text-xs text-slate-400">
            تم اختيار {selectedIds.length} عملاء للمقارنة. راجع Screenshots المواقع وبيانات السوشيال ميديا أعلاه لتحديد الفرص التسويقية.
          </p>
        </div>
      )}
    </div>
  );
}
