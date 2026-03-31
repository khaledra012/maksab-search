CREATE TABLE `ai_personality` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL DEFAULT 'مساعد المبيعات',
	`role` varchar(200) NOT NULL DEFAULT 'مساعد مبيعات احترافي',
	`businessContext` text,
	`defaultTone` enum('formal','friendly','direct','persuasive') NOT NULL DEFAULT 'friendly',
	`language` varchar(20) NOT NULL DEFAULT 'ar',
	`systemPrompt` text,
	`rules` json DEFAULT ('[]'),
	`forbiddenTopics` json DEFAULT ('[]'),
	`greetingMessage` text,
	`closingMessage` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_personality_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `data_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`category` varchar(50) NOT NULL,
	`value` varchar(200) NOT NULL,
	`label` varchar(200) NOT NULL,
	`parentValue` varchar(200),
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `data_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rag_chunks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentId` int NOT NULL,
	`chunkIndex` int NOT NULL DEFAULT 0,
	`content` text NOT NULL,
	`embedding` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rag_chunks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rag_conversation_examples` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerMessage` text NOT NULL,
	`idealResponse` text NOT NULL,
	`context` varchar(200),
	`tone` enum('formal','friendly','direct','persuasive') NOT NULL DEFAULT 'friendly',
	`category` varchar(100) DEFAULT 'general',
	`rating` int DEFAULT 5,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rag_conversation_examples_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rag_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(300) NOT NULL,
	`description` text,
	`category` varchar(100) NOT NULL DEFAULT 'general',
	`docType` enum('text','faq','product','policy','example','tone') NOT NULL DEFAULT 'text',
	`content` text NOT NULL,
	`usageCount` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdBy` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rag_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `ai_settings` ADD `analysisStyle` varchar(50) DEFAULT 'balanced';--> statement-breakpoint
ALTER TABLE `ai_settings` ADD `analysisPrompt` text;--> statement-breakpoint
ALTER TABLE `ai_settings` ADD `messageTemplate` text;--> statement-breakpoint
ALTER TABLE `ai_settings` ADD `brandTone` varchar(50) DEFAULT 'professional';--> statement-breakpoint
ALTER TABLE `ai_settings` ADD `countryContext` varchar(50) DEFAULT 'saudi';--> statement-breakpoint
ALTER TABLE `ai_settings` ADD `dialect` varchar(50) DEFAULT 'gulf';--> statement-breakpoint
ALTER TABLE `leads` ADD `stage` enum('new','contacted','interested','price_offer','meeting','won','lost') DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE `leads` ADD `priority` enum('high','medium','low') DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE `leads` ADD `next_step` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `next_followup` bigint;--> statement-breakpoint
ALTER TABLE `leads` ADD `owner_user_id` int;--> statement-breakpoint
ALTER TABLE `users` ADD `defaultWhatsappAccountId` varchar(64);--> statement-breakpoint
ALTER TABLE `whatsapp_accounts` ADD `account_type` enum('collection','sales','analysis','followup') DEFAULT 'collection' NOT NULL;--> statement-breakpoint
ALTER TABLE `whatsapp_chat_messages` ADD `mediaUrl` text;--> statement-breakpoint
ALTER TABLE `whatsapp_chat_messages` ADD `mediaType` varchar(50);--> statement-breakpoint
ALTER TABLE `whatsapp_chat_messages` ADD `mediaFilename` varchar(255);