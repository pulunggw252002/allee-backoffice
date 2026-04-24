import { getDb } from "@/lib/mock/db";
import { config } from "@/lib/config";
import type { Transaction } from "@/types";
import { delay } from "./_latency";
import { http } from "./http";
import { qs } from "./_qs";

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
