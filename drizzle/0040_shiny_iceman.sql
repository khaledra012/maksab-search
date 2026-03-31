CREATE TABLE `whatchimp_send_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lead_id` int NOT NULL,
	`lead_name` varchar(200),
	`phone` varchar(30) NOT NULL,
	`status` enum('success','failed','skipped') NOT NULL,
	`error_message` text,
	`wa_message_id` varchar(200),
	`batch_id` varchar(100),
	`sent_by_user_id` int,
	`sent_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `whatchimp_send_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `whatchimp_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`api_token` varchar(200) NOT NULL,
	`phone_number_id` varchar(50) NOT NULL,
	`default_label_id` int,
	`default_label_name` varchar(100),
	`is_active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `whatchimp_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `company_settings` ADD `commercialRegistration` varchar(50);--> statement-breakpoint
ALTER TABLE `company_settings` ADD `analystName` varchar(200);--> statement-breakpoint
ALTER TABLE `company_settings` ADD `analystTitle` varchar(200);