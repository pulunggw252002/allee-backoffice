import { requireSession } from "@/server/auth/session";
import { handle } from "@/server/api/helpers";
import { readReportParams } from "@/server/api/report-shared";
import { loadVoidTxs, txHpp } from "@/server/api/void-shared";

export async function GET(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    const params = readReportParams(session, req);
    const voids = await loadVoidTxs(params);
    const map = new Map<string, { reason: string; count: number; loss: number }>();
    for (const t of voids) {
      const reason = t.void_reason ?? "Tanpa alasan";
      const row = map.get(reason) ?? { reason, count: 0, loss: 0 };
      row.count += 1;
      row.loss += txHpp(t);
      map.set(reason, row);
    }
    return Array.from(map.values()).sort((a, b) => b.loss - a.loss);
  });
}
