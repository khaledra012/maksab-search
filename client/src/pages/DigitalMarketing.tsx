import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  TrendingUp, Users, MessageSquare, Target, Globe, Instagram,
  Phone, BarChart2, Zap, AlertTriangle, CheckCircle2, XCircle,
  Star, ArrowUp, ArrowDown, Minus, RefreshCw, Brain, Lightbulb,
  Activity, PieChart, LineChart, BarChart, Megaphone, Eye,
  Clock, Award, ChevronRight, ExternalLink, Wifi
} from "lucide-react";
import {
  BarChart as RechartsBar,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart as RechartsLine,
  Line,
  PieChart as RechartsPie,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from "recharts";

// ألوان الرسوم البيانية
const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#84cc16"];

// مكون درجة الأداء
function ScoreRing({ score, label, color }: { score: number; label: string; color: string }) {
  const pct = Math.min(100, Math.max(0, score * 10));
  const scoreColor = score >= 8 ? "text-green-400" : score >= 6 ? "text-yellow-400" : "text-red-400";
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-16 h-16">
        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/20" />
          <circle
            cx="32" cy="32" r="26" fill="none" strokeWidth="6"
            stroke={score >= 8 ? "#22c55e" : score >= 6 ? "#f59e0b" : "#ef4444"}
            strokeDasharray={`${pct * 1.634} 163.4`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-lg font-bold ${scoreColor}`}>{score?.toFixed(1) ?? "—"}</span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground text-center">{label}</span>
    </div>
  );
}

// مكون بطاقة إحصاء
function StatCard({ title, value, sub, icon: Icon, color, trend }: {
  title: string; value: string | number; sub?: string;
  icon: any; color: string; trend?: "up" | "down" | "neutral";
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <p className="text-xs text-muted-foreground font-medium">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
        {trend && (
          <div className="mt-2 flex items-center gap-1">
            {trend === "up" && <ArrowUp className="w-3 h-3 text-green-400" />}
            {trend === "down" && <ArrowDown className="w-3 h-3 text-red-400" />}
            {trend === "neutral" && <Minus className="w-3 h-3 text-muted-foreground" />}
          </div>
        )}
      </CardContent>
      <div className={`absolute inset-y-0 right-0 w-1 ${color.replace("bg-", "bg-").replace("/10", "/60")}`} />
    </Card>
  );
}

// مكون شريط الفجوة
function GapBar({ label, count, total, icon: Icon, color }: {
  label: string; count: number; total: number; icon: any; color: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${color}`} />
          <span className="font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`font-bold ${color}`}>{count}</span>
          <span className="text-muted-foreground text-xs">({pct}%)</span>
        </div>
      </div>
      <Progress value={pct} className="h-2" />
    </div>
  );
}

