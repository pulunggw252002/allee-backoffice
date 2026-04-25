/**
 * POST /api/transactions/:id/items/:itemId/void — void granular per item.
 *
 * Body: `{ reason: string }` (template ATAU komentar bebas, 1..500 char).
 *
 * Semantik (April 2026): void sekarang per-item bukan per-struk. Endpoint
 * ini menandai satu `transaction_item` sebagai void (`voided_at`,
 * `voided_by`, `void_reason`). Stok TIDAK direstore — bahan sudah dipakai
 * dianggap kerugian operasional, sama seperti void per-struk.
 *
 * Idempotent guard: kalau item sudah pernah di-void, tolak (400) supaya
 * tidak menimpa atribusi user/reason yang sudah ada.
 *
 * Auth: kasir/kepala_toko di outlet yang sama, atau owner.
 */
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db/client";
import { requireRole, requireSession } from "@/server/auth/session";
import {
  badRequest,
  handle,
  notFound,
  nowIso,
  readJson,
} from "@/server/api/helpers";
import { logAudit } from "@/server/api/audit";

type Ctx = { params: Promise<{ id: string; itemId: string }> };

const Input = z.object({
  reason: z
    .string()
    .trim()
    .min(1, "Alasan void wajib diisi")
    .max(500, "Alasan terlalu panjang (max 500 karakter)"),
});

export async function POST(req: Request, { params }: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    requireRole(session, ["owner", "kepala_toko", "kasir"]);
    const { id, itemId } = await params;

    const tx = await db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.id, id))
      .get();
    if (!tx) notFound("Transaction");
    // Cross-outlet guard untuk non-owner.
    if (
      session.domainUser.role !== "owner" &&
      session.domainUser.outlet_id &&
      tx.outlet_id !== session.domainUser.outlet_id
    ) {
      notFound("Transaction");
    }
    if (tx.status !== "paid")
      badRequest("Hanya transaksi 'paid' yang bisa di-void");

    const item = await db
      .select()
      .from(schema.transaction_items)
      .where(
        and(
          eq(schema.transaction_items.id, itemId),
          eq(schema.transaction_items.transaction_id, id),
        ),
      )
      .get();
    if (!item) notFound("Transaction item");
    if (item.voided_at !== null) badRequest("Item sudah di-void sebelumnya");

    const { reason } = await readJson(req, Input);
    const now = nowIso();

    await db
      .update(schema.transaction_items)
      .set({
        voided_at: now,
        voided_by: session.domainUser.id,
        void_reason: reason,
      })
      .where(eq(schema.transaction_items.id, itemId));

    const itemLabel = `${item.name_snapshot} ×${item.quantity}`;
    await logAudit(session, {
      action: "void",
      entity: "transaction",
      entity_id: id,
      entity_name: `Transaksi #${id.slice(-6)} — ${itemLabel}`,
      outlet_id: tx.outlet_id,
      notes: `Void item: ${reason}`,
    });

    return { ok: true, item_id: itemId, voided_at: now };
  });
}
