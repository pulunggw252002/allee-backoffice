/**
 * GET /api/reports/low-stock?outlet_id=
 *
 * Bahan dengan stok di atau di bawah `min_qty` (severity="critical") atau
 * di bawah 1.5× min_qty (severity="warning"). Bentuk response **harus** match
 * `LowStockItem` di `src/lib/api/reports.ts` — kalau field di-rename, panel
 * low-stock di dashboard tinggal render kosong tanpa error visible.
 *
 * Sort: critical dulu, lalu warning, lalu rasio current/min ascending
 * (paling kritis paling atas).
 */
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { requireSession, scopedOutletId } from "@/server/auth/session";
import { handle } from "@/server/api/helpers";

const WARNING_MULTIPLIER = 1.5;

export async function GET(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    const url = new URL(req.url);
    const outletId = scopedOutletId(session, url.searchParams.get("outlet_id"));

    const ingQ = db.select().from(schema.ingredients);
    const rows = outletId
      ? await ingQ.where(eq(schema.ingredients.outlet_id, outletId)).all()
      : await ingQ.all();

    // Lookup outlet name sekali (kecil tabelnya).
    const outlets = await db
      .select({ id: schema.outlets.id, name: schema.outlets.name })
      .from(schema.outlets)
      .all();
    const outletNameById = new Map(outlets.map((o) => [o.id, o.name]));

    type Severity = "critical" | "warning";
    interface LowStockItem {
      ingredient_id: string;
      name: string;
      outlet_id: string;
      outlet_name: string;
      current_stock: number;
      min_qty: number;
      unit: string;
      severity: Severity;
    }

    const items: LowStockItem[] = rows
      .filter((i) => i.current_stock <= i.min_qty * WARNING_MULTIPLIER)
      .map((i) => ({
        ingredient_id: i.id,
        name: i.name,
        outlet_id: i.outlet_id,
        outlet_name: outletNameById.get(i.outlet_id) ?? "",
        current_stock: i.current_stock,
        min_qty: i.min_qty,
        unit: i.unit,
        severity: (i.current_stock <= i.min_qty ? "critical" : "warning") as Severity,
      }));

    items.sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === "critical" ? -1 : 1;
      return (
        a.current_stock / (a.min_qty || 1) - b.current_stock / (b.min_qty || 1)
      );
    });
    return items;
  });
}
