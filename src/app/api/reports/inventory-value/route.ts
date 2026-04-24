/**
 * GET /api/reports/inventory-value
 * Per-outlet: sum(current_stock * unit_price) and active ingredient count.
 * Returns one row per outlet — owner sees all, kepala_toko just their own.
 */
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { requireSession } from "@/server/auth/session";
import { handle } from "@/server/api/helpers";

export async function GET() {
  return handle(async () => {
    const session = await requireSession();
    const outlets =
      session.domainUser.role === "owner"
        ? await db.select().from(schema.outlets).all()
        : await db
            .select()
            .from(schema.outlets)
            .where(
              session.domainUser.outlet_id
                ? eq(schema.outlets.id, session.domainUser.outlet_id)
                : eq(schema.outlets.id, "__none__"),
            )
            .all();

    const result = [];
    for (const o of outlets) {
      const items = await db
        .select()
        .from(schema.ingredients)
        .where(eq(schema.ingredients.outlet_id, o.id))
        .all();
      result.push({
        outlet_id: o.id,
        outlet_name: o.name,
        total_value: items.reduce(
          (s, i) => s + i.current_stock * i.unit_price,
          0,
        ),
        items_count: items.length,
      });
    }
    return result;
  });
}
