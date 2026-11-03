import { eq } from "drizzle-orm";
import { dekripsiTeks, enkripsiTeks } from "../auth/crypto.js";
import { db } from "../db/index.js";
import { userTokens, type User } from "../db/schema.js";
import { env } from "../env.js";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

export function urlOAuthDrive(state: string): string {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: `${env.API_URL}/auth/google/drive/callback`,
    response_type: "code",
    scope: DRIVE_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function tukarKodeDrive(kode: string, userId: number): Promise<void> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: kode,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${env.API_URL}/auth/google/drive/callback`,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gagal menukar kode Google Drive: ${errText}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
    scope: string;
  };

  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  const [ada] = await db.select().from(userTokens).where(eq(userTokens.userId, userId)).limit(1);

  if (ada) {
    await db
      .update(userTokens)
      .set({
        accessToken: enkripsiTeks(data.access_token),
        refreshToken: data.refresh_token ? enkripsiTeks(data.refresh_token) : ada.refreshToken,
        tokenType: data.token_type || "Bearer",
        scope: data.scope,
        expiresAt,
      })
      .where(eq(userTokens.userId, userId));
  } else {
    await db.insert(userTokens).values({
      userId,
      accessToken: enkripsiTeks(data.access_token),
      refreshToken: data.refresh_token ? enkripsiTeks(data.refresh_token) : null,
      tokenType: data.token_type || "Bearer",
      scope: data.scope,
      expiresAt,
    });
  }
}

export async function ambilValidAccessToken(userId: number): Promise<string | null> {
  const [tokenRecord] = await db.select().from(userTokens).where(eq(userTokens.userId, userId)).limit(1);
  if (!tokenRecord) return null;

  // Jika masih berlaku (dengan margin 2 menit), pakai langsung
  const sekarang = Date.now();
  if (tokenRecord.expiresAt.getTime() - sekarang > 2 * 60 * 1000) {
    return dekripsiTeks(tokenRecord.accessToken);
  }

  // Jika sudah kedaluwarsa, segarkan pakai refresh_token
  if (!tokenRecord.refreshToken) return null;
  const refreshToken = dekripsiTeks(tokenRecord.refreshToken);

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) return null;

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
    token_type: string;
  };

  const expiresAt = new Date(Date.now() + data.expires_in * 1000);
  const plainAccessToken = data.access_token;

  await db
    .update(userTokens)
    .set({
      accessToken: enkripsiTeks(plainAccessToken),
      expiresAt,
    })
    .where(eq(userTokens.userId, userId));

  return plainAccessToken;
}

export async function statusDriveUser(userId: number): Promise<boolean> {
  const [ada] = await db.select().from(userTokens).where(eq(userTokens.userId, userId)).limit(1);
  return Boolean(ada);
}

export async function putusDriveUser(userId: number): Promise<void> {
  await db.delete(userTokens).where(eq(userTokens.userId, userId));
}
