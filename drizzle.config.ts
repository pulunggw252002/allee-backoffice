import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load `.env.local` first (mirror Next.js convention — local overrides menang),
// lalu `.env` untuk fallback. dotenv default tidak override existing var.
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

/**
 * drizzle-kit config — used by `npm run db:generate` and `npm run db:migrate`.
 *
 * The schema lives at `src/server/db/schema.ts`. Generated SQL migrations
 * land in `./drizzle` and should be committed to git.
 *
 * Two operating modes (auto-detected by env):
 *   - **Turso (production)** — set `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`.
 *     Drizzle uses dialect `turso` and pushes/migrates against the remote DB.
 *   - **Local file (dev)** — fall back to `DATABASE_URL` (default
 *     `./data/app.db`). Dialect `sqlite` runs against the file directly.
 *
 * Migrations themselves are pure SQLite-compatible SQL, so the same files
 * apply unchanged in either mode.
 */

const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
const tursoToken = process.env.TURSO_AUTH_TOKEN?.trim();

export default tursoUrl
  ? defineConfig({
      schema: "./src/server/db/schema.ts",
      out: "./drizzle",
      dialect: "turso",
      dbCredentials: {
        url: tursoUrl,
        authToken: tursoToken,
      },
      verbose: true,
      strict: true,
    })
  : defineConfig({
      schema: "./src/server/db/schema.ts",
      out: "./drizzle",
      dialect: "sqlite",
      dbCredentials: {
        url: process.env.DATABASE_URL ?? "./data/app.db",
      },
      verbose: true,
      strict: true,
    });
