/**
 * Bright Data LinkedIn Companies API
 * Endpoint: POST https://api.brightdata.com/linkedin/companies/collect
 * Docs: https://docs.brightdata.com/api-reference/web-scraper-api/social-media-apis/linkedin/companies
 *
 * This is a SYNCHRONOUS API — returns data directly (no polling needed).
 * Auth: Bearer token (BRIGHT_DATA_API_TOKEN)
 */

import { ENV } from "../_core/env";

export interface LinkedInCompanyData {
  id?: string;
  name?: string;
  about?: string;
  slogan?: string;
  description?: string;
  specialties?: string[];
  organization_type?: string;
  company_size?: string;
  industries?: string[];
  founded?: number;
  country_code?: string;
  headquarters?: string;
  followers?: number;
  employees?: number;
  employees_in_linkedin?: number;
  logo?: string;
  image?: string;
  url?: string;
  website?: string;
  locations?: Array<{
    city?: string;
    country?: string;
    is_headquarters?: boolean;
  }>;
  funding?: {
    total_funding?: number;
    last_funding_type?: string;
    num_funding_rounds?: number;
  };
  timestamp?: string;
}

export interface LinkedInAnalysisResult {
  success: boolean;
  dataSource: "api" | "scraper_fallback" | "ai_estimate";
  companyData?: LinkedInCompanyData;
  followersCount: number;
  employeesCount: number;
  industry: string;
  headquarters: string;
  founded: number | null;
  companySize: string;
  specialties: string[];
  about: string;
  error?: string;
}

/**
 * جلب بيانات شركة LinkedIn عبر Bright Data Web Scraper API
 * يستخدم endpoint مخصص للـ LinkedIn Companies
 */
