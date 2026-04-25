/**
 * Drizzle ORM schema — mirrors the domain model in `src/types/index.ts`.
 *
 * SQLite conventions used here:
 * - Booleans are stored as integer 0/1 via `{ mode: "boolean" }`.
 * - Timestamps are stored as ISO-8601 strings (TEXT) to match the frontend
 *   (which never touches Date objects directly). Keeps JSON serialization
 *   trivial and timezone-explicit.
 * - Arrays / nested JSON are stored as TEXT with `{ mode: "json" }`.
 * - Primary keys are string IDs (generated app-side via `genId()`), matching
 *   the mock layer so frontend queries don't need to change.
 *
 * Better Auth tables (user_auth, session, account, verification) live in this
 * same schema so the auth adapter can share the connection.
 */

import { relations, sql } from "drizzle-orm";
import {
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

// ────────────────────────────────────────────────────────────────────────────
// Core tenancy
// ────────────────────────────────────────────────────────────────────────────

export const outlets = sqliteTable("outlets", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull().default(""),
  city: text("city").notNull().default(""),
  phone: text("phone").notNull().default(""),
  opening_hours: text("opening_hours").notNull().default(""),
  is_active: integer("is_active", { mode: "boolean" }).notNull().default(true),
  created_at: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

/**
 * Domain users (staff). Separate from Better Auth's `user_auth` table —
 * auth identity is linked via `user_auth.domain_user_id`. A domain user can
 * exist without a login (e.g. waiters who only clock in via the POS app).
 */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role", {
    enum: ["owner", "kepala_toko", "kasir", "kitchen", "barista", "waiters"],
  }).notNull(),
  outlet_id: text("outlet_id").references(() => outlets.id, {
    onDelete: "set null",
  }),
  contact: text("contact"),
  is_active: integer("is_active", { mode: "boolean" }).notNull().default(true),
  joined_at: text("joined_at")
    .notNull()
    .default(sql`(current_timestamp)`),
  /**
   * Hashed 4-6 digit numeric PIN for POS-app login. Nullable ⇒ staff has
   * no POS access yet. Stored as bcrypt hash (never plain-text). Verified
   * at POS-login time against the submitted PIN.
   */
  pos_pin_hash: text("pos_pin_hash"),
});

// ────────────────────────────────────────────────────────────────────────────
// Inventory
// ────────────────────────────────────────────────────────────────────────────

