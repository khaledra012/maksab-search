CREATE TABLE `ai_training_examples` (
	`id` int AUTO_INCREMENT NOT NULL,
	`message` text NOT NULL,
	`label` enum('interested','not_interested') NOT NULL,
	`notes` varchar(200),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_training_examples_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `interest_keywords` (
	`id` int AUTO_INCREMENT NOT NULL,
	`keyword` varchar(100) NOT NULL,
	`category` varchar(50) NOT NULL DEFAULT 'general',
	`weight` int NOT NULL DEFAULT 20,
	`isActive` boolean NOT NULL DEFAULT true,
	`isDefault` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `interest_keywords_id` PRIMARY KEY(`id`),
	CONSTRAINT `interest_keywords_keyword_unique` UNIQUE(`keyword`)
);
