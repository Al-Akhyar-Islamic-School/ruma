import { createFileRoute } from "@tanstack/react-router";
import { PenggunaAdmin } from "@/features/admin/pengguna-admin";

export const Route = createFileRoute("/_app/admin/pengguna")({ component: PenggunaAdmin });
