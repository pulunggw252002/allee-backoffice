/**
 * Server-side audit log helper — mirrors `appendAudit` from the mock layer
 * so the audit feed stays consistent whether the mock or real backend is in
 * use. Computes a per-field diff (`changes: AuditChange[]`) only for fields
 * that actually changed, keeping the log compact.
 */

import { db, schema } from "@/server/db/client";
import type { ServerSession } from "@/server/auth/session";
import type { AuditAction, AuditChange, AuditEntity } from "@/types";
import { genId, nowIso } from "./helpers";

export async function logAudit(
  session: ServerSession,
  params: {
    action: AuditAction;
    entity: AuditEntity;
    entity_id: string;
    entity_name: string;
    outlet_id?: string | null;
    changes?: AuditChange[];
    notes?: string;
  },
): Promise<void> {
  await db.insert(schema.audit_logs).values({
    id: genId("aud"),
    user_id: session.domainUser.id,
    user_name: session.domainUser.name,
    user_role: session.domainUser.role,
    action: params.action,
    entity: params.entity,
    entity_id: params.entity_id,
    entity_name: params.entity_name,
    outlet_id: params.outlet_id ?? null,
    changes: params.changes ?? [],
    notes: params.notes,
    created_at: nowIso(),
  });
}

/**
 * Compute an `AuditChange[]` array from before/after objects, including only
 * keys whose serialized value differs. Skips internal keys `id` / `created_at`.
 */
export function diffChanges<T extends Record<string, unknown>>(
  before: T,
  after: T,
  skip: string[] = ["id", "created_at", "updated_at"],
): AuditChange[] {
  const keys = new Set<string>([...Object.keys(before), ...Object.keys(after)]);
  const out: AuditChange[] = [];
  for (const k of keys) {
    if (skip.includes(k)) continue;
    const bv = before[k];
    const av = after[k];
    if (JSON.stringify(bv) !== JSON.stringify(av)) {
      out.push({ field: k, before: bv, after: av });
    }
  }
  return out;
}
