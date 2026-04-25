/**
 * GET  /api/users   — list staff (owner sees all; kepala_toko sees own outlet)
 * POST /api/users   — create staff + Better Auth identity (owner only)
 */
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db/client";
import { auth } from "@/server/auth";
import { requireRole, requireSession, scopedOutletId } from "@/server/auth/session";
import { genId, handle, nowIso, readJson } from "@/server/api/helpers";
import { logAudit } from "@/server/api/audit";
import { maskPin } from "@/server/api/user-utils";
import { firePosSync } from "@/lib/webhooks/pos-sync";

const ROLE_VALUES = [
  "owner",
  "kepala_toko",
  "kasir",
  "kitchen",
  "barista",
  "waiters",
] as const;

export async function GET() {
  return handle(async () => {
    const session = await requireSession();
    const outletFilter = scopedOutletId(session, null);
    const rows = await db.select().from(schema.users).all();
    const scoped = outletFilter
      ? rows.filter((u) => u.outlet_id === outletFilter)
      : rows;
    return scoped.map(maskPin);
  });
}

const CreateInput = z.object({
  name: z.string().min(1),
  password: z.string().min(4),
  role: z.enum(ROLE_VALUES),
  outlet_id: z.string().nullable().default(null),
  contact: z.string().optional(),
  is_active: z.boolean().default(true),
});

function slug(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    requireRole(session, ["owner"]);
    const input = await readJson(req, CreateInput);

    const userId = genId("usr");
    const email = `${slug(input.name)}-${userId.slice(-4)}@allee.local`;

    // Insert domain user first so the FK link on user_auth is valid.
    await db.insert(schema.users).values({
      id: userId,
      name: input.name,
      role: input.role,
      outlet_id: input.outlet_id,
      contact: input.contact ?? null,
      is_active: input.is_active,
      joined_at: nowIso(),
    });

    // Create auth identity via Better Auth internal API — bypasses
    // `disableSignUp` because we're on the server.
    const ctx = await auth.$context;
    const hashed = await ctx.password.hash(input.password);
    const authId = `au_${userId}`;
    const now = new Date();
    await db.insert(schema.user_auth).values({
      id: authId,
      name: input.name,
      email,
      emailVerified: true,
      image: null,
      createdAt: now,
      updatedAt: now,
      domain_user_id: userId,
    });
    await db.insert(schema.account).values({
      id: `ac_${userId}`,
      accountId: authId,
      providerId: "credential",
      userId: authId,
      password: hashed,
      createdAt: now,
      updatedAt: now,
    });

    await logAudit(session, {
      action: "create",
      entity: "user",
      entity_id: userId,
      entity_name: input.name,
      outlet_id: input.outlet_id,
    });

    const created = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .get();
    await firePosSync({
      entity: "user",
      event: "created",
      entity_id: userId,
      outlet_id: input.outlet_id ?? undefined,
    });
    return { ...maskPin(created!), email };
  });
}
