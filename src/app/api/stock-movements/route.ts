/**
 * GET  /api/stock-movements?outlet_id=&type=&ingredient_id=
 * POST /api/stock-movements  — manual stock-in / stock-out / waste / adjust
 *                              Automatically updates `ingredients.current_stock`.
 */
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema, sqlite } from "@/server/db/client";
import {
  requireRole,
  requireSession,
  scopedOutletId,
} from "@/server/auth/session";
import {
  HttpError,
  badRequest,
  genId,
  handle,
  nowIso,
  notFound,
  readJson,
} from "@/server/api/helpers";
import { logAudit } from "@/server/api/audit";

export async function GET(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    const url = new URL(req.url);
    const outletId = scopedOutletId(session, url.searchParams.get("outlet_id"));
    const type = url.searchParams.get("type");
    const ingredientId = url.searchParams.get("ingredient_id");

    const filters = [];
    if (outletId) filters.push(eq(schema.stock_movements.outlet_id, outletId));
    if (type) filters.push(eq(schema.stock_movements.type, type as never));
    if (ingredientId)
      filters.push(eq(schema.stock_movements.ingredient_id, ingredientId));

    return db
      .select()
      .from(schema.stock_movements)
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(desc(schema.stock_movements.created_at))
      .limit(500)
      .all();
  });
}

const Input = z.object({
  ingredient_id: z.string(),
  outlet_id: z.string(),
  type: z.enum(["in", "out_sale", "out_waste", "adjustment", "opname"]),
  quantity: z.number(),
  notes: z.string().optional(),
});

export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    requireRole(session, ["owner", "kepala_toko"]);
    const input = await readJson(req, Input);
    if (input.quantity === 0) badRequest("Quantity cannot be 0");

    const ing = await db
      .select()
      .from(schema.ingredients)
      .where(eq(schema.ingredients.id, input.ingredient_id))
      .get();
    if (!ing) notFound("Ingredient");

    // Scope guard: kepala_toko may only touch movements for their own outlet,
    // and the ingredient's outlet must match the movement's outlet (no
    // cross-outlet stock teleport).
    const effectiveOutletId = scopedOutletId(session, input.outlet_id);
    if (effectiveOutletId !== input.outlet_id) {
      throw new HttpError(403, "Forbidden");
    }
    if (ing.outlet_id !== input.outlet_id) {
      badRequest("Bahan tidak terdaftar di outlet ini");
    }

    const row = {
      id: genId("mov"),
      ...input,
      transaction_id: null,
      batch_id: null,
      notes: input.notes ?? null,
      user_id: session.domainUser.id,
      created_at: nowIso(),
    };

    // Apply delta to current_stock. `in` / `adjustment+` increase; `out_*` decrease.
    const delta =
      input.type === "in" || input.type === "adjustment"
        ? input.quantity
        : -Math.abs(input.quantity);

    // Insert the movement + update the stock in a single transaction so a
    // failure in the second statement doesn't leave the log and the actual
    // stock desynced.
    sqlite.transaction(() => {
      db.insert(schema.stock_movements).values(row).run();
      db.update(schema.ingredients)
        .set({
          current_stock: sql`${schema.ingredients.current_stock} + ${delta}`,
          updated_at: nowIso(),
        })
        .where(eq(schema.ingredients.id, input.ingredient_id))
        .run();
    })();

    await logAudit(session, {
      action: input.type === "in" ? "stock_in" : "stock_out",
      entity: "ingredient",
      entity_id: input.ingredient_id,
      entity_name: ing.name,
      outlet_id: input.outlet_id,
      notes: `${input.type} ${input.quantity} ${ing.unit}`,
    });
    return row;
  });
}
