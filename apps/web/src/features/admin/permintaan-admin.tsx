import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { EmptyState, ErrorNotice, ListSkeleton } from "@/components/app/feedback";
import { Segmented } from "@/components/app/segmented";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { type DataPermintaan, RincianPermintaan } from "@/features/permintaan/rincian";
import { ApiError, api, ok, pesanGalat } from "@/lib/api";

type Status = DataPermintaan["status"];
type Pemohon = { id: number; name: string; email: string };
type Keputusan = { jenis: "setujui" | "tolak"; p: DataPermintaan; pemohon: Pemohon };

const CATATAN_MAKS = 500;
const DURASI_MAKS = 480;

const KOSONG: Record<Status, { title: string; hint: string }> = {
  menunggu: { title: "Tidak ada permintaan menunggu", hint: "Permintaan baru dari pengguna akan muncul di sini." },
  disetujui: { title: "Belum ada permintaan disetujui", hint: "Permintaan yang Anda setujui akan muncul di sini." },
  ditolak: { title: "Belum ada permintaan ditolak", hint: "Permintaan yang Anda tolak akan muncul di sini." },
};

function pesanKeputusan(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.kode === "sudah_diputuskan") return "Permintaan ini sudah diputuskan oleh admin lain. Daftar sudah diperbarui.";
    if (e.kode === "berlaku_sampai_harus_di_masa_depan") return "Batas berlaku harus di masa depan.";
  }
  return pesanGalat(e);
}

