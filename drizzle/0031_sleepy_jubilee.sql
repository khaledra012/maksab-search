CREATE TABLE `company_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyName` varchar(200) DEFAULT 'مكسب KSA',
	`companyDescription` text,
	`city` varchar(100) DEFAULT 'الرياض',
	`region` varchar(100) DEFAULT 'المنطقة الوسطى',
	`phone` varchar(30),
	`email` varchar(200),
	`website` varchar(300),
	`logoUrl` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `company_settings_id` PRIMARY KEY(`id`)
);
