/**
 * snapshotDb.ts
 * دوال حفظ وقراءة البيانات الحقيقية من قاعدة البيانات
 * جدول: real_social_snapshots
 */

import { eq, desc, and } from "drizzle-orm";
import { getDb } from "./db";
import {
  realSocialSnapshots,
  InsertRealSocialSnapshot,
  RealSocialSnapshot,
} from "../drizzle/schema";
import type { AllRealData } from "./routers/realSocialData";

// ─── حفظ لقطة جديدة ──────────────────────────────────────────────────────────

export async function saveRealSocialSnapshot(
  leadId: number,
  realData: AllRealData
): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const insertData: InsertRealSocialSnapshot = {
      leadId,
      availableSources: realData.availableSources as any,
      fetchedAt: new Date(realData.fetchedAt),
    };

    // TikTok
    if (realData.tiktok) {
      const t = realData.tiktok;
      insertData.tiktokUsername = t.username;
      insertData.tiktokFollowers = t.followers;
      insertData.tiktokFollowing = t.following;
      insertData.tiktokHearts = t.hearts;
      insertData.tiktokVideoCount = t.videoCount;
      insertData.tiktokVerified = t.verified;
      insertData.tiktokEngagementRate = t.avgEngagementRate;
      insertData.tiktokDescription = t.description;
      insertData.tiktokTopVideos = t.topVideos as any;
    }

    // Twitter
    if (realData.twitter) {
      const tw = realData.twitter;
      insertData.twitterUsername = tw.username;
      insertData.twitterFollowers = tw.followers;
      insertData.twitterFollowing = tw.following;
      insertData.twitterTweetsCount = tw.tweetsCount;
      insertData.twitterVerified = tw.verified;
      insertData.twitterBlueVerified = tw.isBlueVerified;
      insertData.twitterDescription = tw.description;
      insertData.twitterLocation = tw.location;
    }

    // Instagram
    if (realData.instagram) {
      const ig = realData.instagram;
      insertData.instagramUsername = ig.username;
      insertData.instagramFollowers = ig.followers;
      insertData.instagramFollowing = ig.following;
      insertData.instagramPostsCount = ig.postsCount;
      insertData.instagramVerified = ig.verified;
      insertData.instagramEngagementRate = ig.avgEngagementRate;
      insertData.instagramBio = ig.bio;
      insertData.instagramTopPosts = ig.topPosts as any;
    }

    // Backlinks
    if (realData.backlinks) {
      const b = realData.backlinks;
      insertData.backlinkDomain = b.domain;
      insertData.backlinkTotal = b.totalBacklinks;
      insertData.backlinkReferringDomains = b.referringDomains as any;
      insertData.backlinkHasGMB = b.hasGoogleMyBusiness;
      insertData.backlinkHasSocial = b.hasSocialLinks;
    }

    const result = await db.insert(realSocialSnapshots).values(insertData);
    const insertId = (result[0] as any).insertId;
    console.log(`[SnapshotDB] Saved snapshot #${insertId} for lead #${leadId}`);
    return insertId;
  } catch (err: any) {
    console.error("[SnapshotDB] Failed to save snapshot:", err.message);
    return null;
  }
}

// ─── جلب آخر لقطة لعميل محدد ─────────────────────────────────────────────────

export async function getLatestSnapshot(
  leadId: number
): Promise<RealSocialSnapshot | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const results = await db
      .select()
      .from(realSocialSnapshots)
      .where(eq(realSocialSnapshots.leadId, leadId))
      .orderBy(desc(realSocialSnapshots.createdAt))
      .limit(1);

    return results[0] ?? null;
  } catch (err: any) {
    console.error("[SnapshotDB] Failed to get latest snapshot:", err.message);
    return null;
  }
}

// ─── جلب تاريخ اللقطات لعميل محدد ───────────────────────────────────────────

export async function getSnapshotHistory(
  leadId: number,
  limit: number = 10
): Promise<RealSocialSnapshot[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const results = await db
      .select()
      .from(realSocialSnapshots)
      .where(eq(realSocialSnapshots.leadId, leadId))
      .orderBy(desc(realSocialSnapshots.createdAt))
      .limit(limit);

    return results;
  } catch (err: any) {
    console.error("[SnapshotDB] Failed to get snapshot history:", err.message);
    return [];
  }
}

// ─── تحويل لقطة DB إلى AllRealData ───────────────────────────────────────────

