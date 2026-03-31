CREATE TABLE `google_sheets_connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`sheetUrl` text NOT NULL,
	`sheetId` varchar(255) NOT NULL,
	`tabName` varchar(255),
	`columnMapping` json,
	`purpose` enum('rag_training','leads_import','products','faq') NOT NULL DEFAULT 'rag_training',
	`isActive` boolean NOT NULL DEFAULT true,
	`autoSync` boolean NOT NULL DEFAULT false,
	`syncInterval` int NOT NULL DEFAULT 60,
	`lastSyncAt` timestamp,
	`lastSyncStatus` enum('success','failed','pending') DEFAULT 'pending',
	`lastSyncError` text,
	`rowsImported` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `google_sheets_connections_id` PRIMARY KEY(`id`)
);
