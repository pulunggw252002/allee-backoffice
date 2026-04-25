import "./_env";
import { client } from "../src/server/db/client";

async function main() {
  const r = await client.execute(
    "SELECT email, name FROM user_auth ORDER BY name",
  );
  console.log("Better Auth users:");
  for (const row of r.rows) console.log("  " + row.email + " (" + row.name + ")");
  const acc = await client.execute(
    "SELECT COUNT(*) AS c FROM account WHERE providerId='credential' AND password IS NOT NULL",
  );
  console.log("credential accounts dengan password:", acc.rows[0]!.c);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
