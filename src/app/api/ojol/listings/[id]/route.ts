/**
 * PATCH /api/ojol/listings/:id
 * Update per-menu × per-platform price_override / is_available.
 * Flips `sync_status → "pending"` so the next sync run picks it up.
 * Owner-only.
 */
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db/client";
import { requireRole, requireSession } from "@/server/auth/session";
import { handle, notFound, readJson } from "@/server/api/helpers";
import { logAudit } from "@/server/api/audit";

type Ctx = { params: Promise<{ id: string }> };

const Input = z
  .object({
    // Reject negative prices server-side. Null ⇒ "use base menu.price".
    price_override: z.number().min(0).nullable(),
    is_available: z.boolean(),
  })
  .partial();

export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    requireRole(session, ["owner"]);
    const { id } = await params;
    const before = await db
      .select()
      .from(schema.menu_channel_listings)
      .where(eq(schema.menu_channel_listings.id, id))
      .get();
    if (!before) notFound("Listing");

    const input = await readJson(req, Input);
    await db
      .update(schema.menu_channel_listings)
      .set({ ...input, sync_status: "pending", sync_error: null })
      .where(eq(schema.menu_channel_listings.id, id));

    const after = await db
      .select()
      .from(schema.menu_channel_listings)
      .where(eq(schema.menu_channel_listings.id, id))
      .get();

    const menu = await db
      .select({ name: schema.menus.name })
      .from(schema.menus)
      .where(eq(schema.menus.id, after!.menu_id))
      .get();

    await logAudit(session, {
      action: "update",
      entity: "menu_channel_listing",
      entity_id: after!.id,
      entity_name: `${menu?.name ?? after!.menu_id} — ${after!.platform}`,
    });

    return after;
  });
}
