CREATE TABLE `search_behavior_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`platform` varchar(50) NOT NULL,
	`query` varchar(500) NOT NULL,
	`filters` text,
	`resultsCount` int DEFAULT 0,
	`selectedResults` text,
	`addedToLeads` int DEFAULT 0,
	`sessionDuration` int DEFAULT 0,
	`scrollDepth` int DEFAULT 0,
	`clickPattern` text,
	`searchSuccess` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `search_behavior_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `search_behavior_patterns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`platform` varchar(50) NOT NULL,
	`patternType` varchar(100) NOT NULL,
	`patternData` text NOT NULL,
	`confidence` int DEFAULT 50,
	`sampleSize` int DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `search_behavior_patterns_id` PRIMARY KEY(`id`)
);
