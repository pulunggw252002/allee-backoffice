/**
 * GET /api/reports/hourly-series?outlet_id=&start=&end=
 *
 * Like `/api/reports/hourly-net` but emits the same shape the dashboard
 * line chart needs: { hour, revenue, profit, net_sales, transaction_count }.
 * Used by the Sales report chart when the operator picks "Hari ini" — we
 * switch from per-day to per-hour granularity so the chart isn't a single
 * dot.
 *
 * Buckets are always length-24 with zero defaults so the X-axis is
 * continuous even for sparse hours.
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

    // Pre-bucket HPP per transaction so we don't do an O(n*m) lookup later.
    const hppByTx = new Map<string, number>();
    for (const i of items) {
      hppByTx.set(
        i.transaction_id,
        (hppByTx.get(i.transaction_id) ?? 0) + i.hpp_snapshot * i.quantity,
      );
    }

    const buckets = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      revenue: 0,
      profit: 0,
      net_sales: 0,
      transaction_count: 0,
    }));
    for (const t of txs) {
      const h = new Date(t.created_at).getHours();
      const net = t.subtotal - t.discount_total;
      const hpp = hppByTx.get(t.id) ?? 0;
      buckets[h].revenue += t.subtotal;
      buckets[h].profit += t.subtotal - hpp - t.discount_total;
      buckets[h].net_sales += net;
      buckets[h].transaction_count += 1;
    }
    return buckets;
  });
}
