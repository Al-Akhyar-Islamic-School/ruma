import { PauseIcon, PlayIcon, RotateCcwIcon, RotateCwIcon } from "lucide-react";
import { createContext, type ReactNode, type SyntheticEvent, useCallback, useContext, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { API_URL } from "@/lib/api";
import { formatTimer } from "@/lib/format";

const LONCAT_DETIK = 15;

type AksiPemutar = {
  /** Ada audio yang bisa diputar. Bila false, penanda waktu ditampilkan sebagai teks biasa. */
  tersedia: boolean;
  /** Lompat ke detik tertentu; memutar kecuali `putar: false`. */
  seek: (detik: number, opsi?: { putar?: boolean }) => void;
  toggle: () => void;
  geser: (deltaDetik: number) => void;
};

type StatusPemutar = {
  waktu: number;
  durasi: number;
  memutar: boolean;
  galat: boolean;
};

// Dua konteks: aksi stabil (tidak memicu render ulang) dan status yang berubah ±4x per detik saat memutar.
const AksiContext = createContext<AksiPemutar | null>(null);
const StatusContext = createContext<StatusPemutar | null>(null);

/** Aksi pemutar bersama untuk seluruh halaman sesi. Aman dipakai di tab mana pun. */
export function usePemutar(): AksiPemutar {
  const v = useContext(AksiContext);
  if (!v) throw new Error("usePemutar harus dipakai di dalam PemutarProvider");
  return v;
}

/** Posisi dan keadaan pemutaran; render ulang setiap pembaruan waktu. */
export function useStatusPemutar(): StatusPemutar {
  const v = useContext(StatusContext);
  if (!v) throw new Error("useStatusPemutar harus dipakai di dalam PemutarProvider");
  return v;
}

/**
 * Memegang satu elemen `<audio>` untuk seluruh halaman. Elemen hanya dirender bila audio tersedia
 * (server baru mengisi berkas utuh setelah chunk disambung).
 */
export function PemutarProvider({
  uuid,
  audioTersedia,
  durasiDetik,
  children,
}: {
  uuid: string;
  audioTersedia: boolean;
  /** Durasi dari sesi; dipakai selama durasi elemen audio belum diketahui (mis. Infinity pada beberapa format). */
  durasiDetik: number;
  children: ReactNode;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [waktu, setWaktu] = useState(0);
  const [durasiAudio, setDurasiAudio] = useState(0);
  const [memutar, setMemutar] = useState(false);
  const [galat, setGalat] = useState(false);

  const putar = useCallback(() => {
    void audio.current?.play().catch((e: unknown) => {
      // AbortError: pemutaran dibatalkan oleh pause/seek berikutnya, bukan kegagalan.
      if (!(e instanceof DOMException && e.name === "AbortError")) setGalat(true);
    });
  }, []);

  const seek = useCallback(
    (detik: number, opsi?: { putar?: boolean }) => {
      const a = audio.current;
      if (!a) return;
      const maks = Number.isFinite(a.duration) ? a.duration : Number.POSITIVE_INFINITY;
      const tujuan = Math.min(Math.max(0, detik), maks);
      a.currentTime = tujuan;
      setWaktu(tujuan);
      if (opsi?.putar ?? true) putar();
    },
    [putar],
  );

  const toggle = useCallback(() => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) putar();
    else a.pause();
  }, [putar]);

  const geser = useCallback(
    (delta: number) => {
      const a = audio.current;
      if (a) seek(a.currentTime + delta, { putar: false });
    },
    [seek],
  );

  const bacaDurasi = (e: SyntheticEvent<HTMLAudioElement>) => {
    const d = e.currentTarget.duration;
    setDurasiAudio(Number.isFinite(d) ? d : 0);
  };

  const aksi = useMemo<AksiPemutar>(
    () => ({ tersedia: audioTersedia, seek, toggle, geser }),
    [audioTersedia, seek, toggle, geser],
  );
  const durasi = durasiAudio > 0 ? durasiAudio : durasiDetik;
  const status = useMemo<StatusPemutar>(
    () => ({ waktu, durasi, memutar, galat }),
    [waktu, durasi, memutar, galat],
  );

  return (
    <AksiContext.Provider value={aksi}>
      <StatusContext.Provider value={status}>
        {children}
        {audioTersedia && (
          <audio
            ref={audio}
            key={uuid}
            src={`${API_URL}/sesi/${uuid}/audio`}
            preload="metadata"
            onTimeUpdate={(e) => setWaktu(e.currentTarget.currentTime)}
            onLoadedMetadata={bacaDurasi}
            onDurationChange={bacaDurasi}
            onPlay={() => {
              setMemutar(true);
              setGalat(false);
            }}
            onPause={() => setMemutar(false)}
            onEnded={() => setMemutar(false)}
            onError={() => {
              setMemutar(false);
              setGalat(true);
            }}
          />
        )}
      </StatusContext.Provider>
    </AksiContext.Provider>
  );
}

/** Tinggi bilah pemutar (termasuk safe-area) yang harus disisakan di bawah konten halaman. */
export const RUANG_BILAH_PEMUTAR = "pb-40";

/** Bilah pemutar menempel di bawah layar (zona jempol). Tidak dirender bila audio belum tersedia. */
export function BilahPemutar() {
  const { tersedia, toggle, geser, seek } = usePemutar();
  const { waktu, durasi, memutar, galat } = useStatusPemutar();
  if (!tersedia) return null;
  const maks = Math.max(1, Math.floor(durasi));

  return (
    <div
      role="region"
      aria-label="Pemutar audio rekaman"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur"
    >
      <div className="mx-auto max-w-3xl px-4 pt-1">
        {galat && (
          <p role="alert" className="pt-1 text-center text-xs text-destructive">
            Audio tidak bisa diputar. Muat ulang halaman, atau coba lagi nanti.
          </p>
        )}
        <div className="flex items-center gap-2">
          <span className="w-[8ch] shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
            {formatTimer(waktu)}
          </span>
          <input
            type="range"
            aria-label="Posisi pemutaran"
            aria-valuetext={`${formatTimer(waktu)} dari ${formatTimer(durasi)}`}
            className="h-12 min-w-0 flex-1 cursor-pointer accent-primary disabled:cursor-not-allowed"
            min={0}
            max={maks}
            step={1}
            value={Math.min(Math.floor(waktu), maks)}
            disabled={durasi <= 0}
            onChange={(e) => seek(Number(e.currentTarget.value), { putar: false })}
          />
          <span className="w-[8ch] shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
            {formatTimer(durasi)}
          </span>
        </div>
        <div className="flex items-center justify-center gap-4 pb-1">
          <Button variant="ghost" size="icon" aria-label={`Mundur ${LONCAT_DETIK} detik`} className="relative" onClick={() => geser(-LONCAT_DETIK)}>
            <RotateCcwIcon />
            <span aria-hidden className="absolute font-mono text-[9px] font-bold">{LONCAT_DETIK}</span>
          </Button>
          <Button
            size="icon"
            className="rounded-full"
            aria-label={memutar ? "Jeda" : "Putar"}
            onClick={toggle}
          >
            {memutar ? <PauseIcon /> : <PlayIcon />}
          </Button>
          <Button variant="ghost" size="icon" aria-label={`Maju ${LONCAT_DETIK} detik`} className="relative" onClick={() => geser(LONCAT_DETIK)}>
            <RotateCwIcon />
            <span aria-hidden className="absolute font-mono text-[9px] font-bold">{LONCAT_DETIK}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
