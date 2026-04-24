import { appendAudit, diffChanges, getDb, mutate } from "@/lib/mock/db";
import { uid } from "@/lib/utils";
import { config } from "@/lib/config";
import type { Discount } from "@/types";
import { delay } from "./_latency";
import { http } from "./http";

export async function list(): Promise<Discount[]> {
  if (config.api.useRealBackend) {
    return http.get<Discount[]>("/api/discounts");
  }
  return delay([...getDb().discounts]);
}

export type DiscountInput = Omit<Discount, "id">;

export async function create(input: DiscountInput) {
  if (config.api.useRealBackend) {
    return http.post<Discount>("/api/discounts", input);
  }
  return delay(
    mutate((db) => {
      const dsc: Discount = { ...input, id: uid("dsc") };
      db.discounts.push(dsc);
      appendAudit(db, {
        action: "create",
        entity: "discount",
        entity_id: dsc.id,
        entity_name: dsc.name,
      });
      return dsc;
    }),
  );
}

export async function update(id: string, input: Partial<DiscountInput>) {
  if (config.api.useRealBackend) {
    return http.patch<Discount>(`/api/discounts/${id}`, input);
  }
  return delay(
    mutate((db) => {
      const dsc = db.discounts.find((d) => d.id === id);
      if (!dsc) throw new Error("Diskon tidak ditemukan");
      const before = { ...dsc };
      Object.assign(dsc, input);
      appendAudit(db, {
        action: "update",
        entity: "discount",
        entity_id: dsc.id,
        entity_name: dsc.name,
        changes: diffChanges(
          before as unknown as Record<string, unknown>,
          dsc as unknown as Record<string, unknown>,
        ),
      });
      return dsc;
    }),
  );
}

export async function remove(id: string) {
  if (config.api.useRealBackend) {
    await http.del<{ ok: true }>(`/api/discounts/${id}`);
    return;
  }
  return delay(
    mutate((db) => {
      const dsc = db.discounts.find((d) => d.id === id);
      if (!dsc) throw new Error("Diskon tidak ditemukan");
      dsc.is_active = false;
      appendAudit(db, {
        action: "delete",
        entity: "discount",
        entity_id: dsc.id,
        entity_name: dsc.name,
        notes: "Diskon dinonaktifkan",
      });
    }),
  );
}
