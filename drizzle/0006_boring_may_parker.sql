CREATE TABLE `instagram_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`searchId` int NOT NULL,
	`username` varchar(100) NOT NULL,
	`fullName` varchar(200),
	`bio` text,
	`website` varchar(500),
	`followersCount` int DEFAULT 0,
	`followingCount` int DEFAULT 0,
	`postsCount` int DEFAULT 0,
	`profilePicUrl` text,
	`isBusinessAccount` boolean DEFAULT false,
	`businessCategory` varchar(100),
	`phone` varchar(30),
	`email` varchar(200),
	`city` varchar(100),
	`isAddedAsLead` boolean DEFAULT false,
	`leadId` int,
	`discoveredAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `instagram_accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `instagram_searches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`hashtag` varchar(100) NOT NULL,
	`resultsCount` int NOT NULL DEFAULT 0,
	`status` enum('pending','running','done','error') NOT NULL DEFAULT 'pending',
	`errorMsg` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `instagram_searches_id` PRIMARY KEY(`id`)
);
