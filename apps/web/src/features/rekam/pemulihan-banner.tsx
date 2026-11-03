import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CloudUploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useMe } from "@/lib/auth";
import { daftarPemulihan } from "./db";

/**
 * Kartu "Rekaman belum selesai" di beranda untuk rekaman yang terhenti (halaman dimuat ulang, baterai habis, offline saat selesai).
 * Hanya menampilkan rekaman milik pengguna yang sedang login; bernilai null bila tidak ada.
 */
export function PemulihanBanner() {
  const me = useMe();
  const { data } = useQuery({
    queryKey: ["rekam", "pemulihan", me.id],
    queryFn: () => daftarPemulihan(me.id),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    gcTime: 0,
    retry: false,
  });

  if (!data || data.length === 0) return null;

  return (
    <section aria-label="Rekaman belum selesai" className="space-y-3">
      {data.map(({ sesi, jumlah, belumTerunggah }) => {
        const tertahan = sesi.tipeSesi === "supervisi_kelas" && !me.modul.supervisi;
        return (
        <Card key={sesi.uuid} className="gap-3 rounded-2xl border-warning/40 bg-warning/10 p-4">
          <div className="flex gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-warning/20 text-foreground">
              <CloudUploadIcon className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="text-sm font-semibold">Rekaman belum selesai</p>
              <p className="line-clamp-2 text-sm">{sesi.judul}</p>
              <p className="text-xs text-muted-foreground">
                {jumlah} potongan di perangkat
                {belumTerunggah > 0 ? ` · ${belumTerunggah} belum terunggah` : " · semua sudah terunggah, tinggal diselesaikan"}
              </p>
            </div>
          </div>
          {tertahan ? (
            <p className="text-sm">
              Modul supervisi sedang dinonaktifkan admin, sehingga rekaman ini belum bisa dikirim. Datanya tetap aman di perangkat dan
              bisa dikirim setelah modul dinyalakan lagi.
            </p>
          ) : (
            <Button asChild className="w-full">
              <Link to="/rekam/$uuid" params={{ uuid: sesi.uuid }}>
                Selesaikan dan kirim
              </Link>
            </Button>
          )}
        </Card>
        );
      })}
    </section>
  );
}
