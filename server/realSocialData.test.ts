import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./lib/brightDataSocialDatasets", () => ({
  fetchTikTokProfile: vi.fn(),
  fetchTikTokPosts: vi.fn(),
  fetchTwitterPosts: vi.fn(),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch as typeof fetch;

import {
  fetchTikTokProfile,
  fetchTikTokPosts,
  fetchTwitterPosts,
} from "./lib/brightDataSocialDatasets";
import {
  fetchAllRealData,
  fetchBacklinkData,
  fetchTikTokData,
  fetchTwitterData,
} from "./routers/realSocialData";

const mockTikTokProfileResponse = {
  success: true,
  platform: "tiktok",
  data: [
    {
      account_id: "testuser",
      nickname: "Test User",
      biography: "وصف الحساب",
      followers: 50000,
      following: 200,
      likes: 1000000,
      videos_count: 150,
      is_verified: true,
      awg_engagement_rate: 5.5,
    },
  ],
};

const mockTikTokPostsResponse = {
  success: true,
  platform: "tiktok_posts",
  data: [
    {
      post_id: "video1",
      description: "فيديو اختبار",
      create_time: "1700000000",
      play_count: 100000,
      digg_count: 5000,
      comment_count: 200,
      share_count: 100,
    },
    {
      post_id: "video2",
      description: "فيديو آخر",
      create_time: "1700100000",
      play_count: 80000,
      digg_count: 3000,
      comment_count: 150,
      share_count: 80,
    },
  ],
};

const mockTwitterPostsResponse = {
  success: true,
  platform: "twitter",
  data: [
    {
      user_posted: "testtwitter",
      profile_name: "Test Twitter",
      biography: "وصف حساب تويتر",
      followers: 25000,
      following: 500,
      posts_count: 3000,
      is_verified: false,
      external_link: "https://example.com",
      location: "الرياض، السعودية",
      date_joined: "Mon Jan 01 00:00:00 +0000 2020",
      profile_image_link: "https://example.com/twitter-avatar.jpg",
      description: "أحدث منشور",
      num_likes: 120,
      num_views: 4500,
    },
  ],
};

describe("fetchTikTokData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("يجلب بيانات TikTok من Bright Data", async () => {
    vi.mocked(fetchTikTokProfile).mockResolvedValueOnce(mockTikTokProfileResponse as any);
    vi.mocked(fetchTikTokPosts).mockResolvedValueOnce(mockTikTokPostsResponse as any);

    const result = await fetchTikTokData("https://www.tiktok.com/@testuser");

    expect(result).not.toBeNull();
    expect(result!.username).toBe("testuser");
    expect(result!.followers).toBe(50000);
    expect(result!.videoCount).toBe(150);
    expect(result!.verified).toBe(true);
    expect(result!.hearts).toBe(1000000);
    expect(result!.topVideos).toHaveLength(2);
    expect(result!.dataSource).toBe("tiktok_api");
  });

  it("يقبل اسم المستخدم فقط", async () => {
    vi.mocked(fetchTikTokProfile).mockResolvedValueOnce(mockTikTokProfileResponse as any);
    vi.mocked(fetchTikTokPosts).mockResolvedValueOnce(mockTikTokPostsResponse as any);

    const result = await fetchTikTokData("@testuser");

    expect(result).not.toBeNull();
    expect(result!.username).toBe("testuser");
  });

  it("يرجع null عند رابط غير صالح", async () => {
    const result = await fetchTikTokData("invalid-url-without-username");
    expect(result).toBeNull();
  });

  it("يرجع بيانات أساسية حتى لو فشلت الفيديوهات", async () => {
    vi.mocked(fetchTikTokProfile).mockResolvedValueOnce(mockTikTokProfileResponse as any);
    vi.mocked(fetchTikTokPosts).mockRejectedValueOnce(new Error("Posts failed"));

    const result = await fetchTikTokData("@testuser");

    expect(result).not.toBeNull();
    expect(result!.followers).toBe(50000);
    expect(result!.topVideos).toEqual([]);
  });
});