export const ingredients = sqliteTable("ingredients", {
  id: text("id").primaryKey(),
  outlet_id: text("outlet_id")
    .notNull()
    .references(() => outlets.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  unit: text("unit").notNull(),
  unit_price: real("unit_price").notNull().default(0),
  current_stock: real("current_stock").notNull().default(0),
  min_qty: real("min_qty").notNull().default(0),
  storage_location: text("storage_location"),
  updated_at: text("updated_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const ingredient_batches = sqliteTable("ingredient_batches", {
  id: text("id").primaryKey(),
  ingredient_id: text("ingredient_id")
    .notNull()
    .references(() => ingredients.id, { onDelete: "cascade" }),
  batch_number: text("batch_number"),
  quantity: real("quantity").notNull(),
  received_date: text("received_date").notNull(),
  expiry_date: text("expiry_date"),
  purchase_price: real("purchase_price"),
});

export const stock_movements = sqliteTable("stock_movements", {
  id: text("id").primaryKey(),
  ingredient_id: text("ingredient_id")
    .notNull()
    .references(() => ingredients.id, { onDelete: "cascade" }),
  outlet_id: text("outlet_id")
    .notNull()
    .references(() => outlets.id, { onDelete: "cascade" }),
  /** Transactions that triggered the movement (for `out_sale`). Nullable for manual adjustments. */
  transaction_id: text("transaction_id"),
  batch_id: text("batch_id"),
  type: text("type", {
    enum: ["in", "out_sale", "out_waste", "adjustment", "opname"],
  }).notNull(),
  quantity: real("quantity").notNull(),
  notes: text("notes"),
  user_id: text("user_id").notNull(),
  created_at: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

// ────────────────────────────────────────────────────────────────────────────
// Menu / Recipe / Add-ons / Bundles / Discounts
// ────────────────────────────────────────────────────────────────────────────

export const menu_categories = sqliteTable("menu_categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  sort_order: integer("sort_order").notNull().default(0),
});

export const menus = sqliteTable("menus", {
  id: text("id").primaryKey(),
  category_id: text("category_id")
    .notNull()
    .references(() => menu_categories.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  sku: text("sku").notNull(),
  price: real("price").notNull().default(0),
  hpp_cached: real("hpp_cached").notNull().default(0),
  photo_url: text("photo_url"),
  description: text("description"),
  type: text("type", { enum: ["regular", "bundle"] })
    .notNull()
    .default("regular"),
  is_active: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

/** Many-to-many: which outlets carry a given menu. */
export const menu_outlets = sqliteTable(
  "menu_outlets",
  {
    menu_id: text("menu_id")
      .notNull()
      .references(() => menus.id, { onDelete: "cascade" }),
    outlet_id: text("outlet_id")
      .notNull()
      .references(() => outlets.id, { onDelete: "cascade" }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.menu_id, t.outlet_id] }) }),
);

export const recipe_items = sqliteTable("recipe_items", {
  id: text("id").primaryKey(),
  menu_id: text("menu_id")
    .notNull()
    .references(() => menus.id, { onDelete: "cascade" }),
  ingredient_id: text("ingredient_id")
    .notNull()
    .references(() => ingredients.id, { onDelete: "restrict" }),
  quantity: real("quantity").notNull(),
  notes: text("notes"),
});

export const addon_groups = sqliteTable("addon_groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  selection_type: text("selection_type", { enum: ["single", "multi"] })
    .notNull()
    .default("single"),
  is_required: integer("is_required", { mode: "boolean" })
    .notNull()
    .default(false),
});

export const addon_options = sqliteTable("addon_options", {
  id: text("id").primaryKey(),
  addon_group_id: text("addon_group_id")
    .notNull()
    .references(() => addon_groups.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  extra_price: real("extra_price").notNull().default(0),
});

export const addon_recipe_modifiers = sqliteTable("addon_recipe_modifiers", {
  id: text("id").primaryKey(),
  addon_option_id: text("addon_option_id")
    .notNull()
    .references(() => addon_options.id, { onDelete: "cascade" }),
  ingredient_id: text("ingredient_id")
    .notNull()
    .references(() => ingredients.id, { onDelete: "cascade" }),
  quantity_delta: real("quantity_delta").notNull(),
  mode: text("mode", { enum: ["override", "delta"] })
    .notNull()
    .default("delta"),
});

export const menu_addon_groups = sqliteTable(
  "menu_addon_groups",
  {
    menu_id: text("menu_id")
      .notNull()
      .references(() => menus.id, { onDelete: "cascade" }),
    addon_group_id: text("addon_group_id")
      .notNull()
      .references(() => addon_groups.id, { onDelete: "cascade" }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.menu_id, t.addon_group_id] }) }),
);

export const bundles = sqliteTable("bundles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  price: real("price").notNull().default(0),
  is_active: integer("is_active", { mode: "boolean" }).notNull().default(true),
  photo_url: text("photo_url"),
  description: text("description"),
});

export const bundle_outlets = sqliteTable(
  "bundle_outlets",
  {
    bundle_id: text("bundle_id")
      .notNull()
      .references(() => bundles.id, { onDelete: "cascade" }),
    outlet_id: text("outlet_id")
      .notNull()
      .references(() => outlets.id, { onDelete: "cascade" }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.bundle_id, t.outlet_id] }) }),
);

