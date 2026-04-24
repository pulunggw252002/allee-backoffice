/**
 * GET /api/audit?limit=100&entity=&action=&outlet_id=
 *
 * Read-only audit log feed. Kepala toko sees only their outlet.
 */
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { requireSession, scopedOutletId } from "@/server/auth/session";
import { handle } from "@/server/api/helpers";

export async function GET(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    const url = new URL(req.url);
    const limit = Math.min(
      Number(url.searchParams.get("limit") ?? 100) || 100,
      500,
    );
    const entity = url.searchParams.get("entity");
    const action = url.searchParams.get("action");
    const outletId = scopedOutletId(session, url.searchParams.get("outlet_id"));

    const filters = [];
    if (entity) filters.push(eq(schema.audit_logs.entity, entity));
    if (action) filters.push(eq(schema.audit_logs.action, action));
    if (outletId) filters.push(eq(schema.audit_logs.outlet_id, outletId));

    return db
      .select()
      .from(schema.audit_logs)
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(desc(schema.audit_logs.created_at))
      .limit(limit)
      .all();
  });
}
