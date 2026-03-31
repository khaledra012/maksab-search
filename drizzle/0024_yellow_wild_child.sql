CREATE TABLE `social_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`platform` enum('instagram','tiktok','snapchat') NOT NULL,
	`accountId` varchar(200) NOT NULL,
	`username` varchar(200) NOT NULL,
	`displayName` varchar(200),
	`profilePicUrl` text,
	`accessToken` text,
	`refreshToken` text,
	`tokenExpiresAt` timestamp,
	`pageId` varchar(200),
	`webhookVerified` boolean NOT NULL DEFAULT false,
	`isActive` boolean NOT NULL DEFAULT true,
	`status` enum('connected','disconnected','error','pending') NOT NULL DEFAULT 'pending',
	`statusMessage` text,
	`followersCount` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `social_accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `social_conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`socialAccountId` int NOT NULL,
	`platform` enum('instagram','tiktok','snapchat','whatsapp') NOT NULL,
	`externalConversationId` varchar(300),
	`senderExternalId` varchar(200),
	`senderUsername` varchar(200),
	`senderDisplayName` varchar(200),
	`senderProfilePic` text,
	`leadId` int,
	`lastMessageAt` timestamp,
	`lastMessagePreview` varchar(300),
	`unreadCount` int NOT NULL DEFAULT 0,
	`isRead` boolean NOT NULL DEFAULT false,
	`isArchived` boolean NOT NULL DEFAULT false,
	`assignedTo` int,
	`aiAutoReply` boolean NOT NULL DEFAULT false,
	`status` enum('open','closed','pending') NOT NULL DEFAULT 'open',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `social_conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `social_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`platform` enum('instagram','tiktok','snapchat','whatsapp') NOT NULL,
	`externalMessageId` varchar(300),
	`direction` enum('inbound','outbound') NOT NULL,
	`senderType` enum('customer','agent','ai') NOT NULL DEFAULT 'customer',
	`messageType` enum('text','image','video','audio','story_reply','reaction','unsupported') NOT NULL DEFAULT 'text',
	`content` text,
	`mediaUrl` text,
	`mediaType` varchar(50),
	`status` enum('sent','delivered','read','failed','pending') NOT NULL DEFAULT 'sent',
	`errorMessage` text,
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	`deliveredAt` timestamp,
	`readAt` timestamp,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `social_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `ai_settings` ADD `instagramAppSecret` varchar(200);