import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { LoaderCircleIcon, MicIcon, MicOffIcon } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { EmptyState } from "@/components/app/feedback";
import { Segmented } from "@/components/app/segmented";
import { kategoriAktif, useKategori } from "@/lib/kategori";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type OrangGtk, PilihOrang } from "@/features/undangan/pilih-orang";
import { ApiError, api, ok, pesanGalat } from "@/lib/api";
import { useMe } from "@/lib/auth";
import { simpanSesiLokal } from "./db";
import { cekDukunganRekam } from "./mime";

type Mode = "rapat" | "supervisi_kelas";

const TANPA_KATEGORI = "tanpa";
const JUDUL_MAKS = 255;

/** `/rekam/baru` (DESIGN.md Layar 2, setup): mode Rapat atau Supervisi kelas, lalu membuat sesi dan membuka perekam. */
export function HalamanRekamBaru() {
  const me = useMe();
  if (!me.bisaBuatSesiLangsung) {
    return (
      <EmptyState
        title="Anda belum bisa merekam langsung"
        hint="Akun Anda perlu persetujuan admin untuk setiap rekaman. Ajukan permintaan, lalu mulai merekam dari halaman Permintaan setelah disetujui."
        action={
          <Button asChild>
            <Link to="/permintaan">Ajukan permintaan</Link>
          </Button>
        }
      />
    );
  }
  return <FormSetup userId={me.id} supervisiAktif={me.modul.supervisi} />;
}

