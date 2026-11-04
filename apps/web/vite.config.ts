import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  server: { port: 5173, strictPort: true },
  plugins: [
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    VitePWA({
      disable: process.env.VITE_NATIVE === "1",
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "ruma. by Al Akhyar",
        short_name: "ruma.",
        description: "Your AI Meeting Companion: notulensi rapat dan supervisi kelas dari rekaman suara, Sekolah Islam Al Akhyar.",
        lang: "id",
        start_url: "/",
        display: "standalone",
        orientation: "portrait",
        theme_color: "#153e35", // Primary (DESIGN.md §2.2)
        background_color: "#f7f9f7", // Background light; splash sebelum tema dimuat
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      // Hanya cangkang aplikasi yang di-cache. Semua panggilan API (lintas origin) selalu ke jaringan.
      workbox: {
        navigateFallback: "/index.html",
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
