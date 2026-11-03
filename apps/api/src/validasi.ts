import { z } from "zod";

/** Email yang divalidasi lalu dinormalkan ke huruf kecil (kunci pencocokan di semua tabel). */
export const emailBaku = z.email().transform((e) => e.toLowerCase());
