/**
 * GET /api/reports/hourly-net?outlet_id=&start=&end=
 * Net sales bucketed by hour-of-day (0..23) for paid tx.
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

    const buckets = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      net_sales: 0,
      transaction_count: 0,
    }));
    for (const t of rows) {
      const h = new Date(t.created_at).getHours();
      buckets[h].net_sales += t.subtotal - t.discount_total;
      buckets[h].transaction_count += 1;
    }
    return buckets;
  });
}
