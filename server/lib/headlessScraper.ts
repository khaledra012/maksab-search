/**
 * Headless Browser Scraper — Puppeteer
 * يُستخدم كـ fallback عند فشل HTTP Fetch العادي
 * يدعم مواقع JavaScript-Heavy (React/Vue/Angular)
 */
import puppeteer from "puppeteer-core";

const CHROMIUM_PATH = "/usr/bin/chromium-browser";

export interface HeadlessResult {
  html: string;
  text: string;
  title: string;
  metaDescription: string;
  success: boolean;
  error?: string;
}

/**
 * يفتح الموقع بمتصفح حقيقي ويُشغّل JavaScript كاملاً
 * يُرجع HTML الكامل بعد تحميل كل المحتوى الديناميكي
 */
export async function scrapeWithHeadless(url: string, timeoutMs = 25000): Promise<HeadlessResult> {
  let browser = null;
  try {
    browser = await puppeteer.launch({
      executablePath: CHROMIUM_PATH,
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
        "--window-size=1280,800",
        "--disable-blink-features=AutomationControlled",
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      ],
    });

    const page = await browser.newPage();

    // إخفاء علامات الأتمتة
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    // تعيين viewport وUser-Agent
    await page.setViewport({ width: 1280, height: 800 });
    await page.setExtraHTTPHeaders({
      "Accept-Language": "ar-SA,ar;q=0.9,en-US;q=0.8,en;q=0.7",
    });

    // تجاهل الصور والخطوط لتسريع التحميل
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const type = req.resourceType();
      if (["image", "font", "media", "stylesheet"].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: timeoutMs,
    });

    // انتظار إضافي لتحميل المحتوى الديناميكي
    await new Promise(r => setTimeout(r, 2000));

    // استخراج البيانات من الصفحة المحملة بالكامل
    const result = await page.evaluate(() => {
      const title = document.title || "";
      const metaDesc = (document.querySelector('meta[name="description"]') as HTMLMetaElement)?.content || "";
      const html = document.documentElement.outerHTML;

      // تنظيف النص للـ AI
      const scripts = document.querySelectorAll("script, style, noscript");
      scripts.forEach(el => el.remove());
      const text = document.body?.innerText?.replace(/\s+/g, " ").trim().slice(0, 12000) || "";

      return { title, metaDescription: metaDesc, html: html.slice(0, 200000), text };
    });

    return {
      html: result.html,
      text: result.text,
      title: result.title,
      metaDescription: result.metaDescription,
      success: true,
    };
  } catch (err: any) {
    console.warn("[HeadlessScraper] Failed:", err?.message);
    return {
      html: "",
      text: "",
      title: "",
      metaDescription: "",
      success: false,
      error: err?.message,
    };
  } finally {
    if (browser) {
      try { await browser.close(); } catch { /* تجاهل */ }
    }
  }
}

/**
 * أخذ Screenshot كامل للموقع (Full-Page)
 * يستخدم Bright Data Scraping Browser (WebSocket) للوصول للإنترنت
 * يُرجع Buffer للصورة بصيغة PNG
 */
