/**
 * GET  /api/outlets   — list all outlets (owner + kepala_toko)
 * POST /api/outlets   — create outlet (owner only)
 */
import { z } from "zod";
import { db, schema } from "@/server/db/client";
import { requireRole, requireSession } from "@/server/auth/session";
import { genId, handle, nowIso, readJson } from "@/server/api/helpers";
import { logAudit } from "@/server/api/audit";
import { firePosSync } from "@/lib/webhooks/pos-sync";

export async function GET() {
  return handle(async () => {
    await requireSession();
    return db.select().from(schema.outlets).all();
  });
}

/**
 * Receipt-footer disimpan sebagai JSON array of strings di kolom TEXT
 * (`receipt_footer`). Schema mendukung dua input shape:
 *   - array string  → di-stringify lalu disimpan
 *   - string        → di-split per newline, di-trim, baru di-stringify
 * Cara ini bikin UI bebas pakai textarea biasa tanpa harus split/join sendiri.
 */
const ReceiptFooterInput = z.union([z.array(z.string()), z.string()]).optional();

function normalizeReceiptFooter(input: unknown): string | null | undefined {
  if (input === undefined) return undefined; // tidak diubah
  if (input === null || input === "") return null;
  const arr = Array.isArray(input)
    ? input
    : String(input).split("\n");
  const cleaned = arr.map((s) => s.trim()).filter(Boolean);
  return cleaned.length === 0 ? null : JSON.stringify(cleaned);
}

const CreateInput = z.object({
  name: z.string().min(1),
  address: z.string().default(""),
  city: z.string().default(""),
  phone: z.string().default(""),
  opening_hours: z.string().default(""),
  is_active: z.boolean().default(true),
  brand_name: z.string().nullish(),
  brand_subtitle: z.string().nullish(),
  receipt_footer: ReceiptFooterInput,
  tax_id: z.string().nullish(),
});

export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    requireRole(session, ["owner"]);

    const input = await readJson(req, CreateInput);
    const { receipt_footer, ...rest } = input;
    const outlet = {
      id: genId("out"),
      ...rest,
      receipt_footer: normalizeReceiptFooter(receipt_footer) ?? null,
      created_at: nowIso(),
    };
    await db.insert(schema.outlets).values(outlet);
    await logAudit(session, {
      action: "create",
      entity: "outlet",
      entity_id: outlet.id,
      entity_name: outlet.name,
      outlet_id: outlet.id,
    });
    await firePosSync({
      entity: "outlet",
      event: "created",
      entity_id: outlet.id,
      outlet_id: outlet.id,
    });
    return outlet;
  });
}
