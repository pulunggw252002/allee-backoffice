/**
 * GET /api/reports/summary?outlet_id=&start=&end=
 * Aggregate sales figures for paid transactions only.
 *
 * `revenue` is gross (sum of item subtotals pre-discount). `profit` follows
 * `revenue − hpp − discount` — same semantics as the frontend mock.
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

    if (txs.length === 0) {
      return {
        revenue: 0,
        hpp: 0,
        profit: 0,
        discount: 0,
        ppn: 0,
        service_charge: 0,
        transaction_count: 0,
        item_count: 0,
        margin_percent: 0,
      };
    }

    const txIds = txs.map((t) => t.id);
    const allItems = await db
      .select()
      .from(schema.transaction_items)
      .where(inArray(schema.transaction_items.transaction_id, txIds))
      .all();

    const revenue = txs.reduce((s, t) => s + t.subtotal, 0);
    const hpp = allItems.reduce((s, i) => s + i.hpp_snapshot * i.quantity, 0);
    const discount = txs.reduce((s, t) => s + t.discount_total, 0);
    const ppn = txs.reduce((s, t) => s + t.ppn_amount, 0);
    const service_charge = txs.reduce(
      (s, t) => s + t.service_charge_amount,
      0,
    );
    const item_count = allItems.reduce((s, i) => s + i.quantity, 0);
    const profit = revenue - hpp - discount;

    return {
      revenue,
      hpp,
      profit,
      discount,
      ppn,
      service_charge,
      transaction_count: txs.length,
      item_count,
      margin_percent: revenue > 0 ? (profit / revenue) * 100 : 0,
    };
  });
}
