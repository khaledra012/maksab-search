CREATE TABLE `search_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobName` varchar(200) NOT NULL,
	`country` varchar(100) NOT NULL,
	`city` varchar(100) NOT NULL,
	`businessType` varchar(200) NOT NULL,
	`searchKeywords` json,
	`targetCount` int NOT NULL DEFAULT 50,
	`status` enum('pending','running','paused','completed','failed') NOT NULL DEFAULT 'pending',
	`totalSearched` int NOT NULL DEFAULT 0,
	`totalFound` int NOT NULL DEFAULT 0,
	`totalDuplicates` int NOT NULL DEFAULT 0,
	`totalAdded` int NOT NULL DEFAULT 0,
	`currentKeyword` varchar(200),
	`currentPage` int NOT NULL DEFAULT 0,
	`nextPageToken` text,
	`log` json,
	`errorMessage` text,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `search_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `leads` ADD `country` varchar(100) DEFAULT 'السعودية' NOT NULL;--> statement-breakpoint
ALTER TABLE `leads` ADD `sourceJobId` int;