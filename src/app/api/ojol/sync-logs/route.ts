/**
 * GET /api/ojol/sync-logs?outlet_id=&platform=&limit=50
 * History of sync runs. Default 50 rows, newest-first.
 * Non-owner callers are clamped to their own outlet via `scopedOutletId`.
 */
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { requireSession, scopedOutletId } from "@/server/auth/session";
import { handle } from "@/server/api/helpers";
import type { OjolPlatform } from "@/types";

export async function GET(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    const url = new URL(req.url);
    const outletParam = scopedOutletId(session, url.searchParams.get("outlet_id"));
    const platform = url.searchParams.get("platform") as OjolPlatform | null;
    const limit = Math.min(
      200,
      Math.max(1, Number(url.searchParams.get("limit") ?? 50)),
    );

    const conds = [] as ReturnType<typeof eq>[];
    if (outletParam) conds.push(eq(schema.ojol_sync_logs.outlet_id, outletParam));
    if (platform) conds.push(eq(schema.ojol_sync_logs.platform, platform));

    return await db
      .select()
      .from(schema.ojol_sync_logs)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(schema.ojol_sync_logs.started_at))
      .limit(limit)
      .all();
  });
}
