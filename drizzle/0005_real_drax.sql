CREATE TABLE `whatsapp_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`content` text NOT NULL,
	`tone` enum('formal','friendly','direct') NOT NULL DEFAULT 'friendly',
	`isDefault` boolean NOT NULL DEFAULT false,
	`usageCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `whatsapp_templates_id` PRIMARY KEY(`id`)
);
