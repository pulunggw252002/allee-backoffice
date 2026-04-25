import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db/client";
import { requireRole, requireSession } from "@/server/auth/session";
import { handle, notFound, readJson } from "@/server/api/helpers";
import { diffChanges, logAudit } from "@/server/api/audit";
import { firePosSync } from "@/lib/webhooks/pos-sync";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    await requireSession();
    const { id } = await params;
    const row = await db
      .select()
      .from(schema.menu_categories)
      .where(eq(schema.menu_categories.id, id))
      .get();
    if (!row) notFound("Category");
    return row;
  });
}

const Update = z
  .object({ name: z.string().min(1), sort_order: z.number().int() })
  .partial();

export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    requireRole(session, ["owner"]);
    const { id } = await params;
    const before = await db
      .select()
      .from(schema.menu_categories)
      .where(eq(schema.menu_categories.id, id))
      .get();
    if (!before) notFound("Category");
    const input = await readJson(req, Update);
    await db
      .update(schema.menu_categories)
      .set(input)
      .where(eq(schema.menu_categories.id, id));
    const after = await db
      .select()
      .from(schema.menu_categories)
      .where(eq(schema.menu_categories.id, id))
      .get();
    await logAudit(session, {
      action: "update",
      entity: "category",
      entity_id: id,
      entity_name: after!.name,
      changes: diffChanges(
        before as unknown as Record<string, unknown>,
        after as unknown as Record<string, unknown>,
      ),
    });
    await firePosSync({ entity: "category", event: "updated", entity_id: id });
    return after;
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    requireRole(session, ["owner"]);
    const { id } = await params;
    const row = await db
      .select()
      .from(schema.menu_categories)
      .where(eq(schema.menu_categories.id, id))
      .get();
    if (!row) notFound("Category");
    await db
      .delete(schema.menu_categories)
      .where(eq(schema.menu_categories.id, id));
    await logAudit(session, {
      action: "delete",
      entity: "category",
      entity_id: id,
      entity_name: row.name,
    });
    await firePosSync({ entity: "category", event: "deleted", entity_id: id });
    return { ok: true };
  });
}
