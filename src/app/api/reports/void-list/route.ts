/**
 * GET /api/reports/void-list?outlet_id=&start=&end=&limit=50
 * Paginated history for the void page + dashboard recent-voids strip.
 */
import { inArray } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { requireSession } from "@/server/auth/session";
import { handle } from "@/server/api/helpers";
import { readReportParams } from "@/server/api/report-shared";
import { loadVoidTxs, txHpp, txUnits } from "@/server/api/void-shared";

export async function GET(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    const params = readReportParams(session, req);
    const url = new URL(req.url);
    const limit = Math.min(
      Number(url.searchParams.get("limit") ?? 50) || 50,
      200,
    );
    const voids = await loadVoidTxs(params);
    voids.sort((a, b) => b.created_at.localeCompare(a.created_at));

    const outletIds = [...new Set(voids.map((t) => t.outlet_id))];
    const userIds = [
      ...new Set(voids.map((t) => t.voided_by ?? t.user_id).filter((v): v is string => !!v)),
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

    return voids.slice(0, limit).map((t) => {
      const actorId = t.voided_by ?? t.user_id;
      const user = actorId ? userMap.get(actorId) : undefined;
      const names = t.items.map(
        (i) => `${i.name_snapshot}${i.quantity > 1 ? ` × ${i.quantity}` : ""}`,
      );
      return {
        id: t.id,
        created_at: t.created_at,
        outlet_id: t.outlet_id,
        outlet_name: outletMap.get(t.outlet_id)?.name ?? t.outlet_id,
        user_id: actorId ?? "",
        user_name: user?.name ?? "Staff tidak dikenal",
        reason: t.void_reason ?? "Tanpa alasan",
        items_label: names.join(", "),
        item_count: txUnits(t),
        loss: txHpp(t),
      };
    });
  });
}
