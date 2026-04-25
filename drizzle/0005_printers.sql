-- Printer registry per outlet. Master data milik backoffice — POS pull via
-- sync. Owner pakai untuk monitor jumlah & kode printer per outlet.
--
-- Idempotent: pakai CREATE TABLE IF NOT EXISTS supaya safe re-run di env
-- yang sudah pernah migrate via scripts/migrate-prod.ts.

CREATE TABLE IF NOT EXISTS "printers" (
  "id" text PRIMARY KEY NOT NULL,
  "outlet_id" text NOT NULL,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "type" text NOT NULL DEFAULT 'cashier',
  "connection" text NOT NULL DEFAULT 'usb',
  "address" text,
  "paper_width" integer NOT NULL DEFAULT 32,
  "note" text,
  "is_active" integer NOT NULL DEFAULT 1,
  "created_at" text NOT NULL DEFAULT (current_timestamp),
  "updated_at" text NOT NULL DEFAULT (current_timestamp),
  FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON UPDATE no action ON DELETE cascade
);
