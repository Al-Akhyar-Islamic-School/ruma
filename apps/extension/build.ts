import { build } from "vite";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log("🔨 Memulai build ruma. Chrome Extension...");

  // 1. Build halaman HTML (popup dan offscreen)
  console.log("1/3 Building HTML pages (popup, offscreen)...");
  await build({
    root: __dirname,
    build: {
      outDir: "dist",
      emptyOutDir: true,
      rollupOptions: {
        input: {
          popup: resolve(__dirname, "src/popup/index.html"),
          offscreen: resolve(__dirname, "src/offscreen/index.html"),
        },
      },
    },
  });

  // 2. Build background service worker (ES module)
  console.log("2/3 Building background service worker...");
  await build({
    root: __dirname,
    build: {
      outDir: "dist",
      emptyOutDir: false,
      lib: {
        entry: resolve(__dirname, "src/background/index.ts"),
        formats: ["es"],
        fileName: () => "background.js",
      },
    },
  });

  // 3. Build content script (IIFE mandiri)
  console.log("3/3 Building content script...");
  await build({
    root: __dirname,
    build: {
      outDir: "dist",
      emptyOutDir: false,
      lib: {
        entry: resolve(__dirname, "src/content/index.ts"),
        formats: ["iife"],
        name: "RumaMeetContentScript",
        fileName: () => "content.js",
      },
    },
  });

  // 4. Salin manifest.json dan ikon ke dist/
  console.log("📦 Menyalin manifest.json dan aset...");
  fs.copyFileSync(resolve(__dirname, "manifest.json"), resolve(__dirname, "dist/manifest.json"));
  if (fs.existsSync(resolve(__dirname, "public/icons"))) {
    fs.cpSync(resolve(__dirname, "public/icons"), resolve(__dirname, "dist/icons"), { recursive: true });
  }

  console.log("✅ Build Chrome Extension ruma. selesai di dist/");
}

void main();
