CREATE TABLE `whatsapp_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`phone` varchar(20) NOT NULL,
	`message` text NOT NULL,
	`messageType` enum('individual','bulk') NOT NULL DEFAULT 'individual',
	`bulkJobId` varchar(64),
	`status` enum('sent','pending','failed') NOT NULL DEFAULT 'sent',
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `whatsapp_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `leads` ADD `hasWhatsapp` enum('unknown','yes','no') DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE `leads` ADD `whatsappCheckedAt` timestamp;--> statement-breakpoint
ALTER TABLE `leads` ADD `lastWhatsappSentAt` timestamp;