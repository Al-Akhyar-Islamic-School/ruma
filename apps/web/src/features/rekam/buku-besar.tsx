import { TriangleAlertIcon, WifiIcon, WifiOffIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { HitunganPotongan, StatusPotongan } from "./unggah";

type Sel = "direkam" | StatusPotongan;

const WARNA_SEL: Record<Sel, string> = {
  direkam: "bg-rose-500",
  tersimpan: "bg-sky-500",
  terunggah: "bg-emerald-500",
  gagal: "bg-amber-500",
};

const LEGENDA: { sel: Sel; label: string }[] = [
  { sel: "direkam", label: "Direkam" },
  { sel: "tersimpan", label: "Di perangkat" },
  { sel: "terunggah", label: "Terunggah" },
  { sel: "gagal", label: "Menunggu ulang" },
];

/**
 * "Buku besar potongan": satu sel per potongan 30 detik dengan keadaan jujur
 * (direkam → tersimpan di perangkat → terunggah, atau menunggu ulang bila gagal), supaya perekam tahu data tidak hilang.
 */
export function BukuBesar({
  potongan,
  hitungan,
  sedangRekam,
  berdenyut,
  online,
  penyimpananBermasalah,
}: {
  potongan: ReadonlyMap<number, StatusPotongan>;
  hitungan: HitunganPotongan;
  /** Ada potongan yang sedang direkam (sel terakhir). */
  sedangRekam: boolean;
  /** Sel yang direkam berdenyut hanya saat benar-benar merekam, bukan saat dijeda. */
  berdenyut: boolean;
  online: boolean;
  penyimpananBermasalah: boolean;
}) {
  const gulir = useRef<HTMLDivElement>(null);
  let jumlahSel = 0;
  for (const seq of potongan.keys()) jumlahSel = Math.max(jumlahSel, seq + 1);
  const total = jumlahSel + (sedangRekam ? 1 : 0);

  useEffect(() => {
    const el = gulir.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [total]);

  const ringkasan =
    hitungan.tersimpan === 0
      ? "Potongan pertama tersimpan setelah ±30 detik."
      : `${hitungan.tersimpan} potongan tersimpan · ${hitungan.terunggah} terunggah${hitungan.gagal > 0 ? ` · ${hitungan.gagal} menunggu kirim ulang` : ""}`;

  return (
    <section aria-label="Buku besar potongan rekaman" className="space-y-2.5 rounded-2xl bg-slate-900 p-3.5 ring-1 ring-slate-800">
      <div ref={gulir} className="flex max-h-[4.25rem] min-h-3 flex-wrap content-start gap-1 overflow-y-auto" aria-hidden>
        {Array.from({ length: jumlahSel }, (_, seq) => {
          const status: Sel = potongan.get(seq) ?? "tersimpan";
          return <span key={seq} title={`Potongan ${seq + 1}`} className={cn("size-3 rounded-[4px]", WARNA_SEL[status])} />;
        })}
        {sedangRekam && <span title={`Potongan ${jumlahSel + 1} sedang direkam`} className={cn("size-3 rounded-[4px]", WARNA_SEL.direkam, berdenyut && "animate-pulse")} />}
      </div>

      <p aria-live="polite" className="text-sm text-slate-200">
        {ringkasan}
      </p>

      {penyimpananBermasalah && (
        <p className="flex items-start gap-1.5 text-xs text-amber-300">
          <TriangleAlertIcon className="mt-px size-3.5 shrink-0" aria-hidden />
          Penyimpanan perangkat bermasalah. Potongan dikirim langsung ke server; jangan tutup halaman ini.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
          {LEGENDA.map((l) => (
            <li key={l.sel} className="flex items-center gap-1">
              <span className={cn("size-2 rounded-[3px]", WARNA_SEL[l.sel])} aria-hidden />
              {l.label}
            </li>
          ))}
        </ul>
        <p aria-live="polite" className={cn("flex items-center gap-1 text-xs font-medium", online ? "text-emerald-400" : "text-amber-300")}>
          {online ? <WifiIcon className="size-3.5" aria-hidden /> : <WifiOffIcon className="size-3.5" aria-hidden />}
          {online ? "Online" : "Offline: potongan ditahan di perangkat"}
        </p>
      </div>
    </section>
  );
}
