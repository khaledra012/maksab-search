import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.BRIGHT_DATA_API_TOKEN;
const DATASET_ID = "gd_l1villgoiiidt09ci";

async function testTikTok() {
  console.log("API Key:", API_KEY ? API_KEY.substring(0, 20) + "..." : "NOT SET");
  
  // Step 1: Trigger
  console.log("\n--- Triggering TikTok Dataset ---");
  const triggerRes = await fetch(
    `https://api.brightdata.com/datasets/v3/trigger?dataset_id=${DATASET_ID}&format=json&uncompressed_webhook=true`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([{ url: "https://www.tiktok.com/@starbucks" }])
    }
  );
  
  const triggerText = await triggerRes.text();
  console.log("Trigger Status:", triggerRes.status);
  console.log("Trigger Response:", triggerText.substring(0, 500));
  
  if (!triggerRes.ok) {
    console.log("FAILED - Dataset might not exist or wrong ID");
    
    // Try listing datasets
    console.log("\n--- Listing Available Datasets ---");
    const listRes = await fetch("https://api.brightdata.com/datasets/v3/list", {
      headers: { "Authorization": `Bearer ${API_KEY}` }
    });
    const listText = await listRes.text();
    console.log("List Status:", listRes.status);
    // Search for tiktok
    const datasets = JSON.parse(listText);
    const tiktokDatasets = datasets.filter(d => 
      d.id?.toLowerCase().includes('tiktok') || 
      d.name?.toLowerCase().includes('tiktok') ||
      d.description?.toLowerCase().includes('tiktok')
    );
    console.log("TikTok Datasets found:", JSON.stringify(tiktokDatasets, null, 2));
    return;
  }
  
  const triggerData = JSON.parse(triggerText);
  const snapshotId = triggerData.snapshot_id;
  console.log("Snapshot ID:", snapshotId);
  
  // Step 2: Poll once
  console.log("\n--- Polling Snapshot (waiting 10s) ---");
  await new Promise(r => setTimeout(r, 10000));
  
  const pollRes = await fetch(
    `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}?format=json`,
    { headers: { "Authorization": `Bearer ${API_KEY}` } }
  );
  const pollText = await pollRes.text();
  console.log("Poll Status:", pollRes.status);
  console.log("Poll Response (first 500 chars):", pollText.substring(0, 500));
}

testTikTok().catch(console.error);
