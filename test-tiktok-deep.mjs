import puppeteer from "puppeteer-core";
import { config } from "dotenv";
config();

const CHROMIUM_PATH = "/usr/bin/chromium-browser";
const BRIGHT_DATA_WS = process.env.BRIGHT_DATA_WS_ENDPOINT;

async function testTikTokDeep() {
  console.log("=== Testing TikTok with Bright Data (deep) ===");
  let browser;
  try {
    browser = await puppeteer.connect({ browserWSEndpoint: BRIGHT_DATA_WS });
    const page = await browser.newPage();
    
    await page.setUserAgent("Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36");
    
    // Set viewport
    await page.setViewport({ width: 390, height: 844, isMobile: true });
    
    const query = "مطعم الرياض";
    const url = `https://www.tiktok.com/search/user?q=${encodeURIComponent(query)}`;
    console.log("URL:", url);
    
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    await new Promise(r => setTimeout(r, 5000));
    
    const title = await page.title();
    console.log("Title:", title);
    
    // Check page content
    const analysis = await page.evaluate(() => {
      const result = {
        bodyLength: document.body.innerHTML.length,
        sigiState: !!document.querySelector("#SIGI_STATE"),
        nextData: !!document.querySelector("#__NEXT_DATA__"),
        links: [],
        scripts: [],
        hasUsers: false,
      };
      
      // Check SIGI_STATE content
      const sigiEl = document.querySelector("#SIGI_STATE");
      if (sigiEl) {
        try {
          const data = JSON.parse(sigiEl.textContent || "");
          result.sigiKeys = Object.keys(data).slice(0, 10);
          // Try to find user data
          const userList = data?.SearchUserList?.userInfoList || 
                          data?.props?.pageProps?.searchData?.user_list || [];
          result.userCount = userList.length;
          if (userList.length > 0) {
            result.firstUser = userList[0]?.userInfo?.user?.uniqueId || userList[0]?.user?.uniqueId;
          }
        } catch(e) { result.sigiError = e.message; }
      }
      
      // Check __NEXT_DATA__
      const nextEl = document.querySelector("#__NEXT_DATA__");
      if (nextEl) {
        try {
          const data = JSON.parse(nextEl.textContent || "");
          result.nextKeys = Object.keys(data).slice(0, 10);
        } catch(e) { result.nextError = e.message; }
      }
      
      // Look for user links
      document.querySelectorAll('a[href*="/@"]').forEach((a, i) => {
        if (i < 10) result.links.push(a.href);
      });
      
      // Check for user containers
      const userContainers = document.querySelectorAll('[data-e2e*="user"], [class*="UserCard"], [class*="user-card"]');
      result.hasUsers = userContainers.length > 0;
      result.userContainerCount = userContainers.length;
      
      return result;
    });
    
    console.log("Analysis:", JSON.stringify(analysis, null, 2));
    
  } catch (e) {
    console.log("Error:", e.message);
  } finally {
    if (browser) await browser.close();
  }
}

async function testTikTokAPI() {
  console.log("\n=== Testing TikTok via Google Search (alternative) ===");
  let browser;
  try {
    browser = await puppeteer.connect({ browserWSEndpoint: BRIGHT_DATA_WS });
    const page = await browser.newPage();
    
    // بحث في Google عن حسابات TikTok
    const query = 'site:tiktok.com "مطعم" "الرياض"';
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&gl=sa&hl=ar&num=10`;
    console.log("URL:", url);
    
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await new Promise(r => setTimeout(r, 2000));
    
    const results = await page.evaluate(() => {
      const items = [];
      document.querySelectorAll("div.g, .MjjYud").forEach((div, i) => {
        if (i >= 10) return;
        const titleEl = div.querySelector("h3");
        const linkEl = div.querySelector("a");
        const snippetEl = div.querySelector(".VwiC3b, .st");
        if (titleEl && linkEl) {
          const href = linkEl.getAttribute("href") || "";
          if (href.includes("tiktok.com")) {
            items.push({
              title: titleEl.textContent?.trim(),
              url: href,
              snippet: snippetEl?.textContent?.trim()?.substring(0, 200),
            });
          }
        }
      });
      return items;
    });
    
    console.log("TikTok via Google:", results.length, "results");
    results.slice(0, 3).forEach(r => console.log(" -", r.title, r.url));
    
  } catch (e) {
    console.log("Error:", e.message);
  } finally {
    if (browser) await browser.close();
  }
}

async function testSnapchatAlternative() {
  console.log("\n=== Testing Snapchat via Google Search ===");
  let browser;
  try {
    browser = await puppeteer.connect({ browserWSEndpoint: BRIGHT_DATA_WS });
    const page = await browser.newPage();
    
    const query = 'site:snapchat.com/add "مطعم" OR "مطاعم" الرياض';
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&gl=sa&hl=ar&num=10`;
    console.log("URL:", url);
    
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await new Promise(r => setTimeout(r, 2000));
    
    const results = await page.evaluate(() => {
      const items = [];
      document.querySelectorAll("div.g, .MjjYud").forEach((div, i) => {
        if (i >= 10) return;
        const titleEl = div.querySelector("h3");
        const linkEl = div.querySelector("a");
        const snippetEl = div.querySelector(".VwiC3b, .st");
        if (titleEl && linkEl) {
          const href = linkEl.getAttribute("href") || "";
          if (href.includes("snapchat.com")) {
            items.push({
              title: titleEl.textContent?.trim(),
              url: href,
              snippet: snippetEl?.textContent?.trim()?.substring(0, 200),
            });
          }
        }
      });
      return items;
    });
    
    console.log("Snapchat via Google:", results.length, "results");
    results.slice(0, 3).forEach(r => console.log(" -", r.title, r.url));
    
  } catch (e) {
    console.log("Error:", e.message);
  } finally {
    if (browser) await browser.close();
  }
}

async function testInstagramAlternative() {
  console.log("\n=== Testing Instagram via Google Search ===");
  let browser;
  try {
    browser = await puppeteer.connect({ browserWSEndpoint: BRIGHT_DATA_WS });
    const page = await browser.newPage();
    
    const query = 'site:instagram.com "مطعم" "الرياض" -p -reel';
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&gl=sa&hl=ar&num=10`;
    console.log("URL:", url);
    
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await new Promise(r => setTimeout(r, 2000));
    
    const results = await page.evaluate(() => {
      const items = [];
      document.querySelectorAll("div.g, .MjjYud").forEach((div, i) => {
        if (i >= 10) return;
        const titleEl = div.querySelector("h3");
        const linkEl = div.querySelector("a");
        const snippetEl = div.querySelector(".VwiC3b, .st");
        if (titleEl && linkEl) {
          const href = linkEl.getAttribute("href") || "";
          if (href.includes("instagram.com")) {
            items.push({
              title: titleEl.textContent?.trim(),
              url: href,
              snippet: snippetEl?.textContent?.trim()?.substring(0, 200),
            });
          }
        }
      });
      return items;
    });
    
    console.log("Instagram via Google:", results.length, "results");
    results.slice(0, 3).forEach(r => console.log(" -", r.title, r.url));
    
  } catch (e) {
    console.log("Error:", e.message);
  } finally {
    if (browser) await browser.close();
  }
}

// Run all tests
await testTikTokDeep();
await testTikTokAPI();
await testSnapchatAlternative();
await testInstagramAlternative();
console.log("\n=== All Tests Complete ===");