export async function takeWebsiteScreenshot(url: string, timeoutMs = 30000): Promise<Buffer | null> {
  // محاولة أولى: Chromium المحلي (أسرع وأكثر موثوقية في بيئة الإنتاج)
  let browser = null;
  try {
    browser = await puppeteer.launch({
      executablePath: CHROMIUM_PATH,
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
        "--window-size=1440,900",
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    // إخفاء علامات الأتمتة
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    // انتظار إضافي لتحميل المحتوى الديناميكي
    await new Promise(r => setTimeout(r, 3000));

    // إخفاء النوافذ المنبثقة الشائعة
    try {
      await page.evaluate(() => {
        const selectors = [
          '[class*="cookie"]', '[class*="popup"]', '[class*="modal"]',
          '[id*="cookie"]', '[id*="popup"]', '[id*="overlay"]',
          '[class*="gdpr"]', '[class*="consent"]',
        ];
        selectors.forEach(sel => {
          document.querySelectorAll(sel).forEach((el: any) => { el.style.display = 'none'; });
        });
      });
    } catch { /* تجاهل أخطاء إخفاء النوافذ */ }

    // Full-Page Screenshot — يلتقط الصفحة الكاملة بطولها الكامل
    const screenshotBuffer = await page.screenshot({
      type: "png",
      fullPage: true,
    });

    await browser.close();
    console.log(`[Screenshot] Captured via local Chromium (full-page): ${url} (${Buffer.from(screenshotBuffer).length} bytes)`);
    return Buffer.from(screenshotBuffer);
  } catch (err: any) {
    console.warn("[Screenshot] Local Chromium failed:", err?.message);
    if (browser) {
      try { await browser.close(); } catch { /* تجاهل */ }
    }
  }

  // محاولة ثانية: Bright Data Scraping Browser (fallback)
  const wsEndpoint = process.env.BRIGHT_DATA_WS_ENDPOINT;
  if (wsEndpoint) {
    let bdBrowser = null;
    try {
      bdBrowser = await puppeteer.connect({
        browserWSEndpoint: wsEndpoint,
      });

      const page = await bdBrowser.newPage();
      await page.setViewport({ width: 1440, height: 900 });
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
      await new Promise(r => setTimeout(r, 3000));

      const screenshotBuffer = await page.screenshot({
        type: "png",
        fullPage: true,
      });

      await bdBrowser.disconnect();
      console.log(`[Screenshot] Captured via Bright Data (full-page): ${url} (${Buffer.from(screenshotBuffer).length} bytes)`);
      return Buffer.from(screenshotBuffer);
    } catch (err: any) {
      console.warn("[Screenshot] Bright Data also failed:", err?.message);
      if (bdBrowser) {
        try { await bdBrowser.disconnect(); } catch { /* تجاهل */ }
      }
    }
  }

  console.warn("[Screenshot] All methods failed for:", url);
  return null;
}

/**
 * أخذ Screenshot لصفحة سوشيال ميديا (إنستغرام / تيك توك / تويتر / سناب شات)
 * يستخدم Bright Data Scraping Browser للوصول للمنصات المحجوبة
 * يُرجع Buffer للصورة بصيغة PNG
 */
export async function takeSocialMediaScreenshot(
  url: string,
  platform: "instagram" | "tiktok" | "twitter" | "snapchat" | "facebook",
  timeoutMs = 35000
): Promise<Buffer | null> {
  // دالة مساعدة لإخفاء النوافذ المنبثقة حسب المنصة
  const hidePopups = async (page: any, plt: string) => {
    try {
      await page.evaluate((platform: string) => {
        const hideSelectors = [
          '[role="dialog"]',
          '[class*="cookie"]', '[class*="consent"]',
          '[class*="login"]', '[class*="signup"]',
          '[class*="modal"]', '[class*="overlay"]',
          '[class*="banner"]',
        ];
        if (platform === "instagram") hideSelectors.push('._a9-z', '._acas', '.RnEpo', '[class*="AppBanner"]', '[class*="app-banner"]', '[id*="app-banner"]', 'div[style*="position: fixed"]');
        if (platform === "tiktok") hideSelectors.push('[class*="AppDownload"]', '[class*="LoginModal"]');
        hideSelectors.forEach(sel => {
          document.querySelectorAll(sel).forEach((el: any) => {
            el.style.display = 'none';
            el.style.visibility = 'hidden';
          });
        });
        document.body.style.overflow = 'auto';
      }, plt);
    } catch { /* تجاهل */ }
  };

  // تحديد User-Agent وإعدادات حسب المنصة
  const isTwitter = platform === "twitter";
  const isInstagram = platform === "instagram";
  const isTiktok = platform === "tiktok";
  const isMobile = isInstagram || isTiktok;

  // User-Agent مناسب لكل منصة
  const userAgent = isTwitter
    ? "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
    : "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

  // وقت الانتظار حسب المنصة (تويتر يحتاج وقتاً أطول لتحميل JS)
  const waitAfterLoad = isTwitter ? 6000 : 4000;

  // للمنصات المحجوبة (إنستغرام وتيك توك): استخدام Bright Data Residential Proxy أولاً
  if (isInstagram || isTiktok) {
    const proxyHost = process.env.BRIGHT_DATA_RESIDENTIAL_HOST;
    const proxyPort = process.env.BRIGHT_DATA_RESIDENTIAL_PORT;
    const proxyUser = process.env.BRIGHT_DATA_RESIDENTIAL_USERNAME;
    const proxyPass = process.env.BRIGHT_DATA_RESIDENTIAL_PASSWORD;

    if (proxyHost && proxyPort && proxyUser && proxyPass) {
      let bdBrowser = null;
      try {
        bdBrowser = await puppeteer.launch({
          executablePath: CHROMIUM_PATH,
          headless: true,
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--disable-gpu",
            "--ignore-certificate-errors",
            "--ignore-certificate-errors-spki-list",
            `--proxy-server=http://${proxyHost}:${proxyPort}`,
            `--user-agent=${userAgent}`,
          ],
        });

        const page = await bdBrowser.newPage();
        await page.setViewport({ width: 430, height: 932 }); // iPhone 14 Pro Max
        await page.authenticate({ username: proxyUser, password: proxyPass });
        // تجاهل أخطاء SSL من الـ proxy
        page.on('response', () => {}); // dummy listener

        // إخفاء علامات الأتمتة
        await page.evaluateOnNewDocument(() => {
          Object.defineProperty(navigator, "webdriver", { get: () => undefined });
          Object.defineProperty(navigator, "platform", { get: () => "iPhone" });
        });

        await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
        await new Promise(r => setTimeout(r, 5000));
        await hidePopups(page, platform);
        await new Promise(r => setTimeout(r, 1500));

        const screenshotBuffer = await page.screenshot({
          type: "png",
          fullPage: false,
        });

        await bdBrowser.close();
        console.log(`[SocialScreenshot] Captured ${platform} via Bright Data Residential Proxy: ${url} (${Buffer.from(screenshotBuffer).length} bytes)`);
        return Buffer.from(screenshotBuffer);
      } catch (err: any) {
        console.warn(`[SocialScreenshot] Bright Data Residential Proxy failed for ${platform}:`, err?.message);
        if (bdBrowser) {
          try { await bdBrowser.close(); } catch { /* تجاهل */ }
        }
      }
    }
  }

  // محاولة: Chromium المحلي مع User-Agent حقيقي (للمنصات الأخرى أو كـ fallback)
  let browser = null;
  try {
    browser = await puppeteer.launch({
      executablePath: CHROMIUM_PATH,
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
        `--user-agent=${userAgent}`,
      ],
    });

    const page = await browser.newPage();
    // viewport مناسب للسوشيال ميديا
    if (isMobile) {
      await page.setViewport({ width: 430, height: 932 }); // iPhone 14 Pro Max
    } else {
      await page.setViewport({ width: 1280, height: 800 });
    }

    // إخفاء علامات الأتمتة
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
      Object.defineProperty(navigator, "platform", { get: () => "iPhone" });
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await new Promise(r => setTimeout(r, waitAfterLoad));
    await hidePopups(page, platform);
    await new Promise(r => setTimeout(r, 1000));

    const screenshotBuffer = await page.screenshot({
      type: "png",
      fullPage: false,
    });

    await browser.close();
    console.log(`[SocialScreenshot] Captured ${platform} via local Chromium: ${url} (${Buffer.from(screenshotBuffer).length} bytes)`);
    return Buffer.from(screenshotBuffer);
  } catch (err: any) {
    console.warn(`[SocialScreenshot] Local Chromium failed for ${platform}:`, err?.message);
    if (browser) {
      try { await browser.close(); } catch { /* تجاهل */ }
    }
  }

  console.warn(`[SocialScreenshot] All methods failed for ${platform}:`, url);
  return null;
}

