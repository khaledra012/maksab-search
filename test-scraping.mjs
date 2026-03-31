import puppeteer from "puppeteer-core";
import { config } from "dotenv";
config();

const CHROMIUM_PATH = "/usr/bin/chromium-browser";
const BRIGHT_DATA_WS = process.env.BRIGHT_DATA_WS_ENDPOINT;

async function testWithChromium(platform, url, extractFn) {
  console.log(`\n=== Testing ${platform} with local Chromium ===`);
  console.log("URL:", url);
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: CHROMIUM_PATH,
      headless: true,
      args: [
        "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage",
        "--disable-gpu", "--disable-blink-features=AutomationControlled"
      ],
    });
    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1");
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await new Promise(r => setTimeout(r, 3000));
    const title = await page.title();
    console.log("Title:", title);
    const result = await page.evaluate(extractFn);
    console.log("Result:", JSON.stringify(result, null, 2).substring(0, 500));
    return result;
  } catch (e) {
    console.log("Error:", e.message);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

async function testWithBrightData(platform, url, extractFn) {
  console.log(`\n=== Testing ${platform} with Bright Data ===`);
  console.log("URL:", url);
  let browser;
  try {
    browser = await puppeteer.connect({ browserWSEndpoint: BRIGHT_DATA_WS });
    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1");
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
    await new Promise(r => setTimeout(r, 3000));
    const title = await page.title();
    console.log("Title:", title);
    const result = await page.evaluate(extractFn);
    console.log("Result:", JSON.stringify(result, null, 2).substring(0, 500));
    return result;
  } catch (e) {
    console.log("Error:", e.message);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

// ─── TikTok Search ───────────────────────────────────────────────────────────
const tiktokExtract = () => {
  const result = { sigiState: false, nextData: false, links: [], bodyLength: 0 };
  result.bodyLength = document.body.innerHTML.length;
  
  const sigiEl = document.querySelector("#SIGI_STATE");
  const nextEl = document.querySelector("#__NEXT_DATA__");
  result.sigiState = !!sigiEl;
  result.nextData = !!nextEl;
  
  if (sigiEl) {
    try {
      const data = JSON.parse(sigiEl.textContent || "");
      result.sigiKeys = Object.keys(data).slice(0, 8);
    } catch(e) { result.sigiError = e.message; }
  }
  
  document.querySelectorAll('a[href*="/@"]').forEach((a, i) => {
    if (i < 5) result.links.push(a.href);
  });
  
  return result;
};

// ─── Snapchat Search ─────────────────────────────────────────────────────────
const snapchatExtract = () => {
  const result = { title: document.title, links: [], bodyLength: 0, hasResults: false };
  result.bodyLength = document.body.innerHTML.length;
  
  // Check for user cards
  const cards = document.querySelectorAll('[class*="user"], [class*="User"], [class*="profile"], [class*="Profile"]');
  result.hasResults = cards.length > 0;
  result.cardCount = cards.length;
  
  document.querySelectorAll('a[href*="/add/"], a[href*="snapchat.com/add"]').forEach((a, i) => {
    if (i < 5) result.links.push(a.href);
  });
  
  return result;
};

// ─── Instagram ───────────────────────────────────────────────────────────────
const instagramExtract = () => {
  const result = { title: document.title, links: [], bodyLength: 0, hasLogin: false };
  result.bodyLength = document.body.innerHTML.length;
  result.hasLogin = document.body.innerHTML.includes("Log in") || document.body.innerHTML.includes("تسجيل الدخول");
  
  document.querySelectorAll('a[href*="/p/"], article a').forEach((a, i) => {
    if (i < 5) result.links.push(a.href);
  });
  
  return result;
};

// ─── Run Tests ───────────────────────────────────────────────────────────────
async function main() {
  const keyword = "مطعم";
  const city = "الرياض";
  
  // Test TikTok
  await testWithChromium(
    "TikTok",
    `https://www.tiktok.com/search/user?q=${encodeURIComponent(keyword + " " + city)}`,
    tiktokExtract
  );
  
  // Test Snapchat
  await testWithChromium(
    "Snapchat",
    `https://www.snapchat.com/search?q=${encodeURIComponent(keyword)}`,
    snapchatExtract
  );
  
  // Test Instagram with Bright Data
  await testWithBrightData(
    "Instagram",
    `https://www.instagram.com/explore/tags/${encodeURIComponent(keyword.replace(/\s+/g, ""))}/`,
    instagramExtract
  );
  
  console.log("\n=== Tests Complete ===");
}

main().catch(e => console.error("Fatal:", e.message));
