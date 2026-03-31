CREATE TABLE `agent_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`userId` int NOT NULL,
	`action` varchar(100) NOT NULL,
	`details` json,
	`timestamp` bigint NOT NULL,
	CONSTRAINT `agent_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agent_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`taskType` varchar(50) NOT NULL,
	`status` enum('pending','running','completed','failed','paused') NOT NULL DEFAULT 'pending',
	`context` json,
	`leadIds` json,
	`result` json,
	`startedAt` bigint,
	`completedAt` bigint,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `analysis_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`salesGoalMonthly` int DEFAULT 50,
	`primarySector` varchar(100) DEFAULT 'general',
	`communicationStyle` varchar(50) DEFAULT 'professional',
	`targetCities` text,
	`salesApproach` varchar(50) DEFAULT 'sa_arabic',
	`reportLanguage` varchar(20) DEFAULT 'arabic',
	`autoAnalyzeOnAdd` boolean DEFAULT true,
	`priorityThreshold` int DEFAULT 7,
	`customInstructions` text,
	`updatedAt` bigint,
	CONSTRAINT `analysis_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `analysis_settings_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `serp_search_queue` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskName` varchar(200) NOT NULL,
	`keyword` varchar(200) NOT NULL,
	`location` varchar(100) DEFAULT 'السعودية',
	`platforms` json NOT NULL,
	`targetCount` int NOT NULL DEFAULT 50,
	`status` enum('pending','running','paused','completed','failed') NOT NULL DEFAULT 'pending',
	`priority` int NOT NULL DEFAULT 5,
	`totalFound` int NOT NULL DEFAULT 0,
	`totalProcessed` int NOT NULL DEFAULT 0,
	`currentPlatform` varchar(50),
	`log` json,
	`errorMessage` text,
	`scheduledAt` timestamp,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdBy` int,
	CONSTRAINT `serp_search_queue_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `serp_search_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`searchQuery` varchar(500) NOT NULL,
	`platform` enum('instagram','tiktok','snapchat','facebook','twitter','linkedin','google_maps') NOT NULL,
	`keyword` varchar(200) NOT NULL,
	`location` varchar(100) DEFAULT 'السعودية',
	`username` varchar(200) NOT NULL,
	`displayName` varchar(300),
	`bio` text,
	`profileUrl` varchar(1000) NOT NULL,
	`phone` varchar(50),
	`email` varchar(200),
	`website` varchar(500),
	`relevanceScore` float,
	`businessType` varchar(200),
	`priority` enum('high','medium','low') DEFAULT 'medium',
	`isContactable` boolean DEFAULT false,
	`status` enum('new','reviewed','converted','rejected') NOT NULL DEFAULT 'new',
	`convertedToLeadId` int,
	`jobId` int,
	`discoveredAt` timestamp NOT NULL DEFAULT (now()),
	`reviewedAt` timestamp,
	CONSTRAINT `serp_search_results_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `company_settings` ADD `licenseNumber` varchar(100);--> statement-breakpoint
ALTER TABLE `company_settings` ADD `address` text;--> statement-breakpoint
ALTER TABLE `company_settings` ADD `instagramUrl` varchar(300);--> statement-breakpoint
ALTER TABLE `company_settings` ADD `twitterUrl` varchar(300);--> statement-breakpoint
ALTER TABLE `company_settings` ADD `linkedinUrl` varchar(300);--> statement-breakpoint
ALTER TABLE `leads` ADD `linkedinUrl` varchar(500);--> statement-breakpoint
ALTER TABLE `leads` ADD `crNumber` varchar(30);--> statement-breakpoint
ALTER TABLE `leads` ADD `clientLogoUrl` varchar(1000);--> statement-breakpoint
ALTER TABLE `leads` ADD `marketing_gap_summary` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `competitive_position` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `primary_opportunity` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `secondary_opportunity` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `urgency_level` enum('high','medium','low') DEFAULT 'medium';--> statement-breakpoint
ALTER TABLE `leads` ADD `recommended_services` json;--> statement-breakpoint
ALTER TABLE `leads` ADD `sales_entry_angle` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `ice_breaker` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `sector_insights` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `benchmark_comparison` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `ai_confidence_score` float DEFAULT 0;--> statement-breakpoint
ALTER TABLE `leads` ADD `last_analyzed_at` bigint;--> statement-breakpoint
ALTER TABLE `social_analyses` ADD `followersCount` int;--> statement-breakpoint
ALTER TABLE `social_analyses` ADD `engagementRate` float;--> statement-breakpoint
ALTER TABLE `social_analyses` ADD `postsCount` int;--> statement-breakpoint
ALTER TABLE `social_analyses` ADD `avgLikes` int;--> statement-breakpoint
ALTER TABLE `social_analyses` ADD `avgViews` int;--> statement-breakpoint
ALTER TABLE `social_analyses` ADD `analysisText` text;--> statement-breakpoint
ALTER TABLE `social_analyses` ADD `dataSource` varchar(50);