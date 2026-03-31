ALTER TABLE `ai_settings` ADD `instagramAccessToken` text;--> statement-breakpoint
ALTER TABLE `ai_settings` ADD `instagramAppId` varchar(100);--> statement-breakpoint
ALTER TABLE `ai_settings` ADD `instagramApiEnabled` boolean DEFAULT false NOT NULL;