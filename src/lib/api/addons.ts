import { appendAudit, getDb, mutate } from "@/lib/mock/db";
import { uid } from "@/lib/utils";
import { config } from "@/lib/config";
import type {
  AddonGroup,
  AddonOption,
  AddonRecipeModifier,
} from "@/types";
import { delay } from "./_latency";
import { http } from "./http";

export interface AddonGroupWithDetails extends AddonGroup {
  options: Array<
    AddonOption & { modifiers: AddonRecipeModifier[] }
  >;
}

export async function listGroups(): Promise<AddonGroupWithDetails[]> {
  if (config.api.useRealBackend) {
    return http.get<AddonGroupWithDetails[]>("/api/addon-groups");
  }
  const db = getDb();
  return delay(
    db.addon_groups.map((g) => ({
      ...g,
      options: db.addon_options
        .filter((o) => o.addon_group_id === g.id)
        .map((o) => ({
          ...o,
          modifiers: db.addon_recipe_modifiers.filter(
            (m) => m.addon_option_id === o.id,
          ),
        })),
    })),
  );
}

export async function getGroup(id: string): Promise<AddonGroupWithDetails | undefined> {
  if (config.api.useRealBackend) {
    return http.get<AddonGroupWithDetails>(`/api/addon-groups/${id}`);
  }
  const groups = await listGroups();
  return groups.find((g) => g.id === id);
}

export type AddonGroupInput = {
  name: string;
  selection_type: "single" | "multi";
  is_required: boolean;
  options: Array<{
    id?: string;
    name: string;
    extra_price: number;
    modifiers: Array<{
      ingredient_id: string;
      quantity_delta: number;
      mode: "override" | "delta";
    }>;
  }>;
};

export async function createGroup(input: AddonGroupInput) {
  if (config.api.useRealBackend) {
    return http.post<AddonGroup>("/api/addon-groups", input);
  }
  return delay(
    mutate((db) => {
      const group: AddonGroup = {
        id: uid("ag"),
        name: input.name,
        selection_type: input.selection_type,
        is_required: input.is_required,
      };
      db.addon_groups.push(group);
      for (const opt of input.options) {
        const option: AddonOption = {
          id: uid("ao"),
          addon_group_id: group.id,
          name: opt.name,
          extra_price: opt.extra_price,
        };
        db.addon_options.push(option);
        for (const mod of opt.modifiers) {
          db.addon_recipe_modifiers.push({
            id: uid("arm"),
            addon_option_id: option.id,
            ingredient_id: mod.ingredient_id,
            quantity_delta: mod.quantity_delta,
            mode: mod.mode,
          });
        }
      }
      appendAudit(db, {
        action: "create",
        entity: "addon_group",
        entity_id: group.id,
        entity_name: group.name,
        notes: `${input.options.length} opsi`,
      });
      return group;
    }),
  );
}

export async function updateGroup(id: string, input: AddonGroupInput) {
  if (config.api.useRealBackend) {
    return http.patch<AddonGroup>(`/api/addon-groups/${id}`, input);
  }
  return delay(
    mutate((db) => {
      const group = db.addon_groups.find((g) => g.id === id);
      if (!group) throw new Error("Add-on group tidak ditemukan");
      const beforeGroup = { ...group };
      const beforeOptionSnapshot = db.addon_options
        .filter((o) => o.addon_group_id === id)
        .map((o) => `${o.name}:${o.extra_price}`)
        .sort();
      group.name = input.name;
      group.selection_type = input.selection_type;
      group.is_required = input.is_required;

      const oldOptionIds = db.addon_options
        .filter((o) => o.addon_group_id === id)
        .map((o) => o.id);
      db.addon_options = db.addon_options.filter(
        (o) => o.addon_group_id !== id,
      );
      db.addon_recipe_modifiers = db.addon_recipe_modifiers.filter(
        (m) => !oldOptionIds.includes(m.addon_option_id),
      );

      for (const opt of input.options) {
        const option: AddonOption = {
          id: uid("ao"),
          addon_group_id: id,
          name: opt.name,
          extra_price: opt.extra_price,
        };
        db.addon_options.push(option);
        for (const mod of opt.modifiers) {
          db.addon_recipe_modifiers.push({
            id: uid("arm"),
            addon_option_id: option.id,
            ingredient_id: mod.ingredient_id,
            quantity_delta: mod.quantity_delta,
            mode: mod.mode,
          });
        }
      }
      const afterOptionSnapshot = input.options
        .map((o) => `${o.name}:${o.extra_price}`)
        .sort();
      const changes = [];
      if (beforeGroup.name !== group.name) {
        changes.push({ field: "name", before: beforeGroup.name, after: group.name });
      }
      if (beforeGroup.selection_type !== group.selection_type) {
        changes.push({
          field: "selection_type",
          before: beforeGroup.selection_type,
          after: group.selection_type,
        });
      }
      if (beforeGroup.is_required !== group.is_required) {
        changes.push({
          field: "is_required",
          before: beforeGroup.is_required,
          after: group.is_required,
        });
      }
      if (JSON.stringify(beforeOptionSnapshot) !== JSON.stringify(afterOptionSnapshot)) {
        changes.push({
          field: "options",
          before: beforeOptionSnapshot,
          after: afterOptionSnapshot,
        });
      }
      appendAudit(db, {
        action: "update",
        entity: "addon_group",
        entity_id: group.id,
        entity_name: group.name,
        changes,
      });
      return group;
    }),
  );
}

export async function removeGroup(id: string) {
  if (config.api.useRealBackend) {
    await http.del<{ ok: true }>(`/api/addon-groups/${id}`);
    return;
  }
  return delay(
    mutate((db) => {
      const group = db.addon_groups.find((g) => g.id === id);
      const name = group?.name ?? id;
      db.addon_groups = db.addon_groups.filter((g) => g.id !== id);
      const oldOptionIds = db.addon_options
        .filter((o) => o.addon_group_id === id)
        .map((o) => o.id);
      db.addon_options = db.addon_options.filter(
        (o) => o.addon_group_id !== id,
      );
      db.addon_recipe_modifiers = db.addon_recipe_modifiers.filter(
        (m) => !oldOptionIds.includes(m.addon_option_id),
      );
      db.menu_addon_groups = db.menu_addon_groups.filter(
        (x) => x.addon_group_id !== id,
      );
      appendAudit(db, {
        action: "delete",
        entity: "addon_group",
        entity_id: id,
        entity_name: name,
        notes: "Add-on group dihapus",
      });
    }),
  );
}
