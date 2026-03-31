import { ENV } from "../_core/env";
import {
  fetchTikTokPosts,
  fetchTikTokProfile,
  fetchTwitterPosts,
} from "../lib/brightDataSocialDatasets";

export interface TikTokRealData {
  username: string;
  nickname: string;
  followers: number;
  following: number;
  hearts: number;
  videoCount: number;
  verified: boolean;
  description: string;
  avatarUrl: string;
  secUid: string;
  topVideos: Array<{
    id: string;
    description: string;
    playCount: number;
    likeCount: number;
    commentCount: number;
    shareCount: number;
    createTime: number;
  }>;
  avgEngagementRate: number;
  dataSource: "tiktok_api";
  fetchedAt: string;
}

export interface TwitterRealData {
  username: string;
  displayName: string;
  followers: number;
  following: number;
  tweetsCount: number;
  listedCount: number;
  verified: boolean;
  isBlueVerified: boolean;
  description: string;
  location: string;
  website: string;
  createdAt: string;
  profileImageUrl: string;
  dataSource: "twitter_api";
  fetchedAt: string;
}

export interface BacklinkData {
  domain: string;
  totalBacklinks: number;
  referringDomains: string[];
  topSources: Array<{
    domain: string;
    title: string;
    url: string;
    snippet: string;
  }>;
  hasGoogleMyBusiness: boolean;
  hasSocialLinks: boolean;
  dataSource: "bright_data_serp";
  fetchedAt: string;
}

export interface InstagramRealData {
  username: string;
  fullName: string;
  followers: number;
  following: number;
  postsCount: number;
  verified: boolean;
  bio: string;
  profilePicUrl: string;
  isPrivate: boolean;
  avgLikes: number;
  avgComments: number;
  avgEngagementRate: number;
  topPosts: Array<{
    id: string;
    caption: string;
    likesCount: number;
    commentsCount: number;
    timestamp: string;
    mediaType: string;
  }>;
  dataSource: "bright_data_instagram";
  fetchedAt: string;
}

export interface AllRealData {
  tiktok: TikTokRealData | null;
  twitter: TwitterRealData | null;
  instagram: InstagramRealData | null;
  backlinks: BacklinkData | null;
  fetchedAt: string;
  availableSources: string[];
}

function extractTikTokUsername(url: string): string | null {
  if (!url) return null;
  const match =
    url.match(/tiktok\.com\/@([a-zA-Z0-9._]+)/i) ||
    url.match(/^@([a-zA-Z0-9._]+)$/) ||
    url.match(/^([a-zA-Z0-9._]+)$/);
  return match ? match[1] : null;
}

function extractTwitterUsername(url: string): string | null {
  if (!url) return null;
  const match =
    url.match(/(?:twitter|x)\.com\/([a-zA-Z0-9_]+)/i) ||
    url.match(/^@([a-zA-Z0-9_]+)$/) ||
    url.match(/^([a-zA-Z0-9_]+)$/);
  if (!match) return null;
  const excluded = ["home", "explore", "notifications", "messages", "i", "search", "hashtag"];
  if (excluded.includes(match[1].toLowerCase())) return null;
  return match[1];
}

function extractInstagramUsername(url: string): string | null {
  if (!url) return null;
  const match =
    url.match(/instagram\.com\/([a-zA-Z0-9._]+)/i) ||
    url.match(/^@([a-zA-Z0-9._]+)$/) ||
    url.match(/^([a-zA-Z0-9._]+)$/);
  if (!match) return null;
  const excluded = ["p", "reel", "stories", "explore", "accounts", "tv"];
  if (excluded.includes(match[1].toLowerCase())) return null;
  return match[1];
}

function extractWebsiteDomain(url: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function toUnixTimestamp(value: string | number | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && value.trim() !== "") return numeric;
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return Math.floor(parsed / 1000);
  }
  return 0;
}

function parseCompactNumber(value: string): number {
  if (!value) return 0;
  const clean = value.replace(/,/g, "").trim();
  if (/k$/i.test(clean)) return Math.round(parseFloat(clean) * 1000);
  if (/m$/i.test(clean)) return Math.round(parseFloat(clean) * 1000000);
  return parseInt(clean, 10) || 0;
}

