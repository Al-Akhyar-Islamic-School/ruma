import { createFileRoute, redirect } from "@tanstack/react-router";
import { KategoriAdmin } from "@/features/admin/kategori-admin";
import { meQuery } from "@/lib/auth";

export const Route = createFileRoute("/_app/admin/kategori")({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (me?.role !== "superadmin") throw redirect({ to: "/admin/permintaan" });
  },
  component: KategoriAdmin,
});
