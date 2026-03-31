ALTER TABLE `leads` ADD `googleReviewsData` json;--> statement-breakpoint
ALTER TABLE `leads` ADD `googleRating` float;--> statement-breakpoint
ALTER TABLE `website_analyses` ADD `screenshotUrl` varchar(1000);--> statement-breakpoint
ALTER TABLE `whatchimp_settings` ADD `bot_flow_unique_id` varchar(200);