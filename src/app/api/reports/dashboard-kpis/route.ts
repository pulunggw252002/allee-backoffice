/**
 * GET /api/reports/dashboard-kpis?outlet_id=&start=&end=
 * Lightweight KPI roll-up for the dashboard cards.
 *
 * Void semantics: per-item. Sebuah `transaction_items` dengan
 * `voided_at IS NOT NULL` di-exclude dari revenue/HPP (tidak menghasilkan
 * uang) tapi item-nya tetap masuk `void_loss` (HPP terpakai = kerugian).
 *
 * Revenue per struk dihitung ulang dari item aktif:
 *   tx_revenue = (Σ active_item.subtotal) − tx.discount_total
 * Pendekatan ini sengaja tidak mengalokasikan diskon/PPN secara proporsional
 * ke item yang di-void — diskon penuh tetap di-attribute ke struk itu (tidak
 * direfund parsial), konsisten dengan praktik kasir umum.
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

    const paid = await db
      .select()
      .from(schema.transactions)
      .where(wherePaid)
      .all();
    if (paid.length === 0) {
      return {
        revenue: 0,
        profit: 0,
        hpp: 0,
        transaction_count: 0,
        item_count: 0,
        average_ticket: 0,
        margin_percent: 0,
        void_count: 0,
        void_loss: 0,
      };
    }

    const txIds = paid.map((t) => t.id);
    const allItems = await db
      .select()
      .from(schema.transaction_items)
      .where(inArray(schema.transaction_items.transaction_id, txIds))
      .all();

    const activeItems = allItems.filter((i) => i.voided_at === null);
    const voidedItems = allItems.filter((i) => i.voided_at !== null);

    // Subtotal aktif per tx → kurangi discount_total tx untuk revenue net.
    const activeSubByTx = new Map<string, number>();
    for (const i of activeItems) {
      activeSubByTx.set(
        i.transaction_id,
        (activeSubByTx.get(i.transaction_id) ?? 0) + i.subtotal,
      );
    }
    const revenue = paid.reduce((s, t) => {
      const activeSub = activeSubByTx.get(t.id) ?? 0;
      // Diskon hanya di-apply kalau struk masih punya item aktif.
      // Kalau seluruh item void, revenue tx = 0 (jangan apply diskon negatif).
      return s + (activeSub > 0 ? activeSub - t.discount_total : 0);
    }, 0);

    const hpp = activeItems.reduce(
      (s, i) => s + i.hpp_snapshot * i.quantity,
      0,
    );
    const voidLoss = voidedItems.reduce(
      (s, i) => s + i.hpp_snapshot * i.quantity,
      0,
    );
    const itemCount = activeItems.reduce((s, i) => s + i.quantity, 0);

    return {
      revenue,
      profit: revenue - hpp,
      hpp,
      transaction_count: paid.length,
      item_count: itemCount,
      average_ticket: paid.length > 0 ? revenue / paid.length : 0,
      margin_percent: revenue > 0 ? ((revenue - hpp) / revenue) * 100 : 0,
      void_count: voidedItems.length,
      void_loss: voidLoss,
    };
  });
}