async function serpRequest(targetUrl: string): Promise<string> {
  if (!ENV.brightDataApiToken) return "";

  try {
    const response = await fetch("https://api.brightdata.com/request", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ENV.brightDataApiToken}`,
      },
      body: JSON.stringify({
        zone: ENV.brightDataSerpZone || "serp_api1",
        url: targetUrl,
        format: "raw",
      }),
      signal: AbortSignal.timeout(25000),
    });

    if (!response.ok) return "";
    return response.text();
  } catch {
    return "";
  }
}

export async function fetchTikTokData(tiktokUrl: string): Promise<TikTokRealData | null> {
  const username = extractTikTokUsername(tiktokUrl);
  if (!username) return null;

  try {
    const profileResult = await fetchTikTokProfile(tiktokUrl);

    const profile = profileResult.data?.find((item) => !item.error);
    if (!profile) return null;

    const followers = Number(profile.followers ?? profile.followers_count ?? 0);
    let posts: Awaited<ReturnType<typeof fetchTikTokPosts>>["data"] = [];

    try {
      const postsResult = await fetchTikTokPosts(tiktokUrl, 10);
      posts = (postsResult.data ?? []).filter((item) => !item.error).slice(0, 5);
    } catch {
      posts = [];
    }

    const topVideos: TikTokRealData["topVideos"] = posts.map((item) => ({
      id: item.post_id || item.url || "",
      description: (item.description || "").substring(0, 100),
      playCount: Number(item.play_count || 0),
      likeCount: Number(item.digg_count || 0),
      commentCount: Number(item.comment_count || 0),
      shareCount: Number(item.share_count || 0),
      createTime: toUnixTimestamp(item.create_time),
    }));

    let avgEngagementRate = Number(
      profile.awg_engagement_rate ?? profile.avg_engagement_rate ?? 0
    );

    if (topVideos.length > 0 && followers > 0) {
      const totalEngagement = topVideos.reduce(
        (sum, video) => sum + video.likeCount + video.commentCount + video.shareCount,
        0
      );
      const avgEngagement = totalEngagement / topVideos.length;
      avgEngagementRate = Math.round((avgEngagement / followers) * 100 * 100) / 100;
    }

    return {
      username: profile.account_id || profile.username || username,
      nickname: profile.nickname || username,
      followers,
      following: Number(profile.following ?? profile.following_count ?? 0),
      hearts: Number(profile.likes ?? profile.likes_count ?? 0),
      videoCount: Number(profile.videos_count ?? posts.length),
      verified: Boolean(profile.is_verified),
      description: (profile.biography || "").substring(0, 200),
      avatarUrl: "",
      secUid: "",
      topVideos,
      avgEngagementRate,
      dataSource: "tiktok_api",
      fetchedAt: new Date().toISOString(),
    };
  } catch (err: any) {
    console.error("[TikTok Bright Data] Error:", err.message);
    return null;
  }
}

export async function fetchTwitterData(twitterUrl: string): Promise<TwitterRealData | null> {
  const username = extractTwitterUsername(twitterUrl);
  if (!username) return null;

  try {
    const postsResult = await fetchTwitterPosts(twitterUrl, 10);
    const posts = (postsResult.data ?? []).filter((item) => !item.error);
    const primaryPost = posts[0];

    if (!primaryPost) return null;

    return {
      username: primaryPost.user_posted || username,
      displayName: primaryPost.profile_name || primaryPost.name || username,
      followers: Number(primaryPost.followers || 0),
      following: Number(primaryPost.following || 0),
      tweetsCount: Number(primaryPost.posts_count || posts.length),
      listedCount: 0,
      verified: Boolean(primaryPost.is_verified),
      isBlueVerified: false,
      description: (primaryPost.biography || primaryPost.description || "").substring(0, 200),
      location: primaryPost.location || "",
      website: primaryPost.external_link || "",
      createdAt: primaryPost.date_joined || "",
      profileImageUrl: primaryPost.profile_image_link || "",
      dataSource: "twitter_api",
      fetchedAt: new Date().toISOString(),
    };
  } catch (err: any) {
    console.error("[Twitter Bright Data] Error:", err.message);
    return null;
  }
}

export async function fetchBacklinkData(websiteUrl: string): Promise<BacklinkData | null> {
  const domain = extractWebsiteDomain(websiteUrl);
  if (!domain) return null;

  try {
    const backlinkQuery = `link:${domain} -site:${domain}`;
    const backlinkUrl = `https://www.google.com/search?q=${encodeURIComponent(backlinkQuery)}&num=20&hl=ar&gl=sa`;
    const backlinkHtml = await serpRequest(backlinkUrl);

    const referringDomains: string[] = [];
    const topSources: BacklinkData["topSources"] = [];
    const seen = new Set<string>();

    if (backlinkHtml) {
      const linkMatches = backlinkHtml.match(/href="(https?:\/\/[^"]+)"/g) || [];
      for (const linkMatch of linkMatches) {
        const urlMatch = linkMatch.match(/href="(https?:\/\/[^"]+)"/);
        if (!urlMatch) continue;

        try {
          const parsed = new URL(urlMatch[1]);
          const refDomain = parsed.hostname.replace(/^www\./, "");
          if (refDomain.includes("google.") || refDomain === domain || seen.has(refDomain)) {
            continue;
          }

          seen.add(refDomain);
          referringDomains.push(refDomain);

          if (topSources.length < 8) {
            topSources.push({
              domain: refDomain,
              title: refDomain,
              url: urlMatch[1],
              snippet: "",
            });
          }
        } catch {
          continue;
        }
      }
    }

    const gmbQuery = `"${domain}" site:google.com/maps OR site:business.google.com`;
    const gmbHtml = await serpRequest(
      `https://www.google.com/search?q=${encodeURIComponent(gmbQuery)}&num=5`
    );
    const socialQuery = `site:instagram.com OR site:twitter.com OR site:tiktok.com "${domain}"`;
    const socialHtml = await serpRequest(
      `https://www.google.com/search?q=${encodeURIComponent(socialQuery)}&num=5`
    );

    return {
      domain,
      totalBacklinks: referringDomains.length,
      referringDomains: referringDomains.slice(0, 20),
      topSources: topSources.slice(0, 8),
      hasGoogleMyBusiness:
        gmbHtml.includes("google.com/maps") || gmbHtml.includes("business.google.com"),
      hasSocialLinks:
        socialHtml.includes("instagram.com") ||
        socialHtml.includes("twitter.com") ||
        socialHtml.includes("tiktok.com"),
      dataSource: "bright_data_serp",
      fetchedAt: new Date().toISOString(),
    };
  } catch (err: any) {
    console.error("[Backlink] Error:", err.message);
    return null;
  }
}

