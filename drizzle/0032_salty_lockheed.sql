ALTER TABLE `company_settings` ADD `primaryColor` varchar(20) DEFAULT '#1a56db';--> statement-breakpoint
ALTER TABLE `company_settings` ADD `secondaryColor` varchar(20) DEFAULT '#0e9f6e';--> statement-breakpoint
ALTER TABLE `company_settings` ADD `reportHeaderText` text;--> statement-breakpoint
ALTER TABLE `company_settings` ADD `reportFooterText` text;--> statement-breakpoint
ALTER TABLE `company_settings` ADD `reportIntroText` text;