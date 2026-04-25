-- Outlet receipt customization fields. Idempotent — pakai IF NOT EXISTS
-- pattern via PRAGMA agar safe re-run di environment yang sudah pernah migrate
-- sebagian (mis. saat dev kita ALTER manual lalu re-deploy).
--
-- Kolom-kolom baru:
--   brand_name      : nama yang muncul di header struk (fallback ke `name`)
--   brand_subtitle  : tagline kecil di bawah brand name
--   receipt_footer  : JSON array of strings — line-by-line footer
--   tax_id          : NPWP (kalau outlet PKP)

-- libSQL/SQLite: ALTER TABLE ADD COLUMN tidak support IF NOT EXISTS,
-- tapi migrate-prod.ts kita guard via _meta hash + try/catch.

ALTER TABLE outlets ADD COLUMN brand_name TEXT;
--> statement-breakpoint
ALTER TABLE outlets ADD COLUMN brand_subtitle TEXT;
--> statement-breakpoint
ALTER TABLE outlets ADD COLUMN receipt_footer TEXT;
--> statement-breakpoint
ALTER TABLE outlets ADD COLUMN tax_id TEXT;
