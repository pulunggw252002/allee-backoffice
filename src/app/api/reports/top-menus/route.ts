/**
 * GET /api/reports/top-menus?outlet_id=&start=&end=&limit=5&order=desc|asc
 *
 * Menu di-rank berdasar quantity terjual. `order=asc` mengembalikan
 * bottom-N (paling sedikit terjual). Per-item void aware: item dengan
 * `voided_at !== null` di-exclude — yang dilaporkan adalah item yang
 * benar-benar sampai ke pelanggan & menghasilkan revenue.
 */
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { requireSession } from "@/server/auth/session";
import { handle } from "@/server/api/helpers";
import { readReportParams, txWhereClauses } from "@/server/api/report-shared";

export async function GET(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    const params = readReportParams(session, req);
    const url = new URL(req.url);
    const limit = Math.min(
      Number(url.searchParams.get("limit") ?? 5) || 5,
      50,
    );
    const order = url.searchParams.get("order") === "asc" ? "asc" : "desc";

    const whereBase = txWhereClauses(params);
    const wherePaid = whereBase
      ? and(whereBase, eq(schema.transactions.status, "paid"))
      : eq(schema.transactions.status, "paid");
    const txs = await db
      .select()
      .from(schema.transactions)
      .where(wherePaid)
      .all();
    if (txs.length === 0) return [];

    const items = await db
      .select()
      .from(schema.transaction_items)
      .where(
        inArray(
          schema.transaction_items.transaction_id,
          txs.map((t) => t.id),
        ),
      )
      .all();

    const map = new Map<
      string,
      { menu_id: string; name: string; quantity: number; revenue: number }
    >();
    for (const i of items) {
      if (!i.menu_id) continue;
      if (i.voided_at !== null) continue;
      const row = map.get(i.menu_id) ?? {
        menu_id: i.menu_id,
        name: i.name_snapshot,
        quantity: 0,
        revenue: 0,
      };
      row.quantity += i.quantity;
      row.revenue += i.subtotal;
      map.set(i.menu_id, row);
    }
    return Array.from(map.values())
      .sort((a, b) =>
        order === "asc" ? a.quantity - b.quantity : b.quantity - a.quantity,
      )
      .slice(0, limit);
  });
}
