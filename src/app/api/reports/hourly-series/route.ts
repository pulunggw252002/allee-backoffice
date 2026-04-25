/**
 * GET /api/reports/hourly-series?outlet_id=&start=&end=
 *
 * Per-hour bucket: { hour, revenue, profit, net_sales, transaction_count }.
 * Dipakai oleh dashboard line chart saat operator pilih "Hari ini" — granular
 * per-jam supaya chart tidak jadi satu titik.
 *
 * Per-item void aware: item ber-`voided_at` di-exclude dari revenue/HPP.
 * Bucket selalu length-24 dengan nilai default 0 supaya sumbu X kontinu.
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
    const activeItems = items.filter((i) => i.voided_at === null);

    const subByTx = new Map<string, number>();
    const hppByTx = new Map<string, number>();
    for (const i of activeItems) {
      subByTx.set(
        i.transaction_id,
        (subByTx.get(i.transaction_id) ?? 0) + i.subtotal,
      );
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
      const sub = subByTx.get(t.id) ?? 0;
      const net = sub > 0 ? sub - t.discount_total : 0;
      const hpp = hppByTx.get(t.id) ?? 0;
      buckets[h].revenue += sub;
      buckets[h].profit += net - hpp;
      buckets[h].net_sales += net;
      buckets[h].transaction_count += 1;
    }
    return buckets;
  });
}
