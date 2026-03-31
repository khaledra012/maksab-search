CREATE TABLE `backup_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` enum('daily','manual','weekly') NOT NULL DEFAULT 'daily',
	`status` enum('pending','running','success','failed') NOT NULL DEFAULT 'pending',
	`filePath` varchar(500),
	`fileUrl` text,
	`fileSize` int,
	`emailSent` boolean NOT NULL DEFAULT false,
	`emailTo` varchar(320),
	`recordCount` json,
	`error` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `backup_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lead_journey` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int,
	`phone` varchar(30) NOT NULL,
	`eventType` enum('created','message_sent','message_received','interest_detected','transferred_to_employee','transferred_to_ai','deal_closed','deal_lost','archived') NOT NULL,
	`description` text,
	`performedBy` varchar(100),
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lead_journey_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `number_health_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` varchar(64) NOT NULL,
	`eventType` enum('report','block','no_reply','score_drop','score_rise','warning_sent') NOT NULL,
	`description` text,
	`scoreBefore` int,
	`scoreAfter` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `number_health_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scheduled_bulk_sends` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`accountId` varchar(64) NOT NULL,
	`message` text NOT NULL,
	`mediaUrl` text,
	`recipients` json NOT NULL,
	`totalCount` int NOT NULL DEFAULT 0,
	`sentCount` int NOT NULL DEFAULT 0,
	`failedCount` int NOT NULL DEFAULT 0,
	`intervalSeconds` int NOT NULL DEFAULT 30,
	`maxPerDay` int NOT NULL DEFAULT 200,
	`status` enum('pending','running','paused','completed','failed') NOT NULL DEFAULT 'pending',
	`scheduledAt` timestamp,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scheduled_bulk_sends_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `ai_settings` ADD `voiceReplyEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_settings` ADD `voiceDialect` varchar(50) DEFAULT 'ar-SA';--> statement-breakpoint
ALTER TABLE `ai_settings` ADD `voiceGender` enum('male','female') DEFAULT 'female';--> statement-breakpoint
ALTER TABLE `ai_settings` ADD `voiceSpeed` float DEFAULT 1;--> statement-breakpoint
ALTER TABLE `ai_settings` ADD `transcribeIncoming` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `whatsapp_accounts` ADD `healthScore` int DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE `whatsapp_accounts` ADD `healthStatus` enum('safe','watch','warning','danger') DEFAULT 'safe' NOT NULL;--> statement-breakpoint
ALTER TABLE `whatsapp_accounts` ADD `dailySentCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `whatsapp_accounts` ADD `dailyReceivedCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `whatsapp_accounts` ADD `totalSentCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `whatsapp_accounts` ADD `totalReceivedCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `whatsapp_accounts` ADD `reportCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `whatsapp_accounts` ADD `blockCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `whatsapp_accounts` ADD `noReplyCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `whatsapp_accounts` ADD `maxDailyMessages` int DEFAULT 200 NOT NULL;--> statement-breakpoint
ALTER TABLE `whatsapp_accounts` ADD `minIntervalSeconds` int DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE `whatsapp_accounts` ADD `lastScoreUpdate` timestamp;--> statement-breakpoint
ALTER TABLE `whatsapp_accounts` ADD `scoreHistory` json DEFAULT ('[]');