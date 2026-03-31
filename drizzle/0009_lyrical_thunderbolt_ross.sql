CREATE TABLE `interest_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`chatId` int,
	`leadId` int,
	`phone` varchar(30) NOT NULL,
	`contactName` varchar(200),
	`triggerMessage` text,
	`interestScore` int NOT NULL DEFAULT 0,
	`detectedKeywords` json DEFAULT ('[]'),
	`status` enum('pending','transferred','dismissed') NOT NULL DEFAULT 'pending',
	`handoffAccountId` varchar(64),
	`handoffPhone` varchar(30),
	`transferredAt` timestamp,
	`transferredBy` varchar(100),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `interest_alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `whatsapp_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` varchar(64) NOT NULL,
	`label` varchar(100) NOT NULL,
	`phoneNumber` varchar(30) NOT NULL,
	`role` enum('bulk_sender','human_handoff','both') NOT NULL DEFAULT 'bulk_sender',
	`assignedEmployee` varchar(100),
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `whatsapp_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `whatsapp_accounts_accountId_unique` UNIQUE(`accountId`)
);
