import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Zap, Activity, MessageCircle, CheckCircle2, XCircle,
  Play, Square, RefreshCw, Trash2, Clock, TrendingUp,
  Smartphone, ArrowRight, AlertTriangle, Info
} from "lucide-react";

export default function Activation() {
  // ===== Queries =====
  const { data: settings, refetch: refetchSettings } = trpc.activation.getSettings.useQuery();
  const { data: stats, refetch: refetchStats } = trpc.activation.getStats.useQuery(
    undefined,
    { refetchInterval: 5000 }
  );
  const { data: allSessionsData } = trpc.wauto.allStatus.useQuery(
    undefined,
    { refetchInterval: 3000 }
  );

  // ===== Local State =====
  const [isActive, setIsActive] = useState(false);
  const [minDelay, setMinDelay] = useState(60);
  const [maxDelay, setMaxDelay] = useState(300);
  const [messagesPerDay, setMessagesPerDay] = useState(20);
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(22);
  const [messageStyle, setMessageStyle] = useState<"casual" | "business" | "mixed">("casual");
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // تحميل الإعدادات من قاعدة البيانات
  if (settings && !settingsLoaded) {
    setIsActive(settings.isActive);
    setMinDelay(settings.minDelaySeconds);
    setMaxDelay(settings.maxDelaySeconds);
    setMessagesPerDay(settings.messagesPerDay);
    setStartHour(settings.startHour);
    setEndHour(settings.endHour);
    setMessageStyle(settings.messageStyle as "casual" | "business" | "mixed");
    setSettingsLoaded(true);
  }

  // ===== Mutations =====
  const saveSettings = trpc.activation.saveSettings.useMutation({
    onSuccess: () => {
      toast.success(isActive ? "✅ تم تفعيل التنشيط التلقائي" : "⏸ تم إيقاف التنشيط", { description: "تم حفظ الإعدادات بنجاح" });
      refetchSettings();
      refetchStats();
    },
    onError: (err) => toast.error("خطأ", { description: err.message }),
  });

  const sendNow = trpc.activation.sendNow.useMutation({
    onSuccess: () => {
      toast.success("✅ تم إرسال رسالة تنشيط", { description: "تم إرسال رسالة تجريبية الآن" });
      refetchStats();
    },
    onError: (err) => toast.error("خطأ", { description: err.message }),
  });

  const clearLog = trpc.activation.clearLog.useMutation({
    onSuccess: () => {
      toast.success("✅ تم مسح السجل");
      refetchStats();
    },
  });

  // ===== Computed =====
  const sessions = (allSessionsData as any[] | undefined) ?? [];
  const connectedCount = sessions.filter((s: any) => s.status === "connected").length;
  const canActivate = connectedCount >= 2;

  const handleSave = () => {
    if (minDelay >= maxDelay) {
      toast.error("خطأ", { description: "الحد الأدنى يجب أن يكون أقل من الحد الأقصى" });
      return;
    }
    saveSettings.mutate({ isActive, minDelaySeconds: minDelay, maxDelaySeconds: maxDelay, messagesPerDay, startHour, endHour, messageStyle });
  };

  const formatTime = (hour: number) => {
    const period = hour < 12 ? "ص" : "م";
    const h = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${h}:00 ${period}`;
  };

  const formatDelay = (seconds: number) => {
    if (seconds < 60) return `${seconds} ثانية`;
    return `${Math.round(seconds / 60)} دقيقة`;
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="w-6 h-6 text-yellow-400" />
            تنشيط التواصل
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            إرسال رسائل تلقائية بين الأرقام المربوطة لإبقائها نشطة وتجنب الحظر
          </p>
        </div>
        <div className="flex items-center gap-2">
          {stats?.isRunning && (
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30 border animate-pulse">
              <Activity className="w-3 h-3 ml-1" />
              يعمل الآن
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => { refetchSettings(); refetchStats(); }}
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* تحذير إذا لم يكن هناك حسابان متصلان */}
      {!canActivate && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-400">تحتاج إلى حسابين متصلين على الأقل</p>
              <p className="text-xs text-muted-foreground mt-1">
                الحسابات المتصلة حالياً: {connectedCount}. يرجى ربط حسابين أو أكثر من صفحة واتساب لتفعيل هذه الميزة.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* إحصائيات سريعة */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-400">{connectedCount}</p>
            <p className="text-xs text-muted-foreground mt-1">حسابات متصلة</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-400">{stats?.today ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">رسائل اليوم</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-400">{stats?.success ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">رسائل ناجحة</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-purple-400">{stats?.total ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">إجمالي الرسائل</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* إعدادات التنشيط */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-400" />
              إعدادات التنشيط
            </CardTitle>
            <CardDescription>تحكم في طريقة إرسال رسائل التنشيط</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* تفعيل/إيقاف */}
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border">
              <div>
                <Label className="font-medium">تفعيل التنشيط التلقائي</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isActive ? "التنشيط مفعّل - الأرقام ترسل لبعضها" : "التنشيط متوقف"}
                </p>
              </div>
              <Switch
                checked={isActive}
                onCheckedChange={setIsActive}
                disabled={!canActivate && !isActive}
              />
            </div>

            {/* أسلوب الرسائل */}
            <div className="space-y-2">
              <Label>أسلوب الرسائل</Label>
              <Select value={messageStyle} onValueChange={(v) => setMessageStyle(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="casual">محادثة عادية (أهلاً، كيف الحال...)</SelectItem>
                  <SelectItem value="business">محادثة عمل (مرحبا، هل أنت متاح...)</SelectItem>
                  <SelectItem value="mixed">مزيج من الاثنين</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* التأخير بين الرسائل */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>الحد الأدنى للتأخير</Label>
                <span className="text-sm font-mono text-muted-foreground">{formatDelay(minDelay)}</span>
              </div>
              <Slider
                min={30}
                max={600}
                step={30}
                value={[minDelay]}
                onValueChange={([v]) => setMinDelay(v)}
                className="w-full"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>الحد الأقصى للتأخير</Label>
                <span className="text-sm font-mono text-muted-foreground">{formatDelay(maxDelay)}</span>
              </div>
              <Slider
                min={60}
                max={1800}
                step={60}
                value={[maxDelay]}
                onValueChange={([v]) => setMaxDelay(v)}
                className="w-full"
              />
            </div>

            {/* عدد الرسائل اليومية */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>رسائل يومية لكل رقم</Label>
                <span className="text-sm font-mono text-muted-foreground">{messagesPerDay} رسالة</span>
              </div>
              <Slider
                min={1}
                max={50}
                step={1}
                value={[messagesPerDay]}
                onValueChange={([v]) => setMessagesPerDay(v)}
                className="w-full"
              />
            </div>

            {/* ساعات العمل */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>بداية الإرسال</Label>
                <Select value={String(startHour)} onValueChange={(v) => setStartHour(Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem key={i} value={String(i)}>{formatTime(i)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>نهاية الإرسال</Label>
                <Select value={String(endHour)} onValueChange={(v) => setEndHour(Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{formatTime(i + 1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* ملخص الإعدادات */}
            <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  سيتم إرسال رسالة كل <strong>{formatDelay(minDelay)} - {formatDelay(maxDelay)}</strong> بين الساعة <strong>{formatTime(startHour)}</strong> و<strong>{formatTime(endHour)}</strong>، بحد أقصى <strong>{messagesPerDay} رسالة</strong> يومياً لكل رقم.
                </p>
              </div>
            </div>

            {/* أزرار */}
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={handleSave}
                disabled={saveSettings.isPending}
              >
                {isActive ? (
                  <><Play className="w-4 h-4 ml-2" />تفعيل وحفظ</>
                ) : (
                  <><Square className="w-4 h-4 ml-2" />إيقاف وحفظ</>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => sendNow.mutate()}
                disabled={sendNow.isPending || !canActivate}
                title="إرسال رسالة تنشيط الآن"
              >
                <Zap className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* سجل الرسائل */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-blue-400" />
                سجل رسائل التنشيط
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => clearLog.mutate()}
                disabled={clearLog.isPending}
                className="text-red-400 hover:text-red-300 h-7 px-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
            <CardDescription>آخر 20 رسالة تنشيط مُرسَلة</CardDescription>
          </CardHeader>
          <CardContent>
            {!stats?.recentMessages?.length ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">لا توجد رسائل تنشيط بعد</p>
                <p className="text-xs mt-1">فعّل التنشيط أو اضغط على زر البرق لإرسال رسالة تجريبية</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {stats.recentMessages.map((msg: any) => (
                  <div key={msg.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors">
                    <div className="flex-shrink-0 mt-0.5">
                      {msg.status === "sent" ? (
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                        <Smartphone className="w-3 h-3" />
                        <span className="truncate">{msg.fromAccountId.slice(-8)}</span>
                        <ArrowRight className="w-3 h-3" />
                        <span className="truncate">{msg.toAccountId.slice(-8)}</span>
                      </div>
                      <p className="text-xs truncate">{msg.message}</p>
                      {msg.errorMessage && (
                        <p className="text-xs text-red-400 mt-0.5">{msg.errorMessage}</p>
                      )}
                    </div>
                    <div className="flex-shrink-0 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* كيف يعمل */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-purple-400" />
            كيف تعمل ميزة تنشيط التواصل؟
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 rounded-lg bg-muted/20 border border-border/50 text-center space-y-2">
              <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto">
                <span className="text-yellow-400 font-bold text-sm">1</span>
              </div>
              <p className="text-sm font-medium">اختيار عشوائي</p>
              <p className="text-xs text-muted-foreground">يختار النظام رقماً مرسِلاً ورقماً مستقبِلاً بشكل عشوائي من الأرقام المتصلة</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/20 border border-border/50 text-center space-y-2">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto">
                <span className="text-blue-400 font-bold text-sm">2</span>
              </div>
              <p className="text-sm font-medium">رسائل طبيعية</p>
              <p className="text-xs text-muted-foreground">يُرسل رسائل محادثة طبيعية (تحيات، أسئلة عادية) تبدو كمحادثة حقيقية</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/20 border border-border/50 text-center space-y-2">
              <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
                <span className="text-green-400 font-bold text-sm">3</span>
              </div>
              <p className="text-sm font-medium">تأخير عشوائي</p>
              <p className="text-xs text-muted-foreground">يُضيف تأخيراً عشوائياً بين الرسائل لمحاكاة السلوك البشري الطبيعي</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
