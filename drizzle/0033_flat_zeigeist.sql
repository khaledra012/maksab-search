ALTER TABLE `leads` ADD `normalized_business_name` varchar(300);--> statement-breakpoint
ALTER TABLE `leads` ADD `normalized_phone` varchar(30);--> statement-breakpoint
ALTER TABLE `leads` ADD `normalized_domain` varchar(500);--> statement-breakpoint
ALTER TABLE `leads` ADD `duplicate_confidence_score` float DEFAULT 0;--> statement-breakpoint
ALTER TABLE `leads` ADD `duplicate_candidate_ids` json;--> statement-breakpoint
ALTER TABLE `leads` ADD `deduplication_status` enum('unchecked','no_duplicate','possible_duplicate','confirmed_duplicate','merged_manually') DEFAULT 'unchecked';--> statement-breakpoint
ALTER TABLE `leads` ADD `data_quality_score` float DEFAULT 0;--> statement-breakpoint
ALTER TABLE `leads` ADD `manual_review_status` enum('pending','in_review','approved','rejected','draft') DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `leads` ADD `reviewed_by_user_id` int;--> statement-breakpoint
ALTER TABLE `leads` ADD `reviewed_at` timestamp;--> statement-breakpoint
ALTER TABLE `leads` ADD `sector_main` enum('restaurants','medical','ecommerce','digital_products','general') DEFAULT 'general';--> statement-breakpoint
ALTER TABLE `leads` ADD `sector_sub` varchar(100);--> statement-breakpoint
ALTER TABLE `leads` ADD `analysis_language_mode` enum('msa_formal','saudi_sales_tone','arabic_sales_brief') DEFAULT 'saudi_sales_tone';--> statement-breakpoint
ALTER TABLE `leads` ADD `analysis_type` varchar(50) DEFAULT 'full';--> statement-breakpoint
ALTER TABLE `leads` ADD `analysis_sales_goal` varchar(200);--> statement-breakpoint
ALTER TABLE `leads` ADD `recommended_offer_type` enum('seo','ads','social','design','bundle','none');--> statement-breakpoint
ALTER TABLE `leads` ADD `recommended_service_bundle` json;--> statement-breakpoint
ALTER TABLE `leads` ADD `report_status` enum('not_generated','generating','ready','failed') DEFAULT 'not_generated';--> statement-breakpoint
ALTER TABLE `leads` ADD `report_template_type` enum('internal','client_facing') DEFAULT 'internal';--> statement-breakpoint
ALTER TABLE `leads` ADD `client_facing_report` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `leads` ADD `watermark_enabled` boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE `leads` ADD `llm_model_name` varchar(100);--> statement-breakpoint
ALTER TABLE `leads` ADD `llm_prompt_template_id` varchar(100);--> statement-breakpoint
ALTER TABLE `leads` ADD `llm_analysis_version` varchar(20);--> statement-breakpoint
ALTER TABLE `leads` ADD `llm_generation_status` enum('idle','queued','generating','done','failed') DEFAULT 'idle';--> statement-breakpoint
ALTER TABLE `leads` ADD `llm_generation_error` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `auto_analysis_enabled` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `leads` ADD `auto_analysis_status` enum('idle','queued','running','done','failed') DEFAULT 'idle';--> statement-breakpoint
ALTER TABLE `leads` ADD `analysis_ready_flag` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `leads` ADD `analysis_confidence_score` float DEFAULT 0;--> statement-breakpoint
ALTER TABLE `leads` ADD `bulk_analysis_batch_id` varchar(100);--> statement-breakpoint
ALTER TABLE `leads` ADD `bulk_analysis_status` enum('idle','queued','processing','done','failed','skipped') DEFAULT 'idle';--> statement-breakpoint
ALTER TABLE `leads` ADD `processing_status` enum('pending','in_progress','completed','failed','skipped') DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `leads` ADD `processing_error_message` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `job_queue_status` enum('idle','queued','running','done','failed') DEFAULT 'idle';--> statement-breakpoint
ALTER TABLE `leads` ADD `job_started_at` timestamp;--> statement-breakpoint
ALTER TABLE `leads` ADD `job_completed_at` timestamp;--> statement-breakpoint
ALTER TABLE `leads` ADD `retry_count` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `leads` ADD `last_retry_at` timestamp;--> statement-breakpoint
ALTER TABLE `leads` ADD `pdf_generation_status` enum('not_generated','generating','ready','failed') DEFAULT 'not_generated';--> statement-breakpoint
ALTER TABLE `leads` ADD `pdf_template_version` varchar(20);--> statement-breakpoint
ALTER TABLE `leads` ADD `pdf_render_engine` varchar(50);--> statement-breakpoint
ALTER TABLE `leads` ADD `pdf_file_url` varchar(1000);--> statement-breakpoint
ALTER TABLE `leads` ADD `pdf_generated_at` timestamp;--> statement-breakpoint
ALTER TABLE `leads` ADD `created_by_user_id` int;--> statement-breakpoint
ALTER TABLE `leads` ADD `last_modified_by_user_id` int;--> statement-breakpoint
ALTER TABLE `leads` ADD `access_scope` enum('all','owner_only','team') DEFAULT 'all';--> statement-breakpoint
ALTER TABLE `leads` ADD `gsc_connected` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `leads` ADD `ga4_connected` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `leads` ADD `meta_connected` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `leads` ADD `external_analysis_status` enum('idle','running','done','partial','failed') DEFAULT 'idle';--> statement-breakpoint
ALTER TABLE `leads` ADD `external_analysis_last_run_at` timestamp;--> statement-breakpoint
ALTER TABLE `leads` ADD `missing_data_flags` json;--> statement-breakpoint
ALTER TABLE `leads` ADD `partial_analysis_flag` boolean DEFAULT false;