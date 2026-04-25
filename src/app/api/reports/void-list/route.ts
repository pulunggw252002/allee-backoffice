/**
 * GET /api/reports/void-list?outlet_id=&start=&end=&limit=50
 *
 * Riwayat void per item (granularitas yang sama dengan tombol void di POS).
 * Satu row di response = satu menu yang di-void; struk yang sama bisa muncul
 * beberapa kali kalau lebih dari satu item void.
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
      Number(url.searchParams.get("limit") ?? 50) || 50,
      200,
    );
    const items = await loadVoidItems(params);
    items.sort((a, b) => b.voided_at.localeCompare(a.voided_at));

    const outletIds = [...new Set(items.map((i) => i.outlet_id))];
    const userIds = [
      ...new Set(
        items
          .map((i) => i.voided_by ?? i.user_id)
          .filter((v): v is string => !!v),
      ),
    ];

    const [outlets, users] = await Promise.all([
      outletIds.length > 0
        ? db
            .select()
            .from(schema.outlets)
            .where(inArray(schema.outlets.id, outletIds))
            .all()
        : Promise.resolve([]),
      userIds.length > 0
        ? db
            .select()
            .from(schema.users)
            .where(inArray(schema.users.id, userIds))
            .all()
        : Promise.resolve([]),
    ]);
    const outletMap = new Map(outlets.map((o) => [o.id, o]));
    const userMap = new Map(users.map((u) => [u.id, u]));

    return items.slice(0, limit).map((i) => {
      const actorId = i.voided_by ?? i.user_id;
      const user = actorId ? userMap.get(actorId) : undefined;
      const label =
        i.quantity > 1 ? `${i.name_snapshot} × ${i.quantity}` : i.name_snapshot;
      return {
        // `id` di sini adalah item id (unik), bukan transaction id — supaya
        // tabel di frontend bisa pakai sebagai React key tanpa duplikasi.
        id: i.item_id,
        transaction_id: i.transaction_id,
        created_at: i.voided_at,
        outlet_id: i.outlet_id,
        outlet_name: outletMap.get(i.outlet_id)?.name ?? i.outlet_id,
        user_id: actorId ?? "",
        user_name: user?.name ?? "Staff tidak dikenal",
        reason: i.void_reason ?? "Tanpa alasan",
        items_label: label,
        item_count: i.quantity,
        loss: itemHpp(i),
      };
    });
  });
}
