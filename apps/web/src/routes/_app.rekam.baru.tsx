import { createFileRoute } from "@tanstack/react-router";
import { HalamanRekamBaru } from "@/features/rekam/form-setup";

export const Route = createFileRoute("/_app/rekam/baru")({ component: HalamanRekamBaru });
