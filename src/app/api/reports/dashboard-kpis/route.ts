/**
 * GET /api/reports/dashboard-kpis?outlet_id=&start=&end=
 *
 * Lightweight KPI roll-up untuk kartu di Owner Dashboard. Bentuk response
 * **harus** match `DashboardKpis` di `src/lib/api/reports.ts` — kalau field
 * di-rename, dashboard tinggal baca `undefined` dan kartunya jadi Rp 0
 * tanpa error visible (silent contract drift).
 *
 * Semantik (mengikuti mock supaya hasil mock vs real backend identik):
 *  - `net_sales` = Σ paid tx of (active_item.subtotal − discount_total),
 *     clamp 0 saat seluruh item di-void supaya diskon tidak meninggalkan
 *     saldo negatif yang menyesatkan.
 *  - `avg_ticket` = net_sales / paid_count (0 kalau tidak ada paid).
 *  - `paid_count`     — status="paid"
 *  - `refund_count`   — status="refunded"
 *  - `canceled_count` — status="canceled"
 *  - `open_count`     — status="open"
 *  - `online_count`   — status="paid" AND order_type="online"
 *  - `void_count`     — jumlah UNIK struk (semua status) yang punya minimal
 *     satu item ter-void (per-item `voided_at` atau legacy tx-level `voided_at`).
 *  - `void_loss`      — Σ (hpp_snapshot × quantity) untuk semua item ter-void
 *     (cross-status). Ini adalah kerugian operasional: stok dipakai tanpa revenue.
 *
 * Catatan void semantics: seperti mock, void dihitung lintas status. Tx
 * status="canceled" yang punya item ter-void TETAP masuk void_count/void_loss
 * — stok-nya sudah terpakai. Sebaliknya, tx legacy dengan tx-level
 * `voided_at` juga seluruh item-nya dianggap void.
 */
import { inArray } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { requireSession } from "@/server/auth/session";
import { handle } from "@/server/api/helpers";
import { readReportParams, txWhereClauses } from "@/server/api/report-shared";

export async function GET(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    const params = readReportParams(session, req);
    const whereBase = txWhereClauses(params);

    // Tarik semua tx di window (bukan cuma paid) — kita butuh refund/cancel/
    // open count + void deteksi lintas status.
    const allTxs = whereBase
      ? await db.select().from(schema.transactions).where(whereBase).all()
      : await db.select().from(schema.transactions).all();

    if (allTxs.length === 0) {
      return {
        net_sales: 0,
        avg_ticket: 0,
        paid_count: 0,
        refund_count: 0,
        canceled_count: 0,
        open_count: 0,
        online_count: 0,
        void_count: 0,
        void_loss: 0,
      };
    }

    // Status counters in a single pass + bangun lookup tx-by-id.
    let paid_count = 0;
    let refund_count = 0;
    let canceled_count = 0;
    let open_count = 0;
    let online_count = 0;
    const paidTxs: typeof allTxs = [];
    const txById = new Map<string, (typeof allTxs)[number]>();
    for (const t of allTxs) {
      txById.set(t.id, t);
      switch (t.status) {
        case "paid":
          paid_count++;
          paidTxs.push(t);
          if (t.order_type === "online") online_count++;
          break;
        case "refunded":
          refund_count++;
          break;
        case "canceled":
          canceled_count++;
          break;
        case "open":
          open_count++;
          break;
      }
    }

    // Tarik items hanya untuk tx di window (bukan whole table).
    const txIds = allTxs.map((t) => t.id);
    const itemsForWindow = await db
      .select()
      .from(schema.transaction_items)
      .where(inArray(schema.transaction_items.transaction_id, txIds))
      .all();

    // === net_sales (paid only, per-item + legacy tx-level void aware) ===
    const activeSubByTx = new Map<string, number>();
    for (const i of itemsForWindow) {
      if (i.voided_at !== null) continue;
      const parent = txById.get(i.transaction_id);
      if (!parent || parent.status !== "paid") continue;
      if (parent.voided_at !== null) continue; // legacy tx-level void
      activeSubByTx.set(
        i.transaction_id,
        (activeSubByTx.get(i.transaction_id) ?? 0) + i.subtotal,
      );
    }
    const net_sales = paidTxs.reduce((s, t) => {
      const activeSub = activeSubByTx.get(t.id) ?? 0;
      // Diskon hanya di-apply kalau struk masih punya item aktif.
      // Kalau seluruh item void, net = 0 (jangan apply diskon negatif).
      return s + (activeSub > 0 ? activeSub - t.discount_total : 0);
    }, 0);

    // === void_count + void_loss (lintas semua status) ===
    let void_loss = 0;
    const voidedTxIds = new Set<string>();
    for (const i of itemsForWindow) {
      const parent = txById.get(i.transaction_id);
      if (!parent) continue;
      const isVoid = i.voided_at !== null || parent.voided_at !== null;
      if (!isVoid) continue;
      voidedTxIds.add(parent.id);
      void_loss += i.hpp_snapshot * i.quantity;
    }

    return {
      net_sales,
      avg_ticket: paid_count > 0 ? net_sales / paid_count : 0,
      paid_count,
      refund_count,
      canceled_count,
      open_count,
      online_count,
      void_count: voidedTxIds.size,
      void_loss,
    };
  });
}
