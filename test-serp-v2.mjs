import puppeteer from 'puppeteer-core';

const WS_ENDPOINT = process.env.BRIGHT_DATA_WS_ENDPOINT;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function searchGoogleSERP(query, platform) {
  console.log(`\n🔍 Searching ${platform}: "${query}"`);
  
  const browser = await puppeteer.connect({ browserWSEndpoint: WS_ENDPOINT });
  const page = await browser.newPage();
  
  try {
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1');
    await page.setExtraHTTPHeaders({ 
      'Accept-Language': 'ar-SA,ar;q=0.9,en-US;q=0.8',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    });
    
    const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=20&hl=ar&gl=sa&pws=0`;
    await page.goto(googleUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(3000);
    
    // حفظ HTML للتشخيص
    const html = await page.content();
    const title = await page.title();
    console.log(`  Page title: ${title}`);
    console.log(`  HTML length: ${html.length}`);
    
    // استخراج جميع الروابط الخارجية
    const results = await page.evaluate((targetPlatform) => {
      const items = [];
      const seen = new Set();
      
      // محاولة 1: Google search result links
      const allAnchors = document.querySelectorAll('a[href]');
      allAnchors.forEach(a => {
        const href = a.href || '';
        if (!href || href.includes('google.com') || href.includes('javascript:')) return;
        
        // فلترة حسب المنصة
        const platformDomains = {
          snapchat: 'snapchat.com',
          tiktok: 'tiktok.com',
          instagram: 'instagram.com',
          linkedin: 'linkedin.com',
        };
        
        const domain = platformDomains[targetPlatform];
        if (!domain || !href.includes(domain)) return;
        if (seen.has(href)) return;
        seen.add(href);
        
        // الحصول على النص
        let text = '';
        let parent = a.parentElement;
        for (let i = 0; i < 5; i++) {
          if (!parent) break;
          const h3 = parent.querySelector('h3');
          if (h3) { text = h3.innerText || h3.textContent || ''; break; }
          parent = parent.parentElement;
        }
        if (!text) text = a.innerText || a.textContent || '';
        
        // الحصول على الـ snippet
        let snippet = '';
        parent = a.parentElement;
        for (let i = 0; i < 5; i++) {
          if (!parent) break;
          const spans = parent.querySelectorAll('span, div');
          spans.forEach(s => {
            const t = s.innerText || s.textContent || '';
            if (t.length > 50 && t.length < 500 && !t.includes('google')) {
              snippet = t.substring(0, 200);
            }
          });
          if (snippet) break;
          parent = parent.parentElement;
        }
        
        items.push({ title: text.trim().substring(0, 100), link: href, snippet: snippet.trim() });
      });
      
      return items.slice(0, 15);
    }, platform);
    
    console.log(`✅ Found ${results.length} results`);
    results.slice(0, 5).forEach(r => {
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
  
  // اختبار سناب شات
  await searchGoogleSERP('مطعم الرياض site:snapchat.com', 'snapchat');
  await sleep(3000);
  
  // اختبار إنستجرام
  await searchGoogleSERP('مطعم الرياض site:instagram.com', 'instagram');
}

main().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
