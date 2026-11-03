import { useEffect, useState } from "react";

/**
 * Menjaga layar tetap menyala selama `aktif`. Kunci dilepas peramban saat tab disembunyikan, jadi dipasang ulang
 * ketika tab kembali terlihat. Mengembalikan `true` hanya bila kunci benar-benar sedang dipegang.
 */
export function useWakeLock(aktif: boolean): boolean {
  const [menyala, setMenyala] = useState(false);

  useEffect(() => {
    if (!aktif || !("wakeLock" in navigator)) return;
    let batal = false;
    const pegang: { kunci: WakeLockSentinel | null } = { kunci: null };

    const minta = async () => {
      try {
        const kunci = await navigator.wakeLock.request("screen");
        if (batal) {
          void kunci.release();
          return;
        }
        pegang.kunci = kunci;
        setMenyala(true);
        kunci.addEventListener("release", () => {
          if (pegang.kunci === kunci) {
            pegang.kunci = null;
            if (!batal) setMenyala(false);
          }
        });
      } catch {
        if (!batal) setMenyala(false);
      }
    };

    const saatTerlihat = () => {
      if (document.visibilityState === "visible" && !pegang.kunci) void minta();
    };

    void minta();
    document.addEventListener("visibilitychange", saatTerlihat);
    return () => {
      batal = true;
      document.removeEventListener("visibilitychange", saatTerlihat);
      void pegang.kunci?.release();
      setMenyala(false);
    };
  }, [aktif]);

  return aktif && menyala;
}
