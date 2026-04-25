/**
 * GET /api/reports/hourly-net?outlet_id=&start=&end=
 *
 * Net sales bucketed by hour-of-day (0..23) untuk paid tx. Per-item void
 * aware: net_sales per tx = (Σ active_item.subtotal) − tx.discount_total.
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
    const whereBase = txWhereClauses(params);
    const wherePaid = whereBase
      ? and(whereBase, eq(schema.transactions.status, "paid"))
      : eq(schema.transactions.status, "paid");
    const txs = await db
      .select()
      .from(schema.transactions)
      .where(wherePaid)
      .all();

    const items =
      txs.length === 0
        ? []
        : await db
            .select()
            .from(schema.transaction_items)
            .where(
              inArray(
                schema.transaction_items.transaction_id,
                txs.map((t) => t.id),
              ),
            )
            .all();
    const activeSubByTx = new Map<string, number>();
    for (const i of items) {
      if (i.voided_at !== null) continue;
      activeSubByTx.set(
        i.transaction_id,
        (activeSubByTx.get(i.transaction_id) ?? 0) + i.subtotal,
      );
    }

    const buckets = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      net_sales: 0,
      transaction_count: 0,
    }));
    for (const t of txs) {
      const h = new Date(t.created_at).getHours();
      const sub = activeSubByTx.get(t.id) ?? 0;
      buckets[h].net_sales += sub > 0 ? sub - t.discount_total : 0;
      buckets[h].transaction_count += 1;
    }
    return buckets;
  });
}
