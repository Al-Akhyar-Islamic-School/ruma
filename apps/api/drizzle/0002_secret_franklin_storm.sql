CREATE TABLE `kalam_pengaturan` (
	`kunci` varchar(64) NOT NULL,
	`nilai` json NOT NULL,
	`diubah_oleh` bigint unsigned,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `kalam_pengaturan_kunci` PRIMARY KEY(`kunci`)
);
--> statement-breakpoint
ALTER TABLE `kalam_pengaturan` ADD CONSTRAINT `kalam_pengaturan_diubah_oleh_kalam_users_id_fk` FOREIGN KEY (`diubah_oleh`) REFERENCES `kalam_users`(`id`) ON DELETE no action ON UPDATE no action;