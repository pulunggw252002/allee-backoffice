export type Role =
  | "owner"
  | "kepala_toko"
  | "kasir"
  | "kitchen"
  | "barista"
  | "waiters";

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  kepala_toko: "Kepala Toko",
  kasir: "Kasir",
  kitchen: "Kitchen",
  barista: "Barista",
  waiters: "Waiters",
};

export interface Outlet {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  opening_hours: string;
  is_active: boolean;
  created_at: string;
  /** Brand di header struk. NULL ⇒ fallback ke `name`. */
  brand_name?: string | null;
  /** Tagline kecil di bawah brand name. */
  brand_subtitle?: string | null;
  /**
   * JSON-stringified array of strings — line-by-line footer struk.
   * Cara baca: JSON.parse(outlet.receipt_footer) → string[].
   */
  receipt_footer?: string | null;
  /** NPWP outlet (kalau PKP). */
  tax_id?: string | null;
}

export interface User {
  id: string;
  name: string;
  password: string;
  role: Role;
  outlet_id: string | null;
  contact?: string;
  is_active: boolean;
  joined_at: string;
  /**
   * 4-6 digit numeric PIN used by staff to log in to the POS app on the
   * floor (separate identity from the backoffice password). Nullable ⇒
   * user does not yet have POS access set by the Owner. Stored plain-text
   * in mock; the real backend hashes before persisting.
   */
  pos_pin?: string | null;
}

export interface Ingredient {
  id: string;
  outlet_id: string;
  name: string;
  unit: string;
  unit_price: number;
  current_stock: number;
  min_qty: number;
  storage_location?: string;
  updated_at: string;
}

export interface IngredientBatch {
  id: string;
  ingredient_id: string;
  batch_number?: string;
  quantity: number;
  received_date: string;
  expiry_date?: string;
  purchase_price?: number;
}

export interface MenuCategory {
  id: string;
  name: string;
  sort_order: number;
}

export type MenuType = "regular" | "bundle";

export interface Menu {
  id: string;
  category_id: string;
  name: string;
  sku: string;
  price: number;
  hpp_cached: number;
  photo_url?: string;
  description?: string;
  type: MenuType;
  is_active: boolean;
  outlet_ids: string[];
}

export interface RecipeItem {
  id: string;
  menu_id: string;
  ingredient_id: string;
  quantity: number;
  notes?: string;
}

export type AddonSelectionType = "single" | "multi";

export interface AddonGroup {
  id: string;
  name: string;
  selection_type: AddonSelectionType;
  is_required: boolean;
}

export interface AddonOption {
  id: string;
  addon_group_id: string;
  name: string;
  extra_price: number;
}

export type AddonModifierMode = "override" | "delta";

export interface AddonRecipeModifier {
  id: string;
  addon_option_id: string;
  ingredient_id: string;
  quantity_delta: number;
  mode: AddonModifierMode;
}

export interface MenuAddonGroup {
  menu_id: string;
  addon_group_id: string;
}

export interface Bundle {
  id: string;
  name: string;
  price: number;
  is_active: boolean;
  photo_url?: string;
  description?: string;
  outlet_ids: string[];
}

export interface BundleItem {
  bundle_id: string;
  menu_id: string;
  quantity: number;
}

export type DiscountType = "percent" | "nominal";
export type DiscountScope = "all" | "category" | "menu";

export interface Discount {
  id: string;
  name: string;
  type: DiscountType;
  value: number;
  scope: DiscountScope;
  scope_ref_id?: string;
  start_at?: string;
  end_at?: string;
  active_hour_start?: string;
  active_hour_end?: string;
  is_active: boolean;
}

export type PaymentMethod = "cash" | "qris" | "card" | "transfer";

/**
 * Transaction life-cycle status:
 * - `open`       — cart/order created, not yet paid (pesanan terbuka)
 * - `paid`       — settled & contributes to net sales
 * - `canceled`   — voided before payment, does not contribute
 * - `refunded`   — paid then reversed; revenue is reverted in reports
 * - `void`       — order sudah dibuat (menu keluar, stok terpotong), tapi tidak
 *                  diterima pelanggan karena kesalahan staff (salah menu, salah
 *                  isi, salah input). Tidak menghasilkan revenue, tetapi HPP
 *                  tetap tercatat sebagai kerugian operasional.
 */
