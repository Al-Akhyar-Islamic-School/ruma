import { useQueryClient } from "@tanstack/react-query";
import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { BookOpenTextIcon, HomeIcon, LogOutIcon, MenuIcon, MonitorIcon, MoonIcon, ShieldCheckIcon, SunIcon, UsersIcon, FilePlus2Icon, CheckCircle2Icon, CloudIcon, UnlinkIcon } from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { api, ok, pesanGalat } from "@/lib/api";
import { hapusCadanganMe, type Me, meQuery, useMe } from "@/lib/auth";
import { setTema, type Tema, useTema } from "@/lib/theme";
import { toast } from "sonner";

import { BottomNav } from "./bottom-nav";
export const ROLE_LABEL: Record<Me["role"], string> = {
  superadmin: "Super admin",
  admin: "Admin",
  kepsek: "Kepala sekolah",
  wakasek: "Wakil kepala sekolah",
  notulis: "Notulis",
  guru: "Guru",
};

export const inisial = (nama: string) =>
  nama
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((k) => k[0]!.toUpperCase())
    .join("");

/** Kerangka halaman: bilah atas + menu samping. Halaman layar penuh (perekam) menutupinya dengan `fixed inset-0`. */
export function Shell() {
  const me = useMe();
  const [menu, setMenu] = useState(false);
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-1 px-2">
          <Button variant="ghost" size="icon" aria-label="Buka menu" onClick={() => setMenu(true)}>
            <MenuIcon />
          </Button>
          <Link to="/" className="text-lg font-extrabold tracking-tight">
            ruma.
          </Link>
          <button
            type="button"
            onClick={() => setMenu(true)}
            aria-label={`Akun ${me.name}`}
            className="ml-auto rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Avatar className="size-10">
              {me.picture && <AvatarImage src={me.picture} alt="" referrerPolicy="no-referrer" />}
              <AvatarFallback>{inisial(me.name)}</AvatarFallback>
            </Avatar>
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 pt-4 pb-24">
        <Outlet />
      </main>
      <BottomNav me={me} onOpenMenu={() => setMenu(true)} />
      <MenuSamping open={menu} onClose={() => setMenu(false)} me={me} />
    </div>
  );
}

const TEMA = [
  { value: "system", label: "Sistem", Ikon: MonitorIcon },
  { value: "light", label: "Terang", Ikon: SunIcon },
  { value: "dark", label: "Gelap", Ikon: MoonIcon },
] as const;

