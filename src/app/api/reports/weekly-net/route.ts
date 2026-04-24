/**
 * GET /api/reports/weekly-net?outlet_id=&start=&end=
 * Net sales bucketed by Monday-first weekday (0=Mon..6=Sun) for paid tx.
 */
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { requireSession } from "@/server/auth/session";
import { handle } from "@/server/api/helpers";
import { readReportParams, txWhereClauses } from "@/server/api/report-shared";

const WEEKDAY_LABELS_ID = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

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

    const buckets = WEEKDAY_LABELS_ID.map((label, i) => ({
      weekday: i,
      label,
      net_sales: 0,
      transaction_count: 0,
    }));
    for (const t of rows) {
      const d = new Date(t.created_at);
      const idx = (d.getDay() + 6) % 7; // Sun=0 → 6, Mon=1 → 0
      buckets[idx].net_sales += t.subtotal - t.discount_total;
      buckets[idx].transaction_count += 1;
    }
    return buckets;
  });
}
