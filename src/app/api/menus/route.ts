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

/** Hydrate a menu row with its many-to-many outlet links. */
async function hydrateOutlets(menuIds: string[]) {
  if (menuIds.length === 0) return new Map<string, string[]>();
  const rows = await db
    .select()
    .from(schema.menu_outlets)
    .where(
      sql`${schema.menu_outlets.menu_id} IN (${sql.join(
        menuIds.map((id) => sql`${id}`),
        sql`, `,
      )})`,
    )
    .all();
  const map = new Map<string, string[]>();
  for (const r of rows) {
    const arr = map.get(r.menu_id) ?? [];
    arr.push(r.outlet_id);
    map.set(r.menu_id, arr);
  }
  return map;
}

export async function GET() {
  return handle(async () => {
    await requireSession();
    const menus = await db.select().from(schema.menus).all();
    const outletMap = await hydrateOutlets(menus.map((m) => m.id));
    return menus.map((m) => ({
      ...m,
      outlet_ids: outletMap.get(m.id) ?? [],
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
