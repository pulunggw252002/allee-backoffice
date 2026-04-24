/**
 * POST /api/ojol/sync
 * Trigger a sync run for a (outlet, platform). Pushes every active menu's
 * merged price + availability to the platform.
 *
 * In this implementation the actual upstream API call is stubbed out — we
 * simply mark every matching listing as `synced`, stamp `last_sync_at`, and
 * write a log row. When the real GoFood / GrabFood / ShopeeFood partner
 * APIs are wired in, replace the body of the `for (const row of listings)`
 * loop with the actual HTTP push and surface per-item errors through
 * `sync_error` + `status: "failed" | "partial"`.
 *
 * Owner-only.
 */
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db/client";
import { requireRole, requireSession } from "@/server/auth/session";
import { genId, handle, nowIso, readJson, HttpError } from "@/server/api/helpers";
import { logAudit } from "@/server/api/audit";

const Input = z.object({
  outlet_id: z.string().min(1),
  platform: z.enum(["gofood", "grabfood", "shopeefood"]),
});

export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    requireRole(session, ["owner"]);
    const { outlet_id, platform } = await readJson(req, Input);

    const channel = await db
      .select()
      .from(schema.ojol_channels)
      .where(
        and(
          eq(schema.ojol_channels.outlet_id, outlet_id),
          eq(schema.ojol_channels.platform, platform),
        ),
      )
      .get();
    if (!channel) throw new HttpError(404, "Channel tidak ditemukan");
    if (!channel.is_connected)
      throw new HttpError(400, "Channel belum terhubung");

    const menuIdsInOutlet = await db
      .select({ menu_id: schema.menu_outlets.menu_id })
      .from(schema.menu_outlets)
      .where(eq(schema.menu_outlets.outlet_id, outlet_id))
      .all();
    const activeMenus = await db
      .select({ id: schema.menus.id })
      .from(schema.menus)
      .where(
        and(
          eq(schema.menus.is_active, true),
          inArray(
            schema.menus.id,
            menuIdsInOutlet.map((r) => r.menu_id),
          ),
        ),
      )
      .all();
    const menuIds = activeMenus.map((m) => m.id);

    const listings = menuIds.length
      ? await db
          .select()
          .from(schema.menu_channel_listings)
          .where(
            and(
              eq(schema.menu_channel_listings.platform, platform),
              inArray(schema.menu_channel_listings.menu_id, menuIds),
            ),
          )
          .all()
      : [];

    const now = nowIso();
    // TODO(ojol-integration): replace with per-item partner-API push.
    for (const row of listings) {
      await db
        .update(schema.menu_channel_listings)
        .set({ sync_status: "synced", last_sync_at: now, sync_error: null })
        .where(eq(schema.menu_channel_listings.id, row.id));
    }

    await db
      .update(schema.ojol_channels)
      .set({ last_sync_at: now })
      .where(eq(schema.ojol_channels.id, channel.id));

    const log = {
      id: genId("syl"),
      outlet_id,
      platform,
      triggered_by_user_id: session.domainUser.id,
      triggered_by_name: session.domainUser.name,
      started_at: now,
      completed_at: now,
      status: "success" as const,
      items_total: listings.length,
      items_synced: listings.length,
      items_failed: 0,
      notes: null,
    };
    await db.insert(schema.ojol_sync_logs).values(log);

    await logAudit(session, {
      action: "update",
      entity: "ojol_channel",
      entity_id: channel.id,
      entity_name: `Sync ${platform} — ${listings.length} item`,
      outlet_id: channel.outlet_id,
    });

    return log;
  });
}
