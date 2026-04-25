/**
 * GET    /api/users/:id  — read single user
 * PATCH  /api/users/:id  — update user + optionally rotate password (owner)
 * DELETE /api/users/:id  — soft-deactivate (owner)
 */
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db/client";
import { auth } from "@/server/auth";
import { requireRole, requireSession } from "@/server/auth/session";
import { badRequest, handle, notFound, readJson } from "@/server/api/helpers";
import { diffChanges, logAudit } from "@/server/api/audit";
import { maskPin } from "@/server/api/user-utils";
import { firePosSync } from "@/lib/webhooks/pos-sync";
import { emailFromName } from "@/lib/auth-email";

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

    // Locate the linked auth identity once — used for password updates AND
    // for cascading the `name` change down to `user_auth.email/name` so
    // login (which derives the email from the new name) keeps working.
    const authRow = await db
      .select()
      .from(schema.user_auth)
      .where(eq(schema.user_auth.domain_user_id, id))
      .get();

    if (
      profile.name !== undefined &&
      profile.name !== before.name &&
      authRow
    ) {
      const nextEmail = emailFromName(profile.name);
      // Reject if another user already uses the new email — SQLite has a
      // UNIQUE on `user_auth.email`, but a friendly 400 is nicer than a 500.
      const collision = await db
        .select()
        .from(schema.user_auth)
        .where(
          and(
            eq(schema.user_auth.email, nextEmail),
            ne(schema.user_auth.id, authRow.id),
          ),
        )
        .get();
      if (collision) {
        badRequest(
          `Nama "${profile.name}" sudah dipakai user lain. Pilih nama yang berbeda.`,
        );
      }
      await db
        .update(schema.user_auth)
        .set({
          name: profile.name,
          email: nextEmail,
          updatedAt: new Date(),
        })
        .where(eq(schema.user_auth.id, authRow.id));
    }

    if (Object.keys(profile).length > 0) {
      await db.update(schema.users).set(profile).where(eq(schema.users.id, id));
    }

    if (password) {
      const ctx = await auth.$context;
      const hashed = await ctx.password.hash(password);
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
    await firePosSync({
      entity: "user",
      event: "updated",
      entity_id: id,
      outlet_id: after!.outlet_id ?? undefined,
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
    await firePosSync({
      entity: "user",
      event: "deleted",
      entity_id: id,
      outlet_id: row.outlet_id ?? undefined,
    });
    return { ok: true };
  });
}
