/**
 * GET /api/reports/low-stock?outlet_id=
 * Ingredients at or below `min_qty` (status=low) or below 1.5× (status=warning).
 */
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { requireSession, scopedOutletId } from "@/server/auth/session";
import { handle } from "@/server/api/helpers";

const WARNING_MULTIPLIER = 1.5;

export async function GET(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    const url = new URL(req.url);
    const outletId = scopedOutletId(session, url.searchParams.get("outlet_id"));
    const q = db.select().from(schema.ingredients);
    const rows = outletId
      ? await q.where(eq(schema.ingredients.outlet_id, outletId)).all()
      : await q.all();
    return rows
      .filter((i) => i.current_stock <= i.min_qty * WARNING_MULTIPLIER)
      .map((i) => ({
        id: i.id,
        name: i.name,
        unit: i.unit,
        current_stock: i.current_stock,
        min_qty: i.min_qty,
        outlet_id: i.outlet_id,
        status: i.current_stock <= i.min_qty ? "low" : "warning",
      }))
      .sort((a, b) => a.current_stock / (a.min_qty || 1) - b.current_stock / (b.min_qty || 1));
  });
}
