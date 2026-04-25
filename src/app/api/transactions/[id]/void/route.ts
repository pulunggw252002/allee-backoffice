/**
 * POST /api/transactions/:id/void
 *
 * Mark a paid transaction as voided (staff-error: order sudah dibuat, stok
 * terpotong, tapi pelanggan menolak). Flipping status to "void" removes the
 * revenue from sales reports while keeping the stock movement + HPP in place
 * as an operational loss — matches the frontend void-report semantics.
 *
 * `reason` adalah free-form string yang diinput operator di POS — bisa berupa
 * pilihan template (mis. "Salah menu") ATAU komentar bebas yang dia ketik
 * sendiri (mis. "Pelanggan tiba-tiba ganti pesanan jadi minuman dingin"). DB
 * menyimpan apa pun yang dikirim apa adanya supaya laporan void mencerminkan
 * konteks asli dari kasir, bukan bucket enum yang membatasi nuance.
 *
 * Backoffice tidak memanggil endpoint ini sendiri — semua void berasal dari
 * POS. Endpoint ini ada di backoffice supaya POS punya satu sumber backend
 * yang sama untuk audit & report.
 */
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db/client";
import { requireRole, requireSession } from "@/server/auth/session";
import { badRequest, handle, notFound, nowIso, readJson } from "@/server/api/helpers";
import { logAudit } from "@/server/api/audit";

type Ctx = { params: Promise<{ id: string }> };

const Input = z.object({
  // Free-form POS input. min(1) menolak string kosong; max(500) menjadi
  // safety cap supaya kasir yang nge-paste log error / paragraph panjang
  // tidak meledakkan UI tabel laporan. Trim di server supaya whitespace-only
  // input ditolak.
  reason: z
    .string()
    .trim()
    .min(1, "Alasan void wajib diisi")
    .max(500, "Alasan terlalu panjang (max 500 karakter)"),
});

export async function POST(req: Request, { params }: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    // Void datang dari POS (kasir / kepala_toko / owner). Kasir butuh akses
    // supaya bisa flag staff-error langsung tanpa harus tunggu kepala toko.
    // Audit log mencatat siapa yang void supaya owner bisa review pola yang
    // mencurigakan di laporan Void.
    requireRole(session, ["owner", "kepala_toko", "kasir"]);
    const { id } = await params;
    const tx = await db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.id, id))
      .get();
    if (!tx) notFound("Transaction");
    // Cross-outlet guard: non-owner tidak boleh void transaksi outlet lain.
    if (
      session.domainUser.role !== "owner" &&
      session.domainUser.outlet_id &&
      tx.outlet_id !== session.domainUser.outlet_id
    ) {
      notFound("Transaction");
    }
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
      action: "void",
      entity: "transaction",
      entity_id: id,
      entity_name: `Transaksi #${id.slice(-6)}`,
      outlet_id: tx.outlet_id,
      notes: `Void: ${reason}`,
    });

    return { ok: true };
  });
}
