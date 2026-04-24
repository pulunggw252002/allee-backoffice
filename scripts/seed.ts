/**
 * Database seed — writes every entity from the frontend mock into SQLite.
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
 * - Safe to re-run: we truncate every table first inside a transaction so
 *   you always get a clean DB without deleting the file.
 */

import "dotenv/config";
import { db, schema, sqlite } from "../src/server/db/client";
import { auth } from "../src/server/auth";
import { buildSeed, DEMO_USER_PASSWORD } from "../src/lib/mock/seed";

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

async function main() {
  console.log("[seed] loading mock payload…");
  const data = buildSeed();

  console.log("[seed] truncating tables…");
  // Order matters: FKs cascade mostly, but truncating children first avoids
  // busy-waits on WAL. Keep in a transaction so failure leaves DB intact.
  const truncate = sqlite.transaction(() => {
    sqlite.exec("DELETE FROM transaction_item_addons;");
    sqlite.exec("DELETE FROM transaction_items;");
    sqlite.exec("DELETE FROM transactions;");
    sqlite.exec("DELETE FROM stock_movements;");
    sqlite.exec("DELETE FROM stock_opname_items;");
    sqlite.exec("DELETE FROM stock_opnames;");
    sqlite.exec("DELETE FROM ingredient_batches;");
    sqlite.exec("DELETE FROM recipe_items;");
    sqlite.exec("DELETE FROM menu_addon_groups;");
    sqlite.exec("DELETE FROM menu_outlets;");
    sqlite.exec("DELETE FROM bundle_items;");
    sqlite.exec("DELETE FROM bundle_outlets;");
    sqlite.exec("DELETE FROM bundles;");
    sqlite.exec("DELETE FROM addon_recipe_modifiers;");
    sqlite.exec("DELETE FROM addon_options;");
    sqlite.exec("DELETE FROM addon_groups;");
    sqlite.exec("DELETE FROM discounts;");
    // Ojol tables reference menus/outlets, so purge them before we nuke the
    // parents. `ojol_sync_logs` has no seed content today but we still wipe
    // it so demo re-seeds don't accumulate stale run history.
    sqlite.exec("DELETE FROM ojol_sync_logs;");
    sqlite.exec("DELETE FROM menu_channel_listings;");
    sqlite.exec("DELETE FROM ojol_channels;");
    sqlite.exec("DELETE FROM menus;");
    sqlite.exec("DELETE FROM menu_categories;");
    sqlite.exec("DELETE FROM ingredients;");
    sqlite.exec("DELETE FROM audit_logs;");
    sqlite.exec("DELETE FROM attendance;");
    sqlite.exec("DELETE FROM checklist_templates;");
    sqlite.exec("DELETE FROM sales_targets;");
    sqlite.exec("DELETE FROM tax_settings;");
    sqlite.exec("DELETE FROM attendance_settings;");
    sqlite.exec("DELETE FROM account;");
    sqlite.exec("DELETE FROM session;");
    sqlite.exec("DELETE FROM verification;");
    sqlite.exec("DELETE FROM user_auth;");
    sqlite.exec("DELETE FROM users;");
    sqlite.exec("DELETE FROM outlets;");
  });
  truncate();

  console.log("[seed] inserting outlets…");
  for (const o of data.outlets) {
    await db.insert(schema.outlets).values({
      id: o.id,
      name: o.name,
      address: o.address,
      city: o.city,
      phone: o.phone,
      opening_hours: o.opening_hours,
      is_active: o.is_active,
      created_at: o.created_at,
    });
  }

  console.log("[seed] inserting users…");
  for (const u of data.users) {
    await db.insert(schema.users).values({
      id: u.id,
      name: u.name,
      role: u.role,
      outlet_id: u.outlet_id,
      contact: u.contact ?? null,
      is_active: u.is_active,
      joined_at: u.joined_at,
    });
  }

  console.log("[seed] creating Better Auth identities…");
  const ctx = await auth.$context;
  const hash = ctx.password.hash;
  const now = new Date();
  for (const u of data.users) {
    const email = emailFor(u.name);
    const authId = `au_${u.id}`;
    const hashed = await hash(DEMO_USER_PASSWORD);
    await db.insert(schema.user_auth).values({
      id: authId,
      name: u.name,
      email,
      emailVerified: true,
      image: null,
      createdAt: now,
      updatedAt: now,
      domain_user_id: u.id,
    });
    await db.insert(schema.account).values({
      id: `ac_${u.id}`,
      accountId: authId,
      providerId: "credential",
      userId: authId,
      password: hashed,
      createdAt: now,
      updatedAt: now,
    });
  }

  console.log("[seed] inserting menu categories…");
  for (const c of data.categories) {
    await db.insert(schema.menu_categories).values({
      id: c.id,
      name: c.name,
      sort_order: c.sort_order,
    });
  }

  console.log("[seed] inserting ingredients…");
  for (const i of data.ingredients) {
    await db.insert(schema.ingredients).values({
      id: i.id,
      outlet_id: i.outlet_id,
      name: i.name,
      unit: i.unit,
      unit_price: i.unit_price,
      current_stock: i.current_stock,
      min_qty: i.min_qty,
      storage_location: i.storage_location ?? null,
      updated_at: i.updated_at,
    });
  }

  console.log("[seed] inserting menus + recipe…");
  for (const m of data.menus) {
    await db.insert(schema.menus).values({
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
    });
    for (const oid of m.outlet_ids) {
      await db
        .insert(schema.menu_outlets)
        .values({ menu_id: m.id, outlet_id: oid });
    }
  }
  for (const r of data.recipes) {
    await db.insert(schema.recipe_items).values({
      id: r.id,
      menu_id: r.menu_id,
      ingredient_id: r.ingredient_id,
      quantity: r.quantity,
      notes: r.notes ?? null,
    });
  }

  console.log("[seed] inserting add-ons…");
  for (const g of data.addon_groups) {
    await db.insert(schema.addon_groups).values({
      id: g.id,
      name: g.name,
      selection_type: g.selection_type,
      is_required: g.is_required,
    });
  }
  for (const o of data.addon_options) {
    await db.insert(schema.addon_options).values({
      id: o.id,
      addon_group_id: o.addon_group_id,
      name: o.name,
      extra_price: o.extra_price,
    });
  }
  for (const m of data.addon_recipe_modifiers) {
    await db.insert(schema.addon_recipe_modifiers).values({
      id: m.id,
      addon_option_id: m.addon_option_id,
      ingredient_id: m.ingredient_id,
      quantity_delta: m.quantity_delta,
      mode: m.mode,
    });
  }
  for (const mag of data.menu_addon_groups) {
    await db.insert(schema.menu_addon_groups).values({
      menu_id: mag.menu_id,
      addon_group_id: mag.addon_group_id,
    });
  }

  console.log("[seed] inserting bundles…");
  for (const b of data.bundles) {
    await db.insert(schema.bundles).values({
      id: b.id,
      name: b.name,
      price: b.price,
      is_active: b.is_active,
      photo_url: b.photo_url ?? null,
      description: b.description ?? null,
    });
    for (const oid of b.outlet_ids) {
      await db
        .insert(schema.bundle_outlets)
        .values({ bundle_id: b.id, outlet_id: oid });
    }
  }
  for (const bi of data.bundle_items) {
    await db.insert(schema.bundle_items).values({
      bundle_id: bi.bundle_id,
      menu_id: bi.menu_id,
      quantity: bi.quantity,
    });
  }

  console.log("[seed] inserting discounts…");
  for (const d of data.discounts) {
    await db.insert(schema.discounts).values({
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
    });
  }

  console.log(`[seed] inserting ${data.transactions.length} transactions…`);
  const txInsert = sqlite.transaction(() => {
    for (const t of data.transactions) {
      sqlite
        .prepare(
          `INSERT INTO transactions (id, outlet_id, user_id, subtotal, discount_total, ppn_amount, service_charge_amount, grand_total, payment_method, status, order_type, created_at, void_reason, voided_by, voided_at)
           VALUES (@id,@outlet_id,@user_id,@subtotal,@discount_total,@ppn_amount,@service_charge_amount,@grand_total,@payment_method,@status,@order_type,@created_at,@void_reason,@voided_by,@voided_at)`,
        )
        .run({
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
        });
      for (const it of t.items) {
        sqlite
          .prepare(
            `INSERT INTO transaction_items (id, transaction_id, menu_id, bundle_id, name_snapshot, quantity, unit_price, hpp_snapshot, subtotal)
             VALUES (@id,@transaction_id,@menu_id,@bundle_id,@name_snapshot,@quantity,@unit_price,@hpp_snapshot,@subtotal)`,
          )
          .run({
            id: it.id,
            transaction_id: it.transaction_id,
            menu_id: it.menu_id,
            bundle_id: it.bundle_id,
            name_snapshot: it.name_snapshot,
            quantity: it.quantity,
            unit_price: it.unit_price,
            hpp_snapshot: it.hpp_snapshot,
            subtotal: it.subtotal,
          });
        for (const a of it.addons) {
          sqlite
            .prepare(
              `INSERT INTO transaction_item_addons (id, transaction_item_id, addon_option_id, name_snapshot, extra_price)
               VALUES (@id,@transaction_item_id,@addon_option_id,@name_snapshot,@extra_price)`,
            )
            .run({
              id: a.id,
              transaction_item_id: a.transaction_item_id,
              addon_option_id: a.addon_option_id,
              name_snapshot: a.name_snapshot,
              extra_price: a.extra_price,
            });
        }
      }
    }
  });
  txInsert();

  console.log(
    `[seed] inserting ${data.stock_movements.length} stock movements…`,
  );
  const movInsert = sqlite.transaction(() => {
    for (const m of data.stock_movements) {
      sqlite
        .prepare(
          `INSERT INTO stock_movements (id, ingredient_id, outlet_id, transaction_id, batch_id, type, quantity, notes, user_id, created_at)
           VALUES (@id,@ingredient_id,@outlet_id,@transaction_id,@batch_id,@type,@quantity,@notes,@user_id,@created_at)`,
        )
        .run({
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
        });
    }
  });
  movInsert();

  console.log("[seed] inserting audit logs…");
  for (const a of data.audit_logs) {
    await db.insert(schema.audit_logs).values({
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
    });
  }

  console.log("[seed] inserting attendance + checklists…");
  for (const t of data.checklist_templates) {
    await db.insert(schema.checklist_templates).values({
      id: t.id,
      station: t.station,
      type: t.type,
      label: t.label,
      sort_order: t.sort_order,
    });
  }
  for (const a of data.attendances) {
    await db.insert(schema.attendance).values({
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
    });
  }

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
  for (const t of data.sales_targets) {
    await db.insert(schema.sales_targets).values({
      id: t.id,
      year: t.year,
      month: t.month,
      target_amount: t.target_amount,
      updated_at: t.updated_at,
    });
  }

  // ─── Ojol integration ─────────────────────────────────────────────────
  console.log("[seed] inserting ojol channels + menu listings…");
  for (const c of data.ojol_channels) {
    await db.insert(schema.ojol_channels).values({
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
    });
  }
  for (const l of data.menu_channel_listings) {
    await db.insert(schema.menu_channel_listings).values({
      id: l.id,
      menu_id: l.menu_id,
      platform: l.platform,
      price_override: l.price_override,
      is_available: l.is_available,
      sync_status: l.sync_status,
      last_sync_at: l.last_sync_at ?? null,
      sync_error: l.sync_error ?? null,
      external_id: l.external_id ?? null,
    });
  }

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
