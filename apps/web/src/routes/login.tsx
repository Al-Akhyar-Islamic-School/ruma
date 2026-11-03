import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { AudioLinesIcon, TriangleAlertIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { API_URL } from "@/lib/api";
import { meQuery } from "@/lib/auth";

// Alasan penolakan dari API: /auth/google/callback -> {APP_URL}/login?error=<kode>
const ALASAN: Record<string, string> = {
  dibatalkan: "Login dibatalkan. Coba lagi kapan saja.",
  sesi_login_tidak_valid: "Sesi login kedaluwarsa. Mulai lagi dari tombol di bawah.",
  domain_tidak_diizinkan: "Akun ini bukan akun Google Workspace sekolah. Pilih akun sekolah Anda.",
  gagal: "Login gagal karena gangguan di server. Coba lagi sebentar lagi.",
};

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => ({ error: typeof s.error === "string" ? s.error : undefined }),
  beforeLoad: async ({ context }) => {
    // Sudah login: tidak perlu melihat halaman ini.
    if (await context.queryClient.ensureQueryData(meQuery)) throw redirect({ to: "/" });
  },
  component: Login,
});

function Login() {
  const { error } = Route.useSearch();
  useQuery(meQuery); // hangatkan cache
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-between px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(3rem,env(safe-area-inset-top))]">
      <div className="space-y-8">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <AudioLinesIcon className="size-6" aria-hidden />
          </span>
          <div className="leading-tight">
            <p className="text-2xl font-extrabold tracking-tight">ruma.</p>
            <p className="text-sm text-muted-foreground">by Al Akhyar</p>
          </div>
        </div>
        <div className="space-y-3">
          <p className="text-sm font-semibold text-primary">Your AI Meeting Companion</p>
          <h1 className="text-balance text-3xl font-extrabold leading-tight tracking-tight">
            Rekam rapat atau kelas. Notulen jadi sendiri.
          </h1>
          <p className="text-muted-foreground">
            Cukup tekan rekam di ponsel. Setelah selesai, ruma menyusun notulen rapat atau lembar supervisi untuk Anda
            periksa dan setujui.
          </p>
          <p className="text-sm font-semibold tracking-wide text-muted-foreground">Listen · Understand · Summarize</p>
        </div>
      </div>

      <div className="space-y-4">
        {error && (
          <Alert variant="destructive" className="rounded-2xl">
            <TriangleAlertIcon />
            <AlertDescription>{ALASAN[error] ?? "Login gagal. Coba lagi."}</AlertDescription>
          </Alert>
        )}
        <Button asChild size="lg" className="w-full">
          {/* Navigasi penuh (bukan fetch): alur OAuth berpindah ke accounts.google.com. */}
          <a href={`${API_URL}/auth/google`}>Masuk dengan akun Google sekolah</a>
        </Button>
        <p className="text-center text-xs text-muted-foreground">Khusus akun Google Workspace Sekolah Islam Al Akhyar.</p>
      </div>
    </main>
  );
}
