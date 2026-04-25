/**
 * Shared filter parsing + scoping for all `/api/reports/*` endpoints.
 *
 * Every report takes `outlet_id`, `start`, `end` in the query string.
 * `outlet_id` is clamped by `scopedOutletId()` so kepala_toko can't read
 * other outlets' data.
 */
import { and, eq, gte, inArray, lte, type SQL } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import type { ServerSession } from "@/server/auth/session";
import { scopedOutletId } from "@/server/auth/session";
import { badRequest } from "./helpers";

export interface ReportParams {
  outlet_id: string | null;
  start: string | null;
  end: string | null;
}

/**
 * Validates a report date param. Accepts `YYYY-MM-DD` or full ISO-8601
 * (`YYYY-MM-DDTHH:mm:ss.sssZ`) — both formats are used across reports and
 * compare correctly against SQLite TEXT columns storing ISO timestamps.
 * Returns `null` when the param is absent; throws 400 when it's malformed.
 */
function parseDateParam(value: string | null, field: string): string | null {
  if (value === null || value === "") return null;
  const iso = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?Z?)?$/;
  if (!iso.test(value)) {
    badRequest(`Parameter "${field}" harus format YYYY-MM-DD atau ISO-8601`);
  }
  // Parseability gate — "2026-13-45" matches the regex but Date rejects it.
  if (Number.isNaN(new Date(value).getTime())) {
    badRequest(`Parameter "${field}" bukan tanggal valid`);
  }
  return value;
}

export function readReportParams(
  session: ServerSession,
  req: Request,
): ReportParams {
  const url = new URL(req.url);
  return {
    outlet_id: scopedOutletId(session, url.searchParams.get("outlet_id")),
    start: parseDateParam(url.searchParams.get("start"), "start"),
    end: parseDateParam(url.searchParams.get("end"), "end"),
  };
}

export function txWhereClauses(params: ReportParams): SQL | undefined {
  const arr: SQL[] = [];
  if (params.outlet_id)
    arr.push(eq(schema.transactions.outlet_id, params.outlet_id));
  if (params.start) arr.push(gte(schema.transactions.created_at, params.start));
  if (params.end) arr.push(lte(schema.transactions.created_at, params.end));
  return arr.length === 0 ? undefined : and(...arr);
}

/**
 * Hitung "net revenue" per tx dengan menghormati per-item void.
 *
 * Untuk setiap tx di `txIds`, ambil semua `transaction_items`-nya, jumlahkan
 * subtotal item yang **belum** di-void, lalu kurangi `discount_total` tx itu
 * (kalau masih ada item aktif). Kalau seluruh struk void, net = 0 (tidak
 * boleh negatif via diskon yang masih ter-apply).
 *
 * Return: `Map<txId, netAmount>`. Tx tanpa item aktif tetap masuk map dengan
 * nilai 0 supaya caller tahu tx itu sudah dilihat (tidak bingung "kemana
 * struknya").
 *
 * Pakai helper ini di report yang cuma mau "net per tx" tanpa peduli HPP —
 * mis. payment-breakdown, order-type-breakdown, weekly-net, monthly-target,
 * year-comparison. Report yang juga butuh HPP (summary, daily-series, dst)
 * tetap pakai pola load items + reduce sendiri supaya menghemat satu pass.
 */
export async function loadNetByTx(
  txs: Array<{ id: string; discount_total: number }>,
): Promise<Map<string, number>> {
  if (txs.length === 0) return new Map();
  const items = await db
    .select({
      transaction_id: schema.transaction_items.transaction_id,
      subtotal: schema.transaction_items.subtotal,
      voided_at: schema.transaction_items.voided_at,
    })
    .from(schema.transaction_items)
    .where(
      inArray(
        schema.transaction_items.transaction_id,
        txs.map((t) => t.id),
      ),
    )
    .all();
  const activeSub = new Map<string, number>();
  for (const i of items) {
    if (i.voided_at !== null) continue;
    activeSub.set(
      i.transaction_id,
      (activeSub.get(i.transaction_id) ?? 0) + i.subtotal,
    );
  }
  const out = new Map<string, number>();
  for (const t of txs) {
    const sub = activeSub.get(t.id) ?? 0;
    out.set(t.id, sub > 0 ? sub - t.discount_total : 0);
  }
  return out;
}
