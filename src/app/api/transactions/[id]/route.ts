/**
 * GET /api/transactions/:id — single transaction with items + addons.
 *
 * Scoped to caller's outlet: kepala_toko / kasir / dst tidak bisa baca
 * transaksi outlet lain meskipun mereka tahu id-nya. Owner boleh akses
 * semua. Kalau scope mismatch, balikin 404 (bukan 403) supaya tidak bocor
 * info "id ini valid tapi bukan outlet kamu".
 */
import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { requireSession } from "@/server/auth/session";
import { handle, notFound } from "@/server/api/helpers";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    const { id } = await params;
    const tx = await db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.id, id))
      .get();
    if (!tx) notFound("Transaction");
    // Cross-outlet read guard untuk non-owner.
    if (
      session.domainUser.role !== "owner" &&
      session.domainUser.outlet_id &&
      tx.outlet_id !== session.domainUser.outlet_id
    ) {
      notFound("Transaction");
    }
    const items = await db
      .select()
      .from(schema.transaction_items)
      .where(eq(schema.transaction_items.transaction_id, id))
      .all();
    const itemIds = items.map((i) => i.id);
    // BUG fix: dulu pakai eq(itemIds[0]) — addon item ke-2..N hilang.
    // Sekarang inArray(itemIds) supaya semua item ikut load.
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
    return {
      ...tx,
      items: items.map((i) => ({
        ...i,
        addons: addons.filter((a) => a.transaction_item_id === i.id),
      })),
    };
  });
}
