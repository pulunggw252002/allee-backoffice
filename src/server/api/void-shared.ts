/**
 * Shared loader for void-report endpoints.
 *
 * Granularity: **per item** (satu menu di dalam struk), bukan per transaksi.
 * Kasir di POS bisa void satu menu tertentu (mis. salah racik latte) tanpa
 * harus void seluruh struk — sisa item tetap dihitung sebagai revenue. Laporan
 * Void mengagregasi `transaction_items` yang `voided_at` non-null, lengkap
 * dengan parent transaction context (outlet, created_at, dst).
 *
 * Backward-compat: existing tx-level voids (`transactions.status = "void"`)
 * sudah di-backfill ke `transaction_items.voided_at` oleh migrasi
 * `0002_tx_item_void.sql`, jadi loader ini cukup baca satu kolom.
 */
import { and, isNotNull, inArray } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import type { ReportParams } from "./report-shared";
import { txWhereClauses } from "./report-shared";

export interface VoidItemRow {
  /** Transaction-level identity (untuk drill-down ke struk asli). */
  transaction_id: string;
  outlet_id: string;
  /** User yang membuat transaksi (kasir di shift saat itu). */
  user_id: string;
  /** Waktu transaksi dibuat — dipakai sebagai timestamp di laporan. */
  created_at: string;

  /** Item-level. */
  item_id: string;
  menu_id: string | null;
  bundle_id: string | null;
  name_snapshot: string;
  quantity: number;
  unit_price: number;
  hpp_snapshot: number;
  subtotal: number;
  voided_at: string;
  voided_by: string | null;
  void_reason: string | null;
}

/**
 * Load semua item ter-void di window laporan (`outlet_id` + `start` + `end`).
 *
 * Filter window di-apply pada `transactions.created_at` (waktu transaksi
 * dibuat), bukan `voided_at` — supaya operator melihat void berdasar shift
 * mana transaksi itu terjadi, konsisten dengan laporan sales lain.
 */
export async function loadVoidItems(
  params: ReportParams,
): Promise<VoidItemRow[]> {
  const whereBase = txWhereClauses(params);
  const txs = await db
    .select()
    .from(schema.transactions)
    .where(whereBase)
    .all();
  if (txs.length === 0) return [];

  const items = await db
    .select()
    .from(schema.transaction_items)
    .where(
      and(
        inArray(
          schema.transaction_items.transaction_id,
          txs.map((t) => t.id),
        ),
        isNotNull(schema.transaction_items.voided_at),
      ),
    )
    .all();

  const txMap = new Map(txs.map((t) => [t.id, t]));
  return items
    .map((i) => {
      const tx = txMap.get(i.transaction_id);
      if (!tx || !i.voided_at) return null;
      return {
        transaction_id: tx.id,
        outlet_id: tx.outlet_id,
        user_id: tx.user_id,
        created_at: tx.created_at,
        item_id: i.id,
        menu_id: i.menu_id,
        bundle_id: i.bundle_id,
        name_snapshot: i.name_snapshot,
        quantity: i.quantity,
        unit_price: i.unit_price,
        hpp_snapshot: i.hpp_snapshot,
        subtotal: i.subtotal,
        voided_at: i.voided_at,
        voided_by: i.voided_by,
        void_reason: i.void_reason,
      } satisfies VoidItemRow;
    })
    .filter((r): r is VoidItemRow => r !== null);
}

/** HPP yang hilang dari satu void item (snapshot HPP × quantity). */
export function itemHpp(i: VoidItemRow): number {
  return i.hpp_snapshot * i.quantity;
}

/** Quantity item yang di-void (cup/porsi). */
export function itemUnits(i: VoidItemRow): number {
  return i.quantity;
}
