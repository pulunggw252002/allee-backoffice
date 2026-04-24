/**
 * GET /api/transactions?outlet_id=&start=&end=&status=&order_type=
 *
 * Returns transactions + nested items + addons. This is the primary read
 * endpoint used by the reports page — each row is enough to render the
 * history table without further fetches.
 *
 * Transaction CREATE lives in the POS client (not backoffice). Voiding an
 * existing transaction goes through `/api/transactions/:id/void`.
 */
import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { requireSession, scopedOutletId } from "@/server/auth/session";
import { handle } from "@/server/api/helpers";

export async function GET(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    const url = new URL(req.url);
    const outletId = scopedOutletId(session, url.searchParams.get("outlet_id"));
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");
    const status = url.searchParams.get("status");
    const orderType = url.searchParams.get("order_type");

    const filters = [];
    if (outletId) filters.push(eq(schema.transactions.outlet_id, outletId));
    if (start) filters.push(gte(schema.transactions.created_at, start));
    if (end) filters.push(lte(schema.transactions.created_at, end));
    if (status) filters.push(eq(schema.transactions.status, status as never));
    if (orderType)
      filters.push(eq(schema.transactions.order_type, orderType as never));

    const txs = await db
      .select()
      .from(schema.transactions)
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(desc(schema.transactions.created_at))
      .limit(1000)
      .all();

    if (txs.length === 0) return [];

    const ids = txs.map((t) => t.id);
    const items = await db
      .select()
      .from(schema.transaction_items)
      .where(inArray(schema.transaction_items.transaction_id, ids))
      .all();
    const itemIds = items.map((i) => i.id);
    const addons =
      itemIds.length === 0
        ? []
        : await db
            .select()
            .from(schema.transaction_item_addons)
            .where(
              inArray(
                schema.transaction_item_addons.transaction_item_id,
                itemIds,
              ),
            )
            .all();

    return txs.map((t) => ({
      ...t,
      items: items
        .filter((i) => i.transaction_id === t.id)
        .map((i) => ({
          ...i,
          addons: addons.filter((a) => a.transaction_item_id === i.id),
        })),
    }));
  });
}
