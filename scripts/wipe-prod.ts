/**
 * Wipe production data — clean slate untuk integration test.
 *
 * Hapus SEMUA seed/mock data, transaksi, log, dan user kecuali:
 *   - 1 outlet (semua outlet di-keep — owner butuh outlet aktif untuk
 *     attach menu baru ke outlet).
 *   - 1 owner user (role='owner') + Better Auth identitas-nya (user_auth +
 *     account credential) → biar owner masih bisa login.
 *   - Singleton settings (tax_settings, attendance_settings) — config dasar.
 *
 * Idempotent. Aman di-run berulang.
 *
 * Run: npx tsx scripts/wipe-prod.ts
 */

import "./_env";
import { client } from "../src/server/db/client";

const TABLES_FK_ORDER = [
  // Transactions (paling dalam dulu)
  "transaction_item_addons",
  "transaction_items",
  "transactions",
  // Inventory movements
  "stock_movements",
  "stock_opname_items",
  "stock_opnames",
  "ingredient_batches",
  // Catalog (children before parents)
  "recipe_items",
  "menu_addon_groups",
  "menu_outlets",
  "bundle_items",
  "bundle_outlets",
  "bundles",
  "addon_recipe_modifiers",
  "addon_options",
  "addon_groups",
  "discounts",
  // Channel integrations
  "ojol_sync_logs",
  "menu_channel_listings",
  "ojol_channels",
  // Menu / ingredients
  "menus",
  "menu_categories",
  "ingredients",
  // Audit / attendance / shifts / targets
  "audit_logs",
  "attendance",
  "checklist_templates",
  "sales_targets",
  "pos_shifts",
];

async function main() {
  // 1. Cari owner + auth identity-nya.
  const ownerRes = await client.execute(
    "SELECT id, name FROM users WHERE role='owner' ORDER BY joined_at LIMIT 1",
  );
  if (ownerRes.rows.length === 0) {
    throw new Error(
      "[wipe] Tidak ada user dengan role='owner'. Aborting — bisa lock-out total.",
    );
  }
  const ownerId = String(ownerRes.rows[0]!.id);
  const ownerName = String(ownerRes.rows[0]!.name);
  console.log(`[wipe] Owner yang akan di-keep: ${ownerName} (${ownerId})`);

  const authRes = await client.execute({
    sql: "SELECT id, email FROM user_auth WHERE domain_user_id = ?",
    args: [ownerId],
  });
  if (authRes.rows.length === 0) {
    throw new Error(
      `[wipe] Owner ${ownerId} tidak punya Better Auth identity. Aborting — owner ga bisa login setelah wipe.`,
    );
  }
  const ownerAuthId = String(authRes.rows[0]!.id);
  console.log(`[wipe] Better Auth row: ${authRes.rows[0]!.email} (${ownerAuthId})`);

  // 2. Hapus semua data tables (FK-safe order).
  console.log("[wipe] Menghapus data tables…");
  for (const t of TABLES_FK_ORDER) {
    const r = await client.execute(`DELETE FROM ${t}`);
    console.log(`  ✓ ${t} (${r.rowsAffected} rows)`);
  }

  // 3. Hapus session & verification (Better Auth — temporary, aman di-flush total).
  console.log("[wipe] Menghapus auth sessions & verifications…");
  await client.execute("DELETE FROM session");
  await client.execute("DELETE FROM verification");

  // 4. Hapus account untuk semua user_auth KECUALI owner.
  await client.execute({
    sql: "DELETE FROM account WHERE userId != ?",
    args: [ownerAuthId],
  });

  // 5. Hapus user_auth KECUALI owner.
  await client.execute({
    sql: "DELETE FROM user_auth WHERE id != ?",
    args: [ownerAuthId],
  });

  // 6. Hapus users KECUALI owner.
  const usersDel = await client.execute({
    sql: "DELETE FROM users WHERE id != ?",
    args: [ownerId],
  });
  console.log(`[wipe] User non-owner di-hapus: ${usersDel.rowsAffected}`);

  // 7. Verifikasi.
  const stats = await client.execute(`
    SELECT
      (SELECT COUNT(*) FROM users) AS users,
      (SELECT COUNT(*) FROM user_auth) AS user_auth,
      (SELECT COUNT(*) FROM account) AS account,
      (SELECT COUNT(*) FROM outlets) AS outlets,
      (SELECT COUNT(*) FROM menus) AS menus,
      (SELECT COUNT(*) FROM ingredients) AS ingredients,
      (SELECT COUNT(*) FROM transactions) AS transactions,
      (SELECT COUNT(*) FROM audit_logs) AS audit_logs
  `);
  console.log("[wipe] Final state:");
  for (const [k, v] of Object.entries(stats.rows[0]!)) {
    console.log(`  ${k.padEnd(15)} = ${v}`);
  }

  console.log("");
  console.log(`[wipe] ✓ Clean. Login dengan: ${authRes.rows[0]!.email} / password`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[wipe] FAILED:", err);
    process.exit(1);
  });