/**
 * اكتشاف الميزات التقنية من HTML الكامل (بعد تشغيل JS)
 */
export function detectFeaturesFromFullHtml(html: string, text: string) {
  const lower = html.toLowerCase();
  const textLower = text.toLowerCase();
  const combined = lower + " " + textLower;

  return {
    hasPaymentGateway: /mada|moyasar|hyperpay|payfort|stripe|checkout|payment|بوابة.*دفع|ادفع|الدفع|visa|mastercard|pay\.google|apple.*pay/i.test(combined),
    hasEcommerce: /cart|سلة|عربة|checkout|shop|متجر|منتجات|add.to.cart|buy.now|اشتر/i.test(combined),
    hasBooking: /book|حجز|موعد|appointment|reservation|schedule|احجز|book.*now/i.test(combined),
    hasWhatsapp: /wa\.me|whatsapp|واتساب/i.test(combined),
    hasLiveChat: /livechat|tawk|intercom|zendesk|chat.*widget|crisp/i.test(combined),
    hasAnalytics: /google.*analytics|gtag|ga\(|_gaq|hotjar|mixpanel|segment/i.test(combined),
    hasSSL: html.startsWith("https") || /https:\/\//i.test(html.slice(0, 500)),
    hasBlog: /blog|مدونة|مقالات|articles|posts/i.test(combined),
    hasContactForm: /contact.*form|نموذج.*تواصل|form.*submit|اتصل.*بنا/i.test(combined),
    hasSocialLinks: /instagram\.com|tiktok\.com|snapchat\.com|twitter\.com|facebook\.com/i.test(combined),
    phoneNumbers: (combined.match(/(?:\+966|00966|0)5[0-9]{8}/g) || []).slice(0, 3),
    emails: (combined.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [])
      .filter(e => !e.includes("example") && !e.includes("test"))
      .slice(0, 3),
  };
}
