import { getDb } from "@/lib/mock/db";
import { config } from "@/lib/config";
import type { StockMovement, StockMovementType } from "@/types";
import { delay } from "./_latency";
import { http } from "./http";
import { qs } from "./_qs";

export async function list(params?: {
  outlet_id?: string | null;
  ingredient_id?: string;
  types?: StockMovementType[];
  start?: string;
  end?: string;
}): Promise<StockMovement[]> {
  if (config.api.useRealBackend) {
    return http.get<StockMovement[]>(`/api/stock-movements${qs(params)}`);
  }
  const db = getDb();
  let items = [...db.stock_movements];
  if (params?.outlet_id) items = items.filter((m) => m.outlet_id === params.outlet_id);
  if (params?.ingredient_id) items = items.filter((m) => m.ingredient_id === params.ingredient_id);
  if (params?.types && params.types.length > 0) items = items.filter((m) => params.types!.includes(m.type));
  if (params?.start) {
    const start = new Date(params.start).getTime();
    items = items.filter((m) => new Date(m.created_at).getTime() >= start);
  }
  if (params?.end) {
    const end = new Date(params.end).getTime();
    items = items.filter((m) => new Date(m.created_at).getTime() <= end);
  }
  items.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  return delay(items);
}
