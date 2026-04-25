/**
 * GET /api/reports/payment-breakdown?outlet_id=&start=&end=
 * Count + net sales per payment method untuk paid tx (per-item void aware).
 */
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { requireSession } from "@/server/auth/session";
import { handle } from "@/server/api/helpers";
import {
  loadNetByTx,
  readReportParams,
  txWhereClauses,
} from "@/server/api/report-shared";

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
    const netMap = await loadNetByTx(rows);

    const map = new Map<
      string,
      { method: string; count: number; amount: number }
    >();
    for (const t of rows) {
      const row = map.get(t.payment_method) ?? {
        method: t.payment_method,
        count: 0,
        amount: 0,
      };
      row.count += 1;
      row.amount += netMap.get(t.id) ?? 0;
      map.set(t.payment_method, row);
    }
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
  });
}
