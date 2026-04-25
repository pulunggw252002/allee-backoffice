/**
 * GET /api/reports/monthly-target?outlet_id=&year=2025
 * Per-bulan (1..12) di tahun yang diminta:
 *   - target_amount dari `sales_targets` (0 kalau belum di-set)
 *   - actual = Σ net per tx dari paid transactions (per-item void aware)
 */
import { and, eq, gte, lte } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { requireSession, scopedOutletId } from "@/server/auth/session";
import { handle } from "@/server/api/helpers";
import { loadNetByTx } from "@/server/api/report-shared";

export async function GET(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    const url = new URL(req.url);
    const outletId = scopedOutletId(session, url.searchParams.get("outlet_id"));
    const year = Number(
      url.searchParams.get("year") ?? new Date().getFullYear(),
    );

    const targets = await db
      .select()
      .from(schema.sales_targets)
      .where(eq(schema.sales_targets.year, year))
      .all();
    const targetMap = new Map(targets.map((t) => [t.month, t.target_amount]));

    const result: Array<{ month: number; target: number; actual: number }> = [];
    for (let m = 1; m <= 12; m++) {
      const start = new Date(year, m - 1, 1, 0, 0, 0, 0).toISOString();
      const end = new Date(year, m, 0, 23, 59, 59, 999).toISOString();
      const conds = [
        eq(schema.transactions.status, "paid" as const),
        gte(schema.transactions.created_at, start),
        lte(schema.transactions.created_at, end),
      ];
      if (outletId) conds.push(eq(schema.transactions.outlet_id, outletId));
      const rows = await db
        .select()
        .from(schema.transactions)
        .where(and(...conds))
        .all();
      const netMap = await loadNetByTx(rows);
      const actual = rows.reduce((s, t) => s + (netMap.get(t.id) ?? 0), 0);
      result.push({ month: m, target: targetMap.get(m) ?? 0, actual });
    }
    return result;
  });
}
