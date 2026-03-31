const token = process.env.BRIGHT_DATA_API_TOKEN || "";
if (!token) { console.error("Token missing!"); process.exit(1); }

// اختبار TikTok Profiles بالمدخل الصحيح
console.log("=== Testing TikTok Profiles with correct input ===");
const tiktokTests = [
  [{ url: "https://www.tiktok.com/@albaik_sa" }],
  [{ profile_url: "https://www.tiktok.com/@albaik_sa" }],
  [{ username: "albaik_sa" }],
];

for (const input of tiktokTests) {
  const res = await fetch("https://api.brightdata.com/datasets/v3/trigger?dataset_id=gd_l1vikfnt1wgvvqz95w&format=json", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const text = await res.text();
  console.log(`Input: ${JSON.stringify(input[0])} → Status: ${res.status} → ${text.substring(0, 200)}`);
}

// اختبار Twitter/X Posts
console.log("\n=== Testing Twitter/X Posts with correct input ===");
const twitterTests = [
  [{ url: "https://twitter.com/albaik_sa" }],
  [{ url: "https://x.com/albaik_sa" }],
  [{ profile_url: "https://x.com/albaik_sa" }],
  [{ username: "albaik_sa" }],
];

for (const input of twitterTests) {
  const res = await fetch("https://api.brightdata.com/datasets/v3/trigger?dataset_id=gd_lwxkxvnf1cynvib9co&format=json", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const text = await res.text();
  console.log(`Input: ${JSON.stringify(input[0])} → Status: ${res.status} → ${text.substring(0, 200)}`);
}