function MenuSamping({ open, onClose, me }: { open: boolean; onClose: () => void; me: Me }) {
  const tema = useTema();
  const qc = useQueryClient();
  const navigate = useNavigate();

  async function putusDrive() {
    try {
      await ok(await api.auth.google.drive.$delete());
      toast.success("Sambungan Google Drive diputuskan");
      await qc.invalidateQueries({ queryKey: meQuery.queryKey });
    } catch (e) {
      toast.error(pesanGalat(e));
    }
  }
  async function keluar() {
    try {
      onClose();
      await ok(await api.auth.logout.$post());
      hapusCadanganMe();
      // Pindah halaman LEBIH DULU sebelum cache di-clear. Bila cache dibersihkan duluan, komponen di dalam _app
      // yang memanggil useMe() (mis. Shell header) re-render dan melempar "Belum login", memicu error boundary
      // layar penuh sesaat ("Terjadi kesalahan") tepat sebelum navigasi selesai.
      await navigate({ to: "/login", search: { error: undefined }, replace: true });
      qc.removeQueries({ queryKey: meQuery.queryKey });
    } catch (e) {
      toast.error(pesanGalat(e));
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="left" className="w-[85%] gap-0 p-0 pt-[env(safe-area-inset-top)] sm:max-w-sm">
        <SheetHeader className="gap-3 p-5">
          <div className="flex items-center gap-3">
            <Avatar className="size-12">
              {me.picture && <AvatarImage src={me.picture} alt="" referrerPolicy="no-referrer" />}
              <AvatarFallback>{inisial(me.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 text-left">
              <SheetTitle className="truncate text-base">{me.namaResmi ?? me.name}</SheetTitle>
              <SheetDescription className="truncate">{me.email}</SheetDescription>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary">{ROLE_LABEL[me.role]}</Badge>
            {me.units.map((u) => (
              <Badge key={u} variant="outline">
                {u}
              </Badge>
            ))}
          </div>
        </SheetHeader>
        <Separator />
        <nav className="flex flex-col gap-1 p-3" aria-label="Menu utama">
          <NavLink to="/" Ikon={HomeIcon} onClick={onClose}>
            Beranda
          </NavLink>
          {!me.bisaBuatSesiLangsung && (
            <NavLink to="/permintaan" Ikon={FilePlus2Icon} onClick={onClose}>
              Permintaan rekaman
            </NavLink>
          )}
          <NavLink to="/pengetahuan" Ikon={BookOpenTextIcon} onClick={onClose}>
            Pengetahuan
          </NavLink>
          <NavLink to="/grup" Ikon={UsersIcon} onClick={onClose}>
            Grup undangan
          </NavLink>
          {me.moderator && (
            <NavLink to="/admin" Ikon={ShieldCheckIcon} onClick={onClose}>
              Admin
            </NavLink>
          )}
        </nav>
        <div className="mt-auto space-y-4 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="space-y-2 rounded-2xl border p-3 bg-muted/30">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold">
                <CloudIcon className="size-4 text-primary" /> Google Drive
              </span>
              {me.driveTersambung ? (
                <Badge variant="outline" className="gap-1 border-success/30 bg-success/10 text-success text-[10px]">
                  <CheckCircle2Icon className="size-3" /> Tersambung
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] text-muted-foreground">Belum aktif</Badge>
              )}
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {me.driveTersambung
                ? "Notulen yang disetujui dapat diekspor langsung ke Google Docs di Drive Anda."
                : "Sambungkan untuk menyimpan dan mengekspor notulen langsung ke Google Docs Anda."}
            </p>
            {me.driveTersambung ? (
              <Button variant="ghost" size="xs" onClick={putusDrive} className="w-full text-destructive hover:bg-destructive/10">
                <UnlinkIcon className="size-3.5" /> Putuskan sambungan
              </Button>
            ) : (
              <Button variant="outline" size="sm" asChild className="w-full h-9 text-xs">
                <a href={`${api.auth.google.drive.$url()}`}>
                  Sambungkan Drive Saya
                </a>
              </Button>
            )}
          </div>

          <p className="text-sm font-semibold">Tampilan</p>
          <ToggleGroup
            type="single"
            value={tema}
            onValueChange={(v) => v && setTema(v as Tema)}
            aria-label="Tema tampilan"
            className="grid w-full grid-cols-3 gap-1 rounded-2xl bg-secondary p-1"
          >
            {TEMA.map(({ value, label, Ikon }) => (
              <ToggleGroupItem
                key={value}
                value={value}
                className="h-11 gap-1.5 rounded-xl text-xs font-semibold data-[state=on]:bg-card data-[state=on]:text-primary data-[state=on]:shadow-sm"
              >
                <Ikon className="size-4" aria-hidden />
                {label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Button variant="outline" className="w-full" onClick={keluar}>
            <LogOutIcon /> Keluar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function NavLink({
  to,
  Ikon,
  onClick,
  children,
}: {
  to: "/" | "/permintaan" | "/pengetahuan" | "/grup" | "/admin";
  Ikon: typeof HomeIcon;
  onClick: () => void;
  children: string;
}) {
  return (
    <Button asChild variant="ghost" className="justify-start gap-3 text-base font-medium" onClick={onClick}>
      <Link to={to} activeOptions={{ exact: to === "/" }} activeProps={{ className: "bg-accent text-accent-foreground" }}>
        <Ikon aria-hidden />
        {children}
      </Link>
    </Button>
  );
}
