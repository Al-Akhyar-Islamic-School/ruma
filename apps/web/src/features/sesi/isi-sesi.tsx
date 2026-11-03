import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PencilLineIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { EmptyState, ErrorNotice, ListSkeleton } from "@/components/app/feedback";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { DokumenRapat } from "./dokumen-rapat";
import { DokumenSupervisi } from "./dokumen-supervisi";
import { KepalaSesi } from "./kepala-sesi";
import { BilahPemutar, RUANG_BILAH_PEMUTAR, usePemutar } from "./pemutar";
import { type DetailSesi, dokumenQuery, transkripQuery } from "./queries";
import { StatusPemrosesan } from "./status-pemrosesan";
import { DaftarTugas } from "./tugas";
import { TabTranskrip } from "./transkrip";
import { UndanganSheet } from "@/features/undangan/undangan-sheet";

type KunciTab = "dokumen" | "tugas" | "transkrip";

const belumTersedia = (e: unknown) => e instanceof ApiError && e.status === 404 && e.kode === "belum_tersedia";

/** Isi halaman sesi (di dalam `PemutarProvider`): kepala, status pemrosesan, tab hasil, dan bilah pemutar. */
export function IsiSesi({ sesi }: { sesi: DetailSesi }) {
  const { uuid, status } = sesi;
  const rapat = sesi.tipeSesi === "rapat";
  const qc = useQueryClient();
  const { tersedia: adaAudio } = usePemutar();
  const [pilihan, setPilihan] = useState<KunciTab | null>(null);
  const [undang, setUndang] = useState(false);

  // Dokumen hanya ada setelah selesai. Transkrip sudah ada sejak tahap analisis (juga bila analisis gagal).
  const dokumenQ = useQuery(dokumenQuery(uuid, status === "selesai"));
  const transkripQ = useQuery(transkripQuery(uuid, status === "menganalisis" || status === "selesai" || status === "gagal"));

  // Saat status berubah menjadi selesai (dipantau lewat polling), buang hasil lama supaya diambil ulang.
  const statusSebelumnya = useRef(status);
  useEffect(() => {
    if (statusSebelumnya.current !== "selesai" && status === "selesai") {
      void qc.invalidateQueries({ queryKey: ["sesi", uuid, "transkrip"] });
      void qc.invalidateQueries({ queryKey: ["sesi", uuid, "dokumen"] });
      void qc.invalidateQueries({ queryKey: ["pengetahuan"] });
    }
    statusSebelumnya.current = status;
  }, [status, uuid, qc]);

  const dokumen = dokumenQ.data;
  const draf = sesi.adalahPerekam && dokumen?.statusVerifikasi === "draf";
  const jumlahTugas = dokumen?.actionItems.length ?? 0;

  // Tab hanya aktif bila ada isinya. Dokumen dan transkrip tetap aktif saat selesai agar alasan ketiadaannya bisa ditampilkan.
  const aktif: Record<KunciTab, boolean> = {
    dokumen: status === "selesai",
    tugas: rapat && !!dokumen,
    transkrip: !!transkripQ.data || status === "selesai",
  };
  const bawaan: KunciTab | "" = dokumen ? "dokumen" : transkripQ.data ? "transkrip" : aktif.dokumen ? "dokumen" : "";
  const efektif = pilihan && aktif[pilihan] ? pilihan : bawaan;
  const menunggu = status === "merekam" || status === "mentranskrip" || status === "menganalisis";

  return (
    <div className={cn("space-y-4", adaAudio && RUANG_BILAH_PEMUTAR)}>
      <KepalaSesi sesi={sesi} bisaSetujui={draf} statusDokumen={dokumen?.statusVerifikasi} onUndang={() => setUndang(true)} />

      <StatusPemrosesan
        status={status}
        uuid={uuid}
        tipeSesi={sesi.tipeSesi}
        adalahPerekam={sesi.adalahPerekam}
        galat={sesi.galat}
        pemrosesan={sesi.pemrosesan}
      />

      {draf && (
        <Alert className="rounded-2xl p-4">
          <PencilLineIcon />
          <AlertTitle>Draf AI. Periksa sebelum disetujui.</AlertTitle>
          <AlertDescription>Dokumen ini hanya terlihat oleh Anda sampai Anda menyetujuinya.</AlertDescription>
        </Alert>
      )}

      <Tabs value={efektif} onValueChange={(v) => setPilihan(v as KunciTab)} className="gap-3">
        <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-4 bg-background/95 px-4 py-2 backdrop-blur">
          <TabsList className="h-12 w-full">
            <TabsTrigger value="dokumen" disabled={!aktif.dokumen}>
              {rapat ? "Notulen" : "Lembar observasi"}
            </TabsTrigger>
            {rapat && (
              <TabsTrigger value="tugas" disabled={!aktif.tugas}>
                {dokumen ? `Tugas (${jumlahTugas})` : "Tugas"}
              </TabsTrigger>
            )}
            <TabsTrigger value="transkrip" disabled={!aktif.transkrip}>
              Transkrip
            </TabsTrigger>
          </TabsList>
        </div>

        {efektif === "" && (
          <EmptyState
            title={menunggu ? "Hasil belum tersedia" : "Tidak ada hasil untuk ditampilkan"}
            hint={
              menunggu
                ? `${rapat ? "Notulen, tugas" : "Lembar observasi"} dan transkrip muncul di sini setelah pemrosesan selesai.`
                : "Pemrosesan gagal sebelum transkrip selesai dibuat."
            }
          />
        )}

        <TabsContent value="dokumen">
          {dokumen ? (
            rapat ? (
              <DokumenRapat payload={dokumen.payload} judulSesi={sesi.judul} />
            ) : (
              <DokumenSupervisi payload={dokumen.payload} />
            )
          ) : dokumenQ.isError ? (
            belumTersedia(dokumenQ.error) ? (
              <EmptyState
                title={sesi.adalahPerekam ? "Dokumen belum tersedia" : "Dokumen belum disetujui perekam"}
                hint={
                  sesi.adalahPerekam
                    ? "Dokumen belum selesai dibuat. Coba muat ulang beberapa saat lagi."
                    : "Dokumen akan muncul di sini setelah perekam menyetujuinya. Transkrip sudah bisa dibaca di tab Transkrip."
                }
              />
            ) : (
              <ErrorNotice error={dokumenQ.error} onRetry={() => void dokumenQ.refetch()} />
            )
          ) : (
            <ListSkeleton rows={3} />
          )}
        </TabsContent>

        {rapat && (
          <TabsContent value="tugas">
            <DaftarTugas
              items={dokumen?.actionItems ?? []}
              payload={dokumen?.payload}
              uuid={uuid}
              adalahPerekam={sesi.adalahPerekam}
              onUndang={() => setUndang(true)}
            />
          </TabsContent>
        )}

        <TabsContent value="transkrip">
          {transkripQ.data ? (
            <TabTranskrip rawText={transkripQ.data.rawText} segments={transkripQ.data.segments} />
          ) : transkripQ.isError ? (
            belumTersedia(transkripQ.error) ? (
              <EmptyState
                title="Transkrip belum tersedia"
                hint="Rekaman belum selesai diubah menjadi teks, atau proses ini gagal."
              />
            ) : (
              <ErrorNotice error={transkripQ.error} onRetry={() => void transkripQ.refetch()} />
            )
          ) : (
            <ListSkeleton rows={5} />
          )}
        </TabsContent>
      </Tabs>

      {sesi.adalahPerekam && (
        <UndanganSheet
          uuid={uuid}
          kategori={rapat ? sesi.metadata.kategori : undefined}
          open={undang}
          onOpenChange={setUndang}
        />
      )}

      <BilahPemutar />
    </div>
  );
}
