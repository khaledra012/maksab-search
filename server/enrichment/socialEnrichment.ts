/**
 * PHASE 4 — Social Enrichment (Enhanced)
 * يجلب بيانات حقيقية من Bright Data ثم يحللها بالـ AI لتوليد:
 * - درجات تحليلية (engagement, content quality, digital presence)
 * - ملخص تحليلي مبني على البيانات الحقيقية
 * - توصيات محددة وقابلة للتنفيذ
 * - ثغرات واضحة مع تأثيرها التجاري
 * - توصية مخصصة لكل منصة (platformRecommendation)
 */
import { getDb } from "../db";
import { socialAnalyses } from "../../drizzle/schema";
import type { Lead } from "../../drizzle/schema";
import { fetchAllRealData } from "../routers/realSocialData";
import { invokeLLM } from "../_core/llm";

export type SocialEnrichmentResult =
  | { success: true; platformsEnriched: string[] }
  | { success: false; reason: string };

// ─── تحليل منصة واحدة بالـ AI ────────────────────────────────────────────────
async function analyzePlatformWithAI(
  platform: string,
  data: Record<string, any>,
  businessType: string,
  city: string,
  analyzerNotes?: string
): Promise<{
  engagementScore: number;
  contentQualityScore: number;
  postingFrequencyScore: number;
  digitalPresenceScore: number;
  overallScore: number;
  summary: string;
  recommendations: string[];
  gaps: string[];
  platformRecommendation: string;
}> {
  const defaultResult = {
    engagementScore: 0,
    contentQualityScore: 0,
    postingFrequencyScore: 0,
    digitalPresenceScore: 0,
    overallScore: 0,
    summary: "",
    recommendations: [],
    gaps: [],
    platformRecommendation: "",
  };

  try {
    const followers = data.followers ?? data.followersCount ?? 0;
    const engagementRate = data.avgEngagementRate ?? data.engagementRate ?? 0;
    const postsCount = data.postsCount ?? data.videoCount ?? 0;
    const avgLikes = data.avgLikes ?? 0;
    const avgComments = data.avgComments ?? 0;
    const verified = data.verified ?? false;
    const bio = data.bio ?? data.description ?? "";
    const topPosts = data.topPosts ?? data.topVideos ?? [];

    // قسم ملاحظات المحلل — يُضاف فقط إذا وُجدت
    const analyzerNotesSection = analyzerNotes?.trim()
      ? `\n\n⚠️ **ملاحظات المحلل (أعلى أولوية — يجب دمجها في التحليل والتوصيات):**\n${analyzerNotes.trim()}`
      : "";

    const prompt = `أنت محلل سوشيال ميديا متخصص في السوق السعودي. حلّل البيانات الحقيقية التالية وقدم تقييماً منطقياً مبنياً على الأرقام.

البيانات الحقيقية لحساب ${platform} لنشاط "${businessType}" في "${city}":
- عدد المتابعين: ${followers.toLocaleString()}
- معدل التفاعل: ${engagementRate}%
- عدد المنشورات/الفيديوهات: ${postsCount}
- متوسط الإعجابات: ${avgLikes.toLocaleString()}
- متوسط التعليقات: ${avgComments.toLocaleString()}
- حساب موثق: ${verified ? "نعم" : "لا"}
- البايو: ${bio || "غير متوفر"}
${topPosts.length > 0 ? `- أفضل ${topPosts.length} منشورات متوفرة` : "- لا توجد بيانات منشورات"}${analyzerNotesSection}

معايير التقييم للسوق السعودي:
- معدل تفاعل ممتاز: >5% | جيد: 2-5% | متوسط: 1-2% | ضعيف: <1%
- متابعون ممتازون لنشاط محلي: >50K | جيد: 10K-50K | متوسط: 1K-10K | ضعيف: <1K

أجب بـ JSON فقط:
{
  "engagementScore": 0-10,
  "contentQualityScore": 0-10,
  "postingFrequencyScore": 0-10,
  "digitalPresenceScore": 0-10,
  "overallScore": 0-10,
  "summary": "ملخص تحليلي دقيق في جملتين يذكر أقوى نقطة وأضعف نقطة بالأرقام الحقيقية",
  "recommendations": ["توصية محددة وقابلة للتنفيذ مع تأثيرها التجاري"],
  "gaps": ["ثغرة محددة مع تأثيرها على الأعمال"],
  "platformRecommendation": "جملة واحدة عملية تذكر الدرجة الحالية (مثل 6/10) وما يجب فعله تحديداً لرفعها إلى X"
}

ملاحظات:
- استخدم الأرقام الحقيقية في الملخص (مثل: "معدل تفاعل 3.2% أعلى من المتوسط")
- لا تخترع بيانات غير موجودة
- إذا كانت البيانات ضعيفة، قل ذلك بوضوح
- الدرجات يجب أن تعكس الأرقام الحقيقية
- platformRecommendation: جملة واحدة عملية ومباشرة تذكر الدرجة الحالية والهدف والخطوة الأولى`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: "أنت محلل سوشيال ميديا. أجب بـ JSON صحيح فقط." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" } as any,
    });

    const rawContent = response.choices[0]?.message?.content;
    const content = typeof rawContent === "string" ? rawContent : "{}";
    const result = JSON.parse(content);

    return {
      engagementScore: Math.min(10, Math.max(0, Number(result.engagementScore) || 0)),
      contentQualityScore: Math.min(10, Math.max(0, Number(result.contentQualityScore) || 0)),
      postingFrequencyScore: Math.min(10, Math.max(0, Number(result.postingFrequencyScore) || 0)),
      digitalPresenceScore: Math.min(10, Math.max(0, Number(result.digitalPresenceScore) || 0)),
      overallScore: Math.min(10, Math.max(0, Number(result.overallScore) || 0)),
      summary: result.summary || "",
      recommendations: Array.isArray(result.recommendations) ? result.recommendations.slice(0, 5) : [],
      gaps: Array.isArray(result.gaps) ? result.gaps.slice(0, 5) : [],
      platformRecommendation: typeof result.platformRecommendation === "string" ? result.platformRecommendation : "",
    };
  } catch (err) {
    console.error(`[SocialAI ${platform}] Error:`, err);
    return defaultResult;
  }
}

