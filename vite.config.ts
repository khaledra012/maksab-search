import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig, loadEnv, type Plugin, type UserConfig } from "vite";

const PROJECT_ROOT = import.meta.dirname;

function vitePluginAnalytics(endpoint?: string, websiteId?: string): Plugin {
  const normalizedEndpoint = endpoint?.trim().replace(/\/+$/, "");
  const normalizedWebsiteId = websiteId?.trim();
  const shouldInject = Boolean(normalizedEndpoint && normalizedWebsiteId);

  return {
    name: "analytics-script",
    transformIndexHtml(html) {
      if (!shouldInject) {
        return html;
      }

      return {
        html,
        tags: [
          {
            tag: "script",
            attrs: {
              defer: true,
              src: `${normalizedEndpoint}/umami`,
              "data-website-id": normalizedWebsiteId!,
            },
            injectTo: "body",
          },
        ],
      };
    },
  };
}

function matchesNodeModule(id: string, packageName: string): boolean {
  return (
    id.includes(`/node_modules/${packageName}/`) ||
    id.includes(`\\node_modules\\${packageName}\\`)
  );
}

function getManualChunk(id: string): string | undefined {
  if (!id.includes("node_modules")) {
    return undefined;
  }

  if (
    matchesNodeModule(id, "react") ||
    matchesNodeModule(id, "react-dom") ||
    matchesNodeModule(id, "scheduler")
  ) {
    return "react-vendor";
  }
  if (
    id.includes("@radix-ui") ||
    matchesNodeModule(id, "vaul") ||
    matchesNodeModule(id, "cmdk") ||
    id.includes("embla-carousel")
  ) {
    return "ui-vendor";
  }
  if (
    id.includes("@tanstack") ||
    id.includes("@trpc") ||
    matchesNodeModule(id, "superjson") ||
    matchesNodeModule(id, "zod")
  ) {
    return "data-vendor";
  }
  if (
    matchesNodeModule(id, "jspdf") ||
    matchesNodeModule(id, "pdfkit") ||
    matchesNodeModule(id, "html2canvas") ||
    matchesNodeModule(id, "html2pdf.js") ||
    matchesNodeModule(id, "qrcode") ||
    matchesNodeModule(id, "xlsx")
  ) {
    return "export-vendor";
  }
  if (matchesNodeModule(id, "recharts") || matchesNodeModule(id, "framer-motion")) {
    return "visual-vendor";
  }
  if (
    matchesNodeModule(id, "lucide-react") ||
    matchesNodeModule(id, "date-fns") ||
    matchesNodeModule(id, "sonner") ||
    matchesNodeModule(id, "next-themes") ||
    matchesNodeModule(id, "wouter")
  ) {
    return "app-vendor";
  }

  return "vendor";
}

export function createAppViteConfig(mode: string): UserConfig {
  const env = loadEnv(mode, PROJECT_ROOT, "");

  return {
    plugins: [
      react(),
      tailwindcss(),
      jsxLocPlugin(),
      vitePluginAnalytics(env.VITE_ANALYTICS_ENDPOINT, env.VITE_ANALYTICS_WEBSITE_ID),
    ],
    resolve: {
      alias: {
        "@": path.resolve(PROJECT_ROOT, "client", "src"),
        "@shared": path.resolve(PROJECT_ROOT, "shared"),
        "@assets": path.resolve(PROJECT_ROOT, "attached_assets"),
      },
    },
    envDir: PROJECT_ROOT,
    root: path.resolve(PROJECT_ROOT, "client"),
    publicDir: path.resolve(PROJECT_ROOT, "client", "public"),
    build: {
      outDir: path.resolve(PROJECT_ROOT, "dist/public"),
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks: getManualChunk,
        },
      },
    },
    server: {
      host: true,
      allowedHosts: [
        "localhost",
        "127.0.0.1",
      ],
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
  };
}

export default defineConfig(({ mode }) => createAppViteConfig(mode));
