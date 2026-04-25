/**
 * GET /api/internal/pos-pins
 *
 * Internal endpoint dipanggil oleh POS saat sync untuk pull PIN hash setiap
 * staff. PIN hash adalah secret yang dipakai POS local DB untuk men-verify
 * PIN login (Better Auth scrypt). Endpoint terpisah dari `/api/users` supaya:
 *  - `/api/users` publik (UI backoffice) tetap bersih dari hash.
 *  - Endpoint ini di-gate dengan shared secret server-to-server (bukan session),
 *    bisa dipanggil POS dari serverless tanpa cookie.
 *
 * Auth:
 *   Header `Authorization: Bearer <POS_WEBHOOK_SECRET>` — shared dengan webhook
 *   secret POS. Tanpa header cocok → 401.
 *
 * Query:
 *   `?outlet_id=out_dago` — filter ke users di outlet tertentu (POS hanya butuh
 *   PIN untuk staffnya sendiri). Kalau tidak di-set → return semua user yang
 *   punya PIN (Owner-level export, untuk debug/migration).
 *
 * Response: `[{ user_id, name, role, outlet_id, pos_pin_hash }]`
 *   - Hanya user dengan `pos_pin_hash != null` di-include.
 *   - Hash format mengikuti Better Auth scrypt — POS pakai langsung tanpa
 *     re-hash (bug-prone) → simpan ke `account.password`.
 */

import { eq, and, isNotNull } from "drizzle-orm";
import { headers } from "next/headers";
import { db, schema } from "@/server/db/client";
import { handle, HttpError } from "@/server/api/helpers";

interface PosPinRow {
  user_id: string;
  name: string;
  role: string;
  outlet_id: string | null;
  pos_pin_hash: string;
}

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

export async function GET(req: Request) {
  return handle(async () => {
    await verifySecret();
    const url = new URL(req.url);
    const outletId = url.searchParams.get("outlet_id");

    const where = outletId
      ? and(
          eq(schema.users.outlet_id, outletId),
          isNotNull(schema.users.pos_pin_hash),
        )
      : isNotNull(schema.users.pos_pin_hash);

    const rows = await db
      .select({
        user_id: schema.users.id,
        name: schema.users.name,
        role: schema.users.role,
        outlet_id: schema.users.outlet_id,
        pos_pin_hash: schema.users.pos_pin_hash,
        is_active: schema.users.is_active,
      })
      .from(schema.users)
      .where(where)
      .all();

    const result: PosPinRow[] = rows
      .filter((r) => r.is_active && r.pos_pin_hash) // double guard
      .map((r) => ({
        user_id: r.user_id,
        name: r.name,
        role: r.role,
        outlet_id: r.outlet_id,
        pos_pin_hash: r.pos_pin_hash as string,
      }));

    return result;
  });
}
