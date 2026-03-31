import puppeteer from 'puppeteer-core';

console.log('Starting...');
let browser;
try {
  browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium-browser',
    headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--window-size=1280,900'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36');
  await page.evaluateOnNewDocument(() => { Object.defineProperty(navigator, 'webdriver', { get: () => false }); });
  await page.goto('https://web.whatsapp.com', { waitUntil: 'networkidle0', timeout: 60000 });
  console.log('Loaded. Waiting for QR...');
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const s = await page.evaluate(() => ({
      qrRef: !!document.querySelector('[data-ref]'),
      canvas: !!document.querySelector('canvas'),
      side: !!document.querySelector('#side'),
      bodyLen: document.body.innerHTML.length,
    }));
    console.log('[' + (i+1) + ']', JSON.stringify(s));
    if (s.qrRef || s.canvas || s.side) break;
  }
  await page.screenshot({ path: '/home/ubuntu/wa_final.png' });
  await browser.close();
  console.log('Done');
} catch(e) { console.error('ERROR:', e.message); if(browser) await browser.close().catch(()=>{}); }
