CREATE TABLE `menu_channel_listings` (
	`id` text PRIMARY KEY NOT NULL,
	`menu_id` text NOT NULL,
	`platform` text NOT NULL,
	`price_override` real,
	`is_available` integer DEFAULT true NOT NULL,
	`sync_status` text DEFAULT 'pending' NOT NULL,
	`last_sync_at` text,
	`sync_error` text,
	`external_id` text,
	FOREIGN KEY (`menu_id`) REFERENCES `menus`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `ojol_channels` (
	`id` text PRIMARY KEY NOT NULL,
	`outlet_id` text NOT NULL,
	`platform` text NOT NULL,
	`store_name` text DEFAULT '' NOT NULL,
	`merchant_id` text DEFAULT '' NOT NULL,
	`api_key` text DEFAULT '' NOT NULL,
	`is_connected` integer DEFAULT false NOT NULL,
	`auto_sync` integer DEFAULT false NOT NULL,
	`last_sync_at` text,
	`notes` text,
	FOREIGN KEY (`outlet_id`) REFERENCES `outlets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `ojol_sync_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`outlet_id` text NOT NULL,
	`platform` text NOT NULL,
	`triggered_by_user_id` text NOT NULL,
	`triggered_by_name` text NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`status` text NOT NULL,
	`items_total` integer DEFAULT 0 NOT NULL,
	`items_synced` integer DEFAULT 0 NOT NULL,
	`items_failed` integer DEFAULT 0 NOT NULL,
	`notes` text,
	FOREIGN KEY (`outlet_id`) REFERENCES `outlets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `users` ADD `pos_pin_hash` text;