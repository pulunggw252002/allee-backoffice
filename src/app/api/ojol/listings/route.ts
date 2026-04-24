/**
 * GET /api/ojol/listings?menu_id=&platform=
 * Per-menu × per-platform listing (price_override + is_available + sync state).
 * Not outlet-scoped — listings are menu-scoped and a menu may belong to
 * multiple outlets. Kepala Toko still sees them so they can eyeball sync
 * status, but only Owner can mutate via PATCH.
 */
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { requireSession } from "@/server/auth/session";
import { handle } from "@/server/api/helpers";
import type { OjolPlatform } from "@/types";

export async function GET(req: Request) {
  return handle(async () => {
    await requireSession();
    const url = new URL(req.url);
    const menuId = url.searchParams.get("menu_id");
    const platform = url.searchParams.get("platform") as OjolPlatform | null;

    const conds = [] as ReturnType<typeof eq>[];
    if (menuId) conds.push(eq(schema.menu_channel_listings.menu_id, menuId));
    if (platform)
      conds.push(eq(schema.menu_channel_listings.platform, platform));

    return await db
      .select()
      .from(schema.menu_channel_listings)
      .where(conds.length ? and(...conds) : undefined)
      .all();
  });
}
