/**
 * GET  /api/categories  — list menu categories
 * POST /api/categories  — create
 */
import { z } from "zod";
import { asc } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { requireRole, requireSession } from "@/server/auth/session";
import { genId, handle, readJson } from "@/server/api/helpers";
import { logAudit } from "@/server/api/audit";
import { firePosSync } from "@/lib/webhooks/pos-sync";

export async function GET() {
  return handle(async () => {
    await requireSession();
    return db
      .select()
      .from(schema.menu_categories)
      .orderBy(asc(schema.menu_categories.sort_order))
      .all();
  });
}

const Input = z.object({
  name: z.string().min(1),
  sort_order: z.number().int().default(0),
});

export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    requireRole(session, ["owner"]);
    const input = await readJson(req, Input);
    const row = { id: genId("cat"), ...input };
    await db.insert(schema.menu_categories).values(row);
    await logAudit(session, {
      action: "create",
      entity: "category",
      entity_id: row.id,
      entity_name: row.name,
    });
    // Notify POS so its cached category list refreshes within seconds, not
    // on the next cron tick. Awaited (not fire-and-forget) so the call
    // completes before the Vercel serverless instance freezes.
    await firePosSync({ entity: "category", event: "created", entity_id: row.id });
    return row;
  });
}
