/**
 * GET  /api/addon-groups  — groups + nested options + modifiers
 * POST /api/addon-groups  — create group (no options yet)
 */
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db/client";
import { requireRole, requireSession } from "@/server/auth/session";
import { genId, handle, readJson } from "@/server/api/helpers";
import { logAudit } from "@/server/api/audit";
import { firePosSync } from "@/lib/webhooks/pos-sync";

export async function GET() {
  return handle(async () => {
    await requireSession();
    const groups = await db.select().from(schema.addon_groups).all();
    if (groups.length === 0) return [];
    const options = await db
      .select()
      .from(schema.addon_options)
      .where(
        inArray(
          schema.addon_options.addon_group_id,
          groups.map((g) => g.id),
        ),
      )
      .all();
    const modifiers =
      options.length === 0
        ? []
        : await db
            .select()
            .from(schema.addon_recipe_modifiers)
            .where(
              inArray(
                schema.addon_recipe_modifiers.addon_option_id,
                options.map((o) => o.id),
              ),
            )
            .all();
    return groups.map((g) => {
      const groupOptions = options
        .filter((o) => o.addon_group_id === g.id)
        .map((o) => ({
          ...o,
          modifiers: modifiers.filter((m) => m.addon_option_id === o.id),
        }));
      return { ...g, options: groupOptions };
    });
  });
}

const Input = z.object({
  name: z.string().min(1),
  selection_type: z.enum(["single", "multi"]).default("single"),
  is_required: z.boolean().default(false),
});

export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    requireRole(session, ["owner"]);
    const input = await readJson(req, Input);
    const row = { id: genId("ag"), ...input };
    await db.insert(schema.addon_groups).values(row);
    await logAudit(session, {
      action: "create",
      entity: "addon_group",
      entity_id: row.id,
      entity_name: row.name,
    });
    await firePosSync({ entity: "addon_group", event: "created", entity_id: row.id });
    return row;
  });
}
