// @ts-nocheck
import { trpc } from "@/lib/trpc";
import { useParams, useLocation } from "wouter";
import { useState, useEffect } from "react";
import {
  ArrowRight, Globe, Instagram, Twitter, Phone, MapPin, Zap, BarChart3, Mail,
  AlertTriangle, TrendingUp, Target, Star, CheckCircle, XCircle, Loader2,
  Edit2, Save, X, ExternalLink, RefreshCw, MessageCircle, Send, Copy, ChevronDown, MessagesSquare,
  Activity, Users, Clock, Brain, ChevronUp, Sparkles, FileText, Download, Eye, Monitor
} from "lucide-react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import WhatchimpSendButton from "@/components/WhatchimpSendButton";
// PHASE 6B — Scoring & Sales Brief components
import ScoreCard from "@/components/leads/ScoreCard";
import OpportunityList from "@/components/leads/OpportunityList";
import ReadinessIndicator from "@/components/leads/ReadinessIndicator";
import MissingFieldsPanel from "@/components/leads/MissingFieldsPanel";
import MissingFieldsSearchPanel from "@/components/leads/MissingFieldsSearchPanel";
import LeadEditPanel from "@/components/leads/LeadEditPanel";
import AutoSearchPanel from "@/components/leads/AutoSearchPanel";
import AuditSummaryCard from "@/components/leads/AuditSummaryCard";
import SalesBriefCard, { type SalesBriefResult } from "@/components/leads/SalesBriefCard";
import { PlatformCoverageCard } from "@/components/leads/PlatformCoverageCard";
import SeoAdvancedCard from "@/components/leads/SeoAdvancedCard";

