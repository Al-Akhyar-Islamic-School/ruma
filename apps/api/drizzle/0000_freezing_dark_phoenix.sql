CREATE TABLE `kalam_action_items` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`dokumen_id` bigint unsigned NOT NULL,
	`tugas` text NOT NULL,
	`pic_nama` varchar(150) NOT NULL,
	`pic_user_id` bigint unsigned,
	`tenggat_waktu` date,
	`status` enum('pending','proses','selesai') NOT NULL DEFAULT 'pending',
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `kalam_action_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `kalam_audio_chunks` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`sesi_id` bigint unsigned NOT NULL,
	`seq` int unsigned NOT NULL,
	`storage_key` varchar(500) NOT NULL,
	`size_bytes` int unsigned NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `kalam_audio_chunks_id` PRIMARY KEY(`id`),
	CONSTRAINT `chunks_sesi_seq_uq` UNIQUE(`sesi_id`,`seq`)
);
--> statement-breakpoint
CREATE TABLE `kalam_dokumen` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`sesi_id` bigint unsigned NOT NULL,
	`payload_json` json NOT NULL,
	`guru_target_id` bigint unsigned,
	`gemini_model` varchar(100),
	`status_verifikasi` enum('draf','disetujui') NOT NULL DEFAULT 'draf',
	`disetujui_oleh` bigint unsigned,
	`disetujui_pada` timestamp,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `kalam_dokumen_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `kalam_grup` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`owner_id` bigint unsigned NOT NULL,
	`nama` varchar(100) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `kalam_grup_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `kalam_grup_anggota` (
	`grup_id` bigint unsigned NOT NULL,
	`email` varchar(255) NOT NULL,
	CONSTRAINT `kalam_grup_anggota_grup_id_email_pk` PRIMARY KEY(`grup_id`,`email`)
);
--> statement-breakpoint
CREATE TABLE `kalam_gtk` (
	`email` varchar(255) NOT NULL,
	`simgtk_id` int unsigned,
	`nama_resmi` varchar(255) NOT NULL,
	`aktif` boolean NOT NULL DEFAULT true,
	`synced_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `kalam_gtk_email` PRIMARY KEY(`email`)
);
--> statement-breakpoint
CREATE TABLE `kalam_gtk_unit` (
	`email` varchar(255) NOT NULL,
	`unit` enum('TK','SD','SMP','SMA') NOT NULL,
	CONSTRAINT `kalam_gtk_unit_email_unit_pk` PRIMARY KEY(`email`,`unit`)
);
--> statement-breakpoint
CREATE TABLE `kalam_permintaan_sesi` (
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
	CONSTRAINT `kalam_permintaan_sesi_id` PRIMARY KEY(`id`),
	CONSTRAINT `kalam_permintaan_sesi_sesi_id_unique` UNIQUE(`sesi_id`)
);
--> statement-breakpoint
CREATE TABLE `kalam_sesi` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`uuid` char(36) NOT NULL,
	`user_id` bigint unsigned NOT NULL,
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
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `kalam_sesi_id` PRIMARY KEY(`id`),
	CONSTRAINT `kalam_sesi_uuid_unique` UNIQUE(`uuid`)
);
--> statement-breakpoint
CREATE TABLE `kalam_sesi_undangan` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`sesi_id` bigint unsigned NOT NULL,
	`tipe` enum('orang','grup','unit','organisasi') NOT NULL,
	`email` varchar(255),
	`grup_id` bigint unsigned,
	`unit` enum('TK','SD','SMP','SMA'),
	`target_key` varchar(300) NOT NULL,
	`dibuat_oleh` bigint unsigned NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `kalam_sesi_undangan_id` PRIMARY KEY(`id`),
	CONSTRAINT `undangan_sesi_target_uq` UNIQUE(`sesi_id`,`target_key`)
);
--> statement-breakpoint
CREATE TABLE `kalam_sessions` (
	`id` char(64) NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `kalam_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `kalam_transkrip` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`sesi_id` bigint unsigned NOT NULL,
	`raw_text` longtext NOT NULL,
	`segments_json` json,
	`whisper_model` varchar(100) NOT NULL DEFAULT '@cf/openai/whisper-large-v3-turbo',
	`durasi_transkrip_ms` int unsigned NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `kalam_transkrip_id` PRIMARY KEY(`id`),
	CONSTRAINT `transkrip_sesi_uq` UNIQUE(`sesi_id`)
);
--> statement-breakpoint
CREATE TABLE `kalam_users` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`google_sub` varchar(64) NOT NULL,
	`email` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`picture` varchar(500),
	`role` enum('superadmin','admin','kepsek','wakasek','notulis','guru') NOT NULL DEFAULT 'guru',
	`bisa_merekam` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`last_login_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `kalam_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `kalam_users_google_sub_unique` UNIQUE(`google_sub`),
	CONSTRAINT `kalam_users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `kalam_action_items` ADD CONSTRAINT `kalam_action_items_dokumen_id_kalam_dokumen_id_fk` FOREIGN KEY (`dokumen_id`) REFERENCES `kalam_dokumen`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `kalam_action_items` ADD CONSTRAINT `kalam_action_items_pic_user_id_kalam_users_id_fk` FOREIGN KEY (`pic_user_id`) REFERENCES `kalam_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `kalam_audio_chunks` ADD CONSTRAINT `kalam_audio_chunks_sesi_id_kalam_sesi_id_fk` FOREIGN KEY (`sesi_id`) REFERENCES `kalam_sesi`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `kalam_dokumen` ADD CONSTRAINT `kalam_dokumen_sesi_id_kalam_sesi_id_fk` FOREIGN KEY (`sesi_id`) REFERENCES `kalam_sesi`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `kalam_dokumen` ADD CONSTRAINT `kalam_dokumen_guru_target_id_kalam_users_id_fk` FOREIGN KEY (`guru_target_id`) REFERENCES `kalam_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `kalam_dokumen` ADD CONSTRAINT `kalam_dokumen_disetujui_oleh_kalam_users_id_fk` FOREIGN KEY (`disetujui_oleh`) REFERENCES `kalam_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `kalam_grup` ADD CONSTRAINT `kalam_grup_owner_id_kalam_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `kalam_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `kalam_grup_anggota` ADD CONSTRAINT `kalam_grup_anggota_grup_id_kalam_grup_id_fk` FOREIGN KEY (`grup_id`) REFERENCES `kalam_grup`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `kalam_gtk_unit` ADD CONSTRAINT `kalam_gtk_unit_email_kalam_gtk_email_fk` FOREIGN KEY (`email`) REFERENCES `kalam_gtk`(`email`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `kalam_permintaan_sesi` ADD CONSTRAINT `kalam_permintaan_sesi_user_id_kalam_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `kalam_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `kalam_permintaan_sesi` ADD CONSTRAINT `kalam_permintaan_sesi_diputuskan_oleh_kalam_users_id_fk` FOREIGN KEY (`diputuskan_oleh`) REFERENCES `kalam_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `kalam_permintaan_sesi` ADD CONSTRAINT `kalam_permintaan_sesi_sesi_id_kalam_sesi_id_fk` FOREIGN KEY (`sesi_id`) REFERENCES `kalam_sesi`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `kalam_sesi` ADD CONSTRAINT `kalam_sesi_user_id_kalam_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `kalam_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `kalam_sesi_undangan` ADD CONSTRAINT `kalam_sesi_undangan_sesi_id_kalam_sesi_id_fk` FOREIGN KEY (`sesi_id`) REFERENCES `kalam_sesi`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `kalam_sesi_undangan` ADD CONSTRAINT `kalam_sesi_undangan_grup_id_kalam_grup_id_fk` FOREIGN KEY (`grup_id`) REFERENCES `kalam_grup`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `kalam_sesi_undangan` ADD CONSTRAINT `kalam_sesi_undangan_dibuat_oleh_kalam_users_id_fk` FOREIGN KEY (`dibuat_oleh`) REFERENCES `kalam_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `kalam_sessions` ADD CONSTRAINT `kalam_sessions_user_id_kalam_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `kalam_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `kalam_transkrip` ADD CONSTRAINT `kalam_transkrip_sesi_id_kalam_sesi_id_fk` FOREIGN KEY (`sesi_id`) REFERENCES `kalam_sesi`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `grup_owner_idx` ON `kalam_grup` (`owner_id`);--> statement-breakpoint
CREATE INDEX `grup_anggota_email_idx` ON `kalam_grup_anggota` (`email`);--> statement-breakpoint
CREATE INDEX `gtk_unit_idx` ON `kalam_gtk_unit` (`unit`);--> statement-breakpoint
CREATE INDEX `permintaan_status_idx` ON `kalam_permintaan_sesi` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `permintaan_user_idx` ON `kalam_permintaan_sesi` (`user_id`);--> statement-breakpoint
CREATE INDEX `sesi_user_idx` ON `kalam_sesi` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `sesi_antrean_idx` ON `kalam_sesi` (`status`,`coba_lagi_setelah`);--> statement-breakpoint
CREATE INDEX `undangan_email_idx` ON `kalam_sesi_undangan` (`email`);--> statement-breakpoint
CREATE INDEX `undangan_grup_idx` ON `kalam_sesi_undangan` (`grup_id`);--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `kalam_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_exp_idx` ON `kalam_sessions` (`expires_at`);