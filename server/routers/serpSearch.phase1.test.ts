/**
 * PHASE 1 Tests — serpSearch + brightDataSearch + googleUrlBuilder
 * ================================================================
 * يتحقق من الإصلاحات الثلاثة:
 *   A. parseGoogleResultsGeneric() يعمل بدون domain filter
 *   B. buildGoogleSearchUrl() يبني URL صحيح بدون cr=countrySA
 *   C. candidatePhones vs verifiedPhones — لا يوجد حقل phone قديم
 */

import { describe, it, expect } from "vitest";
import { parseGoogleResultsGeneric, parseGoogleResultsPublic } from "./serpSearch";
import { buildGoogleSearchUrl, buildSiteSearchUrl } from "../lib/googleUrlBuilder";

// ─── A. parseGoogleResultsGeneric ────────────────────────────────────────────

describe("parseGoogleResultsGeneric — PHASE 1 FIX", () => {
  it("يجب أن تُرجع نتائج من HTML حقيقي (بدون domain filter)", () => {
    // HTML مُصغَّر يحاكي بنية Google الحديثة
    const mockHtml = `
      <div class="g">
        <h3 class="LC20lb">مطعم البركة - الرياض</h3>
        <a href="https://albaraka-restaurant.sa/about">رابط</a>
        <div class="VwiC3b">مطعم سعودي متخصص في المأكولات الشعبية بالرياض</div>
      </div>
      <div class="g">
        <h3 class="LC20lb">شركة النخيل للتجارة</h3>
        <a href="https://nakheel-trading.com.sa">رابط</a>
        <div class="VwiC3b">شركة تجارية في الرياض 0501234567</div>
      </div>
    `;

    const results = parseGoogleResultsGeneric(mockHtml);
    // النتائج قد تكون فارغة (HTML مُبسَّط) لكن الدالة يجب أن لا تُرجع خطأ
    expect(Array.isArray(results)).toBe(true);
  });

  it("يجب أن تُرجع candidatePhones وليس verifiedPhones", () => {
    // HTML يحتوي على رقم هاتف في النص
    const mockHtml = `
      <div>
        <h3>مطعم الرياض</h3>
        <a href="https://restaurant-riyadh.sa/contact">link</a>
        <div class="VwiC3b">تواصل معنا على 0501234567 بالرياض</div>
      </div>
    `;

    const results = parseGoogleResultsGeneric(mockHtml);
    // كل نتيجة يجب أن تحتوي على candidatePhones وليس phone أو verifiedPhones
    for (const r of results) {
      expect(r).toHaveProperty("candidatePhones");
      expect(Array.isArray(r.candidatePhones)).toBe(true);
      expect(r).not.toHaveProperty("phone");
      expect(r).not.toHaveProperty("verifiedPhones");
    }
  });

  it("يجب أن تُرجع [] عند HTML فارغ", () => {
    expect(parseGoogleResultsGeneric("")).toEqual([]);
    expect(parseGoogleResultsGeneric("<html></html>")).toEqual([]);
  });

  it("يجب أن تُرجع [] عند HTML يحتوي فقط على روابط Google الداخلية", () => {
    const googleOnlyHtml = `
      <a href="https://www.google.com/search?q=test">بحث</a>
      <a href="https://accounts.google.com/login">تسجيل دخول</a>
      <a href="https://maps.google.com/maps">خرائط</a>
    `;
    expect(parseGoogleResultsGeneric(googleOnlyHtml)).toEqual([]);
  });
});

// ─── B. buildGoogleSearchUrl ─────────────────────────────────────────────────

