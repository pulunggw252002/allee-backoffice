ALTER TABLE `transaction_items` ADD `voided_at` text;--> statement-breakpoint
ALTER TABLE `transaction_items` ADD `voided_by` text;--> statement-breakpoint
ALTER TABLE `transaction_items` ADD `void_reason` text;--> statement-breakpoint
-- Backfill: existing tx-level voids → propagate to all items in that tx so
-- laporan void per-menu langsung kerja untuk data lama. Idempotent (WHERE
-- voided_at IS NULL) — aman dijalankan lagi tanpa overwriting per-item void
-- yang sudah di-set lewat endpoint baru.
UPDATE `transaction_items` SET
  `voided_at` = (SELECT `voided_at` FROM `transactions` WHERE `transactions`.`id` = `transaction_items`.`transaction_id`),
  `voided_by` = (SELECT `voided_by` FROM `transactions` WHERE `transactions`.`id` = `transaction_items`.`transaction_id`),
  `void_reason` = (SELECT `void_reason` FROM `transactions` WHERE `transactions`.`id` = `transaction_items`.`transaction_id`)
WHERE `voided_at` IS NULL
  AND `transaction_id` IN (SELECT `id` FROM `transactions` WHERE `status` = 'void');