export function snapshotToRealData(snapshot: RealSocialSnapshot): AllRealData {
  const sources: string[] = (snapshot.availableSources as string[]) || [];

  const tiktok = snapshot.tiktokUsername
    ? {
        username: snapshot.tiktokUsername,
        nickname: snapshot.tiktokUsername,
        followers: snapshot.tiktokFollowers ?? 0,
        following: snapshot.tiktokFollowing ?? 0,
        hearts: snapshot.tiktokHearts ?? 0,
        videoCount: snapshot.tiktokVideoCount ?? 0,
        verified: snapshot.tiktokVerified ?? false,
        description: snapshot.tiktokDescription ?? "",
        avatarUrl: "",
        secUid: "",
        topVideos: (snapshot.tiktokTopVideos as any[]) ?? [],
        avgEngagementRate: snapshot.tiktokEngagementRate ?? 0,
        dataSource: "tiktok_api" as const,
        fetchedAt: snapshot.fetchedAt.toISOString(),
      }
    : null;

  const twitter = snapshot.twitterUsername
    ? {
        username: snapshot.twitterUsername,
        displayName: snapshot.twitterUsername,
        followers: snapshot.twitterFollowers ?? 0,
        following: snapshot.twitterFollowing ?? 0,
        tweetsCount: snapshot.twitterTweetsCount ?? 0,
        listedCount: 0,
        verified: snapshot.twitterVerified ?? false,
        isBlueVerified: snapshot.twitterBlueVerified ?? false,
        description: snapshot.twitterDescription ?? "",
        location: snapshot.twitterLocation ?? "",
        website: "",
        createdAt: "",
        profileImageUrl: "",
        dataSource: "twitter_api" as const,
        fetchedAt: snapshot.fetchedAt.toISOString(),
      }
    : null;

  const instagram = snapshot.instagramUsername
    ? {
        username: snapshot.instagramUsername,
        fullName: snapshot.instagramUsername,
        followers: snapshot.instagramFollowers ?? 0,
        following: snapshot.instagramFollowing ?? 0,
        postsCount: snapshot.instagramPostsCount ?? 0,
        verified: snapshot.instagramVerified ?? false,
        bio: snapshot.instagramBio ?? "",
        profilePicUrl: "",
        isPrivate: false,
        avgLikes: 0,
        avgComments: 0,
        avgEngagementRate: snapshot.instagramEngagementRate ?? 0,
        topPosts: (snapshot.instagramTopPosts as any[]) ?? [],
        dataSource: "bright_data_instagram" as const,
        fetchedAt: snapshot.fetchedAt.toISOString(),
      }
    : null;

  const backlinks = snapshot.backlinkDomain
    ? {
        domain: snapshot.backlinkDomain,
        totalBacklinks: snapshot.backlinkTotal ?? 0,
        referringDomains: (snapshot.backlinkReferringDomains as string[]) ?? [],
        topSources: [],
        hasGoogleMyBusiness: snapshot.backlinkHasGMB ?? false,
        hasSocialLinks: snapshot.backlinkHasSocial ?? false,
        dataSource: "bright_data_serp" as const,
        fetchedAt: snapshot.fetchedAt.toISOString(),
      }
    : null;

  return {
    tiktok,
    twitter,
    instagram,
    backlinks,
    fetchedAt: snapshot.fetchedAt.toISOString(),
    availableSources: sources,
  };
}

// ─── حساب التغيرات بين لقطتين ─────────────────────────────────────────────────

export interface SnapshotDiff {
  platform: string;
  metric: string;
  oldValue: number;
  newValue: number;
  change: number;
  changePercent: number;
  direction: "up" | "down" | "same";
}

export function calculateSnapshotDiff(
  older: RealSocialSnapshot,
  newer: RealSocialSnapshot
): SnapshotDiff[] {
  const diffs: SnapshotDiff[] = [];

  const addDiff = (platform: string, metric: string, oldVal: number | null | undefined, newVal: number | null | undefined) => {
    const o = oldVal ?? 0;
    const n = newVal ?? 0;
    if (o === 0 && n === 0) return;
    const change = n - o;
    const changePercent = o > 0 ? Math.round((change / o) * 100 * 10) / 10 : 0;
    diffs.push({
      platform,
      metric,
      oldValue: o,
      newValue: n,
      change,
      changePercent,
      direction: change > 0 ? "up" : change < 0 ? "down" : "same",
    });
  };

  // TikTok
  addDiff("TikTok", "المتابعون", older.tiktokFollowers, newer.tiktokFollowers);
  addDiff("TikTok", "الفيديوهات", older.tiktokVideoCount, newer.tiktokVideoCount);

  // Twitter
  addDiff("Twitter", "المتابعون", older.twitterFollowers, newer.twitterFollowers);
  addDiff("Twitter", "التغريدات", older.twitterTweetsCount, newer.twitterTweetsCount);

  // Instagram
  addDiff("Instagram", "المتابعون", older.instagramFollowers, newer.instagramFollowers);
  addDiff("Instagram", "المنشورات", older.instagramPostsCount, newer.instagramPostsCount);

  // Backlinks
  addDiff("الباك لينك", "الروابط الخارجية", older.backlinkTotal, newer.backlinkTotal);

  return diffs.filter(d => d.direction !== "same");
}
