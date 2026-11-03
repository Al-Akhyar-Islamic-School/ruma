import { Link, useRouterState } from "@tanstack/react-router";
import {
  BookOpenTextIcon,
  HomeIcon,
  MicIcon,
  MoreHorizontalIcon,
  UsersIcon,
} from "lucide-react";
import { cn } from "cn";
import type { Me } from "@/lib/auth";

export function BottomNav({
  me,
  onOpenMenu,
}: {
  me: Me;
  onOpenMenu: () => void;
}) {
  const routerState = useRouterState();
  const path = routerState.location.pathname;

  // Sembunyikan bottom bar di layar yang punya bilah bawah sendiri atau butuh layar penuh bebas distraksi:
  // - /rekam/* : layar perekam live (sudah ada tombol kontrol di bawah) atau form setup
  // - /sesi/*  : detail hasil (ada pemutar audio fixed di bawah)
  if (path.startsWith("/rekam") || path.startsWith("/sesi")) {
    return null;
  }

  const bisaRekam = me.bisaBuatSesiLangsung;
  const tujuanRekam = bisaRekam ? "/rekam/baru" : "/permintaan";

  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur-md"
    >
      <div className="mx-auto flex h-14 max-w-md items-center justify-around px-2">
        {/* 1. Beranda */}
        <NavTab
          to="/"
          exact
          aktif={path === "/"}
          label="Beranda"
          Ikon={HomeIcon}
        />

        {/* 2. Pengetahuan */}
        <NavTab
          to="/pengetahuan"
          aktif={path.startsWith("/pengetahuan")}
          label="Pengetahuan"
          Ikon={BookOpenTextIcon}
        />

        {/* 3. Tombol Rekam Menonjol di Tengah */}
        <div className="relative -top-3 flex flex-col items-center">
          <Link
            to={tujuanRekam}
            aria-label={bisaRekam ? "Mulai rekaman" : "Ajukan rekaman"}
            className="group flex size-13 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md shadow-primary/30 ring-4 ring-card transition-transform active:scale-95 hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <MicIcon className="size-6 transition-transform group-hover:scale-105" aria-hidden />
          </Link>
          <span className="mt-0.5 text-[10px] font-semibold tracking-tight text-foreground">
            {bisaRekam ? "Rekam" : "Ajukan"}
          </span>
        </div>

        {/* 4. Grup Undangan */}
        <NavTab
          to="/grup"
          aktif={path.startsWith("/grup")}
          label="Grup"
          Ikon={UsersIcon}
        />

        {/* 5. Menu / Profil (buka sheet samping) */}
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Buka menu profil dan pengaturan"
          className="flex min-w-14 flex-col items-center justify-center gap-1 rounded-xl py-1 text-muted-foreground transition-colors hover:text-foreground active:scale-95 focus-visible:outline-2 focus-visible:outline-ring"
        >
          <MoreHorizontalIcon className="size-5" aria-hidden />
          <span className="text-[11px] font-medium">Lainnya</span>
        </button>
      </div>
    </nav>
  );
}

function NavTab({
  to,
  aktif,
  label,
  Ikon,
  exact,
}: {
  to: string;
  aktif: boolean;
  label: string;
  Ikon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  exact?: boolean;
}) {
  return (
    <Link
      to={to}
      activeOptions={{ exact }}
      className={cn(
        "flex min-w-14 flex-col items-center justify-center gap-1 rounded-xl py-1 transition-colors focus-visible:outline-2 focus-visible:outline-ring",
        aktif
          ? "text-primary font-semibold"
          : "text-muted-foreground hover:text-foreground font-medium"
      )}
    >
      <Ikon className="size-5" aria-hidden />
      <span className="text-[11px]">{label}</span>
    </Link>
  );
}
