/**
 * One-shot rename: "POS Dago Service" / "POS Renon Service" → "POS Renon Servicer".
 *
 * Background: this user has out-of-sync name fields between `users` (domain)
 * and `user_auth` (Better Auth) — leftover from the old PATCH handler that
 * didn't cascade rename to the auth row. The new PATCH handler in
 * [src/app/api/users/[id]/route.ts](../src/app/api/users/[id]/route.ts)
 * cascades correctly going forward; this script repairs the legacy state
 * AND sets the canonical name the operator requested.
 *
 * Updates atomically (libsql batch):
 *   - users.name           → 'POS Renon Servicer'
 *   - user_auth.name       → 'POS Renon Servicer'
 *   - user_auth.email      → emailFromName('POS Renon Servicer')
 *
 * Run once: `npx tsx scripts/rename-user-once.ts`
 * Safe to re-run: no-op if no row matches the source names.
 */

import "./_env";
import { client } from "../src/server/db/client";
import { emailFromName } from "../src/lib/auth-email";

const TARGET_NAME = "POS Renon Servicer";
const SOURCE_NAMES = ["POS Dago Service", "POS Renon Service"];

async function main() {
  // Resolve the row by either of its known historical names so the script
  // works regardless of which table is currently out-of-date.
  const lookup = await client.execute({
    sql: `
      SELECT u.id AS user_id, u.name AS user_name,
             a.id AS auth_id, a.name AS auth_name, a.email AS auth_email
      FROM users u
      LEFT JOIN user_auth a ON a.domain_user_id = u.id
      WHERE u.name IN (?, ?) OR a.name IN (?, ?)
    `,
    args: [...SOURCE_NAMES, ...SOURCE_NAMES],
  });
  if (lookup.rows.length === 0) {
    console.log("[rename] no row matches the source names — nothing to do.");
    return;
  }
  const row = lookup.rows[0]!;
  const userId = String(row.user_id);
  const authId = row.auth_id ? String(row.auth_id) : null;
  const newEmail = emailFromName(TARGET_NAME);

  console.log("[rename] before:");
  console.log(`  users.name      = "${row.user_name}"`);
  console.log(`  user_auth.name  = "${row.auth_name ?? "<no auth row>"}"`);
  console.log(`  user_auth.email = "${row.auth_email ?? "<no auth row>"}"`);
  console.log("[rename] after:");
  console.log(`  users.name      = "${TARGET_NAME}"`);
  console.log(`  user_auth.name  = "${TARGET_NAME}"`);
  console.log(`  user_auth.email = "${newEmail}"`);

  // Email collision check before touching anything.
  if (authId) {
    const collision = await client.execute({
      sql: "SELECT id FROM user_auth WHERE email = ? AND id <> ?",
      args: [newEmail, authId],
    });
    if (collision.rows.length > 0) {
      throw new Error(
        `Email "${newEmail}" already used by user_auth.id=${collision.rows[0]!.id}. Aborting.`,
      );
    }
  }

  const now = Date.now();
  const stmts: { sql: string; args: unknown[] }[] = [
    { sql: "UPDATE users SET name = ? WHERE id = ?", args: [TARGET_NAME, userId] },
  ];
  if (authId) {
    stmts.push({
      sql: "UPDATE user_auth SET name = ?, email = ?, updatedAt = ? WHERE id = ?",
      args: [TARGET_NAME, newEmail, now, authId],
    });
  }
  await client.batch(stmts, "write");

  console.log("[rename] ✓ done.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[rename] FAILED:", err);
    process.exit(1);
  });
