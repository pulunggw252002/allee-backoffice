/**
 * GET /api/reports/daily-series?outlet_id=&start=&end=
 * One point per day in the window: { date, revenue, hpp, profit, count }.
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

    const byDay = new Map<
      string,
      { date: string; revenue: number; hpp: number; profit: number; count: number }
    >();
    for (const t of txs) {
      const date = t.created_at.slice(0, 10);
      const row = byDay.get(date) ?? {
        date,
        revenue: 0,
        hpp: 0,
        profit: 0,
        count: 0,
      };
      row.revenue += t.subtotal - t.discount_total;
      row.count += 1;
      byDay.set(date, row);
    }
    for (const i of items) {
      const tx = txs.find((t) => t.id === i.transaction_id);
      if (!tx) continue;
      const row = byDay.get(tx.created_at.slice(0, 10));
      if (row) row.hpp += i.hpp_snapshot * i.quantity;
    }
    for (const row of byDay.values()) row.profit = row.revenue - row.hpp;

    return Array.from(byDay.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );
  });
}
