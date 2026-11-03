import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Context } from "hono";
import { db } from "../db/index.js";
import { sessions, users, type Role, type User } from "../db/schema.js";
import { isProd } from "../env.js";

export const SESSION_COOKIE = "ruma_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(c: Context, userId: number) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({ id: hash(token), userId, expiresAt });
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "Lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(c: Context) {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) await db.delete(sessions).where(eq(sessions.id, hash(token)));
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}

export async function purgeExpiredSessions() {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

export type AuthEnv = { Variables: { user: User } };

export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return c.json({ error: "unauthenticated" }, 401);
  const [row] = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, hash(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (!row) return c.json({ error: "unauthenticated" }, 401);
  c.set("user", row.user);
  await next();
});

export const requireRole = (...roles: Role[]) =>
  createMiddleware<AuthEnv>(async (c, next) => {
    if (!roles.includes(c.var.user.role)) return c.json({ error: "forbidden" }, 403);
    await next();
  });
