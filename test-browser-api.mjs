/**
 * اختبار Bright Data Scraping Browser API لكل منصة
 * الهدف: معرفة الـ selectors الصحيحة وكيفية استخراج البيانات
 */
import puppeteer from "puppeteer-core";
import { config } from "dotenv";
import fs from "fs";
config();

const WS = process.env.BRIGHT_DATA_WS_ENDPOINT;
if (!WS) { console.error("❌ BRIGHT_DATA_WS_ENDPOINT not set"); process.exit(1); }

async function withBrowser(fn) {
  const browser = await puppeteer.connect({ browserWSEndpoint: WS });
  try { return await fn(browser); }
  finally { await browser.close(); }
}

async function testTikTok() {
  console.log("\n" + "=".repeat(60));
  console.log("🎵 TikTok Search Test");
  console.log("=".repeat(60));
  
  return withBrowser(async (browser) => {
    const page = await browser.newPage();
    
    // إعداد متصفح موبايل
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1");
    
    // تجاوز كشف الأتمتة
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
      Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3] });
    });
    
    const query = "مطعم الرياض";
    const url = `https://www.tiktok.com/search/user?q=${encodeURIComponent(query)}`;
    console.log("URL:", url);
    
    await page.goto(url, { waitUntil: "networkidle2", timeout: 40000 });
    
    // انتظار تحميل المحتوى الديناميكي
    console.log("Waiting for dynamic content...");
    await new Promise(r => setTimeout(r, 6000));
    
    // تمرير لتحميل المزيد
    await page.evaluate(() => window.scrollBy(0, 500));
    await new Promise(r => setTimeout(r, 2000));
    
    const result = await page.evaluate(() => {
      const info = {
        title: document.title,
        bodyLen: document.body.innerHTML.length,
        sigiState: null,
        nextData: null,
        links: [],
        userCards: [],
        allH2: [],
        allH3: [],
      };
      
      // فحص SIGI_STATE
      const sigiEl = document.querySelector("#SIGI_STATE");
      if (sigiEl) {
        try {
          const data = JSON.parse(sigiEl.textContent || "");
          info.sigiState = {
            keys: Object.keys(data).slice(0, 15),
            userList: data?.SearchUserList?.userInfoList?.length || 0,
            searchData: data?.props?.pageProps?.searchData?.user_list?.length || 0,
          };
          // محاولة استخراج المستخدمين
          const users = data?.SearchUserList?.userInfoList || 
                        data?.props?.pageProps?.searchData?.user_list || [];
          info.users = users.slice(0, 5).map((u) => ({
            id: u?.userInfo?.user?.uniqueId || u?.user?.uniqueId || "?",
            name: u?.userInfo?.user?.nickname || u?.user?.nickname || "?",
            followers: u?.userInfo?.stats?.followerCount || u?.stats?.followerCount || 0,
          }));
        } catch(e) { info.sigiState = { error: e.message }; }
      }
      
      // فحص __NEXT_DATA__
      const nextEl = document.querySelector("#__NEXT_DATA__");
      if (nextEl) {
        try {
          const data = JSON.parse(nextEl.textContent || "");
          info.nextData = { keys: Object.keys(data).slice(0, 10) };
        } catch(e) { info.nextData = { error: e.message }; }
      }
      
      // روابط حسابات
      document.querySelectorAll('a[href*="/@"]').forEach((a, i) => {
        if (i < 10) info.links.push(a.href);
      });
      
      // بطاقات المستخدمين
      const cardSelectors = [
        '[data-e2e="search-user-item"]',
        '[data-e2e="user-item"]',
        '.tiktok-x6y88p-DivItemContainerV2',
        '[class*="UserCard"]',
        '[class*="user-card"]',
        '[class*="UserItem"]',
      ];
      for (const sel of cardSelectors) {
        const cards = document.querySelectorAll(sel);
        if (cards.length > 0) {
          info.userCards = Array.from(cards).slice(0, 5).map(c => ({
            selector: sel,
            text: c.textContent?.trim()?.substring(0, 100),
          }));
          break;
        }
      }
      
      // H2, H3
      document.querySelectorAll("h2, h3").forEach((h, i) => {
        if (i < 5) {
          const tag = h.tagName.toLowerCase();
          if (tag === "h2") info.allH2.push(h.textContent?.trim()?.substring(0, 80));
          else info.allH3.push(h.textContent?.trim()?.substring(0, 80));
        }
      });
      
      return info;
    });
    
    console.log("Title:", result.title);
    console.log("Body length:", result.bodyLen);
    console.log("SIGI_STATE:", JSON.stringify(result.sigiState, null, 2));
    console.log("__NEXT_DATA__:", JSON.stringify(result.nextData, null, 2));
    console.log("Users found:", result.users?.length || 0, result.users?.slice(0, 3));
    console.log("Links:", result.links.length, result.links.slice(0, 3));
    console.log("User cards:", result.userCards.length, result.userCards[0]);
    console.log("H2s:", result.allH2);
    console.log("H3s:", result.allH3);
    
    // حفظ HTML للفحص
    const html = await page.content();
    fs.writeFileSync("/tmp/tiktok-page.html", html.substring(0, 50000));
    console.log("HTML saved to /tmp/tiktok-page.html (first 50KB)");
    
    return result;
  });
}

