/**
 * GET /api/reports/void-series — per-day count + HPP loss dari item ter-void.
 *
 * Bucket pakai `created_at` parent transaksi (tanggal struk dibuat) supaya
 * grafik selaras dengan laporan sales harian.
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
    const byDay = new Map<string, { date: string; count: number; loss: number }>();
    for (const i of items) {
      const date = i.created_at.slice(0, 10);
      const row = byDay.get(date) ?? { date, count: 0, loss: 0 };
      row.count += i.quantity;
      row.loss += itemHpp(i);
      byDay.set(date, row);
    }
    return Array.from(byDay.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );
  });
}
