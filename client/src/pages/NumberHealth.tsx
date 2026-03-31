// @ts-nocheck
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Shield, ShieldAlert, ShieldCheck, ShieldX,
  TrendingDown, TrendingUp, RefreshCw, Settings,
  AlertTriangle, MessageSquare, Ban, Flag,
  Download, History, ChevronRight
} from "lucide-react";

const STATUS_CONFIG = {
  safe: { label: "آمن", color: "bg-emerald-500", textColor: "text-emerald-600", icon: ShieldCheck, badge: "default" as const },
  watch: { label: "مراقبة", color: "bg-yellow-500", textColor: "text-yellow-600", icon: Shield, badge: "secondary" as const },
  warning: { label: "تحذير", color: "bg-orange-500", textColor: "text-orange-600", icon: ShieldAlert, badge: "destructive" as const },
  danger: { label: "خطر", color: "bg-red-600", textColor: "text-red-600", icon: ShieldX, badge: "destructive" as const },
};

function ScoreGauge({ score, status }: { score: number; status: string }) {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.safe;
  const Icon = cfg.icon;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`relative w-20 h-20 rounded-full flex items-center justify-center border-4 ${
        status === "safe" ? "border-emerald-500 bg-emerald-50" :
        status === "watch" ? "border-yellow-500 bg-yellow-50" :
        status === "warning" ? "border-orange-500 bg-orange-50" :
        "border-red-600 bg-red-50"
      }`}>
        <span className={`text-2xl font-bold ${cfg.textColor}`}>{score}</span>
      </div>
      <div className="flex items-center gap-1">
        <Icon className={`w-4 h-4 ${cfg.textColor}`} />
        <span className={`text-sm font-medium ${cfg.textColor}`}>{cfg.label}</span>
      </div>
    </div>
  );
}

