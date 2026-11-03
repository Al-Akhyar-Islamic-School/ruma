import { Link } from "@tanstack/react-router";
import { CheckIcon, Loader2Icon, MicIcon, TriangleAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { StatusSesi } from "@/lib/format";
import { cn } from "@/lib/utils";

const LANGKAH = ["Direkam", "Mentranskrip", "Menganalisis", "Selesai"] as const;
const LANGKAH_AKTIF: Partial<Record<StatusSesi, number>> = { merekam: 0, mentranskrip: 1, menganalisis: 2 };

function Stepper({ aktif }: { aktif: number }) {
  return (
    <ol className="flex items-start" aria-label="Tahap pemrosesan">
      {LANGKAH.map((nama, i) => {
        const selesai = i < aktif;
        const sekarang = i === aktif;
        const berputar = sekarang && i > 0;
        return (
          <li
            key={nama}
            aria-current={sekarang ? "step" : undefined}
            className={cn(
              "relative flex flex-1 flex-col items-center gap-2 text-center",
              // Garis penghubung ke langkah berikutnya.
              i < LANGKAH.length - 1 &&
                "after:absolute after:left-1/2 after:top-4 after:h-0.5 after:w-full after:-translate-y-1/2",
              i < LANGKAH.length - 1 && (selesai ? "after:bg-success" : "after:bg-border"),
            )}
          >
            <span
              className={cn(
                "relative z-10 grid size-8 place-items-center rounded-full text-sm font-semibold",
                selesai && "bg-success text-success-foreground",
                sekarang && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                !selesai && !sekarang && "bg-muted text-muted-foreground",
              )}
            >
              {selesai ? (
                <CheckIcon className="size-4" aria-hidden />
              ) : berputar ? (
                <Loader2Icon className="size-4 animate-spin" aria-hidden />
              ) : sekarang ? (
                <MicIcon className="size-4" aria-hidden />
              ) : (
                <span className="font-mono tabular-nums">{i + 1}</span>
              )}
            </span>
            <span className={cn("text-xs", sekarang ? "font-semibold text-foreground" : "text-muted-foreground")}>
              {nama}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Status pemrosesan sesi yang belum selesai: stepper + penjelasan, atau peringatan merekam/gagal.
 * Tidak dirender untuk status `selesai`.
 */
export function StatusPemrosesan({
  status,
  uuid,
  tipeSesi,
  adalahPerekam,
  galat,
}: {
  status: StatusSesi;
  uuid: string;
  tipeSesi: "rapat" | "supervisi_kelas";
  adalahPerekam: boolean;
  galat: string | null;
}) {
  if (status === "selesai") return null;

  if (status === "gagal") {
    return (
      <Alert variant="destructive" className="rounded-2xl p-4">
        <TriangleAlertIcon />
        <AlertTitle>Pemrosesan gagal</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>
            {adalahPerekam
              ? "Rekaman Anda tersimpan, tetapi hasilnya belum bisa dibuat. Admin dapat mengulang pemrosesan; hubungi admin sekolah."
              : "Hasil sesi ini belum bisa dibuat. Perekam atau admin dapat menindaklanjuti."}
          </p>
          {adalahPerekam && galat && (
            <p className="line-clamp-3 break-words rounded-lg bg-destructive/10 px-2.5 py-1.5 font-mono text-xs">{galat}</p>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  const aktif = LANGKAH_AKTIF[status] ?? 0;
  const dokumen = tipeSesi === "rapat" ? "notulen" : "lembar observasi";
  return (
    <Card className="gap-4 rounded-2xl p-4">
      <Stepper aktif={aktif} />
      <div aria-live="polite" className="space-y-3">
        {status === "merekam" && adalahPerekam && (
          <>
            <p className="text-sm">
              Rekaman ini belum diselesaikan, jadi belum ada hasil. Lanjutkan untuk mengirim rekaman ke pemrosesan.
            </p>
            <Button asChild className="w-full">
              <Link to="/rekam/$uuid" params={{ uuid }}>
                Lanjutkan penyelesaian rekaman
              </Link>
            </Button>
          </>
        )}
        {status === "merekam" && !adalahPerekam && (
          <p className="text-sm text-muted-foreground">Rekaman masih berlangsung. Hasil muncul setelah perekam menyelesaikannya.</p>
        )}
        {status === "mentranskrip" && (
          <p className="text-sm text-muted-foreground">
            Sedang mengubah suara menjadi teks. Halaman ini memperbarui diri otomatis; Anda boleh menutupnya.
          </p>
        )}
        {status === "menganalisis" && (
          <p className="text-sm text-muted-foreground">
            Transkrip sudah jadi. Sedang menyusun {dokumen}. Halaman ini memperbarui diri otomatis.
          </p>
        )}
      </div>
    </Card>
  );
}
