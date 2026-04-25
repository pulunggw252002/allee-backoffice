/**
 * GET /api/reports/void-by-reason — agregasi alasan free-form yang ditulis
 * kasir di POS. Setiap row di sini adalah satu item void (bukan struk).
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
    const map = new Map<string, { reason: string; count: number; loss: number }>();
    for (const i of items) {
      const reason = i.void_reason ?? "Tanpa alasan";
      const row = map.get(reason) ?? { reason, count: 0, loss: 0 };
      row.count += i.quantity;
      row.loss += itemHpp(i);
      map.set(reason, row);
    }
    return Array.from(map.values()).sort((a, b) => b.loss - a.loss);
  });
}
