import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db/client";
import { requireRole, requireSession } from "@/server/auth/session";
import { badRequest, handle, notFound, nowIso, readJson } from "@/server/api/helpers";
import { diffChanges, logAudit } from "@/server/api/audit";

type Ctx = { params: Promise<{ id: string }> };

const Update = z
  .object({
    year: z.number().int(),
    month: z.number().int().min(1).max(12),
    target_amount: z.number().nonnegative(),
  })
  .partial();

export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    requireRole(session, ["owner"]);
    const { id } = await params;
    const before = await db
      .select()
      .from(schema.sales_targets)
      .where(eq(schema.sales_targets.id, id))
      .get();
    if (!before) notFound("Sales target");
    const input = await readJson(req, Update);
    // Kalau user ubah (year, month), pastikan tidak collide dengan row lain.
    const targetYear = input.year ?? before.year;
    const targetMonth = input.month ?? before.month;
    if (targetYear !== before.year || targetMonth !== before.month) {
      const dup = await db
        .select({ id: schema.sales_targets.id })
        .from(schema.sales_targets)
        .where(
          and(
            eq(schema.sales_targets.year, targetYear),
            eq(schema.sales_targets.month, targetMonth),
            ne(schema.sales_targets.id, id),
          ),
        )
        .get();
      if (dup) {
        badRequest(
          `Target untuk ${targetYear}-${String(targetMonth).padStart(2, "0")} sudah ada.`,
        );
      }
    }
    await db
      .update(schema.sales_targets)
      .set({ ...input, updated_at: nowIso() })
      .where(eq(schema.sales_targets.id, id));
    const after = await db
      .select()
      .from(schema.sales_targets)
      .where(eq(schema.sales_targets.id, id))
      .get();
    await logAudit(session, {
      action: "update",
      entity: "sales_target",
      entity_id: id,
      entity_name: `${after!.year}-${String(after!.month).padStart(2, "0")}`,
      changes: diffChanges(
        before as unknown as Record<string, unknown>,
        after as unknown as Record<string, unknown>,
      ),
    });
    return after;
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    requireRole(session, ["owner"]);
    const { id } = await params;
    const row = await db
      .select()
      .from(schema.sales_targets)
      .where(eq(schema.sales_targets.id, id))
      .get();
    if (!row) notFound("Sales target");
    await db
      .delete(schema.sales_targets)
      .where(eq(schema.sales_targets.id, id));
    await logAudit(session, {
      action: "delete",
      entity: "sales_target",
      entity_id: id,
      entity_name: `${row.year}-${String(row.month).padStart(2, "0")}`,
    });
    return { ok: true };
  });
}
