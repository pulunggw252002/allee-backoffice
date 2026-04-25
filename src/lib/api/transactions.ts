import {
  appendAudit,
  getCurrentActor,
  getDb,
  mutate,
} from "@/lib/mock/db";
import { config } from "@/lib/config";
import type { Transaction } from "@/types";
import { delay } from "./_latency";
import { http } from "./http";
import { qs } from "./_qs";

export interface VoidItemResponse {
  ok: true;
  item_id: string;
  voided_at: string;
}

export interface VoidAllResponse {
  ok: true;
  voided_count: number;
}

export async function list(params?: {
  outlet_id?: string | null;
  start?: string;
  end?: string;
}): Promise<Transaction[]> {
  if (config.api.useRealBackend) {
    return http.get<Transaction[]>(`/api/transactions${qs(params)}`);
  }
  const db = getDb();
  let items = [...db.transactions];
  if (params?.outlet_id) {
    items = items.filter((t) => t.outlet_id === params.outlet_id);
  }
  if (params?.start) {
    const start = new Date(params.start).getTime();
    items = items.filter((t) => new Date(t.created_at).getTime() >= start);
  }
  if (params?.end) {
    const end = new Date(params.end).getTime();
    items = items.filter((t) => new Date(t.created_at).getTime() <= end);
  }
  items.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  return delay(items);
}

export async function get(id: string): Promise<Transaction | undefined> {
  if (config.api.useRealBackend) {
    return http.get<Transaction>(`/api/transactions/${id}`);
  }
  return delay(getDb().transactions.find((t) => t.id === id));
}

/**
 * Void satu item (granularity baru). Sisa item di struk tetap valid revenue.
 * Stok TIDAK direstore. Backend menolak kalau item sudah pernah di-void.
 */
export async function voidItem(
  transactionId: string,
  itemId: string,
  reason: string,
): Promise<VoidItemResponse> {
  if (config.api.useRealBackend) {
    return http.post<VoidItemResponse>(
      `/api/transactions/${transactionId}/items/${itemId}/void`,
      { reason },
    );
  }
  const now = new Date().toISOString();
  const actor = getCurrentActor();
  mutate((db) => {
    const tx = db.transactions.find((t) => t.id === transactionId);
    if (!tx) throw new Error("Transaction not found");
    const it = tx.items.find((i) => i.id === itemId);
    if (!it) throw new Error("Transaction item not found");
    if (it.voided_at) throw new Error("Item sudah di-void sebelumnya");
    it.voided_at = now;
    it.voided_by = actor.id;
    it.void_reason = reason;
    appendAudit(db, {
      action: "void",
      entity: "transaction",
      entity_id: tx.id,
      entity_name: `Transaksi #${tx.id.slice(-6)} — ${it.name_snapshot} ×${it.quantity}`,
      outlet_id: tx.outlet_id,
      notes: `Void item: ${reason}`,
    });
  });
  return delay({ ok: true as const, item_id: itemId, voided_at: now });
}

/**
 * Shortcut: void seluruh struk dalam satu panggilan (mark semua item aktif
 * sebagai void dengan reason yang sama). Lebih cepat dari N call `voidItem`
 * kalau kasir memang mau buang seluruh order.
 */
export async function voidAll(
  transactionId: string,
  reason: string,
): Promise<VoidAllResponse> {
  if (config.api.useRealBackend) {
    return http.post<VoidAllResponse>(
      `/api/transactions/${transactionId}/void`,
      { reason },
    );
  }
  const now = new Date().toISOString();
  const actor = getCurrentActor();
  let voidedCount = 0;
  mutate((db) => {
    const tx = db.transactions.find((t) => t.id === transactionId);
    if (!tx) throw new Error("Transaction not found");
    if (tx.status !== "paid")
      throw new Error("Hanya transaksi 'paid' yang bisa di-void");
    for (const it of tx.items) {
      if (it.voided_at) continue;
      it.voided_at = now;
      it.voided_by = actor.id;
      it.void_reason = reason;
      voidedCount += 1;
    }
    if (voidedCount === 0) throw new Error("Tidak ada item aktif untuk di-void");
    appendAudit(db, {
      action: "void",
      entity: "transaction",
      entity_id: tx.id,
      entity_name: `Transaksi #${tx.id.slice(-6)}`,
      outlet_id: tx.outlet_id,
      notes: `Void seluruh struk: ${reason}`,
    });
  });
  return delay({ ok: true as const, voided_count: voidedCount });
}
