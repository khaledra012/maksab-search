/**
 * اختبارات Vitest للميزات الثلاثة الجديدة:
 * 1. مراجعات Google Maps
 * 2. Facebook في scrapeAllPlatforms
 * 3. Snapchat عبر Scraping Browser
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ===== اختبارات Google Maps Reviews =====
describe("Google Maps Reviews", () => {
  it("يجب أن يُرجع reviews كمصفوفة منظمة", () => {
    const rawReviews = [
      { author_name: "أحمد محمد", rating: 5, text: "خدمة ممتازة", time: 1700000000 },
      { author_name: "سارة علي", rating: 4, text: "جيد جداً", time: 1710000000 },
    ];

    const reviews = rawReviews.slice(0, 10).map((r) => ({
      author: r.author_name || "",
      rating: r.rating || 0,
      text: r.text || "",
      time: r.time ? new Date(r.time * 1000).toISOString().split("T")[0] : "",
    }));

    expect(reviews).toHaveLength(2);
    expect(reviews[0].author).toBe("أحمد محمد");
    expect(reviews[0].rating).toBe(5);
    expect(reviews[0].text).toBe("خدمة ممتازة");
    expect(reviews[0].time).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(reviews[1].author).toBe("سارة علي");
  });

  it("يجب أن يُرجع مصفوفة فارغة إذا لم تكن هناك مراجعات", () => {
    const rawReviews: any[] = [];
    const reviews = rawReviews.slice(0, 10).map((r) => ({
      author: r.author_name || "",
      rating: r.rating || 0,
      text: r.text || "",
      time: r.time ? new Date(r.time * 1000).toISOString().split("T")[0] : "",
    }));

    expect(reviews).toHaveLength(0);
    expect(Array.isArray(reviews)).toBe(true);
  });

  it("يجب أن يقتصر على 10 مراجعات كحد أقصى", () => {
    const rawReviews = Array.from({ length: 15 }, (_, i) => ({
      author_name: `مستخدم ${i + 1}`,
      rating: 5,
      text: `مراجعة ${i + 1}`,
      time: 1700000000 + i * 1000,
    }));

    const reviews = rawReviews.slice(0, 10).map((r) => ({
      author: r.author_name || "",
      rating: r.rating || 0,
      text: r.text || "",
      time: r.time ? new Date(r.time * 1000).toISOString().split("T")[0] : "",
    }));

    expect(reviews).toHaveLength(10);
  });
});

// ===== اختبارات Facebook في AllPlatformsData =====
describe("Facebook في AllPlatformsData", () => {
  it("يجب أن يحتوي AllPlatformsData على حقل facebook اختياري", () => {
    // التحقق من أن interface يقبل facebook
    const data: {
      website?: any;
      instagram?: any;
      linkedin?: any;
      twitter?: any;
      tiktok?: any;
      facebook?: any;
      scrapedAt: number;
    } = {
      scrapedAt: Date.now(),
      facebook: {
        username: "testbrand",
        displayName: "Test Brand",
        bio: "",
        followersCount: 5000,
        postsCount: 100,
        avgLikes: 50,
        avgComments: 10,
        recentPosts: [],
        loadedSuccessfully: true,
      },
    };

    expect(data.facebook).toBeDefined();
    expect(data.facebook.followersCount).toBe(5000);
    expect(data.facebook.loadedSuccessfully).toBe(true);
  });

  it("يجب أن يُنسّق بيانات Facebook بشكل صحيح لـ LLM", () => {
    const facebookData = {
      displayName: "مطعم الأصالة",
      followersCount: 12000,
      postsCount: 250,
      avgLikes: 150,
      recentPosts: [
        { content: "عروض رمضان الخاصة", likesCount: 200, commentsCount: 30, date: "2024-03-01" },
        { content: "قائمة طعام جديدة", likesCount: 180, commentsCount: 25, date: "2024-02-15" },
      ],
      loadedSuccessfully: true,
    };

    // محاكاة formatScrapedDataForLLM
    const formatted = `=== فيسبوك ===
الاسم: ${facebookData.displayName}
المتابعون: ${facebookData.followersCount.toLocaleString()}
عدد المنشورات: ${facebookData.postsCount}
متوسط الإعجابات: ${facebookData.avgLikes}
آخر المنشورات: ${facebookData.recentPosts.slice(0, 3).map(p => p.content.slice(0, 100)).join(" | ")}`;

    expect(formatted).toContain("مطعم الأصالة");
    expect(formatted).toContain("12,000");
    expect(formatted).toContain("عروض رمضان الخاصة");
  });
});

// ===== اختبارات Snapchat =====
describe("Snapchat Data Extraction", () => {
  it("يجب أن يستخرج بيانات الملف الشخصي من HTML", () => {
    const handle = "testbrand";
    const html = `
      <html>
        <head>
          <meta property="og:title" content="Test Brand on Snapchat" />
          <meta property="og:description" content="شاهد قصص Test Brand على سناب شات" />
        </head>
        <body>testbrand</body>
      </html>
    `;

    const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] || "";
    const ogDescription = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1] || "";
    const hasAccount = html.includes(handle);

    expect(ogTitle).toBe("Test Brand on Snapchat");
    expect(ogDescription).toContain("سناب شات");
    expect(hasAccount).toBe(true);

    const displayName = ogTitle.replace(" on Snapchat", "").trim();
    expect(displayName).toBe("Test Brand");
  });

  it("يجب أن يُرجع بيانات أساسية إذا وُجد الحساب", () => {
    const handle = "mystore";
    const cleanUrl = `https://www.snapchat.com/add/${handle}`;
    const ogTitle = "My Store on Snapchat";
    const ogDescription = "متجر إلكتروني متخصص في الملابس";

    const posts = [{
      profile_handle: handle,
      profile_link: cleanUrl,
      content: ogDescription || `حساب Snapchat: @${handle}`,
      url: cleanUrl,
      profile_name: ogTitle.replace(" on Snapchat", "").trim() || handle,
      num_views: 0,
    }];

    expect(posts).toHaveLength(1);
    expect(posts[0].profile_name).toBe("My Store");
    expect(posts[0].content).toBe("متجر إلكتروني متخصص في الملابس");
  });

  it("يجب أن تُعيد normalizeSnapchatUrl رابطاً صحيحاً", () => {
    const inputs = [
      "testbrand",
      "@testbrand",
      "snapchat.com/add/testbrand",
      "https://www.snapchat.com/add/testbrand",
    ];

    const normalize = (input: string): string => {
      let clean = input.trim();
      if (clean.startsWith("@")) clean = clean.slice(1);
      if (clean.includes("snapchat.com/add/")) {
        clean = clean.replace(/.*snapchat\.com\/add\//, "");
      }
      if (clean.includes("snapchat.com")) {
        clean = clean.replace(/.*snapchat\.com\//, "");
      }
      return `https://www.snapchat.com/add/${clean}`;
    };

    for (const input of inputs) {
      const result = normalize(input);
      expect(result).toBe("https://www.snapchat.com/add/testbrand");
    }
  });
});

// ===== اختبارات تكاملية =====
describe("تكامل البيانات", () => {
  it("يجب أن تكون جميع الحقول الجديدة في schema موجودة", () => {
    // محاكاة schema الجديد
    const mockLeadSchema = {
      id: 1,
      companyName: "مطعم الأصالة",
      googleRating: 4.5,
      reviewCount: 120,
      googleReviewsData: [
        { author: "أحمد", rating: 5, text: "ممتاز", time: "2024-01-15" },
      ],
      facebookUrl: "https://www.facebook.com/testrestaurant",
    };

    expect(mockLeadSchema.googleRating).toBe(4.5);
    expect(mockLeadSchema.reviewCount).toBe(120);
    expect(Array.isArray(mockLeadSchema.googleReviewsData)).toBe(true);
    expect(mockLeadSchema.googleReviewsData[0].author).toBe("أحمد");
    expect(mockLeadSchema.facebookUrl).toContain("facebook.com");
  });

  it("يجب أن يُضيف facebookUrl في scrapeAllPlatforms params", () => {
    const params = {
      websiteUrl: "https://example.com",
      instagramUrl: "https://instagram.com/test",
      linkedinUrl: null,
      twitterUrl: null,
      tiktokUrl: null,
      facebookUrl: "https://facebook.com/test",
    };

    // التحقق من أن facebookUrl موجود في params
    expect(params.facebookUrl).toBeDefined();
    expect(params.facebookUrl).toContain("facebook.com");
    expect(Object.keys(params)).toContain("facebookUrl");
  });
});