export async function runSocialEnrichment(
  lead: Lead
): Promise<SocialEnrichmentResult> {
  // تحقق من وجود منصة واحدة على الأقل
  const hasSocialPresence =
    lead.instagramUrl ||
    lead.twitterUrl ||
    lead.tiktokUrl ||
    lead.snapchatUrl ||
    lead.facebookUrl ||
    lead.linkedinUrl;

  if (!hasSocialPresence) {
    return { success: false, reason: "no_social_profiles" };
  }

  const db = await getDb();
  if (!db) {
    return { success: false, reason: "db_unavailable" };
  }

  let allData: Awaited<ReturnType<typeof fetchAllRealData>>;
  try {
    allData = await fetchAllRealData({
      instagramUrl: lead.instagramUrl ?? undefined,
      twitterUrl: lead.twitterUrl ?? undefined,
      tiktokUrl: lead.tiktokUrl ?? undefined,
      website: lead.website ?? undefined,
    });
  } catch (err) {
    return {
      success: false,
      reason: `social_fetch_failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const businessType = (lead as any).businessType || "";
  const city = (lead as any).city || "";
  // ملاحظات المحلل — تُمرر لكل منصة لتوجيه الـ AI
  const analyzerNotes = (lead as any).notes || (lead as any).additionalNotes || "";
  const platformsEnriched: string[] = [];

  // ─── تحليل وحفظ Instagram ────────────────────────────────────────────────
  if (allData.instagram) {
    const ig = allData.instagram;
    const aiAnalysis = await analyzePlatformWithAI("Instagram", ig as any, businessType, city, analyzerNotes);

    await db.insert(socialAnalyses).values({
      leadId: lead.id,
      platform: "instagram",
      profileUrl: lead.instagramUrl ?? undefined,
      hasAccount: true,
      followersCount: ig.followers ?? undefined,
      engagementRate: ig.avgEngagementRate ?? undefined,
      postsCount: ig.postsCount ?? undefined,
      avgLikes: ig.avgLikes ?? undefined,
      engagementScore: aiAnalysis.engagementScore,
      contentQualityScore: aiAnalysis.contentQualityScore,
      postingFrequencyScore: aiAnalysis.postingFrequencyScore,
      digitalPresenceScore: aiAnalysis.digitalPresenceScore,
      overallScore: aiAnalysis.overallScore,
      summary: aiAnalysis.summary,
      recommendations: aiAnalysis.recommendations,
      gaps: aiAnalysis.gaps,
      rawAnalysis: JSON.stringify({ ...ig, platformRecommendation: aiAnalysis.platformRecommendation }),
      dataSource: "bright_data",
      analysisText: aiAnalysis.platformRecommendation || aiAnalysis.summary || `Instagram: ${ig.followers ?? 0} متابع | تفاعل: ${ig.avgEngagementRate ?? 0}%`,
    });
    platformsEnriched.push("instagram");
  }

  // ─── تحليل وحفظ Twitter/X ────────────────────────────────────────────────
  if (allData.twitter) {
    const tw = allData.twitter;
    const aiAnalysis = await analyzePlatformWithAI("Twitter/X", tw as any, businessType, city, analyzerNotes);

    await db.insert(socialAnalyses).values({
      leadId: lead.id,
      platform: "twitter",
      profileUrl: lead.twitterUrl ?? undefined,
      hasAccount: true,
      followersCount: tw.followers ?? undefined,
      postsCount: tw.tweetsCount ?? undefined,
      engagementScore: aiAnalysis.engagementScore,
      contentQualityScore: aiAnalysis.contentQualityScore,
      postingFrequencyScore: aiAnalysis.postingFrequencyScore,
      digitalPresenceScore: aiAnalysis.digitalPresenceScore,
      overallScore: aiAnalysis.overallScore,
      summary: aiAnalysis.summary,
      recommendations: aiAnalysis.recommendations,
      gaps: aiAnalysis.gaps,
      rawAnalysis: JSON.stringify({ ...tw, platformRecommendation: aiAnalysis.platformRecommendation }),
      dataSource: "bright_data",
      analysisText: aiAnalysis.platformRecommendation || aiAnalysis.summary || `Twitter/X: ${tw.followers ?? 0} متابع`,
    });
    platformsEnriched.push("twitter");
  }

  // ─── تحليل وحفظ TikTok ───────────────────────────────────────────────────
  if (allData.tiktok) {
    const tt = allData.tiktok;
    const aiAnalysis = await analyzePlatformWithAI("TikTok", tt as any, businessType, city, analyzerNotes);

    await db.insert(socialAnalyses).values({
      leadId: lead.id,
      platform: "tiktok",
      profileUrl: lead.tiktokUrl ?? undefined,
      hasAccount: true,
      followersCount: tt.followers ?? undefined,
      engagementRate: tt.avgEngagementRate ?? undefined,
      postsCount: tt.videoCount ?? undefined,
      engagementScore: aiAnalysis.engagementScore,
      contentQualityScore: aiAnalysis.contentQualityScore,
      postingFrequencyScore: aiAnalysis.postingFrequencyScore,
      digitalPresenceScore: aiAnalysis.digitalPresenceScore,
      overallScore: aiAnalysis.overallScore,
      summary: aiAnalysis.summary,
      recommendations: aiAnalysis.recommendations,
      gaps: aiAnalysis.gaps,
      rawAnalysis: JSON.stringify({ ...tt, platformRecommendation: aiAnalysis.platformRecommendation }),
      dataSource: "bright_data",
      analysisText: aiAnalysis.platformRecommendation || aiAnalysis.summary || `TikTok: ${tt.followers ?? 0} متابع | تفاعل: ${tt.avgEngagementRate ?? 0}%`,
    });
    platformsEnriched.push("tiktok");
  }

  return { success: true, platformsEnriched };
}
