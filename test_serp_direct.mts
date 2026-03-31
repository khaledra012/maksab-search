import { searchInstagramSERP, searchTikTokSERP } from "./server/routers/serpSearch.js";

console.log("Testing Instagram SERP...");
try {
  const results = await searchInstagramSERP("مطعم", "الرياض");
  console.log("Instagram Results:", JSON.stringify(results.slice(0, 3), null, 2));
  console.log("Total:", results.length);
} catch (e: any) {
  console.error("Instagram Error:", e.message);
}

console.log("\nTesting TikTok SERP...");
try {
  const results = await searchTikTokSERP("مطعم", "الرياض");
  console.log("TikTok Results:", JSON.stringify(results.slice(0, 3), null, 2));
  console.log("Total:", results.length);
} catch (e: any) {
  console.error("TikTok Error:", e.message);
}
