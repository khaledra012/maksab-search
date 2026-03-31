CREATE TABLE `platform_credentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`platform` enum('instagram','tiktok','snapchat') NOT NULL,
	`appId` varchar(300),
	`appSecret` text,
	`extraField1` varchar(300),
	`extraField2` varchar(300),
	`isConfigured` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `platform_credentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `platform_credentials_platform_unique` UNIQUE(`platform`)
);
