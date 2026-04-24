import { appendAudit, getDb, mutate } from "@/lib/mock/db";
import { uid } from "@/lib/utils";
import { config } from "@/lib/config";
import type { ChecklistTemplate, ChecklistType, Station } from "@/types";
import { STATION_LABEL } from "@/types";
import { delay } from "./_latency";
import { http } from "./http";
import { qs } from "./_qs";

export interface ChecklistFilter {
  station?: Station;
  type?: ChecklistType;
}

export async function list(
  filter: ChecklistFilter = {},
): Promise<ChecklistTemplate[]> {
  if (config.api.useRealBackend) {
    return http.get<ChecklistTemplate[]>(`/api/checklists${qs(filter)}`);
  }
  const db = getDb();
  const items = db.checklist_templates.filter((c) => {
    if (filter.station && c.station !== filter.station) return false;
    if (filter.type && c.type !== filter.type) return false;
    return true;
  });
  items.sort((a, b) => a.sort_order - b.sort_order);
  return delay([...items]);
}

export interface CreateChecklistInput {
  station: Station;
  type: ChecklistType;
  label: string;
}

export async function create(input: CreateChecklistInput): Promise<ChecklistTemplate> {
  if (!input.label.trim()) throw new Error("Label checklist wajib diisi");
  if (config.api.useRealBackend) {
    return http.post<ChecklistTemplate>("/api/checklists", {
      station: input.station,
      type: input.type,
      label: input.label.trim(),
    });
  }
  return delay(
    mutate((db) => {
      const sameGroup = db.checklist_templates.filter(
        (c) => c.station === input.station && c.type === input.type,
      );
      const nextSort =
        sameGroup.length === 0
          ? 0
          : Math.max(...sameGroup.map((c) => c.sort_order)) + 1;
      const item: ChecklistTemplate = {
        id: uid("clt"),
        station: input.station,
        type: input.type,
        label: input.label.trim(),
        sort_order: nextSort,
      };
      db.checklist_templates.push(item);
      appendAudit(db, {
        action: "create",
        entity: "checklist_template",
        entity_id: item.id,
        entity_name: `${STATION_LABEL[item.station]} · ${
          item.type === "before" ? "Sebelum buka" : "Sesudah tutup"
        } · ${item.label}`,
      });
      return item;
    }),
  );
}

export async function update(
  id: string,
  patch: { label: string },
): Promise<ChecklistTemplate> {
  if (!patch.label.trim()) throw new Error("Label checklist wajib diisi");
  if (config.api.useRealBackend) {
    return http.patch<ChecklistTemplate>(`/api/checklists/${id}`, {
      label: patch.label.trim(),
    });
  }
  return delay(
    mutate((db) => {
      const item = db.checklist_templates.find((c) => c.id === id);
      if (!item) throw new Error("Checklist tidak ditemukan");
      const before = item.label;
      item.label = patch.label.trim();
      appendAudit(db, {
        action: "update",
        entity: "checklist_template",
        entity_id: item.id,
        entity_name: `${STATION_LABEL[item.station]} · ${item.label}`,
        changes: [{ field: "label", before, after: item.label }],
      });
      return item;
    }),
  );
}

export async function remove(id: string): Promise<void> {
  if (config.api.useRealBackend) {
    await http.del<{ ok: true }>(`/api/checklists/${id}`);
    return;
  }
  return delay(
    mutate((db) => {
      const item = db.checklist_templates.find((c) => c.id === id);
      if (!item) throw new Error("Checklist tidak ditemukan");
      db.checklist_templates = db.checklist_templates.filter(
        (c) => c.id !== id,
      );
      appendAudit(db, {
        action: "delete",
        entity: "checklist_template",
        entity_id: id,
        entity_name: `${STATION_LABEL[item.station]} · ${item.label}`,
      });
    }),
  );
}

export async function reorder(
  station: Station,
  type: ChecklistType,
  orderedIds: string[],
): Promise<void> {
  if (config.api.useRealBackend) {
    await http.post<{ ok: true }>("/api/checklists/reorder", {
      station,
      type,
      ordered_ids: orderedIds,
    });
    return;
  }
  return delay(
    mutate((db) => {
      orderedIds.forEach((id, idx) => {
        const item = db.checklist_templates.find(
          (c) => c.id === id && c.station === station && c.type === type,
        );
        if (item) item.sort_order = idx;
      });
    }),
  );
}
