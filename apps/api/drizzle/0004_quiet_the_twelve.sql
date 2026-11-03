CREATE TABLE `kalam_kategori_rapat` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`kode` varchar(40) NOT NULL,
	`nama` varchar(100) NOT NULL,
	`terbatas` boolean NOT NULL DEFAULT false,
	`aktif` boolean NOT NULL DEFAULT true,
	`urutan` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `kalam_kategori_rapat_id` PRIMARY KEY(`id`),
	CONSTRAINT `kalam_kategori_rapat_kode_unique` UNIQUE(`kode`)
);
--> statement-breakpoint
-- Kategori bawaan (sebelumnya hard-coded). Kode sama dengan nilai lama di sesi.metadata.kategori.
INSERT INTO `kalam_kategori_rapat` (`kode`, `nama`, `terbatas`, `urutan`) VALUES ('pleno', 'Rapat pleno', false, 1), ('kurikulum', 'Rapat kurikulum', false, 2), ('komite', 'Rapat komite', false, 3), ('pimpinan', 'Rapat pimpinan', true, 4);