export type TransactionStatus =
  | "open"
  | "paid"
  | "canceled"
  | "refunded"
  | "void";

/**
 * Where/how the order is fulfilled. `online` covers marketplace/app orders
 * (GoFood, GrabFood, ShopeeFood). `delivery` is an in-house delivery order
 * placed offline (phone, cashier) that still needs to be sent to a customer.
 */
export type OrderType = "dine_in" | "take_away" | "delivery" | "online";

export interface Transaction {
  id: string;
  outlet_id: string;
  user_id: string;
  subtotal: number;
  discount_total: number;
  ppn_amount: number;
  service_charge_amount: number;
  grand_total: number;
  payment_method: PaymentMethod;
  status: TransactionStatus;
  order_type: OrderType;
  created_at: string;
  items: TransactionItem[];
  /**
   * Alasan order di-void (salah menu, salah isi, dll). Hanya terisi saat
   * `status === "void"`. Dipakai oleh laporan Void + audit.
   */
  void_reason?: string;
  /**
   * ID user yang mengeksekusi void (biasanya Kepala Toko / Kasir yang
   * menyadari kesalahan). Hanya terisi saat `status === "void"`.
   */
  voided_by?: string;
  /** ISO timestamp saat void dilakukan. Hanya terisi saat `status === "void"`. */
  voided_at?: string;
}

export interface TransactionItem {
  id: string;
  transaction_id: string;
  menu_id: string | null;
  bundle_id: string | null;
  name_snapshot: string;
  quantity: number;
  unit_price: number;
  hpp_snapshot: number;
  subtotal: number;
  addons: TransactionItemAddon[];
  /**
   * Per-item void (granularity baru): ISO timestamp saat item ini di-void.
   * Item dengan `voided_at` non-null TIDAK dihitung di revenue, tapi tetap
   * meninggalkan jejak (HPP, atribusi user, alasan) untuk laporan Void.
   * Stok TIDAK direstore — bahan yang sudah dipakai dianggap loss operasional.
   */
  voided_at?: string | null;
  /** ID user yang menandai item ini void. */
  voided_by?: string | null;
  /** Alasan void (template ATAU komentar bebas, max 500 char). */
  void_reason?: string | null;
}

export interface TransactionItemAddon {
  id: string;
  transaction_item_id: string;
  addon_option_id: string;
  name_snapshot: string;
  extra_price: number;
}

export type StockMovementType =
  | "in"
  | "out_sale"
  | "out_waste"
  | "adjustment"
  | "opname";

export interface StockMovement {
  id: string;
  ingredient_id: string;
  outlet_id: string;
  transaction_id?: string;
  batch_id?: string;
  type: StockMovementType;
  quantity: number;
  notes?: string;
  user_id: string;
  created_at: string;
}

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "stock_in"
  | "stock_out"
  | "opname"
  | "login"
  | "check_in"
  | "check_out"
  | "void";

export type AuditEntity =
  | "menu"
  | "ingredient"
  | "addon_group"
  | "bundle"
  | "discount"
  | "user"
  | "outlet"
  | "category"
  | "session"
  | "attendance"
  | "checklist_template"
  | "attendance_settings"
  | "tax_settings"
  | "sales_target"
  | "ojol_channel"
  | "menu_channel_listing"
  | "pos_pin"
  | "transaction";

export interface AuditChange {
  field: string;
  before?: unknown;
  after?: unknown;
}

export interface AuditLog {
  id: string;
  user_id: string;
  user_name: string;
  user_role: Role;
  action: AuditAction;
  entity: AuditEntity;
  entity_id: string;
  entity_name: string;
  outlet_id?: string | null;
  changes: AuditChange[];
  notes?: string;
  created_at: string;
}

export interface StockOpname {
  id: string;
  outlet_id: string;
  user_id: string;
  status: "pending" | "approved" | "rejected";
  notes?: string;
  created_at: string;
  items: StockOpnameItem[];
}

export interface StockOpnameItem {
  ingredient_id: string;
  system_qty: number;
  actual_qty: number;
  diff: number;
}

export type Station = "bar" | "kitchen" | "cashier" | "service" | "management";

export const STATION_LABEL: Record<Station, string> = {
  bar: "Bar / Barista",
  kitchen: "Kitchen",
  cashier: "Kasir",
  service: "Service / Waiters",
  management: "Management",
};

