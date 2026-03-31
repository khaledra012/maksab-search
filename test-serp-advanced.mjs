import https from 'https';

const token = process.env.BRIGHT_DATA_API_TOKEN;
const zone = process.env.BRIGHT_DATA_SERP_ZONE || 'serp_api1';

const blacklist = new Set([
  "explore", "p", "reel", "reels", "stories", "accounts", "hashtag", "tv",
  "search", "login", "signup", "about", "help", "legal", "privacy", "terms",
  "intent", "share", "home", "notifications", "messages", "add", "web",
  "discover", "trending", "live", "map", "maps", "places", "directory",
  "business", "ads", "developers", "pages", "groups", "events", "marketplace",
  "watch", "gaming", "fundraisers", "jobs", "news", "photos", "videos",
  "friends", "memories", "saved", "settings", "profile", "people",
  "_n", "_u", "tagged", "highlights", "igtv", "popular"
]);

async function serpRequest(query) {
  const targetUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=20&hl=ar&gl=sa`;
  
  const body = JSON.stringify({
    zone: zone,
    url: targetUrl,
    format: 'raw'
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.brightdata.com',
      port: 443,
      path: '/request',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const responseBody = Buffer.concat(chunks).toString('utf-8');
        if (res.statusCode !== 200) {
          reject(new Error(`Status ${res.statusCode}: ${responseBody.slice(0, 200)}`));
          return;
        }
        resolve(responseBody);
      });
    });
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function parseInstagram(html) {
  const results = [];
  const seen = new Set();
  const regex = /instagram\.com\/([a-zA-Z0-9._]{3,30})(?:\/|\?|\\|"|\s|&|>|<|\n|\r|$)/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const username = match[1];
    if (!username || username.length < 3) continue;
    if (blacklist.has(username.toLowerCase())) continue;
    if (seen.has(username)) continue;
    if (/^\d+$/.test(username)) continue;
    seen.add(username);
    results.push({ username, url: `https://www.instagram.com/${username}/` });
  }
  return results;
}

function parseTikTok(html) {
  const results = [];
  const seen = new Set();
  const regex = /tiktok\.com\/@([a-zA-Z0-9._]{3,30})(?:\/|\?|\\|"|\s|&|>|<|\n|\r|$)/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const username = match[1];
    if (!username || username.length < 3) continue;
    if (blacklist.has(username.toLowerCase())) continue;
    if (seen.has(username)) continue;
    seen.add(username);
    results.push({ username, url: `https://www.tiktok.com/@${username}` });
  }
  return results;
}

async function test() {
  console.log('=== Testing SERP API ===\n');
  
  // Test 1: Instagram
  console.log('--- Test 1: Instagram مطعم رياض ---');
  try {
    const html = await serpRequest('site:instagram.com مطعم الرياض السعودية');
    const results = parseInstagram(html);
    console.log(`Found ${results.length} Instagram accounts`);
    results.slice(0, 5).forEach(r => console.log('  -', r.username, r.url));
  } catch (e) {
    console.error('FAILED:', e.message);
  }
  
  await new Promise(r => setTimeout(r, 1000));
  
  // Test 2: TikTok
  console.log('\n--- Test 2: TikTok مطعم رياض ---');
  try {
    const html = await serpRequest('site:tiktok.com مطعم الرياض السعودية');
    const results = parseTikTok(html);
    console.log(`Found ${results.length} TikTok accounts`);
    results.slice(0, 5).forEach(r => console.log('  -', r.username, r.url));
  } catch (e) {
    console.error('FAILED:', e.message);
  }
  
  await new Promise(r => setTimeout(r, 1000));
  
  // Test 3: Instagram English
  console.log('\n--- Test 3: Instagram restaurant riyadh ---');
  try {
    const html = await serpRequest('site:instagram.com restaurant riyadh Saudi Arabia');
    const results = parseInstagram(html);
    console.log(`Found ${results.length} Instagram accounts`);
    results.slice(0, 5).forEach(r => console.log('  -', r.username, r.url));
  } catch (e) {
    console.error('FAILED:', e.message);
  }
  
  await new Promise(r => setTimeout(r, 1000));
  
  // Test 4: TikTok English
  console.log('\n--- Test 4: TikTok restaurant riyadh ---');
  try {
    const html = await serpRequest('site:tiktok.com restaurant riyadh Saudi Arabia');
    const results = parseTikTok(html);
    console.log(`Found ${results.length} TikTok accounts`);
    results.slice(0, 5).forEach(r => console.log('  -', r.username, r.url));
  } catch (e) {
    console.error('FAILED:', e.message);
  }
  
  await new Promise(r => setTimeout(r, 1000));
  
  // Test 5: Snapchat
  console.log('\n--- Test 5: Snapchat مطعم ---');
  try {
    const html = await serpRequest('snapchat.com/add مطعم الرياض السعودية');
    const matches = (html.match(/snapchat\.com\/add\/([a-zA-Z0-9._-]{3,30})/g) || []);
    const unique = [...new Set(matches)];
    console.log(`Found ${unique.length} Snapchat accounts`);
    unique.slice(0, 5).forEach(m => console.log('  -', m));
  } catch (e) {
    console.error('FAILED:', e.message);
  }
}

test().catch(console.error);