function parseInstagramProfile(profile: any, username: string): InstagramRealData {
  const followers = Number(profile.followers_count || profile.follower_count || 0);
  const posts = (profile.posts || profile.recent_posts || []).slice(0, 5);
  const topPosts = posts.map((post: any) => ({
    id: post.id || post.post_id || "",
    caption: (post.description || post.caption || "").substring(0, 100),
    likesCount: Number(post.likes || post.like_count || 0),
    commentsCount: Number(post.comments || post.comment_count || 0),
    timestamp: post.date_posted || post.timestamp || "",
    mediaType: post.media_type || "image",
  }));

  let avgLikes = 0;
  let avgComments = 0;
  let avgEngagementRate = 0;

  if (topPosts.length > 0) {
    avgLikes = Math.round(
      topPosts.reduce((sum: number, post: any) => sum + post.likesCount, 0) / topPosts.length
    );
    avgComments = Math.round(
      topPosts.reduce((sum: number, post: any) => sum + post.commentsCount, 0) / topPosts.length
    );
    if (followers > 0) {
      avgEngagementRate = Math.round(((avgLikes + avgComments) / followers) * 100 * 100) / 100;
    }
  }

  return {
    username: profile.username || username,
    fullName: profile.name || profile.full_name || username,
    followers,
    following: Number(profile.following_count || 0),
    postsCount: Number(profile.posts_count || profile.media_count || 0),
    verified: Boolean(profile.is_verified || profile.verified),
    bio: (profile.biography || profile.bio || "").substring(0, 200),
    profilePicUrl: profile.profile_pic_url || profile.avatar || "",
    isPrivate: Boolean(profile.is_private),
    avgLikes,
    avgComments,
    avgEngagementRate,
    topPosts,
    dataSource: "bright_data_instagram",
    fetchedAt: new Date().toISOString(),
  };
}