// ===== مكون تبويب الحملات =====
function CampaignsTab() {
  const { data: stats, isLoading } = trpc.campaigns.stats.useQuery();
  const { data: campaigns, refetch } = trpc.campaigns.list.useQuery();
  const createCampaign = trpc.campaigns.create.useMutation({
    onSuccess: () => { toast.success("تم إنشاء الحملة"); refetch(); },
    onError: (e) => toast.error("خطأ: " + e.message),
  });
  const deleteCampaign = trpc.campaigns.delete.useMutation({
    onSuccess: () => { toast.success("تم حذف الحملة"); refetch(); },
    onError: (e) => toast.error("خطأ: " + e.message),
  });

  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const statusLabels: Record<string, { label: string; color: string }> = {
    draft: { label: "مسودة", color: "bg-gray-500/10 text-gray-400" },
    running: { label: "جارية", color: "bg-blue-500/10 text-blue-400" },
    completed: { label: "مكتملة", color: "bg-green-500/10 text-green-400" },
    paused: { label: "موقوفة", color: "bg-yellow-500/10 text-yellow-400" },
    failed: { label: "فشلت", color: "bg-red-500/10 text-red-400" },
  };

  if (isLoading) return <div className="flex items-center justify-center h-32"><RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  const s = stats as any;
  const chartData = (s?.chartData ?? []) as any[];

  return (
    <div className="space-y-4">
      {/* بطاقات الإحصاء */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">إجمالي الحملات</p>
          <p className="text-2xl font-bold">{s?.total ?? 0}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">الحملات المكتملة</p>
          <p className="text-2xl font-bold text-green-400">{s?.completed ?? 0}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">إجمالي الرسائل المرسلة</p>
          <p className="text-2xl font-bold text-blue-400">{s?.totalSent ?? 0}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">متوسط معدل الاستجابة</p>
          <p className="text-2xl font-bold text-purple-400">{s?.avgResponseRate ?? 0}%</p>
        </CardContent></Card>
      </div>

      {/* رسم بياني */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-primary" />
              أداء الحملات (آخر 10 حملات)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <RechartsBar data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                <Legend formatter={(v) => <span style={{ fontSize: 11 }}>{v}</span>} />
                <Bar dataKey="sent" name="مرسلة" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="replied" name="ردود" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="failed" name="فشلت" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </RechartsBar>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* قائمة الحملات */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-primary" />
              قائمة الحملات
            </CardTitle>
            <Button size="sm" onClick={() => setShowForm(!showForm)} className="gap-1">
              <Zap className="w-3 h-3" />
              حملة جديدة
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {showForm && (
            <div className="rounded-lg border border-dashed border-primary/30 p-3 space-y-2 bg-primary/5">
              <input
                className="w-full bg-transparent border border-border rounded-lg px-3 py-2 text-sm"
                placeholder="اسم الحملة..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <input
                className="w-full bg-transparent border border-border rounded-lg px-3 py-2 text-sm"
                placeholder="وصف الحملة (اختياري)..."
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => {
                  if (!newName.trim()) return toast.error("أدخل اسم الحملة");
                  createCampaign.mutate({ name: newName, description: newDesc || undefined });
                  setNewName(""); setNewDesc(""); setShowForm(false);
                }} disabled={createCampaign.isPending}>
                  {createCampaign.isPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : "إنشاء"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>إلغاء</Button>
              </div>
            </div>
          )}
          {!campaigns || campaigns.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Megaphone className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">لا توجد حملات بعد. أنشئ أول حملة!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {campaigns.map((c: any) => {
                const st = statusLabels[c.status] ?? statusLabels.draft;
                const rr = c.totalSent > 0 ? Math.round(c.totalReplied / c.totalSent * 100) : 0;
                return (
                  <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm truncate">{c.name}</span>
                        <Badge className={`text-xs px-1.5 py-0 ${st.color}`}>{st.label}</Badge>
                      </div>
                      {c.description && <p className="text-xs text-muted-foreground truncate">{c.description}</p>}
                      <div className="flex items-center gap-4 mt-1.5">
                        <span className="text-xs text-muted-foreground">مرسلة: <span className="text-foreground font-medium">{c.totalSent}</span></span>
                        <span className="text-xs text-muted-foreground">ردود: <span className="text-green-400 font-medium">{c.totalReplied}</span></span>
                        <span className="text-xs text-muted-foreground">معدل: <span className="text-purple-400 font-medium">{rr}%</span></span>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 w-7 p-0"
                      onClick={() => deleteCampaign.mutate({ id: c.id })}>
                      <XCircle className="w-4 h-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function DigitalMarketing() {
  const [selectedType, setSelectedType] = useState<string>("all");
  const [aiInsight, setAiInsight] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);

  // جلب البيانات
  const { data: overview, isLoading: loadingOverview, refetch: refetchOverview } = trpc.digitalMarketing.getOverviewStats.useQuery();
  const { data: dailyStats, isLoading: loadingDaily } = trpc.digitalMarketing.getDailyMessageStats.useQuery();
  const { data: gaps, isLoading: loadingGaps } = trpc.digitalMarketing.getMarketingGaps.useQuery();
  const { data: topLeads, isLoading: loadingLeads } = trpc.digitalMarketing.getTopLeads.useQuery({ limit: 10 });
  const { data: campaignStats } = trpc.digitalMarketing.getCampaignStats.useQuery();

  const generateInsight = trpc.digitalMarketing.generateMarketInsight.useMutation({
    onSuccess: (data) => {
      setAiInsight(typeof data.insight === 'string' ? data.insight : "");
      setIsGenerating(false);
    },
    onError: (e) => {
      toast.error("خطأ في توليد التحليل: " + e.message);
      setIsGenerating(false);
    },
  });

  const handleGenerateInsight = () => {
    setIsGenerating(true);
    setAiInsight("");
    generateInsight.mutate({
      businessType: selectedType !== "all" ? selectedType : undefined,
    });
  };

  const leads = (overview as any)?.leads ?? {};
  const chats = (overview as any)?.chats ?? {};
  const messages = (overview as any)?.messages ?? {};
  const businessTypes = (overview as any)?.businessTypes ?? [];
  const zones = (overview as any)?.zones ?? [];
  const gapsData = gaps as any;
  const total = Number(leads.totalLeads ?? 0);

  // بيانات الرسم البياني للأنواع
  const typeChartData = businessTypes.map((t: any) => ({
    name: t.businessType?.substring(0, 8) ?? "أخرى",
    عدد: Number(t.count),
  }));

  // بيانات الفجوات الرقمية
  const gapsChartData = gapsData ? [
    { name: "بدون موقع", value: Number(gapsData.noWebsite ?? 0), color: "#ef4444" },
    { name: "بدون إنستغرام", value: Number(gapsData.noInstagram ?? 0), color: "#f97316" },
    { name: "بدون واتساب", value: Number(gapsData.noWhatsapp ?? 0), color: "#f59e0b" },
    { name: "بدون تويتر", value: Number(gapsData.noTwitter ?? 0), color: "#8b5cf6" },
    { name: "بدون سناب", value: Number(gapsData.noSnapchat ?? 0), color: "#06b6d4" },
    { name: "بدون تيك توك", value: Number(gapsData.noTiktok ?? 0), color: "#22c55e" },
  ] : [];

  // توزيع الأولوية
  const priorityData = [
    { name: "عملاء ساخنون (8+)", value: Number(leads.hotLeads ?? 0), color: "#ef4444" },
    { name: "عملاء دافئون (6-8)", value: Number(leads.warmLeads ?? 0), color: "#f59e0b" },
    { name: "عملاء باردون (<6)", value: Number(leads.coldLeads ?? 0), color: "#6366f1" },
  ];

  if (loadingOverview) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-muted-foreground">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>جاري تحميل بيانات التسويق...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" />
            تحليل التسويق الرقمي
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            لوحة تحكم شاملة لتحليل أداء التسويق الرقمي وفرص السوق
          </p>
        </div>
        <Button onClick={() => refetchOverview()} variant="outline" size="sm" className="gap-2">
          <RefreshCw className="w-4 h-4" />
          تحديث
        </Button>
      </div>

      {/* بطاقات الإحصاء الرئيسية */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="إجمالي العملاء"
          value={total}
          sub={`${Number(leads.analyzedLeads ?? 0)} تم تحليلهم`}
          icon={Users}
          color="bg-blue-500/10 text-blue-400"
          trend="up"
        />
        <StatCard
          title="عملاء ساخنون"
          value={Number(leads.hotLeads ?? 0)}
          sub={`${total > 0 ? Math.round(Number(leads.hotLeads ?? 0) / total * 100) : 0}% من الإجمالي`}
          icon={Zap}
          color="bg-red-500/10 text-red-400"
          trend="up"
        />
        <StatCard
          title="المحادثات النشطة"
          value={Number(chats.totalChats ?? 0)}
          sub={`${Number(chats.totalUnread ?? 0)} رسالة غير مقروءة`}
          icon={MessageSquare}
          color="bg-green-500/10 text-green-400"
          trend="neutral"
        />
        <StatCard
          title="جهات الاتصال"
          value={Number(messages.uniqueContacts ?? 0)}
          sub="آخر 30 يوم"
          icon={Phone}
          color="bg-purple-500/10 text-purple-400"
          trend="up"
        />
      </div>

      {/* تبويبات التحليل */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
          <TabsTrigger value="gaps">الفجوات الرقمية</TabsTrigger>
          <TabsTrigger value="performance">الأداء</TabsTrigger>
          <TabsTrigger value="campaigns">الحملات</TabsTrigger>
          <TabsTrigger value="ai">تحليل AI</TabsTrigger>
        </TabsList>

        {/* تبويب نظرة عامة */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* توزيع أنواع الأعمال */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart className="w-4 h-4 text-primary" />
                  توزيع أنواع الأعمال
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <RechartsBar data={typeChartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                    />
                    <Bar dataKey="عدد" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </RechartsBar>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* توزيع الأولوية */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  توزيع العملاء بالأولوية
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center">
                  <ResponsiveContainer width="100%" height={200}>
                    <RechartsPie>
                      <Pie
                        data={priorityData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {priorityData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                      />
                      <Legend
                        formatter={(value) => <span style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>{value}</span>}
                      />
                    </RechartsPie>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* الحضور الرقمي */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary" />
                الحضور الرقمي للعملاء
              </CardTitle>
              <CardDescription className="text-xs">نسبة العملاء الذين لديهم حضور على كل منصة</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "موقع إلكتروني", count: Number(leads.hasWebsite ?? 0), icon: Globe, color: "text-blue-400" },
                  { label: "إنستغرام", count: Number(leads.hasInstagram ?? 0), icon: Instagram, color: "text-pink-400" },
                  { label: "واتساب", count: Number(leads.hasWhatsapp ?? 0), icon: Phone, color: "text-green-400" },
                  { label: "AI مفعّل", count: Number(chats.aiEnabled ?? 0), icon: Brain, color: "text-purple-400" },
                ].map((item) => {
                  const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
                  return (
                    <div key={item.label} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <item.icon className={`w-4 h-4 ${item.color}`} />
                          <span className="text-xs font-medium">{item.label}</span>
                        </div>
                        <span className={`text-sm font-bold ${item.color}`}>{pct}%</span>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                      <p className="text-xs text-muted-foreground">{item.count} من {total}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* أفضل المناطق */}
          {zones.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  توزيع العملاء بالمناطق
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {zones.slice(0, 6).map((z: any, i: number) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-xs font-medium">{z.zoneName}</span>
                          <span className="text-xs text-muted-foreground">{z.count}</span>
                        </div>
                        <Progress value={Math.round(z.count / total * 100)} className="h-1.5" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* تبويب الفجوات الرقمية */}
        <TabsContent value="gaps" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* الفجوات الرقمية */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-400" />
                  الفجوات التسويقية الرقمية
                </CardTitle>
                <CardDescription className="text-xs">عدد العملاء الذين يفتقرون لكل قناة رقمية</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {gapsData && [
                  { label: "بدون موقع إلكتروني", count: Number(gapsData.noWebsite ?? 0), icon: Globe, color: "text-red-400" },
                  { label: "بدون إنستغرام", count: Number(gapsData.noInstagram ?? 0), icon: Instagram, color: "text-orange-400" },
                  { label: "بدون واتساب", count: Number(gapsData.noWhatsapp ?? 0), icon: Phone, color: "text-yellow-400" },
                  { label: "بدون تويتر/X", count: Number(gapsData.noTwitter ?? 0), icon: Megaphone, color: "text-blue-400" },
                  { label: "بدون سناب شات", count: Number(gapsData.noSnapchat ?? 0), icon: Eye, color: "text-purple-400" },
                  { label: "بدون تيك توك", count: Number(gapsData.noTiktok ?? 0), icon: Activity, color: "text-pink-400" },
                ].map((item) => (
                  <GapBar key={item.label} {...item} total={total} />
                ))}
              </CardContent>
            </Card>

            {/* رسم بياني للفجوات */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-primary" />
                  توزيع الفجوات الرقمية
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <RechartsPie>
                    <Pie
                      data={gapsChartData.filter(g => g.value > 0)}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                      labelLine={false}
                    >
                      {gapsChartData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                    />
                  </RechartsPie>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* أفضل العملاء بالأولوية */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-400" />
                أفضل العملاء بالأولوية التسويقية
              </CardTitle>
              <CardDescription className="text-xs">العملاء الأعلى درجةً والأكثر استعداداً للتحويل</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(topLeads as any[] ?? []).slice(0, 8).map((lead: any, i: number) => {
                  const score = Number(lead.leadPriorityScore ?? 0);
                  const scoreColor = score >= 8 ? "text-green-400 bg-green-500/10" : score >= 6 ? "text-yellow-400 bg-yellow-500/10" : "text-red-400 bg-red-500/10";
                  return (
                    <div key={lead.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors">
                      <span className="text-xs text-muted-foreground w-5 text-center">{i + 1}</span>
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${scoreColor}`}>
                        {score.toFixed(1)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{lead.companyName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-[10px] h-4 px-1">{lead.businessType}</Badge>
                          {lead.city && <span className="text-[10px] text-muted-foreground">{lead.city}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {lead.website && <Globe className="w-3.5 h-3.5 text-blue-400" />}
                        {lead.instagramUrl && <Instagram className="w-3.5 h-3.5 text-pink-400" />}
                        {lead.hasWhatsapp && <Phone className="w-3.5 h-3.5 text-green-400" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* تبويب الأداء */}
        <TabsContent value="performance" className="space-y-4">
          {/* الرسائل اليومية */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <LineChart className="w-4 h-4 text-primary" />
                نشاط الرسائل آخر 14 يوم
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={dailyStats ?? []} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                  />
                  <Area type="monotone" dataKey="total" name="إجمالي الرسائل" stroke="#6366f1" fill="url(#colorTotal)" strokeWidth={2} />
                  <Area type="monotone" dataKey="uniqueContacts" name="جهات اتصال فريدة" stroke="#22c55e" fill="none" strokeWidth={2} strokeDasharray="5 5" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* مؤشرات الأداء الرئيسية */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                title: "معدل التحليل",
                value: `${total > 0 ? Math.round(Number(leads.analyzedLeads ?? 0) / total * 100) : 0}%`,
                desc: "من العملاء تم تحليلهم",
                icon: BarChart2,
                color: "text-blue-400",
              },
              {
                title: "معدل الحضور الرقمي",
                value: `${total > 0 ? Math.round(Number(leads.hasWebsite ?? 0) / total * 100) : 0}%`,
                desc: "لديهم موقع إلكتروني",
                icon: Globe,
                color: "text-green-400",
              },
              {
                title: "معدل واتساب",
                value: `${total > 0 ? Math.round(Number(leads.hasWhatsapp ?? 0) / total * 100) : 0}%`,
                desc: "لديهم واتساب",
                icon: Phone,
                color: "text-emerald-400",
              },
              {
                title: "الصفقات المغلقة",
                value: Number(chats.closedDeals ?? 0),
                desc: "محادثة مغلقة",
                icon: Award,
                color: "text-yellow-400",
              },
            ].map((kpi) => (
              <Card key={kpi.title}>
                <CardContent className="p-4 text-center space-y-2">
                  <kpi.icon className={`w-6 h-6 mx-auto ${kpi.color}`} />
                  <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
                  <p className="text-xs text-muted-foreground">{kpi.title}</p>
                  <p className="text-[10px] text-muted-foreground/70">{kpi.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* متوسط درجة الأولوية */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Award className="w-4 h-4 text-primary" />
                مؤشرات جودة البيانات
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-around py-4">
                <ScoreRing score={Number(leads.avgScore ?? 0)} label="متوسط الأولوية" color="text-primary" />
                <ScoreRing
                  score={total > 0 ? Number(leads.hasWebsite ?? 0) / total * 10 : 0}
                  label="الحضور الرقمي"
                  color="text-blue-400"
                />
                <ScoreRing
                  score={total > 0 ? Number(leads.analyzedLeads ?? 0) / total * 10 : 0}
                  label="نسبة التحليل"
                  color="text-green-400"
                />
                <ScoreRing
                  score={Number(chats.totalChats ?? 0) > 0 ? Math.min(10, Number(chats.closedDeals ?? 0) / Number(chats.totalChats) * 10) : 0}
                  label="معدل الإغلاق"
                  color="text-yellow-400"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* تبويب الحملات */}
        <TabsContent value="campaigns" className="space-y-4">
          <CampaignsTab />
        </TabsContent>

        {/* تبويب تحليل AI */}
        <TabsContent value="ai" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Brain className="w-4 h-4 text-primary" />
                تحليل السوق بالذكاء الاصطناعي
              </CardTitle>
              <CardDescription className="text-xs">
                يقوم الذكاء الاصطناعي بتحليل بيانات عملائك وتقديم توصيات تسويقية دقيقة مخصصة للسوق السعودي
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* خيارات التحليل */}
              <div className="flex items-center gap-3">
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="اختر نوع النشاط" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الأنشطة</SelectItem>
                    {businessTypes.map((t: any) => (
                      <SelectItem key={t.businessType} value={t.businessType}>
                        {t.businessType} ({t.count})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleGenerateInsight}
                  disabled={isGenerating}
                  className="gap-2"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      جاري التحليل...
                    </>
                  ) : (
                    <>
                      <Lightbulb className="w-4 h-4" />
                      توليد تحليل AI
                    </>
                  )}
                </Button>
              </div>

              {/* نتيجة التحليل */}
              {aiInsight ? (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-primary">
                    <Brain className="w-4 h-4" />
                    <span className="text-sm font-semibold">تحليل الذكاء الاصطناعي</span>
                    <Badge variant="outline" className="text-xs text-green-400 border-green-500/30">مكتمل</Badge>
                  </div>
                  <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                    {aiInsight}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border p-8 text-center space-y-3">
                  <Brain className="w-10 h-10 mx-auto text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    اضغط على "توليد تحليل AI" للحصول على تحليل تسويقي مخصص
                  </p>
                  <p className="text-xs text-muted-foreground/60">
                    يستخدم الذكاء الاصطناعي بيانات {total} عميل لتوليد توصيات دقيقة
                  </p>
                </div>
              )}

              {/* نصائح تسويقية ثابتة */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  {
                    icon: Clock,
                    title: "أفضل أوقات التواصل",
                    desc: "الفترة الصباحية 9-11 صباحاً والمسائية 7-9 مساءً هي الأكثر فعالية في السوق السعودي",
                    color: "text-blue-400 bg-blue-500/10",
                  },
                  {
                    icon: MessageSquare,
                    title: "نبرة الرسائل",
                    desc: "استخدم اللهجة السعودية الودية مع التركيز على القيمة والفائدة المباشرة للعميل",
                    color: "text-green-400 bg-green-500/10",
                  },
                  {
                    icon: Target,
                    title: "استهداف الفجوات",
                    desc: `${gapsData ? Math.round(Number(gapsData.noWebsite ?? 0) / total * 100) : 0}% من عملائك بدون موقع - فرصة ذهبية لعرض خدمات التسويق الرقمي`,
                    color: "text-yellow-400 bg-yellow-500/10",
                  },
                  {
                    icon: Zap,
                    title: "الرد السريع",
                    desc: "الرد خلال أول 5 دقائق يرفع نسبة التحويل بنسبة 400% مقارنة بالرد بعد ساعة",
                    color: "text-purple-400 bg-purple-500/10",
                  },
                ].map((tip) => (
                  <div key={tip.title} className={`rounded-lg p-3 ${tip.color.split(" ")[1]} border border-current/10`}>
                    <div className="flex items-start gap-2">
                      <tip.icon className={`w-4 h-4 mt-0.5 shrink-0 ${tip.color.split(" ")[0]}`} />
                      <div>
                        <p className="text-xs font-semibold mb-1">{tip.title}</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">{tip.desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
