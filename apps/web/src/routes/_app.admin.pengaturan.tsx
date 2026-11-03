import { createFileRoute, redirect } from "@tanstack/react-router";
import { PengaturanAdmin } from "@/features/admin/pengaturan-admin";
import { meQuery } from "@/lib/auth";

export const Route = createFileRoute("/_app/admin/pengaturan")({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (me?.role !== "superadmin") throw redirect({ to: "/admin/permintaan" });
  },
  component: PengaturanAdmin,
});
