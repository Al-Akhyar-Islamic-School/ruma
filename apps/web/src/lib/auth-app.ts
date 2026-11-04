import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { API_URL, api, ok } from "./api";

const KUNCI_VERIFIER = "ruma_pkce_verifier";

export function isAppNative(): boolean {
  return Capacitor.isNativePlatform();
}

function buatVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ("0" + b.toString(16)).slice(-2)).join("");
}

async function buatChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const base64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Membuka browser sistem (Custom Tabs) untuk alur login Google OAuth di aplikasi native (Android/iOS).
 * Google menolak login langsung di dalam WebView (disallowed_useragent).
 */
export async function mulaiLoginNative(): Promise<void> {
  const verifier = buatVerifier();
  const challenge = await buatChallenge(verifier);
  localStorage.setItem(KUNCI_VERIFIER, verifier);

  const authUrl = `${API_URL}/auth/google?app=1&c=${encodeURIComponent(challenge)}`;
  await Browser.open({ url: authUrl, windowName: "_system" });
}

/**
 * Memasang pendengar deep link `sch.alakhyar.ruma://masuk?kode=...` pada aplikasi native.
 * Saat deep link terpanggil, kode ditukar dengan sesi via endpoint /auth/aplikasi/tukar.
 */
export function pasangPendengarDeepLink(
  queryClient: QueryClient,
  onSukses: () => void
): () => void {
  if (!isAppNative()) return () => undefined;

  const handle = App.addListener("appUrlOpen", async (event) => {
    try {
      const url = new URL(event.url);
      if (url.protocol === "sch.alakhyar.ruma:" && url.host === "masuk") {
        const kode = url.searchParams.get("kode");
        const verifier = localStorage.getItem(KUNCI_VERIFIER);

        if (!kode || !verifier) {
          toast.error("Data login aplikasi tidak lengkap. Coba login kembali.");
          return;
        }

        // Tutup browser sistem setelah deep link kembali ke aplikasi
        await Browser.close().catch(() => undefined);

        // Tukar kode dengan sesi
        const res = await ok(
          await api.auth.aplikasi.tukar.$post({
            json: { kode, verifier },
          })
        );

        localStorage.removeItem(KUNCI_VERIFIER);
        toast.success(`Selamat datang, ${res.user.name}!`);

        // Muat ulang cache pengguna dan arahkan ke beranda
        await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
        onSukses();
      }
    } catch (err) {
      console.error("Gagal memproses deep link login:", err);
      toast.error("Gagal menyelesaikan login aplikasi. Coba lagi.");
    }
  });

  return () => {
    void handle.then((h) => h.remove());
  };
}
