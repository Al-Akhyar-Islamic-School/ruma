import { createFileRoute, redirect } from "@tanstack/react-router";
import { PageLoading } from "@/components/app/feedback";
import { Shell } from "@/components/app/shell";
import { meQuery } from "@/lib/auth";

// Semua halaman di bawah _app wajib login. 401 dari /auth/me -> null -> ke /login.
export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (!me) throw redirect({ to: "/login", search: { error: undefined } });
  },
  pendingComponent: () => (
    <div className="mx-auto max-w-md p-6">
      <PageLoading />
    </div>
  ),
  component: Shell,
});
