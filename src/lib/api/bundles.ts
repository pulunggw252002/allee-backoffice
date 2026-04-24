import {
  appendAudit,
  calcBundleHpp,
  diffChanges,
  getDb,
  mutate,
} from "@/lib/mock/db";
import { uid } from "@/lib/utils";
import { config } from "@/lib/config";
import type { Bundle, BundleItem } from "@/types";
import { delay } from "./_latency";
import { http } from "./http";

export interface BundleWithItems extends Bundle {
  items: BundleItem[];
  hpp: number;
}

export async function list(): Promise<BundleWithItems[]> {
  if (config.api.useRealBackend) {
    return http.get<BundleWithItems[]>("/api/bundles");
  }
  const db = getDb();
  return delay(
    db.bundles.map((b) => ({
      ...b,
      items: db.bundle_items.filter((bi) => bi.bundle_id === b.id),
      hpp: calcBundleHpp(b, db.bundle_items, db.menus),
    })),
  );
}

export type BundleInput = Omit<Bundle, "id"> & {
  items: Array<{ menu_id: string; quantity: number }>;
};

export async function create(input: BundleInput) {
  if (config.api.useRealBackend) {
    return http.post<Bundle>("/api/bundles", input);
  }
  return delay(
    mutate((db) => {
      const bundle: Bundle = {
        id: uid("bn"),
        name: input.name,
        price: input.price,
        is_active: input.is_active,
        photo_url: input.photo_url,
        description: input.description,
        outlet_ids: input.outlet_ids,
      };
      db.bundles.push(bundle);
      for (const it of input.items) {
        db.bundle_items.push({ bundle_id: bundle.id, menu_id: it.menu_id, quantity: it.quantity });
      }
      appendAudit(db, {
        action: "create",
        entity: "bundle",
        entity_id: bundle.id,
        entity_name: bundle.name,
        outlet_id: bundle.outlet_ids[0] ?? null,
      });
      return bundle;
    }),
  );
}

export async function update(id: string, input: BundleInput) {
  if (config.api.useRealBackend) {
    return http.patch<Bundle>(`/api/bundles/${id}`, input);
  }
  return delay(
    mutate((db) => {
      const bundle = db.bundles.find((b) => b.id === id);
      if (!bundle) throw new Error("Bundle tidak ditemukan");
      const beforeCore = { ...bundle };
      const beforeItems = db.bundle_items
        .filter((bi) => bi.bundle_id === id)
        .map((bi) => `${bi.menu_id}:${bi.quantity}`)
        .sort();
      Object.assign(bundle, {
        name: input.name,
        price: input.price,
        is_active: input.is_active,
        photo_url: input.photo_url,
        description: input.description,
        outlet_ids: input.outlet_ids,
      });
      db.bundle_items = db.bundle_items.filter((bi) => bi.bundle_id !== id);
      for (const it of input.items) {
        db.bundle_items.push({ bundle_id: id, menu_id: it.menu_id, quantity: it.quantity });
      }
      const afterItems = input.items
        .map((it) => `${it.menu_id}:${it.quantity}`)
        .sort();
      const changes = diffChanges(
        beforeCore as unknown as Record<string, unknown>,
        bundle as unknown as Record<string, unknown>,
      );
      if (JSON.stringify(beforeItems) !== JSON.stringify(afterItems)) {
        changes.push({ field: "items", before: beforeItems, after: afterItems });
      }
      appendAudit(db, {
        action: "update",
        entity: "bundle",
        entity_id: bundle.id,
        entity_name: bundle.name,
        outlet_id: bundle.outlet_ids[0] ?? null,
        changes,
      });
      return bundle;
    }),
  );
}

export async function remove(id: string) {
  if (config.api.useRealBackend) {
    await http.del<{ ok: true }>(`/api/bundles/${id}`);
    return;
  }
  return delay(
    mutate((db) => {
      const bundle = db.bundles.find((b) => b.id === id);
      if (!bundle) throw new Error("Bundle tidak ditemukan");
      bundle.is_active = false;
      appendAudit(db, {
        action: "delete",
        entity: "bundle",
        entity_id: bundle.id,
        entity_name: bundle.name,
        outlet_id: bundle.outlet_ids[0] ?? null,
        notes: "Bundle dinonaktifkan",
      });
    }),
  );
}
