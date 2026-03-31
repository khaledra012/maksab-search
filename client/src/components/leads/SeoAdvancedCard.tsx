import { useState } from "react";
import { Search, TrendingUp, Link2, Users, Target, Loader2, ChevronDown, ChevronUp, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SeoReport {
  topKeywords?: string[];
  missingKeywords?: string[];
  keywordOpportunities?: string[];
  estimatedBacklinks?: number;
  backlinkQuality?: string;
  topReferringDomains?: string[];
  backlinkGaps?: string[];
  competitors?: Array<{ name: string; url: string; strengths: string[] }>;
  competitorGaps?: string[];
  competitiveAdvantages?: string[];
  searchRankings?: Array<{ keyword: string; estimatedPosition: string; difficulty: string }>;
  brandMentions?: number;
  localSeoScore?: number;
  overallSeoHealth?: string;
  seoSummary?: string;
  priorityActions?: string[];
  analyzedAt?: string | number;
}

interface Props {
  report: SeoReport | null | undefined;
  isLoading: boolean;
  onRunAnalysis: () => void;
}

const BRAND_CYAN = "oklch(0.72 0.18 200)";
const BRAND_GREEN = "oklch(0.65 0.18 145)";
const BRAND_GOLD = "oklch(0.78 0.16 75)";
const BRAND_RED = "oklch(0.58 0.22 25)";
const CARD_BG = "oklch(0.12 0.015 240)";

function SectionToggle({ title, icon, children, color }: { title: string; icon: React.ReactNode; children: React.ReactNode; color: string }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-xl border" style={{ borderColor: `${color.replace(')', ' / 0.25)')}`, background: `${color.replace(')', ' / 0.04)')}` }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3 text-right"
      >
        <span className="flex items-center gap-2 text-sm font-semibold" style={{ color }}>
          {icon}
          {title}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-3 pb-3 space-y-2">{children}</div>}
    </div>
  );
}

