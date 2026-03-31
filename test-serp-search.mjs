import puppeteer from 'puppeteer-core';

const WS_ENDPOINT = process.env.BRIGHT_DATA_WS_ENDPOINT;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function searchGoogleSERP(query, platform) {
  console.log(`\n🔍 Searching ${platform}: "${query}"`);
  
  const browser = await puppeteer.connect({ browserWSEndpoint: WS_ENDPOINT });
  const page = await browser.newPage();
  
  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'ar-SA,ar;q=0.9,en-US;q=0.8' });
    
    const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=20&hl=ar&gl=sa`;
    await page.goto(googleUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2000);
    
    // استخراج نتائج البحث
    const results = await page.evaluate(() => {
      const items = [];
      // Google search results selectors
      const resultDivs = document.querySelectorAll('div.g, div[data-sokoban-container], div.tF2Cxc, div.yuRUbf');
      
      resultDivs.forEach(div => {
        const linkEl = div.querySelector('a[href]');
        const titleEl = div.querySelector('h3');
        const snippetEl = div.querySelector('.VwiC3b, .yXK7lf, span.aCOpRe, div.IsZvec');
        
        if (linkEl && titleEl) {
          const href = linkEl.getAttribute('href');
          if (href && href.startsWith('http') && !href.includes('google.com')) {
            items.push({
              title: titleEl.innerText || '',
              link: href,
              snippet: snippetEl ? snippetEl.innerText : '',
            });
          }
        }
      });
      
      // fallback: جميع الروابط الخارجية
      if (items.length === 0) {
        const allLinks = document.querySelectorAll('a[href]');
        allLinks.forEach(a => {
          const href = a.getAttribute('href');
          if (href && href.startsWith('http') && !href.includes('google.com') && !href.includes('youtube.com')) {
            const title = a.innerText || a.textContent || '';
            if (title.length > 5) {
              items.push({ title: title.substring(0, 100), link: href, snippet: '' });
            }
          }
        });
      }
      
      return items.slice(0, 15);
    });
    
    console.log(`✅ Found ${results.length} results`);
    results.forEach(r => {
      console.log(`  - ${r.title.substring(0, 60)}`);
      console.log(`    ${r.link.substring(0, 80)}`);
    });
    
    return results;
  } finally {
    await page.close();
    await browser.close();
  }
}

async function main() {
  if (!WS_ENDPOINT) {
    console.error('❌ BRIGHT_DATA_WS_ENDPOINT not set');
    process.exit(1);
  }
  
  console.log('✅ Bright Data WS Endpoint configured');
  
  // اختبار سناب شات
  await searchGoogleSERP('مطعم الرياض site:snapchat.com', 'Snapchat');
  await sleep(3000);
  
  // اختبار تيك توك
  await searchGoogleSERP('مطعم الرياض site:tiktok.com', 'TikTok');
  await sleep(3000);
  
  // اختبار إنستجرام
  await searchGoogleSERP('مطعم الرياض site:instagram.com', 'Instagram');
}

main().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
