import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";
import {
  Phone, Globe, MapPin, Instagram, TrendingUp, AlertTriangle,
  CheckCircle2, XCircle, Star, BarChart2, Users, Activity,
} from "lucide-react";

const COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444"];
const STAGE_LABELS: Record<string, string> = {
  new: "جديد",
  contacted: "تم التواصل",
  interested: "مهتم",
  price_offer: "عرض سعر",
  meeting: "اجتماع",
  won: "مكتسب",
  lost: "خسارة",
};
const STAGE_COLORS: Record<string, string> = {
  new: "#6366f1",
  contacted: "#3b82f6",
  interested: "#22c55e",
  price_offer: "#f59e0b",
  meeting: "#8b5cf6",
  won: "#10b981",
  lost: "#ef4444",
};

function MetricCard({
  icon: Icon,
  label,
  value,
  total,
  rate,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  total: number;
  rate: number;
  color: string;
}) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between mb-3">
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon className="w-4 h-4" />
          </div>
          <span className={`text-2xl font-bold ${rate >= 70 ? "text-green-400" : rate >= 40 ? "text-yellow-400" : "text-red-400"}`}>
            {rate}%
          </span>
        </div>
        <p className="text-sm text-muted-foreground mb-1">{label}</p>
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
          <span>{value.toLocaleString()} من {total.toLocaleString()}</span>
          {rate >= 70 ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
          ) : rate >= 40 ? (
            <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />
          ) : (
            <XCircle className="w-3.5 h-3.5 text-red-400" />
          )}
        </div>
        <Progress value={rate} className="h-1.5" />
      </CardContent>
    </Card>
  );
}

