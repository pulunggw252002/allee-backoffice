/**
 * Quick smoke-test Turso connection.
 *
 * Usage: `npx tsx scripts/verify-turso.ts`
 *
 * Membaca env (TURSO_*), konek pakai client yang sama dengan Next.js,
 * lalu list semua tabel + count beberapa tabel utama. Pakai ini untuk:
 * - Konfirmasi token + URL valid setelah set env baru
 * - Cek jumlah row setelah seed
 * - Sanity-check sebelum deploy
 */
import "./_env";
import { client } from "../src/server/db/client";

async function main() {
  const url =
    process.env.TURSO_DATABASE_URL ||
    process.env.DATABASE_URL ||
    "(default file)";
  console.log(`[verify] connecting to: ${url}`);

  const tables = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle_%' ORDER BY name",
  );
  console.log(`[verify] tables (${tables.rows.length}):`);
  for (const row of tables.rows) console.log(`  - ${row.name}`);

  const counts = [
    "outlets",
    "users",
    "user_auth",
    "menus",
    "ingredients",
    "transactions",
    "audit_logs",
  ];
  console.log("\n[verify] row counts:");
  for (const t of counts) {
    try {
      const r = await client.execute(`SELECT COUNT(*) AS c FROM ${t}`);
      console.log(`  ${t.padEnd(15)} ${r.rows[0]!.c}`);
    } catch (err) {
      console.log(`  ${t.padEnd(15)} (table missing)`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[verify] FAILED:", err);
    process.exit(1);
  });
