import { SearchIcon, XIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Jeda setelah berhenti mengetik sebelum pencarian dijalankan. */
const JEDA_KETIK_MS = 400;

/**
 * Kotak cari besar: `onKomit` dipanggil dengan teks yang sudah dipangkas setelah jeda ketik, saat Enter, dan saat
 * dihapus. Tidak dipanggil ulang bila nilainya sama dengan komit terakhir. Nilai awal biasanya dari parameter URL.
 */
export function KotakCari({
  label,
  placeholder,
  nilaiAwal,
  petunjuk,
  onKomit,
}: {
  label: string;
  placeholder: string;
  nilaiAwal: string;
  petunjuk?: string;
  onKomit: (nilai: string) => void;
}) {
  const id = useId();
  const [teks, setTeks] = useState(nilaiAwal);
  const [tunda, setTunda] = useState(nilaiAwal);
  const komitTerakhir = useRef(nilaiAwal.trim());
  const callback = useRef(onKomit);
  useEffect(() => {
    callback.current = onKomit;
  });

  useEffect(() => {
    const t = setTimeout(() => setTunda(teks), JEDA_KETIK_MS);
    return () => clearTimeout(t);
  }, [teks]);

  const komit = (nilai: string) => {
    const bersih = nilai.trim();
    if (bersih === komitTerakhir.current) return;
    komitTerakhir.current = bersih;
    callback.current(bersih);
  };

  // Hanya bereaksi pada perubahan `tunda`: `komit` tidak boleh dipanggil ulang dengan nilai lama saat render ulang.
  useEffect(() => {
    komit(tunda);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tunda]);

  return (
    <form
      role="search"
      className="space-y-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        komit(teks);
      }}
    >
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          id={id}
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          maxLength={100}
          value={teks}
          placeholder={placeholder}
          onChange={(e) => setTeks(e.currentTarget.value)}
          className="h-12 rounded-2xl pr-12 pl-11 text-base [&::-webkit-search-cancel-button]:hidden"
        />
        {teks !== "" && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Hapus kata kunci"
            className="absolute top-1/2 right-1 -translate-y-1/2"
            onClick={() => {
              setTeks("");
              setTunda("");
              komit("");
            }}
          >
            <XIcon />
          </Button>
        )}
      </div>
      {petunjuk && <p className="text-xs text-muted-foreground">{petunjuk}</p>}
    </form>
  );
}
