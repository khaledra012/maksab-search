ALTER TABLE `whatsapp_chats` ADD `assignedUserId` int;--> statement-breakpoint
ALTER TABLE `whatsapp_chats` ADD `assignedUserName` varchar(100);--> statement-breakpoint
ALTER TABLE `whatsapp_chats` ADD `handledBy` enum('ai','human','mixed') DEFAULT 'ai';--> statement-breakpoint
ALTER TABLE `whatsapp_chats` ADD `firstResponseAt` timestamp;--> statement-breakpoint
ALTER TABLE `whatsapp_chats` ADD `closedAt` timestamp;--> statement-breakpoint
ALTER TABLE `whatsapp_chats` ADD `totalMessages` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `whatsapp_chats` ADD `sentiment` enum('positive','neutral','negative','unknown') DEFAULT 'unknown';--> statement-breakpoint
ALTER TABLE `whatsapp_chats` ADD `opportunityMissed` boolean DEFAULT false NOT NULL;