describe("fetchTwitterData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("يجلب بيانات Twitter/X من Bright Data", async () => {
    vi.mocked(fetchTwitterPosts).mockResolvedValueOnce(mockTwitterPostsResponse as any);

    const result = await fetchTwitterData("https://x.com/testtwitter");

    expect(result).not.toBeNull();
    expect(result!.username).toBe("testtwitter");
    expect(result!.followers).toBe(25000);
    expect(result!.tweetsCount).toBe(3000);
    expect(result!.website).toBe("https://example.com");
    expect(result!.profileImageUrl).toContain("twitter-avatar");
    expect(result!.dataSource).toBe("twitter_api");
  });

  it("يرجع null عند رابط غير صالح", async () => {
    const result = await fetchTwitterData("not-a-valid-url");
    expect(result).toBeNull();
  });

  it("يرجع null عند فشل Bright Data", async () => {
    vi.mocked(fetchTwitterPosts).mockRejectedValueOnce(new Error("Posts failed"));

    const result = await fetchTwitterData("@testtwitter");

    expect(result).toBeNull();
  });
});

describe("fetchBacklinkData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BRIGHT_DATA_API_TOKEN = "test-token";
  });

  it("يرجع بيانات باك لينك عند نجاح SERP API", async () => {
    const mockHtml = `
      <html><body>
        <a href="https://blog.example.com/article">مقال</a>
        <a href="https://news.site.com/post">خبر</a>
        <a href="https://google.com/maps?q=test">Google Maps</a>
      </body></html>
    `;

    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(mockHtml),
    });

    const result = await fetchBacklinkData("https://test-domain.com");

    expect(result).not.toBeNull();
    expect(result!.domain).toBe("test-domain.com");
    expect(result!.dataSource).toBe("bright_data_serp");
    expect(result!.fetchedAt).toBeTruthy();
  });

  it("يرجع بيانات فارغة عند فشل SERP API", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      text: () => Promise.resolve("Error"),
    });

    const result = await fetchBacklinkData("https://test-domain.com");

    expect(result).not.toBeNull();
    expect(result!.totalBacklinks).toBe(0);
    expect(result!.referringDomains).toEqual([]);
  });
});

describe("fetchAllRealData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("يجمع البيانات المتاحة من كل المصادر", async () => {
    vi.mocked(fetchTikTokProfile).mockResolvedValueOnce(mockTikTokProfileResponse as any);
    vi.mocked(fetchTikTokPosts).mockResolvedValueOnce(mockTikTokPostsResponse as any);
    vi.mocked(fetchTwitterPosts).mockResolvedValueOnce(mockTwitterPostsResponse as any);
    mockFetch.mockResolvedValue({
      ok: false,
      text: () => Promise.resolve(""),
    });

    const result = await fetchAllRealData({
      tiktokUrl: "@testuser",
      twitterUrl: "@testtwitter",
      website: "https://test.com",
    });

    expect(result.tiktok).not.toBeNull();
    expect(result.twitter).not.toBeNull();
    expect(result.availableSources).toContain("TikTok (Bright Data)");
    expect(result.availableSources).toContain("Twitter/X (Bright Data)");
  });

  it("يرجع بيانات جزئية عند فشل أحد المصادر", async () => {
    vi.mocked(fetchTikTokProfile).mockResolvedValueOnce(mockTikTokProfileResponse as any);
    vi.mocked(fetchTikTokPosts).mockResolvedValueOnce(mockTikTokPostsResponse as any);
    vi.mocked(fetchTwitterPosts).mockRejectedValueOnce(new Error("Twitter error"));
    mockFetch.mockResolvedValue({
      ok: false,
      text: () => Promise.resolve(""),
    });

    const result = await fetchAllRealData({
      tiktokUrl: "@testuser",
      twitterUrl: "@testtwitter",
      website: "https://test.com",
    });

    expect(result.tiktok).not.toBeNull();
    expect(result.twitter).toBeNull();
    expect(result.availableSources).toContain("TikTok (Bright Data)");
    expect(result.availableSources).not.toContain("Twitter/X (Bright Data)");
  });

  it("يرجع بيانات فارغة عند عدم وجود روابط", async () => {
    const result = await fetchAllRealData({
      tiktokUrl: null,
      twitterUrl: null,
      website: null,
    });

    expect(result.tiktok).toBeNull();
    expect(result.twitter).toBeNull();
    expect(result.backlinks).toBeNull();
    expect(result.availableSources).toEqual([]);
  });
});
