/**
 * PATCH  /api/addon-groups/:id  — update group + replace options + modifiers
 * DELETE /api/addon-groups/:id
 */
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db/client";
import { requireRole, requireSession } from "@/server/auth/session";
import { genId, handle, notFound, readJson } from "@/server/api/helpers";
import { diffChanges, logAudit } from "@/server/api/audit";

type Ctx = { params: Promise<{ id: string }> };

const Modifier = z.object({
  ingredient_id: z.string(),
  quantity_delta: z.number(),
  mode: z.enum(["override", "delta"]),
});

const Option = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  extra_price: z.number().default(0),
  modifiers: z.array(Modifier).default([]),
});

const Update = z
  .object({
    name: z.string().min(1),
    selection_type: z.enum(["single", "multi"]),
    is_required: z.boolean(),
    options: z.array(Option),
  })
  .partial();

export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    requireRole(session, ["owner"]);
    const { id } = await params;
    const before = await db
      .select()
      .from(schema.addon_groups)
      .where(eq(schema.addon_groups.id, id))
      .get();
    if (!before) notFound("Addon group");
    const input = await readJson(req, Update);
    const { options, ...fields } = input;

    if (Object.keys(fields).length > 0) {
      await db
        .update(schema.addon_groups)
        .set(fields)
        .where(eq(schema.addon_groups.id, id));
    }

    if (options) {
      // Replace all options + modifiers. FK cascade removes modifiers.
      await db
        .delete(schema.addon_options)
        .where(eq(schema.addon_options.addon_group_id, id));
      for (const o of options) {
        const optionId = o.id ?? genId("ao");
        await db.insert(schema.addon_options).values({
          id: optionId,
          addon_group_id: id,
          name: o.name,
          extra_price: o.extra_price,
        });
        for (const m of o.modifiers ?? []) {
          await db.insert(schema.addon_recipe_modifiers).values({
            id: genId("arm"),
            addon_option_id: optionId,
            ingredient_id: m.ingredient_id,
            quantity_delta: m.quantity_delta,
            mode: m.mode,
          });
        }
      }
    }

    const after = await db
      .select()
      .from(schema.addon_groups)
      .where(eq(schema.addon_groups.id, id))
      .get();
    await logAudit(session, {
      action: "update",
      entity: "addon_group",
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
    const row = await db
      .select()
      .from(schema.addon_groups)
      .where(eq(schema.addon_groups.id, id))
      .get();
    if (!row) notFound("Addon group");
    await db
      .delete(schema.addon_groups)
      .where(eq(schema.addon_groups.id, id));
    await logAudit(session, {
      action: "delete",
      entity: "addon_group",
      entity_id: id,
      entity_name: row.name,
    });
    return { ok: true };
  });
}
