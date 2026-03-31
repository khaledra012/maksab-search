import "dotenv/config";
import express from "express";
import fs from "fs";
// ===== SSE clients store =====
const sseClients = new Set<import("http").ServerResponse>();
export function broadcastSSE(event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  Array.from(sseClients).forEach(res => {
    try { res.write(payload); } catch { sseClients.delete(res); }
  });
}
import { createServer } from "http";
import net from "net";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { getLocalStoragePublicDir } from "../storage";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

function resolveLocalChromiumPath(): string | null {
  const overridePaths = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_BIN,
  ].filter((candidate): candidate is string => Boolean(candidate));
  const linuxPaths = [
    "/usr/lib/chromium-browser/chromium-browser",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/snap/bin/chromium",
  ];
  const macPaths = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ];
  const localAppData = process.env.LOCALAPPDATA ?? "";
  const programFiles = process.env.PROGRAMFILES ?? process.env.ProgramFiles ?? "";
  const programFilesX86 = process.env["ProgramFiles(x86)"] ?? "";
  const windowsPaths = [
    path.join(localAppData, "Google", "Chrome", "Application", "chrome.exe"),
    path.join(localAppData, "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
    path.join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
    path.join(programFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(programFilesX86, "Microsoft", "Edge", "Application", "msedge.exe"),
  ];
  const candidates = [
    ...overridePaths,
    ...(process.platform === "win32"
      ? windowsPaths
      : process.platform === "darwin"
        ? macPaths
        : linuxPaths),
  ];

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.use("/uploads", express.static(getLocalStoragePublicDir()));

  // ===== SSE endpoint للتحديث الفوري =====
  app.get("/api/sse/chat-updates", (_req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.flushHeaders();
    sseClients.add(res);
    const pingInterval = setInterval(() => {
      try { res.write("event: ping\ndata: {}\n\n"); } catch { clearInterval(pingInterval); }
    }, 25000);
    _req.on("close", () => {
      clearInterval(pingInterval);
      sseClients.delete(res);
    });
  });

  // ===== PDF Generation via Puppeteer + @sparticuz/chromium (يدعم oklch بشكل كامل) =====
  app.post("/api/generate-pdf", async (req, res) => {
    try {
      const { html, filename = "report.pdf" } = req.body as { html: string; filename: string };
      if (!html) { res.status(400).json({ error: "html is required" }); return; }

      const puppeteer = await import("puppeteer-core");
      const chromium = await import("@sparticuz/chromium");

      // تجربة مسارات Chromium المحلية أولاً (dev)، ثم @sparticuz/chromium (production)
      const chromiumPath = resolveLocalChromiumPath();
      let browser;
      if (chromiumPath) {
        console.log("[PDF] Using local Chromium at:", chromiumPath);
        browser = await puppeteer.default.launch({
          executablePath: chromiumPath,
          args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--single-process"],
          headless: true,
        });
      } else {
        // Production: استخدام @sparticuz/chromium
        console.log("[PDF] Local Chromium not found, using @sparticuz/chromium");
        const execPath = await chromium.default.executablePath();
        browser = await puppeteer.default.launch({
          executablePath: execPath,
          args: [...chromium.default.args, "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--single-process"],
          headless: true,
          defaultViewport: { width: 1200, height: 900 },
        });
      }

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0", timeout: 30000 });
      // انتظار تحميل الخطوط
      await new Promise((r) => setTimeout(r, 1500));
      const pdfBuffer = await page.pdf({
        format: "A3",
        printBackground: true,
        margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
      });
      await browser.close();

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
      res.send(Buffer.from(pdfBuffer));
    } catch (err: any) {
      console.error("[PDF Generation] Error:", err);
      res.status(500).json({ error: err.message || "فشل توليد PDF" });
    }
  });

  // ===== Proxy لصور Google Maps (Places Photo API) =====
  app.get("/api/maps-photo", async (req, res) => {
    try {
      const { photo_reference, maxwidth = "800" } = req.query as { photo_reference: string; maxwidth: string };
      if (!photo_reference) { res.status(400).json({ error: "photo_reference is required" }); return; }

      const { makeRequest } = await import("./map");
      // نجلب الصورة عبر map proxy المحلي
      const proxyUrl = `/maps/api/place/photo?maxwidth=${maxwidth}&photo_reference=${photo_reference}`;
      const proxyRes = await makeRequest(proxyUrl, {}, { raw: true }).catch(() => null);
      if (proxyRes) {
        res.setHeader("Content-Type", "image/jpeg");
        res.setHeader("Cache-Control", "public, max-age=86400");
        res.send(Buffer.isBuffer(proxyRes) ? proxyRes : Buffer.from(proxyRes));
        return;
      }
      res.status(404).json({ error: "لم يتم العثور على الصورة" });
    } catch (err: any) {
      console.error("[Maps Photo Proxy] Error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
