import { appendAudit, diffChanges, getDb, mutate } from "@/lib/mock/db";
import { uid } from "@/lib/utils";
import { config } from "@/lib/config";
import type { Menu, MenuAddonGroup, RecipeItem } from "@/types";
import { delay } from "./_latency";
import { http } from "./http";
import { qs } from "./_qs";

export interface MenuWithRelations extends Menu {
  recipes: RecipeItem[];
  addon_group_ids: string[];
}

export async function list(params?: {
  outlet_id?: string | null;
}): Promise<MenuWithRelations[]> {
  if (config.api.useRealBackend) {
    return http.get<MenuWithRelations[]>(
      `/api/menus${qs({ outlet_id: params?.outlet_id })}`,
    );
  }
  const db = getDb();
  const result = db.menus
    .filter((m) =>
      !params?.outlet_id ? true : m.outlet_ids.includes(params.outlet_id),
    )
    .map((m) => ({
      ...m,
      recipes: db.recipes.filter((r) => r.menu_id === m.id),
      addon_group_ids: db.menu_addon_groups
        .filter((x) => x.menu_id === m.id)
        .map((x) => x.addon_group_id),
    }));
  return delay(result);
}

export async function get(id: string): Promise<MenuWithRelations | undefined> {
  if (config.api.useRealBackend) {
    return http.get<MenuWithRelations>(`/api/menus/${id}`);
  }
  const db = getDb();
  const m = db.menus.find((x) => x.id === id);
  if (!m) return delay(undefined);
  return delay({
    ...m,
    recipes: db.recipes.filter((r) => r.menu_id === m.id),
    addon_group_ids: db.menu_addon_groups
      .filter((x) => x.menu_id === m.id)
      .map((x) => x.addon_group_id),
  });
}

export type MenuInput = Omit<Menu, "id" | "hpp_cached" | "type"> & {
  recipes: Array<{ ingredient_id: string; quantity: number; notes?: string }>;
  addon_group_ids: string[];
};

export async function create(input: MenuInput): Promise<Menu> {
  if (config.api.useRealBackend) {
    return http.post<Menu>("/api/menus", {
      category_id: input.category_id,
      name: input.name,
      sku: input.sku,
      price: input.price,
      photo_url: input.photo_url,
      description: input.description,
      is_active: input.is_active,
      outlet_ids: input.outlet_ids,
      recipe: input.recipes,
      addon_group_ids: input.addon_group_ids,
    });
  }
  return delay(
    mutate((db) => {
      const menu: Menu = {
        id: uid("mn"),
        category_id: input.category_id,
        name: input.name,
        sku: input.sku,
        price: input.price,
        hpp_cached: 0,
        photo_url: input.photo_url,
        description: input.description,
        type: "regular",
        is_active: input.is_active,
        outlet_ids: input.outlet_ids,
      };
      db.menus.push(menu);
      for (const r of input.recipes) {
        db.recipes.push({
          id: uid("rcp"),
          menu_id: menu.id,
          ingredient_id: r.ingredient_id,
          quantity: r.quantity,
          notes: r.notes?.trim() || undefined,
        });
      }
      for (const ag of input.addon_group_ids) {
        db.menu_addon_groups.push({ menu_id: menu.id, addon_group_id: ag });
      }
      appendAudit(db, {
        action: "create",
        entity: "menu",
        entity_id: menu.id,
        entity_name: menu.name,
        outlet_id: menu.outlet_ids[0] ?? null,
      });
      return menu;
    }),
  );
}

export async function update(id: string, input: MenuInput) {
  if (config.api.useRealBackend) {
    return http.patch<Menu>(`/api/menus/${id}`, {
      category_id: input.category_id,
      name: input.name,
      sku: input.sku,
      price: input.price,
      photo_url: input.photo_url,
      description: input.description,
      is_active: input.is_active,
      outlet_ids: input.outlet_ids,
      recipe: input.recipes,
      addon_group_ids: input.addon_group_ids,
    });
  }
  return delay(
    mutate((db) => {
      const menu = db.menus.find((m) => m.id === id);
      if (!menu) throw new Error("Menu tidak ditemukan");
      const beforeCore = { ...menu };
      const beforeRecipeIds = db.recipes
        .filter((r) => r.menu_id === id)
        .map((r) => `${r.ingredient_id}:${r.quantity}:${r.notes ?? ""}`)
        .sort();
      const beforeAddonIds = db.menu_addon_groups
        .filter((x) => x.menu_id === id)
        .map((x) => x.addon_group_id)
        .sort();
      Object.assign(menu, {
        category_id: input.category_id,
        name: input.name,
        sku: input.sku,
        price: input.price,
        photo_url: input.photo_url,
        description: input.description,
        is_active: input.is_active,
        outlet_ids: input.outlet_ids,
      });
      db.recipes = db.recipes.filter((r) => r.menu_id !== id);
      for (const r of input.recipes) {
        db.recipes.push({
          id: uid("rcp"),
          menu_id: id,
          ingredient_id: r.ingredient_id,
          quantity: r.quantity,
          notes: r.notes?.trim() || undefined,
        });
      }
      db.menu_addon_groups = db.menu_addon_groups.filter(
        (x) => x.menu_id !== id,
      );
      for (const ag of input.addon_group_ids) {
        db.menu_addon_groups.push({ menu_id: id, addon_group_id: ag } as MenuAddonGroup);
      }
      const afterRecipeIds = input.recipes
        .map((r) => `${r.ingredient_id}:${r.quantity}:${r.notes?.trim() ?? ""}`)
        .sort();
      const afterAddonIds = [...input.addon_group_ids].sort();
      const changes = diffChanges(
        beforeCore as unknown as Record<string, unknown>,
        menu as unknown as Record<string, unknown>,
      );
      if (JSON.stringify(beforeRecipeIds) !== JSON.stringify(afterRecipeIds)) {
        changes.push({
          field: "recipes",
          before: beforeRecipeIds,
          after: afterRecipeIds,
        });
      }
      if (JSON.stringify(beforeAddonIds) !== JSON.stringify(afterAddonIds)) {
        changes.push({
          field: "addon_groups",
          before: beforeAddonIds,
          after: afterAddonIds,
        });
      }
      appendAudit(db, {
        action: "update",
        entity: "menu",
        entity_id: menu.id,
        entity_name: menu.name,
        outlet_id: menu.outlet_ids[0] ?? null,
        changes,
      });
      return menu;
    }),
  );
}

export async function remove(id: string) {
  if (config.api.useRealBackend) {
    await http.del<{ ok: true }>(`/api/menus/${id}`);
    return;
  }
  return delay(
    mutate((db) => {
      const menu = db.menus.find((m) => m.id === id);
      if (!menu) throw new Error("Menu tidak ditemukan");
      menu.is_active = false;
      appendAudit(db, {
        action: "delete",
        entity: "menu",
        entity_id: menu.id,
        entity_name: menu.name,
        outlet_id: menu.outlet_ids[0] ?? null,
        notes: "Menu dinonaktifkan",
      });
    }),
  );
}
