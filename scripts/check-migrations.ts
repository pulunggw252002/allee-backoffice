import "./_env";
import { client } from "../src/server/db/client";

async function main() {
  const url =
    process.env.TURSO_DATABASE_URL ||
    process.env.DATABASE_URL ||
    "(default file)";
  console.log(`[check] DB: ${url}`);

  const m = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '__drizzle%' ORDER BY name",
  );
  console.log(
    `[check] drizzle tables:`,
    m.rows.map((r) => r.name),
  );
  if (m.rows.length > 0) {
    const j = await client.execute(
      "SELECT * FROM __drizzle_migrations ORDER BY id",
    );
    console.log(`[check] migrations applied: ${j.rows.length}`);
    for (const row of j.rows) console.log(" ", row);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
