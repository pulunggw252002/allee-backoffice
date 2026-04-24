"use client";

import {
  buildDefaultChecklistTemplates,
  buildSeed,
  DEFAULT_ATTENDANCE_SETTINGS,
  DEFAULT_TAX_SETTINGS,
  type MockDatabase,
} from "./seed";
import { calcRecipeHpp, calcBundleHpp } from "@/lib/hpp";
import { uid } from "@/lib/utils";
import { storageKey } from "@/lib/config";
import type {
  AuditAction,
  AuditChange,
  AuditEntity,
  AuditLog,
  Role,
  User,
} from "@/types";

const STORAGE_KEY = storageKey("db");

let memoryDb: MockDatabase | null = null;

function loadFromStorage(): MockDatabase | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MockDatabase;
  } catch {
    return null;
  }
}

function saveToStorage(db: MockDatabase) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // ignore quota
  }
}

function recomputeAllHpp(db: MockDatabase) {
  for (const menu of db.menus) {
    if (menu.type === "bundle") continue;
    const recipe = db.recipes.filter((r) => r.menu_id === menu.id);
    const refOutlet = menu.outlet_ids[0];
    if (!refOutlet) continue;
    const outletIngs = db.ingredients.filter((i) => i.outlet_id === refOutlet);
    const mapped = recipe.map((r) => {
      const raw = db.ingredients.find((i) => i.id === r.ingredient_id);
      if (!raw) return { ingredient_id: r.ingredient_id, quantity: r.quantity };
      const local = outletIngs.find((i) => i.name === raw.name);
      return {
        ingredient_id: local?.id ?? r.ingredient_id,
        quantity: r.quantity,
      };
    });
    menu.hpp_cached = calcRecipeHpp(mapped, outletIngs);
  }
}

export function getDb(): MockDatabase {
  if (memoryDb) return memoryDb;
  const stored = loadFromStorage();
  if (stored) {
    if (!Array.isArray(stored.audit_logs)) stored.audit_logs = [];
    if (!Array.isArray(stored.attendances)) stored.attendances = [];
    if (!Array.isArray(stored.checklist_templates)) {
      stored.checklist_templates = buildDefaultChecklistTemplates();
    }
    if (
      !stored.attendance_settings ||
      typeof stored.attendance_settings.check_in_cutoff !== "string"
    ) {
      stored.attendance_settings = { ...DEFAULT_ATTENDANCE_SETTINGS };
    }
    if (
      !stored.tax_settings ||
      typeof stored.tax_settings.ppn_percent !== "number" ||
      typeof stored.tax_settings.service_charge_percent !== "number"
    ) {
      stored.tax_settings = { ...DEFAULT_TAX_SETTINGS };
    }
    if (!Array.isArray(stored.sales_targets)) {
      stored.sales_targets = [];
    }
    // Ojol integration tables — added in a later iteration, backfill if
    // the persisted DB predates them.
    if (!Array.isArray(stored.ojol_channels)) {
      stored.ojol_channels = [];
    }
    if (!Array.isArray(stored.menu_channel_listings)) {
      stored.menu_channel_listings = [];
    }
    if (!Array.isArray(stored.ojol_sync_logs)) {
      stored.ojol_sync_logs = [];
    }
    // Backfill `status` / `order_type` on transactions persisted before
    // those fields existed. Defaults keep old seeds treated as completed
    // dine-in sales — matches prior dashboard semantics.
    for (const tx of stored.transactions) {
      if (!tx.status) tx.status = "paid";
      if (!tx.order_type) tx.order_type = "dine_in";
    }
    memoryDb = stored;
    return memoryDb;
  }
  const seed = buildSeed();
  recomputeAllHpp(seed);
  memoryDb = seed;
  saveToStorage(memoryDb);
  return memoryDb;
}

export function persist() {
  if (memoryDb) saveToStorage(memoryDb);
}

export function resetDb() {
  memoryDb = null;
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

export function mutate<T>(fn: (db: MockDatabase) => T): T {
  const db = getDb();
  const result = fn(db);
  recomputeAllHpp(db);
  persist();
  return result;
}

export { calcBundleHpp };

const AUTH_KEY = storageKey("auth");
const AUDIT_IGNORE_FIELDS = new Set([
  "id",
  "updated_at",
  "created_at",
  "joined_at",
  "hpp_cached",
]);

function readAuthUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      state?: { user?: User | null };
    };
    return parsed?.state?.user ?? null;
  } catch {
    return null;
  }
}

export function getCurrentActor(): {
  id: string;
  name: string;
  role: Role;
} {
  const user = readAuthUser();
  if (user) return { id: user.id, name: user.name, role: user.role };
  return { id: "system", name: "System", role: "owner" };
}

export function diffChanges(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown>,
): AuditChange[] {
  const changes: AuditChange[] = [];
  const keys = new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after),
  ]);
  for (const key of keys) {
    if (AUDIT_IGNORE_FIELDS.has(key)) continue;
    const b = before?.[key];
    const a = after[key];
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      changes.push({ field: key, before: b, after: a });
    }
  }
  return changes;
}

export function appendAudit(
  db: MockDatabase,
  input: {
    action: AuditAction;
    entity: AuditEntity;
    entity_id: string;
    entity_name: string;
    outlet_id?: string | null;
    changes?: AuditChange[];
    notes?: string;
    actor?: { id: string; name: string; role: Role };
  },
) {
  const actor = input.actor ?? getCurrentActor();
  const log: AuditLog = {
    id: uid("log"),
    user_id: actor.id,
    user_name: actor.name,
    user_role: actor.role,
    action: input.action,
    entity: input.entity,
    entity_id: input.entity_id,
    entity_name: input.entity_name,
    outlet_id: input.outlet_id ?? null,
    changes: input.changes ?? [],
    notes: input.notes,
    created_at: new Date().toISOString(),
  };
  db.audit_logs.push(log);
}