export function PermintaanAdmin() {
  const [status, setStatus] = useState<Status>("menunggu");
  const [keputusan, setKeputusan] = useState<Keputusan | null>(null);

  const q = useQuery({
    queryKey: ["admin", "permintaan", status],
    queryFn: async () => ok(await api.admin.permintaan.$get({ query: { status } })),
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Putuskan permintaan rekaman dari pengguna. Persetujuan berlaku untuk satu rekaman dengan batas durasi yang Anda tentukan.
      </p>
      <Segmented
        label="Status permintaan"
        value={status}
        onChange={setStatus}
        options={[
          { value: "menunggu", label: "Menunggu" },
          { value: "disetujui", label: "Disetujui" },
          { value: "ditolak", label: "Ditolak" },
        ]}
      />

      {q.isPending ? (
        <ListSkeleton />
      ) : q.isError ? (
        <ErrorNotice error={q.error} onRetry={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <EmptyState {...KOSONG[status]} />
      ) : (
        <ul className="space-y-3">
          {q.data.map(({ permintaan, pemohon }) => (
            <li key={permintaan.id}>
              <Card className="rounded-2xl p-4">
                <RincianPermintaan
                  p={permintaan}
                  atas={
                    <p className="text-sm">
                      <span className="font-medium">{pemohon.name}</span>
                      <span className="break-all text-muted-foreground"> · {pemohon.email}</span>
                    </p>
                  }
                >
                  {permintaan.status === "menunggu" && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <Button variant="outline" onClick={() => setKeputusan({ jenis: "tolak", p: permintaan, pemohon })}>
                        Tolak
                      </Button>
                      <Button variant="success" onClick={() => setKeputusan({ jenis: "setujui", p: permintaan, pemohon })}>
                        Setujui
                      </Button>
                    </div>
                  )}
                </RincianPermintaan>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={keputusan !== null} onOpenChange={(o) => !o && setKeputusan(null)}>
        <SheetContent side="bottom" className="max-h-[92dvh] gap-0 overflow-y-auto rounded-t-3xl p-0">
          {keputusan && (
            <>
              <SheetHeader className="p-5 pb-3">
                <SheetTitle className="text-lg">{keputusan.jenis === "setujui" ? "Setujui permintaan" : "Tolak permintaan"}</SheetTitle>
                <SheetDescription className="break-words">
                  {keputusan.p.judul} · {keputusan.pemohon.name}
                </SheetDescription>
              </SheetHeader>
              {keputusan.jenis === "setujui" ? (
                <FormSetujui p={keputusan.p} onSelesai={() => setKeputusan(null)} />
              ) : (
                <FormTolak p={keputusan.p} onSelesai={() => setKeputusan(null)} />
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

type Putusan =
  | { keputusan: "disetujui"; durasi_diizinkan_menit: number; berlaku_sampai?: string; catatan?: string }
  | { keputusan: "ditolak"; catatan: string };

/** Mutasi keputusan bersama: menyegarkan daftar dan menangani 409 `sudah_diputuskan` dengan menutup form. */
function usePutuskan(p: DataPermintaan, onSelesai: () => void, pesanSukses: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (json: Putusan) => ok(await api.admin.permintaan[":id"].putuskan.$post({ param: { id: String(p.id) }, json })),
    onSuccess: () => {
      toast.success(pesanSukses);
      void qc.invalidateQueries({ queryKey: ["admin", "permintaan"] });
      onSelesai();
    },
    onError: (e) => {
      if (e instanceof ApiError && e.kode === "sudah_diputuskan") {
        toast.error(pesanKeputusan(e));
        void qc.invalidateQueries({ queryKey: ["admin", "permintaan"] });
        onSelesai();
      }
    },
  });
}

/** "YYYY-MM-DDTHH:mm" waktu lokal perangkat, untuk atribut `min` input datetime-local. */
function lokalSekarang(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function FormSetujui({ p, onSelesai }: { p: DataPermintaan; onSelesai: () => void }) {
  const [durasi, setDurasi] = useState(String(Math.min(p.durasiDimintaMenit, DURASI_MAKS)));
  const [sampai, setSampai] = useState("");
  const [catatan, setCatatan] = useState("");
  const putuskan = usePutuskan(p, onSelesai, "Permintaan disetujui");

  const menit = /^\d+$/.test(durasi) ? Number(durasi) : Number.NaN;
  const durasiSah = menit >= 1 && menit <= DURASI_MAKS;
  const sampaiMs = sampai ? new Date(sampai).getTime() : null;
  const sampaiSah = sampaiMs === null || (!Number.isNaN(sampaiMs) && sampaiMs > Date.now());

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!durasiSah || !sampaiSah || putuskan.isPending) return;
    putuskan.mutate({
      keputusan: "disetujui",
      durasi_diizinkan_menit: menit,
      ...(sampaiMs !== null && { berlaku_sampai: new Date(sampaiMs).toISOString() }),
      ...(catatan.trim() !== "" && { catatan: catatan.trim() }),
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5 px-5 pb-5">
      <div className="space-y-2">
        <Label htmlFor="setuju-durasi">Durasi diizinkan (menit)</Label>
        <Input
          id="setuju-durasi"
          className="h-12 font-mono tabular-nums"
          type="number"
          inputMode="numeric"
          min={1}
          max={DURASI_MAKS}
          step={1}
          value={durasi}
          onChange={(e) => setDurasi(e.target.value)}
          aria-invalid={!durasiSah}
          aria-describedby="setuju-durasi-info"
        />
        <p id="setuju-durasi-info" className={durasiSah ? "text-xs text-muted-foreground" : "text-xs text-destructive"}>
          Diminta {p.durasiDimintaMenit} menit. Isi 1–{DURASI_MAKS} menit; rekaman otomatis dibatasi sampai durasi ini.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="setuju-sampai">Berlaku sampai (opsional)</Label>
        <Input
          id="setuju-sampai"
          className="h-12"
          type="datetime-local"
          min={lokalSekarang()}
          value={sampai}
          onChange={(e) => setSampai(e.target.value)}
          aria-invalid={!sampaiSah}
          aria-describedby="setuju-sampai-info"
        />
        <p id="setuju-sampai-info" className={sampaiSah ? "text-xs text-muted-foreground" : "text-xs text-destructive"}>
          {sampaiSah
            ? "Waktu mengikuti zona perangkat Anda. Bila dikosongkan, persetujuan berlaku 7 hari sejak hari ini."
            : "Batas berlaku harus di masa depan."}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="setuju-catatan">Catatan untuk pemohon (opsional)</Label>
        <Textarea id="setuju-catatan" value={catatan} maxLength={CATATAN_MAKS} onChange={(e) => setCatatan(e.target.value)} />
        <p className="text-right font-mono text-xs tabular-nums text-muted-foreground">
          {catatan.length}/{CATATAN_MAKS}
        </p>
      </div>

      {putuskan.isError && !(putuskan.error instanceof ApiError && putuskan.error.kode === "sudah_diputuskan") && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{pesanKeputusan(putuskan.error)}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" variant="success" size="lg" className="w-full" disabled={!durasiSah || !sampaiSah || putuskan.isPending}>
        {putuskan.isPending ? "Menyimpan…" : "Setujui"}
      </Button>
    </form>
  );
}

function FormTolak({ p, onSelesai }: { p: DataPermintaan; onSelesai: () => void }) {
  const [catatan, setCatatan] = useState("");
  const putuskan = usePutuskan(p, onSelesai, "Permintaan ditolak");
  const bersih = catatan.trim();

  function submit(e: FormEvent) {
    e.preventDefault();
    if (bersih && !putuskan.isPending) putuskan.mutate({ keputusan: "ditolak", catatan: bersih });
  }

  return (
    <form onSubmit={submit} className="space-y-5 px-5 pb-5">
      <div className="space-y-2">
        <Label htmlFor="tolak-catatan">Alasan penolakan</Label>
        <Textarea
          id="tolak-catatan"
          className="min-h-28"
          value={catatan}
          maxLength={CATATAN_MAKS}
          onChange={(e) => setCatatan(e.target.value)}
          aria-describedby="tolak-catatan-info"
          placeholder="Jelaskan supaya pemohon tahu apa yang perlu diperbaiki."
        />
        <p id="tolak-catatan-info" className="flex justify-between text-xs text-muted-foreground">
          <span>Wajib diisi. Pemohon akan membacanya.</span>
          <span className="font-mono tabular-nums">
            {catatan.length}/{CATATAN_MAKS}
          </span>
        </p>
      </div>

      {putuskan.isError && !(putuskan.error instanceof ApiError && putuskan.error.kode === "sudah_diputuskan") && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{pesanKeputusan(putuskan.error)}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" variant="destructive" size="lg" className="w-full" disabled={!bersih || putuskan.isPending}>
        {putuskan.isPending ? "Menyimpan…" : "Tolak"}
      </Button>
    </form>
  );
}
