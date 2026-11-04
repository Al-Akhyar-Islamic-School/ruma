import { createHash, randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { buildAuthUrl, exchangeCode, LoginRejected, verifyIdToken } from "../auth/google.js";
import { createSession, destroySession, requireAuth } from "../auth/session.js";
import { db } from "../db/index.js";
import { gtk, gtkUnit, kodeAplikasi, users } from "../db/schema.js";
import { env, isProd } from "../env.js";
import { bisaBuatSesiLangsung, MODERATOR } from "../permissions.js";
import { modulSupervisiAktif } from "../pengaturan.js";

import { putusDriveUser, statusDriveUser, tukarKodeDrive, urlOAuthDrive } from "../integrasi/google-auth.js";
const TX_PATH = "/auth/google";
const rand = () => randomBytes(32).toString("base64url");

const txCookie = (c: Parameters<typeof setCookie>[0], name: string, value: string) =>
  setCookie(c, name, value, {
    httpOnly: true,
    secure: isProd,
    sameSite: "Lax", // callback adalah navigasi top-level dari accounts.google.com
    path: TX_PATH,
    maxAge: 600,
  });

const loginError = (reason: string) => `${env.APP_URL}/login?error=${encodeURIComponent(reason)}`;

export const auth = new Hono()
  .get("/google", (c) => {
    const { app, c: appChallenge } = c.req.query();
    const state = rand();
    const nonce = rand();
    const verifier = rand();
    txCookie(c, "oauth_state", state);
    txCookie(c, "oauth_nonce", nonce);
    txCookie(c, "oauth_verifier", verifier);
    if (app === "1" && appChallenge) {
      txCookie(c, "oauth_is_app", "1");
      txCookie(c, "oauth_app_challenge", appChallenge);
    }
    const codeChallenge = createHash("sha256").update(verifier).digest("base64url");
    return c.redirect(buildAuthUrl({ state, nonce, codeChallenge }));
  })
  .get("/google/callback", async (c) => {
    const state = getCookie(c, "oauth_state");
    const nonce = getCookie(c, "oauth_nonce");
    const verifier = getCookie(c, "oauth_verifier");
    const isApp = getCookie(c, "oauth_is_app") === "1";
    const appChallenge = getCookie(c, "oauth_app_challenge");
    for (const n of ["oauth_state", "oauth_nonce", "oauth_verifier", "oauth_is_app", "oauth_app_challenge"]) {
      deleteCookie(c, n, { path: TX_PATH });
    }
    const { code, state: returnedState, error } = c.req.query();
    if (error) return c.redirect(loginError("dibatalkan"));
    if (!code || !state || !nonce || !verifier || returnedState !== state) {
      return c.redirect(loginError("sesi_login_tidak_valid"));
    }

    try {
      const profile = await verifyIdToken(await exchangeCode(code, verifier), nonce);
      const superadmin = env.SUPERADMIN_EMAILS.includes(profile.email.toLowerCase());
      const demote = { role: sql`IF(${users.role} = 'superadmin', 'guru', ${users.role})` };
      await db
        .insert(users)
        .values({
          googleSub: profile.sub,
          email: profile.email,
          name: profile.name,
          picture: profile.picture,
          ...(superadmin ? { role: "superadmin" as const } : {}),
        })
        .onDuplicateKeyUpdate({
          set: {
            email: profile.email,
            name: profile.name,
            picture: profile.picture ?? null,
            lastLoginAt: sql`CURRENT_TIMESTAMP`,
            // Daftar env adalah sumber kebenaran untuk superadmin: dicabut dari env = diturunkan ke guru.
            ...(superadmin ? { role: "superadmin" as const } : demote),
          },
        });
      const user = await db.query.users.findFirst({
        where: (u, { eq }) => eq(u.googleSub, profile.sub),
      });
      if (!user) throw new Error("user hilang setelah upsert");
      if (isApp && appChallenge) {
        const kode = randomBytes(32).toString("base64url");
        const codeHash = createHash("sha256").update(kode).digest("hex");
        await db.insert(kodeAplikasi).values({
          codeHash,
          challenge: appChallenge,
          userId: user.id,
          expiresAt: new Date(Date.now() + 2 * 60 * 1000), // TTL 2 menit
        });
        const deepLink = `${env.APP_SCHEME}://masuk?kode=${encodeURIComponent(kode)}`;
        return c.html(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Masuk ke ruma.</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f7f9f7; color: #153e35; text-align: center; padding: 24px; box-sizing: border-box; }
    .card { background: white; border-radius: 20px; padding: 36px 28px; max-width: 380px; width: 100%; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); border: 1px solid #e5e7eb; }
    .btn { display: block; background: #153e35; color: white; padding: 14px 24px; border-radius: 9999px; text-decoration: none; font-weight: 600; font-size: 15px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="card">
    <h2 style="margin: 0 0 8px; font-size: 20px;">Login Berhasil</h2>
    <p style="color: #64748b; font-size: 14px; margin: 0 0 16px; line-height: 1.5;">Sedang mengalihkan kembali ke aplikasi ruma.…</p>
    <a class="btn" href="${deepLink}">Buka Aplikasi ruma.</a>
  </div>
  <script>
    window.location.href = ${JSON.stringify(deepLink)};
  </script>
</body>
</html>`);
      }

      await createSession(c, user.id);
      return c.redirect(env.APP_URL);
    } catch (e) {
      if (e instanceof LoginRejected) return c.redirect(loginError("domain_tidak_diizinkan"));
      console.error("login google gagal", e);
      return c.redirect(loginError("gagal"));
    }
  })
  .post(
    "/aplikasi/tukar",
    zValidator(
      "json",
      z.object({
        kode: z.string().min(1),
        verifier: z.string().min(1),
      })
    ),
    async (c) => {
      const { kode, verifier } = c.req.valid("json");
      const codeHash = createHash("sha256").update(kode).digest("hex");

      const [row] = await db
        .select()
        .from(kodeAplikasi)
        .where(eq(kodeAplikasi.codeHash, codeHash))
        .limit(1);

      if (!row) {
        return c.json({ error: "kode_tidak_valid" }, 400);
      }

      // Hapus kode sekali pakai sebelum memeriksa verifier (cegah brute-force/replay attack)
      await db.delete(kodeAplikasi).where(eq(kodeAplikasi.id, row.id));

      if (row.expiresAt.getTime() < Date.now()) {
        return c.json({ error: "kode_kedaluwarsa" }, 400);
      }

      const expectedChallenge = createHash("sha256").update(verifier).digest("base64url");
      if (expectedChallenge !== row.challenge) {
        return c.json({ error: "verifier_tidak_cocok" }, 400);
      }

      await createSession(c, row.userId);
      const [user] = await db.select().from(users).where(eq(users.id, row.userId)).limit(1);
      if (!user) {
        return c.json({ error: "user_tidak_ditemukan" }, 404);
      }
      return c.json({
        ok: true,
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
      });
    }
  )
  .post("/logout", async (c) => {
    await destroySession(c);
    return c.json({ ok: true });
  })
  .get("/me", requireAuth, async (c) => {
    const { id, email, name, picture, role } = c.var.user;
    const e = email.toLowerCase();
    // Nama resmi dan unit dari direktori SIM-GTK (kosong bila email belum ada di SIM-GTK / belum disinkronkan).
    const [resmi, units, supervisi, driveTersambung] = await Promise.all([
      db.query.gtk.findFirst({ where: eq(gtk.email, e) }),
      db.select({ unit: gtkUnit.unit }).from(gtkUnit).where(eq(gtkUnit.email, e)),
      modulSupervisiAktif(),
      statusDriveUser(id),
    ]);
    return c.json({
      id,
      email,
      name,
      picture,
      role,
      namaResmi: resmi?.namaResmi ?? null,
      units: units.map((u) => u.unit),
      // Dihitung di server supaya UI tidak menduplikasi aturan izin.
      bisaBuatSesiLangsung: bisaBuatSesiLangsung(c.var.user),
      moderator: MODERATOR.includes(role),
      // Saklar modul (superadmin yang mengubah). UI menyembunyikan fitur modul yang mati; server tetap menegakkan.
      modul: { supervisi },
      driveTersambung,
    });
  })
  // Sambungkan Google Drive (izin baca-tulis berkas ruma.)
  .get("/google/drive", requireAuth, (c) => {
    const state = c.req.query("state") || "";
    return c.redirect(urlOAuthDrive(state));
  })
  .get("/google/drive/callback", requireAuth, async (c) => {
    const { code, state, error } = c.req.query();
    if (error || !code) {
      return c.redirect(`${env.APP_URL}?error=drive_dibatalkan`);
    }
    try {
      await tukarKodeDrive(code, c.var.user.id);
      // Jika state membawa ID sesi (misal sesi_uuid), redirect ke sesi itu
      if (state && state.startsWith("sesi_")) {
        const uuid = state.slice(5);
        return c.redirect(`${env.APP_URL}/sesi/${uuid}?drive=tersambung`);
      }
      return c.redirect(`${env.APP_URL}?drive=tersambung`);
    } catch (e) {
      return c.redirect(`${env.APP_URL}?error=drive_gagal`);
    }
  })
  .delete("/google/drive", requireAuth, async (c) => {
    await putusDriveUser(c.var.user.id);
    return c.json({ ok: true });
  });
