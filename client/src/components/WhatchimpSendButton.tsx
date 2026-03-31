import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Send, Loader2, CheckCircle2, AlertCircle, Clock, XCircle,
  History, MessageSquare, FileText, Info,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface Props {
  leadId: number;
  phone: string;
  name: string;
  /** إذا مُرّر، يُفتح الـ Dialog مباشرةً (للـ auto-fallback من LeadDetail) */
  autoOpenTemplate?: boolean;
  onAutoOpenHandled?: () => void;
}

export default function WhatchimpSendButton({
  leadId,
  phone: _phone,
  name,
  autoOpenTemplate,
  onAutoOpenHandled,
}: Props) {
  const { data: configured } = trpc.whatchimp.isConfigured.useQuery();
  const utils = trpc.useUtils();

  const [showTemplateDialog, setShowTemplateDialog] = useState(
    autoOpenTemplate ?? false
  );
  // تتبع سبب فتح Dialog — لعرض تنبيه 24 ساعة سواء جاء من prop أو من sendMutation error
  const [openedDue24h, setOpenedDue24h] = useState(autoOpenTemplate ?? false);

  // مزامنة autoOpenTemplate — إذا تغيّر من false إلى true نفتح الـ Dialog
  useEffect(() => {
    if (autoOpenTemplate) {
      setShowTemplateDialog(true);
      setOpenedDue24h(true);
    }
  }, [autoOpenTemplate]);

  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [attachPdf, setAttachPdf] = useState(true); // PDF مُفعَّل افتراضياً
  const [pdfGenerating, setPdfGenerating] = useState(false);

  const { data: history, isLoading: historyLoading } = trpc.whatchimp.getSendHistory.useQuery(
    { leadId, limit: 5 },
    { enabled: !!configured?.configured }
  );

  const { data: templates, isLoading: templatesLoading } = trpc.whatchimp.getTemplates.useQuery(
    undefined,
    { enabled: showTemplateDialog && !!configured?.configured }
  );

  // رابط التقرير المحفوظ مسبقاً (إن وُجد)
  const { data: reportInfo } = trpc.pdfReport.getReportUrl.useQuery(
    { leadId },
    { enabled: showTemplateDialog }
  );

  const generateReportMutation = trpc.pdfReport.generateAndSave.useMutation();

  const sendTemplateMutation = trpc.whatchimp.sendTemplateMessage.useMutation({
    onSuccess: (res) => {
      const pdfNote = res.withPdf ? " مع تقرير PDF" : "";
      toast.success(`تم إرسال رسالة Template لـ ${name} بنجاح${pdfNote}`);
      utils.whatchimp.getSendHistory.invalidate({ leadId });
      setShowTemplateDialog(false);
      setSelectedTemplate("");
      setAttachPdf(false);
      onAutoOpenHandled?.();
    },
    onError: (e) => toast.error(e.message),
  });

  const hasExistingReport =
    reportInfo?.pdfGenerationStatus === "ready" && !!reportInfo?.pdfFileUrl;

  async function handleSendTemplate() {
    if (!selectedTemplate) return;
    let pdfUrl: string | undefined;
    if (attachPdf) {
      if (hasExistingReport) {
        pdfUrl = reportInfo!.pdfFileUrl!;
      } else {
        try {
          setPdfGenerating(true);
          const result = await generateReportMutation.mutateAsync({
            leadId,
            reportType: "client_facing",
          });
          pdfUrl = result.reportUrl;
        } catch {
          toast.error("فشل توليد تقرير PDF — سيتم الإرسال بدون تقرير");
          pdfUrl = undefined;
        } finally {
          setPdfGenerating(false);
        }
      }
    }
    sendTemplateMutation.mutate({
      leadId,
      templateName: selectedTemplate,
      languageCode: "ar",
      pdfUrl,
    });
  }

  const isSending = pdfGenerating || sendTemplateMutation.isPending;

  const sendContactMutation = trpc.whatchimp.sendLead.useMutation({
    onSuccess: (res) => {
      if (res.success) {
        toast.success(`تم إرسال جهة اتصال ${name} بنجاح`);
        utils.whatchimp.getSendHistory.invalidate({ leadId });
      } else {
        toast.error(res.error || "فشل الإرسال");
      }
    },
    onError: (e) => {
      const msg = e.message ?? "";
      if (
        msg.includes("24 hour") ||
        msg.includes("outside 24") ||
        msg.includes("template message") ||
        msg.includes("window is not allowed")
      ) {
        setOpenedDue24h(true);
        setShowTemplateDialog(true);
      } else {
        toast.error(e.message);
      }
    },
  });

  if (!configured?.configured) {
    return (
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <AlertCircle className="w-3 h-3" />
        Whatchimp غير مربوط — اذهب للإعدادات لربطه
      </p>
    );
  }

  const lastSent = history?.[0];
  const successCount = history?.filter(h => h.status === "success").length ?? 0;

  return (
    <div className="space-y-3">
      {/* أزرار الإرسال */}
      <div className="flex gap-2">
        {/* زر إرسال جهة الاتصال */}
        <button
          onClick={() => sendContactMutation.mutate({ leadId })}
          disabled={sendContactMutation.isPending}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all"
          style={{
            background: "oklch(0.55 0.2 145 / 0.15)",
            color: "oklch(0.65 0.2 145)",
            border: "1px solid oklch(0.55 0.2 145 / 0.3)",
            opacity: sendContactMutation.isPending ? 0.7 : 1,
          }}
        >
          {sendContactMutation.isPending ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Send className="w-3 h-3" />
          )}
          {lastSent?.status === "success" ? "إعادة إرسال" : "إرسال جهة اتصال"}
        </button>

        {/* زر إرسال Template */}
        <button
          onClick={() => setShowTemplateDialog(true)}
          disabled={sendTemplateMutation.isPending || isSending}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all"
          style={{
            background: "oklch(0.55 0.2 250 / 0.15)",
            color: "oklch(0.65 0.2 250)",
            border: "1px solid oklch(0.55 0.2 250 / 0.3)",
            opacity: (sendTemplateMutation.isPending || isSending) ? 0.7 : 1,
          }}
        >
          {sendTemplateMutation.isPending || isSending ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <MessageSquare className="w-3 h-3" />
          )}
          إرسال Template
        </button>
      </div>

      {/* سجل الإرسال */}
      {!historyLoading && history && history.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <History className="w-3 h-3" />
            سجل الإرسال ({successCount} ناجح من {history.length})
          </p>
          <div className="space-y-1">
            {history.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg"
                style={{ background: "oklch(0.15 0.01 240)" }}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {log.status === "success" ? (
                    <CheckCircle2 className="w-3 h-3 shrink-0" style={{ color: "oklch(0.65 0.18 145)" }} />
                  ) : log.status === "failed" ? (
                    <XCircle className="w-3 h-3 shrink-0" style={{ color: "oklch(0.65 0.2 25)" }} />
                  ) : (
                    <Clock className="w-3 h-3 shrink-0 text-muted-foreground" />
                  )}
                  <span className={log.status === "success" ? "" : "text-muted-foreground"}>
                    {log.status === "success" ? "نجح" : log.status === "failed" ? "فشل" : "تم التخطي"}
                  </span>
                  {log.errorMessage && (
                    <span className="text-muted-foreground truncate max-w-[110px]" title={log.errorMessage}>
                      — {log.errorMessage}
                    </span>
                  )}
                </div>
                <span className="text-muted-foreground shrink-0 text-[10px]">
                  {new Date(log.sentAt).toLocaleDateString("ar-SA", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Dialog اختيار الـ Template */}
      <Dialog
        open={showTemplateDialog}
        onOpenChange={(open) => {
          setShowTemplateDialog(open);
          if (!open) {
            setOpenedDue24h(false);
            onAutoOpenHandled?.();
          }
        }}
      >
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              إرسال Template لـ {name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* تنبيه نافذة 24 ساعة */}
            {openedDue24h && (
              <div
                className="flex items-start gap-2 text-xs p-3 rounded-lg"
                style={{
                  background: "oklch(0.55 0.18 55 / 0.12)",
                  border: "1px solid oklch(0.55 0.18 55 / 0.3)",
                  color: "oklch(0.75 0.15 55)",
                }}
              >
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <p>
                  انتهت نافذة الـ 24 ساعة — يمكنك التواصل مع العميل فقط عبر Template Message معتمد من Meta.
                </p>
              </div>
            )}

            <p className="text-sm text-muted-foreground">
              اختر الـ Template المعتمد الذي تريد إرساله للعميل عبر WhatsApp
            </p>

            {templatesLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                جاري تحميل الـ Templates...
              </div>
            ) : (
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر Template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates?.map((t) => (
                    <SelectItem key={t.id} value={t.name}>
                      <div className="flex flex-col items-start gap-0.5">
                        <span className="font-medium">{t.name}</span>
                        {t.category && (
                          <span className="text-xs text-muted-foreground">{t.category}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                  {templates?.length === 0 && (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      لا توجد templates معتمدة
                    </div>
                  )}
                </SelectContent>
              </Select>
            )}

            {/* خيار إرفاق تقرير PDF */}
            <div
              className="flex items-start gap-3 p-3 rounded-lg cursor-pointer select-none"
              style={{
                background: attachPdf
                  ? "oklch(0.55 0.2 145 / 0.1)"
                  : "oklch(0.18 0.01 240)",
                border: `1px solid ${attachPdf ? "oklch(0.55 0.2 145 / 0.35)" : "oklch(0.3 0.01 240)"}`,
              }}
              onClick={() => setAttachPdf(v => !v)}
            >
              <div
                className="w-4 h-4 rounded shrink-0 mt-0.5 flex items-center justify-center transition-all"
                style={{
                  background: attachPdf ? "oklch(0.55 0.2 145)" : "transparent",
                  border: `2px solid ${attachPdf ? "oklch(0.55 0.2 145)" : "oklch(0.45 0.02 240)"}`,
                }}
              >
                {attachPdf && (
                  <svg viewBox="0 0 10 8" className="w-2.5 h-2.5 fill-none stroke-white stroke-2">
                    <polyline points="1,4 4,7 9,1" />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" style={{ color: "oklch(0.65 0.18 145)" }} />
                  <span className="text-sm font-medium">إرفاق تقرير PDF</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {hasExistingReport
                    ? "سيُرسَل رابط التقرير في نص الرسالة كـ {{1}} — العميل يضغط عليه لفتح التقرير"
                    : "سيُولَّد تقرير تحليل العميل ويُرسَل رابطه في نص الرسالة كـ {{1}}"}
                </p>
                {hasExistingReport && (
                  <p className="text-xs mt-1" style={{ color: "oklch(0.65 0.18 145)" }}>
                    ✓ تقرير جاهز
                  </p>
                )}
              </div>
            </div>

            {selectedTemplate && (
              <div
                className="text-xs p-3 rounded-lg"
                style={{ background: "oklch(0.55 0.2 250 / 0.1)", border: "1px solid oklch(0.55 0.2 250 / 0.2)" }}
              >
                <p className="text-muted-foreground">
                  سيتم إرسال الـ template{" "}
                  <strong className="text-foreground">{selectedTemplate}</strong>{" "}
                  {attachPdf ? "مع رابط تقرير PDF في نص الرسالة" : "بدون تقرير PDF"}.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowTemplateDialog(false);
                onAutoOpenHandled?.();
              }}
            >
              إلغاء
            </Button>
            <Button
              disabled={!selectedTemplate || isSending}
              onClick={handleSendTemplate}
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin ml-1" />
                  {pdfGenerating ? "جاري توليد التقرير..." : "جاري الإرسال..."}
                </>
              ) : (
                <>
                  <MessageSquare className="w-4 h-4 ml-1" />
                  {attachPdf ? "إرسال مع PDF" : "إرسال"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
