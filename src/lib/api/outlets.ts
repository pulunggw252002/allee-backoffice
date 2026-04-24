import { appendAudit, diffChanges, getDb, mutate } from "@/lib/mock/db";
import { uid } from "@/lib/utils";
import { config } from "@/lib/config";
import type { Outlet } from "@/types";
import { delay } from "./_latency";
import { http } from "./http";

export async function list(): Promise<Outlet[]> {
  if (config.api.useRealBackend) {
    return http.get<Outlet[]>("/api/outlets");
  }
  return delay([...getDb().outlets]);
}

export async function get(id: string): Promise<Outlet | undefined> {
  if (config.api.useRealBackend) {
    return http.get<Outlet>(`/api/outlets/${id}`);
  }
  return delay(getDb().outlets.find((o) => o.id === id));
}

export type OutletInput = Omit<Outlet, "id" | "created_at">;

export async function create(input: OutletInput): Promise<Outlet> {
  if (config.api.useRealBackend) {
    return http.post<Outlet>("/api/outlets", input);
  }
  return delay(
    mutate((db) => {
      const outlet: Outlet = {
        ...input,
        id: uid("out"),
        created_at: new Date().toISOString(),
      };
      db.outlets.push(outlet);
      appendAudit(db, {
        action: "create",
        entity: "outlet",
        entity_id: outlet.id,
        entity_name: outlet.name,
        outlet_id: outlet.id,
      });
      return outlet;
    }),
  );
}

export async function update(id: string, input: Partial<OutletInput>) {
  if (config.api.useRealBackend) {
    return http.patch<Outlet>(`/api/outlets/${id}`, input);
  }
  return delay(
    mutate((db) => {
      const outlet = db.outlets.find((o) => o.id === id);
      if (!outlet) throw new Error("Outlet tidak ditemukan");
      const before = { ...outlet };
      Object.assign(outlet, input);
      appendAudit(db, {
        action: "update",
        entity: "outlet",
        entity_id: outlet.id,
        entity_name: outlet.name,
        outlet_id: outlet.id,
        changes: diffChanges(
          before as unknown as Record<string, unknown>,
          outlet as unknown as Record<string, unknown>,
        ),
      });
      return outlet;
    }),
  );
}

export async function remove(id: string) {
  if (config.api.useRealBackend) {
    await http.del<{ ok: true }>(`/api/outlets/${id}`);
    return;
  }
  return delay(
    mutate((db) => {
      const idx = db.outlets.findIndex((o) => o.id === id);
      if (idx === -1) throw new Error("Outlet tidak ditemukan");
      db.outlets[idx].is_active = false;
      appendAudit(db, {
        action: "delete",
        entity: "outlet",
        entity_id: db.outlets[idx].id,
        entity_name: db.outlets[idx].name,
        outlet_id: db.outlets[idx].id,
        notes: "Outlet dinonaktifkan",
      });
    }),
  );
}
