import puppeteer from 'puppeteer-core';
import fs from 'fs';

const WS_ENDPOINT = process.env.BRIGHT_DATA_WS_ENDPOINT;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const browser = await puppeteer.connect({ browserWSEndpoint: WS_ENDPOINT });
  const page = await browser.newPage();
  
  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'ar-SA,ar;q=0.9,en-US;q=0.8' });
    
    const query = 'مطعم الرياض site:snapchat.com';
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=10&hl=ar&gl=sa`;
    
    console.log('Navigating to:', url);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(3000);
    
    const title = await page.title();
    console.log('Page title:', title);
    
    // حفظ HTML
    const html = await page.content();
    fs.writeFileSync('/tmp/google-snap-debug.html', html);
    console.log('HTML saved to /tmp/google-snap-debug.html, length:', html.length);
    
    // فحص جميع الروابط
    const allLinks = await page.evaluate(() => {
      const links = [];
      document.querySelectorAll('a[href]').forEach(a => {
        const href = a.href;
        if (href && !href.includes('google.com') && href.startsWith('http')) {
          links.push({ href: href.substring(0, 100), text: (a.innerText || '').substring(0, 50) });
        }
      });
      return links;
    });
    
    console.log('\nAll external links found:', allLinks.length);
    allLinks.forEach(l => console.log(`  ${l.text} -> ${l.href}`));
    
    // فحص إذا كان هناك captcha أو redirect
    const currentUrl = page.url();
    console.log('\nCurrent URL:', currentUrl);
    
    // فحص نص الصفحة
    const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500));
    console.log('\nBody text preview:', bodyText);
    
  } finally {
    await page.close();
    await browser.close();
  }
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
