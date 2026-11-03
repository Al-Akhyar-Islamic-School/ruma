import { PlusIcon, XIcon } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PilihOrang } from "./pilih-orang";
import { type Anggota, normalisasiEmail, POLA_EMAIL, tambahAnggota } from "./util";

/** Input email manual (untuk orang yang tidak ada di direktori GTK) dengan validasi format. */
function EmailManual({ onTambah, disabled }: { onTambah: (email: string) => boolean; disabled: boolean }) {
  const id = useId();
  const idGalat = `${id}-galat`;
  const [teks, setTeks] = useState("");
  const [galat, setGalat] = useState<string | null>(null);

  const kirim = (e: FormEvent) => {
    e.preventDefault();
    const email = normalisasiEmail(teks);
    if (email === "") {
      setGalat("Tulis alamat email lebih dulu.");
      return;
    }
    if (!POLA_EMAIL.test(email)) {
      setGalat("Format email belum benar. Contoh: nama@alakhyar.sch.id");
      return;
    }
    setGalat(null);
    if (onTambah(email)) setTeks("");
  };

  return (
    <form onSubmit={kirim} className="space-y-2" noValidate>
      <Label htmlFor={id}>Atau tulis email langsung</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          type="email"
          inputMode="email"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="nama@alakhyar.sch.id"
          value={teks}
          onChange={(e) => {
            setTeks(e.target.value);
            if (galat) setGalat(null);
          }}
          aria-invalid={galat !== null}
          aria-describedby={galat ? idGalat : undefined}
          disabled={disabled}
          className="h-12 flex-1 rounded-2xl"
        />
        <Button type="submit" variant="secondary" disabled={disabled}>
          <PlusIcon aria-hidden />
          Tambah
        </Button>
      </div>
      {galat && (
        <p id={idGalat} role="alert" className="text-sm text-destructive">
          {galat}
        </p>
      )}
    </form>
  );
}

/**
 * Daftar orang yang diedit: tambah lewat pencarian GTK atau email manual, hapus per orang.
 * Dipakai oleh undangan per orang dan oleh editor grup.
 */
export function AnggotaEditor({
  anggota,
  onChange,
  maks,
  emailPemilik,
  kosong,
}: {
  anggota: Anggota[];
  onChange: (a: Anggota[]) => void;
  maks: number;
  /** Email yang tidak perlu ditambahkan (perekam sudah punya akses penuh). */
  emailPemilik?: string;
  /** Teks saat daftar masih kosong. */
  kosong: string;
}) {
  const penuh = anggota.length >= maks;

  const tambah = (baru: Anggota): boolean => {
    if (emailPemilik && normalisasiEmail(baru.email) === emailPemilik.toLowerCase()) {
      toast.info("Anda perekam rekaman ini, jadi sudah punya akses penuh.");
      return false;
    }
    const r = tambahAnggota(anggota, baru, maks);
    if (r.hasil === "duplikat") {
      toast.info("Orang ini sudah ada di daftar.");
      return false;
    }
    if (r.hasil === "penuh") {
      toast.error(`Maksimal ${maks} orang.`);
      return false;
    }
    onChange(r.daftar);
    return true;
  };

  return (
    <div className="space-y-4">
      <PilihOrang
        value={null}
        onChange={(o) => {
          if (o) tambah({ email: o.email, namaResmi: o.namaResmi });
        }}
        label="Cari di direktori GTK"
        placeholder="Cari nama atau email"
      />
      <EmailManual onTambah={(email) => tambah({ email, namaResmi: null })} disabled={penuh} />

      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-medium">Daftar</p>
          <p className="font-mono text-xs tabular-nums text-muted-foreground" aria-live="polite">
            {anggota.length}/{maks}
          </p>
        </div>
        {anggota.length === 0 ? (
          <p className="rounded-2xl border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">{kosong}</p>
        ) : (
          <ul className="divide-y rounded-2xl border">
            {anggota.map((a) => (
              <li key={a.email} className="flex items-center gap-2 py-1 pr-1 pl-4">
                <div className="min-w-0 flex-1">
                  {a.namaResmi ? (
                    <>
                      <p className="truncate text-sm font-semibold">{a.namaResmi}</p>
                      <p className="truncate text-xs text-muted-foreground">{a.email}</p>
                    </>
                  ) : (
                    <p className="truncate text-sm font-medium">{a.email}</p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Hapus ${a.namaResmi ?? a.email} dari daftar`}
                  onClick={() => onChange(anggota.filter((x) => x.email !== a.email))}
                >
                  <XIcon aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
