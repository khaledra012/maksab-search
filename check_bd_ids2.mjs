const token = process.env.BRIGHT_DATA_API_TOKEN || "";
if (!token) { console.error("Token missing!"); process.exit(1); }

// Dataset IDs المكتشفة من URLs في Bright Data docs
const datasets = {
  "TikTok Profiles":    "gd_l1villgoiiidt09ci",  // من URL في docs
  "TikTok Posts":       "gd_lu702nij2f790tmv24",  // قديم - لم يعمل
  "Twitter/X Posts":    "gd_lwxkxvnf1cynvib9co",  // قديم - يحتاج URL صحيح
  "Instagram Profiles": "gd_l1vikfch901nx3by4",   // يعمل
  "LinkedIn Profiles":  "gd_l1vikfnt1wgvvqz95w",  // هذا LinkedIn وليس TikTok!
};

console.log("=== Testing TikTok Profile ID gd_l1villgoiiidt09ci ===");
const res = await fetch("https://api.brightdata.com/datasets/v3/trigger?dataset_id=gd_l1villgoiiidt09ci&format=json", {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify([{ url: "https://www.tiktok.com/@albaik_sa" }]),
});
const text = await res.text();
console.log(`Status: ${res.status}`);
console.log(`Response: ${text.substring(0, 300)}`);

// اختبار Twitter بـ URL الصحيح
console.log("\n=== Testing Twitter/X Posts with www.x.com URL ===");
const twitterUrls = [
  "https://www.x.com/albaik_sa",
  "https://x.com/albaik_sa/status/",
];
for (const url of twitterUrls) {
  const r = await fetch("https://api.brightdata.com/datasets/v3/trigger?dataset_id=gd_lwxkxvnf1cynvib9co&format=json", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify([{ url }]),
  });
  const t = await r.text();
  console.log(`URL: ${url} → ${r.status}: ${t.substring(0, 200)}`);
}

// اختبار LinkedIn الصحيح
console.log("\n=== Testing LinkedIn Profile ID gd_l1vikfnt1wgvvqz95w ===");
const liRes = await fetch("https://api.brightdata.com/datasets/v3/trigger?dataset_id=gd_l1vikfnt1wgvvqz95w&format=json", {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify([{ url: "https://www.linkedin.com/company/albaik" }]),
});
const liText = await liRes.text();
console.log(`Status: ${liRes.status}: ${liText.substring(0, 300)}`);
