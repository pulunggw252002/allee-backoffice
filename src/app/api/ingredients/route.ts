/**
 * GET  /api/ingredients?outlet_id=<id>  — list ingredients (scoped to outlet)
 * POST /api/ingredients                 — create
 */
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db/client";
import {
  requireRole,
  requireSession,
  scopedOutletId,
} from "@/server/auth/session";
import {
  badRequest,
  genId,
  handle,
  nowIso,
  readJson,
} from "@/server/api/helpers";
import { logAudit } from "@/server/api/audit";
import { firePosSync } from "@/lib/webhooks/pos-sync";

export async function GET(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    const url = new URL(req.url);
    const requested = url.searchParams.get("outlet_id");
    const outletId = scopedOutletId(session, requested);
    const q = db.select().from(schema.ingredients);
    return outletId
      ? q.where(eq(schema.ingredients.outlet_id, outletId)).all()
      : q.all();
  });
}

const Input = z.object({
  outlet_id: z.string(),
  name: z.string().min(1),
  unit: z.string().min(1),
  unit_price: z.number().nonnegative().default(0),
  current_stock: z.number().nonnegative().default(0),
  min_qty: z.number().nonnegative().default(0),
  storage_location: z.string().optional(),
});

export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    requireRole(session, ["owner", "kepala_toko"]);
    const input = await readJson(req, Input);
    // Kepala Toko can only create ingredients for their own outlet — if the
    // client payload names a different outlet, reject rather than silently
    // re-scoping so the UI is forced to stay honest.
    const effectiveOutletId = scopedOutletId(session, input.outlet_id);
    if (effectiveOutletId !== input.outlet_id) {
      badRequest("Tidak boleh membuat bahan untuk outlet lain");
    }
    const row = {
      id: genId("ing"),
      ...input,
      storage_location: input.storage_location ?? null,
      updated_at: nowIso(),
    };
    await db.insert(schema.ingredients).values(row);
    await logAudit(session, {
      action: "create",
      entity: "ingredient",
      entity_id: row.id,
      entity_name: row.name,
      outlet_id: row.outlet_id,
    });
    await firePosSync({
      entity: "ingredient",
      event: "created",
      entity_id: row.id,
      outlet_id: row.outlet_id,
    });
    return row;
  });
}
