import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Link, Outlet } from "@tanstack/react-router";
import { ErrorNotice } from "@/components/app/feedback";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: () => (
    <TooltipProvider>
      <Outlet />
      <Toaster position="top-center" />
    </TooltipProvider>
  ),
  errorComponent: ({ error, reset }) => (
    <div className="mx-auto max-w-md p-6">
      <ErrorNotice error={error} onRetry={reset} title="Terjadi kesalahan" />
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 p-10 text-center">
      <p className="text-lg font-semibold">Halaman tidak ditemukan</p>
      <Button asChild>
        <Link to="/">Kembali ke beranda</Link>
      </Button>
    </div>
  ),
});
