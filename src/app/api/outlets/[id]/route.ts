/**
 * GET    /api/outlets/:id  — read single outlet
 * PATCH  /api/outlets/:id  — update outlet (owner only)
 * DELETE /api/outlets/:id  — soft-delete = flip is_active=false (owner only)
 */
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db/client";
import { requireRole, requireSession } from "@/server/auth/session";
import {
  handle,
  notFound,
  readJson,
} from "@/server/api/helpers";
import { diffChanges, logAudit } from "@/server/api/audit";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    await requireSession();
    const { id } = await params;
    const row = await db
      .select()
      .from(schema.outlets)
      .where(eq(schema.outlets.id, id))
      .get();
    if (!row) notFound("Outlet");
    return row;
  });
}

const UpdateInput = z
  .object({
    name: z.string().min(1),
    address: z.string(),
    city: z.string(),
    phone: z.string(),
    opening_hours: z.string(),
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
      .from(schema.outlets)
      .where(eq(schema.outlets.id, id))
      .get();
    if (!before) notFound("Outlet");
    const input = await readJson(req, UpdateInput);
    await db
      .update(schema.outlets)
      .set(input)
      .where(eq(schema.outlets.id, id));
    const after = await db
      .select()
      .from(schema.outlets)
      .where(eq(schema.outlets.id, id))
      .get();
    await logAudit(session, {
      action: "update",
      entity: "outlet",
      entity_id: id,
      entity_name: after!.name,
      outlet_id: id,
      changes: diffChanges(
        before as unknown as Record<string, unknown>,
        after as unknown as Record<string, unknown>,
      ),
    });
    return after;
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    requireRole(session, ["owner"]);
    const { id } = await params;
    const before = await db
      .select()
      .from(schema.outlets)
      .where(eq(schema.outlets.id, id))
      .get();
    if (!before) notFound("Outlet");
    await db
      .update(schema.outlets)
      .set({ is_active: false })
      .where(eq(schema.outlets.id, id));
    await logAudit(session, {
      action: "delete",
      entity: "outlet",
      entity_id: id,
      entity_name: before.name,
      outlet_id: id,
      notes: "Outlet dinonaktifkan",
    });
    return { ok: true };
  });
}
