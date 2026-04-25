import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db/client";
import { requireRole, requireSession } from "@/server/auth/session";
import { badRequest, genId, handle, nowIso, readJson } from "@/server/api/helpers";
import { logAudit } from "@/server/api/audit";

export async function GET() {
  return handle(async () => {
    await requireSession();
    return db.select().from(schema.sales_targets).all();
  });
}

const Input = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  target_amount: z.number().nonnegative(),
});

export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    requireRole(session, ["owner"]);
    const input = await readJson(req, Input);
    // Domain rule: 1 target per (year, month). Tanpa cek ini, owner bisa
    // create dua target untuk Apr 2026 dan kedua row akan dipakai oleh
    // chart Target-vs-Actual sehingga angka jadi double-count. Schema belum
    // punya UNIQUE constraint (perlu migration), jadi enforce di app-layer
    // dulu. TODO: tambah composite unique (year, month) di schema.
    const dup = await db
      .select({ id: schema.sales_targets.id })
      .from(schema.sales_targets)
      .where(
        and(
          eq(schema.sales_targets.year, input.year),
          eq(schema.sales_targets.month, input.month),
        ),
      )
      .get();
    if (dup) {
      badRequest(
        `Target untuk ${input.year}-${String(input.month).padStart(2, "0")} sudah ada — edit saja yang lama.`,
      );
    }
    const row = { id: genId("tgt"), ...input, updated_at: nowIso() };
    await db.insert(schema.sales_targets).values(row);
    await logAudit(session, {
      action: "create",
      entity: "sales_target",
      entity_id: row.id,
      entity_name: `${input.year}-${String(input.month).padStart(2, "0")}`,
    });
    return row;
  });
}
