import puppeteer from "puppeteer-core";
import { config } from "dotenv";
config();

const BRIGHT_DATA_WS = process.env.BRIGHT_DATA_WS_ENDPOINT;

async function searchViaGoogle(platform, siteQuery, keyword, city) {
  console.log(`\n=== ${platform} via Google ===`);
  let browser;
  try {
    browser = await puppeteer.connect({ browserWSEndpoint: BRIGHT_DATA_WS });
    const page = await browser.newPage();
    
    const fullQuery = `${siteQuery} "${keyword}" "${city}"`;
    const url = `https://www.google.com/search?q=${encodeURIComponent(fullQuery)}&gl=sa&hl=ar&num=10`;
    console.log("Query:", fullQuery);
    
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await new Promise(r => setTimeout(r, 2000));
    
    const results = await page.evaluate((platformDomain) => {
      const items = [];
      // Try multiple selectors for Google results
      const selectors = ["div.g", ".MjjYud", ".tF2Cxc", "[data-hveid]"];
      let found = false;
      
      for (const sel of selectors) {
        const divs = document.querySelectorAll(sel);
        if (divs.length > 0) {
          divs.forEach((div, i) => {
            if (i >= 10) return;
            const titleEl = div.querySelector("h3");
            const linkEl = div.querySelector("a");
            const snippetEl = div.querySelector(".VwiC3b, .st, [data-sncf]");
            if (titleEl && linkEl) {
              const href = linkEl.getAttribute("href") || "";
              if (!platformDomain || href.includes(platformDomain)) {
                items.push({
                  title: titleEl.textContent?.trim(),
                  url: href,
                  snippet: snippetEl?.textContent?.trim()?.substring(0, 200),
                });
              }
            }
          });
          if (items.length > 0) { found = true; break; }
        }
      }
      
      // If no results found with platform filter, return all results
      if (!found) {
        document.querySelectorAll("h3").forEach((h3, i) => {
          if (i >= 5) return;
          const link = h3.closest("a") || h3.parentElement?.querySelector("a");
          items.push({
            title: h3.textContent?.trim(),
            url: link?.getAttribute("href") || "",
            snippet: "",
          });
        });
      }
      
      return { items, totalH3: document.querySelectorAll("h3").length };
    }, platform === "All" ? null : platform.toLowerCase());
    
    console.log(`Results: ${results.items.length} (total h3: ${results.totalH3})`);
    results.items.slice(0, 3).forEach(r => console.log(` - ${r.title?.substring(0, 60)} | ${r.url?.substring(0, 60)}`));
    
    return results.items;
  } catch (e) {
    console.log("Error:", e.message);
    return [];
  } finally {
    if (browser) await browser.close();
  }
}

const keyword = "مطعم";
const city = "الرياض";

// Test Google Search for each platform
const tiktokResults = await searchViaGoogle("tiktok.com", "site:tiktok.com", keyword, city);
const snapchatResults = await searchViaGoogle("snapchat.com", "site:snapchat.com/add", keyword, city);
const instagramResults = await searchViaGoogle("instagram.com", "site:instagram.com", keyword, city);
const linkedinResults = await searchViaGoogle("linkedin.com", "site:linkedin.com/company", keyword, city);

console.log("\n=== Summary ===");
console.log("TikTok:", tiktokResults.length, "results");
console.log("Snapchat:", snapchatResults.length, "results");
console.log("Instagram:", instagramResults.length, "results");
console.log("LinkedIn:", linkedinResults.length, "results");
