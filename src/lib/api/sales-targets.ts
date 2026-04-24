import { appendAudit, diffChanges, getDb, mutate } from "@/lib/mock/db";
import type { SalesTarget } from "@/types";
import { uid } from "@/lib/utils";
import { config } from "@/lib/config";
import { delay } from "./_latency";
import { http } from "./http";
import { qs } from "./_qs";

function monthLabel(year: number, month: number) {
  const names = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
  return `${names[month - 1]} ${year}`;
}

export async function list(params?: { year?: number }): Promise<SalesTarget[]> {
  if (config.api.useRealBackend) {
    return http.get<SalesTarget[]>(`/api/sales-targets${qs(params)}`);
  }
  const db = getDb();
  let rows = [...db.sales_targets];
  if (params?.year !== undefined) {
    rows = rows.filter((r) => r.year === params.year);
  }
  rows.sort((a, b) => (a.year - b.year) || (a.month - b.month));
  return delay(rows);
}

export async function get(year: number, month: number): Promise<SalesTarget | null> {
  if (config.api.useRealBackend) {
    const rows = await http.get<SalesTarget[]>(
      `/api/sales-targets${qs({ year })}`,
    );
    return rows.find((r) => r.month === month) ?? null;
  }
  const db = getDb();
  const row = db.sales_targets.find((r) => r.year === year && r.month === month);
  return delay(row ? { ...row } : null);
}

export async function upsert(input: {
  year: number;
  month: number;
  target_amount: number;
}): Promise<SalesTarget> {
  if (!Number.isInteger(input.year) || input.year < 2000 || input.year > 2100) {
    throw new Error("Tahun tidak valid");
  }
  if (!Number.isInteger(input.month) || input.month < 1 || input.month > 12) {
    throw new Error("Bulan harus 1 sampai 12");
  }
  if (!Number.isFinite(input.target_amount) || input.target_amount < 0) {
    throw new Error("Target harus ≥ 0");
  }
  if (config.api.useRealBackend) {
    return http.post<SalesTarget>("/api/sales-targets", input);
  }
  return delay(
    mutate((db) => {
      const existing = db.sales_targets.find(
        (r) => r.year === input.year && r.month === input.month,
      );
      if (existing) {
        const before = { ...existing };
        existing.target_amount = input.target_amount;
        existing.updated_at = new Date().toISOString();
        appendAudit(db, {
          action: "update",
          entity: "sales_target",
          entity_id: existing.id,
          entity_name: monthLabel(existing.year, existing.month),
          changes: diffChanges(
            before as unknown as Record<string, unknown>,
            existing as unknown as Record<string, unknown>,
          ),
        });
        return { ...existing };
      }
      const row: SalesTarget = {
        id: uid("tgt"),
        year: input.year,
        month: input.month,
        target_amount: input.target_amount,
        updated_at: new Date().toISOString(),
      };
      db.sales_targets.push(row);
      appendAudit(db, {
        action: "create",
        entity: "sales_target",
        entity_id: row.id,
        entity_name: monthLabel(row.year, row.month),
        changes: [
          { field: "target_amount", before: 0, after: row.target_amount },
        ],
      });
      return { ...row };
    }),
  );
}

export async function remove(id: string): Promise<void> {
  if (config.api.useRealBackend) {
    await http.del<{ ok: true }>(`/api/sales-targets/${id}`);
    return;
  }
  return delay(
    mutate((db) => {
      const idx = db.sales_targets.findIndex((r) => r.id === id);
      if (idx === -1) return;
      const [removed] = db.sales_targets.splice(idx, 1);
      appendAudit(db, {
        action: "delete",
        entity: "sales_target",
        entity_id: removed.id,
        entity_name: monthLabel(removed.year, removed.month),
      });
    }),
  );
}
