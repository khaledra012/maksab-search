const GOOGLE_API_KEY = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
const GOOGLE_CSE_ID = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID;

console.log('Google API Key:', GOOGLE_API_KEY ? 'SET (' + GOOGLE_API_KEY.substring(0, 10) + '...)' : 'NOT SET');
console.log('Google CSE ID:', GOOGLE_CSE_ID ? 'SET (' + GOOGLE_CSE_ID + ')' : 'NOT SET');

async function searchGoogle(query) {
  const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CSE_ID}&q=${encodeURIComponent(query)}&num=10&lr=lang_ar&gl=sa`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.items || [];
}

async function main() {
  if (!GOOGLE_API_KEY || !GOOGLE_CSE_ID) {
    console.log('❌ Google API not configured');
    return;
  }

  const platforms = [
    { name: 'Snapchat', query: 'مطعم الرياض site:snapchat.com' },
    { name: 'TikTok', query: 'مطعم الرياض site:tiktok.com' },
    { name: 'Instagram', query: 'مطعم الرياض site:instagram.com' },
    { name: 'LinkedIn', query: 'مطعم الرياض site:linkedin.com' },
  ];

  for (const p of platforms) {
    try {
      const items = await searchGoogle(p.query);
      console.log(`\n✅ ${p.name}: ${items.length} results`);
      items.slice(0, 3).forEach(item => {
        console.log(`  - ${item.title.substring(0, 60)}`);
        console.log(`    ${item.link}`);
      });
    } catch (e) {
      console.log(`\n❌ ${p.name}: ${e.message}`);
    }
  }
}

main().catch(console.error);
