import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "./env.js";
import { auth } from "./routes/auth.js";
import { sesiRoutes } from "./routes/sesi.js";
import { permintaanRoutes } from "./routes/permintaan.js";
import { admin } from "./routes/admin.js";
import { grupRoutes } from "./routes/grup.js";
import { gtkRoutes } from "./routes/gtk.js";

export const app = new Hono()
  .use(cors({ origin: env.APP_URL, credentials: true }))
  // Cookie sesi + SameSite=Lax belum cukup untuk same-site lintas subdomain: tolak mutasi dari origin lain.
  .use(async (c, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method)) {
      const origin = c.req.header("origin");
      if (origin !== env.APP_URL) return c.json({ error: "bad_origin" }, 403);
    }
    await next();
  })
  .get("/health", (c) => c.json({ ok: true }))
  .route("/auth", auth)
  .route("/sesi", sesiRoutes)
  .route("/permintaan", permintaanRoutes)
  .route("/grup", grupRoutes)
  .route("/gtk", gtkRoutes)
  .route("/admin", admin);

export type AppType = typeof app;