function FormSetup({ userId, supervisiAktif }: { userId: number; supervisiAktif: boolean }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const dukungan = useMemo(() => cekDukunganRekam(), []);

  const [modeDipilih, setModeDipilih] = useState<Mode>("rapat");
  const [judulRapat, setJudulRapat] = useState("");
  const [kategori, setKategori] = useState<string>(TANPA_KATEGORI);
  const daftarKategori = kategoriAktif(useKategori());
  const [guru, setGuru] = useState<OrangGtk | null>(null);
  const [kelas, setKelas] = useState("");
  const [mapel, setMapel] = useState("");
  const [materi, setMateri] = useState("");
  /** `null` = ikuti judul otomatis; string = judul yang diubah pengguna. */
  const [judulSupervisi, setJudulSupervisi] = useState<string | null>(null);

  // Saklar modul bisa mati selagi halaman terbuka: mode otomatis kembali ke Rapat.
  const mode: Mode = supervisiAktif ? modeDipilih : "rapat";
  const supervisi = mode === "supervisi_kelas";
  const judulOtomatis = guru && mapel.trim() ? `Supervisi ${mapel.trim()}: ${guru.namaResmi}`.slice(0, JUDUL_MAKS) : "";
  const judul = (supervisi ? (judulSupervisi ?? judulOtomatis) : judulRapat).trim();

  const kurang: string[] = [];
  if (supervisi) {
    if (!guru) kurang.push("guru");
    if (!kelas.trim()) kurang.push("kelas");
    if (!mapel.trim()) kurang.push("mata pelajaran");
  }
  if (!judul) kurang.push("judul");

  const mulai = useMutation({
    mutationFn: async () => {
      if (!dukungan.ok) throw new Error(dukungan.pesan);
      const metadata =
        supervisi && guru
          ? { guruEmail: guru.email, kelas: kelas.trim(), mapel: mapel.trim(), ...(materi.trim() ? { materi: materi.trim() } : {}) }
          : !supervisi && kategori !== TANPA_KATEGORI
            ? { kategori }
            : {};
      const sesi = await ok(await api.sesi.$post({ json: { tipe_sesi: mode, judul, audio_mime: dukungan.mime, metadata } }));
      // Catatan lokal dibuat sekarang agar pemulihan tahu pemilik dan MIME sesi ini. Gagal menyimpan tidak menghalangi merekam.
      await simpanSesiLokal({
        uuid: sesi.uuid,
        userId,
        judul,
        tipeSesi: mode,
        audioMime: dukungan.mime,
        maksDurasiDetik: null,
        status: "merekam",
        jumlahChunk: 0,
        durasiDetik: 0,
        penanda: [],
        dibuat: Date.now(),
      }).catch(() => undefined);
      return sesi.uuid;
    },
    onSuccess: (uuid) => {
      void qc.invalidateQueries({ queryKey: ["sesi", "saya"] });
      void navigate({ to: "/rekam/$uuid", params: { uuid } });
    },
    onError: (e) => {
      // Saklar bisa dimatikan sejak halaman dibuka; muat ulang profil agar formulir menyesuaikan.
      if (e instanceof ApiError && e.kode === "modul_nonaktif") void qc.invalidateQueries({ queryKey: ["me"] });
    },
  });

  function kirim(e: FormEvent) {
    e.preventDefault();
    if (dukungan.ok && kurang.length === 0 && !mulai.isPending) mulai.mutate();
  }

  return (
    <form id="form-setup" onSubmit={kirim} className="space-y-5 pb-36">
      <h1 className="text-xl font-bold">Rekaman baru</h1>

      {!dukungan.ok && (
        <Alert variant="destructive" className="rounded-2xl">
          <MicOffIcon />
          <AlertTitle>Perangkat ini belum bisa merekam</AlertTitle>
          <AlertDescription>{dukungan.pesan}</AlertDescription>
        </Alert>
      )}

      {supervisiAktif && (
        <Segmented
          label="Jenis rekaman"
          value={mode}
          onChange={setModeDipilih}
          options={[
            { value: "rapat", label: "Rapat" },
            { value: "supervisi_kelas", label: "Supervisi kelas" },
          ]}
        />
      )}

      {supervisi ? (
        <>
          <PilihOrang id="rekam-guru" label="Guru yang disupervisi" value={guru} onChange={setGuru} placeholder="Cari nama guru" sumber="gtk" />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="rekam-kelas">Kelas</Label>
              <Input id="rekam-kelas" className="h-12 rounded-xl" value={kelas} maxLength={100} onChange={(e) => setKelas(e.target.value)} placeholder="7 Al Halim" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rekam-mapel">Mata pelajaran</Label>
              <Input id="rekam-mapel" className="h-12 rounded-xl" value={mapel} maxLength={100} onChange={(e) => setMapel(e.target.value)} placeholder="Informatika" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rekam-materi">Materi pokok (opsional)</Label>
            <Input id="rekam-materi" className="h-12 rounded-xl" value={materi} maxLength={255} onChange={(e) => setMateri(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rekam-judul">Judul</Label>
            <Input
              id="rekam-judul"
              className="h-12 rounded-xl"
              value={judulSupervisi ?? judulOtomatis}
              maxLength={JUDUL_MAKS}
              onChange={(e) => setJudulSupervisi(e.target.value)}
              aria-describedby="rekam-judul-info"
              placeholder="Terisi otomatis setelah guru dan mata pelajaran dipilih"
            />
            <p id="rekam-judul-info" className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>Terisi otomatis; boleh diubah.</span>
              {judulSupervisi !== null && (
                <Button type="button" variant="link" size="xs" className="h-auto p-0" onClick={() => setJudulSupervisi(null)}>
                  Pakai judul otomatis
                </Button>
              )}
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="space-y-2">
            <Label htmlFor="rekam-judul-rapat">Judul rapat</Label>
            <Input
              id="rekam-judul-rapat"
              className="h-12 rounded-xl"
              value={judulRapat}
              maxLength={JUDUL_MAKS}
              onChange={(e) => setJudulRapat(e.target.value)}
              placeholder="Mis. Rapat koordinasi SAS ganjil"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rekam-kategori">Kategori rapat (opsional)</Label>
            <Select value={kategori} onValueChange={setKategori}>
              <SelectTrigger id="rekam-kategori" className="w-full data-[size=default]:h-12 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TANPA_KATEGORI}>Tanpa kategori</SelectItem>
                {daftarKategori.map((k) => (
                  <SelectItem key={k.kode} value={k.kode}>
                    {k.nama}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {mulai.isError && (
        <Alert variant="destructive" className="rounded-2xl" role="alert">
          <AlertTitle>Sesi belum dibuat</AlertTitle>
          <AlertDescription>
            {mulai.error instanceof ApiError && mulai.error.kode === "modul_nonaktif"
              ? "Modul supervisi sedang dinonaktifkan admin."
              : pesanGalat(mulai.error)}
          </AlertDescription>
        </Alert>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto max-w-3xl space-y-2">
          {kurang.length > 0 && <p className="text-center text-xs text-muted-foreground">Lengkapi {kurang.join(", ")} dulu.</p>}
          <Button type="submit" form="form-setup" variant="default" size="lg" className="h-14 w-full" disabled={!dukungan.ok || kurang.length > 0 || mulai.isPending}>
            {mulai.isPending ? <LoaderCircleIcon className="animate-spin" aria-hidden /> : <MicIcon aria-hidden />}
            {mulai.isPending ? "Menyiapkan sesi…" : "Mulai merekam"}
          </Button>
        </div>
      </div>
    </form>
  );
}
