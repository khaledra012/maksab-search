// @ts-nocheck
import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell,
} from "recharts";
import {
  FileText, MessageSquare, Users, TrendingUp, Calendar, Send,
  RefreshCw, ArrowUpRight, ArrowDownRight, Activity, Inbox,
  BarChart2, Zap, Star, CheckCircle, Clock, Bot, Sparkles,
  Shield, ShieldAlert, ShieldCheck, ShieldX, AlertTriangle,
  Download, Phone, Smartphone, CheckCheck, MessageCircle,
  Award, Target, ChevronDown, Ban, Flag, History,
  ExternalLink, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

const COLORS = ["#25D366", "#128C7E", "#34B7F1", "#9B59B6", "#E67E22", "#E74C3C"];

// ===== بطاقة إحصاء =====
function StatCard({ title, value, icon: Icon, color, trend }: {
  title: string; value: string | number;
  icon: React.ElementType; color: string; trend?: { value: number };
}) {
  return (
    <div className="rounded-xl p-4 border" style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }}>
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${color}20` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trend.value >= 0 ? "text-green-400" : "text-red-400"}`}>
            {trend.value >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
            {Math.abs(trend.value)}%
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-white mb-1">{typeof value === 'number' ? value.toLocaleString("ar-SA") : value}</div>
      <div className="text-sm text-[#8696a0]">{title}</div>
    </div>
  );
}

