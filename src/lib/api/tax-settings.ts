import { appendAudit, diffChanges, getDb, mutate } from "@/lib/mock/db";
import { config } from "@/lib/config";
import type { TaxSettings } from "@/types";
import { delay } from "./_latency";
import { http } from "./http";

export async function get(): Promise<TaxSettings> {
  if (config.api.useRealBackend) {
    return http.get<TaxSettings>("/api/tax-settings");
  }
  const db = getDb();
  return delay({ ...db.tax_settings });
}

function validatePercent(label: string, value: number) {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} harus berupa angka`);
  }
  if (value < 0 || value > 100) {
    throw new Error(`${label} harus antara 0 dan 100`);
  }
}

export async function update(input: {
  ppn_percent: number;
  service_charge_percent: number;
}): Promise<TaxSettings> {
  validatePercent("PPN", input.ppn_percent);
  validatePercent("Service Charge", input.service_charge_percent);
  if (config.api.useRealBackend) {
    return http.put<TaxSettings>("/api/tax-settings", input);
  }
  return delay(
    mutate((db) => {
      const before = { ...db.tax_settings };
      db.tax_settings = {
        ppn_percent: input.ppn_percent,
        service_charge_percent: input.service_charge_percent,
        updated_at: new Date().toISOString(),
      };
      appendAudit(db, {
        action: "update",
        entity: "tax_settings",
        entity_id: "tax_settings",
        entity_name: "PPN & Service Charge",
        changes: diffChanges(
          before as unknown as Record<string, unknown>,
          db.tax_settings as unknown as Record<string, unknown>,
        ),
      });
      return db.tax_settings;
    }),
  );
}
