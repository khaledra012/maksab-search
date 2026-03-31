ALTER TABLE `leads` ADD `scoring_value` int;--> statement-breakpoint
ALTER TABLE `leads` ADD `scoring_priority` enum('A','B','C','D');--> statement-breakpoint
ALTER TABLE `leads` ADD `scoring_reasons` json;--> statement-breakpoint
ALTER TABLE `leads` ADD `scoring_breakdown` json;--> statement-breakpoint
ALTER TABLE `leads` ADD `scoring_opportunities` json;--> statement-breakpoint
ALTER TABLE `leads` ADD `scoring_readiness_state` varchar(50);--> statement-breakpoint
ALTER TABLE `leads` ADD `scoring_run_at` bigint;