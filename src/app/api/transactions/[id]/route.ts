/**
 * GET /api/transactions/:id — single transaction with items + addons.
 */
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { requireSession } from "@/server/auth/session";
import { handle, notFound } from "@/server/api/helpers";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    await requireSession();
    const { id } = await params;
    const tx = await db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.id, id))
      .get();
    if (!tx) notFound("Transaction");
    const items = await db
      .select()
      .from(schema.transaction_items)
      .where(eq(schema.transaction_items.transaction_id, id))
      .all();
    const itemIds = items.map((i) => i.id);
    const addons =
      itemIds.length === 0
        ? []
        : await db
            .select()
            .from(schema.transaction_item_addons)
            .where(eq(schema.transaction_item_addons.transaction_item_id, itemIds[0]))
            .all();
    return {
      ...tx,
      items: items.map((i) => ({
        ...i,
        addons: addons.filter((a) => a.transaction_item_id === i.id),
      })),
    };
  });
}
