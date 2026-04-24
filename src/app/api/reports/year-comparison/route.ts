/**
 * GET /api/reports/year-comparison?outlet_id=&year=2025
 * Month-by-month net sales (paid − discount) for `year` vs `year - 1`.
 * Used by the side-by-side YoY bar chart on the dashboard.
 */
import { and, eq, gte, lte } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { requireSession, scopedOutletId } from "@/server/auth/session";
import { handle } from "@/server/api/helpers";

const MONTH_SHORT_ID = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

export async function GET(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    const url = new URL(req.url);
    const outletId = scopedOutletId(session, url.searchParams.get("outlet_id"));
    const currentYear = Number(
      url.searchParams.get("year") ?? new Date().getFullYear(),
    );
    const previousYear = currentYear - 1;

    async function monthNet(y: number, m: number): Promise<number> {
      const start = new Date(y, m - 1, 1, 0, 0, 0, 0).toISOString();
      const end = new Date(y, m, 0, 23, 59, 59, 999).toISOString();
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
      return rows.reduce((s, t) => s + t.subtotal - t.discount_total, 0);
    }

    const months: Array<{
      month: number;
      label: string;
      current: number;
      previous: number;
    }> = [];
    let totalCurrent = 0;
    let totalPrevious = 0;
    for (let m = 1; m <= 12; m++) {
      const current = await monthNet(currentYear, m);
      const previous = await monthNet(previousYear, m);
      totalCurrent += current;
      totalPrevious += previous;
      months.push({
        month: m,
        label: MONTH_SHORT_ID[m - 1],
        current,
        previous,
      });
    }
    const deltaPercent =
      totalPrevious > 0
        ? ((totalCurrent - totalPrevious) / totalPrevious) * 100
        : 0;
    return {
      current_year: currentYear,
      previous_year: previousYear,
      total_current: totalCurrent,
      total_previous: totalPrevious,
      delta_percent: deltaPercent,
      months,
    };
  });
}
