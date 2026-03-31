CREATE TABLE `ai_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider` enum('openai','builtin') NOT NULL DEFAULT 'builtin',
	`openaiApiKey` text,
	`openaiAssistantId` varchar(100),
	`openaiModel` varchar(50) NOT NULL DEFAULT 'gpt-4o-mini',
	`systemPrompt` text,
	`businessContext` text,
	`globalAutoReplyEnabled` boolean NOT NULL DEFAULT false,
	`temperature` float NOT NULL DEFAULT 0.7,
	`maxTokens` int NOT NULL DEFAULT 500,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `whatsapp_chats` ADD `aiAutoReplyEnabled` boolean DEFAULT true NOT NULL;