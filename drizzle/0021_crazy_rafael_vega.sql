CREATE TABLE `tts_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` varchar(255) NOT NULL,
	`phone` varchar(100) NOT NULL,
	`chatId` int,
	`status` enum('success','failed','fallback') NOT NULL,
	`textLength` int NOT NULL DEFAULT 0,
	`audioSizeBytes` int DEFAULT 0,
	`audioUrl` text,
	`errorMessage` text,
	`durationMs` int,
	`ttsEngine` varchar(50) NOT NULL DEFAULT 'gtts',
	`voiceDialect` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tts_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `ai_settings` ADD `ttsVoice` varchar(20) DEFAULT 'nova' NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_settings` ADD `voice_reply_scope` varchar(20) DEFAULT 'voice_only' NOT NULL;