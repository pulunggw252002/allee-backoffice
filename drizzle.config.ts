import "dotenv/config";
import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit config — used by `npm run db:generate` and `npm run db:migrate`.
 *
 * The schema lives at `src/server/db/schema.ts`. Generated SQL migrations
 * land in `./drizzle` and should be committed to git.
 */
export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "./data/app.db",
  },
  verbose: true,
  strict: true,
});
