import { Hono } from "hono";
import { cors } from "hono/cors";
import { migrasiTertinggal } from "./db/migrasi.js";
import { env } from "./env.js";
import { auth } from "./routes/auth.js";
import { sesiRoutes } from "./routes/sesi.js";
import { permintaanRoutes } from "./routes/permintaan.js";
import { admin } from "./routes/admin.js";
import { grupRoutes } from "./routes/grup.js";
import { kategoriRoutes } from "./routes/kategori.js";
import { gtkRoutes } from "./routes/gtk.js";
import { pengetahuanRoutes } from "./routes/pengetahuan.js";
import { seriRapatRoutes } from "./routes/seri.js";
import { simgtkAgendaRoutes } from "./routes/simgtk-agenda.js";

export const app = new Hono()
  .use(async (c, next) => {
    const izinkanOrigin = (asal: string | undefined): boolean => {
      if (!asal) return false;
      const normal = asal.replace(/\/+$/, "");
      if (normal === env.APP_URL.replace(/\/+$/, "")) return true;
      return env.CORS_ORIGINS.includes(normal);
    };

    return cors({
      origin: (asal) => (izinkanOrigin(asal) ? asal : null),
      credentials: true,
    })(c, next);
  })
  // Cookie sesi + SameSite=Lax belum cukup untuk same-site lintas subdomain: tolak mutasi dari origin lain.
  .use(async (c, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method)) {
      const origin = c.req.header("origin");
      if (origin) {
        const normal = origin.replace(/\/+$/, "");
        const sah = normal === env.APP_URL.replace(/\/+$/, "") || env.CORS_ORIGINS.includes(normal);
        if (!sah) return c.json({ error: "bad_origin" }, 403);
      }
    }
    await next();
  })
  // 503 bila skema database tertinggal dari kode (migrasi belum dijalankan) atau database tak terjangkau (-1).
  .get("/health", async (c) => {
    const tertinggal = await migrasiTertinggal().catch(() => -1);
    return c.json({ ok: tertinggal === 0, migrasiTertinggal: tertinggal }, tertinggal === 0 ? 200 : 503);
  })
  .onError((e, c) => {
    console.error(`${c.req.method} ${c.req.path}`, e);
    return c.json({ error: "server_error" }, 500);
  })
  .route("/auth", auth)
  .route("/sesi", sesiRoutes)
  .route("/permintaan", permintaanRoutes)
  .route("/grup", grupRoutes)
  .route("/kategori", kategoriRoutes)
  .route("/gtk", gtkRoutes)
  .route("/pengetahuan", pengetahuanRoutes)
  .route("/seri", seriRapatRoutes)
  .route("/simgtk/agenda", simgtkAgendaRoutes)
  .route("/admin", admin);

export type AppType = typeof app;
