import { readFile } from "node:fs/promises";
import { sql } from "drizzle-orm";
import { db } from "./index.js";

/**
 * Jumlah migrasi di `drizzle/meta/_journal.json` yang belum tercatat di database. 0 = skema mutakhir.
 * Kode yang lebih baru dari skema menyebabkan 500 ("Unknown column"), jadi ini dicek saat start dan di /health.
 */
export async function migrasiTertinggal(): Promise<number> {
  const jurnal = JSON.parse(
    await readFile(new URL("../../drizzle/meta/_journal.json", import.meta.url), "utf8"),
  ) as { entries: unknown[] };
  let terpasang = 0;
  try {
    const [rows] = (await db.execute(sql`select count(*) as n from __drizzle_migrations`)) as unknown as [{ n: number }[]];
    terpasang = Number(rows[0]?.n ?? 0);
  } catch {
    // Tabel belum ada: database belum pernah dimigrasi.
  }
  return Math.max(jurnal.entries.length - terpasang, 0);
}
