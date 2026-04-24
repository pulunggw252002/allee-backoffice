CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`accountId` text NOT NULL,
	`providerId` text NOT NULL,
	`userId` text NOT NULL,
	`accessToken` text,
	`refreshToken` text,
	`idToken` text,
	`accessTokenExpiresAt` integer,
	`refreshTokenExpiresAt` integer,
	`scope` text,
	`password` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user_auth`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `addon_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`selection_type` text DEFAULT 'single' NOT NULL,
	`is_required` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `addon_options` (
	`id` text PRIMARY KEY NOT NULL,
	`addon_group_id` text NOT NULL,
	`name` text NOT NULL,
	`extra_price` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`addon_group_id`) REFERENCES `addon_groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `addon_recipe_modifiers` (
	`id` text PRIMARY KEY NOT NULL,
	`addon_option_id` text NOT NULL,
	`ingredient_id` text NOT NULL,
	`quantity_delta` real NOT NULL,
	`mode` text DEFAULT 'delta' NOT NULL,
	FOREIGN KEY (`addon_option_id`) REFERENCES `addon_options`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `attendance` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`user_name` text NOT NULL,
	`user_role` text NOT NULL,
	`outlet_id` text NOT NULL,
	`station` text NOT NULL,
	`date` text NOT NULL,
	`check_in_at` text NOT NULL,
	`check_in_selfie` text NOT NULL,
	`check_in_station_photo` text NOT NULL,
	`before_checklist` text NOT NULL,
	`check_in_notes` text,
	`is_late` integer,
	`check_out_at` text,
	`check_out_selfie` text,
	`check_out_station_photo` text,
	`after_checklist` text,
	`check_out_notes` text
);
--> statement-breakpoint
CREATE TABLE `attendance_settings` (
	`id` text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	`check_in_cutoff` text DEFAULT '09:00' NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`user_name` text NOT NULL,
	`user_role` text NOT NULL,
	`action` text NOT NULL,
	`entity` text NOT NULL,
	`entity_id` text NOT NULL,
	`entity_name` text NOT NULL,
	`outlet_id` text,
	`changes` text,
	`notes` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `bundle_items` (
	`bundle_id` text NOT NULL,
	`menu_id` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`bundle_id`, `menu_id`),
	FOREIGN KEY (`bundle_id`) REFERENCES `bundles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`menu_id`) REFERENCES `menus`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `bundle_outlets` (
	`bundle_id` text NOT NULL,
	`outlet_id` text NOT NULL,
	PRIMARY KEY(`bundle_id`, `outlet_id`),
	FOREIGN KEY (`bundle_id`) REFERENCES `bundles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`outlet_id`) REFERENCES `outlets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `bundles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`price` real DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`photo_url` text,
	`description` text
);
--> statement-breakpoint
CREATE TABLE `checklist_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`station` text NOT NULL,
	`type` text NOT NULL,
	`label` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `discounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`value` real DEFAULT 0 NOT NULL,
	`scope` text DEFAULT 'all' NOT NULL,
	`scope_ref_id` text,
	`start_at` text,
	`end_at` text,
	`active_hour_start` text,
	`active_hour_end` text,
	`is_active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ingredient_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`ingredient_id` text NOT NULL,
	`batch_number` text,
	`quantity` real NOT NULL,
	`received_date` text NOT NULL,
	`expiry_date` text,
	`purchase_price` real,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `ingredients` (
	`id` text PRIMARY KEY NOT NULL,
	`outlet_id` text NOT NULL,
	`name` text NOT NULL,
	`unit` text NOT NULL,
	`unit_price` real DEFAULT 0 NOT NULL,
	`current_stock` real DEFAULT 0 NOT NULL,
	`min_qty` real DEFAULT 0 NOT NULL,
	`storage_location` text,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`outlet_id`) REFERENCES `outlets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `menu_addon_groups` (
	`menu_id` text NOT NULL,
	`addon_group_id` text NOT NULL,
	PRIMARY KEY(`menu_id`, `addon_group_id`),
	FOREIGN KEY (`menu_id`) REFERENCES `menus`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`addon_group_id`) REFERENCES `addon_groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `menu_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `menu_outlets` (
	`menu_id` text NOT NULL,
	`outlet_id` text NOT NULL,
	PRIMARY KEY(`menu_id`, `outlet_id`),
	FOREIGN KEY (`menu_id`) REFERENCES `menus`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`outlet_id`) REFERENCES `outlets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `menus` (
	`id` text PRIMARY KEY NOT NULL,
	`category_id` text NOT NULL,
	`name` text NOT NULL,
	`sku` text NOT NULL,
	`price` real DEFAULT 0 NOT NULL,
	`hpp_cached` real DEFAULT 0 NOT NULL,
	`photo_url` text,
	`description` text,
	`type` text DEFAULT 'regular' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `menu_categories`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `outlets` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`opening_hours` text DEFAULT '' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `recipe_items` (
	`id` text PRIMARY KEY NOT NULL,
	`menu_id` text NOT NULL,
	`ingredient_id` text NOT NULL,
	`quantity` real NOT NULL,
	`notes` text,
	FOREIGN KEY (`menu_id`) REFERENCES `menus`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `sales_targets` (
	`id` text PRIMARY KEY NOT NULL,
	`year` integer NOT NULL,
	`month` integer NOT NULL,
	`target_amount` real DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expiresAt` integer NOT NULL,
	`token` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`ipAddress` text,
	`userAgent` text,
	`userId` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user_auth`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` text PRIMARY KEY NOT NULL,
	`ingredient_id` text NOT NULL,
	`outlet_id` text NOT NULL,
	`transaction_id` text,
	`batch_id` text,
	`type` text NOT NULL,
	`quantity` real NOT NULL,
	`notes` text,
	`user_id` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`outlet_id`) REFERENCES `outlets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `stock_opname_items` (
	`opname_id` text NOT NULL,
	`ingredient_id` text NOT NULL,
	`system_qty` real NOT NULL,
	`actual_qty` real NOT NULL,
	`diff` real NOT NULL,
	FOREIGN KEY (`opname_id`) REFERENCES `stock_opnames`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `stock_opnames` (
	`id` text PRIMARY KEY NOT NULL,
	`outlet_id` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`outlet_id`) REFERENCES `outlets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tax_settings` (
	`id` text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	`ppn_percent` real DEFAULT 11 NOT NULL,
	`service_charge_percent` real DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transaction_item_addons` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_item_id` text NOT NULL,
	`addon_option_id` text NOT NULL,
	`name_snapshot` text NOT NULL,
	`extra_price` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`transaction_item_id`) REFERENCES `transaction_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `transaction_items` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_id` text NOT NULL,
	`menu_id` text,
	`bundle_id` text,
	`name_snapshot` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`unit_price` real DEFAULT 0 NOT NULL,
	`hpp_snapshot` real DEFAULT 0 NOT NULL,
	`subtotal` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`outlet_id` text NOT NULL,
	`user_id` text NOT NULL,
	`subtotal` real DEFAULT 0 NOT NULL,
	`discount_total` real DEFAULT 0 NOT NULL,
	`ppn_amount` real DEFAULT 0 NOT NULL,
	`service_charge_amount` real DEFAULT 0 NOT NULL,
	`grand_total` real DEFAULT 0 NOT NULL,
	`payment_method` text NOT NULL,
	`status` text DEFAULT 'paid' NOT NULL,
	`order_type` text DEFAULT 'dine_in' NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`void_reason` text,
	`voided_by` text,
	`voided_at` text,
	FOREIGN KEY (`outlet_id`) REFERENCES `outlets`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `user_auth` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`emailVerified` integer DEFAULT false NOT NULL,
	`image` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`domain_user_id` text,
	FOREIGN KEY (`domain_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_auth_email_unique` ON `user_auth` (`email`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`outlet_id` text,
	`contact` text,
	`is_active` integer DEFAULT true NOT NULL,
	`joined_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`outlet_id`) REFERENCES `outlets`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer,
	`updatedAt` integer
);
