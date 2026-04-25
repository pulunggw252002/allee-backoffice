/**
 * One-shot migration helper untuk backoffice — jalankan
 * `CREATE TABLE IF NOT EXISTS` untuk tabel-tabel yang ditambah ke schema
 * tanpa harus pakai `drizzle-kit push` (yang sering crash di FK constraint).
 *
 * Aman dipanggil berulang — semua statement pakai `IF NOT EXISTS` /
 * idempotent.
 *
 * Run:
 *   dotenv -e .env.production -- tsx scripts/migrate-prod.ts
 *
 * Ketika nambah tabel baru di schema, tambahkan migration yang setara
 * di sini supaya prod ke-update tanpa drama.
 */

import { createClient } from "@libsql/client";

function clean(v: string | undefined): string {
  if (!v) return "";
  return v.trim().replace(/^["']|["']$/g, "").trim();
}

const PROD_URL = clean(process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL);
const PROD_TOKEN = clean(
  process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN,
);

if (!PROD_URL || !PROD_URL.startsWith("libsql://")) {
  console.error("✗ TURSO_DATABASE_URL harus libsql://… di .env.production");
  process.exit(1);
}
if (!PROD_TOKEN) {
  console.error("✗ TURSO_AUTH_TOKEN kosong");
  process.exit(1);
}

const client = createClient({ url: PROD_URL, authToken: PROD_TOKEN });

interface Migration {
  name: string;
  sql: string;
}

const migrations: Migration[] = [
  {
    name: "pos_shifts",
    sql: `
      CREATE TABLE IF NOT EXISTS "pos_shifts" (
        "id" text PRIMARY KEY NOT NULL,
        "outlet_id" text NOT NULL,
        "cashier_user_id" text NOT NULL,
        "cashier_name" text NOT NULL,
        "opening_cash" real NOT NULL DEFAULT 0,
        "actual_cash" real NOT NULL DEFAULT 0,
        "expected_cash" real NOT NULL DEFAULT 0,
        "cash_difference" real NOT NULL DEFAULT 0,
        "total_revenue" real NOT NULL DEFAULT 0,
        "order_count" integer NOT NULL DEFAULT 0,
        "breakdown" text NOT NULL DEFAULT '{}',
        "note" text,
        "opened_at" text NOT NULL,
        "closed_at" text NOT NULL,
        "synced_at" text NOT NULL DEFAULT (current_timestamp),
        FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON UPDATE no action ON DELETE restrict
      )
    `,
  },
  {
    name: "printers",
    sql: `
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
      )
    `,
  },
];

/**
 * Tambahin kolom kalau belum ada. SQLite tidak punya `ALTER TABLE ADD COLUMN
 * IF NOT EXISTS`, jadi kita inspect PRAGMA dulu — bikin idempotent buat
 * re-run migration.
 */
async function addColumnIfMissing(
  table: string,
  column: string,
  ddl: string,
): Promise<"added" | "exists"> {
  const info = await client.execute(`PRAGMA table_info(${table})`);
  const has = info.rows.some((r) => (r as Record<string, unknown>).name === column);
  if (has) return "exists";
  await client.execute(`ALTER TABLE "${table}" ADD COLUMN ${ddl}`);
  return "added";
}

async function main() {
  console.log("→ Connecting to:", PROD_URL.slice(0, 30) + "…\n");

  for (const m of migrations) {
    process.stdout.write(`  · ${m.name}: `);
    try {
      await client.execute(m.sql);
      const exists = await client.execute({
        sql: "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        args: [m.name],
      });
      console.log(exists.rows.length > 0 ? "✓ ready" : "✗ verify failed");
    } catch (err) {
      console.log("✗", err instanceof Error ? err.message : err);
      process.exit(1);
    }
  }

  // ── Outlet receipt customization columns (0004_outlet_receipt) ────────────
  const outletReceiptColumns: Array<[string, string]> = [
    ["brand_name", `"brand_name" text`],
    ["brand_subtitle", `"brand_subtitle" text`],
    ["receipt_footer", `"receipt_footer" text`],
    ["tax_id", `"tax_id" text`],
  ];
  for (const [col, ddl] of outletReceiptColumns) {
    process.stdout.write(`  · outlets.${col}: `);
    try {
      const r = await addColumnIfMissing("outlets", col, ddl);
      console.log(r === "added" ? "✓ added" : "✓ exists");
    } catch (err) {
      console.log("✗", err instanceof Error ? err.message : err);
      process.exit(1);
    }
  }

  console.log("\n✓ Semua migration selesai.");
  process.exit(0);
}

main().catch((err) => {
  console.error("\n✗ Gagal:", err);
  process.exit(1);
});
