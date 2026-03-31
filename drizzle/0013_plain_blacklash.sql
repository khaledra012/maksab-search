ALTER TABLE `ai_settings` ADD `escalationEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_settings` ADD `escalationPhone` varchar(50);--> statement-breakpoint
ALTER TABLE `ai_settings` ADD `escalationMessage` text;--> statement-breakpoint
ALTER TABLE `ai_settings` ADD `escalationKeywords` json DEFAULT ('[]');--> statement-breakpoint
ALTER TABLE `ai_settings` ADD `conversationKeywords` json DEFAULT ('[]');