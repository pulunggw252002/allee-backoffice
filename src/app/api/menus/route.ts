/**
 * GET  /api/menus     — list menus with `outlet_ids` array hydrated
 * POST /api/menus     — create menu (+ optional recipe, outlet assignments)
 */
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db/client";
import { requireRole, requireSession } from "@/server/auth/session";
import { genId, handle, readJson } from "@/server/api/helpers";
import { logAudit } from "@/server/api/audit";

type RecipeItem = typeof schema.recipe_items.$inferSelect;

/**
 * Bucket FK rows under their parent menu in a single pass. Caller does one
 * `WHERE menu_id IN (...)` then this groups the result client-side, instead
 * of issuing N queries for N menus.
 */
function groupBy<T, K extends string>(
  rows: T[],
  key: (row: T) => K,
): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const r of rows) {
    const k = key(r);
    const arr = map.get(k) ?? [];
    arr.push(r);
    map.set(k, arr);
  }
  return map;
}

export async function GET() {
  return handle(async () => {
    await requireSession();
    const menus = await db.select().from(schema.menus).all();
    if (menus.length === 0) return [];
    const ids = menus.map((m) => m.id);
    const inIds = sql`${schema.menu_outlets.menu_id} IN (${sql.join(
      ids.map((id) => sql`${id}`),
      sql`, `,
    )})`;

    // Frontend `MenuWithRelations` reads `outlet_ids`, `recipes` (plural),
    // and `addon_group_ids` for every menu in the list. The recipes page
    // crashes if any of these are missing, so we hydrate all three in
    // parallel — three round-trips instead of 3×N.
    const [outlets, recipes, addons] = await Promise.all([
      db.select().from(schema.menu_outlets).where(inIds).all(),
      db
        .select()
        .from(schema.recipe_items)
        .where(
          sql`${schema.recipe_items.menu_id} IN (${sql.join(
            ids.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        )
        .all(),
      db
        .select()
        .from(schema.menu_addon_groups)
        .where(
          sql`${schema.menu_addon_groups.menu_id} IN (${sql.join(
            ids.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        )
        .all(),
    ]);

    const outletMap = groupBy(outlets, (r) => r.menu_id);
    const recipeMap: Map<string, RecipeItem[]> = groupBy(
      recipes,
      (r) => r.menu_id,
    );
    const addonMap = groupBy(addons, (r) => r.menu_id);

    return menus.map((m) => ({
      ...m,
      outlet_ids: (outletMap.get(m.id) ?? []).map((r) => r.outlet_id),
      recipes: recipeMap.get(m.id) ?? [],
      addon_group_ids: (addonMap.get(m.id) ?? []).map((r) => r.addon_group_id),
    }));
  });
}

const RecipeEntry = z.object({
  ingredient_id: z.string(),
  quantity: z.number().nonnegative(),
  notes: z.string().optional(),
});

const CreateInput = z.object({
  category_id: z.string(),
  name: z.string().min(1),
  sku: z.string().min(1),
  price: z.number().nonnegative(),
  hpp_cached: z.number().nonnegative().default(0),
  photo_url: z.string().optional(),
  description: z.string().optional(),
  type: z.enum(["regular", "bundle"]).default("regular"),
  is_active: z.boolean().default(true),
  outlet_ids: z.array(z.string()).default([]),
  recipe: z.array(RecipeEntry).default([]),
});

export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    requireRole(session, ["owner"]);
    const input = await readJson(req, CreateInput);

    const menuId = genId("mnu");
    await db.insert(schema.menus).values({
      id: menuId,
      category_id: input.category_id,
      name: input.name,
      sku: input.sku,
      price: input.price,
      hpp_cached: input.hpp_cached,
      photo_url: input.photo_url ?? null,
      description: input.description ?? null,
      type: input.type,
      is_active: input.is_active,
    });

    for (const outletId of input.outlet_ids ?? []) {
      await db
        .insert(schema.menu_outlets)
        .values({ menu_id: menuId, outlet_id: outletId });
    }

    for (const r of input.recipe ?? []) {
      await db.insert(schema.recipe_items).values({
        id: genId("rec"),
        menu_id: menuId,
        ingredient_id: r.ingredient_id,
        quantity: r.quantity,
        notes: r.notes ?? null,
      });
    }

    await logAudit(session, {
      action: "create",
      entity: "menu",
      entity_id: menuId,
      entity_name: input.name,
    });

    const created = await db
      .select()
      .from(schema.menus)
      .where(eq(schema.menus.id, menuId))
      .get();
    return { ...created, outlet_ids: input.outlet_ids ?? [] };
  });
}