export function stationForRole(role: Role): Station {
  switch (role) {
    case "barista":
      return "bar";
    case "kitchen":
      return "kitchen";
    case "kasir":
      return "cashier";
    case "waiters":
      return "service";
    default:
      return "management";
  }
}

export interface AttendanceChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface Attendance {
  id: string;
  user_id: string;
  user_name: string;
  user_role: Role;
  outlet_id: string;
  station: Station;
  date: string;
  check_in_at: string;
  check_in_selfie: string;
  check_in_station_photo: string;
  before_checklist: AttendanceChecklistItem[];
  check_in_notes?: string;
  is_late?: boolean;
  check_out_at?: string;
  check_out_selfie?: string;
  check_out_station_photo?: string;
  after_checklist?: AttendanceChecklistItem[];
  check_out_notes?: string;
}

export type ChecklistType = "before" | "after";

export interface ChecklistTemplate {
  id: string;
  station: Station;
  type: ChecklistType;
  label: string;
  sort_order: number;
}

export interface AttendanceSettings {
  check_in_cutoff: string;
  updated_at: string;
}

/**
 * Global tax and service-charge settings applied to every transaction,
 * regardless of outlet or menu. Percent values (e.g. 11 for 11%) — stored
 * as a singleton row in the mock DB; backend should expose as `GET/PUT
 * /tax-settings`.
 */
export interface TaxSettings {
  ppn_percent: number;
  service_charge_percent: number;
  updated_at: string;
}

/**
 * Monthly net-sales target for dashboard "Target vs Actual" chart.
 * One row per (year, month). `target_amount` is stored in IDR.
 */
export interface SalesTarget {
  id: string;
  year: number;
  month: number;
  target_amount: number;
  updated_at: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Ojol (online food delivery) integration
// ────────────────────────────────────────────────────────────────────────────

/** Supported ojol/marketplace platforms. */
export type OjolPlatform = "gofood" | "grabfood" | "shopeefood";

export const OJOL_PLATFORM_LABEL: Record<OjolPlatform, string> = {
  gofood: "GoFood",
  grabfood: "GrabFood",
  shopeefood: "ShopeeFood",
};

/**
 * Per-outlet × per-platform configuration. Stores the merchant identity
 * and API credentials needed to push menu updates upstream. One row per
 * (outlet_id, platform). Even when `is_connected === false` the row may
 * exist (placeholder so the Owner can see & fill in credentials later).
 */
export interface OjolChannel {
  id: string;
  outlet_id: string;
  platform: OjolPlatform;
  store_name: string;
  merchant_id: string;
  /** Stored masked in the UI; full value lives server-side only. */
  api_key: string;
  is_connected: boolean;
  /**
   * When true, menu/price/availability changes in backoffice are pushed
   * to the platform automatically on save. When false, Owner must hit
   * "Sync" manually from the Integrations page.
   */
  auto_sync: boolean;
  last_sync_at?: string;
  notes?: string;
}

export type SyncStatus = "synced" | "pending" | "failed";

/**
 * Per-menu × per-platform listing. Controls per-channel price override
 * (leave null ⇒ use `menu.price`) and availability toggle. `sync_status`
 * reflects whether the last write reached the platform; `sync_error`
 * stores the upstream error when `status === "failed"`.
 */
export interface MenuChannelListing {
  id: string;
  menu_id: string;
  platform: OjolPlatform;
  /** Null ⇒ use the base `menu.price`. Set to override for this channel. */
  price_override: number | null;
  is_available: boolean;
  sync_status: SyncStatus;
  last_sync_at?: string;
  sync_error?: string;
  /** External ID returned by the platform (e.g. GoFood item UUID). */
  external_id?: string;
}

export type SyncRunStatus = "success" | "partial" | "failed" | "running";

/**
 * One entry per sync run (manual or auto-triggered). Used to surface
 * history + error details in the Integrations page.
 */
export interface OjolSyncLog {
  id: string;
  outlet_id: string;
  platform: OjolPlatform;
  triggered_by_user_id: string;
  triggered_by_name: string;
  started_at: string;
  completed_at?: string;
  status: SyncRunStatus;
  items_total: number;
  items_synced: number;
  items_failed: number;
  notes?: string;
}
