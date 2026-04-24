/**
 * Shared loader for void-report endpoints — returns all void transactions
 * in the window + their items. Keeping this in one place avoids duplicating
 * the two-table join logic in every /api/reports/void-* handler.
 */
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import type { ReportParams } from "./report-shared";
import { txWhereClauses } from "./report-shared";

export interface VoidTxRow {
  id: string;
  outlet_id: string;
  user_id: string;
  created_at: string;
  void_reason: string | null;
  voided_by: string | null;
  voided_at: string | null;
  items: Array<{
    menu_id: string | null;
    name_snapshot: string;
    quantity: number;
    hpp_snapshot: number;
  }>;
}

export async function loadVoidTxs(params: ReportParams): Promise<VoidTxRow[]> {
  const whereBase = txWhereClauses(params);
  const where = whereBase
    ? and(whereBase, eq(schema.transactions.status, "void"))
    : eq(schema.transactions.status, "void");
  const txs = await db.select().from(schema.transactions).where(where).all();
  if (txs.length === 0) return [];
  const items = await db
    .select()
    .from(schema.transaction_items)
    .where(
      inArray(
        schema.transaction_items.transaction_id,
        txs.map((t) => t.id),
      ),
    )
    .all();
  return txs.map((t) => ({
    id: t.id,
    outlet_id: t.outlet_id,
    user_id: t.user_id,
    created_at: t.created_at,
    void_reason: t.void_reason,
    voided_by: t.voided_by,
    voided_at: t.voided_at,
    items: items
      .filter((i) => i.transaction_id === t.id)
      .map((i) => ({
        menu_id: i.menu_id,
        name_snapshot: i.name_snapshot,
        quantity: i.quantity,
        hpp_snapshot: i.hpp_snapshot,
      })),
  }));
}

export function txHpp(t: VoidTxRow): number {
  return t.items.reduce((s, i) => s + i.hpp_snapshot * i.quantity, 0);
}

export function txUnits(t: VoidTxRow): number {
  return t.items.reduce((s, i) => s + i.quantity, 0);
}
