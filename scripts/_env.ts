/**
 * Side-effect-only env loader.
 *
 * Import THIS FIRST (sebelum import lain) di setiap script standalone:
 *
 *   import "./_env";
 *   import { client } from "../src/server/db/client";
 *
 * Karena ESM imports dievaluasi dalam urutan source, file ini akan run
 * `dotenv.config()` sebelum module manapun yang membaca `process.env`.
 * Tanpa ini, `client.ts` ke-evaluate duluan dengan env kosong dan
 * jatuh ke local file mode (bug yang sempat bikin verify nyambung
 * ke `data/app.db` padahal log-nya bilang Turso).
 */
import { config } from "dotenv";

// `.env.local` menang dari `.env` (Next.js convention). dotenv default
// tidak override existing var, jadi load .env.local DULU.
config({ path: ".env.local" });
config({ path: ".env" });