function parseInstagramFromHTML(html: string, username: string): InstagramRealData | null {
  try {
    const descriptionMatch =
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);

    const description = descriptionMatch?.[1] || "";
    const followersMatch = description.match(/([\d,.]+[KMk]?)\s*(?:Followers|متابع)/i);
    const followingMatch = description.match(/([\d,.]+[KMk]?)\s*(?:Following|يتابع)/i);
    const postsMatch = description.match(/([\d,.]+[KMk]?)\s*(?:Posts|منشور)/i);

    const followers = followersMatch ? parseCompactNumber(followersMatch[1]) : 0;
    const following = followingMatch ? parseCompactNumber(followingMatch[1]) : 0;
    const postsCount = postsMatch ? parseCompactNumber(postsMatch[1]) : 0;

    const jsonLdMatch = html.match(
      /<script type=["']application\/ld\+json["']>([^<]+)<\/script>/i
    );
    let bio = "";
    if (jsonLdMatch) {
      try {
        bio = JSON.parse(jsonLdMatch[1]).description || "";
      } catch {
        bio = "";
      }
    }

    const verified = html.includes('"is_verified":true') || html.includes('"verified":true');
    const isPrivate = html.includes('"is_private":true') || html.includes('"is_private": true');

    if (followers === 0 && postsCount === 0) return null;

    return {
      username,
      fullName: username,
      followers,
      following,
      postsCount,
      verified,
      bio: bio.substring(0, 200),
      profilePicUrl: "",
      isPrivate,
      avgLikes: 0,
      avgComments: 0,
      avgEngagementRate: 0,
      topPosts: [],
      dataSource: "bright_data_instagram",
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function fetchInstagramViaSERP(username: string): Promise<InstagramRealData | null> {
  if (!ENV.brightDataApiToken) return null;

  try {
    const response = await fetch("https://api.brightdata.com/request", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ENV.brightDataApiToken}`,
      },
      body: JSON.stringify({
        zone: ENV.brightDataSerpZone || "serp_api1",
        url: `https://www.instagram.com/${username}/`,
        format: "raw",
      }),
      signal: AbortSignal.timeout(25000),
    });

    if (!response.ok) return null;
    const html = await response.text();
    if (!html || html.length < 500) return null;
    return parseInstagramFromHTML(html, username);
  } catch (err: any) {
    console.error("[Instagram SERP] Error:", err.message);
    return null;
  }
}

export async function fetchInstagramData(instagramUrl: string): Promise<InstagramRealData | null> {
  const username = extractInstagramUsername(instagramUrl);
  if (!username || !ENV.brightDataApiToken) return null;

  try {
    const profileUrl = `https://www.instagram.com/${username}/`;
    const triggerResponse = await fetch("https://api.brightdata.com/datasets/v3/trigger", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ENV.brightDataApiToken}`,
      },
      body: JSON.stringify({
        dataset_id: "gd_l1vikfnt1wgvvqz95w",
        include_errors: false,
        type: "discover_new",
        discover_by: "url",
        data: [{ url: profileUrl }],
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!triggerResponse.ok) {
      return fetchInstagramViaSERP(username);
    }

    const triggerPayload = (await triggerResponse.json()) as { snapshot_id?: string };
    if (!triggerPayload.snapshot_id) {
      return fetchInstagramViaSERP(username);
    }

    for (let attempt = 0; attempt < 6; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      const snapshotResponse = await fetch(
        `https://api.brightdata.com/datasets/v3/snapshot/${triggerPayload.snapshot_id}?format=json`,
        {
          headers: { Authorization: `Bearer ${ENV.brightDataApiToken}` },
          signal: AbortSignal.timeout(10000),
        }
      );

      if (!snapshotResponse.ok) continue;

      const data = (await snapshotResponse.json()) as any[];
      if (!Array.isArray(data) || data.length === 0) continue;
      return parseInstagramProfile(data[0], username);
    }

    return fetchInstagramViaSERP(username);
  } catch (err: any) {
    console.error("[Instagram API] Error:", err.message);
    return fetchInstagramViaSERP(username).catch(() => null);
  }
}

export async function fetchAllRealData(lead: {
  tiktokUrl?: string | null;
  twitterUrl?: string | null;
  instagramUrl?: string | null;
  website?: string | null;
}): Promise<AllRealData> {
  const [tiktok, twitter, instagram, backlinks] = await Promise.all([
    lead.tiktokUrl ? fetchTikTokData(lead.tiktokUrl).catch(() => null) : Promise.resolve(null),
    lead.twitterUrl ? fetchTwitterData(lead.twitterUrl).catch(() => null) : Promise.resolve(null),
    lead.instagramUrl
      ? fetchInstagramData(lead.instagramUrl).catch(() => null)
      : Promise.resolve(null),
    lead.website ? fetchBacklinkData(lead.website).catch(() => null) : Promise.resolve(null),
  ]);

  const availableSources: string[] = [];
  if (tiktok) availableSources.push("TikTok (Bright Data)");
  if (twitter) availableSources.push("Twitter/X (Bright Data)");
  if (instagram) availableSources.push("Instagram (Bright Data)");
  if (backlinks) availableSources.push("Bright Data SERP (Backlinks)");

  return {
    tiktok,
    twitter,
    instagram,
    backlinks,
    fetchedAt: new Date().toISOString(),
    availableSources,
  };
}