async function testInstagram() {
  console.log("\n" + "=".repeat(60));
  console.log("📸 Instagram Search Test");
  console.log("=".repeat(60));
  
  return withBrowser(async (browser) => {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await page.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1");
    
    // جرب صفحة بحث Instagram
    const url = "https://www.instagram.com/web/search/topsearch/?query=%D9%85%D8%B7%D8%B9%D9%85+%D8%A7%D9%84%D8%B1%D9%8A%D8%A7%D8%B6&context=blended&include_reel=true";
    console.log("URL:", url);
    
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
      await new Promise(r => setTimeout(r, 3000));
      
      const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
      console.log("Body text:", bodyText.substring(0, 500));
      
      // إذا كان JSON
      try {
        const json = JSON.parse(bodyText);
        console.log("JSON keys:", Object.keys(json).slice(0, 10));
        if (json.users) {
          console.log("Users:", json.users.slice(0, 3).map(u => ({ username: u.user?.username, name: u.user?.full_name })));
        }
      } catch {}
    } catch(e) {
      console.log("Error:", e.message);
    }
    
    // جرب صفحة hashtag
    console.log("\nTrying hashtag page...");
    const hashUrl = "https://www.instagram.com/explore/tags/%D9%85%D8%B7%D8%B9%D9%85/";
    try {
      await page.goto(hashUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
      await new Promise(r => setTimeout(r, 4000));
      
      const result = await page.evaluate(() => ({
        title: document.title,
        bodyLen: document.body.innerHTML.length,
        hasLogin: document.body.innerHTML.includes("Log in") || document.body.innerHTML.includes("تسجيل الدخول"),
        links: Array.from(document.querySelectorAll('a[href*="/p/"]')).slice(0, 5).map(a => a.href),
        sharedData: !!document.querySelector("#react-root"),
      }));
      
      console.log("Hashtag page:", result);
    } catch(e) {
      console.log("Hashtag error:", e.message);
    }
  });
}

async function testSnapchat() {
  console.log("\n" + "=".repeat(60));
  console.log("👻 Snapchat Search Test");
  console.log("=".repeat(60));
  
  return withBrowser(async (browser) => {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await page.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1");
    
    // جرب Snapchat Stories search
    const url = "https://story.snapchat.com/search?q=%D9%85%D8%B7%D8%B9%D9%85";
    console.log("URL:", url);
    
    try {
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      await new Promise(r => setTimeout(r, 5000));
      
      const result = await page.evaluate(() => ({
        title: document.title,
        bodyLen: document.body.innerHTML.length,
        links: Array.from(document.querySelectorAll('a[href*="/add/"]')).slice(0, 5).map(a => a.href),
        cards: document.querySelectorAll('[class*="Card"], [class*="card"], [class*="Story"]').length,
        h2s: Array.from(document.querySelectorAll("h2")).slice(0, 5).map(h => h.textContent?.trim()),
      }));
      
      console.log("Story search:", result);
    } catch(e) {
      console.log("Error:", e.message);
    }
    
    // جرب Snapchat public profiles
    console.log("\nTrying Snapchat profile directly...");
    try {
      await page.goto("https://www.snapchat.com/add/alriyadh", { waitUntil: "domcontentloaded", timeout: 15000 });
      await new Promise(r => setTimeout(r, 3000));
      
      const result = await page.evaluate(() => ({
        title: document.title,
        bodyLen: document.body.innerHTML.length,
        hasProfile: document.body.innerHTML.includes("subscriber") || document.body.innerHTML.includes("Snapchat"),
        text: document.body.innerText.substring(0, 300),
      }));
      
      console.log("Profile page:", result);
    } catch(e) {
      console.log("Profile error:", e.message);
    }
  });
}

async function testLinkedIn() {
  console.log("\n" + "=".repeat(60));
  console.log("💼 LinkedIn Search Test");
  console.log("=".repeat(60));
  
  return withBrowser(async (browser) => {
    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
    
    const url = "https://www.linkedin.com/search/results/companies/?keywords=%D9%85%D8%B7%D8%B9%D9%85%20%D8%A7%D9%84%D8%B1%D9%8A%D8%A7%D8%B6";
    console.log("URL:", url);
    
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
      await new Promise(r => setTimeout(r, 4000));
      
      const result = await page.evaluate(() => ({
        title: document.title,
        bodyLen: document.body.innerHTML.length,
        hasLogin: document.body.innerHTML.includes("Sign in") || document.body.innerHTML.includes("تسجيل الدخول"),
        cards: document.querySelectorAll('[class*="entity-result"], [class*="search-result"]').length,
        links: Array.from(document.querySelectorAll('a[href*="/company/"]')).slice(0, 5).map(a => a.href),
      }));
      
      console.log("LinkedIn search:", result);
    } catch(e) {
      console.log("Error:", e.message);
    }
  });
}

// Run all tests
console.log("🚀 Starting Browser API Tests with Bright Data Scraping Browser");
console.log("WS Endpoint:", WS?.substring(0, 50) + "...");

await testTikTok();
await testInstagram();
await testSnapchat();
await testLinkedIn();

console.log("\n✅ All tests complete!");
