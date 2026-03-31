CREATE TABLE `ai_reference_users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`userName` varchar(100),
	`isActive` boolean NOT NULL DEFAULT true,
	`learnedPatterns` json,
	`lastLearnedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_reference_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `ai_reference_users_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`userName` varchar(100),
	`action` varchar(100) NOT NULL,
	`entityType` varchar(50),
	`entityId` varchar(64),
	`details` json,
	`ipAddress` varchar(45),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `conversation_label_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`chatId` int NOT NULL,
	`labelId` int NOT NULL,
	`assignedBy` int NOT NULL,
	`assignedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `conversation_label_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `conversation_labels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`color` varchar(20) NOT NULL DEFAULT '#3B82F6',
	`description` text,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `conversation_labels_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `daily_message_counts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`date` varchar(10) NOT NULL,
	`count` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `daily_message_counts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `dailyMessageLimit` int DEFAULT 0 NOT NULL;