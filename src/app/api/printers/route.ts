/**
 * GET  /api/printers  — list printers (filter by outlet via ?outlet_id=)
 * POST /api/printers  — create printer (Owner only)
 *
 * Master-data printer per outlet. POS pull via sync (sama pola kayak menu/
 * kategori) — perubahan di sini langsung trigger `firePosSync` supaya kasir
 * lihat update tanpa harus tekan tombol sync manual.
 */
import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { requireRole, requireSession } from "@/server/auth/session";
import {
  badRequest,
  genId,
  handle,
  nowIso,
  readJson,
} from "@/server/api/helpers";
import { logAudit } from "@/server/api/audit";
import { firePosSync } from "@/lib/webhooks/pos-sync";

export async function GET(req: Request) {
  return handle(async () => {
    await requireSession();
    const url = new URL(req.url);
    const outletId = url.searchParams.get("outlet_id");
    const where = outletId ? eq(schema.printers.outlet_id, outletId) : undefined;
    const q = db.select().from(schema.printers);
    const rows = where
      ? await q.where(where).orderBy(asc(schema.printers.code)).all()
      : await q.orderBy(asc(schema.printers.code)).all();
    return rows;
  });
}

const Input = z.object({
  outlet_id: z.string().min(1),
  code: z.string().min(1).max(40),
  name: z.string().min(1).max(80),
  type: z.enum(["cashier", "kitchen", "bar", "label"]).default("cashier"),
  connection: z.enum(["usb", "bluetooth", "network", "other"]).default("usb"),
  address: z.string().max(120).nullable().optional(),
  paper_width: z.number().int().min(20).max(80).default(32),
  note: z.string().max(200).nullable().optional(),
  is_active: z.boolean().default(true),
});

export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    requireRole(session, ["owner"]);
    const input = await readJson(req, Input);

    // Code unik per outlet — supaya kasir bisa scan/cari cepat tanpa salah
    // pilih printer dari outlet lain (relevan kalau owner bawa device antar
    // outlet).
    const existing = await db
      .select()
      .from(schema.printers)
      .where(
        and(
          eq(schema.printers.outlet_id, input.outlet_id),
          eq(schema.printers.code, input.code),
        ),
      )
      .get();
    if (existing) {
      badRequest(`Kode "${input.code}" sudah dipakai di outlet ini`);
    }

    const now = nowIso();
    const row = {
      id: genId("prn"),
      outlet_id: input.outlet_id,
      code: input.code,
      name: input.name,
      type: input.type,
      connection: input.connection,
      address: input.address ?? null,
      paper_width: input.paper_width,
      note: input.note ?? null,
      is_active: input.is_active,
      created_at: now,
      updated_at: now,
    };
    await db.insert(schema.printers).values(row);
    await logAudit(session, {
      action: "create",
      entity: "printer",
      entity_id: row.id,
      entity_name: `${row.code} · ${row.name}`,
    });
    await firePosSync({
      entity: "printer",
      event: "created",
      entity_id: row.id,
      outlet_id: row.outlet_id,
    });
    return row;
  });
}
