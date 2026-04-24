/**
 * GET /api/reports/void-series — per-day void count + HPP loss
 */
import { requireSession } from "@/server/auth/session";
import { handle } from "@/server/api/helpers";
import { readReportParams } from "@/server/api/report-shared";
import { loadVoidTxs, txHpp } from "@/server/api/void-shared";

export async function GET(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    const params = readReportParams(session, req);
    const voids = await loadVoidTxs(params);
    const byDay = new Map<string, { date: string; count: number; loss: number }>();
    for (const t of voids) {
      const date = t.created_at.slice(0, 10);
      const row = byDay.get(date) ?? { date, count: 0, loss: 0 };
      row.count += 1;
      row.loss += txHpp(t);
      byDay.set(date, row);
    }
    return Array.from(byDay.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );
  });
}
