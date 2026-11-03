import { useQuery } from "@tanstack/react-query";
import { ChevronsUpDownIcon, LoaderCircleIcon, XIcon } from "lucide-react";
import { type ReactNode, useEffect, useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api, ok, pesanGalat } from "@/lib/api";

export type OrangGtk = { email: string; namaResmi: string; units: ("TK" | "SD" | "SMP" | "SMA")[] };

const MIN_HURUF = 2;
const JEDA_KETIK_MS = 250;

function useDebounced<T>(nilai: T, ms: number): T {
  const [tunda, setTunda] = useState(nilai);
  useEffect(() => {
    const t = setTimeout(() => setTunda(nilai), ms);
    return () => clearTimeout(t);
  }, [nilai, ms]);
  return tunda;
}

function Pesan({ children }: { children: ReactNode }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 px-3 py-6 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

/**
 * Pemilih satu orang dari direktori GTK (hasil sinkron SIM-GTK). Pencarian dilakukan di server
 * setelah minimal 2 huruf dan jeda ketik singkat; daftar tidak difilter ulang di klien.
 */
export function PilihOrang({
  value,
  onChange,
  label,
  placeholder = "Cari nama atau email",
  id,
}: {
  value: OrangGtk | null;
  onChange: (o: OrangGtk | null) => void;
  label: string;
  placeholder?: string;
  id?: string;
}) {
  const idOtomatis = useId();
  const idTombol = id ?? idOtomatis;
  const [terbuka, setTerbuka] = useState(false);
  const [ketik, setKetik] = useState("");
  const kata = ketik.trim();
  const cari = useDebounced(kata, JEDA_KETIK_MS);

  const hasil = useQuery({
    queryKey: ["gtk", cari],
    queryFn: async () => ok(await api.gtk.$get({ query: { cari } })),
    enabled: terbuka && cari.length >= MIN_HURUF,
    staleTime: 10 * 60_000,
  });

  const ubahBuka = (b: boolean) => {
    setTerbuka(b);
    if (!b) setKetik("");
  };

  const pilih = (o: OrangGtk) => {
    onChange(o);
    ubahBuka(false);
  };

  let isi: ReactNode;
  if (kata.length < MIN_HURUF) {
    isi = <Pesan>Ketik minimal {MIN_HURUF} huruf nama atau email.</Pesan>;
  } else if (cari !== kata || hasil.isPending) {
    isi = (
      <Pesan>
        <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
        Mencari…
      </Pesan>
    );
  } else if (hasil.isError) {
    isi = (
      <div role="alert" className="flex flex-col items-center gap-3 px-3 py-5 text-center text-sm">
        <p className="text-destructive">{pesanGalat(hasil.error)}</p>
        <Button type="button" size="sm" variant="outline" onClick={() => void hasil.refetch()}>
          Coba lagi
        </Button>
      </div>
    );
  } else if (hasil.data.length === 0) {
    isi = <Pesan>Tidak ada GTK dengan nama itu. Direktori diambil dari SIM-GTK.</Pesan>;
  } else {
    isi = hasil.data.map((o) => (
      <CommandItem
        key={o.email}
        value={o.email}
        onSelect={() => pilih(o)}
        // Varian data-selected bawaan cocok untuk atribut "false" dari cmdk; batasi ke item yang benar-benar aktif.
        className="min-h-12 gap-3 data-[selected=false]:bg-transparent!"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{o.namaResmi}</p>
          <p className="truncate text-xs text-muted-foreground">{o.email}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          {o.units.map((u) => (
            <Badge key={u} variant="secondary">
              {u}
            </Badge>
          ))}
        </div>
      </CommandItem>
    ));
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={idTombol}>{label}</Label>
      <div className="flex gap-2">
        <Popover open={terbuka} onOpenChange={ubahBuka} modal>
          <PopoverTrigger asChild>
            <Button
              id={idTombol}
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={terbuka}
              className="h-12 min-w-0 flex-1 justify-between gap-2 py-1 font-normal"
            >
              {value ? (
                <span className="min-w-0 text-left">
                  <span className="block truncate text-sm font-semibold">{value.namaResmi}</span>
                  <span className="block truncate text-xs text-muted-foreground">{value.email}</span>
                </span>
              ) : (
                <span className="truncate text-muted-foreground">{placeholder}</span>
              )}
              <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" aria-hidden />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-72 gap-0 p-0">
            <Command shouldFilter={false} loop className="rounded-lg!">
              <CommandInput value={ketik} onValueChange={setKetik} placeholder="Ketik nama atau email" aria-label={label} />
              <CommandList className="mt-1">{isi}</CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {value && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={`Hapus pilihan ${value.namaResmi}`}
            onClick={() => onChange(null)}
          >
            <XIcon aria-hidden />
          </Button>
        )}
      </div>
    </div>
  );
}
