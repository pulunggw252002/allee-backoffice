/**
 * PUT /api/users/:id/pos-pin — set or clear the POS-app PIN for a staff member
 *
 * Body: { pin: string | null }
 *   - `null` → clears the PIN (revokes POS access for this staff).
 *   - string → must match /^\d{4,6}$/; stored as a scrypt hash via Better
 *     Auth's password context (same hashing used for the backoffice
 *     password). The plain PIN never touches the DB.
 *
 * Owner-only.
 */
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db/client";
import { auth } from "@/server/auth";
import { requireRole, requireSession } from "@/server/auth/session";
import { handle, notFound, readJson } from "@/server/api/helpers";
import { logAudit } from "@/server/api/audit";
import { maskPin } from "@/server/api/user-utils";

type Ctx = { params: Promise<{ id: string }> };

const Input = z.object({
  pin: z
    .union([
      z.string().regex(/^\d{4,6}$/, "PIN harus 4-6 digit angka"),
      z.null(),
    ])
    .describe("Numeric PIN (4-6 digits) or null to clear"),
});

export async function PUT(req: Request, { params }: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    requireRole(session, ["owner"]);
    const { id } = await params;
    const { pin } = await readJson(req, Input);

    const user = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .get();
    if (!user) notFound("User");

    let hashed: string | null = null;
    if (pin !== null) {
      const ctx = await auth.$context;
      hashed = await ctx.password.hash(pin);
    }

    await db
      .update(schema.users)
      .set({ pos_pin_hash: hashed })
      .where(eq(schema.users.id, id));

    await logAudit(session, {
      action: "update",
      entity: "pos_pin",
      entity_id: user.id,
      entity_name: user.name,
      outlet_id: user.outlet_id,
      notes: pin === null ? "PIN POS dihapus" : "PIN POS diperbarui",
    });

    const after = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .get();
    // Match the shape returned by GET /api/users/[id] — `pos_pin_hash` is
    // stripped and replaced with a redacted `pos_pin` marker so the client's
    // `User` type stays uniform across every endpoint.
    return maskPin(after!);
  });
}