function ScoreBar({ label, value, color }: { label: string; value: number | string | null | undefined; color: string }) {
  const numValue = value !== null && value !== undefined ? Number(value) : null;
  if (numValue === null || isNaN(numValue)) return null;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-32 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "oklch(0.18 0.02 240)" }}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(numValue / 10) * 100}%`, background: color }} />
      </div>
      <span className="text-xs font-bold w-8 text-right" style={{ color }}>{numValue.toFixed(1)}</span>
    </div>
  );
}

function ScoreCircle({ value, label }: { value: number | string | null | undefined; label: string }) {
  const numValue = value !== null && value !== undefined ? Number(value) : null;
  if (numValue === null || isNaN(numValue) || numValue === 0) return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-14 h-14 rounded-full border-2 border-border flex items-center justify-center">
        <span className="text-xs text-muted-foreground">—</span>
      </div>
      <span className="text-xs text-muted-foreground text-center">{label}</span>
    </div>
  );
  const color = numValue >= 7 ? "oklch(0.65 0.18 145)" : numValue >= 5 ? "oklch(0.78 0.16 75)" : "oklch(0.58 0.22 25)";
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-14 h-14 rounded-full flex items-center justify-center border-2 font-bold text-lg" style={{ borderColor: color, color }}>
        {numValue.toFixed(0)}
      </div>
      <span className="text-xs text-muted-foreground text-center">{label}</span>
    </div>
  );
}

export default function LeadDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const id = Number(params.id);

  const { data, isLoading, refetch } = trpc.leads.getFullDetails.useQuery({ id });
  const analyzeWebsite = trpc.analysis.analyzeWebsite.useMutation();
  const analyzeSocial = trpc.analysis.analyzeSocial.useMutation();
  const generateReport = trpc.analysis.generateFullReport.useMutation();
  const updateLead = trpc.leads.update.useMutation();
  const utils = trpc.useUtils();
  // ===== Bright Data Real Analysis =====
  const bdAnalyzeWebsite = trpc.brightDataAnalysis.analyzeWebsite.useMutation();
  const bdAnalyzeInstagram = trpc.brightDataAnalysis.analyzeInstagram.useMutation();
  const bdAnalyzeLinkedIn = trpc.brightDataAnalysis.analyzeLinkedIn.useMutation();
  const bdAnalyzeTwitter = trpc.brightDataAnalysis.analyzeTwitter.useMutation();
  const bdAnalyzeTikTok = trpc.brightDataAnalysis.analyzeTikTok.useMutation();
  const bdAnalyzeAll = trpc.brightDataAnalysis.analyzeAllPlatforms.useMutation();
  const [useBrightData, setUseBrightData] = useState(true);
  const [bdResults, setBdResults] = useState<Record<string, any>>({});

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [report, setReport] = useState<any>(null);
  const [analyzingPlatform, setAnalyzingPlatform] = useState<string | null>(null);
  // WhatsApp state
  const [waStatus, setWaStatus] = useState<"unknown" | "yes" | "no">("unknown");
  const [waMessage, setWaMessage] = useState("");
  const [waGenerating, setWaGenerating] = useState(false);
  const [waTone, setWaTone] = useState<"formal" | "friendly" | "direct">("friendly");
  const checkWhatsapp = trpc.whatsapp.check.useMutation();
  const updateWaStatus = trpc.whatsapp.updateStatus.useMutation();
  const generateWaMessage = trpc.whatsapp.generateMessage.useMutation();
  const logWaMessage = trpc.whatsapp.logMessage.useMutation();
  const sendOneWa = trpc.wauto.sendOne.useMutation();
  const { data: allSessionsData } = trpc.wauto.allStatus.useQuery(undefined, { refetchInterval: 5000 });
  const [waSending, setWaSending] = useState(false);

  // PDF Report state
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfSending, setPdfSending] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfCustomMessage, setPdfCustomMessage] = useState("");
  // Preview modal state
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  // نافذة تأكيد اكتمال البيانات
  const [showDataConfirmModal, setShowDataConfirmModal] = useState(false);
  // WhatsApp 24h fallback state
  const [autoOpenTemplate, setAutoOpenTemplate] = useState(false);
  // PHASE 6B — Scoring & Sales Brief state (owned by LeadDetail, passed down as props)
  const [scoreResult, setScoreResult] = useState<any>(null);
  const [briefResult, setBriefResult] = useState<SalesBriefResult | null>(null);
  const [isScoring, setIsScoring] = useState(false);
  const [isGeneratingBrief, setIsGeneratingBrief] = useState(false);
  const [seoAdvancedResult, setSeoAdvancedResult] = useState<any>(null);
  const [isRunningAdvancedSeo, setIsRunningAdvancedSeo] = useState(false);
  const runSeoAdvanced = trpc.seoAdvanced.analyze.useMutation();
  const { data: savedSeoAdvanced } = trpc.seoAdvanced.getLatest.useQuery({ leadId: id }, { enabled: !!id });
  const handleRunAdvancedSeo = async () => {
    if (!data?.lead?.website) { toast.error("لا يوجد موقع إلكتروني لهذا النشاط"); return; }
    setIsRunningAdvancedSeo(true);
    try {
      const result = await runSeoAdvanced.mutateAsync({
        leadId: id,
        url: data.lead.website,
        companyName: data.lead.companyName,
        businessType: data.lead.businessType,
        city: data.lead.city,
      });
      setSeoAdvancedResult(result.report);
      toast.success("تم تحليل SEO المتقدم بنجاح");
    } catch { toast.error("فشل تحليل SEO المتقدم"); }
    finally { setIsRunningAdvancedSeo(false); }
  };

  // تحميل نتيجة التقييم المحفوظة من DB عند فتح الصفحة
  const { data: savedScoreData } = trpc.leadIntelligence.getSavedScore.useQuery(
    { leadId: id },
    { enabled: !!id }
  );

  const scoreLeadMutation = trpc.leadIntelligence.scoreLeadById.useMutation({
    onSuccess: (result) => {
      setScoreResult(result);
      setIsScoring(false);
    },
    onError: () => setIsScoring(false),
  });
  const generateBriefMutation = trpc.leadIntelligence.generateSalesBrief.useMutation({
    onSuccess: (result) => {
      setBriefResult(result as SalesBriefResult);
      setIsGeneratingBrief(false);
    },
    onError: () => setIsGeneratingBrief(false),
  });
  // تحميل نتيجة التقييم المحفوظة من DB عند فتح الصفحة
  useEffect(() => {
    if (savedScoreData && !scoreResult) {
      setScoreResult(savedScoreData);
    }
  }, [savedScoreData]);

  // تحميل رابط PDF المحفوظ مسبقاً عند فتح صفحة العميل
  useEffect(() => {
    if (data?.lead?.pdfFileUrl && !pdfUrl) {
      setPdfUrl(data.lead.pdfFileUrl);
    }
  }, [data?.lead?.pdfFileUrl]);

  const handleRunScore = () => {
    setIsScoring(true);
    scoreLeadMutation.mutate({ leadId: id });
  };
  const handleGenerateBrief = () => {
    setIsGeneratingBrief(true);
    generateBriefMutation.mutate({ leadId: id });
  };
  const getReportHtml = trpc.report.getHtml.useMutation();
  const generatePDF = trpc.report.generatePDF.useMutation();
  const generateBeautifulReport = trpc.pdfReport.generateAndSave.useMutation();
  const sendPDFViaWhatsApp = trpc.report.generateAndSendViaWhatsApp.useMutation();
  const sendPdfViaBotMutation = trpc.whatchimp.sendPdfViaBot.useMutation();
  const { data: whatchimpConfigData } = trpc.whatchimp.isConfigured.useQuery();
  const isWhatchimpConfigured = whatchimpConfigData?.configured ?? false;
  const [botFlowSending, setBotFlowSending] = useState(false);
  const computeGapPercentages = trpc.report.computeGapPercentages.useMutation();
  const { data: companySettingsData } = trpc.companySettings.get.useQuery();
  const { data: reportStyleData } = trpc.reportStyle.get.useQuery();
  const { data: activeSeasonData } = trpc.seasons.getActiveForBusiness.useQuery(
    { businessType: data?.lead?.businessType || 'general' },
    { enabled: true }
  );
  const fetchClientLogoMutation = trpc.leads.fetchClientLogo.useMutation();
  const fetchPlacePhotosMutation = trpc.leads.fetchPlacePhotos.useMutation();
  const [showPhotoGallery, setShowPhotoGallery] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  // جلب بيانات المنافسين عند توفر بيانات العميل
  const { data: competitorsData } = trpc.leads.getCompetitors.useQuery(
    {
      leadId: id,
      businessType: data?.lead?.businessType || '',
      city: data?.lead?.city || '',
      limit: 5,
    },
    {
      enabled: !!data?.lead?.businessType && !!data?.lead?.city,
    }
  );

  const handleGeneratePDF = async () => {
    setPdfGenerating(true);
    try {
      // استخدام pdfReport.generateAndSave للحصول على التصميم الاحترافي الجميل
      const result = await generateBeautifulReport.mutateAsync({ leadId: id, reportType: "client_facing" });
      if (result.reportUrl) {
        setPdfUrl(result.reportUrl);
        // فتح التقرير في نافذة جديدة (HTML مع زر طباعة/حفظ PDF)
        window.open(result.reportUrl, "_blank");
        toast.success(`تم توليد التقرير لـ ${result.leadName} — افتح النافذة الجديدة واضغط "حفظ PDF"`);
      }
    } catch (e: any) {
      // fallback: استخدام report.generatePDF القديم
      try {
        const result2 = await generatePDF.mutateAsync({ leadId: id });
        if (result2.url) {
          setPdfUrl(result2.url);
          try {
            const response = await fetch(result2.url);
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = result2.filename || `تقرير-${data?.lead?.companyName || id}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
          } catch {
            window.open(result2.url, "_blank");
          }
          toast.success("تم توليد التقرير وبدأ التحميل تلقائياً");
        }
      } catch (e2: any) {
        toast.error("فشل توليد التقرير", { description: e2.message });
      }
    } finally {
      setPdfGenerating(false);
    }
  };
  const _handleGeneratePDF_legacy = async () => {
    try {
      const { generateLeadPDF } = await import("@/lib/generateLeadPDF");
      let aiGapPercentages: number[] | undefined;
      try {
        const lead = data?.lead;
        if (lead) {
          const gapNames: string[] = [];
          if (!lead.website) gapNames.push("غياب الموقع الإلكتروني");
          if (!lead.instagramUrl) gapNames.push("غياب الحضور على إنستغرام");
          if (!lead.tiktokUrl) gapNames.push("غياب الحضور على تيك توك");
          if (!lead.snapchatUrl) gapNames.push("غياب الحضور على سناب شات");
          if (!lead.verifiedPhone) gapNames.push("غياب معلومات التواصل الموثقة");
          gapNames.push("ضعف SEO ومحركات البحث");
          gapNames.push("ضعف التفاعل على السوشيال ميديا");
          if (gapNames.length > 0) {
            const result = await computeGapPercentages.mutateAsync({ leadId: lead.id, gaps: gapNames });
            aiGapPercentages = result.percentages;
          }
        }
      } catch {
        // فشل AI — سيستخدم generateLeadPDF النسب الاحتياطية
      }

      await generateLeadPDF({
        lead: data?.lead,
        websiteAnalysis: data?.websiteAnalysis,
        socialAnalyses: data?.socialAnalyses || [],
        report: report,
        company: companySettingsData,
        competitors: competitorsData || [],
        activeSeason: activeSeasonData?.active || null,
        upcomingSeasons: activeSeasonData?.upcoming || [],
        reportStyle: reportStyleData || null,
        aiGapPercentages,
      });
      toast.success("تم توليد التقرير — سيفتح في نافذة جديدة أو يُنزّل تلقائياً");
    } catch (e: any) {
      toast.error("فشل توليد التقرير", { description: e.message });
    } finally {
      setPdfGenerating(false);
    }
  };

  const handlePreviewPDF = async () => {
    setPdfGenerating(true);
    try {
      const result = await getReportHtml.mutateAsync({ leadId: id });
      setPreviewHtml(result.html);
      setShowPreviewModal(true);
    } catch (e: any) {
      toast.error("فشل فتح المعاينة", { description: e.message });
    } finally {
      setPdfGenerating(false);
    }
  };

  const handleSendPDFViaWhatsApp = async () => {
    if (!connectedSession) {
      toast.error("لا يوجد حساب واتساب متصل");
      return;
    }
    if (!data?.lead?.verifiedPhone) {
      toast.error("لا يوجد رقم هاتف للعميل");
      return;
    }
    setPdfSending(true);
    try {
      await sendPDFViaWhatsApp.mutateAsync({
        leadId: id,
      });
      toast.success("تم إرسال التقرير عبر واتساب بنجاح");
      setShowPdfModal(false);
    } catch (e: any) {
      toast.error("فشل إرسال التقرير", { description: e.message });
    } finally {
      setPdfSending(false);
    }
  };

  // ── إرسال PDF عبر WhatChimp Bot Flow (2 خطوات: Custom Field + trigger-bot) ──
  const handleSendPdfViaBot = async () => {
    if (!pdfUrl) {
      toast.error("يجب توليد التقرير أولاً قبل الإرسال");
      return;
    }
    if (!data?.lead?.verifiedPhone) {
      toast.error("لا يوجد رقم هاتف للعميل");
      return;
    }
    setBotFlowSending(true);
    try {
      await sendPdfViaBotMutation.mutateAsync({
        leadId: id,
        pdfUrl,
      });
      toast.success("تم إرسال التقرير عبر WhatChimp بنجاح ✅");
      setShowPdfModal(false);
    } catch (e: any) {
      toast.error("فشل الإرسال عبر WhatChimp", { description: e.message });
    } finally {
      setBotFlowSending(false);
    }
  };

  // تحليل السلوك
  const [behaviorAnalysis, setBehaviorAnalysis] = useState<any>(null);
  const [showBehaviorPanel, setShowBehaviorPanel] = useState(false);
  const [useRealData, setUseRealData] = useState(true);
  const analyzeBehavior = trpc.behaviorAnalysis.analyzeCustomer.useMutation();
  const analyzeWithRealData = trpc.behaviorAnalysis.analyzeWithRealData.useMutation();

  const isAnalyzing = analyzeBehavior.isPending || analyzeWithRealData.isPending;

  const handleAnalyzeBehavior = async () => {
    try {
      setShowBehaviorPanel(true);
      if (useRealData) {
        const result = await analyzeWithRealData.mutateAsync({ leadId: id });
        setBehaviorAnalysis(result);
        const sources = (result as any).realData?.availableSources || [];
        if (sources.length > 0) {
          toast.success(`تحليل بيانات حقيقية: ${sources.join(', ')}`);
        } else {
          toast.success("تم التحليل (لا توجد بيانات حقيقية متاحة)");
        }
      } else {
        const result = await analyzeBehavior.mutateAsync({ leadId: id });
        setBehaviorAnalysis(result);
        toast.success("تم تحليل السلوك الرقمي");
      }
    } catch (e: any) {
      toast.error(e.message || "فشل تحليل السلوك");
    }
  };

  // أول حساب متصل
  const connectedSession = ((allSessionsData as any[]) ?? []).find((s: any) => s.status === "connected");
  const isWaConnected = !!connectedSession;

  const handleCheckWhatsapp = async () => {
    if (!data?.lead?.verifiedPhone) { toast.error("لا يوجد رقم هاتف لهذا العميل"); return; }
    // فتح wa.me للتحقق فقط (ليس للإرسال)
    const phone = (data?.lead?.verifiedPhone || "").replace(/[^0-9]/g, "");
    window.open(`https://wa.me/${phone}`, "_blank");
    toast.info("تم فتح واتساب للتحقق - حدد الحالة بعد التحقق");
  };

  const handleGenerateWaMessage = async () => {
    if (!data?.lead?.verifiedPhone) { toast.error("لا يوجد رقم هاتف"); return; }
    setWaGenerating(true);
    try {
      const result = await generateWaMessage.mutateAsync({
        leadId: id,
        companyName: data?.lead?.companyName,
        businessType: data?.lead?.businessType,
        city: data?.lead?.city,
      });
      setWaMessage(result.message);
      toast.success("تم توليد الرسالة بالذكاء الاصطناعي");
    } catch { toast.error("فشل توليد الرسالة"); }
    finally { setWaGenerating(false); }
  };

  const handleSendWhatsapp = async () => {
    if (!data?.lead?.verifiedPhone || !waMessage) return;
    const phone = (data?.lead?.verifiedPhone || "").replace(/[^0-9]/g, "");
    if (isWaConnected && connectedSession) {
      // إرسال عبر النظام الداخلي
      setWaSending(true);
      try {
        await sendOneWa.mutateAsync({
          phone,
          message: waMessage,
          leadId: id,
        });
        await logWaMessage.mutateAsync({ leadId: id, phone, message: waMessage});
        toast.success("تم إرسال الرسالة عبر واتساب بنجاح");
        setWaMessage("");
      } catch (e: any) {
        toast.error("فشل الإرسال", { description: e.message });
      } finally {
        setWaSending(false);
      }
    } else {
      // لا يوجد اتصال - فتح المحادثة الداخلية
      const leadName = (data?.lead as any)?.businessName || data?.lead?.companyName || '';
      navigate(`/chats?phone=${encodeURIComponent(phone)}&name=${encodeURIComponent(leadName)}&message=${encodeURIComponent(waMessage)}`);
      toast.info("تم فتح المحادثة الداخلية");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <XCircle className="w-12 h-12 text-muted-foreground opacity-30" />
        <p className="text-muted-foreground">العميل غير موجود</p>
        <button onClick={() => navigate("/leads")} className="text-sm px-4 py-2 rounded-xl border border-border text-muted-foreground hover:bg-white/5">
          العودة للقائمة
        </button>
      </div>
    );
  }

  const { lead, websiteAnalysis, socialAnalyses: rawSocialAnalyses } = data;
  // إبقاء آخر تحليل لكل منصة فقط لتجنب المفاتيح المكررة
  const socialAnalyses = rawSocialAnalyses.reduce((acc: typeof rawSocialAnalyses, sa) => {
    const idx = acc.findIndex(x => x.platform === sa.platform);
    if (idx === -1) acc.push(sa);
    else if (sa.id > acc[idx].id) acc[idx] = sa; // احتفظ بالأحدث
    return acc;
  }, []);

   const handleAnalyzeWebsite = async () => {
    if (!lead.website) { toast.error("لا يوجد موقع إلكتروني لهذا النشاط"); return; }
    setAnalyzingPlatform("website");
    try {
      if (useBrightData) {
        const result = await bdAnalyzeWebsite.mutateAsync({ leadId: id, url: lead.website, companyName: lead.companyName, businessType: lead.businessType });
        setBdResults(prev => ({ ...prev, website: result }));
        toast.success(result.usedRealData ? "✓ تحليل بيانات حقيقية من Bright Data" : "تحليل بتقدير AI (تعذّر جلب الموقع)");
      } else {
        await analyzeWebsite.mutateAsync({ leadId: id, url: lead.website, companyName: lead.companyName, businessType: lead.businessType });
        toast.success("تم تحليل الموقع بنجاح");
      }
      utils.leads.getFullDetails.invalidate({ id });
      utils.leads.list.invalidate();
    } catch { toast.error("فشل تحليل الموقع"); }
    finally { setAnalyzingPlatform(null); }
  };
  const handleAnalyzeSocial = async (platform: "instagram" | "twitter" | "snapchat" | "tiktok" | "facebook", url: string) => {
    setAnalyzingPlatform(platform);
    try {
      if (useBrightData) {
        let result: any = null;
        if (platform === "instagram") result = await bdAnalyzeInstagram.mutateAsync({ leadId: id, profileUrl: url, companyName: lead.companyName, businessType: lead.businessType });
        else if (platform === "twitter") result = await bdAnalyzeTwitter.mutateAsync({ leadId: id, profileUrl: url, companyName: lead.companyName, businessType: lead.businessType });
        else if (platform === "tiktok") result = await bdAnalyzeTikTok.mutateAsync({ leadId: id, profileUrl: url, companyName: lead.companyName, businessType: lead.businessType });
        else if (platform === "linkedin") result = await bdAnalyzeLinkedIn.mutateAsync({ leadId: id, profileUrl: url, companyName: lead.companyName, businessType: lead.businessType });
        else await analyzeSocial.mutateAsync({ leadId: id, platform, profileUrl: url, companyName: lead.companyName, businessType: lead.businessType });
        if (result) {
          setBdResults(prev => ({ ...prev, [platform]: result }));
          const srcLabel = result.dataSource === "dataset_api" ? "✓ Dataset API (موثوق)" : result.dataSource === "scraper" ? "✓ Scraper" : "تقدير AI";
          const followInfo = result.followersCount > 0 ? ` — ${result.followersCount.toLocaleString("ar-SA")} متابع` : "";
          toast.success(`${srcLabel}${followInfo}`);
        } else {
          toast.success(`تم تحليل ${platform} بنجاح`);
        }
      } else {
        await analyzeSocial.mutateAsync({ leadId: id, platform, profileUrl: url, companyName: lead.companyName, businessType: lead.businessType });
        toast.success(`تم تحليل ${platform} بنجاح`);
      }
      utils.leads.getFullDetails.invalidate({ id });
    } catch { toast.error("فشل التحليل"); }
    finally { setAnalyzingPlatform(null); }
  };
  const handleAnalyzeAllPlatforms = async () => {
    // فحص اكتمال البيانات أولاً
    if (!showDataConfirmModal) {
      setShowDataConfirmModal(true);
      return;
    }
    setShowDataConfirmModal(false);
    setAnalyzingPlatform("all");
    try {
      const result = await bdAnalyzeAll.mutateAsync({ leadId: id });
      setBdResults(prev => ({ ...prev, all: result }));
      const { scrapedData } = result;
      const loaded = [scrapedData.websiteLoaded && "موقع", scrapedData.instagramLoaded && "إنستغرام", scrapedData.twitterLoaded && "تويتر", scrapedData.tiktokLoaded && "تيك توك", scrapedData.linkedinLoaded && "لينكد إن"].filter(Boolean);
      toast.success(loaded.length > 0 ? `✓ تم جلب بيانات حقيقية: ${loaded.join("، ")}` : "تحليل شامل بتقدير AI");
      utils.leads.getFullDetails.invalidate({ id });
    } catch (e: any) { toast.error(e.message || "فشل التحليل الشامل"); }
    finally { setAnalyzingPlatform(null); }
  };

  const handleGenerateReport = async () => {
    try {
      const result = await generateReport.mutateAsync({ leadId: id });
      setReport(result);
      toast.success("تم إنشاء التقرير الشامل");
    } catch { toast.error("فشل إنشاء التقرير"); }
  };

  const STAGE_OPTIONS = [
    { value: "new", label: "جديد", color: "oklch(0.65 0.05 240)" },
    { value: "contacted", label: "تم التواصل", color: "oklch(0.65 0.15 200)" },
    { value: "interested", label: "مهتم", color: "oklch(0.65 0.18 145)" },
    { value: "price_offer", label: "عرض سعر", color: "oklch(0.65 0.18 60)" },
    { value: "meeting", label: "اجتماع", color: "oklch(0.65 0.18 280)" },
    { value: "won", label: "عميل فعلي", color: "oklch(0.65 0.18 145)" },
    { value: "lost", label: "خسرناه", color: "oklch(0.55 0.18 25)" },
    { value: "deferred", label: "مؤجل", color: "oklch(0.65 0.18 60)" },
    { value: "cancelled", label: "ملغي التواصل", color: "oklch(0.55 0.2 25)" },
  ];

  const PRIORITY_OPTIONS = [
    { value: "high", label: "عالية", color: "oklch(0.65 0.18 25)" },
    { value: "medium", label: "متوسطة", color: "oklch(0.65 0.18 60)" },
    { value: "low", label: "منخفضة", color: "oklch(0.65 0.05 240)" },
  ];

  const handleEdit = () => {
    setEditForm({
      companyName: lead.companyName,
      businessType: lead.businessType,
      city: lead.city,
      district: lead.district || "",
      verifiedPhone: lead.verifiedPhone || "",
      email: (lead as any).email || "",
      website: lead.website || "",
      googleMapsUrl: lead.googleMapsUrl || "",
      instagramUrl: lead.instagramUrl || "",
      twitterUrl: lead.twitterUrl || "",
      snapchatUrl: (lead as any).snapchatUrl || "",
      tiktokUrl: (lead as any).tiktokUrl || "",
      facebookUrl: (lead as any).facebookUrl || "",
      linkedinUrl: (lead as any).linkedinUrl || "",
      crNumber: (lead as any).crNumber || "",
      notes: lead.notes || "",
      additionalNotes: (lead as any).additionalNotes || "",
      stage: (lead as any).stage || "new",
      priority: (lead as any).priority || "medium",
      nextStep: (lead as any).nextStep || "",
      nextFollowup: (lead as any).nextFollowup || undefined,
    });
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    const lead = data?.lead;
    const coreFieldsChanged = lead && [
      "companyName", "businessType", "city", "website",
      "instagramUrl", "twitterUrl", "tiktokUrl", "facebookUrl", "snapchatUrl",
      "additionalNotes"
    ].some(f => editForm[f] !== (lead as any)[f]);
    await updateLead.mutateAsync({
      id,
      ...editForm,
      ...(coreFieldsChanged && lead?.website ? { triggerReanalysis: true } : {})
    });
    if (coreFieldsChanged && lead?.website) {
      toast.success("تم التحديث — جاري إعادة التحليل تلقائياً...");
    } else {
      toast.success("تم التحديث");
    }
    setIsEditing(false);
    utils.leads.getFullDetails.invalidate({ id });
  };

  const statusColors: Record<string, string> = {
    pending: "oklch(0.55 0.01 240)",
    analyzing: "oklch(0.85 0.16 75)",
    completed: "oklch(0.75 0.18 145)",
    failed: "oklch(0.7 0.22 25)",
  };

  const socialPlatforms = [
    { key: "instagram", label: "إنستغرام", url: lead.instagramUrl },
    { key: "twitter", label: "تويتر", url: lead.twitterUrl },
    { key: "snapchat", label: "سناب شات", url: lead.snapchatUrl },
    { key: "tiktok", label: "تيك توك", url: lead.tiktokUrl },
    { key: "facebook", label: "فيسبوك", url: lead.facebookUrl },
  ].filter(p => p.url);

  return (
    <>
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/leads")} className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all">
          <ArrowRight className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-foreground truncate">{lead.companyName}</h1>
            <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: "oklch(0.18 0.02 240)", color: statusColors[lead.analysisStatus] }}>
              {lead.analysisStatus === "completed" ? "مُحلَّل" : lead.analysisStatus === "analyzing" ? "جاري التحليل" : lead.analysisStatus === "failed" ? "فشل" : "معلق"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{lead.businessType} · {lead.city}{lead.district ? ` · ${lead.district}` : ""}</p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {(lead as any).stage && (() => {
              const stageColors: Record<string, string> = { new: "oklch(0.65 0.05 240)", contacted: "oklch(0.65 0.15 200)", interested: "oklch(0.65 0.18 145)", price_offer: "oklch(0.65 0.18 60)", meeting: "oklch(0.65 0.18 280)", won: "oklch(0.65 0.18 145)", lost: "oklch(0.55 0.18 25)", deferred: "oklch(0.65 0.18 60)", cancelled: "oklch(0.55 0.2 25)" };
              const stageLabels: Record<string, string> = { new: "جديد", contacted: "تم التواصل", interested: "مهتم", price_offer: "عرض سعر", meeting: "اجتماع", won: "عميل فعلي", lost: "خسرناه", deferred: "مؤجل", cancelled: "ملغي التواصل" };
              const c = stageColors[(lead as any).stage] ?? "oklch(0.65 0.05 240)";
              return <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `color-mix(in oklch, ${c} 15%, transparent)`, color: c, border: `1px solid color-mix(in oklch, ${c} 30%, transparent)` }}>• {stageLabels[(lead as any).stage] ?? (lead as any).stage}</span>;
            })()}
            {(lead as any).priority && (() => {
              const priorityColors: Record<string, string> = { high: "oklch(0.65 0.18 25)", medium: "oklch(0.65 0.18 60)", low: "oklch(0.65 0.05 240)" };
              const priorityLabels: Record<string, string> = { high: "أولوية عالية", medium: "أولوية متوسطة", low: "أولوية منخفضة" };
              const c = priorityColors[(lead as any).priority] ?? "oklch(0.65 0.05 240)";
              return <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `color-mix(in oklch, ${c} 15%, transparent)`, color: c, border: `1px solid color-mix(in oklch, ${c} 30%, transparent)` }}>{priorityLabels[(lead as any).priority]}</span>;
            })()}
            {(lead as any).nextFollowup && (
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "oklch(0.18 0.02 240)", color: "oklch(0.65 0.05 240)" }}>
                ⏰ {new Date((lead as any).nextFollowup).toLocaleDateString("ar-SA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* زر تشغيل التقييم */}
          <button onClick={handleRunScore} disabled={isScoring}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{ background: isScoring ? "oklch(0.65 0.18 145 / 0.08)" : "oklch(0.65 0.18 145 / 0.2)", color: "oklch(0.65 0.18 145)", border: "1px solid oklch(0.65 0.18 145 / 0.4)" }}>
            {isScoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
            {isScoring ? "جاري التقييم..." : "تشغيل التقييم"}
          </button>
          {/* زر إنشاء ملخص المبيعات */}
          <button onClick={handleGenerateBrief} disabled={isGeneratingBrief}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{ background: isGeneratingBrief ? "oklch(0.78 0.16 75 / 0.08)" : "oklch(0.78 0.16 75 / 0.2)", color: "oklch(0.78 0.16 75)", border: "1px solid oklch(0.78 0.16 75 / 0.4)" }}>
            {isGeneratingBrief ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {isGeneratingBrief ? "جاري التوليد..." : "ملخص المبيعات"}
          </button>
          <button onClick={handleAnalyzeBehavior} disabled={analyzeBehavior.isPending}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all"
            style={{ background: "oklch(0.65 0.18 200 / 0.15)", color: "oklch(0.75 0.18 200)", border: "1px solid oklch(0.65 0.18 200 / 0.3)" }}>
            {analyzeBehavior.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
            تحليل السلوك
          </button>
          <button onClick={handleGenerateReport} disabled={generateReport.isPending}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all"
            style={{ background: "oklch(0.62 0.18 285 / 0.15)", color: "var(--brand-purple)", border: "1px solid oklch(0.62 0.18 285 / 0.3)" }}>
            {generateReport.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            تقرير شامل
          </button>
          <button onClick={handlePreviewPDF} disabled={pdfGenerating}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all"
            style={{ background: "oklch(0.62 0.18 285 / 0.15)", color: "oklch(0.72 0.18 285)", border: "1px solid oklch(0.62 0.18 285 / 0.3)" }}>
            {pdfGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
            معاينة
          </button>
          <button onClick={handleGeneratePDF} disabled={pdfGenerating}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all"
            style={{ background: "oklch(0.65 0.18 25 / 0.15)", color: "oklch(0.75 0.18 25)", border: "1px solid oklch(0.65 0.18 25 / 0.3)" }}>
            {pdfGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            PDF
          </button>
          <button onClick={handleEdit} className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all">
            <Edit2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ===== Quick Action Bar ===== */}
      <div className="flex items-center gap-2 p-3 rounded-2xl border overflow-x-auto" style={{ background: "oklch(0.10 0.015 240)", borderColor: "oklch(0.65 0.18 200 / 0.2)" }}>
        {/* شارة التقييم */}
        {scoreResult && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl flex-shrink-0" style={{ background: (() => { const p = scoreResult.score?.priority; return p === 'A' ? 'oklch(0.65 0.2 145 / 0.2)' : p === 'B' ? 'oklch(0.65 0.18 200 / 0.2)' : p === 'C' ? 'oklch(0.78 0.16 75 / 0.2)' : 'oklch(0.58 0.22 25 / 0.2)'; })(), color: (() => { const p = scoreResult.score?.priority; return p === 'A' ? 'oklch(0.65 0.2 145)' : p === 'B' ? 'oklch(0.65 0.18 200)' : p === 'C' ? 'oklch(0.78 0.16 75)' : 'oklch(0.58 0.22 25)'; })() }}>
            <Target className="w-3.5 h-3.5" />
            <span className="text-xs font-bold">{scoreResult.score?.priority ?? '—'}</span>
            <span className="text-xs opacity-70">{scoreResult.score?.value ?? '—'}</span>
          </div>
        )}
        <div className="h-5 w-px bg-border flex-shrink-0" />
        {/* الإجراءات الرئيسية */}
        <button onClick={handleRunScore} disabled={isScoring}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex-shrink-0"
          style={{ background: isScoring ? "oklch(0.65 0.18 145 / 0.08)" : "oklch(0.65 0.18 145 / 0.2)", color: "oklch(0.65 0.18 145)", border: "1px solid oklch(0.65 0.18 145 / 0.4)" }}>
          {isScoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Target className="w-3.5 h-3.5" />}
          {isScoring ? 'جاري التقييم...' : 'تشغيل التقييم'}
        </button>
        <button onClick={handleGenerateBrief} disabled={isGeneratingBrief}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex-shrink-0"
          style={{ background: isGeneratingBrief ? "oklch(0.78 0.16 75 / 0.08)" : "oklch(0.78 0.16 75 / 0.2)", color: "oklch(0.78 0.16 75)", border: "1px solid oklch(0.78 0.16 75 / 0.4)" }}>
          {isGeneratingBrief ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {isGeneratingBrief ? 'جاري التوليد...' : 'ملخص المبيعات'}
        </button>
        <button onClick={handleAnalyzeBehavior} disabled={analyzeBehavior.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex-shrink-0"
          style={{ background: "oklch(0.65 0.18 200 / 0.15)", color: "oklch(0.75 0.18 200)", border: "1px solid oklch(0.65 0.18 200 / 0.3)" }}>
          {analyzeBehavior.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
          تحليل السلوك
        </button>
        <button onClick={handleGenerateReport} disabled={generateReport.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex-shrink-0"
          style={{ background: "oklch(0.62 0.18 285 / 0.15)", color: "var(--brand-purple)", border: "1px solid oklch(0.62 0.18 285 / 0.3)" }}>
          {generateReport.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
          تقرير شامل
        </button>
        <div className="flex-1" />
        <button onClick={handlePreviewPDF} disabled={pdfGenerating}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex-shrink-0"
          style={{ background: "oklch(0.62 0.18 285 / 0.15)", color: "oklch(0.72 0.18 285)", border: "1px solid oklch(0.62 0.18 285 / 0.3)" }}>
          {pdfGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
          معاينة
        </button>
        <button onClick={handleGeneratePDF} disabled={pdfGenerating}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex-shrink-0"
          style={{ background: "oklch(0.65 0.18 25 / 0.2)", color: "oklch(0.75 0.18 25)", border: "1px solid oklch(0.65 0.18 25 / 0.4)" }}>
          {pdfGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
          تحميل PDF
        </button>
        {/* زر إرسال PDF عبر WhatChimp Bot Flow مباشرة */}
        {isWhatchimpConfigured && data?.lead?.verifiedPhone && pdfUrl && (
          <button
            onClick={handleSendPdfViaBot}
            disabled={botFlowSending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex-shrink-0"
            style={{ background: botFlowSending ? "oklch(0.45 0.22 145 / 0.08)" : "oklch(0.45 0.22 145 / 0.2)", color: "oklch(0.65 0.2 145)", border: "1px solid oklch(0.55 0.2 145 / 0.4)" }}
          >
            {botFlowSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            {botFlowSending ? 'جاري الإرسال...' : 'إرسال PDF واتساب'}
          </button>
        )}
      </div>
      {/* ===== END Quick Action Bar ===== */}

      {/* Edit form — LeadEditPanel */}
      {isEditing && lead && (
        <LeadEditPanel
          lead={lead}
          onClose={() => setIsEditing(false)}
          onSaved={() => { setIsEditing(false); refetch(); }}
        />
      )}
      {/* HIDDEN OLD EDIT FORM START */}
      {false && (
        <div className="rounded-2xl p-5 border space-y-4" style={{ background: "oklch(0.12 0.015 240)", borderColor: "oklch(0.65 0.18 200 / 0.3)" }}>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">تعديل البيانات</h3>
            <button onClick={() => setIsEditing(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { field: "companyName", label: "اسم النشاط", type: "text" },
              { field: "verifiedPhone", label: "الهاتف", type: "text" },
              { field: "email", label: "الإيميل", type: "text" },
              { field: "website", label: "الموقع", type: "text" },
              { field: "instagramUrl", label: "إنستغرام", type: "text" },
              { field: "twitterUrl", label: "تويتر", type: "text" },
              { field: "snapchatUrl", label: "سناب شات", type: "text" },
              { field: "tiktokUrl", label: "تيك توك", type: "text" },
              { field: "facebookUrl", label: "فيسبوك", type: "text" },
              { field: "linkedinUrl", label: "لينكد إن", type: "text" },
              { field: "googleMapsUrl", label: "Google Maps", type: "text" },
              { field: "crNumber", label: "رقم السجل التجاري", type: "text" },
            ].map(({ field, label }) => (
              <div key={field}>
                <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
                <input value={editForm[field] || ""} onChange={e => setEditForm((f: any) => ({ ...f, [field]: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-sm border border-border bg-background text-foreground focus:outline-none focus:border-primary" />
              </div>
            ))}
          </div>
          {/* التصنيف */}
          <div className="space-y-3 pt-2 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground">التصنيف والمتابعة</p>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">مرحلة العميل</label>
              <div className="flex flex-wrap gap-2">
                {STAGE_OPTIONS.map(opt => (
                  <button key={opt.value} type="button" onClick={() => setEditForm((f: any) => ({ ...f, stage: opt.value }))}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all border"
                    style={{ background: editForm.stage === opt.value ? `color-mix(in oklch, ${opt.color} 15%, transparent)` : "transparent", borderColor: editForm.stage === opt.value ? opt.color : "var(--border)", color: editForm.stage === opt.value ? opt.color : "var(--muted-foreground)" }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">الأولوية</label>
                <div className="flex gap-2">
                  {PRIORITY_OPTIONS.map(opt => (
                    <button key={opt.value} type="button" onClick={() => setEditForm((f: any) => ({ ...f, priority: opt.value }))}
                      className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all border"
                      style={{ background: editForm.priority === opt.value ? `color-mix(in oklch, ${opt.color} 15%, transparent)` : "transparent", borderColor: editForm.priority === opt.value ? opt.color : "var(--border)", color: editForm.priority === opt.value ? opt.color : "var(--muted-foreground)" }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">موعد المتابعة</label>
                <input type="datetime-local" value={editForm.nextFollowup ? new Date(editForm.nextFollowup).toISOString().slice(0, 16) : ""}
                  onChange={e => setEditForm((f: any) => ({ ...f, nextFollowup: e.target.value ? new Date(e.target.value).getTime() : undefined }))}
                  className="w-full px-3 py-1.5 rounded-xl text-xs border border-border bg-background text-foreground focus:outline-none" dir="ltr" />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">الخطوة التالية</label>
              <input value={editForm.nextStep || ""} onChange={e => setEditForm((f: any) => ({ ...f, nextStep: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl text-sm border border-border bg-background text-foreground focus:outline-none"
                placeholder="مثال: إرسال عرض سعر" />
            </div>
          </div>
          {/* حقل التوضيحات الإضافية للذكاء الاصطناعي */}
          <div className="space-y-2 pt-3 border-t border-border">
            <div className="flex items-center gap-2">
              <Brain className="w-3.5 h-3.5" style={{ color: "oklch(0.75 0.18 280)" }} />
              <label className="text-xs font-medium" style={{ color: "oklch(0.75 0.18 280)" }}>توضيحات إضافية للذكاء الاصطناعي</label>
            </div>
            <textarea
              value={editForm.additionalNotes || ""}
              onChange={e => setEditForm((f: any) => ({ ...f, additionalNotes: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 rounded-xl text-sm border bg-background text-foreground focus:outline-none resize-none"
              style={{ borderColor: "oklch(0.75 0.18 280 / 0.4)" }}
              placeholder="مثال: العميل يستهدف النساء 25-40 سنة • يريد التركيز على منتج معين • لديه منافسة شديدة من متجر X"
            />
            <p className="text-xs text-muted-foreground">سيأخذها الذكاء الاصطناعي بعين الاعتبار عند تحليل الموقع والتقرير</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSaveEdit} disabled={updateLead.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: "oklch(0.65 0.18 200)" }}>
              <Save className="w-4 h-4" />
              {updateLead.isPending ? "جاري الحفظ..." : "حفظ"}
            </button>
            <button onClick={() => setIsEditing(false)} className="px-4 py-2 rounded-xl text-sm border border-border text-muted-foreground hover:bg-white/5">إلغاء</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Left column - info */}
        <div className="col-span-1 space-y-4">
          {/* Contact card */}
          <div className="rounded-2xl p-4 border border-border space-y-3" style={{ background: "oklch(0.12 0.015 240)" }}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">معلومات الاتصال</h3>
              {/* شعار العميل */}
              <div className="flex items-center gap-2">
                {(lead as any).clientLogoUrl ? (
                  <img src={(lead as any).clientLogoUrl} alt={lead.companyName}
                    className="w-10 h-10 rounded-xl object-contain border border-border"
                    style={{ background: "oklch(0.08 0.01 240)" }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold"
                    style={{ background: "oklch(0.18 0.02 240)", color: "oklch(0.65 0.18 200)" }}>
                    {(lead.companyName || '?').charAt(0)}
                  </div>
                )}
                <div className="flex gap-1">
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetchClientLogoMutation.mutateAsync({
                          leadId: id,
                          website: lead.website || undefined,
                          instagramUrl: lead.instagramUrl || undefined,
                          companyName: lead.companyName,
                        });
                        if (res.success) {
                          toast.success('تم جلب الشعار بنجاح');
                          utils.leads.getFullDetails.invalidate({ id });
                        } else {
                          toast.error('لم يتم العثور على شعار');
                        }
                      } catch (e: any) {
                        toast.error('فشل جلب الشعار', { description: e.message });
                      }
                    }}
                    disabled={fetchClientLogoMutation.isPending}
                    className="text-xs px-2 py-1 rounded-lg transition-all"
                    style={{ background: "oklch(0.65 0.18 200 / 0.15)", color: "oklch(0.75 0.18 200)", border: "1px solid oklch(0.65 0.18 200 / 0.3)" }}
                    title="جلب الشعار تلقائياً">
                    {fetchClientLogoMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "🖼️"}
                  </button>
                  {/* زر جلب صور Google Maps */}
                  {lead.googleMapsUrl && (
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetchPlacePhotosMutation.mutateAsync({
                            leadId: id,
                            googleMapsUrl: lead.googleMapsUrl || undefined,
                          });
                          if (res.success && res.photos.length > 0) {
                            toast.success(`تم جلب ${res.photos.length} صورة من Google Maps`);
                            utils.leads.getFullDetails.invalidate({ id });
                          } else {
                            toast.error(res.message || 'لا توجد صور لهذا المكان');
                          }
                        } catch (e: any) {
                          toast.error('فشل جلب الصور', { description: e.message });
                        }
                      }}
                      disabled={fetchPlacePhotosMutation.isPending}
                      className="text-xs px-2 py-1 rounded-lg transition-all"
                      style={{ background: "oklch(0.65 0.22 25 / 0.15)", color: "oklch(0.75 0.22 25)", border: "1px solid oklch(0.65 0.22 25 / 0.3)" }}
                      title="جلب صور المكان من Google Maps">
                      {fetchPlacePhotosMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "📸"}
                    </button>
                  )}
                  {/* زر عرض المعرض */}
                  {(lead as any).placePhotos?.length > 0 && (
                    <button
                      onClick={() => setShowPhotoGallery(true)}
                      className="text-xs px-2 py-1 rounded-lg transition-all"
                      style={{ background: "oklch(0.65 0.18 145 / 0.15)", color: "oklch(0.65 0.18 145)", border: "1px solid oklch(0.65 0.18 145 / 0.3)" }}
                      title="عرض صور المكان">
                      🖼️ {(lead as any).placePhotos.length}
                    </button>
                  )}
                </div>
              </div>
            </div>
            {lead.verifiedPhone && (
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-foreground font-mono">{lead.verifiedPhone}</span>
              </div>
            )}
            {(lead as any).email && (
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <a href={`mailto:${(lead as any).email}`} className="text-sm font-mono hover:underline" style={{ color: "oklch(0.75 0.18 200)" }}>{(lead as any).email}</a>
              </div>
            )}
            {lead.googleMapsUrl && (
              <a href={lead.googleMapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: "var(--brand-red)" }} />
                <span className="text-sm" style={{ color: "var(--brand-red)" }}>Google Maps</span>
                <ExternalLink className="w-3 h-3" style={{ color: "var(--brand-red)" }} />
              </a>
            )}
            {lead.reviewCount !== null && lead.reviewCount !== undefined && (
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-foreground">{lead.reviewCount} تقييم</span>
              </div>
            )}
            {(lead as any).socialSince && (
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">ظهور على السوشيال منذ:</span>
                <span className="text-sm font-semibold" style={{ color: "var(--brand-cyan)" }}>{(lead as any).socialSince}</span>
              </div>
            )}
            {/* ملاحظات الفريق */}
            {lead.notes && (
              <div className="mt-2 p-3 rounded-xl space-y-1" style={{ background: "oklch(0.75 0.18 280 / 0.08)", border: "1px solid oklch(0.75 0.18 280 / 0.25)" }}>
                <p className="text-xs font-semibold flex items-center gap-1" style={{ color: "oklch(0.75 0.18 280)" }}>
                  <Brain className="w-3 h-3" />
                  ملاحظات الفريق
                </p>
                <p className="text-xs leading-relaxed" style={{ color: "oklch(0.75 0.18 280 / 0.9)" }}>{lead.notes}</p>
              </div>
            )}
          </div>

          {/* WhatsApp Section — hidden */}
          {false && <div className="rounded-2xl p-4 border space-y-3" style={{ background: "oklch(0.12 0.015 240)", borderColor: "oklch(0.55 0.2 145 / 0.3)" }}>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <MessageCircle className="w-4 h-4" style={{ color: "oklch(0.65 0.2 145)" }} />
              واتساب
            </h3>
            {!lead.verifiedPhone ? (
              <p className="text-xs text-muted-foreground">أضف رقم الهاتف أولاً لاستخدام واتساب</p>
            ) : (
              <>
                {/* WA status */}
                <div className="flex gap-1.5">
                  {(["yes", "no", "unknown"] as const).map(s => (
                    <button key={s} onClick={async () => { setWaStatus(s); await updateWaStatus.mutateAsync({ leadId: id, hasWhatsapp: s }); toast.success("تم تحديث الحالة"); }}
                      className="flex-1 py-1 rounded-lg text-xs transition-all"
                      style={waStatus === s ? { background: s === "yes" ? "oklch(0.55 0.2 145 / 0.3)" : s === "no" ? "oklch(0.58 0.22 25 / 0.3)" : "oklch(0.18 0.02 240)", color: s === "yes" ? "oklch(0.65 0.2 145)" : s === "no" ? "oklch(0.7 0.22 25)" : "oklch(0.6 0.01 240)", border: "1px solid currentColor" } : { background: "oklch(0.15 0.015 240)", color: "oklch(0.5 0.01 240)", border: "1px solid oklch(0.25 0.02 240)" }}>
                      {s === "yes" ? "✅ لديه" : s === "no" ? "❌ ليس لديه" : "❓ غير محدد"}
                    </button>
                  ))}
                </div>
                {/* حالة الاتصال */}
                <div className="flex items-center gap-1.5 py-1 px-2 rounded-lg text-xs" style={isWaConnected ? { background: "oklch(0.55 0.2 145 / 0.1)", color: "oklch(0.65 0.2 145)", border: "1px solid oklch(0.55 0.2 145 / 0.2)" } : { background: "oklch(0.18 0.02 240)", color: "oklch(0.5 0.01 240)", border: "1px solid oklch(0.25 0.02 240)" }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: isWaConnected ? "oklch(0.65 0.2 145)" : "oklch(0.55 0.22 25)" }} />
                  {isWaConnected ? `متصل — الإرسال عبر النظام` : "غير متصل — سيفتح واتساب خارجياً"}
                </div>
                {/* زر فتح المحادثة في الشات الداخلي */}
                <button
                  onClick={() => navigate(`/chats?phone=${encodeURIComponent(lead.verifiedPhone || '')}&name=${encodeURIComponent((lead as any).businessName || lead.companyName || '')}`)}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-medium transition-all"
                  style={{ background: "oklch(0.55 0.2 145 / 0.15)", color: "oklch(0.65 0.2 145)", border: "1px solid oklch(0.55 0.2 145 / 0.3)" }}>
                  <MessagesSquare className="w-3 h-3" />
                  فتح المحادثة
                </button>
                {/* Open WA direct - للتحقق فقط */}
                <button onClick={handleCheckWhatsapp}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-medium transition-all"
                  style={{ background: "oklch(0.15 0.015 240)", color: "oklch(0.55 0.01 240)", border: "1px solid oklch(0.25 0.02 240)" }}>
                  <MessageCircle className="w-3 h-3" />
                  فتح واتساب للتحقق فقط
                </button>
                {/* Message generator */}
                <div className="space-y-2">
                  <div className="flex gap-1">
                    {(["friendly", "formal", "direct"] as const).map(t => (
                      <button key={t} onClick={() => setWaTone(t)}
                        className="flex-1 py-1 rounded-lg text-xs transition-all"
                        style={waTone === t ? { background: "oklch(0.65 0.18 200 / 0.2)", color: "oklch(0.75 0.18 200)", border: "1px solid oklch(0.65 0.18 200 / 0.4)" } : { background: "oklch(0.15 0.015 240)", color: "oklch(0.5 0.01 240)", border: "1px solid oklch(0.25 0.02 240)" }}>
                        {t === "friendly" ? "ودي" : t === "formal" ? "رسمي" : "مباشر"}
                      </button>
                    ))}
                  </div>
                  <button onClick={handleGenerateWaMessage} disabled={waGenerating}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium transition-all"
                    style={{ background: "oklch(0.65 0.18 200 / 0.15)", color: "oklch(0.75 0.18 200)", border: "1px solid oklch(0.65 0.18 200 / 0.3)" }}>
                    {waGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                    توليد رسالة بالذكاء الاصطناعي
                  </button>
                  {waMessage && (
                    <>
                      <textarea value={waMessage} onChange={e => setWaMessage(e.target.value)} rows={5}
                        className="w-full px-3 py-2 rounded-xl text-xs border border-border bg-background text-foreground resize-none focus:outline-none focus:border-primary" />
                      <div className="flex gap-1.5">
                        <button onClick={() => { navigator.clipboard.writeText(waMessage); toast.success("تم النسخ"); }}
                          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs transition-all"
                          style={{ background: "oklch(0.15 0.015 240)", color: "oklch(0.6 0.01 240)", border: "1px solid oklch(0.25 0.02 240)" }}>
                          <Copy className="w-3 h-3" /> نسخ
                        </button>
                        <button onClick={handleSendWhatsapp} disabled={waSending}
                          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-semibold transition-all"
                          style={{ background: "oklch(0.55 0.2 145)", color: "white", opacity: waSending ? 0.7 : 1 }}>
                          {waSending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                          {isWaConnected ? "إرسال عبر النظام" : "فتح واتساب"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>}

          {/* Whatchimp Send Button */}
          {lead.verifiedPhone && (
            <div className="rounded-2xl p-4 border border-border space-y-2" style={{ background: "oklch(0.12 0.015 240)" }}>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Send className="w-3.5 h-3.5" style={{ color: "oklch(0.65 0.18 145)" }} />
                Whatchimp
              </h3>
              <WhatchimpSendButton
                leadId={id}
                phone={lead.verifiedPhone}
                name={(lead as any).businessName || lead.companyName || ""}
                autoOpenTemplate={autoOpenTemplate}
                onAutoOpenHandled={() => setAutoOpenTemplate(false)}
              />
            </div>
          )}
          {/* Platform Coverage Card */}
          <PlatformCoverageCard
            lead={lead}
            socialAnalyses={data?.socialAnalyses || []}
          />

          {/* Digital presence */}
          <div className="rounded-2xl p-4 border border-border space-y-3" style={{ background: "oklch(0.12 0.015 240)" }}>
            <h3 className="text-sm font-semibold text-foreground">الحضور الرقمي</h3>
            {/* Bright Data Toggle + Analyze All Button */}
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <div
                  onClick={() => setUseBrightData(v => !v)}
                  className="relative w-8 h-4 rounded-full transition-colors cursor-pointer"
                  style={{ background: useBrightData ? "oklch(0.65 0.18 145)" : "oklch(0.25 0.02 240)" }}
                >
                  <div className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all" style={{ left: useBrightData ? "calc(100% - 14px)" : "2px" }} />
                </div>
                <span className="text-xs" style={{ color: useBrightData ? "oklch(0.65 0.18 145)" : "var(--muted-foreground)" }}>
                  {useBrightData ? "✓ Bright Data" : "AI فقط"}
                </span>
              </label>
              <button
                onClick={handleAnalyzeAllPlatforms}
                disabled={analyzingPlatform === "all"}
                className="text-xs px-2 py-0.5 rounded-lg font-medium transition-all"
                style={{ background: "oklch(0.65 0.18 145 / 0.15)", color: "oklch(0.65 0.18 145)", border: "1px solid oklch(0.65 0.18 145 / 0.3)" }}
              >
                {analyzingPlatform === "all" ? <Loader2 className="w-3 h-3 animate-spin" /> : "تحليل شامل"}
              </button>
            </div>
            {lead.website ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4" style={{ color: "var(--brand-cyan)" }} />
                  <span className="text-xs text-foreground truncate max-w-24">موقع إلكتروني</span>
                </div>
                <div className="flex items-center gap-1">
                  <a href={lead.website} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                  </a>
                  <button onClick={handleAnalyzeWebsite} disabled={analyzingPlatform === "website"}
                    className="text-xs px-2 py-0.5 rounded-lg transition-all"
                    style={{ background: "oklch(0.65 0.18 200 / 0.15)", color: "var(--brand-cyan)", border: "1px solid oklch(0.65 0.18 200 / 0.3)" }}>
                    {analyzingPlatform === "website" ? <Loader2 className="w-3 h-3 animate-spin" /> : "حلّل"}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">لا يوجد موقع إلكتروني</p>
            )}
            {socialPlatforms.map(p => {
              const existing = socialAnalyses.find(s => s.platform === p.key);
              return (
                <div key={p.key} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Instagram className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-foreground">{p.label}</span>
                    {existing && <span className="text-xs font-bold" style={{ color: "var(--brand-green)" }}>{existing.overallScore?.toFixed(1)}</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    <a href={p.url!} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                    </a>
                    <button onClick={() => handleAnalyzeSocial(p.key as any, p.url!)} disabled={analyzingPlatform === p.key}
                      className="text-xs px-2 py-0.5 rounded-lg transition-all"
                      style={{ background: "oklch(0.65 0.18 200 / 0.15)", color: "var(--brand-cyan)", border: "1px solid oklch(0.65 0.18 200 / 0.3)" }}>
                      {analyzingPlatform === p.key ? <Loader2 className="w-3 h-3 animate-spin" /> : existing ? <RefreshCw className="w-3 h-3" /> : "حلّل"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Scores summary */}
          {lead.leadPriorityScore && (
            <div className="rounded-2xl p-4 border border-border" style={{ background: "oklch(0.12 0.015 240)" }}>
              <h3 className="text-sm font-semibold text-foreground mb-3">درجات التقييم</h3>
              <div className="flex justify-around">
                <ScoreCircle value={lead.leadPriorityScore} label="الأولوية" />
                <ScoreCircle value={lead.brandingQualityScore} label="الجودة" />
                <ScoreCircle value={lead.seasonalReadinessScore} label="الموسمية" />
              </div>
            </div>
          )}
        </div>

        {/* Right column - analysis */}
        <div className="col-span-2 space-y-4">

          {/* ===== PHASE 6B: التشخيص والتقييم والمبيعات (أول شيء يظهر) ===== */}
          <div className="rounded-2xl border overflow-hidden" style={{ background: "oklch(0.10 0.015 240)", borderColor: "oklch(0.65 0.18 145 / 0.25)" }}>
            {/* Section header */}
            <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "oklch(0.65 0.18 145 / 0.2)", background: "oklch(0.65 0.18 145 / 0.06)" }}>
              <h3 className="font-semibold text-foreground flex items-center gap-2 text-sm">
                <Target className="w-4 h-4" style={{ color: "oklch(0.65 0.18 145)" }} />
                التشخيص والتقييم
              </h3>
              <div className="flex items-center gap-2">
                {scoreResult && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "oklch(0.65 0.18 145 / 0.15)", color: "oklch(0.65 0.18 145)" }}>
                    درجة: {scoreResult.score?.value ?? "—"}
                  </span>
                )}
                <button onClick={handleRunScore} disabled={isScoring}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                  style={{ background: isScoring ? "oklch(0.65 0.18 145 / 0.05)" : "oklch(0.65 0.18 145 / 0.15)", color: "oklch(0.65 0.18 145)", border: "1px solid oklch(0.65 0.18 145 / 0.3)" }}>
                  {isScoring ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  {isScoring ? "جاري..." : "تشغيل التقييم"}
                </button>
              </div>
            </div>
            <div className="p-4 space-y-4">
              {/* Row 1: Readiness + Missing Fields */}
              <div className="grid grid-cols-2 gap-3">
                <ReadinessIndicator
                  analysisReadyFlag={lead.analysisReadyFlag}
                  partialAnalysisFlag={lead.partialAnalysisFlag}
                  analysisConfidenceScore={lead.analysisConfidenceScore}
                />
                <MissingFieldsPanel
                  missingDataFlags={lead.missingDataFlags as string[] | null | undefined}
                />
              </div>
              {/* Row 1.5: Missing Fields Search Panel (Quick) */}
              <MissingFieldsSearchPanel
                leadId={lead.id}
                missingDataFlags={lead.missingDataFlags as string[] | null | undefined}
                onFieldSaved={() => refetch()}
              />
              {/* Row 1.6: Auto Search Panel (Smart Multi-Layer) */}
              <AutoSearchPanel
                leadId={lead.id}
                leadName={lead.companyName}
                onFieldApplied={() => refetch()}
              />
              {/* Row 2: ScoreCard */}
              <ScoreCard
                scoreResult={scoreResult}
                isScoring={isScoring}
                onRunScore={handleRunScore}
              />
              {/* Row 3: OpportunityList */}
              {scoreResult !== null && (
                <OpportunityList opportunities={scoreResult.opportunities} />
              )}
              {/* Row 4: AuditSummaryCard */}
              <AuditSummaryCard lead={lead} />
            </div>
          </div>
          {/* ===== END PHASE 6B DIAGNOSIS ===== */}

          {/* ===== PHASE 6B SALES BRIEF ===== */}
          <div className="rounded-2xl border overflow-hidden" style={{ background: "oklch(0.10 0.015 240)", borderColor: "oklch(0.78 0.16 75 / 0.25)" }}>
            <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "oklch(0.78 0.16 75 / 0.2)", background: "oklch(0.78 0.16 75 / 0.06)" }}>
              <h3 className="font-semibold text-foreground flex items-center gap-2 text-sm">
                <Sparkles className="w-4 h-4" style={{ color: "oklch(0.78 0.16 75)" }} />
                ملخص المبيعات
              </h3>
              <button onClick={handleGenerateBrief} disabled={isGeneratingBrief}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                style={{ background: isGeneratingBrief ? "oklch(0.78 0.16 75 / 0.05)" : "oklch(0.78 0.16 75 / 0.15)", color: "oklch(0.78 0.16 75)", border: "1px solid oklch(0.78 0.16 75 / 0.3)" }}>
                {isGeneratingBrief ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                {isGeneratingBrief ? "جاري التوليد..." : "إنشاء الملخص"}
              </button>
            </div>
            <div className="p-4">
              <SalesBriefCard
                briefResult={briefResult}
                isGenerating={isGeneratingBrief}
                scoreResult={scoreResult}
                onGenerateBrief={handleGenerateBrief}
              />
            </div>
          </div>
          {/* ===== END PHASE 6B SALES BRIEF ===== */}
          {/* ===== SEO ADVANCED ANALYSIS ===== */}
          {(data?.lead?.website) && (
            <SeoAdvancedCard
              report={seoAdvancedResult ?? savedSeoAdvanced}
              isLoading={isRunningAdvancedSeo}
              onRunAnalysis={handleRunAdvancedSeo}
            />
          )}
          {/* ===== END SEO ADVANCED ===== */}

          {/* Marketing gaps */}
          {(lead.biggestMarketingGap || lead.revenueOpportunity || lead.suggestedSalesEntryAngle) && (
            <div className="rounded-2xl p-5 border border-border space-y-4" style={{ background: "oklch(0.12 0.015 240)" }}>
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" style={{ color: "var(--brand-gold)" }} />
                التحليل التسويقي
              </h3>
              {lead.biggestMarketingGap && (
                <div className="p-3 rounded-xl" style={{ background: "oklch(0.58 0.22 25 / 0.08)", border: "1px solid oklch(0.58 0.22 25 / 0.2)" }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: "var(--brand-red)" }}>أكبر ثغرة تسويقية</p>
                  <p className="text-sm text-foreground leading-relaxed">{lead.biggestMarketingGap}</p>
                </div>
              )}
              {lead.revenueOpportunity && (
                <div className="p-3 rounded-xl" style={{ background: "oklch(0.65 0.18 145 / 0.08)", border: "1px solid oklch(0.65 0.18 145 / 0.2)" }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: "var(--brand-green)" }}>فرصة الإيراد</p>
                  <p className="text-sm text-foreground leading-relaxed">{lead.revenueOpportunity}</p>
                </div>
              )}
              {lead.suggestedSalesEntryAngle && (
                <div className="p-3 rounded-xl" style={{ background: "oklch(0.65 0.18 200 / 0.08)", border: "1px solid oklch(0.65 0.18 200 / 0.2)" }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: "var(--brand-cyan)" }}>زاوية الدخول البيعية</p>
                  <p className="text-sm text-foreground leading-relaxed">{lead.suggestedSalesEntryAngle}</p>
                </div>
              )}
            </div>
          )}

          {/* Bright Data Results Panel */}
          {bdResults.all && (
            <div className="rounded-2xl border overflow-hidden" style={{ background: "oklch(0.12 0.015 240)", borderColor: "oklch(0.65 0.18 145 / 0.3)" }}>
              <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "oklch(0.65 0.18 145 / 0.2)", background: "oklch(0.65 0.18 145 / 0.06)" }}>
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Zap className="w-4 h-4" style={{ color: "oklch(0.65 0.18 145)" }} />
                  تقرير Bright Data الشامل
                </h3>
                <div className="flex items-center gap-2">
                  {/* مؤشرات المنصات المُجلَبة */}
                  {[{key: "websiteLoaded", label: "موقع"}, {key: "instagramLoaded", label: "IG"}, {key: "twitterLoaded", label: "X"}, {key: "tiktokLoaded", label: "TT"}, {key: "linkedinLoaded", label: "LI"}].map(p => (
                    <span key={p.key} className="text-xs px-1.5 py-0.5 rounded" style={{ background: bdResults.all.scrapedData[p.key] ? "oklch(0.65 0.18 145 / 0.2)" : "oklch(0.25 0.02 240)", color: bdResults.all.scrapedData[p.key] ? "oklch(0.65 0.18 145)" : "oklch(0.4 0.02 240)" }}>
                      {bdResults.all.scrapedData[p.key] ? "✓" : "—"} {p.label}
                    </span>
                  ))}
                </div>
              </div>
              <div className="p-5 space-y-4">
                {bdResults.all.report?.executiveSummary && (
                  <div className="p-3 rounded-xl" style={{ background: "oklch(0.65 0.18 145 / 0.06)", border: "1px solid oklch(0.65 0.18 145 / 0.15)" }}>
                    <p className="text-xs font-semibold mb-1" style={{ color: "oklch(0.65 0.18 145)" }}>الملخص التنفيذي</p>
                    <p className="text-sm text-foreground leading-relaxed">{bdResults.all.report.executiveSummary}</p>
                  </div>
                )}
                {bdResults.all.report?.salesScript && (
                  <div className="p-3 rounded-xl" style={{ background: "oklch(0.78 0.16 75 / 0.06)", border: "1px solid oklch(0.78 0.16 75 / 0.2)" }}>
                    <p className="text-xs font-semibold mb-1" style={{ color: "oklch(0.78 0.16 75)" }}>نص التواصل المقترح</p>
                    <p className="text-sm text-foreground leading-relaxed">{bdResults.all.report.salesScript}</p>
                    <button
                      onClick={() => { navigator.clipboard.writeText(bdResults.all.report.salesScript); toast.success("تم النسخ"); }}
                      className="mt-2 text-xs px-2 py-0.5 rounded flex items-center gap-1"
                      style={{ background: "oklch(0.78 0.16 75 / 0.15)", color: "oklch(0.78 0.16 75)" }}
                    >
                      <Copy className="w-3 h-3" /> نسخ
                    </button>
                  </div>
                )}
                {bdResults.all.report?.criticalGaps?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold mb-2" style={{ color: "oklch(0.58 0.22 25)" }}>الثغرات الحرجة</p>
                    <ul className="space-y-1">
                      {bdResults.all.report.criticalGaps.map((gap: string, i: number) => (
                        <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                          <span style={{ color: "oklch(0.58 0.22 25)" }}>•</span> {gap}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {/* أرقام المتابعين الحقيقية */}
                {(bdResults.all.scrapedData.instagramFollowers > 0 || bdResults.all.scrapedData.twitterFollowers > 0 || bdResults.all.scrapedData.tiktokFollowers > 0) && (
                  <div className="grid grid-cols-3 gap-2">
                    {bdResults.all.scrapedData.instagramFollowers > 0 && (
                      <div className="text-center p-2 rounded-lg" style={{ background: "oklch(0.18 0.02 240)" }}>
                        <p className="text-xs text-muted-foreground">IG متابعون</p>
                        <p className="text-sm font-bold text-foreground">{bdResults.all.scrapedData.instagramFollowers.toLocaleString()}</p>
                      </div>
                    )}
                    {bdResults.all.scrapedData.twitterFollowers > 0 && (
                      <div className="text-center p-2 rounded-lg" style={{ background: "oklch(0.18 0.02 240)" }}>
                        <p className="text-xs text-muted-foreground">X متابعون</p>
                        <p className="text-sm font-bold text-foreground">{bdResults.all.scrapedData.twitterFollowers.toLocaleString()}</p>
                      </div>
                    )}
                    {bdResults.all.scrapedData.tiktokFollowers > 0 && (
                      <div className="text-center p-2 rounded-lg" style={{ background: "oklch(0.18 0.02 240)" }}>
                        <p className="text-xs text-muted-foreground">TT متابعون</p>
                        <p className="text-sm font-bold text-foreground">{bdResults.all.scrapedData.tiktokFollowers.toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                )}
                {/* أرقام الهاتف المكتشفة */}
                {bdResults.all.scrapedData.discoveredPhones?.length > 0 && (
                  <div className="p-3 rounded-xl" style={{ background: "oklch(0.65 0.18 200 / 0.06)", border: "1px solid oklch(0.65 0.18 200 / 0.2)" }}>
                    <p className="text-xs font-semibold mb-1" style={{ color: "var(--brand-cyan)" }}>أرقام هاتف مكتشفة من الموقع</p>
                    <div className="flex flex-wrap gap-2">
                      {bdResults.all.scrapedData.discoveredPhones.map((phone: string, i: number) => (
                        <span key={i} className="text-xs px-2 py-0.5 rounded font-mono" style={{ background: "oklch(0.65 0.18 200 / 0.15)", color: "var(--brand-cyan)" }}>{phone}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          {/* Behavior Analysis Panel */}
          {showBehaviorPanel && (
            <div className="rounded-2xl border overflow-hidden" style={{ background: "oklch(0.12 0.015 240)", borderColor: "oklch(0.65 0.18 200 / 0.3)" }}>
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "oklch(0.65 0.18 200 / 0.2)", background: "oklch(0.65 0.18 200 / 0.06)" }}>
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Activity className="w-4 h-4" style={{ color: "oklch(0.75 0.18 200)" }} />
                  تحليل السلوك الرقمي
                </h3>
                <div className="flex items-center gap-2">
                  {/* زر تبديل البيانات الحقيقية / AI فقط */}
                  <button
                    onClick={() => setUseRealData(!useRealData)}
                    className="text-xs px-2 py-0.5 rounded-full transition-all"
                    style={{
                      background: useRealData ? "oklch(0.65 0.2 145 / 0.15)" : "oklch(0.65 0.05 240 / 0.15)",
                      color: useRealData ? "oklch(0.65 0.2 145)" : "oklch(0.65 0.05 240)",
                      border: `1px solid ${useRealData ? "oklch(0.65 0.2 145 / 0.3)" : "oklch(0.65 0.05 240 / 0.3)"}`
                    }}
                    title="تبديل بين البيانات الحقيقية والتحليل بالـ AI فقط">
                    {useRealData ? "📊 بيانات حقيقية" : "🤖 AI فقط"}
                  </button>
                  {behaviorAnalysis && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "oklch(0.65 0.18 200 / 0.15)", color: "oklch(0.75 0.18 200)" }}>
                      {new Date(behaviorAnalysis.analyzedAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                  <button onClick={handleAnalyzeBehavior} disabled={isAnalyzing}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-all"
                    title="إعادة التحليل">
                    {isAnalyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => setShowBehaviorPanel(false)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-all">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {isAnalyzing && !behaviorAnalysis ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <div className="relative">
                    <Brain className="w-10 h-10" style={{ color: "oklch(0.65 0.18 200 / 0.3)" }} />
                    <Loader2 className="w-5 h-5 animate-spin absolute -top-1 -right-1" style={{ color: "oklch(0.75 0.18 200)" }} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {useRealData ? "جاري جلب البيانات الحقيقية وتحليلها..." : "جاري تحليل السلوك الرقمي..."}
                  </p>
                  <p className="text-xs text-muted-foreground opacity-60">
                    {useRealData ? "يجلب بيانات TikTok وTwitter والباك لينك ثم يحللها (20-40 ثانية)" : "يستغرق 10-20 ثانية"}
                  </p>
                </div>
              ) : behaviorAnalysis ? (
                <div className="p-5 space-y-4">
                  {/* الملخص والدرجة */}
                  <div className="flex items-start gap-4">
                    <div className="flex flex-col items-center gap-1 flex-shrink-0">
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-2xl border-2"
                        style={{
                          borderColor: (behaviorAnalysis.analysis?.activityScore || 5) >= 7 ? "oklch(0.65 0.2 145)" : (behaviorAnalysis.analysis?.activityScore || 5) >= 5 ? "oklch(0.78 0.16 75)" : "oklch(0.58 0.22 25)",
                          color: (behaviorAnalysis.analysis?.activityScore || 5) >= 7 ? "oklch(0.65 0.2 145)" : (behaviorAnalysis.analysis?.activityScore || 5) >= 5 ? "oklch(0.78 0.16 75)" : "oklch(0.58 0.22 25)",
                          background: "oklch(0.14 0.015 240)"
                        }}>
                        {behaviorAnalysis.analysis?.activityScore || "—"}
                      </div>
                      <span className="text-xs text-muted-foreground">النشاط</span>
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">{behaviorAnalysis.analysis?.activityLevel}</span>
                        {behaviorAnalysis.analysis?.urgencyLevel && (
                          <span className="text-xs px-2 py-0.5 rounded-full"
                            style={{
                              background: behaviorAnalysis.analysis.urgencyLevel === "عاجل" ? "oklch(0.58 0.22 25 / 0.15)" : "oklch(0.78 0.16 75 / 0.15)",
                              color: behaviorAnalysis.analysis.urgencyLevel === "عاجل" ? "oklch(0.7 0.22 25)" : "oklch(0.78 0.16 75)"
                            }}>
                            ⚡ {behaviorAnalysis.analysis.urgencyLevel}
                          </span>
                        )}
                        {behaviorAnalysis.analysis?.responselikelihood && (
                          <span className="text-xs px-2 py-0.5 rounded-full"
                            style={{
                              background: behaviorAnalysis.analysis.responselikelihood === "عالية" ? "oklch(0.65 0.2 145 / 0.15)" : "oklch(0.65 0.05 240 / 0.15)",
                              color: behaviorAnalysis.analysis.responselikelihood === "عالية" ? "oklch(0.65 0.2 145)" : "oklch(0.65 0.05 240)"
                            }}>
                            احتمال الاستجابة: {behaviorAnalysis.analysis.responselikelihood}
                          </span>
                        )}
                      </div>
                      {behaviorAnalysis.analysis?.summary && (
                        <p className="text-xs text-muted-foreground leading-relaxed">{behaviorAnalysis.analysis.summary}</p>
                      )}
                    </div>
                  </div>

                  {/* المنصات المفضلة وأوقات التواصل */}
                  <div className="grid grid-cols-2 gap-3">
                    {behaviorAnalysis.analysis?.preferredPlatforms?.length > 0 && (
                      <div className="rounded-xl p-3 space-y-2" style={{ background: "oklch(0.14 0.015 240)" }}>
                        <p className="text-xs font-semibold" style={{ color: "oklch(0.75 0.18 200)" }}>
                          <Users className="w-3 h-3 inline ml-1" />
                          المنصات المفضلة
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {behaviorAnalysis.analysis.preferredPlatforms.map((p: string, i: number) => (
                            <span key={i} className="text-xs px-2 py-0.5 rounded-full" style={{ background: "oklch(0.65 0.18 200 / 0.12)", color: "oklch(0.75 0.18 200)", border: "1px solid oklch(0.65 0.18 200 / 0.2)" }}>
                              {p}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {behaviorAnalysis.analysis?.bestContactTimes?.length > 0 && (
                      <div className="rounded-xl p-3 space-y-2" style={{ background: "oklch(0.14 0.015 240)" }}>
                        <p className="text-xs font-semibold" style={{ color: "oklch(0.78 0.16 75)" }}>
                          <Clock className="w-3 h-3 inline ml-1" />
                          أوقات التواصل المثلى
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {behaviorAnalysis.analysis.bestContactTimes.map((t: string, i: number) => (
                            <span key={i} className="text-xs px-2 py-0.5 rounded-full" style={{ background: "oklch(0.78 0.16 75 / 0.12)", color: "oklch(0.78 0.16 75)", border: "1px solid oklch(0.78 0.16 75 / 0.2)" }}>
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* أسلوب التواصل */}
                  {behaviorAnalysis.analysis?.communicationStyle && (
                    <div className="rounded-xl p-3" style={{ background: "oklch(0.62 0.18 285 / 0.07)", border: "1px solid oklch(0.62 0.18 285 / 0.2)" }}>
                      <p className="text-xs font-semibold mb-1" style={{ color: "var(--brand-purple)" }}>
                        <Brain className="w-3 h-3 inline ml-1" />
                        أسلوب التواصل الأمثل
                      </p>
                      <p className="text-xs text-foreground leading-relaxed">{behaviorAnalysis.analysis.communicationStyle}</p>
                    </div>
                  )}

                  {/* الفرص والتوصيات */}
                  <div className="grid grid-cols-2 gap-3">
                    {behaviorAnalysis.analysis?.marketingOpportunities?.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold" style={{ color: "var(--brand-green)" }}>
                          <TrendingUp className="w-3 h-3 inline ml-1" />
                          الفرص التسويقية
                        </p>
                        {behaviorAnalysis.analysis.marketingOpportunities.slice(0, 3).map((o: string, i: number) => (
                          <p key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                            <span className="w-1 h-1 rounded-full flex-shrink-0 mt-1.5" style={{ background: "var(--brand-green)" }} />
                            {o}
                          </p>
                        ))}
                      </div>
                    )}
                    {behaviorAnalysis.analysis?.contactRecommendations?.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold" style={{ color: "oklch(0.75 0.18 200)" }}>
                          <Sparkles className="w-3 h-3 inline ml-1" />
                          توصيات التواصل
                        </p>
                        {behaviorAnalysis.analysis.contactRecommendations.slice(0, 3).map((r: string, i: number) => (
                          <p key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                            <span className="w-1 h-1 rounded-full flex-shrink-0 mt-1.5" style={{ background: "oklch(0.75 0.18 200)" }} />
                            {r}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* البيانات الحقيقية من APIs */}
                  {behaviorAnalysis.realData && (
                    <div className="space-y-3">
                      {/* TikTok الحقيقي */}
                      {behaviorAnalysis.realData.tiktok && (
                        <div className="rounded-xl p-3" style={{ background: "oklch(0.12 0.02 25 / 0.5)", border: "1px solid oklch(0.7 0.22 25 / 0.3)" }}>
                          <p className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: "oklch(0.8 0.2 25)" }}>
                            <span>🎵</span> TikTok - بيانات حقيقية
                          </p>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="text-center">
                              <p className="text-sm font-bold text-foreground">{behaviorAnalysis.realData.tiktok.followers.toLocaleString('ar-SA')}</p>
                              <p className="text-xs text-muted-foreground">متابع</p>
                            </div>
                            <div className="text-center">
                              <p className="text-sm font-bold text-foreground">{behaviorAnalysis.realData.tiktok.videoCount}</p>
                              <p className="text-xs text-muted-foreground">فيديو</p>
                            </div>
                            <div className="text-center">
                              <p className="text-sm font-bold text-foreground">{behaviorAnalysis.realData.tiktok.avgEngagementRate}%</p>
                              <p className="text-xs text-muted-foreground">تفاعل</p>
                            </div>
                          </div>
                          {behaviorAnalysis.realData.tiktok.verified && (
                            <span className="text-xs px-2 py-0.5 rounded-full mt-2 inline-block" style={{ background: "oklch(0.65 0.2 145 / 0.15)", color: "oklch(0.65 0.2 145)" }}>✓ موثق</span>
                          )}
                        </div>
                      )}

                      {/* Twitter الحقيقي */}
                      {behaviorAnalysis.realData.twitter && (
                        <div className="rounded-xl p-3" style={{ background: "oklch(0.12 0.02 200 / 0.5)", border: "1px solid oklch(0.65 0.18 200 / 0.3)" }}>
                          <p className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: "oklch(0.75 0.18 200)" }}>
                            <span>𝕏</span> Twitter/X - بيانات حقيقية
                          </p>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="text-center">
                              <p className="text-sm font-bold text-foreground">{behaviorAnalysis.realData.twitter.followers.toLocaleString('ar-SA')}</p>
                              <p className="text-xs text-muted-foreground">متابع</p>
                            </div>
                            <div className="text-center">
                              <p className="text-sm font-bold text-foreground">{behaviorAnalysis.realData.twitter.tweetsCount.toLocaleString('ar-SA')}</p>
                              <p className="text-xs text-muted-foreground">تغريدة</p>
                            </div>
                            <div className="text-center">
                              <p className="text-sm font-bold text-foreground">{behaviorAnalysis.realData.twitter.following.toLocaleString('ar-SA')}</p>
                              <p className="text-xs text-muted-foreground">يتابع</p>
                            </div>
                          </div>
                          {(behaviorAnalysis.realData.twitter.verified || behaviorAnalysis.realData.twitter.isBlueVerified) && (
                            <span className="text-xs px-2 py-0.5 rounded-full mt-2 inline-block" style={{ background: "oklch(0.65 0.2 145 / 0.15)", color: "oklch(0.65 0.2 145)" }}>✓ موثق</span>
                          )}
                        </div>
                      )}

                      {/* الباك لينك */}
                      {behaviorAnalysis.realData.backlinks && (
                        <div className="rounded-xl p-3" style={{ background: "oklch(0.12 0.02 285 / 0.5)", border: "1px solid oklch(0.62 0.18 285 / 0.3)" }}>
                          <p className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: "oklch(0.72 0.18 285)" }}>
                            <span>🔗</span> الباك لينك - بيانات حقيقية
                          </p>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="text-center">
                              <p className="text-sm font-bold text-foreground">{behaviorAnalysis.realData.backlinks.totalBacklinks}</p>
                              <p className="text-xs text-muted-foreground">رابط خارجي</p>
                            </div>
                            <div className="text-center">
                              <p className="text-sm font-bold" style={{ color: behaviorAnalysis.realData.backlinks.hasGoogleMyBusiness ? "oklch(0.65 0.2 145)" : "oklch(0.58 0.22 25)" }}>
                                {behaviorAnalysis.realData.backlinks.hasGoogleMyBusiness ? "✓" : "✗"}
                              </p>
                              <p className="text-xs text-muted-foreground">Google Maps</p>
                            </div>
                            <div className="text-center">
                              <p className="text-sm font-bold" style={{ color: behaviorAnalysis.realData.backlinks.hasSocialLinks ? "oklch(0.65 0.2 145)" : "oklch(0.58 0.22 25)" }}>
                                {behaviorAnalysis.realData.backlinks.hasSocialLinks ? "✓" : "✗"}
                              </p>
                              <p className="text-xs text-muted-foreground">سوشيال</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* مصادر البيانات */}
                      {behaviorAnalysis.realData.availableSources?.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-muted-foreground">مصادر البيانات:</span>
                          {behaviorAnalysis.realData.availableSources.map((src: string, i: number) => (
                            <span key={i} className="text-xs px-2 py-0.5 rounded-full" style={{ background: "oklch(0.65 0.2 145 / 0.1)", color: "oklch(0.65 0.2 145)", border: "1px solid oklch(0.65 0.2 145 / 0.2)" }}>
                              ✓ {src}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* نقاط القوة الرقمية */}
                  {behaviorAnalysis.analysis?.digitalStrengths?.length > 0 && (
                    <div className="rounded-xl p-3" style={{ background: "oklch(0.65 0.2 145 / 0.07)", border: "1px solid oklch(0.65 0.2 145 / 0.2)" }}>
                      <p className="text-xs font-semibold mb-2" style={{ color: "var(--brand-green)" }}>نقاط القوة الرقمية</p>
                      <div className="flex flex-wrap gap-1.5">
                        {behaviorAnalysis.analysis.digitalStrengths.map((s: string, i: number) => (
                          <span key={i} className="text-xs px-2 py-0.5 rounded-full" style={{ background: "oklch(0.65 0.2 145 / 0.12)", color: "oklch(0.65 0.2 145)", border: "1px solid oklch(0.65 0.2 145 / 0.2)" }}>
                            ✓ {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {/* Website analysis */}
          {websiteAnalysis && (
            <div className="rounded-2xl p-5 border border-border space-y-4" style={{ background: "oklch(0.12 0.015 240)" }}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Globe className="w-4 h-4" style={{ color: "var(--brand-cyan)" }} />
                  تحليل الموقع الإلكتروني
                </h3>
                <span className="text-lg font-bold" style={{ color: websiteAnalysis.overallScore && websiteAnalysis.overallScore >= 7 ? "var(--brand-green)" : websiteAnalysis.overallScore && websiteAnalysis.overallScore >= 5 ? "var(--brand-gold)" : "var(--brand-red)" }}>
                  {websiteAnalysis.overallScore?.toFixed(1)}/10
                </span>
              </div>
              {/* Screenshot الموقع */}
              {(websiteAnalysis as any).screenshotUrl && (
                <div className="rounded-xl overflow-hidden border" style={{ borderColor: "oklch(0.65 0.18 200 / 0.3)" }}>
                  <div className="flex items-center gap-2 px-3 py-2" style={{ background: "oklch(0.65 0.18 200 / 0.08)" }}>
                    <Monitor className="w-3.5 h-3.5" style={{ color: "oklch(0.65 0.18 200)" }} />
                    <span className="text-xs font-medium" style={{ color: "oklch(0.65 0.18 200)" }}>لقطة شاشة الموقع</span>
                  </div>
                  <img
                    src={(websiteAnalysis as any).screenshotUrl}
                    alt="لقطة شاشة الموقع"
                    className="w-full object-cover object-top"
                    style={{ maxHeight: "200px" }}
                    onError={(e) => { (e.target as HTMLElement).parentElement!.style.display = 'none'; }}
                  />
                </div>
              )}
              {websiteAnalysis.summary && <p className="text-sm text-muted-foreground leading-relaxed">{websiteAnalysis.summary}</p>}
              <div className="space-y-2">
                <ScoreBar label="سرعة التحميل" value={websiteAnalysis.loadSpeedScore} color="oklch(0.65 0.18 200)" />
                <ScoreBar label="تجربة الجوال" value={websiteAnalysis.mobileExperienceScore} color="oklch(0.62 0.18 285)" />
                <ScoreBar label="SEO" value={websiteAnalysis.seoScore} color="oklch(0.78 0.16 75)" />
                <ScoreBar label="جودة المحتوى" value={websiteAnalysis.contentQualityScore} color="oklch(0.65 0.18 145)" />
                <ScoreBar label="التصميم" value={websiteAnalysis.designScore} color="oklch(0.72 0.18 200)" />
                <ScoreBar label="وضوح العروض" value={websiteAnalysis.offerClarityScore} color="oklch(0.7 0.22 25)" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "صفحة موسمية", value: websiteAnalysis.hasSeasonalPage },
                  { label: "حجز مسبق", value: websiteAnalysis.hasOnlineBooking },
                  { label: "خيارات دفع", value: websiteAnalysis.hasPaymentOptions },
                  { label: "معلومات توصيل", value: websiteAnalysis.hasDeliveryInfo },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center gap-2 text-xs">
                    {value ? <CheckCircle className="w-3.5 h-3.5" style={{ color: "var(--brand-green)" }} /> : <XCircle className="w-3.5 h-3.5" style={{ color: "var(--brand-red)" }} />}
                    <span className={value ? "text-foreground" : "text-muted-foreground"}>{label}</span>
                  </div>
                ))}
              </div>
              {(websiteAnalysis.technicalGaps as string[] | null)?.length ? (
                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: "var(--brand-red)" }}>الثغرات التقنية</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(websiteAnalysis.technicalGaps as string[]).map((gap, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 rounded-full" style={{ background: "oklch(0.58 0.22 25 / 0.1)", color: "oklch(0.7 0.22 25)", border: "1px solid oklch(0.58 0.22 25 / 0.2)" }}>{gap}</span>
                    ))}
                  </div>
                </div>
              ) : null}
              {(websiteAnalysis.recommendations as string[] | null)?.length ? (
                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: "var(--brand-green)" }}>التوصيات</p>
                  <ul className="space-y-1">
                    {(websiteAnalysis.recommendations as string[]).map((rec, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                        <span className="mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--brand-green)", marginTop: "5px" }} />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}

          {/* Social analyses */}
          {socialAnalyses.length > 0 && (
            <div className="rounded-2xl border overflow-hidden" style={{ background: "oklch(0.10 0.015 240)", borderColor: "oklch(0.62 0.18 285 / 0.3)" }}>
              {/* Section header */}
              <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "oklch(0.62 0.18 285 / 0.2)", background: "oklch(0.62 0.18 285 / 0.06)" }}>
                <h3 className="font-semibold text-foreground flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4" style={{ color: "oklch(0.72 0.18 285)" }} />
                  تحليل السوشيال ميديا
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "oklch(0.62 0.18 285 / 0.15)", color: "oklch(0.72 0.18 285)" }}>
                  {socialAnalyses.length} منصة
                </span>
              </div>
              <div className="p-4 space-y-4">
          {socialAnalyses.map((sa) => {
            const platformConfig: Record<string, { label: string; color: string }> = {
              instagram: { label: "إنستغرام", color: "oklch(0.62 0.18 285)" },
              tiktok:    { label: "تيك توك",   color: "oklch(0.58 0.22 25)" },
              snapchat:  { label: "سناب شات",  color: "oklch(0.85 0.18 95)" },
              twitter:   { label: "تويتر/X",   color: "oklch(0.75 0.05 240)" },
              facebook:  { label: "فيسبوك",  color: "oklch(0.55 0.18 250)" },
            };
            const pc = platformConfig[sa.platform] || { label: sa.platform, color: "oklch(0.65 0.1 240)" };
            const hasRealData = (sa as any).followersCount > 0 || (sa as any).postsCount > 0 || (sa as any).engagementRate > 0;
            return (
            <div key={sa.id} className="rounded-2xl p-5 border space-y-4" style={{ background: "oklch(0.12 0.015 240)", borderColor: pc.color.replace(')', ' / 0.3)') }}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: pc.color }} />
                  {pc.label}
                  {hasRealData && (
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "oklch(0.55 0.18 145 / 0.15)", color: "oklch(0.65 0.18 145)" }}>✓ بيانات حقيقية</span>
                  )}
                  {sa.profileUrl && (
                    <a href={sa.profileUrl} target="_blank" rel="noopener noreferrer" className="opacity-60 hover:opacity-100 transition-opacity">
                      <ExternalLink className="w-3 h-3" style={{ color: pc.color }} />
                    </a>
                  )}
                </h3>
                {sa.overallScore !== null && sa.overallScore !== undefined ? (
                  <span className="text-lg font-bold" style={{ color: sa.overallScore >= 7 ? "var(--brand-green)" : sa.overallScore >= 5 ? "var(--brand-gold)" : "var(--brand-red)" }}>
                    {sa.overallScore.toFixed(1)}/10
                  </span>
                ) : hasRealData ? (
                  <span className="text-xs px-2 py-1 rounded-lg" style={{ background: "oklch(0.78 0.16 75 / 0.15)", color: "oklch(0.78 0.16 75)" }}>يحتاج تحليل</span>
                ) : null}
              </div>

              {/* بيانات حقيقية من Bright Data Dataset API */}
              {hasRealData && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 rounded-xl" style={{ background: pc.color.replace(')', ' / 0.06)') }}>
                  {(sa as any).followersCount > 0 && (
                    <div className="text-center p-2 rounded-lg" style={{ background: "oklch(0.1 0.01 240 / 0.6)" }}>
                      <p className="text-xs text-muted-foreground mb-0.5">المتابعون</p>
                      <p className="text-sm font-bold" style={{ color: pc.color }}>{(sa as any).followersCount.toLocaleString("ar-SA")}</p>
                    </div>
                  )}
                  {(sa as any).postsCount > 0 && (
                    <div className="text-center p-2 rounded-lg" style={{ background: "oklch(0.1 0.01 240 / 0.6)" }}>
                      <p className="text-xs text-muted-foreground mb-0.5">المنشورات</p>
                      <p className="text-sm font-bold" style={{ color: pc.color }}>{(sa as any).postsCount.toLocaleString("ar-SA")}</p>
                    </div>
                  )}
                  {(sa as any).engagementRate > 0 && (
                    <div className="text-center p-2 rounded-lg" style={{ background: "oklch(0.1 0.01 240 / 0.6)" }}>
                      <p className="text-xs text-muted-foreground mb-0.5">معدل التفاعل</p>
                      <p className="text-sm font-bold" style={{ color: pc.color }}>{(sa as any).engagementRate.toFixed(2)}%</p>
                    </div>
                  )}
                  {(sa as any).avgLikes > 0 && (
                    <div className="text-center p-2 rounded-lg" style={{ background: "oklch(0.1 0.01 240 / 0.6)" }}>
                      <p className="text-xs text-muted-foreground mb-0.5">متوسط الإعجابات</p>
                      <p className="text-sm font-bold" style={{ color: pc.color }}>{(sa as any).avgLikes.toLocaleString("ar-SA")}</p>
                    </div>
                  )}
                  {(sa as any).avgViews > 0 && (
                    <div className="text-center p-2 rounded-lg" style={{ background: "oklch(0.1 0.01 240 / 0.6)" }}>
                      <p className="text-xs text-muted-foreground mb-0.5">متوسط المشاهدات</p>
                      <p className="text-sm font-bold" style={{ color: pc.color }}>{(sa as any).avgViews.toLocaleString("ar-SA")}</p>
                    </div>
                  )}
                </div>
              )}

              {sa.summary && <p className="text-sm text-muted-foreground leading-relaxed">{sa.summary}</p>}
              {/* عرض درجات التحليل فقط إذا كانت متوفرة */}
              {(sa.postingFrequencyScore !== null || sa.engagementScore !== null || sa.contentQualityScore !== null || sa.contentStrategyScore !== null) ? (
                <div className="space-y-2">
                  <ScoreBar label="تكرار النشر" value={sa.postingFrequencyScore} color={pc.color} />
                  <ScoreBar label="التفاعل" value={sa.engagementScore} color="oklch(0.65 0.18 200)" />
                  <ScoreBar label="جودة المحتوى" value={sa.contentQualityScore} color="oklch(0.78 0.16 75)" />
                  <ScoreBar label="استراتيجية المحتوى" value={sa.contentStrategyScore} color="oklch(0.65 0.18 145)" />
                </div>
              ) : hasRealData ? (
                <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: "oklch(0.78 0.16 75 / 0.06)", border: "1px solid oklch(0.78 0.16 75 / 0.2)" }}>
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: "oklch(0.78 0.16 75)" }} />
                  <div>
                    <p className="text-xs font-medium" style={{ color: "oklch(0.78 0.16 75)" }}>تم جلب البيانات الحقيقية</p>
                    <p className="text-xs text-muted-foreground">اضغط "تحليل شامل" لتحليل هذه المنصة بالذكاء الاصطناعي</p>
                  </div>
                </div>
              ) : null}
              {(sa.postingFrequencyScore !== null || sa.engagementScore !== null) && (
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "محتوى موسمي", value: sa.hasSeasonalContent },
                  { label: "وضوح الأسعار", value: sa.hasPricingContent },
                  { label: "Call To Action", value: sa.hasCallToAction },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center gap-1.5 text-xs">
                    {value ? <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--brand-green)" }} /> : <XCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--brand-red)" }} />}
                    <span className={value ? "text-foreground" : "text-muted-foreground"}>{label}</span>
                  </div>
                ))}
              </div>
              )}
              {(sa.gaps as string[] | null)?.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {(sa.gaps as string[]).map((gap, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 rounded-full" style={{ background: "oklch(0.58 0.22 25 / 0.1)", color: "oklch(0.7 0.22 25)", border: "1px solid oklch(0.58 0.22 25 / 0.2)" }}>{gap}</span>
                  ))}
                </div>
              ) : null}
            </div>
            );
          })}
              </div>
            </div>
          )}

          {/* Instagram Dataset API Results Card */}
          {bdResults.instagram && bdResults.instagram.followersCount > 0 && (
            <div className="rounded-2xl border overflow-hidden" style={{ background: "oklch(0.12 0.015 240)", borderColor: "oklch(0.62 0.18 285 / 0.35)" }}>
              <div className="flex items-center gap-2 px-5 py-3 border-b" style={{ borderColor: "oklch(0.62 0.18 285 / 0.2)", background: "oklch(0.62 0.18 285 / 0.06)" }}>
                <Instagram className="w-4 h-4" style={{ color: "oklch(0.72 0.18 285)" }} />
                <span className="font-semibold text-foreground text-sm">بيانات إنستغرام الحقيقية</span>
                <span className="text-xs px-2 py-0.5 rounded-full ml-auto" style={{ background: bdResults.instagram.dataSource === "dataset_api" ? "oklch(0.65 0.18 145 / 0.15)" : "oklch(0.65 0.18 200 / 0.15)", color: bdResults.instagram.dataSource === "dataset_api" ? "oklch(0.65 0.18 145)" : "oklch(0.65 0.18 200)" }}>
                  {bdResults.instagram.dataSource === "dataset_api" ? "Dataset API" : bdResults.instagram.dataSource === "scraper" ? "Scraper" : "AI"}
                </span>
              </div>
              <div className="p-5 grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl" style={{ background: "oklch(0.62 0.18 285 / 0.06)", border: "1px solid oklch(0.62 0.18 285 / 0.15)" }}>
                  <p className="text-xs text-muted-foreground mb-1">المتابعون</p>
                  <p className="text-xl font-bold" style={{ color: "oklch(0.72 0.18 285)" }}>{bdResults.instagram.followersCount.toLocaleString("ar-SA")}</p>
                </div>
                <div className="p-3 rounded-xl" style={{ background: "oklch(0.62 0.18 285 / 0.06)", border: "1px solid oklch(0.62 0.18 285 / 0.15)" }}>
                  <p className="text-xs text-muted-foreground mb-1">المنشورات</p>
                  <p className="text-xl font-bold" style={{ color: "oklch(0.72 0.18 285)" }}>{bdResults.instagram.postsCount?.toLocaleString("ar-SA") || "—"}</p>
                </div>
                {bdResults.instagram.avgEngagement && (
                  <div className="p-3 rounded-xl" style={{ background: "oklch(0.65 0.18 145 / 0.06)", border: "1px solid oklch(0.65 0.18 145 / 0.15)" }}>
                    <p className="text-xs text-muted-foreground mb-1">متوسط التفاعل</p>
                    <p className="text-xl font-bold" style={{ color: "oklch(0.65 0.18 145)" }}>{(bdResults.instagram.avgEngagement * 100).toFixed(2)}%</p>
                  </div>
                )}
                {bdResults.instagram.businessCategory && (
                  <div className="p-3 rounded-xl" style={{ background: "oklch(0.78 0.16 75 / 0.06)", border: "1px solid oklch(0.78 0.16 75 / 0.15)" }}>
                    <p className="text-xs text-muted-foreground mb-1">الفئة التجارية</p>
                    <p className="text-sm font-semibold" style={{ color: "oklch(0.78 0.16 75)" }}>{bdResults.instagram.businessCategory}</p>
                  </div>
                )}
                {bdResults.instagram.businessEmail && (
                  <div className="col-span-2 p-3 rounded-xl" style={{ background: "oklch(0.65 0.18 200 / 0.06)", border: "1px solid oklch(0.65 0.18 200 / 0.15)" }}>
                    <p className="text-xs text-muted-foreground mb-1">البريد الإلكتروني التجاري</p>
                    <p className="text-sm font-mono" style={{ color: "oklch(0.75 0.18 200)" }}>{bdResults.instagram.businessEmail}</p>
                  </div>
                )}
                {bdResults.instagram.businessPhone && (
                  <div className="col-span-2 p-3 rounded-xl" style={{ background: "oklch(0.65 0.18 200 / 0.06)", border: "1px solid oklch(0.65 0.18 200 / 0.15)" }}>
                    <p className="text-xs text-muted-foreground mb-1">رقم الهاتف التجاري</p>
                    <p className="text-sm font-mono" style={{ color: "oklch(0.75 0.18 200)" }}>{bdResults.instagram.businessPhone}</p>
                  </div>
                )}
                {bdResults.instagram.isVerified && (
                  <div className="col-span-2 flex items-center gap-2 text-sm" style={{ color: "oklch(0.65 0.18 145)" }}>
                    <CheckCircle className="w-4 h-4" />
                    <span>حساب موثّق</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* LinkedIn Companies API Results Card */}
          {bdResults.linkedin && (bdResults.linkedin.followersCount > 0 || bdResults.linkedin.employeesCount) && (
            <div className="rounded-2xl p-5 border space-y-4" style={{ background: "oklch(0.12 0.015 240)", borderColor: "oklch(0.55 0.18 220 / 0.4)" }}>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "oklch(0.55 0.18 220 / 0.15)" }}>
                  <span className="text-xs font-bold" style={{ color: "oklch(0.65 0.18 220)" }}>in</span>
                </div>
                <h3 className="font-semibold text-foreground text-sm">بيانات LinkedIn الحقيقية</h3>
                <span className="text-xs px-2 py-0.5 rounded-full ml-auto" style={{ background: bdResults.linkedin.dataSource === "api" ? "oklch(0.65 0.18 145 / 0.15)" : "oklch(0.65 0.18 200 / 0.15)", color: bdResults.linkedin.dataSource === "api" ? "oklch(0.65 0.18 145)" : "oklch(0.65 0.18 200)" }}>
                  {bdResults.linkedin.dataSource === "api" ? "✓ Companies API" : bdResults.linkedin.dataSource === "scraper_fallback" ? "✓ Scraper" : "AI تقدير"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {bdResults.linkedin.followersCount > 0 && (
                  <div className="rounded-xl p-3 text-center" style={{ background: "oklch(0.55 0.18 220 / 0.08)" }}>
                    <p className="text-xs text-muted-foreground mb-1">المتابعون</p>
                    <p className="text-xl font-bold" style={{ color: "oklch(0.65 0.18 220)" }}>{bdResults.linkedin.followersCount.toLocaleString("ar-SA")}</p>
                  </div>
                )}
                {bdResults.linkedin.employeesCount && (
                  <div className="rounded-xl p-3 text-center" style={{ background: "oklch(0.55 0.18 220 / 0.08)" }}>
                    <p className="text-xs text-muted-foreground mb-1">الموظفون</p>
                    <p className="text-sm font-bold" style={{ color: "oklch(0.65 0.18 220)" }}>{bdResults.linkedin.employeesCount}</p>
                  </div>
                )}
                {bdResults.linkedin.industry && (
                  <div className="rounded-xl p-3 col-span-2" style={{ background: "oklch(0.55 0.18 220 / 0.08)" }}>
                    <p className="text-xs text-muted-foreground mb-1">القطاع</p>
                    <p className="text-sm font-semibold" style={{ color: "oklch(0.78 0.16 75)" }}>{bdResults.linkedin.industry}</p>
                  </div>
                )}
                {bdResults.linkedin.headquarters && (
                  <div className="rounded-xl p-3" style={{ background: "oklch(0.55 0.18 220 / 0.08)" }}>
                    <p className="text-xs text-muted-foreground mb-1">المقر الرئيسي</p>
                    <p className="text-xs font-medium text-foreground">{bdResults.linkedin.headquarters}</p>
                  </div>
                )}
                {bdResults.linkedin.founded && (
                  <div className="rounded-xl p-3" style={{ background: "oklch(0.55 0.18 220 / 0.08)" }}>
                    <p className="text-xs text-muted-foreground mb-1">تأسست</p>
                    <p className="text-sm font-bold" style={{ color: "oklch(0.65 0.18 220)" }}>{bdResults.linkedin.founded}</p>
                  </div>
                )}
                {bdResults.linkedin.companySize && (
                  <div className="rounded-xl p-3" style={{ background: "oklch(0.55 0.18 220 / 0.08)" }}>
                    <p className="text-xs text-muted-foreground mb-1">حجم الشركة</p>
                    <p className="text-xs font-medium text-foreground">{bdResults.linkedin.companySize}</p>
                  </div>
                )}
                {bdResults.linkedin.specialties?.length > 0 && (
                  <div className="rounded-xl p-3 col-span-2" style={{ background: "oklch(0.55 0.18 220 / 0.08)" }}>
                    <p className="text-xs text-muted-foreground mb-2">التخصصات</p>
                    <div className="flex flex-wrap gap-1">
                      {bdResults.linkedin.specialties.slice(0, 5).map((s: string, i: number) => (
                        <span key={i} className="text-xs px-2 py-0.5 rounded-full" style={{ background: "oklch(0.55 0.18 220 / 0.15)", color: "oklch(0.65 0.18 220)" }}>{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {bdResults.linkedin.about && (
                  <div className="rounded-xl p-3 col-span-2" style={{ background: "oklch(0.55 0.18 220 / 0.08)" }}>
                    <p className="text-xs text-muted-foreground mb-1">عن الشركة</p>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{bdResults.linkedin.about}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===== مقارنة المنصات ===== */}
          {(() => {
            const PLATFORM_META: Record<string, { label: string; color: string; icon: string }> = {
              instagram: { label: "إنستغرام", color: "oklch(0.62 0.18 285)", icon: "📸" },
              tiktok:    { label: "تيك توك",   color: "oklch(0.58 0.22 25)",  icon: "🎵" },
              snapchat:  { label: "سناب شات",  color: "oklch(0.85 0.18 95)",  icon: "👻" },
              twitter:   { label: "تويتر/X",   color: "oklch(0.75 0.05 240)", icon: "𝕏" },
              facebook:  { label: "فيسبوك",    color: "oklch(0.55 0.18 250)", icon: "📘" },
              linkedin:  { label: "لينكد إن",  color: "oklch(0.55 0.18 220)", icon: "💼" },
            };
            const rows: Array<{ platform: string; label: string; color: string; icon: string; followers: number; posts: number; engagement: number; avgLikes: number; score: number; }> = [];
            for (const sa of socialAnalyses) {
              const meta = PLATFORM_META[sa.platform];
              if (!meta) continue;
              rows.push({ platform: sa.platform, label: meta.label, color: meta.color, icon: meta.icon, followers: (sa as any).followersCount || 0, posts: (sa as any).postsCount || 0, engagement: (sa as any).engagementRate || 0, avgLikes: (sa as any).avgLikes || 0, score: sa.overallScore || 0 });
            }
            for (const [key, val] of Object.entries(bdResults)) {
              if (key === "all" || !val || typeof val !== "object") continue;
              const meta = PLATFORM_META[key];
              if (!meta || rows.find(r => r.platform === key)) continue;
              rows.push({ platform: key, label: meta.label, color: meta.color, icon: meta.icon, followers: (val as any).followersCount || 0, posts: (val as any).postsCount || 0, engagement: (val as any).engagementRate || ((val as any).avgEngagement ? (val as any).avgEngagement * 100 : 0), avgLikes: (val as any).avgLikes || 0, score: (val as any).overallScore || 0 });
            }
            if (rows.length < 2) return null;
            const maxFollowers = Math.max(...rows.map(r => r.followers), 1);
            const maxEngagement = Math.max(...rows.map(r => r.engagement), 1);
            const best = rows.reduce((a, b) => ((b.followers > 0 ? 3 : 0) + (b.engagement > 2 ? 2 : b.engagement > 0 ? 1 : 0) + (b.score > 7 ? 2 : b.score > 5 ? 1 : 0)) >= ((a.followers > 0 ? 3 : 0) + (a.engagement > 2 ? 2 : a.engagement > 0 ? 1 : 0) + (a.score > 7 ? 2 : a.score > 5 ? 1 : 0)) ? b : a);
            const weakest = rows.reduce((a, b) => ((b.followers > 0 ? 3 : 0) + (b.engagement > 2 ? 2 : b.engagement > 0 ? 1 : 0) + (b.score > 7 ? 2 : b.score > 5 ? 1 : 0)) <= ((a.followers > 0 ? 3 : 0) + (a.engagement > 2 ? 2 : a.engagement > 0 ? 1 : 0) + (a.score > 7 ? 2 : a.score > 5 ? 1 : 0)) ? b : a);
            return (
              <div className="rounded-2xl p-5 border space-y-5" style={{ background: "oklch(0.12 0.015 240)", borderColor: "oklch(0.65 0.18 200 / 0.25)" }}>
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" style={{ color: "oklch(0.65 0.18 200)" }} />
                  <h3 className="font-semibold text-foreground">مقارنة المنصات</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full mr-auto" style={{ background: "oklch(0.65 0.18 200 / 0.1)", color: "oklch(0.65 0.18 200)" }}>{rows.length} منصات</span>
                </div>
                {/* جدول المقارنة */}
                <div className="overflow-x-auto -mx-1">
                  <table className="w-full text-xs min-w-[480px]">
                    <thead>
                      <tr style={{ borderBottom: "1px solid oklch(0.2 0.02 240)" }}>
                        <th className="text-right py-2 pr-2 text-muted-foreground font-medium">المنصة</th>
                        <th className="text-center py-2 px-2 text-muted-foreground font-medium">المتابعون</th>
                        <th className="text-center py-2 px-2 text-muted-foreground font-medium">المنشورات</th>
                        <th className="text-center py-2 px-2 text-muted-foreground font-medium">التفاعل %</th>
                        <th className="text-center py-2 px-2 text-muted-foreground font-medium">متوسط إعجاب</th>
                        <th className="text-center py-2 px-2 text-muted-foreground font-medium">الدرجة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.sort((a, b) => b.followers - a.followers).map(row => (
                        <tr key={row.platform} style={{ borderBottom: "1px solid oklch(0.15 0.01 240)" }}>
                          <td className="py-2.5 pr-2"><div className="flex items-center gap-2"><span className="text-base">{row.icon}</span><span className="font-medium" style={{ color: row.color }}>{row.label}</span></div></td>
                          <td className="text-center py-2.5 px-2">{row.followers > 0 ? <span className="font-bold text-foreground">{row.followers >= 1000000 ? `${(row.followers/1000000).toFixed(1)}M` : row.followers >= 1000 ? `${(row.followers/1000).toFixed(1)}K` : row.followers}</span> : <span className="text-muted-foreground">—</span>}</td>
                          <td className="text-center py-2.5 px-2">{row.posts > 0 ? <span className="text-foreground">{row.posts}</span> : <span className="text-muted-foreground">—</span>}</td>
                          <td className="text-center py-2.5 px-2">{row.engagement > 0 ? <span className="font-medium" style={{ color: row.engagement >= 3 ? "oklch(0.65 0.18 145)" : row.engagement >= 1 ? "oklch(0.78 0.16 75)" : "oklch(0.58 0.22 25)" }}>{row.engagement.toFixed(2)}%</span> : <span className="text-muted-foreground">—</span>}</td>
                          <td className="text-center py-2.5 px-2">{row.avgLikes > 0 ? <span className="text-foreground">{row.avgLikes >= 1000 ? `${(row.avgLikes/1000).toFixed(1)}K` : row.avgLikes}</span> : <span className="text-muted-foreground">—</span>}</td>
                          <td className="text-center py-2.5 px-2">{row.score > 0 ? <span className="font-bold" style={{ color: row.score >= 7 ? "oklch(0.65 0.18 145)" : row.score >= 5 ? "oklch(0.78 0.16 75)" : "oklch(0.58 0.22 25)" }}>{row.score.toFixed(1)}</span> : <span className="text-muted-foreground">—</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* شريط المتابعين */}
                {rows.some(r => r.followers > 0) && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2 font-medium">المتابعون بالمقارنة</p>
                    <div className="space-y-2">
                      {rows.filter(r => r.followers > 0).sort((a, b) => b.followers - a.followers).map(row => (
                        <div key={row.platform} className="flex items-center gap-3">
                          <span className="text-xs w-20 text-right flex-shrink-0" style={{ color: row.color }}>{row.icon} {row.label}</span>
                          <div className="flex-1 h-5 rounded-lg overflow-hidden" style={{ background: "oklch(0.15 0.01 240)" }}>
                            <div className="h-full rounded-lg flex items-center px-2 transition-all duration-700" style={{ width: `${(row.followers / maxFollowers) * 100}%`, background: `color-mix(in oklch, ${row.color} 60%, transparent)`, minWidth: "2rem" }}>
                              <span className="text-xs font-bold text-white truncate">{row.followers >= 1000000 ? `${(row.followers/1000000).toFixed(1)}M` : row.followers >= 1000 ? `${(row.followers/1000).toFixed(1)}K` : row.followers}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* شريط التفاعل */}
                {rows.some(r => r.engagement > 0) && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2 font-medium">معدل التفاعل %</p>
                    <div className="space-y-2">
                      {rows.filter(r => r.engagement > 0).sort((a, b) => b.engagement - a.engagement).map(row => (
                        <div key={row.platform} className="flex items-center gap-3">
                          <span className="text-xs w-20 text-right flex-shrink-0" style={{ color: row.color }}>{row.icon} {row.label}</span>
                          <div className="flex-1 h-5 rounded-lg overflow-hidden" style={{ background: "oklch(0.15 0.01 240)" }}>
                            <div className="h-full rounded-lg flex items-center px-2 transition-all duration-700" style={{ width: `${Math.min((row.engagement / Math.max(maxEngagement, 5)) * 100, 100)}%`, background: row.engagement >= 3 ? "oklch(0.55 0.18 145 / 0.7)" : row.engagement >= 1 ? "oklch(0.65 0.16 75 / 0.7)" : "oklch(0.5 0.18 25 / 0.7)", minWidth: "2.5rem" }}>
                              <span className="text-xs font-bold text-white">{row.engagement.toFixed(1)}%</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* شريط الدرجات */}
                {rows.some(r => r.score > 0) && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2 font-medium">درجة التحليل / 10</p>
                    <div className="space-y-2">
                      {rows.filter(r => r.score > 0).sort((a, b) => b.score - a.score).map(row => (
                        <div key={row.platform} className="flex items-center gap-3">
                          <span className="text-xs w-20 text-right flex-shrink-0" style={{ color: row.color }}>{row.icon} {row.label}</span>
                          <div className="flex-1 h-5 rounded-lg overflow-hidden" style={{ background: "oklch(0.15 0.01 240)" }}>
                            <div className="h-full rounded-lg flex items-center px-2 transition-all duration-700" style={{ width: `${(row.score / 10) * 100}%`, background: row.score >= 7 ? "oklch(0.55 0.18 145 / 0.7)" : row.score >= 5 ? "oklch(0.65 0.16 75 / 0.7)" : "oklch(0.5 0.18 25 / 0.7)", minWidth: "2rem" }}>
                              <span className="text-xs font-bold text-white">{row.score.toFixed(1)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* أفضل وأضعف منصة */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl" style={{ background: `color-mix(in oklch, ${best.color} 8%, transparent)`, border: `1px solid color-mix(in oklch, ${best.color} 20%, transparent)` }}>
                    <p className="text-xs text-muted-foreground mb-1">★ الأقوى حضوراً</p>
                    <p className="font-bold" style={{ color: best.color }}>{best.icon} {best.label}</p>
                    {best.followers > 0 && <p className="text-xs text-muted-foreground mt-0.5">{best.followers >= 1000 ? `${(best.followers/1000).toFixed(1)}K` : best.followers} متابع</p>}
                  </div>
                  {weakest.platform !== best.platform && (
                    <div className="p-3 rounded-xl" style={{ background: "oklch(0.58 0.22 25 / 0.06)", border: "1px solid oklch(0.58 0.22 25 / 0.15)" }}>
                      <p className="text-xs text-muted-foreground mb-1">⚠️ يحتاج تطوير</p>
                      <p className="font-bold" style={{ color: weakest.color }}>{weakest.icon} {weakest.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">فرصة للتحسين</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Full report */}
          {report && (
            <div className="rounded-2xl p-5 border space-y-4" style={{ background: "oklch(0.12 0.015 240)", borderColor: "oklch(0.62 0.18 285 / 0.3)" }}>
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Zap className="w-4 h-4" style={{ color: "var(--brand-purple)" }} />
                التقرير الشامل
              </h3>
              {report.executiveSummary && (
                <p className="text-sm text-foreground leading-relaxed p-3 rounded-xl" style={{ background: "oklch(0.62 0.18 285 / 0.08)", border: "1px solid oklch(0.62 0.18 285 / 0.2)" }}>
                  {report.executiveSummary}
                </p>
              )}
              {report.criticalGaps?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: "var(--brand-red)" }}>الثغرات الحرجة</p>
                  <ul className="space-y-1">
                    {report.criticalGaps.map((g: string, i: number) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                        <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: "var(--brand-red)" }} />
                        {g}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {report.immediateOpportunities?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: "var(--brand-green)" }}>الفرص الفورية</p>
                  <ul className="space-y-1">
                    {report.immediateOpportunities.map((o: string, i: number) => (
                      <li key={i} className="text-xs text-foreground flex items-start gap-2">
                        <TrendingUp className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: "var(--brand-green)" }} />
                        {o}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {report.salesScript && (
                <div className="p-3 rounded-xl" style={{ background: "oklch(0.65 0.18 200 / 0.08)", border: "1px solid oklch(0.65 0.18 200 / 0.2)" }}>
                  <p className="text-xs font-semibold mb-1.5" style={{ color: "var(--brand-cyan)" }}>
                    <Target className="w-3 h-3 inline ml-1" />
                    نص التواصل المقترح
                  </p>
                  <p className="text-sm text-foreground leading-relaxed">{report.salesScript}</p>
                </div>
              )}
            </div>
          )}

          {/* Empty state for analysis */}
          {!websiteAnalysis && socialAnalyses.length === 0 && !report && !bdResults.all && lead.analysisStatus !== "completed" && (
            <div className="rounded-2xl p-8 border border-border flex flex-col items-center gap-4" style={{ background: "oklch(0.12 0.015 240)" }}>
              <BarChart3 className="w-12 h-12 text-muted-foreground opacity-30" />
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">لم يتم التحليل بعد</p>
                <p className="text-xs text-muted-foreground mt-1">استخدم أزرار التحليل في قسم الحضور الرقمي</p>
              </div>
              <button onClick={handleGenerateReport} disabled={generateReport.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                style={{ background: "oklch(0.62 0.18 285 / 0.15)", color: "var(--brand-purple)", border: "1px solid oklch(0.62 0.18 285 / 0.3)" }}>
                {generateReport.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                إنشاء تقرير شامل بالذكاء الاصطناعي
              </button>
            </div>
          )}

        </div>
      </div>
    </div>

    {/* PDF Report Modal */}
    {showPdfModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
        <div className="rounded-2xl p-6 w-full max-w-md space-y-4" style={{ background: "oklch(0.12 0.015 240)", border: "1px solid oklch(0.65 0.18 25 / 0.3)" }}>
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-foreground flex items-center gap-2">
              <FileText className="w-5 h-5" style={{ color: "oklch(0.75 0.18 25)" }} />
              تقرير PDF جاهز
            </h3>
            <button onClick={() => setShowPdfModal(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="rounded-xl p-4 space-y-3" style={{ background: "oklch(0.65 0.18 145 / 0.08)", border: "1px solid oklch(0.65 0.18 145 / 0.2)" }}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "oklch(0.65 0.18 145 / 0.2)" }}>
                <FileText className="w-4 h-4" style={{ color: "oklch(0.65 0.18 145)" }} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">تم توليد التقرير بنجاح</p>
                <p className="font-semibold text-foreground text-sm">{lead.companyName}</p>
              </div>
            </div>
            {pdfUrl && (
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => handleDownloadPdf(pdfUrl, `تقرير-${lead.companyName}.pdf`)}
                  disabled={pdfDownloading}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-60"
                  style={{ background: "oklch(0.55 0.2 220)", color: "white" }}
                >
                  {pdfDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {pdfDownloading ? "جاري التحميل..." : "تحميل PDF"}
                </button>
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
                  style={{ background: "oklch(0.65 0.18 200 / 0.15)", color: "oklch(0.75 0.18 200)", border: "1px solid oklch(0.65 0.18 200 / 0.3)" }}
                >
                  <ExternalLink className="w-4 h-4" />
                  فتح
                </a>
              </div>
            )}
          </div>

           {isWaConnected && lead.verifiedPhone && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground">إرسال عبر واتساب</p>
              <textarea
                value={pdfCustomMessage}
                onChange={e => setPdfCustomMessage(e.target.value)}
                placeholder="رسالة مخصصة (اختياري - سيتم استخدام رسالة افتراضية إذا تركتها فارغة)"
                rows={3}
                className="w-full px-3 py-2 rounded-xl text-xs border border-border bg-background text-foreground resize-none focus:outline-none focus:border-primary"
              />
              <button onClick={handleSendPDFViaWhatsApp} disabled={pdfSending}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{ background: "oklch(0.55 0.2 145)", color: "white", opacity: pdfSending ? 0.7 : 1 }}>
                {pdfSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                إرسال التقرير عبر واتساب
              </button>
            </div>
          )}
          {/* ── زر WhatChimp Bot Flow ── */}
          {isWhatchimpConfigured && lead.verifiedPhone && pdfUrl && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-2">
                <div className="h-px flex-1" style={{ background: "oklch(0.25 0.02 240)" }} />
                <span className="text-xs text-muted-foreground">أو</span>
                <div className="h-px flex-1" style={{ background: "oklch(0.25 0.02 240)" }} />
              </div>
              <button
                onClick={handleSendPdfViaBot}
                disabled={botFlowSending}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{ background: "oklch(0.45 0.22 145 / 0.15)", color: "oklch(0.65 0.2 145)", border: "1px solid oklch(0.55 0.2 145 / 0.4)", opacity: botFlowSending ? 0.7 : 1 }}
              >
                {botFlowSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                إرسال عبر WhatChimp Bot Flow
              </button>
              <p className="text-xs text-center text-muted-foreground">يحقن رابط PDF في Custom Fields ثم يطلق القالب المعتمد</p>
            </div>
          )}
          {!isWaConnected && !isWhatchimpConfigured && (
            <div className="rounded-xl p-3 text-xs" style={{ background: "oklch(0.65 0.18 60 / 0.08)", border: "1px solid oklch(0.65 0.18 60 / 0.2)", color: "oklch(0.75 0.18 60)" }}>
              لإرسال التقرير، يرجى توصيل حساب واتساب أو إعداد WhatChimp من صفحة الإعدادات
            </div>
          )}
        </div>
      </div>
    )}
    {/* ===== معرض صور Google Maps ===== */}
    {showPhotoGallery && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.85)" }}
        onClick={() => { setShowPhotoGallery(false); setSelectedPhoto(null); }}
      >
        <div
          className="relative w-full max-w-4xl rounded-2xl overflow-hidden"
          style={{ background: "oklch(0.10 0.015 240)", border: "1px solid oklch(0.25 0.02 240)" }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "oklch(0.2 0.02 240)" }}>
            <div className="flex items-center gap-3">
              {(lead as any).clientLogoUrl && (
                <img src={(lead as any).clientLogoUrl} alt={lead.companyName}
                  className="w-8 h-8 rounded-lg object-contain"
                  onError={e => (e.target as HTMLImageElement).style.display = 'none'} />
              )}
              <div>
                <h3 className="text-sm font-bold text-foreground">{lead.companyName}</h3>
                <p className="text-xs text-muted-foreground">{(lead as any).placePhotos?.length || 0} صورة من Google Maps</p>
              </div>
            </div>
            <button onClick={() => { setShowPhotoGallery(false); setSelectedPhoto(null); }}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Selected Photo */}
          {selectedPhoto && (
            <div className="relative w-full" style={{ height: "400px" }}>
              <img src={selectedPhoto} alt="صورة المكان"
                className="w-full h-full object-contain"
                onError={e => (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23222" width="100" height="100"/><text fill="%23666" x="50" y="55" text-anchor="middle" font-size="12">تعذر تحميل الصورة</text></svg>'}
              />
            </div>
          )}

          {/* Grid */}
          <div className="p-4 grid grid-cols-5 gap-2 max-h-64 overflow-y-auto">
            {((lead as any).placePhotos || []).map((photoUrl: string, idx: number) => (
              <button
                key={idx}
                onClick={() => setSelectedPhoto(photoUrl)}
                className="relative aspect-square rounded-xl overflow-hidden transition-all hover:scale-105"
                style={{
                  border: selectedPhoto === photoUrl ? "2px solid oklch(0.65 0.18 200)" : "2px solid transparent",
                  background: "oklch(0.15 0.02 240)"
                }}
              >
                <img
                  src={photoUrl}
                  alt={`صورة ${idx + 1}`}
                  className="w-full h-full object-cover"
                  onError={e => (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23222" width="100" height="100"/></svg>'}
                />
                {idx === 0 && (
                  <div className="absolute top-1 right-1 text-xs px-1 rounded"
                    style={{ background: "oklch(0.65 0.18 200 / 0.9)", color: "white", fontSize: "9px" }}>
                    رئيسي
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Footer actions */}
          <div className="p-4 border-t flex gap-2 justify-end" style={{ borderColor: "oklch(0.2 0.02 240)" }}>
            {selectedPhoto && (
              <a href={selectedPhoto} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg transition-all"
                style={{ background: "oklch(0.65 0.18 200 / 0.15)", color: "oklch(0.75 0.18 200)", border: "1px solid oklch(0.65 0.18 200 / 0.3)" }}>
                <ExternalLink className="w-3 h-3" />
                فتح الصورة
              </a>
            )}
            {selectedPhoto && (
              <button
                onClick={async () => {
                  // تعيين أول صورة كشعار للعميل
                  await updateLead.mutateAsync({ id, clientLogoUrl: selectedPhoto } as any);
                  toast.success('تم تعيين الصورة كشعار للعميل');
                  utils.leads.getFullDetails.invalidate({ id });
                }}
                className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg transition-all"
                style={{ background: "oklch(0.65 0.18 145 / 0.15)", color: "oklch(0.65 0.18 145)", border: "1px solid oklch(0.65 0.18 145 / 0.3)" }}>
                ⭐ تعيين كشعار
              </button>
            )}
          </div>
        </div>
      </div>
    )}
    {/* ===== معاينة التقرير (نفس HTML الذي يُولَّد في PDF) ===== */}
    {showPreviewModal && previewHtml && (
      <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: "rgba(0,0,0,0.92)" }}>
        <div className="flex items-center justify-between px-5 py-3 border-b flex-shrink-0" style={{ background: "oklch(0.10 0.015 240)", borderColor: "oklch(0.2 0.02 240)" }}>
          <div className="flex items-center gap-3">
            <Eye className="w-5 h-5" style={{ color: "oklch(0.72 0.18 285)" }} />
            <span className="font-bold text-foreground text-sm">معاينة التقرير — {data?.lead?.companyName}</span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "oklch(0.65 0.18 145 / 0.15)", color: "oklch(0.65 0.18 145)" }}>نفس محتوى PDF</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleGeneratePDF}
              disabled={pdfGenerating}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-all"
              style={{ background: "oklch(0.65 0.18 25 / 0.15)", color: "oklch(0.75 0.18 25)", border: "1px solid oklch(0.65 0.18 25 / 0.3)" }}>
              {pdfGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              تحميل PDF
            </button>
            <button onClick={() => setShowPreviewModal(false)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <iframe
            srcDoc={previewHtml}
            className="w-full h-full border-0"
            title="معاينة التقرير"
            sandbox="allow-same-origin"
          />
        </div>
    </div>
    )}

    {/* ===== نافذة تأكيد اكتمال البيانات ===== */}
    {showDataConfirmModal && data?.lead && (
      <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.75)" }}>
        <div className="rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl" style={{ background: "oklch(0.12 0.02 240)", border: "1px solid oklch(0.25 0.05 240)" }}>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "oklch(0.65 0.18 60 / 0.2)" }}>
              <AlertTriangle className="w-5 h-5" style={{ color: "oklch(0.78 0.16 75)" }} />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground">تأكيد البيانات قبل التحليل</h3>
              <p className="text-xs text-muted-foreground">تحقق من اكتمال البيانات لضمان أفضل نتائج</p>
            </div>
          </div>

          {/* قائمة البيانات المتوفرة والناقصة */}
          <div className="space-y-2 mb-5">
            {[
              { label: "اسم النشاط", value: data.lead.companyName, required: true },
              { label: "نوع النشاط", value: data.lead.businessType, required: true },
              { label: "المدينة", value: data.lead.city, required: true },
              { label: "رقم الهاتف", value: data.lead.verifiedPhone, required: false },
              { label: "الموقع الإلكتروني", value: data.lead.website, required: false },
              { label: "حساب إنستغرام", value: data.lead.instagramUrl, required: false },
              { label: "حساب تيك توك", value: (data.lead as any).tiktokUrl, required: false },
              { label: "خرائط Google", value: data.lead.googleMapsUrl, required: false },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: "oklch(0.16 0.02 240)" }}>
                <span className="text-sm text-foreground">{item.label}</span>
                <div className="flex items-center gap-2">
                  {item.required && !item.value && (
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "oklch(0.55 0.18 25 / 0.2)", color: "oklch(0.65 0.18 25)" }}>مطلوب</span>
                  )}
                  {item.value ? (
                    <CheckCircle className="w-4 h-4" style={{ color: "oklch(0.65 0.18 145)" }} />
                  ) : (
                    <XCircle className="w-4 h-4" style={{ color: item.required ? "oklch(0.65 0.18 25)" : "oklch(0.45 0.05 240)" }} />
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* تحذير إذا كانت بيانات أساسية ناقصة */}
          {(!data.lead.businessType || !data.lead.city) && (
            <div className="flex items-start gap-2 p-3 rounded-xl mb-4" style={{ background: "oklch(0.55 0.18 25 / 0.1)", border: "1px solid oklch(0.55 0.18 25 / 0.3)" }}>
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "oklch(0.65 0.18 25)" }} />
              <p className="text-xs" style={{ color: "oklch(0.75 0.12 25)" }}>بيانات أساسية ناقصة (نوع النشاط أو المدينة). التحليل قد يكون أقل دقة.</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setShowDataConfirmModal(false)}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{ background: "oklch(0.2 0.02 240)", color: "oklch(0.7 0.05 240)", border: "1px solid oklch(0.3 0.05 240)" }}
            >
              إلغاء
            </button>
            <button
              onClick={handleAnalyzeAllPlatforms}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{ background: "oklch(0.65 0.18 145)", color: "white" }}
            >
              ابدأ التحليل الشامل
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
