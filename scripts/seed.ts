/**
 * Database seed — writes every entity from the frontend mock into libSQL.
 *
 * Run:  npm run db:seed
 *
 * Strategy:
 * - `buildSeed()` is imported from the frontend mock layer, so the seed
 *   content (outlets, users, menus, transactions, etc.) stays in a single
 *   source of truth. If the frontend shape changes, the backend seed gets
 *   the update for free.
 * - Better Auth user creation uses `auth.$context.password.hash()` plus a
 *   direct insert into `user_auth` + `account`, because we disable self-
 *   signup globally. Each domain user gets a synthetic email
 *   `<slug(name)>@allee.local` so login by name still works.
 * - Safe to re-run: we truncate every table first inside one libsql batch
 *   so failure leaves the DB intact, regardless of file vs Turso.
 *
 * Works for both connection modes (auto-detected by `src/server/db/client.ts`):
 *   - Local file (DATABASE_URL=file:...) — instant, single-process.
 *   - Turso remote (TURSO_DATABASE_URL + TURSO_AUTH_TOKEN) — slower (each
 *     statement = HTTP round trip), but supports any region. Saat seed
 *     production, jangan kaget kalau makan 1–2 menit.
 */

import "./_env";
import { db, schema, client } from "../src/server/db/client";
import { auth } from "../src/server/auth";
import { buildSeed, DEMO_USER_PASSWORD } from "../src/lib/mock/seed";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function emailFor(name: string): string {
  return `${slugify(name)}@allee.local`;
}

/**
 * Chunked multi-row insert.
 *
 * Drizzle's `.values([...])` compiles to a single multi-row `INSERT`, so this
 * collapses N inserts into ⌈N / chunkSize⌉ round-trips. Critical when the DB
 * lives in Tokyo and round-trip latency dominates.
 *
 * Chunk size kept conservative (200) to stay well under libsql's per-statement
 * size limit; raise if you profile and want fewer batches.
 */
async function bulkInsert<T extends SQLiteTable, V>(
  table: T,
  rows: V[],
  chunkSize = 200,
): Promise<void> {
  if (rows.length === 0) return;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const slice = rows.slice(i, i + chunkSize);
    // Drizzle types want non-empty array — we already early-returned for 0.
    await db.insert(table).values(slice as never);
  }
}

// Order matters: child tables before parents to avoid FK violations during
// truncate. The libsql batch runs in a single transaction — semua atau gagal
// bersama, never partial.
const TRUNCATE_ORDER = [
  "transaction_item_addons",
  "transaction_items",
  "transactions",
  "stock_movements",
  "stock_opname_items",
  "stock_opnames",
  "ingredient_batches",
  "recipe_items",
  "menu_addon_groups",
  "menu_outlets",
  "bundle_items",
  "bundle_outlets",
  "bundles",
  "addon_recipe_modifiers",
  "addon_options",
  "addon_groups",
  "discounts",
  "ojol_sync_logs",
  "menu_channel_listings",
  "ojol_channels",
  "menus",
  "menu_categories",
  "ingredients",
  "audit_logs",
  "attendance",
  "checklist_templates",
  "sales_targets",
  "tax_settings",
  "attendance_settings",
  "account",
  "session",
  "verification",
  "user_auth",
  "users",
  "outlets",
];

