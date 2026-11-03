import { Link } from "@tanstack/react-router";
import { CheckIcon, Loader2Icon, MicIcon, TriangleAlertIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatTanggal, type StatusSesi } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PemrosesanSesi } from "./queries";

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

const ZONA = "Asia/Makassar";
const kunciHari = new Intl.DateTimeFormat("sv-SE", { timeZone: ZONA }); // YYYY-MM-DD
const jamMenit = new Intl.DateTimeFormat("id-ID", { timeZone: ZONA, hour: "2-digit", minute: "2-digit", hour12: false });

/**
 * Kapan percobaan berikutnya, dalam kalimat: "sebentar lagi", "pukul 08.30", "besok pukul 07.00", atau tanggal.
 * `formatWaktu` dari lib hanya mengenal hari ini/kemarin dan tidak menyertakan jam untuk hari lain, padahal
 * tunda karena kuota harian biasanya jatuh besok.
 */
function kapanCobaLagi(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (d.getTime() - Date.now() < 60_000) return "sebentar lagi";
  const jam = jamMenit.format(d);
  const selisihHari = Math.round((Date.parse(kunciHari.format(d)) - Date.parse(kunciHari.format(new Date()))) / 86_400_000);
  if (selisihHari <= 0) return `pukul ${jam}`;
  if (selisihHari === 1) return `besok pukul ${jam}`;
  return `${formatTanggal(d)} pukul ${jam}`;
}

/** Progres transkripsi: bagian audio yang sudah selesai dari total. Angka hanya dari server, tidak ditebak. */
function ProgresTranskripsi({ selesai, total }: { selesai: number; total: number }) {
  return (
    <div className="space-y-2">
      <p className="font-mono text-sm tabular-nums">
        Bagian {selesai} dari {total}
      </p>
      <Progress
        value={(Math.min(selesai, total) / total) * 100}
        className="h-2"
        aria-label={`Transkripsi bagian ${selesai} dari ${total}`}
      />
    </div>
  );
}

/** Peringatan kuning: pesan jujur saat pemrosesan tidak berjalan atau sedang diulang. */
function Peringatan({ judul, children }: { judul: string; children: ReactNode }) {
  return (
    <Alert className="rounded-2xl border-warning/50 bg-warning/10 p-3">
      <TriangleAlertIcon className="text-warning-strong" />
      <AlertTitle>{judul}</AlertTitle>
      <AlertDescription className="space-y-2 text-foreground/90">{children}</AlertDescription>
    </Alert>
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
  pemrosesan,
}: {
  status: StatusSesi;
  uuid: string;
  tipeSesi: "rapat" | "supervisi_kelas";
  adalahPerekam: boolean;
  galat: string | null;
  pemrosesan: PemrosesanSesi;
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
  const diproses = status === "mentranskrip" || status === "menganalisis";
  const progres = status === "mentranskrip" && pemrosesan.progres && pemrosesan.progres.total > 0 ? pemrosesan.progres : null;
  const tidakBerjalan = diproses && pemrosesan.workerAktif === false;
  const cobaLagi = diproses && pemrosesan.cobaLagiSetelah ? kapanCobaLagi(pemrosesan.cobaLagiSetelah) : "";
  // Galat percobaan terakhir hanya dikirim server untuk perekam; yang diundang tidak melihat rincian galat.
  const percobaanGagal = diproses && adalahPerekam && pemrosesan.percobaan >= 1 && !!galat;

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

        {progres && <ProgresTranskripsi selesai={progres.selesai} total={progres.total} />}

        {tidakBerjalan ? (
          <Peringatan judul="Pemrosesan belum dimulai">
            <p>
              Layanan yang mengubah suara menjadi teks sedang tidak aktif. Rekaman Anda aman dan akan diproses otomatis
              begitu layanan aktif kembali. Bila lebih dari beberapa menit, hubungi admin.
            </p>
          </Peringatan>
        ) : (
          <>
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
          </>
        )}

        {percobaanGagal ? (
          <Peringatan judul={`Percobaan ke-${pemrosesan.percobaan} gagal`}>
            <p>{cobaLagi ? `Mencoba lagi ${cobaLagi}.` : "Akan dicoba lagi otomatis."}</p>
            <details className="text-xs">
              <summary className="cursor-pointer py-2 font-medium">Lihat rincian</summary>
              <p className="break-words rounded-lg bg-muted px-2.5 py-1.5 font-mono">{galat}</p>
            </details>
          </Peringatan>
        ) : (
          cobaLagi && <p className="text-sm text-muted-foreground">Percobaan berikutnya dijadwalkan {cobaLagi}.</p>
        )}
      </div>
    </Card>
  );
}
