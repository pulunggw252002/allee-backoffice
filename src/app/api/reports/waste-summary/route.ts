/**
 * GET /api/reports/waste-summary?outlet_id=&start=&end=
 * Aggregates `out_waste` and negative `adjustment` stock movements into an
 * IDR-valued waste report (quantity × ingredient.unit_price).
 */
import { and, eq, gte, inArray, lte, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { requireSession, scopedOutletId } from "@/server/auth/session";
import { handle } from "@/server/api/helpers";

export async function GET(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    const url = new URL(req.url);
    const outletId = scopedOutletId(session, url.searchParams.get("outlet_id"));
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");

    const conds: SQL[] = [];
    const wasteOrNegAdj = or(
      eq(schema.stock_movements.type, "out_waste"),
      and(
        eq(schema.stock_movements.type, "adjustment"),
        sql`${schema.stock_movements.quantity} < 0`,
      ),
    );
    if (wasteOrNegAdj) conds.push(wasteOrNegAdj);
    if (outletId) conds.push(eq(schema.stock_movements.outlet_id, outletId));
    if (start) conds.push(gte(schema.stock_movements.created_at, start));
    if (end) conds.push(lte(schema.stock_movements.created_at, end));

    const movs = await db
      .select()
      .from(schema.stock_movements)
      .where(conds.length > 0 ? and(...conds) : undefined)
      .all();
    if (movs.length === 0) {
      return { total_value: 0, by_ingredient: [] };
    }

    const ingIds = [...new Set(movs.map((m) => m.ingredient_id))];
    const ingredients = await db
      .select()
      .from(schema.ingredients)
      .where(inArray(schema.ingredients.id, ingIds))
      .all();
    const ingMap = new Map(ingredients.map((i) => [i.id, i]));

    const map = new Map<
      string,
      { ingredient_id: string; name: string; quantity: number; value: number }
    >();
    for (const m of movs) {
      const ing = ingMap.get(m.ingredient_id);
      if (!ing) continue;
      const qty = Math.abs(m.quantity);
      const row = map.get(ing.id) ?? {
        ingredient_id: ing.id,
        name: `${ing.name} (${ing.outlet_id})`,
        quantity: 0,
        value: 0,
      };
      row.quantity += qty;
      row.value += qty * ing.unit_price;
      map.set(ing.id, row);
    }
    const rows = Array.from(map.values()).sort((a, b) => b.value - a.value);
    return {
      total_value: rows.reduce((s, r) => s + r.value, 0),
      by_ingredient: rows,
    };
  });
}
