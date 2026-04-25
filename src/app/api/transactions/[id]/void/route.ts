/**
 * POST /api/transactions/:id/void  — shortcut "void semua item di struk".
 *
 * Semantik baru (April 2026): void granular per **item**. Endpoint ini
 * sekarang menjadi convenience: kasir di POS yang mau membatalkan seluruh
 * struk bisa hit endpoint ini sekali dan semua item akan ter-void dengan
 * `reason` yang sama. Per-item void tersedia di
 * `POST /api/transactions/:id/items/:itemId/void`.
 *
 * `reason` tetap free-form string (template pilihan ATAU komentar bebas).
 * Stok TIDAK direstore — bahan sudah dipakai dianggap kerugian operasional.
 *
 * Backward-compat: `transactions.status` tetap dibiarkan `"paid"` setelah
 * void (sebelumnya di-flip ke `"void"`). Laporan Void mengambil dari
 * `transaction_items.voided_at`, jadi struk yang seluruh item-nya void
 * akan tetap muncul di laporan dengan benar tanpa perlu status flip.
 */
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db/client";
import { requireRole, requireSession } from "@/server/auth/session";
import { badRequest, handle, notFound, nowIso, readJson } from "@/server/api/helpers";
import { logAudit } from "@/server/api/audit";

type Ctx = { params: Promise<{ id: string }> };

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
    const { id } = await params;
    const tx = await db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.id, id))
      .get();
    if (!tx) notFound("Transaction");
    if (
      session.domainUser.role !== "owner" &&
      session.domainUser.outlet_id &&
      tx.outlet_id !== session.domainUser.outlet_id
    ) {
      notFound("Transaction");
    }
    if (tx.status !== "paid")
      badRequest("Hanya transaksi 'paid' yang bisa di-void");

    const { reason } = await readJson(req, Input);
    const now = nowIso();

    // Cek item aktif (yang belum di-void). Kalau semuanya sudah di-void via
    // per-item endpoint sebelumnya, tolak — tidak ada yang bisa di-void lagi.
    const remaining = await db
      .select({
        id: schema.transaction_items.id,
        voided_at: schema.transaction_items.voided_at,
      })
      .from(schema.transaction_items)
      .where(eq(schema.transaction_items.transaction_id, id))
      .all();
    const activeIds = remaining
      .filter((r) => r.voided_at === null)
      .map((r) => r.id);
    if (activeIds.length === 0)
      badRequest("Tidak ada item aktif untuk di-void");

    // Mark semua item yang masih aktif → voided_at = now, atribusi user + reason.
    await db
      .update(schema.transaction_items)
      .set({
        voided_at: now,
        voided_by: session.domainUser.id,
        void_reason: reason,
      })
      .where(
        and(
          eq(schema.transaction_items.transaction_id, id),
          isNull(schema.transaction_items.voided_at),
        ),
      );

    await logAudit(session, {
      action: "void",
      entity: "transaction",
      entity_id: id,
      entity_name: `Transaksi #${id.slice(-6)}`,
      outlet_id: tx.outlet_id,
      notes: `Void seluruh struk: ${reason}`,
    });

    return { ok: true, voided_count: activeIds.length };
  });
}
