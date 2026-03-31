CREATE TABLE `chat_internal_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`chatId` int NOT NULL,
	`authorId` int NOT NULL,
	`authorName` varchar(100) NOT NULL,
	`content` text NOT NULL,
	`isPinned` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chat_internal_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `whatsapp_chats` ADD `stage` enum('new','contacted','interested','price_offer','meeting','won','lost') DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE `whatsapp_chats` ADD `nextStep` text;--> statement-breakpoint
ALTER TABLE `whatsapp_chats` ADD `followUpDate` timestamp;--> statement-breakpoint
ALTER TABLE `whatsapp_chats` ADD `ownerUserId` int;--> statement-breakpoint
ALTER TABLE `whatsapp_chats` ADD `ownerUserName` varchar(100);