import { config } from 'dotenv';
config();

const apiToken = process.env.BRIGHT_DATA_API_TOKEN;
const BASE = 'https://api.brightdata.com';

async function testDataset(datasetId, name, inputs) {
  console.log(`\n=== Testing ${name} (${datasetId}) ===`);
  try {
    const res = await fetch(`${BASE}/datasets/v3/trigger?dataset_id=${datasetId}&format=json`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(inputs),
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    console.log(`Status: ${res.status} - ${text.substring(0, 300)}`);
  } catch (e) {
    console.error(`Error: ${e.message}`);
  }
}

// Test current IDs
await testDataset('gd_lkf0u1882c7ywfz3y', 'Snapchat (current)', [{ url: 'https://www.snapchat.com/add/test123', num_of_posts: '5' }]);
await testDataset('gd_ltppn6ug2l8oo3fj4', 'Facebook Page Posts (current)', [{ url: 'https://www.facebook.com/test', num_of_posts: '5' }]);
await testDataset('gd_mf0urb782734ik94dz', 'Facebook Profiles (verified)', [{ url: 'https://www.facebook.com/test' }]);
await testDataset('gd_lkaxegm826bjpoo9m5', 'Facebook Page Posts (verified)', [{ url: 'https://www.facebook.com/test', num_of_posts: '5' }]);

// List available datasets
console.log('\n=== Listing available datasets ===');
const listRes = await fetch(`${BASE}/datasets/v3?format=json`, {
  headers: { 'Authorization': `Bearer ${apiToken}` },
  signal: AbortSignal.timeout(15000),
});
const listText = await listRes.text();
console.log('Status:', listRes.status);
// Parse and show dataset names
try {
  const datasets = JSON.parse(listText);
  if (Array.isArray(datasets)) {
    console.log('Total datasets:', datasets.length);
    datasets.slice(0, 20).forEach(d => console.log(`  - ${d.id}: ${d.name || d.title || 'N/A'}`));
  } else {
    console.log('Response:', listText.substring(0, 500));
  }
} catch {
  console.log('Response:', listText.substring(0, 500));
}
