import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { Card } from "@/components/ui/card";
import { formatTimer } from "@/lib/format";
import { cn } from "@/lib/utils";
import { usePemutar, useStatusPemutar } from "./pemutar";

type Segmen = { start: number; end: number; text: string };

/** Setelah pengguna menggulir sendiri, ikuti-otomatis ditahan selama ini. */
const JEDA_GULIR_MANUAL_MS = 6000;
/** Baris dianggap sudah terlihat nyaman bila berada di antara kepala/tab (atas) dan bilah pemutar (bawah). */
const MARGIN_ATAS_PX = 150;
const MARGIN_BAWAH_PX = 190;

/** Indeks segmen terakhir yang mulai pada/ sebelum `waktu`; -1 bila belum ada. Segmen diasumsikan urut waktu. */
function cariAktif(segmen: Segmen[], waktu: number): number {
  let lo = 0;
  let hi = segmen.length - 1;
  let hasil = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if ((segmen[mid]?.start ?? 0) <= waktu + 0.25) {
      hasil = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return hasil;
}

const Baris = memo(function Baris({
  indeks,
  segmen,
  aktif,
  bisaPutar,
  onPilih,
}: {
  indeks: number;
  segmen: Segmen;
  aktif: boolean;
  bisaPutar: boolean;
  onPilih: (detik: number) => void;
}) {
  const isi = (
    <>
      <span className="mt-0.5 w-[8ch] shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
        {formatTimer(segmen.start)}
      </span>
      <span className="min-w-0 flex-1 text-[15px] leading-relaxed">{segmen.text.trim()}</span>
    </>
  );
  const kelas = cn(
    "flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
    aktif && "bg-primary/10 ring-1 ring-primary/30",
  );
  return (
    <li data-baris={indeks}>
      {bisaPutar ? (
        <button
          type="button"
          aria-current={aktif ? "true" : undefined}
          aria-label={`Putar dari ${formatTimer(segmen.start)}: ${segmen.text.trim()}`}
          onClick={() => onPilih(segmen.start)}
          className={cn(kelas, "min-h-12 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring", aktif && "hover:bg-primary/15")}
        >
          {isi}
        </button>
      ) : (
        <div className={kelas}>{isi}</div>
      )}
    </li>
  );
});

/** Tab Transkrip ("karaoke"): ketuk baris untuk lompat dan putar; baris yang sedang diputar disorot dan diikuti. */
export function TabTranskrip({ rawText, segments }: { rawText: string; segments: Segmen[] | null }) {
  const { tersedia, seek } = usePemutar();
  const { waktu, memutar } = useStatusPemutar();
  const daftar = useRef<HTMLOListElement>(null);
  const gulirManualTerakhir = useRef(0);

  const baris = useMemo(() => (segments ?? []).filter((s) => s.text.trim() !== ""), [segments]);
  const aktif = memutar || waktu > 0 ? cariAktif(baris, waktu) : -1;

  // Hormati gerakan pengguna: gulir yang dipicu pengguna menghentikan ikuti-otomatis sementara.
  useEffect(() => {
    const tandai = () => {
      gulirManualTerakhir.current = Date.now();
    };
    window.addEventListener("wheel", tandai, { passive: true });
    window.addEventListener("touchmove", tandai, { passive: true });
    window.addEventListener("keydown", tandai);
    return () => {
      window.removeEventListener("wheel", tandai);
      window.removeEventListener("touchmove", tandai);
      window.removeEventListener("keydown", tandai);
    };
  }, []);

  useEffect(() => {
    if (!memutar || aktif < 0) return;
    if (Date.now() - gulirManualTerakhir.current < JEDA_GULIR_MANUAL_MS) return;
    const el = daftar.current?.querySelector(`[data-baris="${aktif}"]`);
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top >= MARGIN_ATAS_PX && r.bottom <= window.innerHeight - MARGIN_BAWAH_PX) return;
    const kurangiGerak = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "center", behavior: kurangiGerak ? "auto" : "smooth" });
  }, [aktif, memutar]);

  const pilih = useCallback(
    (detik: number) => {
      gulirManualTerakhir.current = 0; // mengetuk baris = pengguna ingin mengikuti pemutaran lagi
      seek(detik);
    },
    [seek],
  );

  if (baris.length === 0) {
    return (
      <Card className="p-4">
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{rawText.trim() || "Transkrip kosong."}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {tersedia && <p className="px-1 text-sm text-muted-foreground">Ketuk kalimat untuk memutar dari bagian itu.</p>}
      <Card className="p-2">
        <ol ref={daftar} className="space-y-0.5">
          {baris.map((s, i) => (
            <Baris key={i} indeks={i} segmen={s} aktif={i === aktif} bisaPutar={tersedia} onPilih={pilih} />
          ))}
        </ol>
      </Card>
    </div>
  );
}
