import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, CartesianGrid
} from "recharts";
import {
  Users, MapPin, TrendingUp, Clock, Plus, ArrowLeft, CheckCircle2,
  MessageSquare, Zap, Activity, Target, Phone, Globe, Star,
  RefreshCw, ChevronRight, Send
} from "lucide-react";
import { Link, useLocation } from "wouter";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: stats, isLoading: statsLoading } = trpc.leads.stats.useQuery();
  const { data: zones, isLoading: zonesLoading } = trpc.zones.list.useQuery();
  const { data: leads, isLoading: leadsLoading } = trpc.leads.list.useQuery({});
  const { data: dmStats } = trpc.digitalMarketing.getOverviewStats.useQuery();
  const { data: dailyMsgs } = trpc.digitalMarketing.getDailyMessageStats.useQuery();
  const { data: whatchimpStats } = trpc.whatchimp.getWeeklyStats.useQuery();
  const seedZones = trpc.zones.seed.useMutation();
  const utils = trpc.useUtils();

  const handleSeedZones = async () => {
    await seedZones.mutateAsync();
    utils.zones.list.invalidate();
  };

  const completedZones = zones?.filter(z => z.status === "completed").length ?? 0;
  const totalZones = zones?.length ?? 0;
  const analyzedLeads = stats?.analyzed ?? 0;
  const totalLeads = stats?.total ?? 0;
  const recentLeads = leads?.slice(0, 6) ?? [];
  const cityData = (stats?.byCity ?? []).map((c: any) => ({ name: c.city?.substring(0, 8) ?? "أخرى", value: Number(c.count) }));
  const dmData = dmStats as any;
  const unreadChats = Number(dmData?.chats?.totalUnread ?? 0);
  const hotLeads = Number(dmData?.leads?.hotLeads ?? 0);

  return (
    <div className="space-y-5 max-w-7xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            لوحة التحكم
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">نظرة شاملة على أداء النظام</p>
        </div>
        <Button size="sm" onClick={() => setLocation("/leads/add")} className="gap-1.5 h-8 text-xs">
          <Plus className="w-3.5 h-3.5" />
          إضافة عميل
        </Button>
      </div>

      {/* بطاقات الإحصاء */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          {
            label: "إجمالي العملاء",
            value: statsLoading ? "..." : totalLeads,
            sub: `${analyzedLeads} تم تحليلهم`,
            icon: Users,
            color: "text-blue-400",
            bg: "bg-blue-500/10",
            path: "/leads",
          },
          {
            label: "عملاء ساخنون",
            value: hotLeads,
            sub: "أولوية عالية",
            icon: Zap,
            color: "text-red-400",
            bg: "bg-red-500/10",
            path: "/digital-marketing",
          },
          {
            label: "رسائل غير مقروءة",
            value: unreadChats,
            sub: "تحتاج رد",
            icon: MessageSquare,
            color: "text-green-400",
            bg: "bg-green-500/10",
            path: "/chats",
          },
          {
            label: "المناطق",
            value: zonesLoading ? "..." : totalZones,
            sub: `${completedZones} مكتملة`,
            icon: MapPin,
            color: "text-purple-400",
            bg: "bg-purple-500/10",
            path: "/zones",
          },
          {
            label: "أُرسل لـ Whatchimp",
            value: whatchimpStats ? String(whatchimpStats.thisWeek) : "...",
            sub: whatchimpStats
              ? whatchimpStats.growth > 0
                ? `↑ ${whatchimpStats.growth}% عن الأسبوع الماضي`
                : whatchimpStats.growth < 0
                ? `↓ ${Math.abs(whatchimpStats.growth)}% عن الأسبوع الماضي`
                : `إجمالي: ${whatchimpStats.total} عميل`
              : "هذا الأسبوع",
            icon: Send,
            color: "text-emerald-400",
            bg: "bg-emerald-500/10",
            path: "/leads",
          },
        ].map((stat, i) => (
          <Card
            key={i}
            className="cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all"
            onClick={() => setLocation(stat.path)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${stat.bg}`}>
                  <stat.icon className={`w-4.5 h-4.5 ${stat.color}`} />
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40" />
              </div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs font-medium mt-0.5">{stat.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{stat.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* شريط التقدم */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm font-semibold">تقدم جمع البيانات</p>
              <p className="text-xs text-muted-foreground">جمع بيانات بلا حد من جميع المنصات</p>
            </div>
            <span className="text-xl font-bold text-primary">{totalLeads.toLocaleString('ar-SA')}</span>
          </div>
          <Progress value={totalLeads > 0 ? Math.min(100, (totalLeads / 1000) * 100) : 0} className="h-2" />
          <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
            <span>0</span><span>250</span><span>500</span><span>750</span><span>∞</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* رسم بياني للمدن */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              توزيع العملاء بالمدينة
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cityData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={cityData} layout="vertical" margin={{ top: 0, right: 5, left: -10, bottom: 0 }}>
                  <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} width={70} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-40 flex flex-col items-center justify-center text-muted-foreground gap-2">
                <BarChart className="w-8 h-8 opacity-30" />
                <p className="text-xs">لا توجد بيانات بعد</p>
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setLocation("/leads/add")}>
                  أضف أول عميل
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* نشاط الرسائل */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              نشاط الرسائل (آخر 14 يوم)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(dailyMsgs ?? []).length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={dailyMsgs ?? []} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="msgGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                  <Area type="monotone" dataKey="total" name="رسائل" stroke="hsl(var(--primary))" fill="url(#msgGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-40 flex flex-col items-center justify-center text-muted-foreground gap-2">
                <MessageSquare className="w-8 h-8 opacity-30" />
                <p className="text-xs">لا يوجد نشاط رسائل بعد</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* المناطق */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                حالة المناطق
              </CardTitle>
              <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 text-primary" onClick={() => setLocation("/zones")}>
                عرض الكل <ArrowLeft className="w-3 h-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {totalZones === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 gap-3">
                <MapPin className="w-8 h-8 text-muted-foreground opacity-30" />
                <p className="text-xs text-muted-foreground">لم يتم إنشاء المناطق بعد</p>
                <Button
                  size="sm" variant="outline" className="text-xs h-7"
                  onClick={handleSeedZones}
                  disabled={seedZones.isPending}
                >
                  {seedZones.isPending ? "جاري الإنشاء..." : "إنشاء 22 منطقة تلقائياً"}
                </Button>
              </div>
            ) : (
              <div className="space-y-2 max-h-44 overflow-y-auto">
                {zones?.slice(0, 7).map((zone) => (
                  <div key={zone.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-accent/50 transition-colors">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      zone.status === "completed" ? "bg-green-500" :
                      zone.status === "in_progress" ? "bg-yellow-500 animate-pulse" : "bg-muted-foreground/30"
                    }`} />
                    <span className="text-xs flex-1 truncate">{zone.name}</span>
                    <span className="text-[10px] text-muted-foreground">{zone.leadsCount}/{zone.targetLeads}</span>
                    <div className="w-14 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(100, (zone.leadsCount / zone.targetLeads) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* آخر العملاء */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                آخر العملاء المضافين
              </CardTitle>
              <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 text-primary" onClick={() => setLocation("/leads")}>
                عرض الكل <ArrowLeft className="w-3 h-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentLeads.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2">
                <Users className="w-8 h-8 text-muted-foreground opacity-30" />
                <p className="text-xs text-muted-foreground">لا توجد عملاء بعد</p>
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setLocation("/leads/add")}>
                  أضف أول عميل
                </Button>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-44 overflow-y-auto">
                {recentLeads.map((lead) => {
                  const score = lead.leadPriorityScore;
                  const scoreColor = score && score >= 8 ? "text-green-400" : score && score >= 6 ? "text-yellow-400" : "text-muted-foreground";
                  return (
                    <div
                      key={lead.id}
                      className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={() => setLocation(`/leads/${lead.id}`)}
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                        {lead.companyName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{lead.companyName}</p>
                        <p className="text-[10px] text-muted-foreground">{lead.businessType} · {lead.city}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {lead.analysisStatus === "completed" && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                        )}
                        {score && (
                          <span className={`text-xs font-bold ${scoreColor}`}>{score.toFixed(1)}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* روابط سريعة */}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs font-semibold text-muted-foreground mb-3">وصول سريع</p>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {[
              { label: "تحليل التسويق", icon: TrendingUp, path: "/digital-marketing", color: "text-primary" },
              { label: "المحادثات", icon: MessageSquare, path: "/chats", color: "text-green-400" },
              { label: "إرسال جماعي", icon: Zap, path: "/bulk-whatsapp", color: "text-yellow-400" },
              { label: "بحث سريع", icon: Target, path: "/search", color: "text-blue-400" },
              { label: "رفع بيانات", icon: Plus, path: "/bulk-import", color: "text-purple-400" },
              { label: "الموظفون", icon: Star, path: "/employee-performance", color: "text-orange-400" },
            ].map((item) => (
              <button
                key={item.path}
                onClick={() => setLocation(item.path)}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-accent/60 transition-colors text-center"
              >
                <item.icon className={`w-5 h-5 ${item.color}`} />
                <span className="text-[10px] text-muted-foreground leading-tight">{item.label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
