/**
 * اختبار Bright Data SERP API لجميع المنصات
 * يستخدم Direct API access (HTTP POST)
 */
import https from "https";

const API_TOKEN = "f47eea24-b27c-4319-88a9-71548a095747";

async function serpSearch(query, platform) {
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=ar&gl=sa&num=10`;
  
  const body = JSON.stringify({
    zone: "serp_api1",
    url: searchUrl,
    format: "raw"
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.brightdata.com",
      path: "/request",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_TOKEN}`,
        "Content-Length": Buffer.byteLength(body),
      },
      timeout: 30000,
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        console.log(`\n[${platform}] Status: ${res.statusCode}`);
        if (res.statusCode === 200) {
          // استخراج نتائج من HTML
          const links = [];
          const titleRegex = /<h3[^>]*>([^<]+)<\/h3>/g;
          const snippetRegex = /<div[^>]*class="[^"]*VwiC3b[^"]*"[^>]*>([^<]+)/g;
          const linkRegex = /href="(https?:\/\/(?:www\.)?(?:tiktok|snapchat|instagram)\.com[^"]+)"/g;
          
          let m;
          while ((m = linkRegex.exec(data)) !== null) {
            const url = m[1];
            if (!url.includes("?") || url.includes("@") || url.includes("/user/")) {
              links.push(url);
            }
          }
          
          const titles = [];
          while ((m = titleRegex.exec(data)) !== null) {
            titles.push(m[1].replace(/&#\d+;/g, "").trim());
          }
          
          console.log(`[${platform}] Links found: ${links.slice(0, 5).join("\n  ")}`);
          console.log(`[${platform}] Titles found: ${titles.slice(0, 5).join(" | ")}`);
          console.log(`[${platform}] HTML size: ${data.length} bytes`);
          resolve({ links, titles, htmlSize: data.length });
        } else {
          console.log(`[${platform}] Error body: ${data.slice(0, 200)}`);
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 100)}`));
        }
      });
    });

    req.on("error", reject);
    req.on("timeout", () => reject(new Error("Timeout")));
    req.write(body);
    req.end();
  });
}

async function main() {
  const keyword = "مطعم";
  const city = "الرياض";
  
  const platforms = [
    { name: "TikTok", query: `site:tiktok.com ${keyword} ${city}` },
    { name: "Snapchat", query: `site:snapchat.com/add ${keyword} ${city}` },
    { name: "Instagram", query: `site:instagram.com ${keyword} ${city}` },
  ];

  for (const p of platforms) {
    try {
      await serpSearch(p.query, p.name);
      await new Promise(r => setTimeout(r, 2000)); // تأخير بين الطلبات
    } catch (err) {
      console.error(`[${p.name}] Failed:`, err.message);
    }
  }
  
  console.log("\n✅ Test completed!");
}

main().catch(console.error);
