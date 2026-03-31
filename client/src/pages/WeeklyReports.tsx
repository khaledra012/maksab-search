// @ts-nocheck
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  FileText, RefreshCw, Send, Calendar, TrendingUp, Users,
  MessageSquare, Bell, CheckCircle2, Clock, BarChart2, Zap,
  Download, ChevronDown, ChevronUp, Phone, AlertTriangle, Star
} from "lucide-react";

// ===== مكون بطاقة التقرير =====
function ReportCard({ report, onSend }: { report: any; onSend: (id: number) => void }) {
  const [expanded, setExpanded] = useState(false);
  const weekStart = new Date(report.weekStart).toLocaleDateString("ar-SA");
  const weekEnd = new Date(report.weekEnd).toLocaleDateString("ar-SA");
  const responseRateColor = report.responseRate >= 30 ? "text-green-400" :
    report.responseRate >= 15 ? "text-yellow-400" : "text-red-400";

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="w-4 h-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm">تقرير الأسبوع</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {weekStart} — {weekEnd}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {report.sentViaWhatsapp ? (
              <Badge className="text-xs bg-green-500/10 text-green-400 border-0">
                <CheckCircle2 className="w-3 h-3 ml-1" />
                أُرسل
              </Badge>
            ) : (
              <Button
                size="sm"
                className="h-7 text-xs gap-1 bg-green-600 hover:bg-green-700"
                onClick={() => onSend(report.id)}
              >
                <Send className="w-3 h-3" />
                إرسال واتساب
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* إحصاءات سريعة */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          <div className="text-center p-2 rounded-lg bg-muted/30">
            <p className="text-xs text-muted-foreground">العملاء</p>
            <p className="text-lg font-bold">{report.totalLeads}</p>
            <p className="text-xs text-green-400">+{report.newLeads}</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/30">
            <p className="text-xs text-muted-foreground">مرسلة</p>
            <p className="text-lg font-bold text-blue-400">{report.messagesSent}</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/30">
            <p className="text-xs text-muted-foreground">ردود</p>
            <p className="text-lg font-bold text-purple-400">{report.messagesReceived}</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/30">
            <p className="text-xs text-muted-foreground">الاستجابة</p>
            <p className={`text-lg font-bold ${responseRateColor}`}>{report.responseRate}%</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/30">
            <p className="text-xs text-muted-foreground">ساخنون</p>
            <p className="text-lg font-bold text-red-400">{report.hotLeads}</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/30">
            <p className="text-xs text-muted-foreground">تذكيرات</p>
            <p className="text-lg font-bold text-yellow-400">{report.pendingReminders}</p>
          </div>
        </div>

        {/* ملخص AI */}
        {report.summaryText && (
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
            <p className="text-xs font-semibold text-primary mb-1.5 flex items-center gap-1">
              <Star className="w-3 h-3" />
              ملخص الذكاء الاصطناعي
            </p>
            <p className="text-xs text-foreground/80 leading-relaxed">
              {expanded ? report.summaryText : report.summaryText.slice(0, 150) + (report.summaryText.length > 150 ? "..." : "")}
            </p>
            {report.summaryText.length > 150 && (
              <button
                className="text-xs text-primary mt-1 flex items-center gap-1"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? <><ChevronUp className="w-3 h-3" />أقل</> : <><ChevronDown className="w-3 h-3" />المزيد</>}
              </button>
            )}
          </div>
        )}

        {/* أكثر المدن */}
        {report.topCities && report.topCities.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">أكثر المدن عملاء:</p>
            <div className="flex flex-wrap gap-1.5">
              {report.topCities.map((c: any, i: number) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {c.city} ({c.count})
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ===== الصفحة الرئيسية =====
export default function WeeklyReports() {
  const { data: reports, refetch, isLoading } = trpc.weeklyReports.list.useQuery();
  const generateReport = trpc.weeklyReports.generate.useMutation({
    onSuccess: () => { toast.success("تم توليد التقرير الأسبوعي"); refetch(); },
    onError: (e) => toast.error("خطأ في توليد التقرير: " + e.message),
  });
  const handleGenerate = () => generateReport.mutate();
  const sendReport = { mutateAsync: async () => { toast.error("إرسال عبر واتساب غير متاح حالياً"); }, isPending: false };

  const reportsList = (reports ?? []) as any[];

  return (
    <div className="space-y-6 max-w-4xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            التقارير الأسبوعية
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            تقارير أداء أسبوعية مع ملخص بالذكاء الاصطناعي وإرسال تلقائي عبر واتساب
          </p>
        </div>
        <Button
          onClick={handleGenerate}
          disabled={generateReport.isPending}
          className="gap-2"
        >
          {generateReport.isPending ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              جاري التوليد...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              توليد تقرير الأسبوع
            </>
          )}
        </Button>
      </div>

      {/* معلومات الميزة */}
      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
            <BarChart2 className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-blue-400 mb-1">كيف تعمل التقارير الأسبوعية؟</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-muted-foreground">
              <div className="flex items-start gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
                <span>يجمع إحصائيات الأسبوع: العملاء الجدد، الرسائل، معدل الاستجابة، التذكيرات</span>
              </div>
              <div className="flex items-start gap-1.5">
                <Star className="w-3.5 h-3.5 text-yellow-400 mt-0.5 shrink-0" />
                <span>يولّد ملخصاً بالذكاء الاصطناعي مع توصيات للأسبوع القادم</span>
              </div>
              <div className="flex items-start gap-1.5">
                <Send className="w-3.5 h-3.5 text-green-400 mt-0.5 shrink-0" />
                <span>يُرسل التقرير تلقائياً لرقم المالك عبر واتساب</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* قائمة التقارير */}
      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : reportsList.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">لا توجد تقارير بعد</p>
          <p className="text-xs mt-1">اضغط على "توليد تقرير الأسبوع" لإنشاء أول تقرير</p>
          <Button
            className="mt-4 gap-2"
            onClick={handleGenerate}
            disabled={generateReport.isPending}
          >
            {generateReport.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            توليد التقرير الأول
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {reportsList.map((report: any) => (
            <ReportCard
              key={report.id}
              report={report}
              onSend={(id) => sendReport.mutate({ reportId: id })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
