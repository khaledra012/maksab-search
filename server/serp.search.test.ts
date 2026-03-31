/**
 * اختبارات Bright Data SERP API
 * تتحقق من منطق parsing وتحويل النتائج
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch لتجنب طلبات HTTP حقيقية في الاختبارات
vi.mock("node-fetch", () => ({
  default: vi.fn(),
}));

// ===== اختبار منطق استخراج username من URLs =====

describe("SERP URL Parsing", () => {
  describe("Snapchat URL parsing", () => {
    const extractSnapchatUsername = (url: string): string | null => {
      const m = url.match(/snapchat\.com\/(?:add|p|discover)\/([a-zA-Z0-9._-]+)/);
      return m ? m[1] : null;
    };

    it("should extract username from /add/ URL", () => {
      expect(extractSnapchatUsername("https://www.snapchat.com/add/nudcoffee")).toBe("nudcoffee");
    });

    it("should extract username from /p/ URL", () => {
      expect(extractSnapchatUsername("https://www.snapchat.com/p/riyadh.food")).toBe("riyadh.food");
    });

    it("should return null for non-snapchat URLs", () => {
      expect(extractSnapchatUsername("https://www.instagram.com/user")).toBeNull();
    });

    it("should handle usernames with dots and underscores", () => {
      expect(extractSnapchatUsername("https://www.snapchat.com/add/riyadh.events0")).toBe("riyadh.events0");
    });
  });

  describe("TikTok URL parsing", () => {
    const extractTikTokUsername = (url: string): string | null => {
      const m = url.match(/tiktok\.com\/@([a-zA-Z0-9._]+)/);
      return m ? m[1] : null;
    };

    it("should extract username from profile URL", () => {
      expect(extractTikTokUsername("https://www.tiktok.com/@alriyadh.trend")).toBe("alriyadh.trend");
    });

    it("should extract username from video URL", () => {
      expect(extractTikTokUsername("https://www.tiktok.com/@intoriyadh/video/123456")).toBe("intoriyadh");
    });

    it("should return null for non-tiktok URLs", () => {
      expect(extractTikTokUsername("https://www.snapchat.com/add/user")).toBeNull();
    });
  });

  describe("Instagram URL parsing", () => {
    const extractInstagramUsername = (url: string): string | null => {
      const m = url.match(/instagram\.com\/([a-zA-Z0-9._]+)/);
      if (!m) return null;
      const username = m[1];
      // تجاهل صفحات النظام
      if (["p", "reel", "explore", "stories", "tv", "accounts"].includes(username)) return null;
      return username;
    };

    it("should extract username from profile URL", () => {
      expect(extractInstagramUsername("https://www.instagram.com/alriyadh.trend/")).toBe("alriyadh.trend");
    });

    it("should return null for post URLs", () => {
      expect(extractInstagramUsername("https://www.instagram.com/p/ABC123/")).toBeNull();
    });

    it("should return null for reel URLs", () => {
      expect(extractInstagramUsername("https://www.instagram.com/reel/ABC123/")).toBeNull();
    });
  });
});

// ===== اختبار استخراج أرقام الهاتف =====

describe("Phone Number Extraction", () => {
  const PHONE_REGEX = /(?:\+966|00966|0)(?:5[0-9]{8}|[1-9][0-9]{7})/g;

  const extractPhones = (text: string): string[] => {
    const matches = text.match(PHONE_REGEX) || [];
    return Array.from(new Set(matches.map(p => {
      const d = p.replace(/\D/g, "");
      if (d.startsWith("966")) return "+966" + d.slice(3);
      if (d.startsWith("00966")) return "+966" + d.slice(5);
      if (d.startsWith("05")) return "+966" + d.slice(1);
      return p;
    }))).filter(p => p.length >= 12 && p.length <= 14);
  };

  it("should extract Saudi mobile number with +966", () => {
    const phones = extractPhones("تواصل معنا: +966501234567");
    expect(phones).toContain("+966501234567");
  });

  it("should extract Saudi mobile number with 05", () => {
    const phones = extractPhones("للتواصل: 0501234567");
    expect(phones).toContain("+966501234567");
  });

  it("should extract Saudi mobile number with 00966", () => {
    const phones = extractPhones("اتصل: 00966501234567");
    expect(phones).toContain("+966501234567");
  });

  it("should return empty array if no phone found", () => {
    const phones = extractPhones("لا يوجد رقم هاتف هنا");
    expect(phones).toHaveLength(0);
  });

  it("should deduplicate phone numbers", () => {
    const phones = extractPhones("+966501234567 و +966501234567");
    expect(phones).toHaveLength(1);
  });
});

// ===== اختبار تنظيف عناوين المنصات =====

describe("Title Cleanup", () => {
  const cleanSnapchatTitle = (title: string, username: string): string => {
    return title
      .replace(` | Snapchat`, "")
      .replace(` - Snapchat`, "")
      .replace(`(@${username})`, "")
      .trim();
  };

  const cleanTikTokTitle = (title: string, username: string): string => {
    return title
      .replace(` | TikTok`, "")
      .replace(` - TikTok`, "")
      .replace(`(@${username})`, "")
      .trim();
  };

  it("should remove Snapchat suffix from title", () => {
    expect(cleanSnapchatTitle("مطعم الرياض | Snapchat", "riyadh_food")).toBe("مطعم الرياض");
  });

  it("should remove TikTok suffix from title", () => {
    expect(cleanTikTokTitle("مطعم الرياض | TikTok", "riyadh_food")).toBe("مطعم الرياض");
  });

  it("should remove username mention from title", () => {
    expect(cleanSnapchatTitle("مطعم الرياض (@riyadh_food) | Snapchat", "riyadh_food")).toBe("مطعم الرياض");
  });

  it("should handle title without suffix", () => {
    expect(cleanTikTokTitle("مطعم الرياض", "riyadh_food")).toBe("مطعم الرياض");
  });
});

// ===== اختبار بناء Google Search URL =====

describe("Google Search URL Building", () => {
  const buildSearchUrl = (keyword: string, city: string, platform: string): string => {
    const query = `${keyword} ${city} site:${platform}`;
    return `https://www.google.com/search?q=${encodeURIComponent(query)}&num=20&hl=ar&gl=sa`;
  };

  it("should build correct TikTok search URL", () => {
    const url = buildSearchUrl("مطعم", "الرياض", "tiktok.com");
    expect(url).toContain("site%3Atiktok.com");
    expect(url).toContain("hl=ar");
    expect(url).toContain("gl=sa");
  });

  it("should build correct Snapchat search URL", () => {
    const url = buildSearchUrl("مطعم", "الرياض", "snapchat.com");
    expect(url).toContain("site%3Asnapchat.com");
  });

  it("should build correct Instagram search URL", () => {
    const url = buildSearchUrl("مطعم", "الرياض", "instagram.com");
    expect(url).toContain("site%3Ainstagram.com");
  });

  it("should encode Arabic characters", () => {
    const url = buildSearchUrl("مطعم", "الرياض", "tiktok.com");
    expect(url).not.toContain(" "); // لا مسافات غير مشفرة
  });
});

// ===== اختبار تحويل نتائج SERP إلى تنسيق الـ platform =====

describe("SERP Result Transformation", () => {
  const transformToSnapchat = (serpResult: { title: string; link: string; snippet: string }) => {
    const usernameMatch = serpResult.link.match(/snapchat\.com\/(?:add|p|discover)\/([a-zA-Z0-9._-]+)/);
    if (!usernameMatch) return null;
    const username = usernameMatch[1];
    return {
      id: `sc-${username}`,
      username,
      displayName: serpResult.title.replace(` | Snapchat`, "").trim(),
      description: serpResult.snippet,
      profileUrl: `https://www.snapchat.com/add/${username}`,
      dataSource: "serp" as const,
    };
  };

  it("should transform Snapchat SERP result correctly", () => {
    const result = transformToSnapchat({
      title: "مطعم الرياض | Snapchat",
      link: "https://www.snapchat.com/add/riyadh_food",
      snippet: "أفضل مطاعم الرياض",
    });
    expect(result).not.toBeNull();
    expect(result!.username).toBe("riyadh_food");
    expect(result!.displayName).toBe("مطعم الرياض");
    expect(result!.profileUrl).toBe("https://www.snapchat.com/add/riyadh_food");
    expect(result!.dataSource).toBe("serp");
  });

  it("should return null for invalid Snapchat URL", () => {
    const result = transformToSnapchat({
      title: "Some Title",
      link: "https://www.snapchat.com/", // URL بدون username
      snippet: "",
    });
    expect(result).toBeNull();
  });
});
