/**
 * GET /api/ojol/channels?outlet_id=&platform=
 * List ojol/marketplace channel configs. Kepala Toko sees only their outlet.
 * `api_key` is masked to last 4 chars; full value never leaves the server.
 */
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { requireSession, scopedOutletId } from "@/server/auth/session";
import { handle } from "@/server/api/helpers";
import { maskKey } from "@/server/api/ojol-utils";
import type { OjolPlatform } from "@/types";

export async function GET(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    const url = new URL(req.url);
    const platformParam = url.searchParams.get("platform") as OjolPlatform | null;
    const outletParam = scopedOutletId(session, url.searchParams.get("outlet_id"));

    const conds = [] as ReturnType<typeof eq>[];
    if (outletParam) conds.push(eq(schema.ojol_channels.outlet_id, outletParam));
    if (platformParam) conds.push(eq(schema.ojol_channels.platform, platformParam));

    const rows = await db
      .select()
      .from(schema.ojol_channels)
      .where(conds.length ? and(...conds) : undefined)
      .all();
    return rows.map((r) => ({ ...r, api_key: maskKey(r.api_key) }));
  });
}
