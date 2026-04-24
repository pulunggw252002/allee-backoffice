import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db/client";
import { requireRole, requireSession } from "@/server/auth/session";
import { handle, notFound, readJson } from "@/server/api/helpers";
import { diffChanges, logAudit } from "@/server/api/audit";

type Ctx = { params: Promise<{ id: string }> };

const ItemInput = z.object({
  menu_id: z.string(),
  quantity: z.number().int().positive(),
});

const Update = z
  .object({
    name: z.string().min(1),
    price: z.number().nonnegative(),
    is_active: z.boolean(),
    photo_url: z.string().nullable(),
    description: z.string().nullable(),
    outlet_ids: z.array(z.string()),
    items: z.array(ItemInput),
  })
  .partial();

export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    requireRole(session, ["owner"]);
    const { id } = await params;
    const before = await db
      .select()
      .from(schema.bundles)
      .where(eq(schema.bundles.id, id))
      .get();
    if (!before) notFound("Bundle");
    const input = await readJson(req, Update);
    const { outlet_ids, items, ...fields } = input;
    if (Object.keys(fields).length > 0) {
      await db.update(schema.bundles).set(fields).where(eq(schema.bundles.id, id));
    }
    if (outlet_ids) {
      await db
        .delete(schema.bundle_outlets)
        .where(eq(schema.bundle_outlets.bundle_id, id));
      for (const oid of outlet_ids) {
        await db
          .insert(schema.bundle_outlets)
          .values({ bundle_id: id, outlet_id: oid });
      }
    }
    if (items) {
      await db
        .delete(schema.bundle_items)
        .where(eq(schema.bundle_items.bundle_id, id));
      for (const it of items) {
        await db.insert(schema.bundle_items).values({
          bundle_id: id,
          menu_id: it.menu_id,
          quantity: it.quantity,
        });
      }
    }
    const after = await db
      .select()
      .from(schema.bundles)
      .where(eq(schema.bundles.id, id))
      .get();
    await logAudit(session, {
      action: "update",
      entity: "bundle",
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
      .from(schema.bundles)
      .where(eq(schema.bundles.id, id))
      .get();
    if (!before) notFound("Bundle");
    await db
      .update(schema.bundles)
      .set({ is_active: false })
      .where(eq(schema.bundles.id, id));
    await logAudit(session, {
      action: "delete",
      entity: "bundle",
      entity_id: id,
      entity_name: before.name,
      notes: "Bundling dinonaktifkan",
    });
    return { ok: true };
  });
}
