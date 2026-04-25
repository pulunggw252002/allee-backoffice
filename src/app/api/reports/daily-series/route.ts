/**
 * GET /api/reports/daily-series?outlet_id=&start=&end=
 * One point per day: { date, revenue, net_sales, hpp, profit, count }.
 *
 * `revenue` dan `net_sales` sengaja punya nilai sama (already net of discount)
 * supaya cocok dengan kontrak `DailySeriesPoint` di `src/lib/api/reports.ts`
 * (yang dipakai dashboard). Field `revenue` legacy dibiarkan supaya konsumer
 * lama tidak break.
 *
 * Per-item void aware: item dengan `voided_at !== null` di-skip dari revenue
 * & HPP. Revenue per tx = (Σ active_item.subtotal) − tx.discount_total
 * (kalau masih ada item aktif; kalau seluruh struk void, revenue tx = 0).
 */
import { eq, and, inArray } from "drizzle-orm";
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

    // Pre-bucket subtotal & hpp per tx dari item aktif.
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

    const byDay = new Map<
      string,
      {
        date: string;
        revenue: number;
        net_sales: number;
        hpp: number;
        profit: number;
        count: number;
      }
    >();
    for (const t of txs) {
      const date = t.created_at.slice(0, 10);
      const row = byDay.get(date) ?? {
        date,
        revenue: 0,
        net_sales: 0,
        hpp: 0,
        profit: 0,
        count: 0,
      };
      const sub = subByTx.get(t.id) ?? 0;
      const net = sub > 0 ? sub - t.discount_total : 0;
      row.revenue += net;
      row.net_sales += net;
      row.hpp += hppByTx.get(t.id) ?? 0;
      row.count += 1;
      byDay.set(date, row);
    }
    for (const row of byDay.values()) row.profit = row.revenue - row.hpp;

    return Array.from(byDay.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );
  });
}
