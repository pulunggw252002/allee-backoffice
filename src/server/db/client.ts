/**
 * SQLite connection + Drizzle client.
 *
 * Uses `better-sqlite3` — synchronous, single-file, perfect for a single-node
 * VPS deployment. Enables WAL mode so read queries don't block writes.
 *
 * A single Node.js process owns the DB; the file lives at `DATABASE_URL`
 * (default `./data/app.db`, relative to the Next.js working directory). Make
 * sure the parent directory exists and is writable by the Node process.
 */

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

function resolveDbPath(): string {
  const raw = process.env.DATABASE_URL ?? "./data/app.db";
  // Strip a leading `file:` if present (common Drizzle convention).
  const cleaned = raw.replace(/^file:/, "");
  const abs = path.isAbsolute(cleaned)
    ? cleaned
    : path.join(process.cwd(), cleaned);
  const dir = path.dirname(abs);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return abs;
}

// Singleton across hot-reloads in `next dev`. Reusing a global symbol prevents
// "database is locked" errors when Next.js re-evaluates this module.
const globalForDb = globalThis as unknown as {
  __alleeSqlite?: Database.Database;
  __alleeDrizzle?: ReturnType<typeof drizzle<typeof schema>>;
};

export const sqlite =
  globalForDb.__alleeSqlite ??
  (() => {
    const instance = new Database(resolveDbPath());
    instance.pragma("journal_mode = WAL");
    instance.pragma("foreign_keys = ON");
    instance.pragma("busy_timeout = 5000");
    return instance;
  })();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__alleeSqlite = sqlite;
}

export const db =
  globalForDb.__alleeDrizzle ?? drizzle(sqlite, { schema, logger: false });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__alleeDrizzle = db;
}

export { schema };
