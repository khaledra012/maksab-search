/**
 * اختبار كامل لعملية Screenshot + S3 upload
 * يحاكي ما يحدث في brightDataAnalysis.ts
 */
import puppeteer from 'puppeteer';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const CHROMIUM_PATH = '/usr/bin/chromium-browser';

// محاكاة takeWebsiteScreenshot
async function takeWebsiteScreenshot(url, timeout = 25000) {
  let browser;
  try {
    console.log(`[Screenshot] Starting Chromium for: ${url}`);
    browser = await puppeteer.launch({
      executablePath: CHROMIUM_PATH,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1440,900',
      ],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log(`[Screenshot] Navigating...`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout });
    await new Promise(r => setTimeout(r, 2000));
    
    const buffer = await page.screenshot({ type: 'png', fullPage: false });
    console.log(`[Screenshot] ✅ Captured! Buffer size: ${buffer.length} bytes`);
    return buffer;
  } catch (err) {
    console.error(`[Screenshot] ❌ Failed:`, err.message);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

// محاكاة storagePut
async function testStoragePut(buffer) {
  try {
    const forgeUrl = process.env.BUILT_IN_FORGE_API_URL;
    const forgeKey = process.env.BUILT_IN_FORGE_API_KEY;
    
    console.log(`[S3] FORGE_API_URL: ${forgeUrl ? '✅ present' : '❌ missing'}`);
    console.log(`[S3] FORGE_API_KEY: ${forgeKey ? '✅ present' : '❌ missing'}`);
    
    if (!forgeUrl || !forgeKey) {
      console.error('[S3] ❌ Missing credentials - this is why screenshots are not saved!');
      return null;
    }
    
    // محاكاة storagePut
    const { storagePut } = await import('./server/storage.ts');
    const key = `test-screenshots/test-${Date.now()}.png`;
    console.log(`[S3] Uploading to key: ${key}`);
    const result = await storagePut(key, buffer, 'image/png');
    console.log(`[S3] ✅ Upload success! URL: ${result.url}`);
    return result.url;
  } catch (err) {
    console.error(`[S3] ❌ Upload failed:`, err.message);
    return null;
  }
}

async function main() {
  console.log('=== اختبار Screenshot + S3 Upload ===\n');
  
  // اختبار 1: موقع ربوة الرياض
  const websiteUrl = 'https://rabwatalriyad.com/';
  console.log(`\n--- اختبار الموقع: ${websiteUrl} ---`);
  const websiteBuffer = await takeWebsiteScreenshot(websiteUrl, 20000);
  
  if (websiteBuffer) {
    console.log('\n--- اختبار رفع S3 ---');
    const s3Url = await testStoragePut(websiteBuffer);
    if (s3Url) {
      console.log(`\n✅ النتيجة النهائية: ${s3Url}`);
    }
  }
}

main().catch(console.error);
