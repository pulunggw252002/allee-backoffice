/**
 * libSQL connection + Drizzle client.
 *
 * Single client supports two deployment shapes:
 *   1. Local development — `DATABASE_URL=file:./data/app.db` (libsql in
 *      embedded mode, no network). Default fallback when `TURSO_*` vars
 *      tidak diset.
 *   2. Production / Turso — `TURSO_DATABASE_URL=libsql://<db>.turso.io`
 *      plus `TURSO_AUTH_TOKEN=<token>`. Async over HTTP/WS, auto-replicates
 *      across Turso edges.
 *
 * Drizzle's libsql adapter wraps both modes behind the same async API
 * (`.get()`, `.all()`, `.run()` semua return Promise — kalau ada code yang
 * masih sinkron, perbaiki ke await).
 */

import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

type ConnectionConfig = {
  /** URL passed to `createClient` — `libsql://`, `https://`, or `file:` form. */
  url: string;
  /** Optional auth token for remote Turso. Ignored for `file:` URLs. */
  authToken?: string;
};

function resolveConnection(): ConnectionConfig {
  // Prefer explicit Turso vars when set — this is the production shape.
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
  const tursoToken = process.env.TURSO_AUTH_TOKEN?.trim();
  if (tursoUrl) {
    return { url: tursoUrl, authToken: tursoToken };
  }

  // Fall back to DATABASE_URL (local dev convention) atau default file path.
  const raw = process.env.DATABASE_URL?.trim() || "file:./data/app.db";

  // Accept three forms:
  //   - "libsql://..."  → remote (DATABASE_URL juga boleh dipakai, tapi
  //                       biasanya ini Turso → user salah letak)
  //   - "file:..."      → local libsql file
  //   - "./..." / "/.." → bare path, normalize ke "file:<abs>"
  if (raw.startsWith("libsql://") || raw.startsWith("https://")) {
    return {
      url: raw,
      authToken: process.env.DATABASE_AUTH_TOKEN?.trim(),
    };
  }

  // Local file mode. libsql ingin format "file:<absolute-path>".
  const stripped = raw.replace(/^file:/, "");
  const abs = path.isAbsolute(stripped)
    ? stripped
    : path.join(process.cwd(), stripped);
  const dir = path.dirname(abs);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return { url: `file:${abs}` };
}

// Singleton across hot-reloads in `next dev`. Reusing a global symbol prevents
// "database is locked" errors when Next.js re-evaluates this module + saves
// reconnects to Turso edges in development.
const globalForDb = globalThis as unknown as {
  __alleeLibsql?: Client;
  __alleeDrizzle?: LibSQLDatabase<typeof schema>;
};

function buildClient(): Client {
  const cfg = resolveConnection();
  const client = createClient({ url: cfg.url, authToken: cfg.authToken });

  // For local file mode, enable WAL + busy timeout supaya UX-nya sama dengan
  // setup better-sqlite3 sebelumnya. Remote Turso ignore PRAGMA journal_mode
  // (server-managed) — tetap aman karena PRAGMA invalid hanya jadi no-op.
  if (cfg.url.startsWith("file:")) {
    // Fire-and-forget: PRAGMA harus dikirim sebelum query pertama, tapi
    // libsql client antri statement otomatis. Pakai .then() supaya kalau
    // ada error tetap ke-log tanpa block module load.
    client
      .executeMultiple(
        "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
      )
      .catch((err) => {
        console.error("[db] failed to set local PRAGMAs:", err);
      });
  }
  return client;
}

export const client: Client =
  globalForDb.__alleeLibsql ?? buildClient();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__alleeLibsql = client;
}

export const db: LibSQLDatabase<typeof schema> =
  globalForDb.__alleeDrizzle ?? drizzle(client, { schema, logger: false });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__alleeDrizzle = db;
}

export { schema };
