import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db/client";
import { requireRole, requireSession } from "@/server/auth/session";
import { handle, notFound, readJson } from "@/server/api/helpers";
import { diffChanges, logAudit } from "@/server/api/audit";

type Ctx = { params: Promise<{ id: string }> };

const Update = z
  .object({
    name: z.string().min(1),
    type: z.enum(["percent", "nominal"]),
    // Match the bounds the POST route enforces. The cross-field percent rule
    // below re-checks the percent ceiling when both `type` and `value` are
    // present in the same partial payload.
    value: z.number().nonnegative().max(1_000_000_000),
    scope: z.enum(["all", "category", "menu"]),
    scope_ref_id: z.string().nullable(),
    start_at: z.string().nullable(),
    end_at: z.string().nullable(),
    active_hour_start: z.string().nullable(),
    active_hour_end: z.string().nullable(),
    is_active: z.boolean(),
  })
  .partial()
  .superRefine((data, ctx) => {
    if (data.type === "percent" && typeof data.value === "number" && data.value > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Diskon persen tidak boleh lebih dari 100%",
        path: ["value"],
      });
    }
  });

export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    requireRole(session, ["owner"]);
    const { id } = await params;
    const before = await db
      .select()
      .from(schema.discounts)
      .where(eq(schema.discounts.id, id))
      .get();
    if (!before) notFound("Discount");
    const input = await readJson(req, Update);
    await db
      .update(schema.discounts)
      .set(input)
      .where(eq(schema.discounts.id, id));
    const after = await db
      .select()
      .from(schema.discounts)
      .where(eq(schema.discounts.id, id))
      .get();
    await logAudit(session, {
      action: "update",
      entity: "discount",
      entity_id: id,
      entity_name: after!.name,
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
    const before = await db
      .select()
      .from(schema.discounts)
      .where(eq(schema.discounts.id, id))
      .get();
    if (!before) notFound("Discount");
    await db
      .update(schema.discounts)
      .set({ is_active: false })
      .where(eq(schema.discounts.id, id));
    await logAudit(session, {
      action: "delete",
      entity: "discount",
      entity_id: id,
      entity_name: before.name,
    });
    return { ok: true };
  });
}
