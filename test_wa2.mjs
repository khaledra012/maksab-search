import puppeteer from 'puppeteer-core';

console.log('Starting browser with custom UA...');
let browser;
try {
  browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium-browser',
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1280,800',
      '--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    ],
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  
  // تعيين User Agent يدعمه واتساب
  await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36');
  
  // تجاوز فحص WebDriver
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['ar-SA', 'ar', 'en-US', 'en'] });
  });

  console.log('Navigating to WhatsApp Web...');
  await page.goto('https://web.whatsapp.com', { waitUntil: 'networkidle2', timeout: 45000 });
  console.log('Page loaded, title:', await page.title());
  
  // انتظر 10 ثواني
  await new Promise(r => setTimeout(r, 10000));
  
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 300));
  console.log('Body text:', bodyText);
  
  const hasQR = await page.evaluate(() => !!document.querySelector('[data-ref]'));
  const hasSide = await page.evaluate(() => !!document.querySelector('#side'));
  const hasCanvas = await page.evaluate(() => !!document.querySelector('canvas'));
  const hasQRContainer = await page.evaluate(() => !!document.querySelector('[data-testid="qrcode"]'));
  
  console.log('Has [data-ref]:', hasQR);
  console.log('Has #side:', hasSide);
  console.log('Has canvas:', hasCanvas);
  console.log('Has qrcode testid:', hasQRContainer);
  
  await page.screenshot({ path: '/home/ubuntu/wa_screenshot2.png' });
  console.log('Screenshot saved');
  
  await browser.close();
} catch(e) {
  console.error('ERROR:', e.message);
  if (browser) await browser.close().catch(() => {});
}
