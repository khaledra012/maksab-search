import { readFileSync } from "fs";

const token = process.env.BRIGHT_DATA_API_TOKEN || "";
if (!token) { console.error("BRIGHT_DATA_API_TOKEN not found!"); process.exit(1); }
console.log("Token:", token.substring(0, 15) + "...\n");

// جرب endpoints مختلفة
const endpoints = [
  "https://api.brightdata.com/datasets/v3/datasets",
  "https://api.brightdata.com/dca/datasets",
  "https://api.brightdata.com/datasets",
];

for (const url of endpoints) {
  console.log(`\nTrying: ${url}`);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log("Status:", res.status);
  if (res.status === 200) {
    const text = await res.text();
    console.log("Response (first 1000 chars):", text.substring(0, 1000));
    break;
  }
}

// اختبار Dataset IDs المعروفة مباشرة
console.log("\n=== Testing Known Dataset IDs ===");
const knownIds = {
  "TikTok Profiles":    "gd_l1vikfnt1wgvvqz95w",
  "TikTok Posts":       "gd_lu702nij2f790tmv24",
  "Snapchat Posts":     "gd_lkf0u1882c7ywfz3y",
  "Twitter/X Posts":    "gd_lwxkxvnf1cynvib9co",
  "Facebook Pages":     "gd_lyclm2p67xgu9o5v0",
  "Instagram Profiles": "gd_l1vikfch901nx3by4",
};

for (const [name, id] of Object.entries(knownIds)) {
  const res = await fetch(`https://api.brightdata.com/datasets/v3/trigger?dataset_id=${id}&format=json&uncompressed_webhook=true`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([{ url: "https://www.tiktok.com/@test" }]),
  });
  const text = await res.text();
  const status = res.status;
  let result = "";
  if (status === 200 || status === 201) result = "✅ ACTIVE";
  else if (status === 400) result = "⚠️ Bad Request (ID exists but input wrong)";
  else if (status === 403) result = "❌ Forbidden (not subscribed)";
  else if (status === 404) result = "❌ Not Found";
  else result = `? Status ${status}`;
  
  console.log(`${name} (${id}): ${result}`);
  if (status !== 200 && status !== 201) {
    console.log(`  Response: ${text.substring(0, 150)}`);
  }
}
