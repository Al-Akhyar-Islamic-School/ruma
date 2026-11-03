import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState, ErrorNotice, ListSkeleton } from "@/components/app/feedback";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { pilihMimeRekam } from "@/features/rekam/mime";
import { api, ok, pesanGalat } from "@/lib/api";
import { useMe } from "@/lib/auth";
import { FormAjukan } from "./form-ajukan";
import { type DataPermintaan, RincianPermintaan, tampilanStatus } from "./rincian";

const TIDAK_DIDUKUNG =
  "Perangkat atau peramban ini tidak mendukung perekaman audio. Buka Notula AI lewat Chrome, Safari, atau Firefox versi terbaru.";

export function HalamanPermintaan() {
  const me = useMe();
  if (me.bisaBuatSesiLangsung) {
    return (
      <EmptyState
        title="Anda sudah bisa merekam langsung"
        hint="Akun Anda punya izin merekam tanpa persetujuan admin, jadi tidak perlu mengajukan permintaan."
        action={
          <Button asChild size="lg">
            <Link to="/rekam/baru">Mulai merekam</Link>
          </Button>
        }
      />
    );
  }
  return <DaftarPermintaan />;
}

function DaftarPermintaan() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [formBuka, setFormBuka] = useState(false);
  const [mime] = useState(pilihMimeRekam);

  const q = useQuery({ queryKey: ["permintaan", "saya"], queryFn: async () => ok(await api.permintaan.$get()) });

  const mulai = useMutation({
    mutationFn: async (id: number) => {
      if (!mime) throw new Error(TIDAK_DIDUKUNG);
      return ok(await api.permintaan[":id"].mulai.$post({ param: { id: String(id) }, json: { audio_mime: mime } }));
    },
    onSuccess: async (d) => {
      void qc.invalidateQueries({ queryKey: ["permintaan", "saya"] });
      void qc.invalidateQueries({ queryKey: ["sesi", "saya"] });
      await navigate({ to: "/rekam/$uuid", params: { uuid: d.uuid } });
    },
    onError: (e) => {
      toast.error(pesanGalat(e));
      void qc.invalidateQueries({ queryKey: ["permintaan", "saya"] });
    },
  });

  return (
    <div className="space-y-4 pb-32">
      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Permintaan rekaman</h1>
        <p className="text-sm text-muted-foreground">
          Ajukan rekaman rapat atau supervisi. Admin memutuskan, lalu Anda memulai rekaman dari kartu yang disetujui.
        </p>
      </div>

      {!mime && (
        <p role="alert" className="rounded-xl bg-warning/15 px-3 py-2 text-sm">
          {TIDAK_DIDUKUNG}
        </p>
      )}

      {q.isPending ? (
        <ListSkeleton />
      ) : q.isError ? (
        <ErrorNotice error={q.error} onRetry={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <EmptyState
          title="Belum ada permintaan"
          hint="Ajukan rekaman lewat tombol di bawah. Status keputusan admin akan muncul di sini."
        />
      ) : (
        <ul className="space-y-3">
          {q.data.map((p) => (
            <li key={p.id}>
              <KartuPermintaan
                p={p}
                bisaMulai={mime !== null}
                sedangMulai={mulai.isPending && mulai.variables === p.id}
                mulaiLain={mulai.isPending && mulai.variables !== p.id}
                onMulai={() => mulai.mutate(p.id)}
                onAjukanBaru={() => setFormBuka(true)}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-background via-background/90 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-10">
        <div className="pointer-events-auto mx-auto max-w-3xl">
          <Button size="lg" className="w-full" onClick={() => setFormBuka(true)}>
            Ajukan rekaman
          </Button>
        </div>
      </div>

      <FormAjukan open={formBuka} onOpenChange={setFormBuka} />
    </div>
  );
}

function KartuPermintaan({
  p,
  bisaMulai,
  sedangMulai,
  mulaiLain,
  onMulai,
  onAjukanBaru,
}: {
  p: DataPermintaan;
  bisaMulai: boolean;
  sedangMulai: boolean;
  mulaiLain: boolean;
  onMulai: () => void;
  onAjukanBaru: () => void;
}) {
  const status = tampilanStatus(p);
  return (
    <Card className="rounded-2xl p-4">
      <RincianPermintaan p={p}>
        {status === "siap" && (
          <Button className="w-full" disabled={!bisaMulai || sedangMulai || mulaiLain} onClick={onMulai}>
            {sedangMulai ? "Menyiapkan rekaman…" : "Mulai merekam"}
          </Button>
        )}
        {status === "dipakai" && (
          <p className="text-sm text-muted-foreground">
            Persetujuan ini sudah dipakai untuk satu rekaman. Temukan rekamannya di beranda, di bawah "Rekaman saya".
          </p>
        )}
        {status === "kedaluwarsa" && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Persetujuan ini sudah lewat masa berlakunya dan tidak bisa dipakai.</p>
            <Button variant="outline" size="sm" onClick={onAjukanBaru}>
              Ajukan permintaan baru
            </Button>
          </div>
        )}
        {status === "ditolak" && (
          <Button variant="outline" size="sm" onClick={onAjukanBaru}>
            Ajukan permintaan baru
          </Button>
        )}
      </RincianPermintaan>
    </Card>
  );
}
