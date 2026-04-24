/**
 * POST /api/transactions/:id/void
 *
 * Mark a paid transaction as voided (staff-error: order sudah dibuat, stok
 * terpotong, tapi pelanggan menolak). Flipping status to "void" removes the
 * revenue from sales reports while keeping the stock movement + HPP in place
 * as an operational loss — matches the frontend void-report semantics.
 */
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db/client";
import { requireRole, requireSession } from "@/server/auth/session";
import { badRequest, handle, notFound, nowIso, readJson } from "@/server/api/helpers";
import { logAudit } from "@/server/api/audit";

type Ctx = { params: Promise<{ id: string }> };

const Input = z.object({
  reason: z.string().min(1),
});

export async function POST(req: Request, { params }: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    requireRole(session, ["owner", "kepala_toko"]);
    const { id } = await params;
    const tx = await db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.id, id))
      .get();
    if (!tx) notFound("Transaction");
    if (tx.status === "void") badRequest("Transaction sudah void");
    if (tx.status !== "paid")
      badRequest("Hanya transaksi 'paid' yang bisa di-void");

    const { reason } = await readJson(req, Input);
    await db
      .update(schema.transactions)
      .set({
        status: "void",
        void_reason: reason,
        voided_by: session.domainUser.id,
        voided_at: nowIso(),
      })
      .where(eq(schema.transactions.id, id));

    await logAudit(session, {
      action: "update",
      entity: "session",
      entity_id: id,
      entity_name: `Transaksi #${id.slice(-6)}`,
      outlet_id: tx.outlet_id,
      notes: `Void: ${reason}`,
    });

    return { ok: true };
  });
}
