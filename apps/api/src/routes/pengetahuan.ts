import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { requireAuth, type AuthEnv } from "../auth/session.js";
import { cariRapat, daftarKeputusan } from "../pengetahuan.js";

/** Knowledge Management dasar: pencarian dan keputusan lintas rapat (aturan akses: lihat `src/pengetahuan.ts`). */
export const pengetahuanRoutes = new Hono<AuthEnv>()
  .use(requireAuth)
  .get("/cari", zValidator("query", z.object({ q: z.string().trim().min(2).max(100) })), async (c) =>
    c.json(await cariRapat(c.var.user, c.req.valid("query").q)),
  )
  .get("/keputusan", zValidator("query", z.object({ cari: z.string().trim().max(100).optional() })), async (c) =>
    c.json(await daftarKeputusan(c.var.user, c.req.valid("query").cari)),
  );
