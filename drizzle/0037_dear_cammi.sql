CREATE TABLE `report_style_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tone` varchar(50) NOT NULL DEFAULT 'professional',
	`brandKeywords` json NOT NULL DEFAULT ('[]'),
	`customInstructions` text,
	`opportunityCommentStyle` text,
	`mentionCompanyName` boolean NOT NULL DEFAULT true,
	`closingStatement` text,
	`includeSeasonSection` boolean NOT NULL DEFAULT true,
	`includeCompetitorsSection` boolean NOT NULL DEFAULT true,
	`detailLevel` varchar(20) NOT NULL DEFAULT 'standard',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `report_style_settings_id` PRIMARY KEY(`id`)
);
