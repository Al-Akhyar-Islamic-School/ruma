import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";
import { env } from "../env.js";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export const redirectUri = `${env.API_URL}/auth/google/callback`;

export function buildAuthUrl(p: { state: string; nonce: string; codeChallenge: string }) {
  const u = new URL(AUTH_URL);
  u.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: p.state,
    nonce: p.nonce,
    code_challenge: p.codeChallenge,
    code_challenge_method: "S256",
    // Hanya hint UI ("*" bila beberapa domain); validasi sebenarnya di verifyIdToken.
    hd: env.GOOGLE_HD.length === 1 ? env.GOOGLE_HD[0]! : "*",
    prompt: "select_account",
  }).toString();
  return u.toString();
}

const tokenResponse = z.object({ id_token: z.string() });

const claims = z.object({
  sub: z.string(),
  email: z.email(),
  email_verified: z.boolean(),
  hd: z.string().optional(),
  name: z.string().default(""),
  picture: z.url().optional(),
  nonce: z.string().optional(),
});
export type GoogleProfile = z.infer<typeof claims>;

export class LoginRejected extends Error {}

export async function exchangeCode(code: string, codeVerifier: string): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    }),
  });
  if (!res.ok) throw new Error(`Token exchange gagal: HTTP ${res.status}`);
  return tokenResponse.parse(await res.json()).id_token;
}

/** Verifikasi tanda tangan, iss, aud, exp, nonce, email_verified, dan domain Workspace (`hd`). */
export async function verifyIdToken(idToken: string, expectedNonce: string): Promise<GoogleProfile> {
  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: env.GOOGLE_CLIENT_ID,
  });
  const c = claims.parse(payload);
  if (c.nonce !== expectedNonce) throw new LoginRejected("nonce tidak cocok");
  if (!c.email_verified) throw new LoginRejected("email belum terverifikasi");
  // `hd` hanya ada untuk akun Workspace; akun gmail.com tidak punya klaim ini.
  if (!c.hd || !env.GOOGLE_HD.includes(c.hd.toLowerCase())) {
    throw new LoginRejected("akun bukan bagian dari domain Workspace yang diizinkan");
  }
  return { ...c, name: c.name || c.email };
}
