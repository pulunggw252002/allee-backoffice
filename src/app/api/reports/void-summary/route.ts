/**
 * GET /api/reports/void-summary?outlet_id=&start=&end=
 */
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { requireSession } from "@/server/auth/session";
import { handle } from "@/server/api/helpers";
import { readReportParams, txWhereClauses } from "@/server/api/report-shared";
import { loadVoidTxs, txHpp, txUnits } from "@/server/api/void-shared";

export async function GET(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    const params = readReportParams(session, req);

    const voids = await loadVoidTxs(params);

    // For rate calc we need the total tx count in the same window.
    const whereBase = txWhereClauses(params);
    const whereFinalized = whereBase
      ? and(whereBase, /* finalized = paid or void */
          eq(schema.transactions.status, "paid"),
        )
      : eq(schema.transactions.status, "paid");
    const paidCount = (
      await db.select().from(schema.transactions).where(whereFinalized).all()
    ).length;

    const voidCount = voids.length;
    const voidItemCount = voids.reduce((s, t) => s + txUnits(t), 0);
    const voidLoss = voids.reduce((s, t) => s + txHpp(t), 0);
    const total = paidCount + voidCount;
    return {
      void_count: voidCount,
      void_item_count: voidItemCount,
      void_loss: voidLoss,
      paid_count: paidCount,
      total_finalized: total,
      void_rate_percent: total > 0 ? (voidCount / total) * 100 : 0,
    };
  });
}
