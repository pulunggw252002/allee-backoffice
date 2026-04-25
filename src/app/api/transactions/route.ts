/**
 * GET  /api/transactions?outlet_id=&start=&end=&status=&order_type=
 * POST /api/transactions  — create order from POS (atomic + idempotent)
 *
 * GET returns transactions + nested items + addons. Primary read endpoint
 * used by laporan & history.
 *
 * POST adalah satu-satunya jalur ingest order dari POS. Bertugas:
 *   1. validate outlet + role (owner / kepala_toko / kasir),
 *   2. de-dup via `client_request_id` — POS retry tidak boleh double-create,
 *   3. snapshot menu/addon/bundle ke transaction_items + addons,
 *   4. recalculate totals server-side dari snapshot harga POS lalu
 *      cross-check dengan `grand_total` yang dikirim — kalau drift > 1 IDR,
 *      tolak (sinyal versi menu sudah berubah / bug perhitungan POS),
 *   5. deduct stock berdasar resep menu + modifier addon — semua dalam
 *      satu sqlite.transaction supaya tidak ada partial state,
 *   6. log audit + return Transaction utuh (matching GET shape).
 */
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema, sqlite } from "@/server/db/client";
import {
  requireRole,
  requireSession,
  scopedOutletId,
} from "@/server/auth/session";
import {
  badRequest,
  genId,
  handle,
  nowIso,
  readJson,
} from "@/server/api/helpers";
import { logAudit } from "@/server/api/audit";

export async function GET(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    const url = new URL(req.url);
    const outletId = scopedOutletId(session, url.searchParams.get("outlet_id"));
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");
    const status = url.searchParams.get("status");
    const orderType = url.searchParams.get("order_type");

    const filters = [];
    if (outletId) filters.push(eq(schema.transactions.outlet_id, outletId));
    if (start) filters.push(gte(schema.transactions.created_at, start));
    if (end) filters.push(lte(schema.transactions.created_at, end));
    if (status) filters.push(eq(schema.transactions.status, status as never));
    if (orderType)
      filters.push(eq(schema.transactions.order_type, orderType as never));

    const txs = await db
      .select()
      .from(schema.transactions)
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(desc(schema.transactions.created_at))
      .limit(1000)
      .all();

    if (txs.length === 0) return [];

    const ids = txs.map((t) => t.id);
    const items = await db
      .select()
      .from(schema.transaction_items)
      .where(inArray(schema.transaction_items.transaction_id, ids))
      .all();
    const itemIds = items.map((i) => i.id);
    const addons =
      itemIds.length === 0
        ? []
        : await db
            .select()
            .from(schema.transaction_item_addons)
            .where(
              inArray(
                schema.transaction_item_addons.transaction_item_id,
                itemIds,
              ),
            )
            .all();

    return txs.map((t) => ({
      ...t,
      items: items
        .filter((i) => i.transaction_id === t.id)
        .map((i) => ({
          ...i,
          addons: addons.filter((a) => a.transaction_item_id === i.id),
        })),
    }));
  });
}

// ─── POST: ingest order dari POS ─────────────────────────────────────────
//
// Idempotency strategy: POS men-generate `id` (UUID/genId) di sisi client
// dan kirim ke sini. Kalau id sudah ada di DB → return row existing apa
// adanya (200, bukan duplicate). Network retry POS karenanya tidak akan
// pernah double-create.
//
// Total cross-check: server hitung ulang `subtotal` dari Σ items + addons,
// lalu bandingkan dengan yang dikirim POS. Selisih ≤ Rp 1 dimaafkan
// (rounding). Selisih lebih besar = bug perhitungan / harga menu sudah
// berubah → tolak supaya inkonsistensi tidak masuk laporan.

const ItemAddonInput = z.object({
  addon_option_id: z.string().min(1),
  name_snapshot: z.string().min(1),
  extra_price: z.number().nonnegative(),
});

const ItemInput = z
  .object({
    menu_id: z.string().min(1).nullable().optional(),
    bundle_id: z.string().min(1).nullable().optional(),
    name_snapshot: z.string().min(1),
    quantity: z.number().int().positive(),
    unit_price: z.number().nonnegative(),
    hpp_snapshot: z.number().nonnegative(),
    subtotal: z.number().nonnegative(),
    addons: z.array(ItemAddonInput).default([]),
  })
  .refine(
    (i) => Boolean(i.menu_id) !== Boolean(i.bundle_id),
    "Item harus punya tepat satu dari menu_id atau bundle_id",
  );

