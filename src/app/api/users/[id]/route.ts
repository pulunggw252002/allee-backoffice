/**
 * GET    /api/users/:id  — read single user
 * PATCH  /api/users/:id  — update user + optionally rotate password (owner)
 * DELETE /api/users/:id  — soft-deactivate (owner)
 */
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db/client";
import { auth } from "@/server/auth";
import { requireRole, requireSession } from "@/server/auth/session";
import { handle, notFound, readJson } from "@/server/api/helpers";
import { diffChanges, logAudit } from "@/server/api/audit";
import { maskPin } from "@/server/api/user-utils";

type Ctx = { params: Promise<{ id: string }> };

const ROLE_VALUES = [
  "owner",
  "kepala_toko",
  "kasir",
  "kitchen",
  "barista",
  "waiters",
] as const;

export async function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    await requireSession();
    const { id } = await params;
    const row = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .get();
    if (!row) notFound("User");
    return maskPin(row);
  });
}

const UpdateInput = z
  .object({
    name: z.string().min(1),
    password: z.string().min(4),
    role: z.enum(ROLE_VALUES),
    outlet_id: z.string().nullable(),
    contact: z.string().nullable(),
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
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .get();
    if (!before) notFound("User");
    const input = await readJson(req, UpdateInput);
    const { password, ...profile } = input;

    if (Object.keys(profile).length > 0) {
      await db.update(schema.users).set(profile).where(eq(schema.users.id, id));
    }

    if (password) {
      const ctx = await auth.$context;
      const hashed = await ctx.password.hash(password);
      // Find the linked auth id and its credential account, then update.
      const authRow = await db
        .select()
        .from(schema.user_auth)
        .where(eq(schema.user_auth.domain_user_id, id))
        .get();
      if (authRow) {
        await db
          .update(schema.account)
          .set({ password: hashed, updatedAt: new Date() })
          .where(eq(schema.account.userId, authRow.id));
      }
    }

    const after = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .get();
    await logAudit(session, {
      action: "update",
      entity: "user",
      entity_id: id,
      entity_name: after!.name,
      outlet_id: after!.outlet_id,
      changes: diffChanges(
        before as unknown as Record<string, unknown>,
        after as unknown as Record<string, unknown>,
      ),
      notes: password ? "Password diperbarui" : undefined,
    });
    return maskPin(after!);
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    requireRole(session, ["owner"]);
    const { id } = await params;
    const row = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .get();
    if (!row) notFound("User");
    await db
      .update(schema.users)
      .set({ is_active: false })
      .where(eq(schema.users.id, id));
    await logAudit(session, {
      action: "delete",
      entity: "user",
      entity_id: id,
      entity_name: row.name,
      outlet_id: row.outlet_id,
      notes: "User dinonaktifkan",
    });
    return { ok: true };
  });
}
