CREATE TABLE `marketing_seasons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`startDate` varchar(10) NOT NULL,
	`endDate` varchar(10) NOT NULL,
	`year` int,
	`opportunities` json NOT NULL,
	`relatedBusinessTypes` json,
	`description` text,
	`color` varchar(20) DEFAULT '#f59e0b',
	`icon` varchar(10) DEFAULT '🌙',
	`isActive` boolean NOT NULL DEFAULT true,
	`priority` int NOT NULL DEFAULT 5,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketing_seasons_id` PRIMARY KEY(`id`)
);
