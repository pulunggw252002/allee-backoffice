/**
 * GET    /api/menus/:id  — single menu with recipes + outlet_ids + addon_group_ids
 * PATCH  /api/menus/:id  — update menu fields, recipe, and outlet assignments
 * DELETE /api/menus/:id  — soft-delete (is_active=false)
 */
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db/client";
import { requireRole, requireSession } from "@/server/auth/session";
import { genId, handle, notFound, readJson } from "@/server/api/helpers";
import { diffChanges, logAudit } from "@/server/api/audit";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    await requireSession();
    const { id } = await params;
    const menu = await db
      .select()
      .from(schema.menus)
      .where(eq(schema.menus.id, id))
      .get();
    if (!menu) notFound("Menu");
    const [outlets, recipes, addonGroups] = await Promise.all([
      db
        .select()
        .from(schema.menu_outlets)
        .where(eq(schema.menu_outlets.menu_id, id))
        .all(),
      db
        .select()
        .from(schema.recipe_items)
        .where(eq(schema.recipe_items.menu_id, id))
        .all(),
      db
        .select()
        .from(schema.menu_addon_groups)
        .where(eq(schema.menu_addon_groups.menu_id, id))
        .all(),
    ]);
    // Frontend `MenuWithRelations` expects `recipes` (plural) and
    // `addon_group_ids`. Mock-mode (`src/lib/api/menus.ts`) hydrates
    // these — keep the real backend in lockstep so the same UI components
    // work against either source. The PATCH/POST input is still `recipe`
    // (singular) — that's a separate write-side contract.
    return {
      ...menu,
      outlet_ids: outlets.map((o) => o.outlet_id),
      recipes,
      addon_group_ids: addonGroups.map((a) => a.addon_group_id),
    };
  });
}

const RecipeEntry = z.object({
  ingredient_id: z.string(),
  // A zero-qty recipe line is a bug: it contributes nothing to HPP and just
  // clutters the UI. Reject it server-side; client should remove the row
  // instead of saving it with 0.
  quantity: z.number().positive(),
  notes: z.string().optional(),
});

const Update = z
  .object({
    category_id: z.string(),
    name: z.string().min(1),
    sku: z.string().min(1),
    price: z.number().nonnegative(),
    hpp_cached: z.number().nonnegative(),
    photo_url: z.string().nullable(),
    description: z.string().nullable(),
    type: z.enum(["regular", "bundle"]),
    is_active: z.boolean(),
    outlet_ids: z.array(z.string()),
    recipe: z.array(RecipeEntry),
  })
  .partial();

export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    requireRole(session, ["owner"]);
    const { id } = await params;
    const before = await db
      .select()
      .from(schema.menus)
      .where(eq(schema.menus.id, id))
      .get();
    if (!before) notFound("Menu");

    const input = await readJson(req, Update);
    const { outlet_ids, recipe, ...fields } = input;

    // Menu PATCH touches three tables (menus + menu_outlets + recipe_items)
    // and we replace outlet/recipe rows by delete-then-insert. If any step
    // fails mid-flight the menu would be left partially wired (e.g. new
    // price saved but old recipe retained). Run the whole lot in one
    // transaction so either every write lands or none do.
    await db.transaction(async (tx) => {
      if (Object.keys(fields).length > 0) {
        await tx
          .update(schema.menus)
          .set(fields)
          .where(eq(schema.menus.id, id));
      }

      if (outlet_ids) {
        await tx
          .delete(schema.menu_outlets)
          .where(eq(schema.menu_outlets.menu_id, id));
        for (const outletId of outlet_ids) {
          await tx
            .insert(schema.menu_outlets)
            .values({ menu_id: id, outlet_id: outletId });
        }
      }

      if (recipe) {
        await tx
          .delete(schema.recipe_items)
          .where(eq(schema.recipe_items.menu_id, id));
        for (const r of recipe) {
          await tx.insert(schema.recipe_items).values({
            id: genId("rec"),
            menu_id: id,
            ingredient_id: r.ingredient_id,
            quantity: r.quantity,
            notes: r.notes ?? null,
          });
        }
      }
    });

    const after = await db
      .select()
      .from(schema.menus)
      .where(eq(schema.menus.id, id))
      .get();
    await logAudit(session, {
      action: "update",
      entity: "menu",
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
    const menu = await db
      .select()
      .from(schema.menus)
      .where(eq(schema.menus.id, id))
      .get();
    if (!menu) notFound("Menu");
    await db
      .update(schema.menus)
      .set({ is_active: false })
      .where(eq(schema.menus.id, id));
    await logAudit(session, {
      action: "delete",
      entity: "menu",
      entity_id: id,
      entity_name: menu.name,
      notes: "Menu dinonaktifkan",
    });
    return { ok: true };
  });
}