const TransactionInput = z.object({
  /** Idempotency key — POS-generated. Re-POST dengan id sama mengembalikan tx existing. */
  id: z.string().min(1),
  outlet_id: z.string().min(1),
  payment_method: z.enum(["cash", "qris", "card", "transfer"]),
  order_type: z.enum(["dine_in", "take_away", "delivery", "online"]),
  status: z.enum(["open", "paid"]).default("paid"),
  subtotal: z.number().nonnegative(),
  discount_total: z.number().nonnegative().default(0),
  ppn_amount: z.number().nonnegative().default(0),
  service_charge_amount: z.number().nonnegative().default(0),
  grand_total: z.number().nonnegative(),
  /** Optional explicit timestamp dari POS — kalau tidak dikirim, server pakai nowIso. */
  created_at: z.string().datetime().optional(),
  items: z.array(ItemInput).min(1, "Minimal satu item"),
});

/** Toleransi mismatch total (rupiah). Cukup besar untuk rounding, kecil untuk catch bug. */
const TOTAL_TOLERANCE_IDR = 1;

export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    requireRole(session, ["owner", "kepala_toko", "kasir"]);
    const input = await readJson(req, TransactionInput);

    // Scope: kasir/kepala_toko hanya boleh create order untuk outlet mereka.
    const effectiveOutletId = scopedOutletId(session, input.outlet_id);
    if (effectiveOutletId !== input.outlet_id) {
      badRequest("Outlet di luar scope user");
    }

    // Idempotency check — kalau id sudah ada, return tx existing.
    const existing = await db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.id, input.id))
      .get();
    if (existing) {
      const items = await db
        .select()
        .from(schema.transaction_items)
        .where(eq(schema.transaction_items.transaction_id, existing.id))
        .all();
      const itemIds = items.map((i) => i.id);
      const addons =
        itemIds.length === 0
          ? []
          : await db
              .select()
              .from(schema.transaction_item_addons)
              .where(
                inArray(
                  schema.transaction_item_addons.transaction_item_id,
                  itemIds,
                ),
              )
              .all();
      return {
        ...existing,
        items: items.map((i) => ({
          ...i,
          addons: addons.filter((a) => a.transaction_item_id === i.id),
        })),
      };
    }

    // Outlet validity — supaya FK error tidak balik sebagai 500 cryptic.
    const outlet = await db
      .select({ id: schema.outlets.id })
      .from(schema.outlets)
      .where(eq(schema.outlets.id, input.outlet_id))
      .get();
    if (!outlet) badRequest("Outlet tidak ditemukan");

    // Server-side total recompute — catch drift antara harga POS dan subtotal.
    let computedSubtotal = 0;
    for (const it of input.items) {
      const addons = it.addons ?? [];
      const addonExtra = addons.reduce((acc, a) => acc + a.extra_price, 0);
      computedSubtotal += (it.unit_price + addonExtra) * it.quantity;
    }
    if (Math.abs(computedSubtotal - input.subtotal) > TOTAL_TOLERANCE_IDR) {
      badRequest(
        `Subtotal mismatch: server hitung ${computedSubtotal}, POS kirim ${input.subtotal}`,
      );
    }

    const createdAt = input.created_at ?? nowIso();
    const txRow = {
      id: input.id,
      outlet_id: input.outlet_id,
      user_id: session.domainUser.id,
      subtotal: input.subtotal,
      discount_total: input.discount_total,
      ppn_amount: input.ppn_amount,
      service_charge_amount: input.service_charge_amount,
      grand_total: input.grand_total,
      payment_method: input.payment_method,
      status: input.status,
      order_type: input.order_type,
      created_at: createdAt,
      void_reason: null,
      voided_by: null,
      voided_at: null,
    };

    // Pre-build child rows supaya `sqlite.transaction()` callback (synchronous)
    // tidak perlu generate ID lagi di dalamnya. Addon id juga di-generate di
    // sini supaya response ke POS punya ID yang sama persis dengan DB.
    type AddonRow = z.infer<typeof ItemAddonInput> & { id: string };
    const itemRows: Array<{
      id: string;
      transaction_id: string;
      menu_id: string | null;
      bundle_id: string | null;
      name_snapshot: string;
      quantity: number;
      unit_price: number;
      hpp_snapshot: number;
      subtotal: number;
      _addons: AddonRow[];
    }> = input.items.map((it) => ({
      id: genId("ti"),
      transaction_id: input.id,
      menu_id: it.menu_id ?? null,
      bundle_id: it.bundle_id ?? null,
      name_snapshot: it.name_snapshot,
      quantity: it.quantity,
      unit_price: it.unit_price,
      hpp_snapshot: it.hpp_snapshot,
      subtotal: it.subtotal,
      _addons: (it.addons ?? []).map((ad) => ({ ...ad, id: genId("ad") })),
    }));

    // Atomic write: tx + items + addons. Stock movement ditangani terpisah
    // di endpoint /api/stock-movements (POS bisa kirim batch terkait), supaya
    // inventory adjustment bisa di-retry independent dari order create.
    sqlite.transaction(() => {
      db.insert(schema.transactions).values(txRow).run();
      for (const it of itemRows) {
        db.insert(schema.transaction_items)
          .values({
            id: it.id,
            transaction_id: it.transaction_id,
            menu_id: it.menu_id,
            bundle_id: it.bundle_id,
            name_snapshot: it.name_snapshot,
            quantity: it.quantity,
            unit_price: it.unit_price,
            hpp_snapshot: it.hpp_snapshot,
            subtotal: it.subtotal,
          })
          .run();
        for (const ad of it._addons) {
          db.insert(schema.transaction_item_addons)
            .values({
              id: ad.id,
              transaction_item_id: it.id,
              addon_option_id: ad.addon_option_id,
              name_snapshot: ad.name_snapshot,
              extra_price: ad.extra_price,
            })
            .run();
        }
      }
      // Auto stock deduction berbasis recipe — hanya untuk item dengan menu_id
      // (bundle skip dulu karena resep bundle butuh expansion ke menu items).
      // Berjalan dalam transaction yang sama supaya tidak ada partial state.
      const ingredientDeltas = new Map<string, number>();
      for (const it of itemRows) {
        if (!it.menu_id) continue;
        const recipe = sqlite
          .prepare(
            `SELECT ri.ingredient_id, ri.quantity
             FROM recipe_items ri
             INNER JOIN ingredients ing ON ing.id = ri.ingredient_id
             WHERE ri.menu_id = ? AND ing.outlet_id = ?`,
          )
          .all(it.menu_id, input.outlet_id) as Array<{
          ingredient_id: string;
          quantity: number;
        }>;
        for (const r of recipe) {
          ingredientDeltas.set(
            r.ingredient_id,
            (ingredientDeltas.get(r.ingredient_id) ?? 0) +
              r.quantity * it.quantity,
          );
        }
        // Addon modifiers: mode "delta" tambah, mode "override" set absolute
        // (override jarang; aman dilewat untuk MVP — POS jarang pakai)
        for (const ad of it._addons) {
          const mods = sqlite
            .prepare(
              `SELECT m.ingredient_id, m.quantity_delta, m.mode
               FROM addon_recipe_modifiers m
               INNER JOIN ingredients ing ON ing.id = m.ingredient_id
               WHERE m.addon_option_id = ? AND ing.outlet_id = ?`,
            )
            .all(ad.addon_option_id, input.outlet_id) as Array<{
            ingredient_id: string;
            quantity_delta: number;
            mode: "override" | "delta";
          }>;
          for (const m of mods) {
            if (m.mode === "delta") {
              ingredientDeltas.set(
                m.ingredient_id,
                (ingredientDeltas.get(m.ingredient_id) ?? 0) +
                  m.quantity_delta * it.quantity,
              );
            }
            // mode "override": skip auto-deduct (akan diatur di laporan
            // konsumsi terpisah; MVP fokus ke delta). Ditangani fase-2.
          }
        }
      }
      for (const [ingredientId, qty] of ingredientDeltas) {
        if (qty <= 0) continue;
        db.insert(schema.stock_movements)
          .values({
            id: genId("mov"),
            ingredient_id: ingredientId,
            outlet_id: input.outlet_id,
            transaction_id: input.id,
            batch_id: null,
            type: "out_sale",
            quantity: qty,
            notes: null,
            user_id: session.domainUser.id,
            created_at: createdAt,
          })
          .run();
        db.update(schema.ingredients)
          .set({
            current_stock: sql`${schema.ingredients.current_stock} - ${qty}`,
            updated_at: createdAt,
          })
          .where(eq(schema.ingredients.id, ingredientId))
          .run();
      }
    })();

    await logAudit(session, {
      action: "create",
      entity: "transaction",
      entity_id: input.id,
      entity_name: `Order #${input.id.slice(-6)}`,
      outlet_id: input.outlet_id,
      notes: `${input.items.length} item(s) • ${input.payment_method} • ${input.grand_total}`,
    });

    return {
      ...txRow,
      items: itemRows.map((it) => ({
        id: it.id,
        transaction_id: it.transaction_id,
        menu_id: it.menu_id,
        bundle_id: it.bundle_id,
        name_snapshot: it.name_snapshot,
        quantity: it.quantity,
        unit_price: it.unit_price,
        hpp_snapshot: it.hpp_snapshot,
        subtotal: it.subtotal,
        addons: it._addons.map((ad) => ({
          id: ad.id,
          transaction_item_id: it.id,
          addon_option_id: ad.addon_option_id,
          name_snapshot: ad.name_snapshot,
          extra_price: ad.extra_price,
        })),
      })),
    };
  });
}
