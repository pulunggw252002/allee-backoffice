/**
 * POST /api/internal/pos-shifts
 *
 * Internal endpoint dipanggil POS saat tutup shift untuk push summary
 * (revenue total, breakdown method, expected vs actual cash) ke backoffice.
 * Bukan source of truth transaksi — itu `/api/transactions`. Tabel ini
 * murni untuk laporan rekap kas / cash difference per shift.
 *
 * Auth:
 *   Header `Authorization: Bearer <POS_WEBHOOK_SECRET>` — sama mekanisme
 *   dengan endpoint internal lain. POS pakai env yang sama yang dia pakai
 *   untuk webhook receiver (round-trip secret).
 *
 * Idempotency:
 *   PK = `id` (POS-generated). Re-POST dengan id sama akan upsert (update
 *   field-field summary). Aman buat retry network atau reconciliation.
 *
 * GET (optional):
 *   Untuk laporan UI — di-gate dengan session backoffice biasa, bukan
 *   webhook secret. Filter outlet via session scope.
 */

import { and, desc, eq, gte, lte } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import { db, schema } from "@/server/db/client";
import { handle, HttpError, nowIso, readJson } from "@/server/api/helpers";

async function verifySecret(): Promise<void> {
  const secret = process.env.POS_WEBHOOK_SECRET;
  if (!secret) {
    throw new HttpError(
      503,
      "POS_WEBHOOK_SECRET belum di-set di backoffice — internal endpoint disabled.",
    );
  }
  const auth = (await headers()).get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    throw new HttpError(401, "Invalid webhook secret");
  }
}

const ShiftInput = z.object({
  /** PK — id shift di POS. Idempotency key. */
  id: z.string().min(1),
  outlet_id: z.string().min(1),
  cashier_user_id: z.string().min(1),
  cashier_name: z.string().min(1),
  opening_cash: z.number().nonnegative(),
  actual_cash: z.number().nonnegative(),
  expected_cash: z.number().nonnegative(),
  cash_difference: z.number(),
  total_revenue: z.number().nonnegative(),
  order_count: z.number().int().nonnegative(),
  /**
   * Breakdown per payment method. Keys bebas, tapi POS biasanya kirim
   * { cash, qris, card, transfer }. Kalau kosong → store sebagai {}.
   */
  breakdown: z.record(z.string(), z.number().nonnegative()).default({}),
  note: z.string().nullable().optional(),
  opened_at: z.string().min(1),
  closed_at: z.string().min(1),
});

export async function POST(req: Request) {
  return handle(async () => {
    await verifySecret();
    const input = await readJson(req, ShiftInput);

    // Outlet validity check — supaya FK error tidak return 500 cryptic.
    const outlet = await db
      .select({ id: schema.outlets.id })
      .from(schema.outlets)
      .where(eq(schema.outlets.id, input.outlet_id))
      .get();
    if (!outlet) {
      throw new HttpError(400, `Outlet ${input.outlet_id} tidak ditemukan`);
    }

    const syncedAt = nowIso();

    // SQLite UPSERT via Drizzle ON CONFLICT — POS retry tidak akan double.
    await db
      .insert(schema.pos_shifts)
      .values({
        id: input.id,
        outlet_id: input.outlet_id,
        cashier_user_id: input.cashier_user_id,
        cashier_name: input.cashier_name,
        opening_cash: input.opening_cash,
        actual_cash: input.actual_cash,
        expected_cash: input.expected_cash,
        cash_difference: input.cash_difference,
        total_revenue: input.total_revenue,
        order_count: input.order_count,
        breakdown: input.breakdown,
        note: input.note ?? null,
        opened_at: input.opened_at,
        closed_at: input.closed_at,
        synced_at: syncedAt,
      })
      .onConflictDoUpdate({
        target: schema.pos_shifts.id,
        set: {
          actual_cash: input.actual_cash,
          expected_cash: input.expected_cash,
          cash_difference: input.cash_difference,
          total_revenue: input.total_revenue,
          order_count: input.order_count,
          breakdown: input.breakdown,
          note: input.note ?? null,
          closed_at: input.closed_at,
          synced_at: syncedAt,
        },
      });

    return { ok: true, id: input.id, synced_at: syncedAt };
  });
}

/**
 * GET dipakai laporan UI — backoffice owner/kepala_toko bisa lihat
 * rekap shift kasir per periode. Auth via session backoffice (bukan secret).
 *
 * Query: `?outlet_id=&start=&end=`
 */
export async function GET(req: Request) {
  return handle(async () => {
    // Sengaja import dynamic supaya endpoint POST (yang dipanggil dari
    // POS server) tidak depend on auth session module.
    const { requireSession, scopedOutletId } = await import(
      "@/server/auth/session"
    );
    const session = await requireSession();
    const url = new URL(req.url);
    const outletId = scopedOutletId(session, url.searchParams.get("outlet_id"));
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");

    const filters = [];
    if (outletId) filters.push(eq(schema.pos_shifts.outlet_id, outletId));
    if (start) filters.push(gte(schema.pos_shifts.closed_at, start));
    if (end) filters.push(lte(schema.pos_shifts.closed_at, end));

    const rows = await db
      .select()
      .from(schema.pos_shifts)
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(desc(schema.pos_shifts.closed_at))
      .limit(500)
      .all();

    return rows;
  });
}