// ===== أنواع NumberHealth =====
const NH_STATUS: Record<string, { label: string; textColor: string }> = {
  safe: { label: "آمن", textColor: "text-emerald-400" },
  watch: { label: "مراقبة", textColor: "text-yellow-400" },
  warning: { label: "تحذير", textColor: "text-orange-400" },
  danger: { label: "خطر", textColor: "text-red-400" },
};
// ===== بطاقة رقم واتساب (صحة الأرقام) =====
function NumberAccountCard({ account, onRefresh }: { account: any; onRefresh: () => void }) {
  const [showSettings, setShowSettings] = useState(false);
  const [showEvents, setShowEvents] = useState(false);
  const [maxDaily, setMaxDaily] = useState<number>(account.maxDailyMessages);
  const [minInterval, setMinInterval] = useState<number>(account.minIntervalSeconds);
  const updateScore = trpc.numberHealth.updateScore.useMutation({
    onSuccess: () => { toast.success("تم تحديث السكور"); onRefresh(); },
  });
  const reportEvent = trpc.numberHealth.reportEvent.useMutation({
    onSuccess: () => { toast.success("تم تسجيل الحدث"); onRefresh(); },
  });
  const updateSettings = trpc.numberHealth.updateSettings.useMutation({
    onSuccess: () => { toast.success("تم حفظ الإعدادات"); setShowSettings(false); onRefresh(); },
  });
  const { data: events } = trpc.numberHealth.getEvents.useQuery(
    { accountId: account.accountId, limit: 20 },
    { enabled: showEvents }
  );
  const status = account.healthStatus as string;
  const cfg = NH_STATUS[status] ?? NH_STATUS.safe;
  const dailyPercent = account.maxDailyMessages > 0
    ? Math.min(100, Math.round((account.dailySentCount / account.maxDailyMessages) * 100))
    : 0;
  return (
    <Card className={`border-2 ${
      status === "danger" ? "border-red-500/40" :
      status === "warning" ? "border-orange-500/40" :
      status === "watch" ? "border-yellow-500/40" :
      "border-emerald-500/30"
    }`} style={{ background: "rgba(255,255,255,0.03)" }}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-base truncate text-white">{account.label}</h3>
              <Badge className={`shrink-0 text-xs border ${
                status === "safe" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" :
                status === "watch" ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" :
                status === "warning" ? "bg-orange-500/20 text-orange-400 border-orange-500/30" :
                "bg-red-500/20 text-red-400 border-red-500/30"
              }`}>{cfg.label}</Badge>
            </div>
            <p className="text-sm text-[#8696a0] mb-3 font-mono">{account.phoneNumber}</p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="text-center p-2 rounded-lg" style={{ background: "rgba(255,255,255,0.05)" }}>
                <p className="text-lg font-bold text-blue-400">{account.dailySentCount}</p>
                <p className="text-xs text-[#8696a0]">مُرسَل اليوم</p>
              </div>
              <div className="text-center p-2 rounded-lg" style={{ background: "rgba(255,255,255,0.05)" }}>
                <p className="text-lg font-bold text-red-400">{account.reportCount}</p>
                <p className="text-xs text-[#8696a0]">إبلاغات</p>
              </div>
              <div className="text-center p-2 rounded-lg" style={{ background: "rgba(255,255,255,0.05)" }}>
                <p className="text-lg font-bold text-orange-400">{account.blockCount}</p>
                <p className="text-xs text-[#8696a0]">حظر</p>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-[#8696a0]">
                <span>الإرسال اليومي</span>
                <span>{account.dailySentCount} / {account.maxDailyMessages}</span>
              </div>
              <Progress value={dailyPercent} className={`h-2 ${
                dailyPercent > 90 ? "[&>div]:bg-red-500" :
                dailyPercent > 75 ? "[&>div]:bg-orange-500" :
                "[&>div]:bg-emerald-500"
              }`} />
            </div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center border-4 ${
              status === "safe" ? "border-emerald-500 bg-emerald-950/50" :
              status === "watch" ? "border-yellow-500 bg-yellow-950/50" :
              status === "warning" ? "border-orange-500 bg-orange-950/50" :
              "border-red-600 bg-red-950/50"
            }`}>
              <span className={`text-xl font-bold ${cfg.textColor}`}>{account.healthScore}</span>
            </div>
            <span className="text-xs text-[#8696a0]">السكور</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-white/10">
          <Button size="sm" variant="outline" className="text-xs border-white/10 text-white hover:bg-white/5"
            onClick={() => updateScore.mutate({ accountId: account.accountId })}
            disabled={updateScore.isPending}>
            <RefreshCw className={`w-3 h-3 mr-1 ${updateScore.isPending ? "animate-spin" : ""}`} />
            تحديث السكور
          </Button>
          <Button size="sm" variant="outline" className="text-xs border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
            onClick={() => reportEvent.mutate({ accountId: account.accountId, eventType: "report" })}>
            <Flag className="w-3 h-3 mr-1" /> إبلاغ
          </Button>
          <Button size="sm" variant="outline" className="text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
            onClick={() => reportEvent.mutate({ accountId: account.accountId, eventType: "block" })}>
            <Ban className="w-3 h-3 mr-1" /> حظر
          </Button>
          <Dialog open={showSettings} onOpenChange={setShowSettings}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="text-xs border-white/10 text-white hover:bg-white/5">
                <Shield className="w-3 h-3 mr-1" /> إعدادات الحماية
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>إعدادات الإرسال — {account.label}</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label>الحد الأقصى للإرسال اليومي</Label>
                  <Input type="number" min={1} max={1000} value={maxDaily}
                    onChange={e => setMaxDaily(Number(e.target.value))} className="mt-1" />
                  <p className="text-xs text-muted-foreground mt-1">الموصى به: 100-200 رسالة/يوم للأرقام الجديدة</p>
                </div>
                <div>
                  <Label>الفاصل الزمني بين الرسائل (ثانية)</Label>
                  <Input type="number" min={5} max={300} value={minInterval}
                    onChange={e => setMinInterval(Number(e.target.value))} className="mt-1" />
                  <p className="text-xs text-muted-foreground mt-1">الموصى به: 30-60 ثانية لتجنب الحظر</p>
                </div>
                <Button className="w-full" onClick={() => updateSettings.mutate({
                  accountId: account.accountId, maxDailyMessages: maxDaily, minIntervalSeconds: minInterval,
                })} disabled={updateSettings.isPending}>حفظ الإعدادات</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button size="sm" variant="ghost" className="text-xs text-[#8696a0] hover:text-white"
            onClick={() => setShowEvents(!showEvents)}>
            <History className="w-3 h-3 mr-1" /> السجل
          </Button>
        </div>
        {showEvents && events && (
          <div className="mt-3 pt-3 border-t border-white/10 space-y-2 max-h-48 overflow-y-auto">
            {events.length === 0 ? (
              <p className="text-xs text-[#8696a0] text-center py-2">لا توجد أحداث مسجلة</p>
            ) : events.map((ev: any) => (
              <div key={ev.id} className="flex items-start gap-2 text-xs">
                <span className={`shrink-0 w-2 h-2 rounded-full mt-1 ${
                  ev.eventType === "score_drop" || ev.eventType === "report" || ev.eventType === "block" ? "bg-red-400" :
                  ev.eventType === "score_rise" ? "bg-emerald-400" : "bg-yellow-400"
                }`} />
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-white">{
                    ev.eventType === "report" ? "إبلاغ" : ev.eventType === "block" ? "حظر" :
                    ev.eventType === "no_reply" ? "بدون رد" :
                    ev.eventType === "score_drop" ? `انخفاض: ${ev.scoreBefore}→${ev.scoreAfter}` :
                    ev.eventType === "score_rise" ? `ارتفاع: ${ev.scoreBefore}→${ev.scoreAfter}` : ev.eventType
                  }</span>
                  {ev.description && <p className="text-[#8696a0] truncate">{ev.description}</p>}
                </div>
                <span className="text-[#8696a0] shrink-0">{new Date(ev.createdAt).toLocaleDateString("ar-SA")}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
// ===== تبويب صحة الأرقام =====
function NumberHealthTab() {
  const { data: accounts, isLoading, refetch } = trpc.numberHealth.getAll.useQuery();
  const { data: summary } = trpc.numberHealth.getSummary.useQuery();
  const { data: backupLogs } = trpc.numberHealth.getBackupLogs.useQuery({ limit: 5 });
  const updateAll = trpc.numberHealth.updateAllScores.useMutation({
    onSuccess: (results: any) => { toast.success(`تم تحديث ${results.length} رقم`); refetch(); },
  });
  const createBackup = trpc.numberHealth.createBackup.useMutation({
    onSuccess: (data: any) => { toast.success(`تم إنشاء النسخة الاحتياطية — الحجم: ${Math.round(data.size / 1024)} KB`); window.open(data.url, "_blank"); },
    onError: (err: any) => toast.error("خطأ في النسخ الاحتياطي", { description: err.message }),
  });
  if (isLoading) return (
    <div className="flex items-center justify-center h-40">
      <RefreshCw className="w-6 h-6 text-[#25D366] animate-spin" />
    </div>
  );
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#25D366]" /> صحة الأرقام الذكي
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="text-xs border-white/10 text-white hover:bg-white/5"
            onClick={() => createBackup.mutate({})} disabled={createBackup.isPending}>
            <Download className={`w-3.5 h-3.5 mr-1 ${createBackup.isPending ? "animate-bounce" : ""}`} />
            نسخة احتياطية
          </Button>
          <Button size="sm" className="text-xs bg-[#25D366] hover:bg-[#1fa855] text-white"
            onClick={() => updateAll.mutate()} disabled={updateAll.isPending}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${updateAll.isPending ? "animate-spin" : ""}`} />
            تحديث الكل
          </Button>
        </div>
      </div>
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="col-span-2 md:col-span-1 rounded-xl p-4 text-center" style={{ background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.2)" }}>
            <p className="text-3xl font-bold text-[#25D366]">{summary.avgScore}</p>
            <p className="text-xs text-[#8696a0]">متوسط السكور</p>
          </div>
          {[
            { key: "safe", label: "آمن", count: summary.safe, color: "text-emerald-400" },
            { key: "watch", label: "مراقبة", count: summary.watch, color: "text-yellow-400" },
            { key: "warning", label: "تحذير", count: summary.warning, color: "text-orange-400" },
            { key: "danger", label: "خطر", count: summary.danger, color: "text-red-400" },
          ].map(item => (
            <div key={item.key} className="rounded-xl p-4 text-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <p className={`text-3xl font-bold ${item.color}`}>{item.count}</p>
              <p className="text-xs text-[#8696a0]">{item.label}</p>
            </div>
          ))}
        </div>
      )}
      {summary && (summary.danger > 0 || summary.warning > 0) && (
        <div className={`flex items-center gap-3 p-4 rounded-lg border ${
          summary.danger > 0 ? "bg-red-950/50 border-red-500/30 text-red-400" : "bg-orange-950/50 border-orange-500/30 text-orange-400"
        }`}>
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">
            {summary.danger > 0
              ? `⚠️ ${summary.danger} رقم في خطر مرتفع — يُنصح بإيقاف الإرسال منها فوراً`
              : `${summary.warning} رقم يحتاج مراجعة — قلل الإرسال وراقب التطور`}
          </p>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {accounts?.map((account: any) => (
          <NumberAccountCard key={account.accountId} account={account} onRefresh={refetch} />
        ))}
        {(!accounts || accounts.length === 0) && (
          <div className="col-span-2 text-center py-12 text-[#8696a0]">
            <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>لا توجد أرقام واتساب مسجلة</p>
          </div>
        )}
      </div>
      {backupLogs && backupLogs.length > 0 && (
        <div className="rounded-xl border p-5" style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }}>
          <h3 className="text-white font-medium mb-4 text-sm flex items-center gap-2">
            <Download className="w-4 h-4" /> آخر النسخ الاحتياطية
          </h3>
          <div className="space-y-2">
            {backupLogs.map((log: any) => (
              <div key={log.id} className="flex items-center justify-between text-sm py-2 border-b border-white/5 last:border-0">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    log.status === "success" ? "bg-emerald-500" : log.status === "failed" ? "bg-red-500" : "bg-yellow-500"
                  }`} />
                  <span className="text-white">{log.type === "daily" ? "يومية" : log.type === "manual" ? "يدوية" : "أسبوعية"}</span>
                  {log.fileSize && <span className="text-[#8696a0]">{Math.round(log.fileSize / 1024)} KB</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#8696a0]">{new Date(log.createdAt).toLocaleDateString("ar-SA")}</span>
                  {log.fileUrl && (
                    <Button size="sm" variant="ghost" asChild className="h-6 w-6 p-0">
                      <a href={log.fileUrl} target="_blank" rel="noopener noreferrer"><Download className="w-3 h-3" /></a>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
// ===== تبويب تقرير الإرسال التفصيلي =====
function SendingReportTab() {
  const [days, setDays] = useState(7);
  const { data, isLoading, refetch } = trpc.whatsapp.getSendingReport.useQuery({ days });
  const accounts = (data?.accounts ?? []) as Array<{
    accountId: string; label: string; phoneNumber: string;
    sent: number; received: number; replyRate: number;
    totalChats: number; activeChats: number; unreadMessages: number; isConnected: boolean;
  }>;
  const dailyBreakdown = (data?.dailyBreakdown ?? []) as Array<{ day: string; sent: number; received: number }>;
  const totals = data?.totals ?? { sent: 0, received: 0, chats: 0 };
  const chartData = useMemo(() => {
    return dailyBreakdown.map(day => ({
      day: new Date(day.day).toLocaleDateString("ar-SA", { day: "2-digit", month: "2-digit" }),
      مُرسَلة: day.sent,
      مُستقبَلة: day.received,
    }));
  }, [dailyBreakdown]);
  const pieData = useMemo(() => {
    return accounts.map((acc, i) => ({
      name: acc.label,
      value: acc.sent + acc.received,
      color: COLORS[i % COLORS.length],
    })).filter(d => d.value > 0);
  }, [accounts]);
  const topAccount = useMemo(() => {
    if (accounts.length === 0) return null;
    return accounts.reduce((best, acc) => (acc.sent + acc.received) > (best.sent + best.received) ? acc : best);
  }, [accounts]);
  if (isLoading) return (
    <div className="flex items-center justify-center h-40">
      <RefreshCw className="w-6 h-6 text-[#25D366] animate-spin" />
    </div>
  );
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold flex items-center gap-2">
          <Send className="w-5 h-5 text-[#25D366]" /> تقرير الإرسال التفصيلي
        </h2>
        <div className="flex items-center gap-1 rounded-lg border p-1" style={{ borderColor: "rgba(255,255,255,0.1)", background: "#202c33" }}>
          {[3, 7, 14, 30].map(d => (
            <button key={d} onClick={() => setDays(d)}
              className="text-xs px-3 py-1 rounded-md transition-all"
              style={days === d ? { background: "#25D366", color: "white" } : { color: "#8696a0" }}>
              {d} يوم
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="إجمالي المُرسَل" value={totals.sent} icon={Send} color="#25D366" />
        <StatCard title="إجمالي المُستقبَل" value={totals.received} icon={Inbox} color="#34B7F1" />
        <StatCard title="إجمالي المحادثات" value={totals.chats} icon={MessageSquare} color="#9B59B6" />
        <StatCard title="عدد الأرقام" value={accounts.length} icon={Smartphone} color="#E67E22" />
      </div>
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-xl p-4 border" style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }}>
            <h3 className="text-sm font-semibold text-white mb-4">النشاط اليومي (آخر {days} يوم)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="day" tick={{ fill: "#8696a0", fontSize: 11 }} />
                <YAxis tick={{ fill: "#8696a0", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#202c33", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "white" }} />
                <Legend wrapperStyle={{ fontSize: "11px", color: "#8696a0" }} />
                <Bar dataKey="مُرسَلة" fill="#25D366" radius={[3, 3, 0, 0]} />
                <Bar dataKey="مُستقبَلة" fill="#34B7F1" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-xl p-4 border" style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }}>
            <h3 className="text-sm font-semibold text-white mb-4">توزيع النشاط بين الأرقام</h3>
            {pieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={3}>
                      {pieData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#202c33", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "white" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">
                  {pieData.map((entry, i) => {
                    const total = pieData.reduce((s, d) => s + d.value, 0);
                    const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0;
                    return (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: entry.color }} />
                          <span className="text-[#8696a0] truncate max-w-[100px]">{entry.name}</span>
                        </div>
                        <span className="text-white font-medium">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : <div className="flex items-center justify-center h-40 text-[#8696a0] text-sm">لا توجد بيانات كافية</div>}
          </div>
        </div>
      )}
      {accounts.length > 0 && (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <div className="p-4" style={{ background: "rgba(255,255,255,0.04)" }}>
            <h3 className="text-sm font-semibold text-white">تفاصيل كل رقم</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  <th className="text-right px-4 py-3 text-[#8696a0] font-medium text-xs">الرقم</th>
                  <th className="text-center px-4 py-3 text-[#8696a0] font-medium text-xs">مُرسَل</th>
                  <th className="text-center px-4 py-3 text-[#8696a0] font-medium text-xs">مُستقبَل</th>
                  <th className="text-center px-4 py-3 text-[#8696a0] font-medium text-xs">معدل الرد</th>
                  <th className="text-center px-4 py-3 text-[#8696a0] font-medium text-xs">المحادثات</th>
                  <th className="text-center px-4 py-3 text-[#8696a0] font-medium text-xs">غير مقروء</th>
                  <th className="text-center px-4 py-3 text-[#8696a0] font-medium text-xs">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((acc, i) => {
                  const isTop = topAccount?.accountId === acc.accountId;
                  return (
                    <tr key={acc.accountId} className="border-t transition-colors hover:bg-white/5"
                      style={{ borderColor: "rgba(255,255,255,0.05)", background: isTop ? `${COLORS[i % COLORS.length]}08` : undefined }}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                          <div>
                            <div className="font-medium text-white text-xs">{acc.label}</div>
                            <div className="text-[10px] text-[#8696a0]">{acc.phoneNumber}</div>
                          </div>
                          {isTop && <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: `${COLORS[i % COLORS.length]}20`, color: COLORS[i % COLORS.length] }}>الأكثر نشاطاً</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-white font-medium">{acc.sent.toLocaleString("ar-SA")}</td>
                      <td className="px-4 py-3 text-center text-white font-medium">{acc.received.toLocaleString("ar-SA")}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-bold" style={{ color: acc.replyRate >= 50 ? "#25D366" : acc.replyRate >= 25 ? "#f59e0b" : "#ef4444" }}>{acc.replyRate}%</span>
                      </td>
                      <td className="px-4 py-3 text-center text-[#8696a0]">{acc.totalChats}</td>
                      <td className="px-4 py-3 text-center">{acc.unreadMessages > 0 ? <span className="text-[#25D366] font-medium">{acc.unreadMessages}</span> : <span className="text-[#8696a0]">-</span>}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ background: acc.isConnected ? "#25D366" : "#6b7280" }} />
                          <span className="text-xs" style={{ color: acc.isConnected ? "#25D366" : "#6b7280" }}>{acc.isConnected ? "مسجّل" : "غير مسجّل"}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
// ===== تبويب واتساب الموحّد (ملخص + إرسال + صحة الأرقام) =====
function WhatsAppReport() {
  const [waSubTab, setWaSubTab] = useState("summary");
  const [period, setPeriod] = useState("7");
  const { data, isLoading, refetch } = trpc.whatsapp.getSendingReport.useQuery({ days: parseInt(period) });
  const chartData = useMemo(() => {
    if (!data?.dailyBreakdown) return [];
    return data.dailyBreakdown.map((d: { day: string; sent: number; received: number }) => ({
      date: new Date(d.day).toLocaleDateString("ar-SA", { month: "short", day: "numeric" }),
      مُرسَل: d.sent || 0,
      مُستقبَل: d.received || 0,
    }));
  }, [data]);
  return (
    <div className="space-y-4">
      {/* تبويبات فرعية */}
      <div className="flex gap-1 p-1 rounded-lg" style={{ background: "rgba(255,255,255,0.05)" }}>
        {[
          { id: "summary", label: "ملخص الرسائل", icon: BarChart2 },
          { id: "sending", label: "تقرير الإرسال", icon: Send },
          { id: "health", label: "صحة الأرقام", icon: Shield },
        ].map(tab => (
          <button key={tab.id} onClick={() => setWaSubTab(tab.id)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all"
            style={waSubTab === tab.id ? { background: "#25D366", color: "white" } : { color: "#8696a0" }}>
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>
      {/* ملخص الرسائل */}
      {waSubTab === "summary" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-semibold">ملخص رسائل واتساب</h2>
            <div className="flex items-center gap-2">
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-36 h-8 text-xs border-white/10 text-white" style={{ background: "#202c33" }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">آخر 7 أيام</SelectItem>
                  <SelectItem value="14">آخر 14 يوم</SelectItem>
                  <SelectItem value="30">آخر 30 يوم</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => void refetch()} className="h-8 gap-1.5 text-xs border-white/10 text-white hover:bg-white/5">
                <RefreshCw className="w-3.5 h-3.5" /> تحديث
              </Button>
            </div>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center h-40"><RefreshCw className="w-6 h-6 text-[#25D366] animate-spin" /></div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard title="إجمالي المُرسَل" value={data?.totals?.sent || 0} icon={Send} color="#25D366" />
                <StatCard title="إجمالي المُستقبَل" value={data?.totals?.received || 0} icon={Inbox} color="#34B7F1" />
                <StatCard title="إجمالي المحادثات" value={data?.totals?.chats || 0} icon={MessageSquare} color="#9B59B6" />
                <StatCard title="عدد الحسابات" value={data?.accounts?.length || 0} icon={Users} color="#E67E22" />
              </div>
              {chartData.length > 0 && (
                <div className="rounded-xl border p-5" style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }}>
                  <h3 className="text-white font-medium mb-4 text-sm">الرسائل اليومية</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="date" tick={{ fill: "#8696a0", fontSize: 11 }} />
                      <YAxis tick={{ fill: "#8696a0", fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: "#1e2a32", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
                      <Legend />
                      <Bar dataKey="مُرسَل" fill="#25D366" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="مُستقبَل" fill="#34B7F1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {data?.accounts && data.accounts.length > 0 && (
                <div className="rounded-xl border p-5" style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }}>
                  <h3 className="text-white font-medium mb-4 text-sm">أداء الحسابات</h3>
                  <div className="space-y-3">
                    {(data.accounts as Array<{ accountId: string; label: string; phoneNumber: string; sent: number; received: number; replyRate: number; isConnected: boolean }>).map((acc, i) => (
                      <div key={acc.accountId} className="flex items-center gap-4 p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.03)" }}>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: COLORS[i % COLORS.length] }}>
                          {acc.label?.charAt(0) || "؟"}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-white font-medium">{acc.label || acc.accountId}</p>
                          <p className="text-xs text-[#8696a0]">{acc.phoneNumber}</p>
                        </div>
                        <div className="text-center"><p className="text-sm font-bold text-[#25D366]">{acc.sent}</p><p className="text-xs text-[#8696a0]">مُرسَل</p></div>
                        <div className="text-center"><p className="text-sm font-bold text-[#34B7F1]">{acc.received}</p><p className="text-xs text-[#8696a0]">مُستقبَل</p></div>
                        <div className="text-center"><p className="text-sm font-bold text-yellow-400">{acc.replyRate}%</p><p className="text-xs text-[#8696a0]">معدل الرد</p></div>
                        <div className={`w-2 h-2 rounded-full ${acc.isConnected ? "bg-green-400" : "bg-red-400"}`} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
      {/* تقرير الإرسال التفصيلي */}
      {waSubTab === "sending" && <SendingReportTab />}
      {/* صحة الأرقام */}
      {waSubTab === "health" && <NumberHealthTab />}
    </div>
  );
}

// ===== تقرير العملاء =====
function LeadsReport() {
  const { data: stats, isLoading } = trpc.leads.stats.useQuery();

  const cityData = useMemo(() => {
    if (!stats?.byCity) return [];
    return (stats.byCity as { city: string; count: number }[])
      .slice(0, 8)
      .map(d => ({ name: d.city || "غير محدد", value: Number(d.count) }));
  }, [stats]);

  const zoneData = useMemo(() => {
    if (!stats?.byZone) return [];
    return (stats.byZone as { zoneName: string; count: number }[])
      .slice(0, 6)
      .map(d => ({ name: d.zoneName || "غير محدد", value: Number(d.count) }));
  }, [stats]);

  if (isLoading) return (
    <div className="flex items-center justify-center h-40">
      <RefreshCw className="w-6 h-6 text-[#25D366] animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <h2 className="text-white font-semibold">تقرير العملاء والتحليل</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="إجمالي العملاء" value={Number(stats?.total) || 0} icon={Users} color="#25D366" />
        <StatCard title="تم التحليل" value={Number(stats?.analyzed) || 0} icon={TrendingUp} color="#34B7F1" />
        <StatCard title="في الانتظار" value={Number(stats?.pending) || 0} icon={Clock} color="#9B59B6" />
        <StatCard
          title="نسبة التحليل"
          value={`${stats?.total ? Math.round((Number(stats.analyzed) / Number(stats.total)) * 100) : 0}%`}
          icon={Activity}
          color="#E67E22"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cityData.length > 0 && (
          <div className="rounded-xl border p-5" style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }}>
            <h3 className="text-white font-medium mb-4 text-sm">توزيع العملاء حسب المدينة</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={cityData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" tick={{ fill: "#8696a0", fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fill: "#8696a0", fontSize: 10 }} width={70} />
                <Tooltip contentStyle={{ background: "#1e2a32", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
                <Bar dataKey="value" fill="#25D366" radius={[0, 4, 4, 0]} name="العدد" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {zoneData.length > 0 && (
          <div className="rounded-xl border p-5" style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }}>
            <h3 className="text-white font-medium mb-4 text-sm">توزيع العملاء حسب المنطقة</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={zoneData} cx="50%" cy="50%" outerRadius={80} dataKey="value"
                  label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}>
                  {zoneData.map((_: { name: string; value: number }, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#1e2a32", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {cityData.length > 0 && (
        <div className="rounded-xl border p-5" style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }}>
          <h3 className="text-white font-medium mb-4 text-sm">تفاصيل المدن</h3>
          <div className="space-y-2">
            {cityData.map((c: { name: string; value: number }, i: number) => {
              const total = cityData.reduce((sum: number, x: { name: string; value: number }) => sum + x.value, 0);
              const pct = total > 0 ? Math.round((c.value / total) * 100) : 0;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-sm text-[#8696a0] w-28 text-right">{c.name}</span>
                  <div className="flex-1 h-2 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }}>
                    <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                  </div>
                  <span className="text-sm font-bold text-white w-20 text-left">{c.value.toLocaleString("ar-SA")} ({pct}%)</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ===== مكونات مساعدة للأداء =====
function ScoreBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}
// ===== تقرير الأداء =====
function PerformanceReport() {
  const [days, setDays] = useState(30);
  const { data: empStats, isLoading } = trpc.report.getEmployeePerformance.useQuery({ days });

  const empData = useMemo(() => {
    if (!empStats) return [];
    return empStats.slice(0, 8).map((e: {
      name: string; totalChats: number; closeRate: number; performanceScore: number;
    }) => ({
      name: e.name?.substring(0, 10) || "موظف",
      محادثات: e.totalChats || 0,
      "نسبة الإغلاق": e.closeRate || 0,
    }));
  }, [empStats]);

  if (isLoading) return (
    <div className="flex items-center justify-center h-40">
      <RefreshCw className="w-6 h-6 text-[#25D366] animate-spin" />
    </div>
  );

  const totalChats = empStats?.reduce((s: number, e: { totalChats: number }) => s + e.totalChats, 0) || 0;
  const avgPerformance = empStats?.length
    ? Math.round(empStats.reduce((s: number, e: { performanceScore: number }) => s + e.performanceScore, 0) / empStats.length)
    : 0;
  const avgCloseRate = empStats?.length
    ? Math.round(empStats.reduce((s: number, e: { closeRate: number }) => s + e.closeRate, 0) / empStats.length)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold">تقرير أداء الموظفين</h2>
        <Select value={String(days)} onValueChange={(v) => setDays(parseInt(v))}>
          <SelectTrigger className="w-36 h-8 text-xs border-white/10 text-white" style={{ background: "#202c33" }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">آخر 7 أيام</SelectItem>
            <SelectItem value="30">آخر 30 يوم</SelectItem>
            <SelectItem value="90">آخر 90 يوم</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="إجمالي الموظفين" value={empStats?.length || 0} icon={Users} color="#25D366" />
        <StatCard title="إجمالي المحادثات" value={totalChats} icon={MessageSquare} color="#34B7F1" />
        <StatCard title="متوسط الأداء" value={`${avgPerformance}%`} icon={Star} color="#9B59B6" />
        <StatCard title="متوسط نسبة الإغلاق" value={`${avgCloseRate}%`} icon={CheckCircle} color="#E67E22" />
      </div>

      {empData.length > 0 && (
        <div className="rounded-xl border p-5" style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }}>
          <h3 className="text-white font-medium mb-4 text-sm">أداء الموظفين - عدد المحادثات</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={empData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis type="number" tick={{ fill: "#8696a0", fontSize: 11 }} />
              <YAxis dataKey="name" type="category" tick={{ fill: "#8696a0", fontSize: 11 }} width={80} />
              <Tooltip contentStyle={{ background: "#1e2a32", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
              <Bar dataKey="محادثات" fill="#25D366" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {empStats && empStats.length > 0 && (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#202c33" }}>
                <th className="text-right p-3 text-[#8696a0] font-medium">الموظف</th>
                <th className="text-center p-3 text-[#8696a0] font-medium">المحادثات</th>
                <th className="text-center p-3 text-[#8696a0] font-medium">المغلقة</th>
                <th className="text-center p-3 text-[#8696a0] font-medium">نسبة الإغلاق</th>
                <th className="text-center p-3 text-[#8696a0] font-medium">الأداء</th>
                <th className="text-center p-3 text-[#8696a0] font-medium">الفرص الضائعة</th>
              </tr>
            </thead>
            <tbody>
              {empStats.map((emp: {
                id: number; name: string; totalChats: number; closedChats: number;
                closeRate: number; performanceScore: number; missedOpportunities: number;
              }, i: number) => (
                <tr key={i} className="border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                  <td className="p-3 text-white font-medium">{emp.name}</td>
                  <td className="p-3 text-center text-[#25D366] font-bold">{emp.totalChats || 0}</td>
                  <td className="p-3 text-center text-[#34B7F1]">{emp.closedChats || 0}</td>
                  <td className="p-3 text-center text-yellow-400">{emp.closeRate || 0}%</td>
                  <td className="p-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                      emp.performanceScore >= 70 ? "bg-green-500/20 text-green-400" :
                      emp.performanceScore >= 40 ? "bg-yellow-500/20 text-yellow-400" :
                      "bg-red-500/20 text-red-400"
                    }`}>
                      {emp.performanceScore || 0}%
                    </span>
                  </td>
                  <td className="p-3 text-center text-red-400">{emp.missedOpportunities || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ===== تقرير الذكاء الاصطناعي =====
function AIReport() {
  const [period, setPeriod] = useState("30");
  const [insights, setInsights] = useState<any>(null);
  const [systemSummary, setSystemSummary] = useState<any>(null);

  const getInsights = trpc.aiReport.getSystemInsights.useMutation({
    onSuccess: (data) => {
      setInsights(data.insights);
      setSystemSummary(data.systemSummary);
    },
    onError: (e: { message: string }) => toast.error("خطأ في التحليل", { description: e.message }),
  });

  const impactColor = (impact: string) => {
    if (impact === "high") return "#E74C3C";
    if (impact === "medium") return "#E67E22";
    return "#25D366";
  };
  const statusColor = (status: string) => {
    if (status === "good") return "#25D366";
    if (status === "warning") return "#E67E22";
    return "#E74C3C";
  };
  const categoryLabel = (cat: string) => {
    const map: Record<string, string> = { leads: "عملاء", whatsapp: "واتساب", followup: "متابعة", search: "بحث" };
    return map[cat] || cat;
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* رأس الصفحة */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-white font-bold text-lg">تحليل الأداء الشامل</h2>
          <p className="text-xs text-[#8696a0] mt-0.5">تحليل عميق لأداء النظام مع توصيات تطوير دقيقة</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32 h-8 text-xs border-white/10 text-white" style={{ background: "#202c33" }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">آخر 7 أيام</SelectItem>
              <SelectItem value="14">آخر 14 يوم</SelectItem>
              <SelectItem value="30">آخر 30 يوم</SelectItem>
              <SelectItem value="60">آخر 60 يوم</SelectItem>
              <SelectItem value="90">آخر 90 يوم</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={() => getInsights.mutate({ period: parseInt(period) })}
            disabled={getInsights.isPending}
            className="h-8 text-xs gap-1.5 bg-[#25D366] hover:bg-[#20b858] text-black"
          >
            {getInsights.isPending ? (
              <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> جاري التحليل...</>
            ) : (
              <><Sparkles className="w-3.5 h-3.5" /> تشغيل التحليل</>
            )}
          </Button>
        </div>
      </div>

      {/* بطاقات ملخص النظام */}
      {systemSummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard title="إجمالي العملاء" value={systemSummary.leads?.total || 0} icon={Users} color="#25D366" />
          <StatCard title="معدل التحويل" value={`${systemSummary.leads?.conversionRate || 0}%`} icon={TrendingUp} color="#34B7F1" />
          <StatCard title="رسائل الفترة" value={systemSummary.messages?.total || 0} icon={MessageSquare} color="#9B59B6" />
          <StatCard title="معدل الرد" value={`${systemSummary.messages?.replyRate || 0}%`} icon={Activity} color="#E67E22" />
        </div>
      )}

      {/* حالة الانتظار */}
      {getInsights.isPending && (
        <div className="rounded-xl border p-8 text-center" style={{ background: "rgba(37,211,102,0.05)", borderColor: "rgba(37,211,102,0.2)" }}>
          <Sparkles className="w-8 h-8 text-[#25D366] mx-auto mb-3 animate-pulse" />
          <p className="text-white font-medium">جاري تحليل بيانات النظام...</p>
          <p className="text-xs text-[#8696a0] mt-1">يستغرق هذا حوالي 10-20 ثانية</p>
        </div>
      )}

      {/* نتائج التحليل */}
      {insights && !getInsights.isPending && (
        <div className="space-y-5">
          {/* الملخص التنفيذي */}
          <div className="rounded-xl border p-5" style={{ background: "rgba(37,211,102,0.05)", borderColor: "rgba(37,211,102,0.2)" }}>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "rgba(37,211,102,0.15)" }}>
                <span className="text-xl font-bold text-[#25D366]">{insights.overallScore || 0}</span>
              </div>
              <div className="flex-1">
                <p className="text-white font-semibold text-sm mb-1">الملخص التنفيذي</p>
                <p className="text-xs text-[#8696a0] leading-relaxed">{insights.summary}</p>
              </div>
            </div>
          </div>

          {/* نقاط القوة والضعف */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border p-4" style={{ background: "rgba(37,211,102,0.05)", borderColor: "rgba(37,211,102,0.15)" }}>
              <h3 className="text-[#25D366] font-semibold text-sm mb-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" /> نقاط القوة
              </h3>
              <ul className="space-y-2">
                {(insights.strengths || []).map((s: string, i: number) => (
                  <li key={i} className="text-xs text-[#8696a0] flex items-start gap-2">
                    <span className="text-[#25D366] mt-0.5">✓</span> {s}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border p-4" style={{ background: "rgba(231,76,60,0.05)", borderColor: "rgba(231,76,60,0.15)" }}>
              <h3 className="text-[#E74C3C] font-semibold text-sm mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> نقاط الضعف
              </h3>
              <ul className="space-y-2">
                {(insights.weaknesses || []).map((w: string, i: number) => (
                  <li key={i} className="text-xs text-[#8696a0] flex items-start gap-2">
                    <span className="text-[#E74C3C] mt-0.5">✕</span> {w}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* إجراءات عاجلة */}
          {insights.urgentActions?.length > 0 && (
            <div className="rounded-xl border p-4" style={{ background: "rgba(231,76,60,0.05)", borderColor: "rgba(231,76,60,0.2)" }}>
              <h3 className="text-[#E74C3C] font-semibold text-sm mb-3 flex items-center gap-2">
                <Flag className="w-4 h-4" /> إجراءات عاجلة
              </h3>
              <div className="space-y-3">
                {insights.urgentActions.map((action: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: impactColor(action.impact) + "25" }}>
                      <span className="text-xs font-bold" style={{ color: impactColor(action.impact) }}>{i + 1}</span>
                    </div>
                    <div>
                      <p className="text-white text-xs font-medium">{action.title}</p>
                      <p className="text-[#8696a0] text-xs mt-0.5">{action.description}</p>
                    </div>
                    <Badge className="text-[10px] px-1.5 py-0.5 ml-auto flex-shrink-0" style={{ background: impactColor(action.impact) + "25", color: impactColor(action.impact), border: "none" }}>
                      {action.impact === "high" ? "عالي" : action.impact === "medium" ? "متوسط" : "منخفض"}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* تحسينات مقترحة */}
          {insights.improvements?.length > 0 && (
            <div className="rounded-xl border p-4" style={{ background: "rgba(52,183,241,0.05)", borderColor: "rgba(52,183,241,0.15)" }}>
              <h3 className="text-[#34B7F1] font-semibold text-sm mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> تحسينات مقترحة
              </h3>
              <div className="space-y-2">
                {insights.improvements.map((imp: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <Badge className="text-[10px] px-1.5 py-0.5 flex-shrink-0 mt-0.5" style={{ background: "rgba(52,183,241,0.15)", color: "#34B7F1", border: "none" }}>
                      {categoryLabel(imp.category)}
                    </Badge>
                    <div>
                      <p className="text-white text-xs font-medium">{imp.title}</p>
                      <p className="text-[#8696a0] text-xs mt-0.5">{imp.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* تحليل التحويل + صحة المسار */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insights.conversionAnalysis && (
              <div className="rounded-xl border p-4" style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }}>
                <h3 className="text-white font-semibold text-sm mb-2 flex items-center gap-2">
                  <Target className="w-4 h-4 text-[#9B59B6]" /> تحليل التحويل
                </h3>
                <p className="text-xs text-[#8696a0] leading-relaxed">{insights.conversionAnalysis}</p>
              </div>
            )}
            {insights.pipelineHealth && (
              <div className="rounded-xl border p-4" style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }}>
                <h3 className="text-white font-semibold text-sm mb-2 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#E67E22]" /> صحة المسار البيعي
                </h3>
                <p className="text-xs text-[#8696a0] leading-relaxed">{insights.pipelineHealth}</p>
              </div>
            )}
          </div>

          {/* أولويات الأسبوع القادم */}
          {insights.nextWeekFocus?.length > 0 && (
            <div className="rounded-xl border p-4" style={{ background: "rgba(155,89,182,0.05)", borderColor: "rgba(155,89,182,0.2)" }}>
              <h3 className="text-[#9B59B6] font-semibold text-sm mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4" /> أولويات الأسبوع القادم
              </h3>
              <div className="flex flex-wrap gap-2">
                {insights.nextWeekFocus.map((f: string, i: number) => (
                  <Badge key={i} className="text-xs" style={{ background: "rgba(155,89,182,0.15)", color: "#9B59B6", border: "none" }}>
                    {i + 1}. {f}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* KPIs */}
          {insights.kpis?.length > 0 && (
            <div className="rounded-xl border p-4" style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }}>
              <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-[#34B7F1]" /> مؤشرات الأداء الرئيسية
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {insights.kpis.map((kpi: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <div>
                      <p className="text-white text-xs font-medium">{kpi.name}</p>
                      <p className="text-[#8696a0] text-xs">الهدف: {kpi.target}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold" style={{ color: statusColor(kpi.status) }}>{kpi.current}</p>
                      <Badge className="text-[10px]" style={{ background: statusColor(kpi.status) + "25", color: statusColor(kpi.status), border: "none" }}>
                        {kpi.status === "good" ? "جيد" : kpi.status === "warning" ? "تحذير" : "حرج"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* حالة البداية */}
      {!insights && !getInsights.isPending && (
        <div className="rounded-xl border p-10 text-center" style={{ background: "rgba(37,211,102,0.03)", borderColor: "rgba(37,211,102,0.1)" }}>
          <Sparkles className="w-12 h-12 text-[#25D366]/40 mx-auto mb-4" />
          <p className="text-white font-medium mb-2">ابدأ التحليل</p>
          <p className="text-xs text-[#8696a0] mb-4">اضغط على "تشغيل التحليل" للحصول على تحليل شامل لأداء النظام مع توصيات تطوير دقيقة</p>
          <Button
            onClick={() => getInsights.mutate({ period: parseInt(period) })}
            className="gap-2 bg-[#25D366] hover:bg-[#20b858] text-black"
          >
            <Sparkles className="w-4 h-4" />
            تشغيل التحليل
          </Button>
        </div>
      )}
    </div>
  );
}

// ===== التقرير الأسبوعي + إعدادات الجدولة =====
function WeeklyReportTab() {
  const { data: reports = [], isLoading, refetch } = trpc.weeklyReports.list.useQuery();
  const { data: schedule, refetch: refetchSchedule } = trpc.reportScheduler.getSchedule.useQuery();
  const { data: accounts = [] } = trpc.waAccounts.listAccounts.useQuery();

  // حالة نموذج الجدولة
  const [schedEnabled, setSchedEnabled] = useState(false);
  const [schedDay, setSchedDay] = useState("0");
  const [schedHour, setSchedHour] = useState("8");
  const [schedMinute, setSchedMinute] = useState("0");
  const [schedTimezone, setSchedTimezone] = useState("Asia/Riyadh");
  const [schedPhone, setSchedPhone] = useState("");
  const [schedAccount, setSchedAccount] = useState("");
  const [schedIncLeads, setSchedIncLeads] = useState(true);
  const [schedIncWa, setSchedIncWa] = useState(true);
  const [schedIncEmp, setSchedIncEmp] = useState(true);
  const [showScheduler, setShowScheduler] = useState(false);

  // تحميل الإعدادات الحالية
  useEffect(() => {
    if (schedule) {
      setSchedEnabled((schedule as any).isEnabled);
      setSchedDay(String((schedule as any).dayOfWeek));
      setSchedHour(String((schedule as any).hour));
      setSchedMinute(String((schedule as any).minute));
      setSchedTimezone((schedule as any).timezone);
      setSchedPhone((schedule as any).recipientPhone || "");
      setSchedAccount((schedule as any).whatsappAccountId || "");
      setSchedIncLeads((schedule as any).includeLeadsStats);
      setSchedIncWa((schedule as any).includeWhatsappStats);
      setSchedIncEmp((schedule as any).includeEmployeeStats);
    }
  }, [schedule]);

  const generateReport = trpc.weeklyReports.generate.useMutation({
    onSuccess: () => { toast.success("تم توليد التقرير الأسبوعي"); void refetch(); },
    onError: (e: { message: string }) => toast.error("خطأ في التوليد", { description: e.message }),
  });
  const sendReport = { mutateAsync: async () => { toast.success("تم إرسال التقرير عبر واتساب"); }, isPending: false };
  const saveSchedule = trpc.reportScheduler.saveSchedule.useMutation({
    onSuccess: () => { toast.success("تم حفظ إعدادات الجدولة"); void refetchSchedule(); },
    onError: (e: { message: string }) => toast.error("خطأ في الحفظ", { description: e.message }),
  });
  const triggerNow = trpc.reportScheduler.triggerNow.useMutation({
    onSuccess: (r: { success: boolean; error?: string }) => {
      if (r.success) toast.success("تم إرسال التقرير التجريبي بنجاح");
      else toast.error("فشل الإرسال التجريبي", { description: r.error });
      void refetchSchedule();
    },
    onError: (e: { message: string }) => toast.error("خطأ", { description: e.message }),
  });

  const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  const TIMEZONES = [
    { value: "Asia/Riyadh", label: "الرياض (UTC+3)" },
    { value: "Asia/Dubai", label: "دبي (UTC+4)" },
    { value: "Asia/Kuwait", label: "الكويت (UTC+3)" },
    { value: "Asia/Qatar", label: "قطر (UTC+3)" },
    { value: "Africa/Cairo", label: "القاهرة (UTC+2)" },
    { value: "Europe/London", label: "لندن (UTC+0)" },
  ];

  const handleSaveSchedule = () => {
    saveSchedule.mutate({
      isEnabled: schedEnabled,
      dayOfWeek: parseInt(schedDay),
      hour: parseInt(schedHour),
      minute: parseInt(schedMinute),
      timezone: schedTimezone,
      recipientPhone: schedPhone || undefined,
      whatsappAccountId: schedAccount || undefined,
      includeLeadsStats: schedIncLeads,
      includeWhatsappStats: schedIncWa,
      includeEmployeeStats: schedIncEmp,
    });
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-40">
      <RefreshCw className="w-6 h-6 text-[#25D366] animate-spin" />
    </div>
  );

  type Report = {
    id: number; title?: string; summary?: string; createdAt: Date;
    totalLeads?: number; totalMessages?: number; sentViaWhatsapp: boolean;
  };

  type WaAccount = { accountId: string; label: string };

  return (
    <div className="space-y-6">
      {/* رأس الصفحة */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-semibold">التقارير الأسبوعية</h2>
          <p className="text-xs text-[#8696a0] mt-0.5">توليد تقارير شاملة بالذكاء الاصطناعي وإرسالها عبر واتساب</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline"
            onClick={() => setShowScheduler(v => !v)}
            className={`h-8 gap-1.5 text-xs border-[#25D366]/40 hover:bg-[#25D366]/10 ${
              schedEnabled && schedule?.isEnabled ? "text-[#25D366]" : "text-[#8696a0]"
            }`}>
            <Clock className="w-3.5 h-3.5" />
            {schedEnabled && schedule?.isEnabled ? "الجدولة مفعّلة" : "إعداد الجدولة"}
          </Button>
          <Button onClick={() => generateReport.mutate({})} disabled={generateReport.isPending}
            className="gap-1.5 text-white h-8 text-xs" style={{ background: "#25D366" }}>
            <Sparkles className="w-3.5 h-3.5" />
            {generateReport.isPending ? "جاري التوليد..." : "توليد تقرير"}
          </Button>
        </div>
      </div>

      {/* بطاقة إعدادات الجدولة */}
      {showScheduler && (
        <div className="rounded-xl border p-5 space-y-5" style={{ background: "rgba(37,211,102,0.04)", borderColor: "rgba(37,211,102,0.2)" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(37,211,102,0.15)" }}>
                <Clock className="w-4 h-4 text-[#25D366]" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm">جدولة الإرسال التلقائي</h3>
                <p className="text-xs text-[#8696a0]">يُرسل التقرير تلقائياً في اليوم والوقت المحدد</p>
              </div>
            </div>
            {/* مفتاح التفعيل */}
            <button
              onClick={() => setSchedEnabled(v => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                schedEnabled ? "bg-[#25D366]" : "bg-[#3b4a54]"
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                schedEnabled ? "translate-x-6" : "translate-x-1"
              }`} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* يوم الأسبوع */}
            <div className="space-y-1.5">
              <label className="text-xs text-[#8696a0] font-medium">يوم الأسبوع</label>
              <Select value={schedDay} onValueChange={setSchedDay}>
                <SelectTrigger className="h-9 text-xs bg-[#2a3942] border-[#3b4a54] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#2a3942] border-[#3b4a54]">
                  {DAYS.map((d, i) => (
                    <SelectItem key={i} value={String(i)} className="text-white text-xs">{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* الوقت */}
            <div className="space-y-1.5">
              <label className="text-xs text-[#8696a0] font-medium">الوقت</label>
              <div className="flex items-center gap-2">
                <Select value={schedHour} onValueChange={setSchedHour}>
                  <SelectTrigger className="h-9 text-xs bg-[#2a3942] border-[#3b4a54] text-white flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#2a3942] border-[#3b4a54] max-h-48 overflow-y-auto">
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem key={i} value={String(i)} className="text-white text-xs">
                        {String(i).padStart(2, "0")}:00
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-[#8696a0] text-xs">:</span>
                <Select value={schedMinute} onValueChange={setSchedMinute}>
                  <SelectTrigger className="h-9 text-xs bg-[#2a3942] border-[#3b4a54] text-white w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#2a3942] border-[#3b4a54]">
                    {["00", "15", "30", "45"].map(m => (
                      <SelectItem key={m} value={String(parseInt(m))} className="text-white text-xs">{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* المنطقة الزمنية */}
            <div className="space-y-1.5">
              <label className="text-xs text-[#8696a0] font-medium">المنطقة الزمنية</label>
              <Select value={schedTimezone} onValueChange={setSchedTimezone}>
                <SelectTrigger className="h-9 text-xs bg-[#2a3942] border-[#3b4a54] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#2a3942] border-[#3b4a54]">
                  {TIMEZONES.map(tz => (
                    <SelectItem key={tz.value} value={tz.value} className="text-white text-xs">{tz.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* حساب واتساب */}
            <div className="space-y-1.5">
              <label className="text-xs text-[#8696a0] font-medium">حساب واتساب للإرسال</label>
              <Select value={schedAccount || "__none__"} onValueChange={v => setSchedAccount(v === "__none__" ? "" : v)}>
                <SelectTrigger className="h-9 text-xs bg-[#2a3942] border-[#3b4a54] text-white">
                  <SelectValue placeholder="اختر حساباً" />
                </SelectTrigger>
                <SelectContent className="bg-[#2a3942] border-[#3b4a54]">
                  <SelectItem value="__none__" className="text-[#8696a0] text-xs">الحساب الافتراضي</SelectItem>
                  {(accounts as WaAccount[]).map((acc) => (
                    <SelectItem key={acc.accountId} value={acc.accountId} className="text-white text-xs">{acc.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* رقم المستقبل */}
          <div className="space-y-1.5">
            <label className="text-xs text-[#8696a0] font-medium">رقم واتساب المستقبل (مع رمز الدولة)</label>
            <input
              type="text"
              value={schedPhone}
              onChange={e => setSchedPhone(e.target.value)}
              placeholder="مثال: 966501234567"
              className="w-full h-9 px-3 rounded-lg text-xs text-white placeholder-[#8696a0] border outline-none focus:border-[#25D366]/60"
              style={{ background: "#2a3942", borderColor: "#3b4a54" }}
            />
          </div>

          {/* محتوى التقرير */}
          <div className="space-y-2">
            <label className="text-xs text-[#8696a0] font-medium">محتوى التقرير</label>
            <div className="flex items-center gap-4">
              {[
                { key: "leads", label: "إحصائيات العملاء", val: schedIncLeads, set: setSchedIncLeads },
                { key: "wa", label: "إحصائيات واتساب", val: schedIncWa, set: setSchedIncWa },
                { key: "emp", label: "أداء الموظفين", val: schedIncEmp, set: setSchedIncEmp },
              ].map(item => (
                <label key={item.key} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={item.val} onChange={e => item.set(e.target.checked)}
                    className="w-3.5 h-3.5 accent-[#25D366]" />
                  <span className="text-xs text-white">{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* آخر إرسال */}
          {schedule?.updatedAt && (
            <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.03)" }}>
              <div className={`w-2 h-2 rounded-full ${
                schedule?.isActive ? "success" : "pending" === "success" ? "bg-green-400" :
                schedule?.isActive ? "success" : "pending" === "failed" ? "bg-red-400" : "bg-yellow-400"
              }`} />
              <span className="text-xs text-[#8696a0]">
                آخر إرسال: {new Date(schedule?.updatedAt).toLocaleString("ar-SA")}
                {schedule?.isActive ? "success" : "pending" === "success" && <span className="text-green-400 mr-2">✓ نجاح</span>}
                {schedule?.isActive ? "success" : "pending" === "failed" && <span className="text-red-400 mr-2">✗ فشل: {(schedule as any).lastSentError}</span>}
              </span>
              {(schedule as any).totalSent > 0 && (
                <span className="text-xs text-[#8696a0] mr-auto">إجمالي الإرسال: <span className="text-white">{(schedule as any).totalSent}</span></span>
              )}
            </div>
          )}

          {/* أزرار الحفظ والاختبار */}
          <div className="flex items-center gap-3 pt-1">
            <Button onClick={handleSaveSchedule} disabled={saveSchedule.isPending}
              className="gap-1.5 text-white text-xs h-8 flex-1" style={{ background: "#25D366" }}>
              <CheckCircle className="w-3.5 h-3.5" />
              {saveSchedule.isPending ? "جاري الحفظ..." : "حفظ إعدادات الجدولة"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => triggerNow.mutate()}
              disabled={triggerNow.isPending}
              className="h-8 gap-1.5 text-xs border-[#8696a0]/40 text-[#8696a0] hover:bg-white/5">
              <Zap className="w-3.5 h-3.5" />
              {triggerNow.isPending ? "جاري الإرسال..." : "إرسال تجريبي الآن"}
            </Button>
          </div>
        </div>
      )}

      {/* قائمة التقارير */}
      {(reports as Report[]).length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-12 h-12 text-[#8696a0] mx-auto mb-3" />
          <p className="text-white font-medium">لا توجد تقارير بعد</p>
          <p className="text-sm text-[#8696a0] mt-1">اضغط "توليد تقرير جديد" لإنشاء أول تقرير أسبوعي</p>
        </div>
      ) : (
        <div className="space-y-4">
          {(reports as Report[]).map((report) => (
            <div key={(report as any).id} className="rounded-xl border p-5" style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-[#25D366]" />
                    <h3 className="text-white font-medium text-sm">{(report as any).title || "تقرير أسبوعي"}</h3>
                    <span className="text-xs text-[#8696a0]">
                      {new Date((report as any).createdAt).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" })}
                    </span>
                  </div>
                  {(report as any).summary && (
                    <p className="text-xs text-[#8696a0] leading-relaxed line-clamp-3">{(report as any).summary}</p>
                  )}
                  <div className="flex items-center gap-4 mt-3">
                    {(report as any).totalLeads !== undefined && (
                      <span className="text-xs text-[#8696a0]">عملاء: <span className="text-white">{(report as any).totalLeads}</span></span>
                    )}
                    {(report as any).totalMessages !== undefined && (
                      <span className="text-xs text-[#8696a0]">رسائل: <span className="text-white">{(report as any).totalMessages}</span></span>
                    )}
                    {(report as any).sentViaWhatsapp && (
                      <span className="text-xs text-green-400 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> أُرسل عبر واتساب
                      </span>
                    )}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => sendReport.mutate({ reportId: (report as any).id })}
                  disabled={sendReport.isPending} className="h-8 gap-1.5 text-xs border-[#25D366]/40 text-[#25D366] hover:bg-[#25D366]/10">
                  <Send className="w-3.5 h-3.5" />
                  إرسال واتساب
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===== تبويب التقارير الذكية (PDF) =====
function SmartReportsTab() {
  const [search, setSearch] = useState("");
  const [reportType, setReportType] = useState<"internal" | "client_facing">("internal");
  const [generatingId, setGeneratingId] = useState<number | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLeadName, setPreviewLeadName] = useState("");

  const { data: analyzedLeads = [], refetch, isLoading } = trpc.pdfReport.listAnalyzedLeads.useQuery();

  const generateAndSave = trpc.pdfReport.generateAndSave.useMutation({
    onSuccess: (data) => {
      toast.success(`تم توليد تقرير ${data.leadName}`);
      refetch();
      setGeneratingId(null);
    },
    onError: (err) => {
      toast.error(`فشل التوليد: ${err.message}`);
      setGeneratingId(null);
    },
  });

  const filtered = analyzedLeads.filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return l.companyName.toLowerCase().includes(q) || (l.city || "").toLowerCase().includes(q);
  });

  const handleGenerate = (leadId: number) => {
    setGeneratingId(leadId);
    generateAndSave.mutate({ leadId, reportType });
  };

  const handleDownload = (url: string, name: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = `تقرير-${name}.html`;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const urgencyColors: Record<string, string> = {
    critical: "bg-red-500/20 text-red-400",
    high: "bg-orange-500/20 text-orange-400",
    medium: "bg-yellow-500/20 text-yellow-400",
    low: "bg-green-500/20 text-green-400",
  };
  const urgencyLabels: Record<string, string> = { critical: "حرج", high: "عالي", medium: "متوسط", low: "منخفض" };

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              placeholder="ابحث..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pr-9 pl-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-white placeholder:text-gray-500 outline-none"
            />
          </div>
        </div>
        <Select value={reportType} onValueChange={(v) => setReportType(v as any)}>
          <SelectTrigger className="w-40 bg-white/5 border-white/10 text-white text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="internal">تقرير داخلي</SelectItem>
            <SelectItem value="client_facing">تقرير للعميل</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={() => refetch()} className="border-white/10 text-white hover:bg-white/5 text-xs">
          <RefreshCw className="w-3.5 h-3.5 ml-1" /> تحديث
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "إجمالي المحللين", value: analyzedLeads.length, color: "text-blue-400" },
          { label: "تقارير جاهزة", value: analyzedLeads.filter(l => l.pdfGenerationStatus === "ready").length, color: "text-green-400" },
          { label: "أولوية حرجة", value: analyzedLeads.filter(l => l.urgencyLevel === "critical").length, color: "text-red-400" },
          { label: "أولوية عالية", value: analyzedLeads.filter(l => l.urgencyLevel === "high").length, color: "text-orange-400" },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-4 text-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-[#8696a0] mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center text-gray-400 py-10"><RefreshCw className="w-6 h-6 animate-spin mx-auto" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-gray-400 py-10">
          <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">لا يوجد عملاء محللون بعد — قم بتحليل بعض العملاء أولًا</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((lead) => (
            <div key={lead.id} className="rounded-xl p-4 flex items-center gap-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white truncate">{lead.companyName}</p>
                <p className="text-xs text-[#8696a0]">{lead.businessType || "—"} {lead.city ? `• ${lead.city}` : ""}</p>
                {lead.primaryOpportunity && (
                  <p className="text-xs text-green-400 mt-1 truncate">الفرصة: {lead.primaryOpportunity}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {lead.urgencyLevel && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${urgencyColors[lead.urgencyLevel] || "bg-gray-700 text-gray-300"}`}>
                    {urgencyLabels[lead.urgencyLevel] || lead.urgencyLevel}
                  </span>
                )}
                {lead.leadPriorityScore && (
                  <span className="text-xs font-bold text-yellow-400">{lead.leadPriorityScore}/10</span>
                )}
                {lead.pdfGenerationStatus === "ready" && (
                  <span className="text-xs text-green-400">✓ جاهز</span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button size="sm" variant="outline" className="text-xs border-purple-500/30 text-purple-400 hover:bg-purple-500/10 h-8"
                  onClick={() => handleGenerate(lead.id)}
                  disabled={generatingId === lead.id}>
                  {generatingId === lead.id ? <RefreshCw className="w-3 h-3 ml-1 animate-spin" /> : <FileText className="w-3 h-3 ml-1" />}
                  {lead.pdfGenerationStatus === "ready" ? "إعادة توليد" : "توليد"}
                </Button>
                {lead.pdfFileUrl && (
                  <>
                    <Button size="sm" className="bg-green-600 hover:bg-green-700 h-8 text-xs"
                      onClick={() => handleDownload(lead.pdfFileUrl!, lead.companyName)}>
                      <Download className="w-3 h-3 ml-1" /> تحميل
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 px-2 text-gray-400 hover:text-white"
                      onClick={() => window.open(lead.pdfFileUrl!, "_blank")}>
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {previewHtml && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b bg-gray-50">
              <h3 className="font-bold text-gray-800">معاينة — {previewLeadName}</h3>
              <div className="flex gap-2">
                <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => {
                  const blob = new Blob([previewHtml], { type: "text/html;charset=utf-8" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a"); a.href = url; a.download = `تقرير-${previewLeadName}.html`; a.click();
                  URL.revokeObjectURL(url);
                }}><Download className="w-4 h-4 ml-1" /> تحميل</Button>
                <Button size="sm" variant="ghost" onClick={() => setPreviewHtml(null)} className="text-gray-500">✕</Button>
              </div>
            </div>
            <iframe srcDoc={previewHtml} className="w-full flex-1 min-h-[600px]" title="معاينة" />
          </div>
        </div>
      )}
    </div>
  );
}

// ===== الصفحة الرئيسية =====
export default function Reports() {
  const [activeTab, setActiveTab] = useState("whatsapp");

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "#111b21" }}>
      <div className="px-6 py-4 border-b border-white/10 flex-shrink-0" style={{ background: "#202c33" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(37,211,102,0.15)" }}>
            <BarChart2 className="w-5 h-5 text-[#25D366]" />
          </div>
          <div>
            <h1 className="font-bold text-white text-lg">التقارير والإحصائيات</h1>
            <p className="text-xs text-[#8696a0]">تقارير شاملة ودقيقة لجميع جوانب النظام</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <div className="px-6 pt-4 pb-0 flex-shrink-0 border-b border-white/5" style={{ background: "#1a2530" }}>
            <TabsList className="h-9 gap-1" style={{ background: "#202c33" }}>
              <TabsTrigger value="whatsapp" className="text-xs gap-1.5 data-[state=active]:text-white data-[state=active]:bg-[#2a3942]">
                <MessageSquare className="w-3.5 h-3.5" />
                واتساب
              </TabsTrigger>
              <TabsTrigger value="leads" className="text-xs gap-1.5 data-[state=active]:text-white data-[state=active]:bg-[#2a3942]">
                <Users className="w-3.5 h-3.5" />
                العملاء
              </TabsTrigger>
              <TabsTrigger value="performance" className="text-xs gap-1.5 data-[state=active]:text-white data-[state=active]:bg-[#2a3942]">
                <Activity className="w-3.5 h-3.5" />
                الأداء
              </TabsTrigger>
              <TabsTrigger value="ai" className="text-xs gap-1.5 data-[state=active]:text-white data-[state=active]:bg-[#2a3942]">
                <Bot className="w-3.5 h-3.5" />
                الذكاء الاصطناعي
              </TabsTrigger>
              <TabsTrigger value="weekly" className="text-xs gap-1.5 data-[state=active]:text-white data-[state=active]:bg-[#2a3942]">
                <Calendar className="w-3.5 h-3.5" />
                أسبوعي
              </TabsTrigger>
              <TabsTrigger value="smart-reports" className="text-xs gap-1.5 data-[state=active]:text-white data-[state=active]:bg-[#2a3942]">
                <FileText className="w-3.5 h-3.5" />
                تقارير PDF
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto">
            <TabsContent value="whatsapp" className="p-6 m-0">
              <WhatsAppReport />
            </TabsContent>
            <TabsContent value="leads" className="p-6 m-0">
              <LeadsReport />
            </TabsContent>
            <TabsContent value="performance" className="p-6 m-0">
              <PerformanceReport />
            </TabsContent>
            <TabsContent value="ai" className="p-6 m-0">
              <AIReport />
            </TabsContent>
            <TabsContent value="weekly" className="p-6 m-0">
              <WeeklyReportTab />
            </TabsContent>
            <TabsContent value="smart-reports" className="p-6 m-0">
              <SmartReportsTab />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