function AccountCard({ account, onRefresh }: { account: any; onRefresh: () => void }) {
  const [showEvents, setShowEvents] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [maxDaily, setMaxDaily] = useState(account.maxDailyMessages);
  const [minInterval, setMinInterval] = useState(account.minIntervalSeconds);

  const updateScore = trpc.numberHealth.updateScore.useMutation({
    onSuccess: (data) => {
      toast.success(`تم تحديث السكور: ${data.score}/100`);
      onRefresh();
    },
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

  const status = account.healthStatus as keyof typeof STATUS_CONFIG;
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.safe;
  const dailyPercent = account.maxDailyMessages > 0
    ? Math.round((account.dailySentCount / account.maxDailyMessages) * 100)
    : 0;

  return (
    <Card className={`border-2 ${
      status === "danger" ? "border-red-300 bg-red-50/30" :
      status === "warning" ? "border-orange-300 bg-orange-50/30" :
      status === "watch" ? "border-yellow-300 bg-yellow-50/30" :
      "border-emerald-200"
    }`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          {/* معلومات الرقم */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-base truncate">{account.label}</h3>
              <Badge variant={cfg.badge} className="shrink-0">{cfg.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-3 font-mono">{account.phoneNumber}</p>

            {/* إحصائيات سريعة */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="text-center p-2 bg-background rounded-lg border">
                <p className="text-lg font-bold text-blue-600">{account.dailySentCount}</p>
                <p className="text-xs text-muted-foreground">مُرسَل اليوم</p>
              </div>
              <div className="text-center p-2 bg-background rounded-lg border">
                <p className="text-lg font-bold text-red-500">{account.reportCount}</p>
                <p className="text-xs text-muted-foreground">إبلاغات</p>
              </div>
              <div className="text-center p-2 bg-background rounded-lg border">
                <p className="text-lg font-bold text-orange-500">{account.blockCount}</p>
                <p className="text-xs text-muted-foreground">حظر</p>
              </div>
            </div>

            {/* شريط الإرسال اليومي */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
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

          {/* السكور */}
          <ScoreGauge score={account.healthScore} status={status} />
        </div>

        {/* أزرار الإجراءات */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
          <Button
            size="sm" variant="outline"
            onClick={() => updateScore.mutate({ accountId: account.accountId })}
            disabled={updateScore.isPending}
          >
            <RefreshCw className={`w-3 h-3 mr-1 ${updateScore.isPending ? "animate-spin" : ""}`} />
            تحديث السكور
          </Button>

          <Button
            size="sm" variant="outline"
            className="text-orange-600 border-orange-300 hover:bg-orange-50"
            onClick={() => reportEvent.mutate({ accountId: account.accountId, eventType: "report" })}
          >
            <Flag className="w-3 h-3 mr-1" />
            إبلاغ
          </Button>

          <Button
            size="sm" variant="outline"
            className="text-red-600 border-red-300 hover:bg-red-50"
            onClick={() => reportEvent.mutate({ accountId: account.accountId, eventType: "block" })}
          >
            <Ban className="w-3 h-3 mr-1" />
            حظر
          </Button>

          {/* إعدادات الإرسال */}
          <Dialog open={showSettings} onOpenChange={setShowSettings}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Settings className="w-3 h-3 mr-1" />
                إعدادات
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>إعدادات الإرسال — {account.label}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label>الحد الأقصى للإرسال اليومي</Label>
                  <Input
                    type="number" min={1} max={1000}
                    value={maxDaily}
                    onChange={e => setMaxDaily(Number(e.target.value))}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    الموصى به: 100-200 رسالة/يوم للأرقام الجديدة
                  </p>
                </div>
                <div>
                  <Label>الفاصل الزمني بين الرسائل (ثانية)</Label>
                  <Input
                    type="number" min={5} max={300}
                    value={minInterval}
                    onChange={e => setMinInterval(Number(e.target.value))}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    الموصى به: 30-60 ثانية لتجنب الحظر
                  </p>
                </div>
                <Button
                  className="w-full"
                  onClick={() => updateSettings.mutate({
                    accountId: account.accountId,
                    maxDailyMessages: maxDaily,
                    minIntervalSeconds: minInterval,
                  })}
                  disabled={updateSettings.isPending}
                >
                  حفظ الإعدادات
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* تاريخ الأحداث */}
          <Button
            size="sm" variant="ghost"
            onClick={() => setShowEvents(!showEvents)}
          >
            <History className="w-3 h-3 mr-1" />
            السجل
          </Button>
        </div>

        {/* سجل الأحداث */}
        {showEvents && events && (
          <div className="mt-3 pt-3 border-t space-y-2 max-h-48 overflow-y-auto">
            {events.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">لا توجد أحداث مسجلة</p>
            ) : events.map(ev => (
              <div key={ev.id} className="flex items-start gap-2 text-xs">
                <span className={`shrink-0 w-2 h-2 rounded-full mt-1 ${
                  ev.eventType === "score_drop" || ev.eventType === "report" || ev.eventType === "block" ? "bg-red-400" :
                  ev.eventType === "score_rise" ? "bg-emerald-400" : "bg-yellow-400"
                }`} />
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{
                    ev.eventType === "report" ? "إبلاغ" :
                    ev.eventType === "block" ? "حظر" :
                    ev.eventType === "no_reply" ? "بدون رد" :
                    ev.eventType === "score_drop" ? `انخفاض: ${ev.scoreBefore}→${ev.scoreAfter}` :
                    ev.eventType === "score_rise" ? `ارتفاع: ${ev.scoreBefore}→${ev.scoreAfter}` :
                    ev.eventType
                  }</span>
                  {ev.description && <p className="text-muted-foreground truncate">{ev.description}</p>}
                </div>
                <span className="text-muted-foreground shrink-0">
                  {new Date(ev.createdAt).toLocaleDateString("ar-SA")}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function NumberHealth() {
  const { data: accounts, isLoading, refetch } = trpc.numberHealth.getAll.useQuery();
  const { data: summary } = trpc.numberHealth.getSummary.useQuery();
  const { data: backupLogs } = trpc.numberHealth.getBackupLogs.useQuery({ limit: 5 });

  const updateAll = trpc.numberHealth.updateAllScores.useMutation({
    onSuccess: (results) => {
      toast.success(`تم تحديث ${results.length} رقم`);
      refetch();
    },
  });

  const createBackup = trpc.numberHealth.createBackup.useMutation({
    onSuccess: (data) => {
      toast.success(`تم إنشاء النسخة الاحتياطية — الحجم: ${Math.round(data.size / 1024)} KB`);
      window.open(data.url, "_blank");
    },
    onError: (err) => toast.error("خطأ في النسخ الاحتياطي", { description: err.message }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* رأس الصفحة */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-7 h-7 text-primary" />
            صحة الأرقام الذكي
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            مراقبة وحماية أرقام الواتساب من الحظر
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => createBackup.mutate({})}
            disabled={createBackup.isPending}
          >
            <Download className={`w-4 h-4 mr-2 ${createBackup.isPending ? "animate-bounce" : ""}`} />
            نسخة احتياطية
          </Button>
          <Button
            onClick={() => updateAll.mutate()}
            disabled={updateAll.isPending}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${updateAll.isPending ? "animate-spin" : ""}`} />
            تحديث الكل
          </Button>
        </div>
      </div>

      {/* ملخص إجمالي */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="col-span-2 md:col-span-1 bg-gradient-to-br from-primary/10 to-primary/5">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-primary">{summary.avgScore}</p>
              <p className="text-sm text-muted-foreground">متوسط السكور</p>
            </CardContent>
          </Card>
          {[
            { key: "safe", label: "آمن", count: summary.safe, color: "text-emerald-600", bg: "bg-emerald-50" },
            { key: "watch", label: "مراقبة", count: summary.watch, color: "text-yellow-600", bg: "bg-yellow-50" },
            { key: "warning", label: "تحذير", count: summary.warning, color: "text-orange-600", bg: "bg-orange-50" },
            { key: "danger", label: "خطر", count: summary.danger, color: "text-red-600", bg: "bg-red-50" },
          ].map(item => (
            <Card key={item.key} className={item.bg}>
              <CardContent className="p-4 text-center">
                <p className={`text-3xl font-bold ${item.color}`}>{item.count}</p>
                <p className="text-sm text-muted-foreground">{item.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* تنبيه الأرقام الخطرة */}
      {summary && (summary.danger > 0 || summary.warning > 0) && (
        <div className={`flex items-center gap-3 p-4 rounded-lg border ${
          summary.danger > 0 ? "bg-red-50 border-red-200 text-red-800" : "bg-orange-50 border-orange-200 text-orange-800"
        }`}>
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">
            {summary.danger > 0
              ? `⚠️ ${summary.danger} رقم في خطر مرتفع — يُنصح بإيقاف الإرسال منها فوراً`
              : `${summary.warning} رقم يحتاج مراجعة — قلل الإرسال وراقب التطور`
            }
          </p>
        </div>
      )}

      {/* قائمة الأرقام */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {accounts?.map(account => (
          <AccountCard key={account.accountId} account={account} onRefresh={refetch} />
        ))}
        {(!accounts || accounts.length === 0) && (
          <div className="col-span-2 text-center py-12 text-muted-foreground">
            <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>لا توجد أرقام واتساب مسجلة</p>
            <p className="text-sm mt-1">أضف أرقاماً من صفحة إدارة الأرقام</p>
          </div>
        )}
      </div>

      {/* سجل النسخ الاحتياطية */}
      {backupLogs && backupLogs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Download className="w-4 h-4" />
              آخر النسخ الاحتياطية
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {backupLogs.map(log => (
                <div key={log.id} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      log.eventType === "score_rise" ? "bg-emerald-500" :
                      log.eventType === "block" ? "bg-red-500" :
                      "bg-yellow-500"
                    }`} />
                    <span>{log.eventType === "no_reply" ? "يومية" : log.eventType === "manual" ? "يدوية" : "أسبوعية"}</span>
                    {log.fileSize && (
                      <span className="text-muted-foreground">{Math.round(log.fileSize / 1024)} KB</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {new Date(log.createdAt).toLocaleDateString("ar-SA")}
                    </span>
                    {log.fileUrl && (
                      <Button size="sm" variant="ghost" asChild>
                        <a href={log.fileUrl} target="_blank" rel="noopener noreferrer">
                          <Download className="w-3 h-3" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
