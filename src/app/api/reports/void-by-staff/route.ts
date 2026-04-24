import { inArray } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { requireSession } from "@/server/auth/session";
import { handle } from "@/server/api/helpers";
import { readReportParams } from "@/server/api/report-shared";
import { loadVoidTxs, txHpp } from "@/server/api/void-shared";

export async function GET(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    const params = readReportParams(session, req);
    const url = new URL(req.url);
    const limit = Math.min(
      Number(url.searchParams.get("limit") ?? 10) || 10,
      100,
    );
    const voids = await loadVoidTxs(params);
    const map = new Map<
      string,
      { user_id: string; user_name: string; count: number; loss: number }
    >();
    for (const t of voids) {
      const actorId = t.voided_by ?? t.user_id;
      if (!actorId) continue;
      const row = map.get(actorId) ?? {
        user_id: actorId,
        user_name: actorId,
        count: 0,
        loss: 0,
      };
      row.count += 1;
      row.loss += txHpp(t);
      map.set(actorId, row);
    }
    // Hydrate staff names in a single query.
    const userIds = Array.from(map.keys());
    if (userIds.length > 0) {
      const users = await db
        .select()
        .from(schema.users)
        .where(inArray(schema.users.id, userIds))
        .all();
      for (const u of users) {
        const row = map.get(u.id);
        if (row) row.user_name = u.name;
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.loss - a.loss)
      .slice(0, limit);
  });
}
