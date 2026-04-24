import { getDb } from "@/lib/mock/db";
import { config } from "@/lib/config";
import type { AuditAction, AuditEntity, AuditLog } from "@/types";
import { delay } from "./_latency";
import { http } from "./http";
import { qs } from "./_qs";

export interface AuditFilters {
  entity?: AuditEntity | null;
  action?: AuditAction | null;
  user_id?: string | null;
  outlet_id?: string | null;
  search?: string;
  start?: string;
  end?: string;
}

export async function list(filters: AuditFilters = {}): Promise<AuditLog[]> {
  if (config.api.useRealBackend) {
    return http.get<AuditLog[]>(`/api/audit${qs(filters)}`);
  }
  const db = getDb();
  const search = filters.search?.trim().toLowerCase();
  const startMs = filters.start ? new Date(filters.start).getTime() : null;
  const endMs = filters.end ? new Date(filters.end).getTime() : null;
  const items = db.audit_logs.filter((log) => {
    if (filters.entity && log.entity !== filters.entity) return false;
    if (filters.action && log.action !== filters.action) return false;
    if (filters.user_id && log.user_id !== filters.user_id) return false;
    if (
      filters.outlet_id &&
      log.outlet_id &&
      log.outlet_id !== filters.outlet_id
    ) {
      return false;
    }
    if (startMs !== null || endMs !== null) {
      const t = new Date(log.created_at).getTime();
      if (startMs !== null && t < startMs) return false;
      if (endMs !== null && t > endMs) return false;
    }
    if (search) {
      const haystack = `${log.user_name} ${log.entity_name} ${log.notes ?? ""}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
  items.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  return delay(items);
}
