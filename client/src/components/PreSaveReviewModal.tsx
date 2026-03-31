/**
 * PreSaveReviewModal - نافذة المراجعة اليدوية قبل حفظ العميل
 * تعرض: درجة جودة البيانات، التكرارات المحتملة، البيانات المُطبَّعة، والاقتراحات
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle, CheckCircle2, XCircle, Shield, Zap,
  Phone, Globe, Building2, MapPin, ChevronRight, Loader2,
  Star, Copy, ExternalLink, Info, AlertCircle, Brain, Flame, MessageSquare, Target
} from "lucide-react";
import { useLocation } from "wouter";

interface PreSaveReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmSave: () => void;
  formData: {
    companyName: string;
    businessType?: string;
    city?: string;
    verifiedPhone?: string;
    website?: string;
    instagramUrl?: string;
    twitterUrl?: string;
    snapchatUrl?: string;
    tiktokUrl?: string;
    facebookUrl?: string;
    googleMapsUrl?: string;
    reviewCount?: number;
    notes?: string;
  };
  isSaving?: boolean;
}

export default function PreSaveReviewModal({
  isOpen,
  onClose,
  onConfirmSave,
  formData,
  isSaving = false,
}: PreSaveReviewModalProps) {
  const [, navigate] = useLocation();
  const [checked, setChecked] = useState(false);
  const [aiAnalyzed, setAiAnalyzed] = useState(false);

  const preSaveCheck = trpc.deduplication.preSaveCheck.useMutation();
  const quickAnalyze = trpc.sectorAnalysis.previewAnalysis.useMutation();

  // تشغيل الفحص عند فتح النافذة
  const runCheck = () => {
    if (!checked) {
      preSaveCheck.mutate({
        companyName: formData.companyName,
        verifiedPhone: formData.verifiedPhone,
        website: formData.website,
        businessType: formData.businessType,
        city: formData.city,
        instagramUrl: formData.instagramUrl,
        twitterUrl: formData.twitterUrl,
        snapchatUrl: formData.snapchatUrl,
        tiktokUrl: formData.tiktokUrl,
        facebookUrl: formData.facebookUrl,
        googleMapsUrl: formData.googleMapsUrl,
        reviewCount: formData.reviewCount,
        notes: formData.notes,
        threshold: 55,
      });
      setChecked(true);

      // تشغيل التحليل الذكي الفوري بالتوازي
      if (!aiAnalyzed && formData.companyName) {
        setAiAnalyzed(true);
        quickAnalyze.mutate({
          companyName: formData.companyName,
          businessType: formData.businessType,
          city: formData.city,
          hasWebsite: !!formData.website,
          hasInstagram: !!formData.instagramUrl,
          hasTwitter: !!formData.twitterUrl,
          hasTiktok: !!formData.tiktokUrl,
          hasFacebook: !!formData.facebookUrl,
          hasSnapchat: !!formData.snapchatUrl,
          hasGoogleMaps: !!formData.googleMapsUrl,
          reviewCount: formData.reviewCount,
        });
      }
    }
  };

  if (!isOpen) return null;

  // تشغيل الفحص عند أول ظهور
  if (!checked) runCheck();

  const result = preSaveCheck.data;
  const isLoading = preSaveCheck.isPending;

  const qualityColor = (score: number) => {
    if (score >= 70) return "oklch(0.65 0.18 145)";
    if (score >= 40) return "oklch(0.65 0.18 60)";
    return "oklch(0.65 0.18 25)";
  };

  const qualityLabel = (score: number) => {
    if (score >= 70) return "جيدة";
    if (score >= 40) return "متوسطة";
    return "ضعيفة";
  };

  const riskColor = (level: string) => {
    if (level === "high") return "oklch(0.65 0.18 25)";
    if (level === "medium") return "oklch(0.65 0.18 60)";
    return "oklch(0.65 0.18 145)";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border shadow-2xl"
        style={{ background: "oklch(0.10 0.015 240)" }}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-border"
          style={{ background: "oklch(0.10 0.015 240)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "oklch(0.65 0.18 200 / 0.15)" }}
            >
              <Shield className="w-5 h-5" style={{ color: "oklch(0.65 0.18 200)" }} />
            </div>
            <div>
              <h2 className="font-bold text-foreground text-base">مراجعة البيانات قبل الحفظ</h2>
              <p className="text-xs text-muted-foreground">فحص الجودة والتكرار تلقائياً</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Loading State */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: "oklch(0.65 0.18 200 / 0.1)" }}
              >
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: "oklch(0.65 0.18 200)" }} />
              </div>
              <div className="text-center">
                <p className="text-foreground font-medium">جاري فحص البيانات...</p>
                <p className="text-xs text-muted-foreground mt-1">تحليل الجودة والبحث عن التكرارات</p>
              </div>
            </div>
          )}

          {/* Results */}
          {result && !isLoading && (
            <>
              {/* Quality Score Card */}
              <div
                className="rounded-xl p-4 border"
                style={{
                  background: `${qualityColor(result.qualityScore)}10`,
                  borderColor: `${qualityColor(result.qualityScore)}30`,
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4" style={{ color: qualityColor(result.qualityScore) }} />
                    <span className="text-sm font-semibold text-foreground">جودة البيانات</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-2xl font-bold"
                      style={{ color: qualityColor(result.qualityScore) }}
                    >
                      {result.qualityScore}%
                    </span>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{
                        background: `${qualityColor(result.qualityScore)}20`,
                        color: qualityColor(result.qualityScore),
                      }}
                    >
                      {qualityLabel(result.qualityScore)}
                    </span>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${result.qualityScore}%`,
                      background: qualityColor(result.qualityScore),
                    }}
                  />
                </div>
              </div>

              {/* Normalized Data */}
              {result.normalized && (
                <div
                  className="rounded-xl p-4 border border-border"
                  style={{ background: "oklch(0.12 0.015 240)" }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-4 h-4" style={{ color: "oklch(0.65 0.18 200)" }} />
                    <span className="text-sm font-semibold text-foreground">البيانات المُطبَّعة</span>
                    <span className="text-xs text-muted-foreground">(سيتم حفظها تلقائياً)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {result.normalized.normalizedBusinessName && (
                      <div className="flex items-start gap-2">
                        <Building2 className="w-3.5 h-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">الاسم المُطبَّع</p>
                          <p className="text-xs text-foreground font-medium">{result.normalized.normalizedBusinessName}</p>
                        </div>
                      </div>
                    )}
                    {result.normalized.normalizedPhone && (
                      <div className="flex items-start gap-2">
                        <Phone className="w-3.5 h-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">الهاتف المُطبَّع</p>
                          <p className="text-xs text-foreground font-medium">{result.normalized.normalizedPhone}</p>
                        </div>
                      </div>
                    )}
                    {result.normalized.normalizedDomain && (
                      <div className="flex items-start gap-2">
                        <Globe className="w-3.5 h-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">النطاق المُطبَّع</p>
                          <p className="text-xs text-foreground font-medium">{result.normalized.normalizedDomain}</p>
                        </div>
                      </div>
                    )}
                    {result.normalized.sectorMain && (
                      <div className="flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">القطاع المكتشف</p>
                          <p className="text-xs text-foreground font-medium">{sectorLabel(result.normalized.sectorMain)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Duplicates Warning */}
              {result.hasDuplicates && (
                <div
                  className="rounded-xl p-4 border"
                  style={{
                    background: `${riskColor(result.riskLevel)}10`,
                    borderColor: `${riskColor(result.riskLevel)}30`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4" style={{ color: riskColor(result.riskLevel) }} />
                    <span className="text-sm font-semibold text-foreground">
                      تحذير: {result.duplicates.length} عميل مشابه موجود
                    </span>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{
                        background: `${riskColor(result.riskLevel)}20`,
                        color: riskColor(result.riskLevel),
                      }}
                    >
                      {result.riskLevel === "high" ? "خطر عالٍ" : result.riskLevel === "medium" ? "خطر متوسط" : "خطر منخفض"}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {result.duplicates.map((dup, i) => (
                      <div
                        key={i}
                        className="rounded-lg p-3 border border-white/10 flex items-center justify-between gap-3"
                        style={{ background: "oklch(0.08 0.01 240)" }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-foreground truncate">
                              {dup.existing?.companyName || `عميل #${dup.candidateId}`}
                            </p>
                            <span
                              className="text-xs px-1.5 py-0.5 rounded font-bold flex-shrink-0"
                              style={{
                                background: `${riskColor(dup.confidenceScore >= 85 ? "high" : dup.confidenceScore >= 60 ? "medium" : "low")}20`,
                                color: riskColor(dup.confidenceScore >= 85 ? "high" : dup.confidenceScore >= 60 ? "medium" : "low"),
                              }}
                            >
                              {dup.confidenceScore}%
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            {dup.existing?.city && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {dup.existing.city}
                              </span>
                            )}
                            {dup.existing?.verifiedPhone && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {dup.existing.verifiedPhone}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {dup.matchReasons.map((reason, j) => (
                              <span
                                key={j}
                                className="text-xs px-1.5 py-0.5 rounded"
                                style={{ background: "oklch(0.65 0.18 200 / 0.1)", color: "oklch(0.65 0.18 200)" }}
                              >
                                {reason}
                              </span>
                            ))}
                          </div>
                        </div>
                        <button
                          onClick={() => navigate(`/leads/${dup.candidateId}`)}
                          className="flex-shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all"
                          title="عرض العميل"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No Duplicates */}
              {!result.hasDuplicates && (
                <div
                  className="rounded-xl p-4 border flex items-center gap-3"
                  style={{
                    background: "oklch(0.65 0.18 145 / 0.08)",
                    borderColor: "oklch(0.65 0.18 145 / 0.25)",
                  }}
                >
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: "oklch(0.65 0.18 145)" }} />
                  <div>
                    <p className="text-sm font-medium text-foreground">لا توجد تكرارات</p>
                    <p className="text-xs text-muted-foreground">هذا العميل جديد ولم يُضف مسبقاً</p>
                  </div>
                </div>
              )}

              {/* AI Quick Analysis Results */}
              {(quickAnalyze.isPending || quickAnalyze.data) && (
                <div
                  className="rounded-xl p-4 border border-border"
                  style={{ background: "oklch(0.12 0.015 240)" }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Brain className="w-4 h-4" style={{ color: "oklch(0.75 0.18 280)" }} />
                    <span className="text-sm font-semibold text-foreground">التحليل الذكي الفوري</span>
                    {quickAnalyze.isPending && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                    )}
                  </div>

                  {quickAnalyze.isPending && (
                    <p className="text-xs text-muted-foreground">جاري تحليل فرصة البيع والأولوية...</p>
                  )}

                  {quickAnalyze.data && (() => {
                    const ai = quickAnalyze.data as any;
                    const urgencyColors: Record<string, string> = {
                      critical: "oklch(0.65 0.18 25)",
                      high: "oklch(0.65 0.18 45)",
                      medium: "oklch(0.65 0.18 60)",
                      low: "oklch(0.65 0.18 145)",
                    };
                    const urgencyLabels: Record<string, string> = {
                      critical: "حرج جداً",
                      high: "عالية",
                      medium: "متوسطة",
                      low: "منخفضة",
                    };
                    const urgencyColor = urgencyColors[ai.urgencyLevel] || urgencyColors.medium;
                    return (
                      <div className="space-y-3">
                        {/* Priority + Urgency */}
                        <div className="flex items-center gap-3">
                          {ai.leadPriorityScore && (
                            <div
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                              style={{ background: "oklch(0.75 0.18 280 / 0.12)" }}
                            >
                              <Target className="w-3.5 h-3.5" style={{ color: "oklch(0.75 0.18 280)" }} />
                              <span className="text-xs font-bold" style={{ color: "oklch(0.75 0.18 280)" }}>
                                أولوية: {ai.leadPriorityScore}/10
                              </span>
                            </div>
                          )}
                          {ai.urgencyLevel && (
                            <div
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                              style={{ background: `${urgencyColor}15` }}
                            >
                              <Flame className="w-3.5 h-3.5" style={{ color: urgencyColor }} />
                              <span className="text-xs font-bold" style={{ color: urgencyColor }}>
                                إلحاحية: {urgencyLabels[ai.urgencyLevel] || ai.urgencyLevel}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Primary Opportunity */}
                        {ai.primaryOpportunity && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">الفرصة الرئيسية</p>
                            <p className="text-xs text-foreground font-medium">{ai.primaryOpportunity}</p>
                          </div>
                        )}

                        {/* Ice Breaker */}
                        {ai.iceBreaker && (
                          <div
                            className="rounded-lg p-3 border"
                            style={{
                              background: "oklch(0.75 0.18 280 / 0.06)",
                              borderColor: "oklch(0.75 0.18 280 / 0.2)",
                            }}
                          >
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <MessageSquare className="w-3.5 h-3.5" style={{ color: "oklch(0.75 0.18 280)" }} />
                              <span className="text-xs font-semibold" style={{ color: "oklch(0.75 0.18 280)" }}>
                                نص التواصل المقترح
                              </span>
                            </div>
                            <p className="text-xs text-foreground leading-relaxed">{ai.iceBreaker}</p>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Suggestions */}
              {result.suggestions && result.suggestions.length > 0 && (
                <div
                  className="rounded-xl p-4 border border-border"
                  style={{ background: "oklch(0.12 0.015 240)" }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Info className="w-4 h-4" style={{ color: "oklch(0.65 0.18 200)" }} />
                    <span className="text-sm font-semibold text-foreground">اقتراحات لتحسين البيانات</span>
                  </div>
                  <div className="space-y-2">
                    {result.suggestions.map((s, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <ChevronRight className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: "oklch(0.65 0.18 60)" }} />
                        <p className="text-xs text-muted-foreground">{s}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Error State */}
          {preSaveCheck.isError && (
            <div
              className="rounded-xl p-4 border flex items-center gap-3"
              style={{
                background: "oklch(0.65 0.18 25 / 0.08)",
                borderColor: "oklch(0.65 0.18 25 / 0.25)",
              }}
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0" style={{ color: "oklch(0.65 0.18 25)" }} />
              <div>
                <p className="text-sm font-medium text-foreground">تعذّر إجراء الفحص</p>
                <p className="text-xs text-muted-foreground">يمكنك الحفظ مباشرة أو إعادة المحاولة</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          className="sticky bottom-0 flex items-center justify-between gap-3 px-6 py-4 border-t border-border"
          style={{ background: "oklch(0.10 0.015 240)" }}
        >
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all border border-border"
          >
            <XCircle className="w-4 h-4" />
            تعديل البيانات
          </button>

          <button
            onClick={onConfirmSave}
            disabled={isSaving || isLoading}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
            style={{
              background: result?.riskLevel === "high"
                ? "oklch(0.65 0.18 25)"
                : "oklch(0.65 0.18 145)",
              color: "white",
            }}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                جاري الحفظ...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                {result?.riskLevel === "high" ? "حفظ رغم التكرار" : "تأكيد الحفظ"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function sectorLabel(sector: string): string {
  const labels: Record<string, string> = {
    restaurants: "مطاعم وكافيهات",
    medical: "طبي وصحي",
    ecommerce: "تجارة إلكترونية",
    digital_products: "منتجات رقمية",
    general: "عام",
  };
  return labels[sector] || sector;
}