function CompletenessGauge({ score }: { score: number }) {
  const color = score >= 70 ? "#22c55e" : score >= 40 ? "#f59e0b" : "#ef4444";
  const label = score >= 70 ? "ممتازة" : score >= 40 ? "جيدة" : "تحتاج تحسين";
  return (
    <div className="flex flex-col items-center justify-center py-4">
      <div className="relative w-32 h-32">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle cx="60" cy="60" r="50" fill="none" stroke="#1f2937" strokeWidth="12" />
          <circle
            cx="60" cy="60" r="50" fill="none"
            stroke={color} strokeWidth="12"
            strokeDasharray={`${(score / 100) * 314} 314`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold" style={{ color }}>{score}%</span>
        </div>
      </div>
      <p className="text-sm text-muted-foreground mt-2">درجة الاكتمال</p>
      <Badge
        className="mt-1 text-xs"
        style={{ backgroundColor: `${color}20`, color, borderColor: `${color}40` }}
        variant="outline"
      >
        {label}
      </Badge>
    </div>
  );
}

export default function DataQuality() {
  const { data: stats, isLoading } = trpc.dataQuality.stats.useQuery();

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!stats || stats.total === 0) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[400px] text-center">
        <Users className="w-16 h-16 text-muted-foreground mb-4 opacity-40" />
        <h3 className="text-xl font-semibold mb-2">لا توجد بيانات بعد</h3>
        <p className="text-muted-foreground">أضف عملاء أولاً لعرض تقرير جودة البيانات</p>
      </div>
    );
  }

  const qualityDist = [
    { name: "ممتاز (5-6 حقول)", value: stats.qualityDistribution.excellent, color: "#22c55e" },
    { name: "جيد (3-4 حقول)", value: stats.qualityDistribution.good, color: "#3b82f6" },
    { name: "مقبول (1-2 حقول)", value: stats.qualityDistribution.fair, color: "#f59e0b" },
    { name: "ضعيف (0 حقول)", value: stats.qualityDistribution.poor, color: "#ef4444" },
  ].filter(d => d.value > 0);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto" dir="rtl">
      {/* الرأس */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">تقرير جودة البيانات</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            تحليل شامل لاكتمال بيانات {stats.total.toLocaleString()} عميل
          </p>
        </div>
        <Badge variant="outline" className="text-base px-4 py-1.5 border-border">
          {stats.total.toLocaleString()} عميل
        </Badge>
      </div>

      {/* درجة الاكتمال + توزيع الجودة */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <CompletenessGauge score={stats.completeness} />
          </CardContent>
        </Card>

        <Card className="bg-card border-border md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">توزيع جودة البيانات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 h-40">
              <ResponsiveContainer width="50%" height="100%">
                <PieChart>
                  <Pie data={qualityDist} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={2}>
                    {qualityDist.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => [`${v} عميل`, ""]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-2 flex-1">
                {qualityDist.map((d, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-xs text-muted-foreground flex-1">{d.name}</span>
                    <span className="text-sm font-semibold">{d.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* مؤشرات الحقول */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">نسبة اكتمال الحقول الرئيسية</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard
            icon={Phone}
            label="رقم الهاتف"
            value={stats.total}
            total={stats.total}
            rate={stats.phoneRate}
            color="bg-green-500/10 text-green-400"
          />
          <MetricCard
            icon={Globe}
            label="الموقع الإلكتروني"
            value={stats.withWebsite}
            total={stats.total}
            rate={stats.websiteRate}
            color="bg-blue-500/10 text-blue-400"
          />
          <MetricCard
            icon={MapPin}
            label="Google Maps"
            value={stats.withGoogleMaps}
            total={stats.total}
            rate={stats.googleMapsRate}
            color="bg-red-500/10 text-red-400"
          />
          <MetricCard
            icon={Activity}
            label="واتساب مؤكد"
            value={stats.withWhatsapp}
            total={stats.total}
            rate={stats.whatsappRate}
            color="bg-emerald-500/10 text-emerald-400"
          />
          <MetricCard
            icon={Instagram}
            label="إنستجرام"
            value={stats.withInstagram}
            total={stats.total}
            rate={stats.instagramRate}
            color="bg-pink-500/10 text-pink-400"
          />
          <MetricCard
            icon={Star}
            label="سناب شات"
            value={stats.withSnapchat}
            total={stats.total}
            rate={stats.snapchatRate}
            color="bg-yellow-500/10 text-yellow-400"
          />
          <MetricCard
            icon={TrendingUp}
            label="تيك توك"
            value={stats.withTiktok}
            total={stats.total}
            rate={stats.tiktokRate}
            color="bg-purple-500/10 text-purple-400"
          />
          <MetricCard
            icon={BarChart2}
            label="تحليل مكتمل"
            value={stats.withAnalysis}
            total={stats.total}
            rate={stats.analysisRate}
            color="bg-cyan-500/10 text-cyan-400"
          />
        </div>
      </div>

      {/* نسبة الأرقام حسب المدينة */}
      {stats.phoneByCity.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">نسبة أرقام الهاتف حسب المدينة</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.phoneByCity} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="city" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} unit="%" domain={[0, 100]} />
                <Tooltip
                  formatter={(v: number) => [`${v}%`, "نسبة الأرقام"]}
                  contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: "8px" }}
                />
                <Bar dataKey="phoneRate" fill="#22c55e" radius={[4, 4, 0, 0]} name="نسبة الأرقام" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* الإضافات الشهرية */}
      {stats.monthlyAdded.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">الإضافات الشهرية (آخر 12 شهر)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={stats.monthlyAdded} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#9ca3af" }} />
                <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: "8px" }}
                />
                <Legend />
                <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} name="إجمالي العملاء" />
                <Line type="monotone" dataKey="withPhone" stroke="#22c55e" strokeWidth={2} dot={false} name="بأرقام هواتف" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* توزيع المراحل + أفضل المدن */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* توزيع المراحل */}
        {stats.byStage.length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">توزيع مراحل العملاء</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {stats.byStage.map((row) => (
                <div key={row.stage} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-24 text-right shrink-0">
                    {STAGE_LABELS[row.stage] ?? row.stage}
                  </span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.round((row.count / stats.total) * 100)}%`,
                        backgroundColor: STAGE_COLORS[row.stage] ?? "#6b7280",
                      }}
                    />
                  </div>
                  <span className="text-xs font-medium w-12 text-left shrink-0">
                    {row.count.toLocaleString()}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* أفضل المدن */}
        {stats.byCity.length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">أفضل المدن (بيانات + أرقام)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {stats.byCity.slice(0, 7).map((row) => (
                <div key={row.city} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-20 text-right shrink-0 truncate">
                    {row.city}
                  </span>
                  <div className="flex-1 relative h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="absolute inset-y-0 right-0 bg-blue-500/30 rounded-full"
                      style={{ width: `${Math.round((row.count / (stats.byCity[0]?.count ?? 1)) * 100)}%` }}
                    />
                    <div
                      className="absolute inset-y-0 right-0 bg-green-500 rounded-full"
                      style={{ width: `${Math.round((row.count / (stats.byCity[0]?.count ?? 1)) * 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-xs font-medium text-green-400">{row.count}</span>
                    <span className="text-xs text-muted-foreground">/</span>
                    <span className="text-xs text-muted-foreground">{row.count}</span>
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground pt-1">
                <span className="inline-block w-2 h-2 rounded-full bg-green-500 ml-1" />أرقام هواتف
                <span className="inline-block w-2 h-2 rounded-full bg-blue-500/30 mr-3 ml-1" />إجمالي
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* تنبيه العملاء بدون أرقام */}
      {stats.missingPhone > 0 && (
        <Card className="bg-orange-500/5 border-orange-500/20">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-orange-300">
                  {stats.missingPhone.toLocaleString()} عميل بدون رقم هاتف
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  يمثلون {100 - stats.phoneRate}% من إجمالي العملاء — يُنصح بمراجعتهم وتحديث أرقامهم من مركز البحث
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
