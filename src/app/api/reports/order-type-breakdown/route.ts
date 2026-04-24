/**
 * GET /api/reports/order-type-breakdown?outlet_id=&start=&end=
 * Count + net sales per order_type (dine_in | takeaway | online) for paid tx.
 */
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { requireSession } from "@/server/auth/session";
import { handle } from "@/server/api/helpers";
import { readReportParams, txWhereClauses } from "@/server/api/report-shared";

export async function GET(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    const params = readReportParams(session, req);
    const whereBase = txWhereClauses(params);
    const wherePaid = whereBase
      ? and(whereBase, eq(schema.transactions.status, "paid"))
      : eq(schema.transactions.status, "paid");
    const rows = await db
      .select()
      .from(schema.transactions)
      .where(wherePaid)
      .all();

    const map = new Map<
      string,
      { type: string; count: number; amount: number }
    >();
    for (const t of rows) {
      const row = map.get(t.order_type) ?? {
        type: t.order_type,
        count: 0,
        amount: 0,
      };
      row.count += 1;
      row.amount += t.subtotal - t.discount_total;
      map.set(t.order_type, row);
    }
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
  });
}
