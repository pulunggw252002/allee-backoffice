/**
 * GET /api/reports/void-by-staff — staff dengan jumlah item void terbanyak.
 *
 * Atribusi: pakai `voided_by` (siapa yang menekan tombol void di POS).
 * Kalau null (data lama / migrasi tx-level), fallback ke `tx.user_id`
 * (kasir yang membuat transaksi). `count` di sini adalah jumlah ITEM yang
 * di-void, bukan jumlah struk — sesuai semantik per-item baru.
 */
import { inArray } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { requireSession } from "@/server/auth/session";
import { handle } from "@/server/api/helpers";
import { readReportParams } from "@/server/api/report-shared";
import { itemHpp, loadVoidItems } from "@/server/api/void-shared";

export async function GET(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    const params = readReportParams(session, req);
    const url = new URL(req.url);
    const limit = Math.min(
      Number(url.searchParams.get("limit") ?? 10) || 10,
      100,
    );
    const items = await loadVoidItems(params);
    const map = new Map<
      string,
      { user_id: string; user_name: string; count: number; loss: number }
    >();
    for (const i of items) {
      const actorId = i.voided_by ?? i.user_id;
      if (!actorId) continue;
      const row = map.get(actorId) ?? {
        user_id: actorId,
        user_name: actorId,
        count: 0,
        loss: 0,
      };
      row.count += i.quantity;
      row.loss += itemHpp(i);
      map.set(actorId, row);
    }
    // Hydrate staff names in a single query.
    const userIds = Array.from(map.keys());
    if (userIds.length > 0) {
      const users = await db
        .select()
        .from(schema.users)
        .where(inArray(schema.users.id, userIds))
        .all();
      for (const u of users) {
        const row = map.get(u.id);
        if (row) row.user_name = u.name;
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.loss - a.loss)
      .slice(0, limit);
  });
}
