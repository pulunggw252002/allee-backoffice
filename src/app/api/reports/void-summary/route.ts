/**
 * GET /api/reports/void-summary?outlet_id=&start=&end=
 *
 * KPI ringkas untuk halaman Laporan Void:
 * - `count`         — jumlah item yang di-void (per-item, bukan per struk)
 * - `item_count`    — total porsi/cup (Σ quantity item void)
 * - `total_loss`    — Σ HPP item void (kerugian operasional)
 * - `paid_count`    — jumlah struk paid di window (untuk denominator rasio)
 * - `rate_percent`  — persen item void terhadap total item terjual
 */
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { requireSession } from "@/server/auth/session";
import { handle } from "@/server/api/helpers";
import { readReportParams, txWhereClauses } from "@/server/api/report-shared";
import { itemHpp, itemUnits, loadVoidItems } from "@/server/api/void-shared";

export async function GET(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    const params = readReportParams(session, req);

    const voidItems = await loadVoidItems(params);

    // Untuk rasio kita butuh total porsi terjual di window (paid items, baik
    // active maupun voided) — denominator yang masuk akal dari sisi operator
    // ("dari sekian banyak item terjual hari ini, sekian persen di-void").
    const whereBase = txWhereClauses(params);
    const wherePaid = whereBase
      ? and(whereBase, eq(schema.transactions.status, "paid"))
      : eq(schema.transactions.status, "paid");
    const paidTxs = await db
      .select()
      .from(schema.transactions)
      .where(wherePaid)
      .all();
    const paidItemRows =
      paidTxs.length === 0
        ? []
        : await db
            .select()
            .from(schema.transaction_items)
            .where(
              inArray(
                schema.transaction_items.transaction_id,
                paidTxs.map((t) => t.id),
              ),
            )
            .all();
    const paidItemCount = paidItemRows.reduce((s, i) => s + i.quantity, 0);

    const voidCount = voidItems.length;
    const voidItemCount = voidItems.reduce((s, i) => s + itemUnits(i), 0);
    const voidLoss = voidItems.reduce((s, i) => s + itemHpp(i), 0);

    return {
      count: voidCount,
      item_count: voidItemCount,
      total_loss: voidLoss,
      paid_count: paidTxs.length,
      paid_item_count: paidItemCount,
      rate_percent:
        paidItemCount > 0 ? (voidItemCount / paidItemCount) * 100 : 0,
    };
  });
}
