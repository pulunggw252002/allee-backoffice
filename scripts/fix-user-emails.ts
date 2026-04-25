/**
 * One-shot DB repair: rewrite `user_auth.email` so it matches the canonical
 * format produced by `emailFromName()`.
 *
 * Why this exists:
 *   The original `POST /api/users` route synthesized `<slug(name)>-<id4>@allee.local`,
 *   while login looks up `<slug(name)>@allee.local`. The two never matched
 *   so any user created through the UI couldn't log in. The bug is fixed
 *   forward in [src/lib/auth-email.ts](../src/lib/auth-email.ts), but rows
 *   that were already written carry the old format and need a one-time
 *   rewrite. Single-word seeded users (e.g. "Budi") are unaffected — their
 *   slug is identical under both formulas.
 *
 * Behaviour:
 *   - Reads every `user_auth` row.
 *   - For each row whose `email` differs from `emailFromName(name)`, prints
 *     a diff line and (unless `--dry` is passed) writes the new email.
 *   - If the new email collides with another row, skips that row and warns
 *     loudly — the operator must resolve the duplicate by renaming one of
 *     the conflicting domain users first.
 *
 * Run:
 *   npm run db:fix-emails -- --dry   # preview
 *   npm run db:fix-emails            # apply
 *
 * Idempotent: running again is a no-op once every email matches.
 */

import "./_env";
import { client } from "../src/server/db/client";
import { emailFromName } from "../src/lib/auth-email";

const isDry = process.argv.includes("--dry");

async function main() {
  const res = await client.execute(
    "SELECT id, name, email FROM user_auth ORDER BY name",
  );
  const rows = res.rows as unknown as Array<{
    id: string;
    name: string;
    email: string;
  }>;

  // Pre-build a lookup so we can detect collisions before the UPDATE hits
  // the UNIQUE index on `user_auth.email` and rolls back the whole script.
  const emailOwner = new Map<string, string>();
  for (const r of rows) emailOwner.set(r.email, r.id);

  let updated = 0;
  let skipped = 0;
  let unchanged = 0;

  for (const row of rows) {
    const expected = emailFromName(row.name);
    if (row.email === expected) {
      unchanged++;
      continue;
    }
    const otherOwner = emailOwner.get(expected);
    if (otherOwner && otherOwner !== row.id) {
      console.warn(
        `[skip] "${row.name}" → ${expected} clashes with another row (${otherOwner}). Rename one of them via Backoffice and re-run.`,
      );
      skipped++;
      continue;
    }
    console.log(`[fix ] ${row.email}  →  ${expected}    (name="${row.name}")`);
    if (!isDry) {
      await client.execute({
        sql: "UPDATE user_auth SET email = ?, updatedAt = ? WHERE id = ?",
        args: [expected, Date.now(), row.id],
      });
      // Update local map so subsequent iterations see the new email.
      emailOwner.delete(row.email);
      emailOwner.set(expected, row.id);
    }
    updated++;
  }

  console.log("");
  console.log(
    `[done] ${unchanged} unchanged, ${updated} ${isDry ? "would update" : "updated"}, ${skipped} skipped (collision)`,
  );
  if (isDry) {
    console.log("[done] dry run — no rows written. Re-run without --dry to apply.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[fix-user-emails] FAILED:", err);
    process.exit(1);
  });
