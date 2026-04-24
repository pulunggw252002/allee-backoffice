import { appendAudit, diffChanges, getDb, mutate } from "@/lib/mock/db";
import { uid } from "@/lib/utils";
import { config } from "@/lib/config";
import type { MenuCategory } from "@/types";
import { delay } from "./_latency";
import { http } from "./http";

export async function list(): Promise<MenuCategory[]> {
  if (config.api.useRealBackend) {
    return http.get<MenuCategory[]>("/api/categories");
  }
  return delay(
    [...getDb().categories].sort((a, b) => a.sort_order - b.sort_order),
  );
}

export async function create(name: string) {
  if (config.api.useRealBackend) {
    return http.post<MenuCategory>("/api/categories", { name });
  }
  return delay(
    mutate((db) => {
      const cat: MenuCategory = {
        id: uid("cat"),
        name,
        sort_order: db.categories.length + 1,
      };
      db.categories.push(cat);
      appendAudit(db, {
        action: "create",
        entity: "category",
        entity_id: cat.id,
        entity_name: cat.name,
      });
      return cat;
    }),
  );
}

export type CategoryUpdateInput = Partial<Pick<MenuCategory, "name" | "sort_order">>;

/**
 * Parity with the real `PATCH /api/categories/:id` route — rename or reorder
 * an existing category. Mock throws a plain Error when the id is missing so
 * TanStack Query `onError` handlers fire the same way as an API 404 body.
 */
export async function update(
  id: string,
  input: CategoryUpdateInput,
): Promise<MenuCategory> {
  if (config.api.useRealBackend) {
    return http.patch<MenuCategory>(`/api/categories/${id}`, input);
  }
  return delay(
    mutate((db) => {
      const cat = db.categories.find((c) => c.id === id);
      if (!cat) throw new Error("Category tidak ditemukan");
      const before = { ...cat };
      Object.assign(cat, input);
      appendAudit(db, {
        action: "update",
        entity: "category",
        entity_id: cat.id,
        entity_name: cat.name,
        changes: diffChanges(
          before as unknown as Record<string, unknown>,
          cat as unknown as Record<string, unknown>,
        ),
      });
      return cat;
    }),
  );
}

/**
 * Parity with `DELETE /api/categories/:id`. The FK on `menus.category_id`
 * is `ON DELETE RESTRICT`, so the real backend refuses the delete when a
 * menu still references the category. Mirror that check here so UIs see
 * the same error in both modes.
 */
export async function remove(id: string): Promise<void> {
  if (config.api.useRealBackend) {
    await http.del<{ ok: true }>(`/api/categories/${id}`);
    return;
  }
  await delay(
    mutate((db) => {
      const idx = db.categories.findIndex((c) => c.id === id);
      if (idx < 0) throw new Error("Category tidak ditemukan");
      if (db.menus.some((m) => m.category_id === id)) {
        throw new Error(
          "Kategori masih dipakai menu aktif — pindahkan menu dulu",
        );
      }
      const [cat] = db.categories.splice(idx, 1);
      appendAudit(db, {
        action: "delete",
        entity: "category",
        entity_id: cat.id,
        entity_name: cat.name,
      });
    }),
  );
}
