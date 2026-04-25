/**
 * Setup fresh: hapus semua mocked outlets + users, lalu insert 1 outlet
 * + 1 owner placeholder. Owner bisa rename via UI setelah login.
 *
 * Outlet id sengaja `out_dago` supaya cocok dengan POS env
 * `NEXT_PUBLIC_OUTLET_ID=out_dago` — gak perlu redeploy POS.
 *
 * Run: npx tsx scripts/setup-fresh.ts
 */

import "./_env";
import { client } from "../src/server/db/client";
import { auth } from "../src/server/auth";

const OUTLET_ID = "out_dago";
const OUTLET_NAME = "Outlet Utama";

const OWNER_ID = "usr_owner";
const OWNER_AUTH_ID = "au_usr_owner";
const OWNER_NAME = "Owner";
const OWNER_EMAIL = "owner@allee.local";
const OWNER_PASSWORD = "password";

async function main() {
  console.log("[setup] Membersihkan outlets + users lama…");

  // FK-safe: kosongkan tabel yang ngarah ke outlets/users dulu (sudah kosong
  // dari wipe-prod, tapi defensive).
  const dependents = [
    "transaction_item_addons",
    "transaction_items",
    "transactions",
    "stock_movements",
    "stock_opname_items",
    "stock_opnames",
    "ingredient_batches",
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
    "ojol_sync_logs",
    "menu_channel_listings",
    "ojol_channels",
    "menus",
    "menu_categories",
    "ingredients",
    "audit_logs",
    "attendance",
    "checklist_templates",
    "sales_targets",
    "pos_shifts",
  ];
  for (const t of dependents) {
    await client.execute(`DELETE FROM ${t}`);
  }

  // Hapus auth artifacts dulu (FK ke user_auth).
  await client.execute("DELETE FROM session");
  await client.execute("DELETE FROM verification");
  await client.execute("DELETE FROM account");
  await client.execute("DELETE FROM user_auth");
  await client.execute("DELETE FROM users");
  await client.execute("DELETE FROM outlets");

  console.log("[setup] Insert outlet…");
  await client.execute({
    sql: `INSERT INTO outlets (id, name, address, city, phone, opening_hours, is_active, created_at)
          VALUES (?, ?, '', '', '', '', 1, datetime('now'))`,
    args: [OUTLET_ID, OUTLET_NAME],
  });

  console.log("[setup] Insert owner (domain user)…");
  await client.execute({
    sql: `INSERT INTO users (id, name, role, outlet_id, contact, is_active, joined_at, pos_pin_hash)
          VALUES (?, ?, 'owner', NULL, NULL, 1, datetime('now'), NULL)`,
    args: [OWNER_ID, OWNER_NAME],
  });

  console.log("[setup] Insert Better Auth identity + credential…");
  const ctx = await auth.$context;
  const passwordHash = await ctx.password.hash(OWNER_PASSWORD);
  const now = Math.floor(Date.now() / 1000);
  await client.execute({
    sql: `INSERT INTO user_auth (id, name, email, emailVerified, image, createdAt, updatedAt, domain_user_id)
          VALUES (?, ?, ?, 1, NULL, ?, ?, ?)`,
    args: [OWNER_AUTH_ID, OWNER_NAME, OWNER_EMAIL, now, now, OWNER_ID],
  });
  await client.execute({
    sql: `INSERT INTO account (id, accountId, providerId, userId, accessToken, refreshToken, idToken,
                               accessTokenExpiresAt, refreshTokenExpiresAt, scope, password, createdAt, updatedAt)
          VALUES (?, ?, 'credential', ?, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?, ?)`,
    args: [
      `ac_${OWNER_ID}`,
      OWNER_AUTH_ID,
      OWNER_AUTH_ID,
      passwordHash,
      now,
      now,
    ],
  });

  // Default singleton config kalau belum ada (set saat first deploy).
  await client.execute({
    sql: `INSERT OR IGNORE INTO tax_settings (id, ppn_percent, service_charge_percent, updated_at)
          VALUES ('singleton', 11, 0, datetime('now'))`,
    args: [],
  });
  await client.execute({
    sql: `INSERT OR IGNORE INTO attendance_settings (id, check_in_cutoff, updated_at)
          VALUES ('singleton', '09:00', datetime('now'))`,
    args: [],
  });

  // Verify
  const stats = await client.execute(`
    SELECT
      (SELECT COUNT(*) FROM outlets) AS outlets,
      (SELECT COUNT(*) FROM users) AS users,
      (SELECT COUNT(*) FROM user_auth) AS user_auth,
      (SELECT COUNT(*) FROM account) AS account
  `);
  console.log("[setup] Final state:");
  for (const [k, v] of Object.entries(stats.rows[0]!)) {
    console.log(`  ${k.padEnd(15)} = ${v}`);
  }

  console.log("");
  console.log("[setup] ✓ Selesai. Login backoffice:");
  console.log(`  Email    : ${OWNER_EMAIL}`);
  console.log(`  Password : ${OWNER_PASSWORD}`);
  console.log(`  Outlet   : ${OUTLET_NAME} (${OUTLET_ID})`);
  console.log("");
  console.log("Owner bisa rename outlet/edit struk di Backoffice → Outlets.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[setup] FAILED:", err);
    process.exit(1);
  });
