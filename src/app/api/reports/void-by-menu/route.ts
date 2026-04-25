/**
 * GET /api/reports/void-by-menu — top menu yang paling sering di-void.
 *
 * Sekarang per-item: setiap row `transaction_items.voided_at !== null`
 * dihitung. Bundle (menu_id null) di-bucket di key `bundle:<bundle_id>`
 * supaya tidak collapse jadi satu group.
 */
import { requireSession } from "@/server/auth/session";
import { handle } from "@/server/api/helpers";
import { readReportParams } from "@/server/api/report-shared";
import { itemHpp, loadVoidItems } from "@/server/api/void-shared";

export async function GET(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    const params = readReportParams(session, req);
    const items = await loadVoidItems(params);
    const map = new Map<
      string,
      { menu_id: string; name: string; quantity: number; loss: number }
    >();
    for (const i of items) {
      const key =
        i.menu_id ?? (i.bundle_id ? `bundle:${i.bundle_id}` : i.name_snapshot);
      const row = map.get(key) ?? {
        menu_id: key,
        name: i.name_snapshot,
        quantity: 0,
        loss: 0,
      };
      row.quantity += i.quantity;
      row.loss += itemHpp(i);
      map.set(key, row);
    }
    return Array.from(map.values()).sort((a, b) => b.loss - a.loss);
  });
}
