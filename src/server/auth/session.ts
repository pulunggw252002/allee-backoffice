/**
 * Server-side session helpers used by every API route handler.
 *
 * - `getServerSession()` returns the Better Auth session + the linked domain
 *   user (role + outlet). Returns `null` when unauthenticated or when the
 *   auth user is orphaned (not linked to a domain user).
 * - `requireSession()` wraps a handler, returning a 401 Response if there
 *   is no session.
 * - `requireRole()` enforces RBAC matrix — matches `src/lib/rbac.ts` on the
 *   frontend.
 */

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "./index";
import { db, schema } from "@/server/db/client";
import { HttpError } from "@/server/api/helpers";
import type { Role } from "@/types";

export interface ServerSession {
  authUserId: string;
  authEmail: string;
  domainUser: {
    id: string;
    name: string;
    role: Role;
    outlet_id: string | null;
    is_active: boolean;
  };
}

export async function getServerSession(): Promise<ServerSession | null> {
  const hdrs = await headers();
  const res = await auth.api.getSession({ headers: hdrs });
  if (!res?.user) return null;

  const authUserId = res.user.id;
  const authEmail = res.user.email;

  // Look up domain user via the link column. We keep the Better Auth row
  // lean and store role/outlet only in the domain table, so we always trust
  // the domain row for authorization.
  const authRow = await db
    .select({ domain_user_id: schema.user_auth.domain_user_id })
    .from(schema.user_auth)
    .where(eq(schema.user_auth.id, authUserId))
    .get();

  if (!authRow?.domain_user_id) return null;

  const domain = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, authRow.domain_user_id))
    .get();

  if (!domain || !domain.is_active) return null;

  return {
    authUserId,
    authEmail,
    domainUser: {
      id: domain.id,
      name: domain.name,
      role: domain.role as Role,
      outlet_id: domain.outlet_id,
      is_active: domain.is_active,
    },
  };
}

/**
 * Throws `HttpError(401)` if unauthenticated. Catch automatically by the
 * `handle()` wrapper — so routes read as: `const session = await requireSession();`
 */
export async function requireSession(): Promise<ServerSession> {
  const session = await getServerSession();
  if (!session) throw new HttpError(401, "Unauthorized");
  return session;
}

export function requireRole(session: ServerSession, roles: Role[]): void {
  if (!roles.includes(session.domainUser.role)) {
    throw new HttpError(403, "Forbidden");
  }
}

/**
 * Kepala Toko can only read/mutate data in their own outlet. Owner can see
 * all outlets. This helper clamps a requested outlet filter to the caller's
 * accessible scope — returns the effective outlet_id or `null` for all.
 */
export function scopedOutletId(
  session: ServerSession,
  requested: string | null | undefined,
): string | null {
  if (session.domainUser.role === "owner") return requested ?? null;
  // Non-owner: pinned to their assigned outlet regardless of `requested`.
  return session.domainUser.outlet_id;
}
