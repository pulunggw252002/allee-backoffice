import { appendAudit, diffChanges, getDb, mutate } from "@/lib/mock/db";
import { uid } from "@/lib/utils";
import { config } from "@/lib/config";
import type { Ingredient, IngredientBatch } from "@/types";
import { delay } from "./_latency";
import { http } from "./http";
import { qs } from "./_qs";

export async function list(params?: {
  outlet_id?: string | null;
}): Promise<Ingredient[]> {
  if (config.api.useRealBackend) {
    return http.get<Ingredient[]>(
      `/api/ingredients${qs({ outlet_id: params?.outlet_id })}`,
    );
  }
  const db = getDb();
  let items = db.ingredients;
  if (params?.outlet_id) {
    items = items.filter((i) => i.outlet_id === params.outlet_id);
  }
  return delay([...items]);
}

export async function get(id: string): Promise<Ingredient | undefined> {
  if (config.api.useRealBackend) {
    return http.get<Ingredient>(`/api/ingredients/${id}`);
  }
  return delay(getDb().ingredients.find((i) => i.id === id));
}

export type IngredientInput = Omit<Ingredient, "id" | "updated_at">;

export async function create(input: IngredientInput): Promise<Ingredient> {
  if (config.api.useRealBackend) {
    return http.post<Ingredient>("/api/ingredients", input);
  }
  return delay(
    mutate((db) => {
      const ing: Ingredient = {
        ...input,
        id: uid("ing"),
        updated_at: new Date().toISOString(),
      };
      db.ingredients.push(ing);
      appendAudit(db, {
        action: "create",
        entity: "ingredient",
        entity_id: ing.id,
        entity_name: ing.name,
        outlet_id: ing.outlet_id,
      });
      return ing;
    }),
  );
}

export async function update(id: string, input: Partial<IngredientInput>) {
  if (config.api.useRealBackend) {
    return http.patch<Ingredient>(`/api/ingredients/${id}`, input);
  }
  return delay(
    mutate((db) => {
      const ing = db.ingredients.find((i) => i.id === id);
      if (!ing) throw new Error("Bahan tidak ditemukan");
      const before = { ...ing };
      Object.assign(ing, input, { updated_at: new Date().toISOString() });
      appendAudit(db, {
        action: "update",
        entity: "ingredient",
        entity_id: ing.id,
        entity_name: ing.name,
        outlet_id: ing.outlet_id,
        changes: diffChanges(
          before as unknown as Record<string, unknown>,
          ing as unknown as Record<string, unknown>,
        ),
      });
      return ing;
    }),
  );
}

export async function remove(id: string) {
  if (config.api.useRealBackend) {
    await http.del<{ ok: true }>(`/api/ingredients/${id}`);
    return;
  }
  return delay(
    mutate((db) => {
      const idx = db.ingredients.findIndex((i) => i.id === id);
      if (idx === -1) throw new Error("Bahan tidak ditemukan");
      const ing = db.ingredients[idx];
      db.ingredients.splice(idx, 1);
      appendAudit(db, {
        action: "delete",
        entity: "ingredient",
        entity_id: ing.id,
        entity_name: ing.name,
        outlet_id: ing.outlet_id,
        notes: "Bahan dihapus",
      });
    }),
  );
}

export type StockInInput = {
  ingredient_id: string;
  outlet_id: string;
  quantity: number;
  purchase_price?: number;
  batch_number?: string;
  expiry_date?: string;
  supplier?: string;
  notes?: string;
  user_id: string;
};

export async function stockIn(input: StockInInput) {
  if (config.api.useRealBackend) {
    await http.post<unknown>("/api/stock-movements", {
      ingredient_id: input.ingredient_id,
      outlet_id: input.outlet_id,
      type: "in",
      quantity: input.quantity,
      notes: input.notes ?? input.supplier,
    });
    return;
  }
  return delay(
    mutate((db) => {
      const ing = db.ingredients.find((i) => i.id === input.ingredient_id);
      if (!ing) throw new Error("Bahan tidak ditemukan");
      const beforeStock = ing.current_stock;
      const beforePrice = ing.unit_price;
      ing.current_stock += input.quantity;
      ing.updated_at = new Date().toISOString();
      if (input.purchase_price && input.purchase_price > 0) {
        ing.unit_price = Math.round(
          (ing.unit_price + input.purchase_price) / 2,
        );
      }
      let batchId: string | undefined;
      if (input.batch_number || input.expiry_date) {
        const batch: IngredientBatch = {
          id: uid("btc"),
          ingredient_id: ing.id,
          batch_number: input.batch_number,
          quantity: input.quantity,
          received_date: new Date().toISOString().slice(0, 10),
          expiry_date: input.expiry_date,
          purchase_price: input.purchase_price,
        };
        batchId = batch.id;
      }
      db.stock_movements.push({
        id: uid("mov"),
        ingredient_id: ing.id,
        outlet_id: input.outlet_id,
        type: "in",
        quantity: input.quantity,
        notes: input.notes ?? input.supplier,
        user_id: input.user_id,
        batch_id: batchId,
        created_at: new Date().toISOString(),
      });
      const changes = [
        {
          field: "current_stock",
          before: beforeStock,
          after: ing.current_stock,
        },
      ];
      if (ing.unit_price !== beforePrice) {
        changes.push({
          field: "unit_price",
          before: beforePrice,
          after: ing.unit_price,
        });
      }
      appendAudit(db, {
        action: "stock_in",
        entity: "ingredient",
        entity_id: ing.id,
        entity_name: ing.name,
        outlet_id: input.outlet_id,
        changes,
        notes: `+${input.quantity} ${ing.unit}${input.supplier ? ` — ${input.supplier}` : ""}${input.notes ? ` — ${input.notes}` : ""}`,
      });
    }),
  );
}

