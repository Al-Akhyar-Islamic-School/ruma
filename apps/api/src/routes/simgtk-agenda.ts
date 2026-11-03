import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { requireAuth, type AuthEnv } from "../auth/session.js";
import {
  ambilAgendaRapatSimgtk,
  ambilDetailAgendaSimgtk,
  kirimNotulenKeSimgtk,
} from "../integrasi/simgtk-agenda.js";

const queryCari = z.object({
  idOrUrl: z.string().trim().min(1).optional(),
});

export const simgtkAgendaRoutes = new Hono<AuthEnv>()
  .use(requireAuth)
  // Ambil daftar rapat hari ini untuk user yang login
  .get("/", async (c) => {
    const list = await ambilAgendaRapatSimgtk(c.var.user.email);
    return c.json(list);
  })
  // Ambil detail agenda dari ID atau tempel URL
  .get("/detail", zValidator("query", queryCari), async (c) => {
    const { idOrUrl } = c.req.valid("query");
    if (!idOrUrl) return c.json({ error: "id_atau_url_wajib" }, 400);

    const agenda = await ambilDetailAgendaSimgtk(idOrUrl, c.var.user.email);
    if (!agenda) {
      return c.json({ error: "agenda_tidak_ditemukan_atau_tidak_berhak" }, 404);
    }
    return c.json(agenda);
  });
