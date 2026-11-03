import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { meQuery, useMe } from "@/lib/auth";

export const Route = createFileRoute("/_app/admin")({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (!me?.moderator) throw redirect({ to: "/" });
  },
  component: AdminLayout,
});

const TAB_UMUM = [
  { to: "/admin/permintaan", label: "Permintaan" },
  { to: "/admin/pengguna", label: "Pengguna" },
  { to: "/admin/antrean", label: "Antrean" },
  { to: "/admin/gtk", label: "GTK" },
] as const;

type TujuanTab = (typeof TAB_UMUM)[number]["to"] | "/admin/sesi" | "/admin/pengaturan";

function AdminLayout() {
  const me = useMe();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold tracking-tight">Admin</h1>
      {/* Membungkus ke baris kedua (bukan menggulir): semua bagian, termasuk Pengaturan, selalu terlihat. */}
      <nav aria-label="Bagian admin" className="flex flex-wrap gap-x-1 border-b">
        {TAB_UMUM.map((t) => (
          <TabLink key={t.to} to={t.to}>
            {t.label}
          </TabLink>
        ))}
        {me.role === "superadmin" && <TabLink to="/admin/sesi">Semua sesi</TabLink>}
        {me.role === "superadmin" && <TabLink to="/admin/pengaturan">Pengaturan</TabLink>}
      </nav>
      <Outlet />
    </div>
  );
}

function TabLink({ to, children }: { to: TujuanTab; children: string }) {
  return (
    <Link
      to={to}
      className="-mb-px inline-flex h-12 shrink-0 items-center border-b-2 border-transparent px-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      activeProps={{ className: "border-primary text-primary hover:text-primary", "aria-current": "page" }}
    >
      {children}
    </Link>
  );
}
