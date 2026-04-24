/**
 * GET /api/reports/dashboard-kpis?outlet_id=&start=&end=
 * Lightweight KPI roll-up for the dashboard cards.
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

    const allTx = await db
      .select()
      .from(schema.transactions)
      .where(whereBase)
      .all();

    const paid = allTx.filter((t) => t.status === "paid");
    const voids = allTx.filter((t) => t.status === "void");

    const paidIds = paid.map((t) => t.id);
    const voidIds = voids.map((t) => t.id);

    const allItems = await db
      .select()
      .from(schema.transaction_items)
      .where(
        inArray(schema.transaction_items.transaction_id, [
          ...paidIds,
          ...voidIds,
        ]),
      )
      .all();

    const paidItems = allItems.filter((i) => paidIds.includes(i.transaction_id));
    const voidItems = allItems.filter((i) => voidIds.includes(i.transaction_id));

    const revenue = paid.reduce(
      (s, t) => s + t.subtotal - t.discount_total,
      0,
    );
    const hpp = paidItems.reduce(
      (s, i) => s + i.hpp_snapshot * i.quantity,
      0,
    );
    const voidLoss = voidItems.reduce(
      (s, i) => s + i.hpp_snapshot * i.quantity,
      0,
    );
    const itemCount = paidItems.reduce((s, i) => s + i.quantity, 0);

    return {
      revenue,
      profit: revenue - hpp,
      hpp,
      transaction_count: paid.length,
      item_count: itemCount,
      average_ticket: paid.length > 0 ? revenue / paid.length : 0,
      margin_percent: revenue > 0 ? ((revenue - hpp) / revenue) * 100 : 0,
      void_count: voids.length,
      void_loss: voidLoss,
    };
  });
}
