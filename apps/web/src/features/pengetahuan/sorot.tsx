import { Fragment } from "react";

const MIN_HURUF_KATA = 2;

/** Kata kunci dari `q`: dipisah spasi, minimal 2 huruf, tanpa duplikat (huruf besar/kecil diabaikan). */
export function pecahKata(q: string): string[] {
  return [...new Set(q.toLowerCase().split(/\s+/).filter((k) => k.length >= MIN_HURUF_KATA))];
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Menyorot kata kunci dengan `<mark>`; teks dirender sebagai teks biasa (tanpa HTML mentah). */
export function Sorot({ teks, kata }: { teks: string; kata: string[] }) {
  if (kata.length === 0) return <>{teks}</>;
  // Kata terpanjang lebih dulu agar "rapat" tidak memotong "rapat koordinasi" bila keduanya kata kunci.
  const pola = new RegExp(`(${[...kata].sort((a, b) => b.length - a.length).map(escapeRegex).join("|")})`, "gi");
  // `split` dengan grup penangkap: indeks ganjil adalah potongan yang cocok.
  return (
    <>
      {teks.split(pola).map((p, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded-sm bg-warning/30 px-0.5 text-foreground">
            {p}
          </mark>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}
