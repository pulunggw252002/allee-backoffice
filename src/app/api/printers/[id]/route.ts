import { and, eq, ne } from "drizzle-orm";
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
import { diffChanges, logAudit } from "@/server/api/audit";
import { firePosSync } from "@/lib/webhooks/pos-sync";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    await requireSession();
    const { id } = await params;
    const row = await db
      .select()
      .from(schema.printers)
      .where(eq(schema.printers.id, id))
      .get();
    if (!row) notFound("Printer");
    return row;
  });
}

const Update = z
  .object({
    code: z.string().min(1).max(40),
    name: z.string().min(1).max(80),
    type: z.enum(["cashier", "kitchen", "bar", "label"]),
    connection: z.enum(["usb", "bluetooth", "network", "other"]),
    address: z.string().max(120).nullable(),
    paper_width: z.number().int().min(20).max(80),
    note: z.string().max(200).nullable(),
    is_active: z.boolean(),
  })
  .partial();

export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    requireRole(session, ["owner"]);
    const { id } = await params;
    const before = await db
      .select()
      .from(schema.printers)
      .where(eq(schema.printers.id, id))
      .get();
    if (!before) notFound("Printer");
    const input = await readJson(req, Update);

    if (input.code && input.code !== before.code) {
      const dup = await db
        .select()
        .from(schema.printers)
        .where(
          and(
            eq(schema.printers.outlet_id, before.outlet_id),
            eq(schema.printers.code, input.code),
            ne(schema.printers.id, id),
          ),
        )
        .get();
      if (dup) badRequest(`Kode "${input.code}" sudah dipakai di outlet ini`);
    }

    await db
      .update(schema.printers)
      .set({ ...input, updated_at: nowIso() })
      .where(eq(schema.printers.id, id));
    const after = await db
      .select()
      .from(schema.printers)
      .where(eq(schema.printers.id, id))
      .get();
    await logAudit(session, {
      action: "update",
      entity: "printer",
      entity_id: id,
      entity_name: `${after!.code} · ${after!.name}`,
      changes: diffChanges(
        before as unknown as Record<string, unknown>,
        after as unknown as Record<string, unknown>,
      ),
    });
    await firePosSync({
      entity: "printer",
      event: "updated",
      entity_id: id,
      outlet_id: after!.outlet_id,
    });
    return after;
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    requireRole(session, ["owner"]);
    const { id } = await params;
    const row = await db
      .select()
      .from(schema.printers)
      .where(eq(schema.printers.id, id))
      .get();
    if (!row) notFound("Printer");
    await db.delete(schema.printers).where(eq(schema.printers.id, id));
    await logAudit(session, {
      action: "delete",
      entity: "printer",
      entity_id: id,
      entity_name: `${row.code} · ${row.name}`,
    });
    await firePosSync({
      entity: "printer",
      event: "deleted",
      entity_id: id,
      outlet_id: row.outlet_id,
    });
    return { ok: true };
  });
}