export const bundle_items = sqliteTable(
  "bundle_items",
  {
    bundle_id: text("bundle_id")
      .notNull()
      .references(() => bundles.id, { onDelete: "cascade" }),
    menu_id: text("menu_id")
      .notNull()
      .references(() => menus.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull().default(1),
  },
  (t) => ({ pk: primaryKey({ columns: [t.bundle_id, t.menu_id] }) }),
);

export const discounts = sqliteTable("discounts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type", { enum: ["percent", "nominal"] }).notNull(),
  value: real("value").notNull().default(0),
  scope: text("scope", { enum: ["all", "category", "menu"] })
    .notNull()
    .default("all"),
  scope_ref_id: text("scope_ref_id"),
  start_at: text("start_at"),
  end_at: text("end_at"),
  active_hour_start: text("active_hour_start"),
  active_hour_end: text("active_hour_end"),
  is_active: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

// ────────────────────────────────────────────────────────────────────────────
// Transactions (sales)
// ────────────────────────────────────────────────────────────────────────────

export const transactions = sqliteTable("transactions", {
  id: text("id").primaryKey(),
  outlet_id: text("outlet_id")
    .notNull()
    .references(() => outlets.id, { onDelete: "restrict" }),
  user_id: text("user_id").notNull(),
  subtotal: real("subtotal").notNull().default(0),
  discount_total: real("discount_total").notNull().default(0),
  ppn_amount: real("ppn_amount").notNull().default(0),
  service_charge_amount: real("service_charge_amount").notNull().default(0),
  grand_total: real("grand_total").notNull().default(0),
  payment_method: text("payment_method", {
    enum: ["cash", "qris", "card", "transfer"],
  }).notNull(),
  status: text("status", {
    enum: ["open", "paid", "canceled", "refunded", "void"],
  })
    .notNull()
    .default("paid"),
  order_type: text("order_type", {
    enum: ["dine_in", "take_away", "delivery", "online"],
  })
    .notNull()
    .default("dine_in"),
  created_at: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
  void_reason: text("void_reason"),
  voided_by: text("voided_by"),
  voided_at: text("voided_at"),
});

export const transaction_items = sqliteTable("transaction_items", {
  id: text("id").primaryKey(),
  transaction_id: text("transaction_id")
    .notNull()
    .references(() => transactions.id, { onDelete: "cascade" }),
  menu_id: text("menu_id"),
  bundle_id: text("bundle_id"),
  name_snapshot: text("name_snapshot").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unit_price: real("unit_price").notNull().default(0),
  hpp_snapshot: real("hpp_snapshot").notNull().default(0),
  subtotal: real("subtotal").notNull().default(0),
  // Per-item void (granularity: satu menu di dalam struk).
  // Set saat kasir tandai item ini gagal di POS — sisa struk tetap valid revenue.
  // Stok TIDAK dikembalikan: bahan sudah dipakai → dihitung sebagai kerugian
  // operasional. Laporan Void agregasi by `menu_id` dari kolom ini.
  // Tx-level void columns (`transactions.void_*`) di-deprecated untuk data
  // baru; masih dibaca untuk backward-compat dengan data lama.
  voided_at: text("voided_at"),
  voided_by: text("voided_by"),
  void_reason: text("void_reason"),
});

export const transaction_item_addons = sqliteTable("transaction_item_addons", {
  id: text("id").primaryKey(),
  transaction_item_id: text("transaction_item_id")
    .notNull()
    .references(() => transaction_items.id, { onDelete: "cascade" }),
  addon_option_id: text("addon_option_id").notNull(),
  name_snapshot: text("name_snapshot").notNull(),
  extra_price: real("extra_price").notNull().default(0),
});

// ────────────────────────────────────────────────────────────────────────────
// Audit / Opname / Attendance / Settings / Targets
// ────────────────────────────────────────────────────────────────────────────

export const audit_logs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  user_id: text("user_id").notNull(),
  user_name: text("user_name").notNull(),
  user_role: text("user_role").notNull(),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entity_id: text("entity_id").notNull(),
  entity_name: text("entity_name").notNull(),
  outlet_id: text("outlet_id"),
  changes: text("changes", { mode: "json" }).$type<
    Array<{ field: string; before?: unknown; after?: unknown }>
  >(),
  notes: text("notes"),
  created_at: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const stock_opnames = sqliteTable("stock_opnames", {
  id: text("id").primaryKey(),
  outlet_id: text("outlet_id")
    .notNull()
    .references(() => outlets.id, { onDelete: "cascade" }),
  user_id: text("user_id").notNull(),
  status: text("status", { enum: ["pending", "approved", "rejected"] })
    .notNull()
    .default("pending"),
  notes: text("notes"),
  created_at: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const stock_opname_items = sqliteTable("stock_opname_items", {
  opname_id: text("opname_id")
    .notNull()
    .references(() => stock_opnames.id, { onDelete: "cascade" }),
  ingredient_id: text("ingredient_id")
    .notNull()
    .references(() => ingredients.id, { onDelete: "restrict" }),
  system_qty: real("system_qty").notNull(),
  actual_qty: real("actual_qty").notNull(),
  diff: real("diff").notNull(),
});

export const attendance = sqliteTable("attendance", {
  id: text("id").primaryKey(),
  user_id: text("user_id").notNull(),
  user_name: text("user_name").notNull(),
  user_role: text("user_role").notNull(),
  outlet_id: text("outlet_id").notNull(),
  station: text("station", {
    enum: ["bar", "kitchen", "cashier", "service", "management"],
  }).notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  check_in_at: text("check_in_at").notNull(),
  check_in_selfie: text("check_in_selfie").notNull(),
  check_in_station_photo: text("check_in_station_photo").notNull(),
  before_checklist: text("before_checklist", { mode: "json" })
    .$type<Array<{ id: string; label: string; done: boolean }>>()
    .notNull(),
  check_in_notes: text("check_in_notes"),
  is_late: integer("is_late", { mode: "boolean" }),
  check_out_at: text("check_out_at"),
  check_out_selfie: text("check_out_selfie"),
  check_out_station_photo: text("check_out_station_photo"),
  after_checklist: text("after_checklist", { mode: "json" }).$type<
    Array<{ id: string; label: string; done: boolean }>
  >(),
  check_out_notes: text("check_out_notes"),
});

export const checklist_templates = sqliteTable("checklist_templates", {
  id: text("id").primaryKey(),
  station: text("station", {
    enum: ["bar", "kitchen", "cashier", "service", "management"],
  }).notNull(),
  type: text("type", { enum: ["before", "after"] }).notNull(),
  label: text("label").notNull(),
  sort_order: integer("sort_order").notNull().default(0),
});

/**
 * Singleton config tables — one row per table, enforced by fixed primary key.
 * Using string IDs so we never rely on SQLite ROWID being 1.
 */
export const attendance_settings = sqliteTable("attendance_settings", {
  id: text("id").primaryKey().default("singleton"),
  check_in_cutoff: text("check_in_cutoff").notNull().default("09:00"),
  updated_at: text("updated_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const tax_settings = sqliteTable("tax_settings", {
  id: text("id").primaryKey().default("singleton"),
  ppn_percent: real("ppn_percent").notNull().default(11),
  service_charge_percent: real("service_charge_percent").notNull().default(0),
  updated_at: text("updated_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

/**
 * POS shift summaries — append-only audit table yang di-isi oleh POS
 * setiap kali kasir tutup shift (POST /api/pos-shifts dari POS).
 *
 * Bukan source of truth untuk transaksi (itu `transactions`). Tabel ini
 * murni summary per-cashier per-shift untuk laporan "rekap kas":
 *   - opening_cash, expected_cash, actual_cash → cash difference
 *   - breakdown method → cocokin dengan revenue dari transactions
 *
 * Idempotency: PK = shift id POS, jadi POST ulang dengan id sama (retry)
 * cukup di-update — tidak akan double-insert.
 */
export const pos_shifts = sqliteTable("pos_shifts", {
  id: text("id").primaryKey(),
  outlet_id: text("outlet_id")
    .notNull()
    .references(() => outlets.id, { onDelete: "restrict" }),
  cashier_user_id: text("cashier_user_id").notNull(),
  cashier_name: text("cashier_name").notNull(),
  opening_cash: real("opening_cash").notNull().default(0),
  actual_cash: real("actual_cash").notNull().default(0),
  expected_cash: real("expected_cash").notNull().default(0),
  cash_difference: real("cash_difference").notNull().default(0),
  total_revenue: real("total_revenue").notNull().default(0),
  order_count: integer("order_count").notNull().default(0),
  /** JSON: { cash, qris, card, transfer } */
  breakdown: text("breakdown", { mode: "json" })
    .$type<Record<string, number>>()
    .notNull()
    .default({}),
  note: text("note"),
  opened_at: text("opened_at").notNull(),
  closed_at: text("closed_at").notNull(),
  /** Server timestamp saat row di-insert/upsert. */
  synced_at: text("synced_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const sales_targets = sqliteTable("sales_targets", {
  id: text("id").primaryKey(),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  target_amount: real("target_amount").notNull().default(0),
  updated_at: text("updated_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

// ────────────────────────────────────────────────────────────────────────────
// Ojol (online food delivery) integration
// ────────────────────────────────────────────────────────────────────────────
// One row per (outlet, platform). `api_key` is stored server-side only and
// never sent to the browser in plain form (the API route masks it to the
// last 4 characters on read).

export const ojol_channels = sqliteTable("ojol_channels", {
  id: text("id").primaryKey(),
  outlet_id: text("outlet_id")
    .notNull()
    .references(() => outlets.id, { onDelete: "cascade" }),
  platform: text("platform", {
    enum: ["gofood", "grabfood", "shopeefood"],
  }).notNull(),
  store_name: text("store_name").notNull().default(""),
  merchant_id: text("merchant_id").notNull().default(""),
  api_key: text("api_key").notNull().default(""),
  is_connected: integer("is_connected", { mode: "boolean" })
    .notNull()
    .default(false),
  auto_sync: integer("auto_sync", { mode: "boolean" }).notNull().default(false),
  last_sync_at: text("last_sync_at"),
  notes: text("notes"),
});

export const menu_channel_listings = sqliteTable("menu_channel_listings", {
  id: text("id").primaryKey(),
  menu_id: text("menu_id")
    .notNull()
    .references(() => menus.id, { onDelete: "cascade" }),
  platform: text("platform", {
    enum: ["gofood", "grabfood", "shopeefood"],
  }).notNull(),
  /** Null ⇒ use `menus.price`. Per-channel markup / markdown override. */
  price_override: real("price_override"),
  is_available: integer("is_available", { mode: "boolean" })
    .notNull()
    .default(true),
  sync_status: text("sync_status", {
    enum: ["synced", "pending", "failed"],
  })
    .notNull()
    .default("pending"),
  last_sync_at: text("last_sync_at"),
  sync_error: text("sync_error"),
  external_id: text("external_id"),
});

export const ojol_sync_logs = sqliteTable("ojol_sync_logs", {
  id: text("id").primaryKey(),
  outlet_id: text("outlet_id")
    .notNull()
    .references(() => outlets.id, { onDelete: "cascade" }),
  platform: text("platform", {
    enum: ["gofood", "grabfood", "shopeefood"],
  }).notNull(),
  triggered_by_user_id: text("triggered_by_user_id").notNull(),
  triggered_by_name: text("triggered_by_name").notNull(),
  started_at: text("started_at").notNull(),
  completed_at: text("completed_at"),
  status: text("status", {
    enum: ["success", "partial", "failed", "running"],
  }).notNull(),
  items_total: integer("items_total").notNull().default(0),
  items_synced: integer("items_synced").notNull().default(0),
  items_failed: integer("items_failed").notNull().default(0),
  notes: text("notes"),
});

// ────────────────────────────────────────────────────────────────────────────
// Better Auth tables
// ────────────────────────────────────────────────────────────────────────────
// Follows Better Auth's default schema shape. The `user_auth.domain_user_id`
// FK links an auth identity to the domain `users` record so role + outlet
// checks use one source of truth.

export const user_auth = sqliteTable("user_auth", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified", { mode: "boolean" })
    .notNull()
    .default(false),
  image: text("image"),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  /** FK to domain `users.id` — resolves role + outlet for authorization. */
  domain_user_id: text("domain_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user_auth.id, { onDelete: "cascade" }),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user_auth.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: integer("accessTokenExpiresAt", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refreshTokenExpiresAt", {
    mode: "timestamp",
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
});

// ────────────────────────────────────────────────────────────────────────────
// Relations (optional — helps query builder infer joins)
// ────────────────────────────────────────────────────────────────────────────

export const transactionsRelations = relations(transactions, ({ many }) => ({
  items: many(transaction_items),
}));

export const transactionItemsRelations = relations(
  transaction_items,
  ({ one, many }) => ({
    transaction: one(transactions, {
      fields: [transaction_items.transaction_id],
      references: [transactions.id],
    }),
    addons: many(transaction_item_addons),
  }),
);

export const transactionItemAddonsRelations = relations(
  transaction_item_addons,
  ({ one }) => ({
    item: one(transaction_items, {
      fields: [transaction_item_addons.transaction_item_id],
      references: [transaction_items.id],
    }),
  }),
);

export const menusRelations = relations(menus, ({ one, many }) => ({
  category: one(menu_categories, {
    fields: [menus.category_id],
    references: [menu_categories.id],
  }),
  recipe_items: many(recipe_items),
  menu_outlets: many(menu_outlets),
  menu_addon_groups: many(menu_addon_groups),
}));

export const recipeItemsRelations = relations(recipe_items, ({ one }) => ({
  menu: one(menus, {
    fields: [recipe_items.menu_id],
    references: [menus.id],
  }),
  ingredient: one(ingredients, {
    fields: [recipe_items.ingredient_id],
    references: [ingredients.id],
  }),
}));

export const bundlesRelations = relations(bundles, ({ many }) => ({
  items: many(bundle_items),
  outlets: many(bundle_outlets),
}));

export const addonGroupsRelations = relations(addon_groups, ({ many }) => ({
  options: many(addon_options),
}));

export const addonOptionsRelations = relations(addon_options, ({ many }) => ({
  modifiers: many(addon_recipe_modifiers),
}));

export const opnameRelations = relations(stock_opnames, ({ many }) => ({
  items: many(stock_opname_items),
}));

export const userAuthRelations = relations(user_auth, ({ one }) => ({
  domain_user: one(users, {
    fields: [user_auth.domain_user_id],
    references: [users.id],
  }),
}));
