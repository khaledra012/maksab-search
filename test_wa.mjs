import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'fs';

console.log('Starting browser...');
let browser;
try {
  browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium-browser',
    headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--window-size=1280,800'],
  });
  console.log('Browser launched OK');
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  console.log('Navigating to WhatsApp Web...');
  await page.goto('https://web.whatsapp.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
  console.log('Page loaded, title:', await page.title());
  
  // انتظر 8 ثواني للتحميل الكامل
  await new Promise(r => setTimeout(r, 8000));
  
  const html = await page.content();
  writeFileSync('/home/ubuntu/wa_page.html', html.slice(0, 5000));
  console.log('HTML saved (first 5000 chars)');
  
  const hasQR = await page.evaluate(() => !!document.querySelector('[data-ref]'));
  const hasSide = await page.evaluate(() => !!document.querySelector('#side'));
  const hasCanvas = await page.evaluate(() => !!document.querySelector('canvas'));
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 200));
  
  console.log('Has [data-ref]:', hasQR);
  console.log('Has #side:', hasSide);
  console.log('Has canvas:', hasCanvas);
  console.log('Body text:', bodyText);
  
  const ss = await page.screenshot({ path: '/home/ubuntu/wa_screenshot.png' });
  console.log('Screenshot saved to /home/ubuntu/wa_screenshot.png');
  
  await browser.close();
  console.log('Done');
} catch(e) {
  console.error('ERROR:', e.message);
  if (browser) await browser.close().catch(() => {});
}
