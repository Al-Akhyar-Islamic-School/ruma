CREATE TABLE `ruma_action_items` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`dokumen_id` bigint unsigned NOT NULL,
	`tugas` text NOT NULL,
	`pic_nama` varchar(150) NOT NULL,
	`pic_user_id` bigint unsigned,
	`pic_email` varchar(255),
	`tenggat_waktu` date,
	`status` enum('pending','proses','selesai') NOT NULL DEFAULT 'pending',
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ruma_action_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ruma_audio_chunks` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`sesi_id` bigint unsigned NOT NULL,
	`seq` int unsigned NOT NULL,
	`storage_key` varchar(500) NOT NULL,
	`size_bytes` int unsigned NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `ruma_audio_chunks_id` PRIMARY KEY(`id`),
	CONSTRAINT `chunks_sesi_seq_uq` UNIQUE(`sesi_id`,`seq`)
);
--> statement-breakpoint
CREATE TABLE `ruma_dokumen` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`sesi_id` bigint unsigned NOT NULL,
	`payload_json` json NOT NULL,
	`guru_target_id` bigint unsigned,
	`gemini_model` varchar(100),
	`status_verifikasi` enum('draf','disetujui') NOT NULL DEFAULT 'draf',
	`disetujui_oleh` bigint unsigned,
	`disetujui_pada` timestamp,
	`google_docs_file_id` varchar(255),
	`google_docs_url` varchar(500),
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ruma_dokumen_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ruma_grup` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`owner_id` bigint unsigned NOT NULL,
	`nama` varchar(100) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ruma_grup_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ruma_grup_anggota` (
	`grup_id` bigint unsigned NOT NULL,
	`email` varchar(255) NOT NULL,
	CONSTRAINT `ruma_grup_anggota_grup_id_email_pk` PRIMARY KEY(`grup_id`,`email`)
);
--> statement-breakpoint
CREATE TABLE `ruma_gtk` (
	`email` varchar(255) NOT NULL,
	`simgtk_id` int unsigned,
	`nama_resmi` varchar(255) NOT NULL,
	`aktif` boolean NOT NULL DEFAULT true,
	`synced_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `ruma_gtk_email` PRIMARY KEY(`email`)
);
--> statement-breakpoint
CREATE TABLE `ruma_gtk_unit` (
	`email` varchar(255) NOT NULL,
	`unit` enum('TK','SD','SMP','SMA','YPI') NOT NULL,
	CONSTRAINT `ruma_gtk_unit_email_unit_pk` PRIMARY KEY(`email`,`unit`)
);
--> statement-breakpoint
CREATE TABLE `ruma_kategori_rapat` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`kode` varchar(40) NOT NULL,
	`nama` varchar(100) NOT NULL,
	`terbatas` boolean NOT NULL DEFAULT false,
	`aktif` boolean NOT NULL DEFAULT true,
	`urutan` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ruma_kategori_rapat_id` PRIMARY KEY(`id`),
	CONSTRAINT `ruma_kategori_rapat_kode_unique` UNIQUE(`kode`)
);
--> statement-breakpoint
CREATE TABLE `ruma_pengaturan` (
	`kunci` varchar(64) NOT NULL,
	`nilai` json NOT NULL,
	`diubah_oleh` bigint unsigned,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ruma_pengaturan_kunci` PRIMARY KEY(`kunci`)
);
--> statement-breakpoint
CREATE TABLE `ruma_permintaan_sesi` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`tipe_sesi` enum('rapat','supervisi_kelas') NOT NULL,
	`judul` varchar(255) NOT NULL,
	`metadata` json NOT NULL,
	`alasan` text NOT NULL,
	`durasi_diminta_menit` int unsigned NOT NULL,
	`status` enum('menunggu','disetujui','ditolak') NOT NULL DEFAULT 'menunggu',
	`durasi_diizinkan_menit` int unsigned,
	`berlaku_sampai` timestamp,
	`catatan_admin` varchar(500),
	`diputuskan_oleh` bigint unsigned,
	`diputuskan_pada` timestamp,
	`sesi_id` bigint unsigned,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ruma_permintaan_sesi_id` PRIMARY KEY(`id`),
	CONSTRAINT `ruma_permintaan_sesi_sesi_id_unique` UNIQUE(`sesi_id`)
);
--> statement-breakpoint
CREATE TABLE `ruma_seri_rapat` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`owner_id` bigint unsigned NOT NULL,
	`nama` varchar(255) NOT NULL,
	`deskripsi` text,
	`google_docs_file_id` varchar(255),
	`google_docs_url` varchar(500),
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ruma_seri_rapat_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ruma_sesi` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`uuid` char(36) NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`seri_id` bigint unsigned,
	`tipe_sesi` enum('rapat','supervisi_kelas') NOT NULL,
	`judul` varchar(255) NOT NULL,
	`metadata` json NOT NULL,
	`audio_mime` varchar(100) NOT NULL,
	`status` enum('merekam','mentranskrip','menganalisis','selesai','gagal') NOT NULL DEFAULT 'merekam',
	`audio_path` varchar(500),
	`durasi_detik` int unsigned NOT NULL DEFAULT 0,
	`maks_durasi_detik` int unsigned,
	`audio_size_bytes` bigint unsigned NOT NULL DEFAULT 0,
	`percobaan` int unsigned NOT NULL DEFAULT 0,
	`dikunci_oleh` char(36),
	`dikunci_pada` timestamp,
	`coba_lagi_setelah` timestamp,
	`galat` varchar(1000),
	`progres_selesai` int unsigned,
	`progres_total` int unsigned,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ruma_sesi_id` PRIMARY KEY(`id`),
	CONSTRAINT `ruma_sesi_uuid_unique` UNIQUE(`uuid`)
);
--> statement-breakpoint
CREATE TABLE `ruma_sesi_undangan` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`sesi_id` bigint unsigned NOT NULL,
	`tipe` enum('orang','grup','unit','organisasi') NOT NULL,
	`email` varchar(255),
	`grup_id` bigint unsigned,
	`unit` enum('TK','SD','SMP','SMA','YPI'),
	`target_key` varchar(300) NOT NULL,
	`dibuat_oleh` bigint unsigned NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `ruma_sesi_undangan_id` PRIMARY KEY(`id`),
	CONSTRAINT `undangan_sesi_target_uq` UNIQUE(`sesi_id`,`target_key`)
);
--> statement-breakpoint
CREATE TABLE `ruma_sessions` (
	`id` char(64) NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `ruma_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ruma_transkrip` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`sesi_id` bigint unsigned NOT NULL,
	`raw_text` longtext NOT NULL,
	`segments_json` json,
	`whisper_model` varchar(100) NOT NULL DEFAULT '@cf/openai/whisper-large-v3-turbo',
	`durasi_transkrip_ms` int unsigned NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `ruma_transkrip_id` PRIMARY KEY(`id`),
	CONSTRAINT `transkrip_sesi_uq` UNIQUE(`sesi_id`)
);
--> statement-breakpoint
CREATE TABLE `ruma_user_tokens` (
	`user_id` bigint unsigned NOT NULL,
	`access_token` text NOT NULL,
	`refresh_token` text,
	`token_type` varchar(50) NOT NULL DEFAULT 'Bearer',
	`scope` text NOT NULL,
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ruma_user_tokens_user_id` PRIMARY KEY(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `ruma_users` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`google_sub` varchar(64) NOT NULL,
	`email` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`picture` varchar(500),
	`role` enum('superadmin','admin','kepsek','wakasek','notulis','guru') NOT NULL DEFAULT 'guru',
	`bisa_merekam` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`last_login_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `ruma_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `ruma_users_google_sub_unique` UNIQUE(`google_sub`),
	CONSTRAINT `ruma_users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `ruma_action_items` ADD CONSTRAINT `ruma_action_items_dokumen_id_ruma_dokumen_id_fk` FOREIGN KEY (`dokumen_id`) REFERENCES `ruma_dokumen`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ruma_action_items` ADD CONSTRAINT `ruma_action_items_pic_user_id_ruma_users_id_fk` FOREIGN KEY (`pic_user_id`) REFERENCES `ruma_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ruma_audio_chunks` ADD CONSTRAINT `ruma_audio_chunks_sesi_id_ruma_sesi_id_fk` FOREIGN KEY (`sesi_id`) REFERENCES `ruma_sesi`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ruma_dokumen` ADD CONSTRAINT `ruma_dokumen_sesi_id_ruma_sesi_id_fk` FOREIGN KEY (`sesi_id`) REFERENCES `ruma_sesi`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ruma_dokumen` ADD CONSTRAINT `ruma_dokumen_guru_target_id_ruma_users_id_fk` FOREIGN KEY (`guru_target_id`) REFERENCES `ruma_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ruma_dokumen` ADD CONSTRAINT `ruma_dokumen_disetujui_oleh_ruma_users_id_fk` FOREIGN KEY (`disetujui_oleh`) REFERENCES `ruma_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ruma_grup` ADD CONSTRAINT `ruma_grup_owner_id_ruma_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `ruma_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ruma_grup_anggota` ADD CONSTRAINT `ruma_grup_anggota_grup_id_ruma_grup_id_fk` FOREIGN KEY (`grup_id`) REFERENCES `ruma_grup`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ruma_gtk_unit` ADD CONSTRAINT `ruma_gtk_unit_email_ruma_gtk_email_fk` FOREIGN KEY (`email`) REFERENCES `ruma_gtk`(`email`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ruma_pengaturan` ADD CONSTRAINT `ruma_pengaturan_diubah_oleh_ruma_users_id_fk` FOREIGN KEY (`diubah_oleh`) REFERENCES `ruma_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ruma_permintaan_sesi` ADD CONSTRAINT `ruma_permintaan_sesi_user_id_ruma_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `ruma_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ruma_permintaan_sesi` ADD CONSTRAINT `ruma_permintaan_sesi_diputuskan_oleh_ruma_users_id_fk` FOREIGN KEY (`diputuskan_oleh`) REFERENCES `ruma_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ruma_permintaan_sesi` ADD CONSTRAINT `ruma_permintaan_sesi_sesi_id_ruma_sesi_id_fk` FOREIGN KEY (`sesi_id`) REFERENCES `ruma_sesi`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ruma_seri_rapat` ADD CONSTRAINT `ruma_seri_rapat_owner_id_ruma_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `ruma_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ruma_sesi` ADD CONSTRAINT `ruma_sesi_user_id_ruma_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `ruma_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ruma_sesi` ADD CONSTRAINT `ruma_sesi_seri_id_ruma_seri_rapat_id_fk` FOREIGN KEY (`seri_id`) REFERENCES `ruma_seri_rapat`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ruma_sesi_undangan` ADD CONSTRAINT `ruma_sesi_undangan_sesi_id_ruma_sesi_id_fk` FOREIGN KEY (`sesi_id`) REFERENCES `ruma_sesi`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ruma_sesi_undangan` ADD CONSTRAINT `ruma_sesi_undangan_grup_id_ruma_grup_id_fk` FOREIGN KEY (`grup_id`) REFERENCES `ruma_grup`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ruma_sesi_undangan` ADD CONSTRAINT `ruma_sesi_undangan_dibuat_oleh_ruma_users_id_fk` FOREIGN KEY (`dibuat_oleh`) REFERENCES `ruma_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ruma_sessions` ADD CONSTRAINT `ruma_sessions_user_id_ruma_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `ruma_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ruma_transkrip` ADD CONSTRAINT `ruma_transkrip_sesi_id_ruma_sesi_id_fk` FOREIGN KEY (`sesi_id`) REFERENCES `ruma_sesi`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ruma_user_tokens` ADD CONSTRAINT `ruma_user_tokens_user_id_ruma_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `ruma_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `grup_owner_idx` ON `ruma_grup` (`owner_id`);--> statement-breakpoint
CREATE INDEX `grup_anggota_email_idx` ON `ruma_grup_anggota` (`email`);--> statement-breakpoint
CREATE INDEX `gtk_unit_idx` ON `ruma_gtk_unit` (`unit`);--> statement-breakpoint
CREATE INDEX `permintaan_status_idx` ON `ruma_permintaan_sesi` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `permintaan_user_idx` ON `ruma_permintaan_sesi` (`user_id`);--> statement-breakpoint
CREATE INDEX `seri_owner_idx` ON `ruma_seri_rapat` (`owner_id`);--> statement-breakpoint
CREATE INDEX `sesi_user_idx` ON `ruma_sesi` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `sesi_antrean_idx` ON `ruma_sesi` (`status`,`coba_lagi_setelah`);--> statement-breakpoint
CREATE INDEX `undangan_email_idx` ON `ruma_sesi_undangan` (`email`);--> statement-breakpoint
CREATE INDEX `undangan_grup_idx` ON `ruma_sesi_undangan` (`grup_id`);--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `ruma_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_exp_idx` ON `ruma_sessions` (`expires_at`);--> statement-breakpoint
-- Kategori rapat bawaan ruma.
INSERT INTO `ruma_kategori_rapat` (`kode`, `nama`, `terbatas`, `urutan`) VALUES ('pleno', 'Rapat pleno', false, 1), ('kurikulum', 'Rapat kurikulum', false, 2), ('komite', 'Rapat komite', false, 3), ('pimpinan', 'Rapat pimpinan', true, 4);
