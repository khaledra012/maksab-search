CREATE TABLE `activation_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fromAccountId` varchar(64) NOT NULL,
	`toAccountId` varchar(64) NOT NULL,
	`message` text NOT NULL,
	`status` enum('sent','failed','pending') NOT NULL DEFAULT 'pending',
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	`errorMessage` text,
	CONSTRAINT `activation_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `activation_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`isActive` boolean NOT NULL DEFAULT false,
	`minDelaySeconds` int NOT NULL DEFAULT 60,
	`maxDelaySeconds` int NOT NULL DEFAULT 300,
	`messagesPerDay` int NOT NULL DEFAULT 20,
	`startHour` int NOT NULL DEFAULT 9,
	`endHour` int NOT NULL DEFAULT 22,
	`useAI` boolean NOT NULL DEFAULT false,
	`messageStyle` varchar(50) NOT NULL DEFAULT 'casual',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `activation_settings_id` PRIMARY KEY(`id`)
);
