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

const CreateInput = z.object({
  name: z.string().min(1),
  address: z.string().default(""),
  city: z.string().default(""),
  phone: z.string().default(""),
  opening_hours: z.string().default(""),
  is_active: z.boolean().default(true),
});

export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    requireRole(session, ["owner"]);

    const input = await readJson(req, CreateInput);
    const outlet = { id: genId("out"), ...input, created_at: nowIso() };
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
