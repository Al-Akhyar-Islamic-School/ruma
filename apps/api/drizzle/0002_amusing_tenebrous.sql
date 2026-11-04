CREATE TABLE `ruma_kode_aplikasi` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`code_hash` varchar(64) NOT NULL,
	`challenge` varchar(128) NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `ruma_kode_aplikasi_id` PRIMARY KEY(`id`),
	CONSTRAINT `ruma_kode_aplikasi_code_hash_unique` UNIQUE(`code_hash`)
);
--> statement-breakpoint
ALTER TABLE `ruma_kode_aplikasi` ADD CONSTRAINT `ruma_kode_aplikasi_user_id_ruma_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `ruma_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `kode_app_exp_idx` ON `ruma_kode_aplikasi` (`expires_at`);