export type StockOutInput = {
  ingredient_id: string;
  outlet_id: string;
  quantity: number;
  reason: "waste" | "rusak" | "koreksi" | "transfer";
  notes?: string;
  user_id: string;
};

export async function stockOut(input: StockOutInput) {
  if (config.api.useRealBackend) {
    await http.post<unknown>("/api/stock-movements", {
      ingredient_id: input.ingredient_id,
      outlet_id: input.outlet_id,
      type: input.reason === "waste" ? "out_waste" : "adjustment",
      quantity: -input.quantity,
      notes: `${input.reason}${input.notes ? ` — ${input.notes}` : ""}`,
    });
    return;
  }
  return delay(
    mutate((db) => {
      const ing = db.ingredients.find((i) => i.id === input.ingredient_id);
      if (!ing) throw new Error("Bahan tidak ditemukan");
      const beforeStock = ing.current_stock;
      ing.current_stock = Math.max(0, ing.current_stock - input.quantity);
      ing.updated_at = new Date().toISOString();
      db.stock_movements.push({
        id: uid("mov"),
        ingredient_id: ing.id,
        outlet_id: input.outlet_id,
        type: input.reason === "waste" ? "out_waste" : "adjustment",
        quantity: -input.quantity,
        notes: `${input.reason}${input.notes ? ` — ${input.notes}` : ""}`,
        user_id: input.user_id,
        created_at: new Date().toISOString(),
      });
      appendAudit(db, {
        action: "stock_out",
        entity: "ingredient",
        entity_id: ing.id,
        entity_name: ing.name,
        outlet_id: input.outlet_id,
        changes: [
          {
            field: "current_stock",
            before: beforeStock,
            after: ing.current_stock,
          },
        ],
        notes: `-${input.quantity} ${ing.unit} (${input.reason})${input.notes ? ` — ${input.notes}` : ""}`,
      });
    }),
  );
}

export type OpnameInput = {
  outlet_id: string;
  user_id: string;
  notes?: string;
  items: Array<{ ingredient_id: string; actual_qty: number }>;
};

export async function opname(input: OpnameInput) {
  if (config.api.useRealBackend) {
    // Real backend: emit one opname movement per non-zero diff. Server
    // auto-updates current_stock.
    for (const item of input.items) {
      const ing = await http.get<Ingredient>(
        `/api/ingredients/${item.ingredient_id}`,
      );
      const diff = item.actual_qty - ing.current_stock;
      if (diff === 0) continue;
      await http.post<unknown>("/api/stock-movements", {
        ingredient_id: item.ingredient_id,
        outlet_id: input.outlet_id,
        type: "opname",
        quantity: diff,
        notes: input.notes ?? "Stock opname",
      });
    }
    return;
  }
  return delay(
    mutate((db) => {
      const changedItems: Array<{
        name: string;
        before: number;
        after: number;
        diff: number;
      }> = [];
      for (const item of input.items) {
        const ing = db.ingredients.find((i) => i.id === item.ingredient_id);
        if (!ing) continue;
        const diff = item.actual_qty - ing.current_stock;
        if (diff === 0) continue;
        changedItems.push({
          name: ing.name,
          before: ing.current_stock,
          after: item.actual_qty,
          diff,
        });
        ing.current_stock = item.actual_qty;
        ing.updated_at = new Date().toISOString();
        db.stock_movements.push({
          id: uid("mov"),
          ingredient_id: ing.id,
          outlet_id: input.outlet_id,
          type: "opname",
          quantity: diff,
          notes: input.notes ?? "Stock opname",
          user_id: input.user_id,
          created_at: new Date().toISOString(),
        });
      }
      if (changedItems.length > 0) {
        appendAudit(db, {
          action: "opname",
          entity: "ingredient",
          entity_id: input.outlet_id,
          entity_name: `Opname (${changedItems.length} bahan)`,
          outlet_id: input.outlet_id,
          changes: changedItems.map((c) => ({
            field: c.name,
            before: c.before,
            after: c.after,
          })),
          notes: input.notes,
        });
      }
    }),
  );
}