function TagList({ items, color }: { items: string[]; color: string }) {
  if (!items?.length) return <p className="text-xs text-muted-foreground">لا توجد بيانات</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, i) => (
        <span key={i} className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${color.replace(')', ' / 0.12)')}`, color }}>
          {item}
        </span>
      ))}
    </div>
  );
}

export default function SeoAdvancedCard({ report, isLoading, onRunAnalysis }: Props) {
  const healthColor = report?.overallSeoHealth === "جيد" ? BRAND_GREEN
    : report?.overallSeoHealth === "متوسط" ? BRAND_GOLD : BRAND_RED;

  return (
    <div className="rounded-2xl p-5 border border-border space-y-4" style={{ background: CARD_BG }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Search className="w-4 h-4" style={{ color: BRAND_CYAN }} />
          تحليل SEO المتقدم
          {report && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${healthColor.replace(')', ' / 0.12)')}`, color: healthColor }}>
              {report.overallSeoHealth ?? "—"}
            </span>
          )}
        </h3>
        <Button
          size="sm"
          variant="outline"
          onClick={onRunAnalysis}
          disabled={isLoading}
          className="text-xs h-7 gap-1"
          style={{ borderColor: `${BRAND_CYAN.replace(')', ' / 0.4)')}`, color: BRAND_CYAN }}
        >
          {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
          {isLoading ? "جاري التحليل..." : report ? "إعادة التحليل" : "تشغيل تحليل SEO"}
        </Button>
      </div>

      {/* Empty state */}
      {!report && !isLoading && (
        <div className="text-center py-6 space-y-2">
          <Search className="w-8 h-8 mx-auto text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">اضغط "تشغيل تحليل SEO" للحصول على تحليل شامل للكلمات المفتاحية والـ Backlinks والمنافسين</p>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="text-center py-6 space-y-2">
          <Loader2 className="w-8 h-8 mx-auto animate-spin" style={{ color: BRAND_CYAN }} />
          <p className="text-sm text-muted-foreground">جاري تحليل SEO المتقدم... قد يستغرق دقيقة</p>
        </div>
      )}

      {/* Results */}
      {report && !isLoading && (
        <div className="space-y-3">
          {/* Summary */}
          {report.seoSummary && (
            <p className="text-sm text-muted-foreground leading-relaxed p-3 rounded-xl" style={{ background: `${BRAND_CYAN.replace(')', ' / 0.05)')}` }}>
              {report.seoSummary}
            </p>
          )}

          {/* Scores row */}
          <div className="grid grid-cols-2 gap-2">
            {report.localSeoScore != null && (
              <div className="p-3 rounded-xl text-center" style={{ background: `${BRAND_CYAN.replace(')', ' / 0.06)')}` }}>
                <p className="text-xs text-muted-foreground mb-1">SEO المحلي</p>
                <p className="text-xl font-bold" style={{ color: BRAND_CYAN }}>{report.localSeoScore}/10</p>
              </div>
            )}
            {report.estimatedBacklinks != null && (
              <div className="p-3 rounded-xl text-center" style={{ background: `${BRAND_GOLD.replace(')', ' / 0.06)')}` }}>
                <p className="text-xs text-muted-foreground mb-1">Backlinks تقديري</p>
                <p className="text-xl font-bold" style={{ color: BRAND_GOLD }}>{report.estimatedBacklinks.toLocaleString("ar-SA")}</p>
                {report.backlinkQuality && <p className="text-xs mt-0.5" style={{ color: BRAND_GOLD }}>{report.backlinkQuality}</p>}
              </div>
            )}
          </div>

          {/* Keywords */}
          {(report.topKeywords?.length || report.missingKeywords?.length || report.keywordOpportunities?.length) && (
            <SectionToggle title="الكلمات المفتاحية" icon={<Target className="w-3.5 h-3.5" />} color={BRAND_GREEN}>
              {report.topKeywords?.length ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">الكلمات الحالية</p>
                  <TagList items={report.topKeywords} color={BRAND_GREEN} />
                </div>
              ) : null}
              {report.missingKeywords?.length ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">كلمات مفتاحية ناقصة</p>
                  <TagList items={report.missingKeywords} color={BRAND_RED} />
                </div>
              ) : null}
              {report.keywordOpportunities?.length ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">فرص الكلمات المفتاحية</p>
                  <TagList items={report.keywordOpportunities} color={BRAND_GOLD} />
                </div>
              ) : null}
            </SectionToggle>
          )}

          {/* Search Rankings */}
          {report.searchRankings?.length ? (
            <SectionToggle title="ترتيب في نتائج البحث" icon={<TrendingUp className="w-3.5 h-3.5" />} color={BRAND_CYAN}>
              <div className="space-y-1.5">
                {report.searchRankings.map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-xs p-2 rounded-lg" style={{ background: "oklch(0.1 0.01 240 / 0.5)" }}>
                    <span className="text-foreground font-medium">{r.keyword}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">صعوبة: {r.difficulty}</span>
                      <span className="px-1.5 py-0.5 rounded" style={{ background: `${BRAND_CYAN.replace(')', ' / 0.12)')}`, color: BRAND_CYAN }}>
                        #{r.estimatedPosition}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </SectionToggle>
          ) : null}

          {/* Backlinks */}
          {(report.topReferringDomains?.length || report.backlinkGaps?.length) && (
            <SectionToggle title="الـ Backlinks" icon={<Link2 className="w-3.5 h-3.5" />} color={BRAND_GOLD}>
              {report.topReferringDomains?.length ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">أبرز المواقع المرتبطة</p>
                  <TagList items={report.topReferringDomains} color={BRAND_GOLD} />
                </div>
              ) : null}
              {report.backlinkGaps?.length ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">ثغرات الـ Backlinks</p>
                  <ul className="space-y-1">
                    {report.backlinkGaps.map((g, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                        <span className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0" style={{ background: BRAND_GOLD }} />
                        {g}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </SectionToggle>
          )}

          {/* Competitors */}
          {(report.competitors?.length || report.competitorGaps?.length) && (
            <SectionToggle title="مقارنة المنافسين" icon={<Users className="w-3.5 h-3.5" />} color={BRAND_RED}>
              {report.competitors?.length ? (
                <div className="space-y-2">
                  {report.competitors.map((c, i) => (
                    <div key={i} className="p-2 rounded-lg" style={{ background: "oklch(0.1 0.01 240 / 0.5)" }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-foreground">{c.name}</span>
                        {c.url && <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-xs underline" style={{ color: BRAND_CYAN }}>{c.url.replace(/^https?:\/\//, "")}</a>}
                      </div>
                      {c.strengths?.length ? (
                        <div className="flex flex-wrap gap-1">
                          {c.strengths.map((s, j) => (
                            <span key={j} className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${BRAND_RED.replace(')', ' / 0.1)')}`, color: BRAND_RED }}>{s}</span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
              {report.competitorGaps?.length ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">ثغرات مقارنةً بالمنافسين</p>
                  <ul className="space-y-1">
                    {report.competitorGaps.map((g, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                        <span className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0" style={{ background: BRAND_RED }} />
                        {g}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {report.competitiveAdvantages?.length ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">مزايا تنافسية</p>
                  <ul className="space-y-1">
                    {report.competitiveAdvantages.map((a, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                        <span className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0" style={{ background: BRAND_GREEN }} />
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </SectionToggle>
          )}

          {/* Priority Actions */}
          {report.priorityActions?.length ? (
            <div className="p-3 rounded-xl space-y-2" style={{ background: `${BRAND_CYAN.replace(')', ' / 0.06)')}`, border: `1px solid ${BRAND_CYAN.replace(')', ' / 0.2)')}` }}>
              <p className="text-xs font-semibold" style={{ color: BRAND_CYAN }}>الإجراءات ذات الأولوية</p>
              <ul className="space-y-1.5">
                {report.priorityActions.map((a, i) => (
                  <li key={i} className="text-xs text-foreground flex items-start gap-2">
                    <span className="text-xs font-bold flex-shrink-0 mt-0.5" style={{ color: BRAND_CYAN }}>{i + 1}.</span>
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Analyzed at */}
          {report.analyzedAt && (
            <p className="text-xs text-muted-foreground text-left">
              آخر تحليل: {new Date(report.analyzedAt).toLocaleString("ar-SA")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
