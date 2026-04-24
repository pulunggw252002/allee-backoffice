import { inArray } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db/client";
import { requireRole, requireSession } from "@/server/auth/session";
import { genId, handle, readJson } from "@/server/api/helpers";
import { logAudit } from "@/server/api/audit";

export async function GET() {
  return handle(async () => {
    await requireSession();
    const bundles = await db.select().from(schema.bundles).all();
    if (bundles.length === 0) return [];
    const ids = bundles.map((b) => b.id);
    const items = await db
      .select()
      .from(schema.bundle_items)
      .where(inArray(schema.bundle_items.bundle_id, ids))
      .all();
    const outletsRel = await db
      .select()
      .from(schema.bundle_outlets)
      .where(inArray(schema.bundle_outlets.bundle_id, ids))
      .all();
    return bundles.map((b) => ({
      ...b,
      items: items.filter((i) => i.bundle_id === b.id),
      outlet_ids: outletsRel
        .filter((o) => o.bundle_id === b.id)
        .map((o) => o.outlet_id),
    }));
  });
}

const ItemInput = z.object({
  menu_id: z.string(),
  quantity: z.number().int().positive().default(1),
});

const CreateInput = z.object({
  name: z.string().min(1),
  price: z.number().nonnegative(),
  is_active: z.boolean().default(true),
  photo_url: z.string().optional(),
  description: z.string().optional(),
  outlet_ids: z.array(z.string()).default([]),
  items: z.array(ItemInput).default([]),
});

export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    requireRole(session, ["owner"]);
    const input = await readJson(req, CreateInput);
    const id = genId("bnd");
    await db.insert(schema.bundles).values({
      id,
      name: input.name,
      price: input.price,
      is_active: input.is_active,
      photo_url: input.photo_url ?? null,
      description: input.description ?? null,
    });
    for (const oid of input.outlet_ids ?? []) {
      await db
        .insert(schema.bundle_outlets)
        .values({ bundle_id: id, outlet_id: oid });
    }
    for (const it of input.items ?? []) {
      await db.insert(schema.bundle_items).values({
        bundle_id: id,
        menu_id: it.menu_id,
        quantity: it.quantity,
      });
    }
    await logAudit(session, {
      action: "create",
      entity: "bundle",
      entity_id: id,
      entity_name: input.name,
    });
    return { id, ...input };
  });
}
