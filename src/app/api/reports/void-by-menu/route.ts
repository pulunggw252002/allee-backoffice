import { requireSession } from "@/server/auth/session";
import { handle } from "@/server/api/helpers";
import { readReportParams } from "@/server/api/report-shared";
import { loadVoidTxs } from "@/server/api/void-shared";

export async function GET(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    const params = readReportParams(session, req);
    const voids = await loadVoidTxs(params);
    const map = new Map<
      string,
      { menu_id: string; name: string; quantity: number; loss: number }
    >();
    for (const t of voids) {
      for (const i of t.items) {
        const key = i.menu_id ?? i.name_snapshot;
        const row = map.get(key) ?? {
          menu_id: key,
          name: i.name_snapshot,
          quantity: 0,
          loss: 0,
        };
        row.quantity += i.quantity;
        row.loss += i.hpp_snapshot * i.quantity;
        map.set(key, row);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.loss - a.loss);
  });
}
