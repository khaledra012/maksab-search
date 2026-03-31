CREATE TABLE `seo_advanced_analysis` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lead_id` int NOT NULL,
	`url` varchar(500) NOT NULL,
	`top_keywords` json DEFAULT ('[]'),
	`missing_keywords` json DEFAULT ('[]'),
	`keyword_opportunities` json DEFAULT ('[]'),
	`estimated_backlinks` int,
	`backlink_quality` enum('weak','average','good','strong') DEFAULT 'weak',
	`top_referring_domains` json DEFAULT ('[]'),
	`backlink_gaps` json DEFAULT ('[]'),
	`competitors` json DEFAULT ('[]'),
	`competitor_gaps` json DEFAULT ('[]'),
	`competitive_advantages` json DEFAULT ('[]'),
	`search_rankings` json DEFAULT ('[]'),
	`brand_mentions` int DEFAULT 0,
	`local_seo_score` int,
	`overall_seo_health` enum('critical','weak','average','good','excellent') DEFAULT 'average',
	`seo_summary` text,
	`priority_actions` json DEFAULT ('[]'),
	`analyzed_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `seo_advanced_analysis_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `leads` ADD `email` varchar(320);--> statement-breakpoint
ALTER TABLE `leads` ADD `additional_notes` text;