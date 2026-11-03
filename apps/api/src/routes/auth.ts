import { createHash, randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { buildAuthUrl, exchangeCode, LoginRejected, verifyIdToken } from "../auth/google.js";
import { createSession, destroySession, requireAuth } from "../auth/session.js";
import { db } from "../db/index.js";
import { gtk, gtkUnit, users } from "../db/schema.js";
import { env, isProd } from "../env.js";
import { bisaBuatSesiLangsung, MODERATOR } from "../permissions.js";
import { modulSupervisiAktif } from "../pengaturan.js";

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
    const state = rand();
    const nonce = rand();
    const verifier = rand();
    txCookie(c, "oauth_state", state);
    txCookie(c, "oauth_nonce", nonce);
    txCookie(c, "oauth_verifier", verifier);
    const codeChallenge = createHash("sha256").update(verifier).digest("base64url");
    return c.redirect(buildAuthUrl({ state, nonce, codeChallenge }));
  })
  .get("/google/callback", async (c) => {
    const state = getCookie(c, "oauth_state");
    const nonce = getCookie(c, "oauth_nonce");
    const verifier = getCookie(c, "oauth_verifier");
    for (const n of ["oauth_state", "oauth_nonce", "oauth_verifier"]) {
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
      await createSession(c, user.id);
      return c.redirect(env.APP_URL);
    } catch (e) {
      if (e instanceof LoginRejected) return c.redirect(loginError("domain_tidak_diizinkan"));
      console.error("login google gagal", e);
      return c.redirect(loginError("gagal"));
    }
  })
  .post("/logout", async (c) => {
    await destroySession(c);
    return c.json({ ok: true });
  })
  .get("/me", requireAuth, async (c) => {
    const { id, email, name, picture, role } = c.var.user;
    // Nama resmi dan unit dari direktori SIM-GTK (kosong bila email belum ada di SIM-GTK / belum disinkronkan).
    const e = email.toLowerCase();
    const [resmi, units, supervisi] = await Promise.all([
      db.query.gtk.findFirst({ where: eq(gtk.email, e) }),
      db.select({ unit: gtkUnit.unit }).from(gtkUnit).where(eq(gtkUnit.email, e)),
      modulSupervisiAktif(),
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
    });
  });
