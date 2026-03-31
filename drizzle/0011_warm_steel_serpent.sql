CREATE TABLE `lead_segments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`segmentId` int NOT NULL,
	`addedAt` timestamp NOT NULL DEFAULT (now()),
	`addedBy` varchar(100),
	CONSTRAINT `lead_segments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `segments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`color` varchar(20) NOT NULL DEFAULT '#3b82f6',
	`optimalSendTimes` json DEFAULT ('[]'),
	`filterCriteria` json DEFAULT ('{}'),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `segments_id` PRIMARY KEY(`id`)
);