async function main() {
  console.log("[seed] loading mock payload…");
  const data = buildSeed();

  console.log("[seed] truncating tables…");
  await client.batch(
    TRUNCATE_ORDER.map((table) => `DELETE FROM ${table};`),
    "write",
  );

  console.log("[seed] inserting outlets…");
  await bulkInsert(
    schema.outlets,
    data.outlets.map((o) => ({
      id: o.id,
      name: o.name,
      address: o.address,
      city: o.city,
      phone: o.phone,
      opening_hours: o.opening_hours,
      is_active: o.is_active,
      created_at: o.created_at,
    })),
  );

  console.log("[seed] inserting users…");
  await bulkInsert(
    schema.users,
    data.users.map((u) => ({
      id: u.id,
      name: u.name,
      role: u.role,
      outlet_id: u.outlet_id,
      contact: u.contact ?? null,
      is_active: u.is_active,
      joined_at: u.joined_at,
    })),
  );

  console.log("[seed] creating Better Auth identities…");
  const ctx = await auth.$context;
  const hash = ctx.password.hash;
  const now = new Date();
  // Hash passwords in parallel — bcrypt-ish work is CPU-bound and small (≈7 users).
  const authRows = await Promise.all(
    data.users.map(async (u) => {
      const hashed = await hash(DEMO_USER_PASSWORD);
      return {
        userAuth: {
          id: `au_${u.id}`,
          name: u.name,
          email: emailFor(u.name),
          emailVerified: true,
          image: null,
          createdAt: now,
          updatedAt: now,
          domain_user_id: u.id,
        },
        account: {
          id: `ac_${u.id}`,
          accountId: `au_${u.id}`,
          providerId: "credential",
          userId: `au_${u.id}`,
          password: hashed,
          createdAt: now,
          updatedAt: now,
        },
      };
    }),
  );
  await bulkInsert(
    schema.user_auth,
    authRows.map((r) => r.userAuth),
  );
  await bulkInsert(
    schema.account,
    authRows.map((r) => r.account),
  );

  console.log("[seed] inserting menu categories…");
  await bulkInsert(
    schema.menu_categories,
    data.categories.map((c) => ({
      id: c.id,
      name: c.name,
      sort_order: c.sort_order,
    })),
  );

  console.log("[seed] inserting ingredients…");
  await bulkInsert(
    schema.ingredients,
    data.ingredients.map((i) => ({
      id: i.id,
      outlet_id: i.outlet_id,
      name: i.name,
      unit: i.unit,
      unit_price: i.unit_price,
      current_stock: i.current_stock,
      min_qty: i.min_qty,
      storage_location: i.storage_location ?? null,
      updated_at: i.updated_at,
    })),
  );

  console.log("[seed] inserting menus + recipe…");
  await bulkInsert(
    schema.menus,
    data.menus.map((m) => ({
      id: m.id,
      category_id: m.category_id,
      name: m.name,
      sku: m.sku,
      price: m.price,
      hpp_cached: m.hpp_cached,
      photo_url: m.photo_url ?? null,
      description: m.description ?? null,
      type: m.type,
      is_active: m.is_active,
    })),
  );
  await bulkInsert(
    schema.menu_outlets,
    data.menus.flatMap((m) =>
      m.outlet_ids.map((oid) => ({ menu_id: m.id, outlet_id: oid })),
    ),
  );
  await bulkInsert(
    schema.recipe_items,
    data.recipes.map((r) => ({
      id: r.id,
      menu_id: r.menu_id,
      ingredient_id: r.ingredient_id,
      quantity: r.quantity,
      notes: r.notes ?? null,
    })),
  );

  console.log("[seed] inserting add-ons…");
  await bulkInsert(
    schema.addon_groups,
    data.addon_groups.map((g) => ({
      id: g.id,
      name: g.name,
      selection_type: g.selection_type,
      is_required: g.is_required,
    })),
  );
  await bulkInsert(
    schema.addon_options,
    data.addon_options.map((o) => ({
      id: o.id,
      addon_group_id: o.addon_group_id,
      name: o.name,
      extra_price: o.extra_price,
    })),
  );
  await bulkInsert(
    schema.addon_recipe_modifiers,
    data.addon_recipe_modifiers.map((m) => ({
      id: m.id,
      addon_option_id: m.addon_option_id,
      ingredient_id: m.ingredient_id,
      quantity_delta: m.quantity_delta,
      mode: m.mode,
    })),
  );
  await bulkInsert(
    schema.menu_addon_groups,
    data.menu_addon_groups.map((mag) => ({
      menu_id: mag.menu_id,
      addon_group_id: mag.addon_group_id,
    })),
  );

  console.log("[seed] inserting bundles…");
  await bulkInsert(
    schema.bundles,
    data.bundles.map((b) => ({
      id: b.id,
      name: b.name,
      price: b.price,
      is_active: b.is_active,
      photo_url: b.photo_url ?? null,
      description: b.description ?? null,
    })),
  );
  await bulkInsert(
    schema.bundle_outlets,
    data.bundles.flatMap((b) =>
      b.outlet_ids.map((oid) => ({ bundle_id: b.id, outlet_id: oid })),
    ),
  );
  await bulkInsert(
    schema.bundle_items,
    data.bundle_items.map((bi) => ({
      bundle_id: bi.bundle_id,
      menu_id: bi.menu_id,
      quantity: bi.quantity,
    })),
  );

  console.log("[seed] inserting discounts…");
  await bulkInsert(
    schema.discounts,
    data.discounts.map((d) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      value: d.value,
      scope: d.scope,
      scope_ref_id: d.scope_ref_id ?? null,
      start_at: d.start_at ?? null,
      end_at: d.end_at ?? null,
      active_hour_start: d.active_hour_start ?? null,
      active_hour_end: d.active_hour_end ?? null,
      is_active: d.is_active,
    })),
  );

  console.log(`[seed] inserting ${data.transactions.length} transactions…`);
  // Flatten 3 levels (transaction → items → addons) into 3 arrays so we can
  // bulk-insert each with a single round-trip per chunk. FK ordering is
  // preserved because parents go in before children.
  const txRows = data.transactions.map((t) => ({
    id: t.id,
    outlet_id: t.outlet_id,
    user_id: t.user_id,
    subtotal: t.subtotal,
    discount_total: t.discount_total,
    ppn_amount: t.ppn_amount,
    service_charge_amount: t.service_charge_amount,
    grand_total: t.grand_total,
    payment_method: t.payment_method,
    status: t.status,
    order_type: t.order_type,
    created_at: t.created_at,
    void_reason: t.void_reason ?? null,
    voided_by: t.voided_by ?? null,
    voided_at: t.voided_at ?? null,
  }));
  const itemRows = data.transactions.flatMap((t) =>
    t.items.map((it) => ({
      id: it.id,
      transaction_id: it.transaction_id,
      menu_id: it.menu_id,
      bundle_id: it.bundle_id,
      name_snapshot: it.name_snapshot,
      quantity: it.quantity,
      unit_price: it.unit_price,
      hpp_snapshot: it.hpp_snapshot,
      subtotal: it.subtotal,
    })),
  );
  const addonRows = data.transactions.flatMap((t) =>
    t.items.flatMap((it) =>
      it.addons.map((a) => ({
        id: a.id,
        transaction_item_id: a.transaction_item_id,
        addon_option_id: a.addon_option_id,
        name_snapshot: a.name_snapshot,
        extra_price: a.extra_price,
      })),
    ),
  );
  await bulkInsert(schema.transactions, txRows);
  await bulkInsert(schema.transaction_items, itemRows);
  await bulkInsert(schema.transaction_item_addons, addonRows);

  console.log(
    `[seed] inserting ${data.stock_movements.length} stock movements…`,
  );
  await bulkInsert(
    schema.stock_movements,
    data.stock_movements.map((m) => ({
      id: m.id,
      ingredient_id: m.ingredient_id,
      outlet_id: m.outlet_id,
      transaction_id: m.transaction_id ?? null,
      batch_id: m.batch_id ?? null,
      type: m.type,
      quantity: m.quantity,
      notes: m.notes ?? null,
      user_id: m.user_id,
      created_at: m.created_at,
    })),
  );

  console.log("[seed] inserting audit logs…");
  await bulkInsert(
    schema.audit_logs,
    data.audit_logs.map((a) => ({
      id: a.id,
      user_id: a.user_id,
      user_name: a.user_name,
      user_role: a.user_role,
      action: a.action,
      entity: a.entity,
      entity_id: a.entity_id,
      entity_name: a.entity_name,
      outlet_id: a.outlet_id ?? null,
      changes: a.changes,
      notes: a.notes ?? null,
      created_at: a.created_at,
    })),
  );

  console.log("[seed] inserting attendance + checklists…");
  await bulkInsert(
    schema.checklist_templates,
    data.checklist_templates.map((t) => ({
      id: t.id,
      station: t.station,
      type: t.type,
      label: t.label,
      sort_order: t.sort_order,
    })),
  );
  await bulkInsert(
    schema.attendance,
    data.attendances.map((a) => ({
      id: a.id,
      user_id: a.user_id,
      user_name: a.user_name,
      user_role: a.user_role,
      outlet_id: a.outlet_id,
      station: a.station,
      date: a.date,
      check_in_at: a.check_in_at,
      check_in_selfie: a.check_in_selfie,
      check_in_station_photo: a.check_in_station_photo,
      before_checklist: a.before_checklist,
      check_in_notes: a.check_in_notes ?? null,
      is_late: a.is_late ?? null,
      check_out_at: a.check_out_at ?? null,
      check_out_selfie: a.check_out_selfie ?? null,
      check_out_station_photo: a.check_out_station_photo ?? null,
      after_checklist: a.after_checklist ?? null,
      check_out_notes: a.check_out_notes ?? null,
    })),
  );

  console.log("[seed] inserting settings + sales targets…");
  await db.insert(schema.attendance_settings).values({
    id: "singleton",
    check_in_cutoff: data.attendance_settings.check_in_cutoff,
    updated_at: data.attendance_settings.updated_at,
  });
  await db.insert(schema.tax_settings).values({
    id: "singleton",
    ppn_percent: data.tax_settings.ppn_percent,
    service_charge_percent: data.tax_settings.service_charge_percent,
    updated_at: data.tax_settings.updated_at,
  });
  await bulkInsert(
    schema.sales_targets,
    data.sales_targets.map((t) => ({
      id: t.id,
      year: t.year,
      month: t.month,
      target_amount: t.target_amount,
      updated_at: t.updated_at,
    })),
  );

  // ─── Ojol integration ─────────────────────────────────────────────────
  console.log("[seed] inserting ojol channels + menu listings…");
  await bulkInsert(
    schema.ojol_channels,
    data.ojol_channels.map((c) => ({
      id: c.id,
      outlet_id: c.outlet_id,
      platform: c.platform,
      store_name: c.store_name,
      merchant_id: c.merchant_id,
      api_key: c.api_key,
      is_connected: c.is_connected,
      auto_sync: c.auto_sync,
      last_sync_at: c.last_sync_at ?? null,
      notes: c.notes ?? null,
    })),
  );
  await bulkInsert(
    schema.menu_channel_listings,
    data.menu_channel_listings.map((l) => ({
      id: l.id,
      menu_id: l.menu_id,
      platform: l.platform,
      price_override: l.price_override,
      is_available: l.is_available,
      sync_status: l.sync_status,
      last_sync_at: l.last_sync_at ?? null,
      sync_error: l.sync_error ?? null,
      external_id: l.external_id ?? null,
    })),
  );

  console.log("[seed] ✓ done. Demo password for every user: 'password'.");
  console.log("[seed]   email format: <name-slug>@allee.local");
  console.log("[seed]   example: budi@allee.local / password");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[seed] FAILED:", err);
    process.exit(1);
  });