export async function fetchLinkedInCompanyData(
  linkedinUrl: string
): Promise<LinkedInCompanyData | null> {
  const apiToken = ENV.brightDataApiToken;
  if (!apiToken) {
    console.warn("[LinkedIn API] brightDataApiToken not set");
    return null;
  }

  // تنظيف الـ URL وتأكد أنه LinkedIn company URL
  const cleanUrl = normalizeLinkedInUrl(linkedinUrl);
  if (!cleanUrl) {
    console.warn("[LinkedIn API] Invalid LinkedIn URL:", linkedinUrl);
    return null;
  }

  console.log("[LinkedIn API] Fetching company data for:", cleanUrl);

  try {
    const response = await fetch(
      "https://api.brightdata.com/linkedin/companies/collect",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: cleanUrl }),
        signal: AbortSignal.timeout(60000), // 60 seconds timeout
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[LinkedIn API] HTTP ${response.status}: ${errorText.substring(0, 200)}`
      );
      return null;
    }

    const data = await response.json();

    // قد يرجع array أو object واحد
    const company = Array.isArray(data) ? data[0] : data;

    if (!company || typeof company !== "object") {
      console.warn("[LinkedIn API] Empty or invalid response");
      return null;
    }

    console.log(
      `[LinkedIn API] Success: ${company.name} | ${company.followers} followers | ${company.employees} employees`
    );
    return company as LinkedInCompanyData;
  } catch (err: any) {
    if (err.name === "TimeoutError") {
      console.error("[LinkedIn API] Request timed out after 60s");
    } else {
      console.error("[LinkedIn API] Fetch error:", err.message);
    }
    return null;
  }
}

/**
 * تحليل بيانات LinkedIn مع fallback للـ Scraper
 */
export async function analyzeLinkedInCompany(
  linkedinUrl: string,
  companyName: string
): Promise<LinkedInAnalysisResult> {
  // المحاولة الأولى: Bright Data LinkedIn Companies API
  const companyData = await fetchLinkedInCompanyData(linkedinUrl);

  if (companyData && (companyData.followers || companyData.employees || companyData.name)) {
    return {
      success: true,
      dataSource: "api",
      companyData,
      followersCount: companyData.followers || 0,
      employeesCount:
        companyData.employees || companyData.employees_in_linkedin || 0,
      industry: companyData.industries?.join(", ") || "",
      headquarters: companyData.headquarters || "",
      founded: companyData.founded || null,
      companySize: companyData.company_size || "",
      specialties: companyData.specialties || [],
      about: companyData.about || companyData.description || "",
    };
  }

  // المحاولة الثانية: محاولة Scraping مباشر
  console.log("[LinkedIn API] Falling back to scraper for:", linkedinUrl);
  const scraperData = await scrapeLinkedInFallback(linkedinUrl);

  if (scraperData) {
    return {
      success: true,
      dataSource: "scraper_fallback",
      companyData: scraperData,
      followersCount: scraperData.followers || 0,
      employeesCount: scraperData.employees || 0,
      industry: scraperData.industries?.join(", ") || "",
      headquarters: scraperData.headquarters || "",
      founded: scraperData.founded || null,
      companySize: scraperData.company_size || "",
      specialties: scraperData.specialties || [],
      about: scraperData.about || "",
    };
  }

  // فشل كلا المحاولتين
  return {
    success: false,
    dataSource: "ai_estimate",
    followersCount: 0,
    employeesCount: 0,
    industry: "",
    headquarters: "",
    founded: null,
    companySize: "",
    specialties: [],
    about: "",
    error: "Failed to fetch LinkedIn data via API and scraper",
  };
}

/**
 * Scraping fallback باستخدام HTTP proxy
 */
async function scrapeLinkedInFallback(
  url: string
): Promise<LinkedInCompanyData | null> {
  const apiToken = ENV.brightDataApiToken;
  if (!apiToken) return null;

  try {
    // استخدام Bright Data Unlocker للوصول لـ LinkedIn
    const response = await fetch(
      "https://api.brightdata.com/request",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          zone: "web_unlocker1",
          url,
          format: "raw",
          country: "sa",
        }),
        signal: AbortSignal.timeout(45000),
      }
    );

    if (!response.ok) return null;

    const html = await response.text();

    // استخراج البيانات من JSON-LD أو meta tags
    return extractLinkedInDataFromHTML(html);
  } catch {
    return null;
  }
}

/**
 * استخراج بيانات LinkedIn من HTML
 */
function extractLinkedInDataFromHTML(html: string): LinkedInCompanyData | null {
  try {
    // محاولة استخراج JSON-LD
    const jsonLdMatch = html.match(
      /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
    );
    if (jsonLdMatch) {
      for (const match of jsonLdMatch) {
        const jsonContent = match
          .replace(/<script[^>]*>/i, "")
          .replace(/<\/script>/i, "");
        try {
          const data = JSON.parse(jsonContent);
          if (data["@type"] === "Organization" || data.name) {
            return {
              name: data.name,
              about: data.description,
              headquarters: data.address?.addressLocality,
              industries: data.industry ? [data.industry] : [],
              founded: data.foundingDate
                ? parseInt(data.foundingDate)
                : undefined,
            };
          }
        } catch {}
      }
    }

    // استخراج من meta tags
    const nameMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
    const descMatch = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i);

    if (nameMatch) {
      return {
        name: nameMatch[1]?.replace(" | LinkedIn", "").trim(),
        about: descMatch?.[1],
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * تطبيع LinkedIn URL للتأكد من صحته
 */
function normalizeLinkedInUrl(url: string): string | null {
  if (!url) return null;

  // إضافة https إذا لم يكن موجوداً
  let cleanUrl = url.trim();
  if (!cleanUrl.startsWith("http")) {
    cleanUrl = "https://" + cleanUrl;
  }

  // التحقق من أنه LinkedIn URL
  if (!cleanUrl.includes("linkedin.com")) {
    // إذا كان اسم شركة فقط، حاول بناء URL
    return null;
  }

  // تأكد من أنه company URL
  if (
    !cleanUrl.includes("/company/") &&
    !cleanUrl.includes("/school/") &&
    !cleanUrl.includes("/showcase/")
  ) {
    // قد يكون profile URL وليس company
    return cleanUrl; // نحاول على أي حال
  }

  // إزالة trailing slash وإضافة about/ للحصول على بيانات أكثر
  cleanUrl = cleanUrl.replace(/\/$/, "");

  return cleanUrl;
}

/**
 * بناء LinkedIn company URL من اسم الشركة (للبحث)
 */
export function buildLinkedInSearchUrl(companyName: string): string {
  const slug = companyName
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF\s]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
  return `https://www.linkedin.com/company/${slug}/`;
}
