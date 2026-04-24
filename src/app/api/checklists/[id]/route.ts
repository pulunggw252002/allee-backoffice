import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db/client";
import { requireRole, requireSession } from "@/server/auth/session";
import { handle, notFound, readJson } from "@/server/api/helpers";
import { diffChanges, logAudit } from "@/server/api/audit";

type Ctx = { params: Promise<{ id: string }> };

const Update = z
  .object({
    station: z.enum(["bar", "kitchen", "cashier", "service", "management"]),
    type: z.enum(["before", "after"]),
    label: z.string().min(1),
    sort_order: z.number().int(),
  })
  .partial();

export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    requireRole(session, ["owner"]);
    const { id } = await params;
    const before = await db
      .select()
      .from(schema.checklist_templates)
      .where(eq(schema.checklist_templates.id, id))
      .get();
    if (!before) notFound("Checklist template");
    const input = await readJson(req, Update);
    await db
      .update(schema.checklist_templates)
      .set(input)
      .where(eq(schema.checklist_templates.id, id));
    const after = await db
      .select()
      .from(schema.checklist_templates)
      .where(eq(schema.checklist_templates.id, id))
      .get();
    await logAudit(session, {
      action: "update",
      entity: "checklist_template",
      entity_id: id,
      entity_name: after!.label,
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
      .from(schema.checklist_templates)
      .where(eq(schema.checklist_templates.id, id))
      .get();
    if (!row) notFound("Checklist template");
    await db
      .delete(schema.checklist_templates)
      .where(eq(schema.checklist_templates.id, id));
    await logAudit(session, {
      action: "delete",
      entity: "checklist_template",
      entity_id: id,
      entity_name: row.label,
    });
    return { ok: true };
  });
}