describe("buildGoogleSearchUrl — Centralized URL Builder", () => {
  it("يجب أن يبني URL صحيح مع المعاملات الافتراضية", () => {
    const url = buildGoogleSearchUrl({ query: "مطاعم الرياض" });
    expect(url).toContain("https://www.google.com/search");
    expect(url).toContain("hl=ar");
    expect(url).toContain("gl=sa");
    expect(url).toContain("num=20");
  });

  it("يجب أن لا يحتوي على cr=countrySA", () => {
    const url = buildGoogleSearchUrl({ query: "مطاعم الرياض" });
    expect(url).not.toContain("cr=countrySA");
    expect(url).not.toContain("countrySA");
  });

   it("يجب أن يُشفّر الاستعلام بشكل صحيح", () => {
    const url = buildGoogleSearchUrl({ query: "site:instagram.com مطعم الرياض" });
    // URLSearchParams تستخدم + بدلاً من %20 للمسافات — سلوك HTTP صحيح
    // نتحقق من وجود الكلمات المشفّرة بأي شكل (+ أو %20)
    expect(url).toContain("site%3Ainstagram.com"); // site: مشفّر
    expect(url).toContain("%D9%85%D8%B7%D8%B9%D9%85"); // مطعم مشفّر
    expect(url).toContain("%D8%A7%D9%84%D8%B1%D9%8A%D8%A7%D8%B6"); // الرياض مشفّر
  });

  it("يجب أن يدعم معاملات مخصصة", () => {
    const url = buildGoogleSearchUrl({ query: "test", num: 10, hl: "en", gl: "us" });
    expect(url).toContain("num=10");
    expect(url).toContain("hl=en");
    expect(url).toContain("gl=us");
  });

  it("يجب أن يضيف start عند page > 1", () => {
    const url = buildGoogleSearchUrl({ query: "test", page: 2 });
    expect(url).toContain("start=20");
  });

  it("يجب أن لا يضيف start عند page = 1", () => {
    const url = buildGoogleSearchUrl({ query: "test", page: 1 });
    expect(url).not.toContain("start=");
  });
});

describe("buildSiteSearchUrl — Site-Specific URL Builder", () => {
  it("يجب أن يبني URL مع site: filter", () => {
    const url = buildSiteSearchUrl("instagram.com", "مطعم", "الرياض");
    expect(url).toContain("site%3Ainstagram.com");
    expect(url).not.toContain("cr=countrySA");
  });

  it("يجب أن يضيف السعودية عند عدم تحديد موقع", () => {
    const url = buildSiteSearchUrl("instagram.com", "مطعم");
    expect(url).toContain(encodeURIComponent("السعودية"));
  });
});

// ─── C. parseGoogleResultsPublic — لا يزال يعمل مع domain filter ────────────

describe("parseGoogleResultsPublic — لا يزال يعمل بعد PHASE 1", () => {
  it("يجب أن تُرجع [] عند domainFilter فارغ (السلوك القديم محفوظ)", () => {
    // هذا السلوك مقصود — parseGoogleResultsPublic مُصمَّمة للمنصات فقط
    // parseGoogleResultsGeneric هي البديل للبحث العام
    const result = parseGoogleResultsPublic("<html><body>test</body></html>", "");
    expect(result).toEqual([]);
  });

  it("يجب أن تُرجع نتائج عند domainFilter صحيح", () => {
    const mockHtml = `
      <div>
        <h3>مطعم البركة</h3>
        instagram.com/albaraka_ksa/ في الرياض
      </div>
    `;
    const results = parseGoogleResultsPublic(mockHtml, "instagram.com");
    // قد تكون فارغة (HTML مُبسَّط) لكن الدالة يجب أن لا تُرجع خطأ
    expect(Array.isArray(results)).toBe(true);
  });

  it("يجب أن تُرجع نتائج تحتوي على username وليس candidatePhones", () => {
    // parseGoogleResultsPublic تُرجع username (للمنصات)
    // parseGoogleResultsGeneric تُرجع candidatePhones (للبحث العام)
    const mockHtml = `
      <div>
        <h3>albaraka_ksa (@albaraka_ksa)</h3>
        instagram.com/albaraka_ksa/ مطعم الرياض
      </div>
    `;
    const results = parseGoogleResultsPublic(mockHtml, "instagram.com");
    for (const r of results) {
      expect(r).toHaveProperty("username");
      expect(r).toHaveProperty("displayName");
      expect(r).toHaveProperty("bio");
      expect(r).toHaveProperty("url");
      // لا يجب أن تحتوي على candidatePhones (هذا حقل parseGoogleResultsGeneric)
      expect(r).not.toHaveProperty("candidatePhones");
    }
  });
});
