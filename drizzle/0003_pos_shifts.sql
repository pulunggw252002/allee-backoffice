-- POS shift summaries (rekap kas / cash difference per shift). POS push
-- summary tiap kali kasir tutup shift via POST /api/internal/pos-shifts.
-- Idempotent (PK = shift id POS) supaya retry safe.
CREATE TABLE IF NOT EXISTS `pos_shifts` (
  `id` text PRIMARY KEY NOT NULL,
  `outlet_id` text NOT NULL,
  `cashier_user_id` text NOT NULL,
  `cashier_name` text NOT NULL,
  `opening_cash` real NOT NULL DEFAULT 0,
  `actual_cash` real NOT NULL DEFAULT 0,
  `expected_cash` real NOT NULL DEFAULT 0,
  `cash_difference` real NOT NULL DEFAULT 0,
  `total_revenue` real NOT NULL DEFAULT 0,
  `order_count` integer NOT NULL DEFAULT 0,
  `breakdown` text NOT NULL DEFAULT '{}',
  `note` text,
  `opened_at` text NOT NULL,
  `closed_at` text NOT NULL,
  `synced_at` text NOT NULL DEFAULT (current_timestamp),
  FOREIGN KEY (`outlet_id`) REFERENCES `outlets`(`id`) ON UPDATE no action ON DELETE restrict
);
