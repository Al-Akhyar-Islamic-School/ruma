import { createFileRoute, redirect } from "@tanstack/react-router";
import { SemuaSesiAdmin } from "@/features/admin/semua-sesi-admin";
import { meQuery } from "@/lib/auth";

export const Route = createFileRoute("/_app/admin/sesi")({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (me?.role !== "superadmin") throw redirect({ to: "/admin/permintaan" });
  },
  component: SemuaSesiAdmin,
});
