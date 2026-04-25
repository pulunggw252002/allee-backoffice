import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db/client";
import {
  requireRole,
  requireSession,
  scopedOutletId,
} from "@/server/auth/session";
import {
  HttpError,
  handle,
  notFound,
  nowIso,
  readJson,
} from "@/server/api/helpers";
import { diffChanges, logAudit } from "@/server/api/audit";
import { firePosSync } from "@/lib/webhooks/pos-sync";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    await requireSession();
    const { id } = await params;
    const row = await db
      .select()
      .from(schema.ingredients)
      .where(eq(schema.ingredients.id, id))
      .get();
    if (!row) notFound("Ingredient");
    return row;
  });
}

const Update = z
  .object({
    name: z.string().min(1),
    unit: z.string().min(1),
    unit_price: z.number().nonnegative(),
    // Stock cannot logically go negative — opname adjustments below zero
    // should be modeled as separate stock_movements, not a direct edit.
    current_stock: z.number().nonnegative(),
    min_qty: z.number().nonnegative(),
    storage_location: z.string().nullable(),
  })
  .partial();

export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    requireRole(session, ["owner", "kepala_toko"]);
    const { id } = await params;
    const before = await db
      .select()
      .from(schema.ingredients)
      .where(eq(schema.ingredients.id, id))
      .get();
    if (!before) notFound("Ingredient");
    // Kepala Toko can only mutate ingredients in their own outlet. Compare
    // the row's outlet_id against the session's scoped outlet — if they
    // differ, pretend the row does not exist (don't leak its existence).
    const effectiveOutletId = scopedOutletId(session, before.outlet_id);
    if (effectiveOutletId !== before.outlet_id) {
      throw new HttpError(403, "Forbidden");
    }
    const input = await readJson(req, Update);
    await db
      .update(schema.ingredients)
      .set({ ...input, updated_at: nowIso() })
      .where(eq(schema.ingredients.id, id));
    const after = await db
      .select()
      .from(schema.ingredients)
      .where(eq(schema.ingredients.id, id))
      .get();
    await logAudit(session, {
      action: "update",
      entity: "ingredient",
      entity_id: id,
      entity_name: after!.name,
      outlet_id: after!.outlet_id,
      changes: diffChanges(
        before as unknown as Record<string, unknown>,
        after as unknown as Record<string, unknown>,
      ),
    });
    await firePosSync({
      entity: "ingredient",
      event: "updated",
      entity_id: id,
      outlet_id: after!.outlet_id,
    });
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
      .from(schema.ingredients)
      .where(eq(schema.ingredients.id, id))
      .get();
    if (!row) notFound("Ingredient");
    await db
      .delete(schema.ingredients)
      .where(eq(schema.ingredients.id, id));
    await logAudit(session, {
      action: "delete",
      entity: "ingredient",
      entity_id: id,
      entity_name: row.name,
      outlet_id: row.outlet_id,
    });
    await firePosSync({
      entity: "ingredient",
      event: "deleted",
      entity_id: id,
      outlet_id: row.outlet_id,
    });
    return { ok: true };
  });
}
