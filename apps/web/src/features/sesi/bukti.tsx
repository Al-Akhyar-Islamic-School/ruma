import { usePemutar } from "./pemutar";
import { potongPenandaWaktu } from "./payload";

/**
 * Teks dari AI dengan penanda waktu `[HH:MM:SS]` yang menjadi tombol kecil: ketuk untuk melompatkan pemutar
 * ke detik itu. Tanpa audio, penanda tampil sebagai teks biasa.
 */
export function TeksBukti({ teks }: { teks: string }) {
  const { tersedia, seek } = usePemutar();
  return (
    <>
      {potongPenandaWaktu(teks).map((p, i) => {
        if (p.jenis === "teks") return <span key={i}>{p.isi}</span>;
        if (!tersedia) {
          return (
            <span key={i} className="font-mono text-xs tabular-nums text-muted-foreground">
              [{p.label}]
            </span>
          );
        }
        return (
          <button
            key={i}
            type="button"
            onClick={() => seek(p.detik)}
            aria-label={`Putar dari ${p.label}`}
            className="relative mx-0.5 inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 align-baseline font-mono text-xs font-medium tabular-nums text-primary after:absolute after:-inset-x-1 after:-inset-y-2 hover:bg-primary/20 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
          >
            {p.label}
          </button>
        );
      })}
    </>
  );
}

/** Daftar kutipan bukti transkrip (tiap butir bisa memuat penanda waktu). */
export function DaftarBukti({ bukti }: { bukti: string[] }) {
  if (bukti.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bukti transkrip</p>
      <ul className="space-y-2">
        {bukti.map((b, i) => (
          <li key={i} className="border-l-2 border-primary/40 pl-3 text-sm leading-relaxed text-foreground/90">
            <TeksBukti teks={b} />
          </li>
        ))}
      </ul>
    </div>
  );
}
