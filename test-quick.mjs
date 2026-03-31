import puppeteer from "puppeteer-core";
import { config } from "dotenv";
config();

const BRIGHT_DATA_WS = process.env.BRIGHT_DATA_WS_ENDPOINT;

async function quickTest() {
  let browser;
  try {
    browser = await puppeteer.connect({ browserWSEndpoint: BRIGHT_DATA_WS });
    const page = await browser.newPage();
    
    // Test 1: Simple Google Search
    const url = `https://www.google.com/search?q=${encodeURIComponent("مطعم الرياض انستقرام")}&gl=sa&hl=ar&num=10`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    await new Promise(r => setTimeout(r, 1500));
    
    const r1 = await page.evaluate(() => {
      const h3s = document.querySelectorAll("h3");
      const items = [];
      h3s.forEach((h, i) => {
        if (i < 5) {
          const link = h.closest("a");
          items.push({ title: h.textContent?.trim(), href: link?.href });
        }
      });
      return { count: h3s.length, items };
    });
    
    console.log("Google Search (مطعم الرياض انستقرام):", r1.count, "h3s");
    r1.items.forEach(i => console.log(" -", i.title?.substring(0, 50), "|", i.href?.substring(0, 50)));
    
    // Test 2: Google Maps API via Places
    const mapsUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=مطعم+الرياض&key=test`;
    console.log("\nNote: Google Maps API needs valid key");
    
    // Test 3: Direct Google Maps scraping
    const mapsPageUrl = `https://www.google.com/maps/search/${encodeURIComponent("مطعم الرياض")}`;
    await page.goto(mapsPageUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));
    
    const r3 = await page.evaluate(() => {
      const items = [];
      // Try multiple selectors for Google Maps
      const cards = document.querySelectorAll(".Nv2PK, [data-result-index], .hfpxzc");
      cards.forEach((c, i) => {
        if (i < 5) {
          const name = c.querySelector(".qBF1Pd, .fontHeadlineSmall, [aria-label]");
          items.push(name?.textContent?.trim() || name?.getAttribute("aria-label") || c.textContent?.trim()?.substring(0, 50));
        }
      });
      return { cardCount: cards.length, items, bodyLen: document.body.innerHTML.length };
    });
    
    console.log("\nGoogle Maps:", r3.cardCount, "cards, body:", r3.bodyLen);
    r3.items.forEach(i => console.log(" -", i));
    
  } catch (e) {
    console.log("Error:", e.message);
  } finally {
    if (browser) await browser.close();
  }
}

await quickTest();
console.log("\nDone!");
