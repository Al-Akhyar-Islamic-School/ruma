import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { Segmented } from "@/components/app/segmented";
import { kategoriAktif, useKategori } from "@/lib/kategori";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { type OrangGtk, PilihOrang } from "@/features/undangan/pilih-orang";
import { ApiError, api, ok, pesanGalat } from "@/lib/api";
import { useMe } from "@/lib/auth";
import { JENIS_LABEL, type MetadataPermintaan, type TipeSesiPermintaan } from "./rincian";

const ALASAN_MIN = 10;
const ALASAN_MAKS = 2000;
const DURASI_MAKS = 480;
const TANPA_KATEGORI = "tanpa";

/** Sheet "Ajukan rekaman". Isinya dipasang hanya saat terbuka sehingga isian selalu mulai dari kosong. */
export function FormAjukan({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92dvh] gap-0 overflow-y-auto rounded-t-3xl p-0">
        <SheetHeader className="p-5 pb-3">
          <SheetTitle className="text-lg">Ajukan rekaman</SheetTitle>
          <SheetDescription>Admin akan memutuskan. Setelah disetujui, Anda bisa mulai merekam dari halaman ini.</SheetDescription>
        </SheetHeader>
        <IsiForm onSelesai={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}

function IsiForm({ onSelesai }: { onSelesai: () => void }) {
  const qc = useQueryClient();
  const [tipe, setTipe] = useState<TipeSesiPermintaan>("rapat");
  const [judul, setJudul] = useState("");
  const [kategori, setKategori] = useState<string>(TANPA_KATEGORI);
  const daftarKategori = kategoriAktif(useKategori());
  const [guru, setGuru] = useState<OrangGtk | null>(null);
  const [kelas, setKelas] = useState("");
  const [mapel, setMapel] = useState("");
  const [materi, setMateri] = useState("");
  const [alasan, setAlasan] = useState("");
  const [durasi, setDurasi] = useState("60");

  // Bila modul supervisi dimatikan (bahkan saat form terbuka), mode jatuh ke rapat tanpa mengubah state isian.
  const modulSupervisi = useMe().modul.supervisi;
  const tipeAktif: TipeSesiPermintaan = modulSupervisi ? tipe : "rapat";
  const supervisi = tipeAktif === "supervisi_kelas";
  const alasanBersih = alasan.trim();
  const menit = /^\d+$/.test(durasi) ? Number(durasi) : Number.NaN;

  const kurang: string[] = [];
  if (!judul.trim()) kurang.push("judul");
  if (supervisi) {
    if (!guru) kurang.push("guru");
    if (!kelas.trim()) kurang.push("kelas");
    if (!mapel.trim()) kurang.push("mapel");
  }
  if (alasanBersih.length < ALASAN_MIN) kurang.push(`alasan (minimal ${ALASAN_MIN} huruf)`);
  if (!(menit >= 1 && menit <= DURASI_MAKS)) kurang.push(`durasi (1–${DURASI_MAKS} menit)`);

  const kirim = useMutation({
    mutationFn: async () => {
      const metadata: MetadataPermintaan = {};
      if (supervisi) {
        if (guru) metadata.guruEmail = guru.email;
        metadata.kelas = kelas.trim();
        metadata.mapel = mapel.trim();
        if (materi.trim()) metadata.materi = materi.trim();
      } else if (kategori !== TANPA_KATEGORI) {
        metadata.kategori = kategori;
      }
      return ok(
        await api.permintaan.$post({
          json: { tipe_sesi: tipeAktif, judul: judul.trim(), metadata, alasan: alasanBersih, durasi_menit: menit },
        }),
      );
    },
    onSuccess: () => {
      toast.success("Permintaan terkirim. Admin akan memutuskan.");
      void qc.invalidateQueries({ queryKey: ["permintaan", "saya"] });
      onSelesai();
    },
    onError: (e) => {
      // Izin bisa berubah sejak halaman dibuka; muat ulang profil agar halaman menyesuaikan.
      if (e instanceof ApiError && e.kode === "tidak_perlu_permintaan") void qc.invalidateQueries({ queryKey: ["me"] });
      if (e instanceof ApiError && e.kode === "terlalu_banyak_permintaan_menunggu") {
        void qc.invalidateQueries({ queryKey: ["permintaan", "saya"] });
      }
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (kurang.length === 0 && !kirim.isPending) kirim.mutate();
  }

  return (
    <form onSubmit={submit} className="space-y-5 px-5 pb-5">
      {modulSupervisi && (
        <Segmented
          label="Jenis rekaman"
          value={tipe}
          onChange={setTipe}
          options={[
            { value: "rapat", label: JENIS_LABEL.rapat },
            { value: "supervisi_kelas", label: JENIS_LABEL.supervisi_kelas },
          ]}
        />
      )}

      <div className="space-y-2">
        <Label htmlFor="perm-judul">Judul</Label>
        <Input
          id="perm-judul"
          className="h-12"
          value={judul}
          maxLength={255}
          onChange={(e) => setJudul(e.target.value)}
          placeholder={supervisi ? "Mis. Supervisi KBM Informatika" : "Mis. Rapat koordinasi SAS ganjil"}
        />
      </div>

      {supervisi ? (
        <>
          <PilihOrang id="perm-guru" label="Guru yang disupervisi" value={guru} onChange={setGuru} placeholder="Cari nama guru" sumber="gtk" />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="perm-kelas">Kelas</Label>
              <Input id="perm-kelas" className="h-12" value={kelas} maxLength={100} onChange={(e) => setKelas(e.target.value)} placeholder="7 Al Halim" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="perm-mapel">Mapel</Label>
              <Input id="perm-mapel" className="h-12" value={mapel} maxLength={100} onChange={(e) => setMapel(e.target.value)} placeholder="Informatika" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="perm-materi">Materi (opsional)</Label>
            <Input id="perm-materi" className="h-12" value={materi} maxLength={255} onChange={(e) => setMateri(e.target.value)} />
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="perm-kategori">Kategori rapat (opsional)</Label>
          <Select value={kategori} onValueChange={setKategori}>
            <SelectTrigger id="perm-kategori" className="h-12 w-full">
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
      )}

      <div className="space-y-2">
        <Label htmlFor="perm-alasan">Alasan</Label>
        <Textarea
          id="perm-alasan"
          className="min-h-28"
          value={alasan}
          maxLength={ALASAN_MAKS}
          onChange={(e) => setAlasan(e.target.value)}
          aria-describedby="perm-alasan-info"
          placeholder="Jelaskan kenapa rekaman ini diperlukan dan kapan akan dilakukan."
        />
        <p id="perm-alasan-info" className="flex justify-between text-xs text-muted-foreground">
          <span>Minimal {ALASAN_MIN} huruf.</span>
          <span className="font-mono tabular-nums">
            {alasan.length}/{ALASAN_MAKS}
          </span>
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="perm-durasi">Durasi diminta (menit)</Label>
        <Input
          id="perm-durasi"
          className="h-12 font-mono tabular-nums"
          type="number"
          inputMode="numeric"
          min={1}
          max={DURASI_MAKS}
          step={1}
          value={durasi}
          onChange={(e) => setDurasi(e.target.value)}
          aria-describedby="perm-durasi-info"
        />
        <p id="perm-durasi-info" className="text-xs text-muted-foreground">
          Maksimal {DURASI_MAKS} menit. Admin bisa mengizinkan durasi yang lebih pendek.
        </p>
      </div>

      {kirim.isError && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{pesanGalat(kirim.error)}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        {kurang.length > 0 && <p className="text-sm text-muted-foreground">Belum lengkap: {kurang.join(", ")}.</p>}
        <Button type="submit" size="lg" className="w-full" disabled={kurang.length > 0 || kirim.isPending}>
          {kirim.isPending ? "Mengirim…" : "Kirim permintaan"}
        </Button>
      </div>
    </form>
  );
}
