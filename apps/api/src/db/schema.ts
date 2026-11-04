import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  date,
  index,
  int,
  json,
  longtext,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

// superadmin: akses baca ke semua sesi. admin: moderasi permintaan & kelola user, TIDAK melihat sesi orang lain.
export const ROLES = ["superadmin", "admin", "kepsek", "wakasek", "notulis", "guru"] as const;
export type Role = (typeof ROLES)[number];

export const TIPE_SESI = ["rapat", "supervisi_kelas"] as const;
export type TipeSesi = (typeof TIPE_SESI)[number];

const id = () => bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey();
const ref = (name: string) => bigint(name, { mode: "number", unsigned: true });
const createdAt = () => timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`);
const updatedAt = () =>
  timestamp("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
    .onUpdateNow();

export const users = mysqlTable("ruma_users", {
  id: id(),
  // `sub` Google: identitas stabil; email bisa berubah.
  googleSub: varchar("google_sub", { length: 64 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  picture: varchar("picture", { length: 500 }),
  role: mysqlEnum("role", ROLES).notNull().default("guru"),
  // Izin khusus untuk "orang tertentu" di luar peran yang otomatis boleh membuat sesi.
  bisaMerekam: boolean("bisa_merekam").notNull().default(false),
  createdAt: createdAt(),
  lastLoginAt: timestamp("last_login_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const sessions = mysqlTable(
  "ruma_sessions",
  {
    // SHA-256 hex dari token cookie; token mentah tidak pernah disimpan.
    id: char("id", { length: 64 }).primaryKey(),
    userId: ref("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId), index("sessions_exp_idx").on(t.expiresAt)],
);

/** Metadata awal sesi (PRD FR-02). Rapat: kategori. Supervisi: guru, kelas, mapel, materi. */
export type SesiMetadata = {
  /** `kategoriRapat.kode`. */
  kategori?: string;
  guruEmail?: string;
  kelas?: string;
  mapel?: string;
  materi?: string;
  /** Detik sejak awal rekaman yang ditandai perekam sebagai momen penting (diisi saat finish). */
  penanda?: number[];
};

/** Seri Rapat (rapat berkala / rekursif, misal rapat mingguan) */
export const seriRapat = mysqlTable(
  "ruma_seri_rapat",
  {
    id: id(),
    ownerId: ref("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    nama: varchar("nama", { length: 255 }).notNull(),
    deskripsi: text("deskripsi"),
    googleDocsFileId: varchar("google_docs_file_id", { length: 255 }),
    googleDocsUrl: varchar("google_docs_url", { length: 500 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("seri_owner_idx").on(t.ownerId)]
);

export const sesi = mysqlTable(
  "ruma_sesi",
  {
    id: id(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),
    userId: ref("user_id")
      .notNull()
      .references(() => users.id),
    seriId: ref("seri_id").references(() => seriRapat.id, { onDelete: "set null" }),
    simgtkAgendaId: int("simgtk_agenda_id", { unsigned: true }),
    tipeSesi: mysqlEnum("tipe_sesi", TIPE_SESI).notNull(),
    judul: varchar("judul", { length: 255 }).notNull(),
    metadata: json("metadata").$type<SesiMetadata>().notNull(),
    // MIME yang dideklarasikan perekam; dipakai worker saat menyambung potongan audio.
    audioMime: varchar("audio_mime", { length: 100 }).notNull(),
    status: mysqlEnum("status", ["merekam", "mentranskrip", "menganalisis", "selesai", "gagal"])
      .notNull()
      .default("merekam"),
    // Berkas utuh hasil penyambungan chunk; diisi worker transkripsi.
    audioPath: varchar("audio_path", { length: 500 }),
    durasiDetik: int("durasi_detik", { unsigned: true }).notNull().default(0),
    // Batas durasi dari persetujuan admin; null = tanpa batas (pembuat dengan izin langsung).
    maksDurasiDetik: int("maks_durasi_detik", { unsigned: true }),
    audioSizeBytes: bigint("audio_size_bytes", { mode: "number", unsigned: true })
      .notNull()
      .default(0),
    // Antrean worker (src/worker.ts): sesi berstatus mentranskrip/menganalisis menunggu diproses.
    percobaan: int("percobaan", { unsigned: true }).notNull().default(0),
    dikunciOleh: char("dikunci_oleh", { length: 36 }),
    dikunciPada: timestamp("dikunci_pada"),
    // Backoff antar percobaan gagal; null = boleh diambil sekarang.
    cobaLagiSetelah: timestamp("coba_lagi_setelah"),
    galat: varchar("galat", { length: 1000 }),
    // Progres tahap transkripsi (bagian audio yang sudah ditranskrip); null di luar tahap itu.
    progresSelesai: int("progres_selesai", { unsigned: true }),
    progresTotal: int("progres_total", { unsigned: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("sesi_user_idx").on(t.userId, t.createdAt), index("sesi_antrean_idx").on(t.status, t.cobaLagiSetelah)],
);

export const audioChunks = mysqlTable(
  "ruma_audio_chunks",
  {
    id: id(),
    sesiId: ref("sesi_id")
      .notNull()
      .references(() => sesi.id, { onDelete: "cascade" }),
    seq: int("seq", { unsigned: true }).notNull(),
    storageKey: varchar("storage_key", { length: 500 }).notNull(),
    sizeBytes: int("size_bytes", { unsigned: true }).notNull(),
    createdAt: createdAt(),
  },
  // Unik per (sesi, seq): unggah ulang chunk yang sama menimpa, aman untuk retry offline.
  (t) => [uniqueIndex("chunks_sesi_seq_uq").on(t.sesiId, t.seq)],
);

export const PERMINTAAN_STATUS = ["menunggu", "disetujui", "ditolak"] as const;

/** Permintaan membuat sesi dari user tanpa izin langsung; harus disetujui admin dengan batas durasi. */
export const permintaanSesi = mysqlTable(
  "ruma_permintaan_sesi",
  {
    id: id(),
    userId: ref("user_id")
      .notNull()
      .references(() => users.id),
    tipeSesi: mysqlEnum("tipe_sesi", TIPE_SESI).notNull(),
    judul: varchar("judul", { length: 255 }).notNull(),
    metadata: json("metadata").$type<SesiMetadata>().notNull(),
    alasan: text("alasan").notNull(),
    durasiDimintaMenit: int("durasi_diminta_menit", { unsigned: true }).notNull(),
    status: mysqlEnum("status", PERMINTAAN_STATUS).notNull().default("menunggu"),
    durasiDiizinkanMenit: int("durasi_diizinkan_menit", { unsigned: true }),
    berlakuSampai: timestamp("berlaku_sampai"),
    catatanAdmin: varchar("catatan_admin", { length: 500 }),
    diputuskanOleh: ref("diputuskan_oleh").references(() => users.id),
    diputuskanPada: timestamp("diputuskan_pada"),
    // Terisi saat persetujuan dipakai; unik sehingga satu persetujuan = satu sesi.
    sesiId: ref("sesi_id")
      .unique()
      .references(() => sesi.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("permintaan_status_idx").on(t.status, t.createdAt), index("permintaan_user_idx").on(t.userId)],
);

export type Segment = { start: number; end: number; text: string };

export const transkrip = mysqlTable("ruma_transkrip", {
  id: id(),
  sesiId: ref("sesi_id")
    .notNull()
    .references(() => sesi.id, { onDelete: "cascade" }),
  rawText: longtext("raw_text").notNull(),
  segments: json("segments_json").$type<Segment[]>(),
  whisperModel: varchar("whisper_model", { length: 100 })
    .notNull()
    .default("@cf/openai/whisper-large-v3-turbo"),
  durasiTranskripMs: int("durasi_transkrip_ms", { unsigned: true }).notNull().default(0),
  createdAt: createdAt(),
  },
  // Satu transkrip per sesi: worker idempoten bila terhenti di tengah.
  (t) => [uniqueIndex("transkrip_sesi_uq").on(t.sesiId)],
);

export const dokumen = mysqlTable("ruma_dokumen", {
  id: id(),
  sesiId: ref("sesi_id")
    .notNull()
    .references(() => sesi.id, { onDelete: "cascade" }),
  // JSON notulen atau rubrik supervisi (kontrak di ARCHITECTURE.md §4).
  payload: json("payload_json").$type<Record<string, unknown>>().notNull(),
  guruTargetId: ref("guru_target_id").references(() => users.id),
  geminiModel: varchar("gemini_model", { length: 100 }),
  statusVerifikasi: mysqlEnum("status_verifikasi", ["draf", "disetujui"]).notNull().default("draf"),
  disetujuiOleh: ref("disetujui_oleh").references(() => users.id),
  disetujuiPada: timestamp("disetujui_pada"),
  // Ekspor ke Google Docs & Drive (OAuth Drive pengguna)
  googleDocsFileId: varchar("google_docs_file_id", { length: 255 }),
  googleDocsUrl: varchar("google_docs_url", { length: 500 }),
  googleDriveAudioFileId: varchar("google_drive_audio_file_id", { length: 255 }),
  googleDriveAudioUrl: varchar("google_drive_audio_url", { length: 500 }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const actionItems = mysqlTable("ruma_action_items", {
  id: id(),
  dokumenId: ref("dokumen_id")
    .notNull()
    .references(() => dokumen.id, { onDelete: "cascade" }),
  tugas: text("tugas").notNull(),
  detail: text("detail"),
  picNama: varchar("pic_nama", { length: 150 }).notNull(),
  picUserId: ref("pic_user_id").references(() => users.id),
  // Orang yang ditandai sebagai PIC dari direktori GTK (bisa belum pernah login). `picNama` tetap teks asli dari AI.
  picEmail: varchar("pic_email", { length: 255 }),
  tenggatWaktu: date("tenggat_waktu", { mode: "string" }),
  status: mysqlEnum("status", ["pending", "proses", "selesai"]).notNull().default("pending"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Token Google OAuth tambahan (Drive/Docs) per pengguna, disimpan terenkripsi di server. */
export const userTokens = mysqlTable("ruma_user_tokens", {
  userId: ref("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  tokenType: varchar("token_type", { length: 50 }).notNull().default("Bearer"),
  scope: text("scope").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export type User = typeof users.$inferSelect;

// --- Direktori GTK (sinkron dari SIM-GTK) ---

export const UNIT = ["TK", "SD", "SMP", "SMA", "YPI"] as const;
export type Unit = (typeof UNIT)[number];

/** Nama resmi guru/tenaga kependidikan per email, disalin dari SIM-GTK. Tidak harus sudah pernah login. */
export const gtk = mysqlTable("ruma_gtk", {
  email: varchar("email", { length: 255 }).primaryKey(), // huruf kecil
  simgtkId: int("simgtk_id", { unsigned: true }),
  namaResmi: varchar("nama_resmi", { length: 255 }).notNull(),
  // false = tidak lagi muncul di SIM-GTK; barisnya disimpan, keanggotaan unitnya dihapus.
  aktif: boolean("aktif").notNull().default(true),
  syncedAt: timestamp("synced_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

/** Keanggotaan unit (hanya GTK aktif). Satu orang bisa di lebih dari satu unit. */
export const gtkUnit = mysqlTable(
  "ruma_gtk_unit",
  {
    email: varchar("email", { length: 255 })
      .notNull()
      .references(() => gtk.email, { onDelete: "cascade" }),
    unit: mysqlEnum("unit", UNIT).notNull(),
  },
  (t) => [primaryKey({ columns: [t.email, t.unit] }), index("gtk_unit_idx").on(t.unit)],
);

// --- Grup undangan (dipakai berkali-kali) ---

export const grup = mysqlTable(
  "ruma_grup",
  {
    id: id(),
    ownerId: ref("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    nama: varchar("nama", { length: 100 }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("grup_owner_idx").on(t.ownerId)],
);

/** Anggota grup per email (bisa belum pernah login). */
export const grupAnggota = mysqlTable(
  "ruma_grup_anggota",
  {
    grupId: ref("grup_id")
      .notNull()
      .references(() => grup.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 255 }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.grupId, t.email] }), index("grup_anggota_email_idx").on(t.email)],
);

// --- Undangan sesi ---

export const TIPE_UNDANGAN = ["orang", "grup", "unit", "organisasi"] as const;
export type TipeUndangan = (typeof TIPE_UNDANGAN)[number];

/** Siapa yang boleh mendengarkan dan membaca sesi (selain perekamnya). */
export const sesiUndangan = mysqlTable(
  "ruma_sesi_undangan",
  {
    id: id(),
    sesiId: ref("sesi_id")
      .notNull()
      .references(() => sesi.id, { onDelete: "cascade" }),
    tipe: mysqlEnum("tipe", TIPE_UNDANGAN).notNull(),
    email: varchar("email", { length: 255 }),
    // Hapus grup = mencabut akses yang diberikan lewat grup itu.
    grupId: ref("grup_id").references(() => grup.id, { onDelete: "cascade" }),
    unit: mysqlEnum("unit", UNIT),
    // "orang:<email>" | "grup:<id>" | "unit:<UNIT>" | "organisasi": mencegah undangan ganda.
    targetKey: varchar("target_key", { length: 300 }).notNull(),
    dibuatOleh: ref("dibuat_oleh")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("undangan_sesi_target_uq").on(t.sesiId, t.targetKey),
    index("undangan_email_idx").on(t.email),
    index("undangan_grup_idx").on(t.grupId),
  ],
);

/** Pengaturan aplikasi (kunci -> nilai JSON), mis. saklar modul. Diubah superadmin lewat /admin/pengaturan. */
export const pengaturan = mysqlTable("ruma_pengaturan", {
  kunci: varchar("kunci", { length: 64 }).primaryKey(),
  nilai: json("nilai").$type<unknown>().notNull(),
  diubahOleh: ref("diubah_oleh").references(() => users.id),
  updatedAt: updatedAt(),
});

/**
 * Kategori rapat yang dikelola superadmin. `kode` stabil (disimpan di `sesi.metadata.kategori`), `nama` bisa diubah.
 * `terbatas`: rapat kategori ini hanya boleh dibuka untuk orang/grup tertentu, bukan unit/organisasi (ARCHITECTURE.md §5).
 */
export const kategoriRapat = mysqlTable("ruma_kategori_rapat", {
  id: id(),
  kode: varchar("kode", { length: 40 }).notNull().unique(),
  nama: varchar("nama", { length: 100 }).notNull(),
  terbatas: boolean("terbatas").notNull().default(false),
  aktif: boolean("aktif").notNull().default(true),
  urutan: int("urutan").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
