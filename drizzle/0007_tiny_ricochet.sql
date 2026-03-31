CREATE TABLE `auto_reply_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` varchar(64) NOT NULL DEFAULT 'default',
	`triggerKeywords` json NOT NULL,
	`replyTemplate` text NOT NULL,
	`useAI` boolean NOT NULL DEFAULT false,
	`aiContext` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`matchCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `auto_reply_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_invitations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`invitedBy` int NOT NULL,
	`token` varchar(128) NOT NULL,
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`permissions` json,
	`status` enum('pending','accepted','expired','revoked') NOT NULL DEFAULT 'pending',
	`acceptedBy` int,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_invitations_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_invitations_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `user_permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`permissions` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_permissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_permissions_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `whatsapp_chat_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`chatId` int NOT NULL,
	`accountId` varchar(64) NOT NULL DEFAULT 'default',
	`direction` enum('outgoing','incoming') NOT NULL,
	`message` text NOT NULL,
	`isAutoReply` boolean NOT NULL DEFAULT false,
	`status` enum('sent','delivered','read','failed') NOT NULL DEFAULT 'sent',
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `whatsapp_chat_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `whatsapp_chats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` varchar(64) NOT NULL DEFAULT 'default',
	`phone` varchar(30) NOT NULL,
	`contactName` varchar(200),
	`leadId` int,
	`lastMessage` text,
	`lastMessageAt` timestamp,
	`unreadCount` int NOT NULL DEFAULT 0,
	`isArchived` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `whatsapp_chats_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `whatsapp_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` varchar(64) NOT NULL,
	`accountLabel` varchar(100) NOT NULL,
	`messageDelay` int NOT NULL DEFAULT 10000,
	`notificationThreshold` int NOT NULL DEFAULT 50,
	`messagesSentToday` int NOT NULL DEFAULT 0,
	`totalMessagesSent` int NOT NULL DEFAULT 0,
	`autoReplyEnabled` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `whatsapp_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `whatsapp_settings_accountId_unique` UNIQUE(`accountId`)
);
