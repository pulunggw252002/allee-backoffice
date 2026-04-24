import type {
  AddonGroup,
  AddonOption,
  AddonRecipeModifier,
  Attendance,
  AttendanceSettings,
  AuditLog,
  Bundle,
  BundleItem,
  ChecklistTemplate,
  Discount,
  Ingredient,
  Menu,
  MenuAddonGroup,
  MenuCategory,
  MenuChannelListing,
  OjolChannel,
  OjolPlatform,
  OjolSyncLog,
  OrderType,
  Outlet,
  PaymentMethod,
  RecipeItem,
  SalesTarget,
  Station,
  StockMovement,
  TaxSettings,
  Transaction,
  TransactionStatus,
  User,
} from "@/types";
import {
  MOCK_BASE_MONTHLY_TARGET,
  MOCK_DISCOUNT_PROBABILITY,
  MOCK_DISCOUNT_RATE,
  MOCK_SEED_HISTORY_DAYS,
  MOCK_VOID_PROBABILITY,
  VOID_REASONS,
} from "@/lib/constants";

/**
 * Default password for every seeded demo user. This is mock-only and never
 * shipped to the real backend — kept here as a named export so UI screens
 * (e.g. the login demo-account picker) reference the value, not a literal.
 */
export const DEMO_USER_PASSWORD = "password";

export interface MockDatabase {
  outlets: Outlet[];
  users: User[];
  categories: MenuCategory[];
  menus: Menu[];
  recipes: RecipeItem[];
  ingredients: Ingredient[];
  addon_groups: AddonGroup[];
  addon_options: AddonOption[];
  addon_recipe_modifiers: AddonRecipeModifier[];
  menu_addon_groups: MenuAddonGroup[];
  bundles: Bundle[];
  bundle_items: BundleItem[];
  discounts: Discount[];
  transactions: Transaction[];
  stock_movements: StockMovement[];
  audit_logs: AuditLog[];
  attendances: Attendance[];
  checklist_templates: ChecklistTemplate[];
  attendance_settings: AttendanceSettings;
  tax_settings: TaxSettings;
  sales_targets: SalesTarget[];
  /** Per-outlet × per-platform marketplace config (GoFood, GrabFood, ShopeeFood). */
  ojol_channels: OjolChannel[];
  /** Per-menu × per-platform listing (price override, availability, sync status). */
  menu_channel_listings: MenuChannelListing[];
  /** History of sync runs per (outlet, platform). */
  ojol_sync_logs: OjolSyncLog[];
}

export const BEFORE_OPENING_CHECKLIST: Record<Station, string[]> = {
  bar: [
    "Cek mesin espresso & grinder",
    "Kalibrasi gram dose & yield",
    "Restock susu, sirup, dan es batu",
    "Bersihkan area bar & steam wand",
    "Cek stok cup, lid, sedotan",
  ],
  kitchen: [
    "Cek kompor, wajan, dan peralatan masak",
    "Cek suhu chiller & freezer",
    "Mise en place bahan mentah",
    "Cek tanggal kadaluarsa bahan",
    "Bersihkan area kerja & cutting board",
  ],
  cashier: [
    "Nyalakan POS & printer struk",
    "Cek kas awal & kembalian",
    "Cek mesin EDC / QRIS aktif",
    "Bersihkan meja kasir",
    "Pastikan menu display up-to-date",
  ],
  service: [
    "Atur meja & kursi sesuai layout",
    "Bersihkan meja & lantai area tamu",
    "Cek stok cutlery, tissue, menu book",
    "Cek toilet & area tunggu",
    "Briefing promo / special menu hari ini",
  ],
  management: [],
};

export const AFTER_CLOSING_CHECKLIST: Record<Station, string[]> = {
  bar: [
    "Bersihkan & backflush mesin espresso",
    "Cuci steam wand & portafilter",
    "Simpan sisa susu / sirup ke chiller",
    "Matikan mesin & grinder",
    "Lap & keringkan area bar",
  ],
  kitchen: [
    "Bersihkan kompor & exhaust",
    "Simpan bahan sisa ke chiller dengan label",
    "Cuci semua peralatan masak",
    "Pel lantai area dapur",
    "Matikan gas & kompor, cek keamanan",
  ],
  cashier: [
    "Tutup kas & cocokkan penjualan",
    "Print laporan Z / shift report",
    "Matikan POS & printer",
    "Amankan uang tunai ke safe box",
    "Bersihkan meja kasir",
  ],
  service: [
    "Bersihkan semua meja & kursi",
    "Pel lantai area tamu",
    "Rapikan cutlery & menu book",
    "Cek & bersihkan toilet",
    "Matikan lampu area tamu",
  ],
  management: [],
};

const nowIso = new Date().toISOString();

export function buildDefaultChecklistTemplates(): ChecklistTemplate[] {
  const items: ChecklistTemplate[] = [];
  let counter = 1;
  const stations: Station[] = ["bar", "kitchen", "cashier", "service", "management"];
  for (const station of stations) {
    BEFORE_OPENING_CHECKLIST[station].forEach((label, idx) => {
      items.push({
        id: `clt_${counter++}`,
        station,
        type: "before",
        label,
        sort_order: idx,
      });
    });
    AFTER_CLOSING_CHECKLIST[station].forEach((label, idx) => {
      items.push({
        id: `clt_${counter++}`,
        station,
        type: "after",
        label,
        sort_order: idx,
      });
    });
  }
  return items;
}

export const DEFAULT_ATTENDANCE_SETTINGS: AttendanceSettings = {
  check_in_cutoff: "09:00",
  updated_at: nowIso,
};

export const DEFAULT_TAX_SETTINGS: TaxSettings = {
  ppn_percent: 11,
  service_charge_percent: 5,
  updated_at: nowIso,
};

const outlets: Outlet[] = [
  {
    id: "out_dago",
    name: "ALLEE Dago",
    address: "Jl. Ir. H. Juanda No. 120",
    city: "Bandung",
    phone: "+62 22 251 2345",
    opening_hours: "08:00 - 22:00",
    is_active: true,
    created_at: "2024-11-01T08:00:00Z",
  },
  {
    id: "out_pim",
    name: "ALLEE PIM",
    address: "Pondok Indah Mall, Lt. 2",
    city: "Jakarta Selatan",
    phone: "+62 21 759 8899",
    opening_hours: "10:00 - 22:00",
    is_active: true,
    created_at: "2025-02-15T08:00:00Z",
  },
];

const users: User[] = [
  {
    id: "usr_budi",
    name: "Budi",
    password: DEMO_USER_PASSWORD,
    role: "owner",
    outlet_id: null,
    contact: "+62 812 1111 2222",
    is_active: true,
    joined_at: "2024-11-01",
  },
  {
    id: "usr_andi",
    name: "Andi",
    password: DEMO_USER_PASSWORD,
    role: "kepala_toko",
    outlet_id: "out_dago",
    contact: "+62 812 3333 4444",
    is_active: true,
    joined_at: "2024-11-05",
  },
  {
    id: "usr_siti",
    name: "Siti",
    password: DEMO_USER_PASSWORD,
    role: "kepala_toko",
    outlet_id: "out_pim",
    contact: "+62 812 5555 6666",
    is_active: true,
    joined_at: "2025-02-20",
  },
  {
    id: "usr_rudi",
    name: "Rudi Kasir",
    password: DEMO_USER_PASSWORD,
    role: "kasir",
    outlet_id: "out_dago",
    is_active: true,
    joined_at: "2024-12-01",
  },
  {
    id: "usr_dewi",
    name: "Dewi Barista",
    password: DEMO_USER_PASSWORD,
    role: "barista",
    outlet_id: "out_dago",
    is_active: true,
    joined_at: "2024-12-10",
  },
  {
    id: "usr_joni",
    name: "Joni Kitchen",
    password: DEMO_USER_PASSWORD,
    role: "kitchen",
    outlet_id: "out_pim",
    is_active: true,
    joined_at: "2025-03-01",
  },
  {
    id: "usr_mira",
    name: "Mira Waiters",
    password: DEMO_USER_PASSWORD,
    role: "waiters",
    outlet_id: "out_pim",
    is_active: true,
    joined_at: "2025-03-05",
  },
];

const categories: MenuCategory[] = [
  { id: "cat_minuman", name: "Minuman", sort_order: 1 },
  { id: "cat_makanan", name: "Makanan", sort_order: 2 },
  { id: "cat_dessert", name: "Dessert", sort_order: 3 },
  { id: "cat_snack", name: "Snack", sort_order: 4 },
];

const INGREDIENT_TEMPLATES: Array<
  Omit<Ingredient, "id" | "outlet_id" | "updated_at">
> = [
  { name: "Espresso Bean", unit: "g", unit_price: 450, current_stock: 3200, min_qty: 2000, storage_location: "Rak A1" },
  { name: "Susu UHT", unit: "ml", unit_price: 22, current_stock: 18500, min_qty: 10000, storage_location: "Kulkas B" },
  { name: "Es Batu", unit: "g", unit_price: 2, current_stock: 15000, min_qty: 8000, storage_location: "Freezer" },
  { name: "Gula Cair", unit: "ml", unit_price: 18, current_stock: 4200, min_qty: 3000, storage_location: "Rak A2" },
  { name: "Teh Celup", unit: "pcs", unit_price: 850, current_stock: 120, min_qty: 80, storage_location: "Rak A3" },
  { name: "Sirup Vanilla", unit: "ml", unit_price: 95, current_stock: 1200, min_qty: 1000, storage_location: "Rak A3" },
  { name: "Cokelat Bubuk", unit: "g", unit_price: 280, current_stock: 850, min_qty: 1000, storage_location: "Rak B1" },
  { name: "Nasi Putih", unit: "g", unit_price: 12, current_stock: 24000, min_qty: 15000, storage_location: "Dapur" },
  { name: "Telur Ayam", unit: "pcs", unit_price: 2800, current_stock: 60, min_qty: 40, storage_location: "Kulkas A" },
  { name: "Mie Kuning", unit: "g", unit_price: 35, current_stock: 5000, min_qty: 3000, storage_location: "Rak C1" },
  { name: "Ayam Fillet", unit: "g", unit_price: 95, current_stock: 4500, min_qty: 3000, storage_location: "Kulkas A" },
  { name: "Cabe Merah", unit: "g", unit_price: 65, current_stock: 900, min_qty: 1000, storage_location: "Kulkas A" },
  { name: "Bawang Putih", unit: "g", unit_price: 45, current_stock: 1200, min_qty: 800, storage_location: "Rak C2" },
  { name: "Kecap Manis", unit: "ml", unit_price: 32, current_stock: 2500, min_qty: 1500, storage_location: "Rak C2" },
  { name: "Minyak Goreng", unit: "ml", unit_price: 18, current_stock: 8000, min_qty: 5000, storage_location: "Rak C3" },
  { name: "Keju Mozzarella", unit: "g", unit_price: 180, current_stock: 600, min_qty: 500, storage_location: "Kulkas B" },
  { name: "Whipped Cream", unit: "ml", unit_price: 85, current_stock: 800, min_qty: 600, storage_location: "Kulkas B" },
  { name: "Kentang Beku", unit: "g", unit_price: 42, current_stock: 3500, min_qty: 2500, storage_location: "Freezer" },
  { name: "Roti Burger", unit: "pcs", unit_price: 4500, current_stock: 35, min_qty: 25, storage_location: "Rak D1" },
  { name: "Daun Mint", unit: "g", unit_price: 220, current_stock: 180, min_qty: 200, storage_location: "Kulkas A" },
];

const ingredients: Ingredient[] = [];
for (const outlet of outlets) {
  INGREDIENT_TEMPLATES.forEach((tpl, idx) => {
    const stockVariance = outlet.id === "out_pim" ? 0.7 : 1;
    ingredients.push({
      ...tpl,
      id: `ing_${outlet.id}_${idx + 1}`,
      outlet_id: outlet.id,
      current_stock: Math.round(tpl.current_stock * stockVariance),
      updated_at: nowIso,
    });
  });
}

const menus: Menu[] = [
  {
    id: "mn_ice_latte",
    category_id: "cat_minuman",
    name: "Ice Latte",
    sku: "MIN-001",
    price: 32000,
    hpp_cached: 0,
    description: "Espresso double shot dengan susu dingin.",
    type: "regular",
    is_active: true,
    outlet_ids: ["out_dago", "out_pim"],
  },
  {
    id: "mn_hot_latte",
    category_id: "cat_minuman",
    name: "Hot Latte",
    sku: "MIN-002",
    price: 30000,
    hpp_cached: 0,
    description: "Espresso double shot dengan steamed milk.",
    type: "regular",
    is_active: true,
    outlet_ids: ["out_dago", "out_pim"],
  },
  {
    id: "mn_americano",
    category_id: "cat_minuman",
    name: "Americano",
    sku: "MIN-003",
    price: 25000,
    hpp_cached: 0,
    description: "Espresso dengan air panas.",
    type: "regular",
    is_active: true,
    outlet_ids: ["out_dago", "out_pim"],
  },
  {
    id: "mn_es_teh",
    category_id: "cat_minuman",
    name: "Es Teh Manis",
    sku: "MIN-004",
    price: 10000,
    hpp_cached: 0,
    description: "Teh hitam dingin dengan gula.",
    type: "regular",
    is_active: true,
    outlet_ids: ["out_dago", "out_pim"],
  },
  {
    id: "mn_hot_choco",
    category_id: "cat_minuman",
    name: "Hot Chocolate",
    sku: "MIN-005",
    price: 28000,
    hpp_cached: 0,
    description: "Cokelat hangat dengan whipped cream.",
    type: "regular",
    is_active: true,
    outlet_ids: ["out_dago", "out_pim"],
  },
  {
    id: "mn_nasi_goreng",
    category_id: "cat_makanan",
    name: "Nasi Goreng Spesial",
    sku: "MKN-001",
    price: 38000,
    hpp_cached: 0,
    description: "Nasi goreng dengan telur, ayam, dan bumbu khas.",
    type: "regular",
    is_active: true,
    outlet_ids: ["out_dago", "out_pim"],
  },
  {
    id: "mn_mie_goreng",
    category_id: "cat_makanan",
    name: "Mie Goreng",
    sku: "MKN-002",
    price: 32000,
    hpp_cached: 0,
    description: "Mie goreng dengan ayam dan sayuran.",
    type: "regular",
    is_active: true,
    outlet_ids: ["out_dago", "out_pim"],
  },
  {
    id: "mn_chicken_burger",
    category_id: "cat_makanan",
    name: "Chicken Burger",
    sku: "MKN-003",
    price: 45000,
    hpp_cached: 0,
    description: "Burger ayam dengan keju mozzarella.",
    type: "regular",
    is_active: true,
    outlet_ids: ["out_dago", "out_pim"],
  },
  {
    id: "mn_fries",
    category_id: "cat_snack",
    name: "French Fries",
    sku: "SNK-001",
    price: 18000,
    hpp_cached: 0,
    description: "Kentang goreng renyah.",
    type: "regular",
    is_active: true,
    outlet_ids: ["out_dago", "out_pim"],
  },
  {
    id: "mn_brownies",
    category_id: "cat_dessert",
    name: "Chocolate Brownies",
    sku: "DES-001",
    price: 22000,
    hpp_cached: 0,
    description: "Brownies cokelat hangat dengan ice cream.",
    type: "regular",
    is_active: true,
    outlet_ids: ["out_dago"],
  },
];

const ingByName = (outlet: string, name: string) =>
  ingredients.find((i) => i.outlet_id === outlet && i.name === name)!;

const tplRecipe = (
  menuId: string,
  entries: Array<[string, number]>,
): Array<Omit<RecipeItem, "id">> =>
  entries.map(([name, qty]) => ({
    menu_id: menuId,
    ingredient_id: `__TPL__${name}`,
    quantity: qty,
  }));

const RECIPE_TEMPLATES: Array<Omit<RecipeItem, "id">> = [
  ...tplRecipe("mn_ice_latte", [
    ["Espresso Bean", 18],
    ["Susu UHT", 150],
    ["Es Batu", 100],
    ["Gula Cair", 15],
  ]),
  ...tplRecipe("mn_hot_latte", [
    ["Espresso Bean", 18],
    ["Susu UHT", 180],
    ["Gula Cair", 10],
  ]),
  ...tplRecipe("mn_americano", [
    ["Espresso Bean", 18],
    ["Es Batu", 80],
  ]),
  ...tplRecipe("mn_es_teh", [
    ["Teh Celup", 1],
    ["Es Batu", 120],
    ["Gula Cair", 20],
  ]),
  ...tplRecipe("mn_hot_choco", [
    ["Cokelat Bubuk", 25],
    ["Susu UHT", 180],
    ["Whipped Cream", 30],
    ["Gula Cair", 10],
  ]),
  ...tplRecipe("mn_nasi_goreng", [
    ["Nasi Putih", 250],
    ["Telur Ayam", 1],
    ["Ayam Fillet", 80],
    ["Bawang Putih", 10],
    ["Kecap Manis", 15],
    ["Minyak Goreng", 20],
    ["Cabe Merah", 8],
  ]),
  ...tplRecipe("mn_mie_goreng", [
    ["Mie Kuning", 150],
    ["Telur Ayam", 1],
    ["Ayam Fillet", 60],
    ["Bawang Putih", 8],
    ["Kecap Manis", 12],
    ["Minyak Goreng", 18],
  ]),
  ...tplRecipe("mn_chicken_burger", [
    ["Roti Burger", 1],
    ["Ayam Fillet", 120],
    ["Keju Mozzarella", 25],
    ["Minyak Goreng", 15],
  ]),
  ...tplRecipe("mn_fries", [
    ["Kentang Beku", 180],
    ["Minyak Goreng", 25],
  ]),
  ...tplRecipe("mn_brownies", [
    ["Cokelat Bubuk", 40],
    ["Telur Ayam", 1],
    ["Whipped Cream", 40],
  ]),
];

const recipes: RecipeItem[] = [];
let recipeCounter = 1;
for (const tpl of RECIPE_TEMPLATES) {
  const ingName = tpl.ingredient_id.replace("__TPL__", "");
  const menu = menus.find((m) => m.id === tpl.menu_id)!;
  const outletRef = menu.outlet_ids[0];
  const ing = ingByName(outletRef, ingName);
  recipes.push({
    id: `rcp_${recipeCounter++}`,
    menu_id: tpl.menu_id,
    ingredient_id: ing.id,
    quantity: tpl.quantity,
  });
}

const addon_groups: AddonGroup[] = [
  { id: "ag_sugar", name: "Sugar Level", selection_type: "single", is_required: false },
  { id: "ag_ice", name: "Ice Level", selection_type: "single", is_required: false },
  { id: "ag_shot", name: "Extra Shot", selection_type: "multi", is_required: false },
  { id: "ag_spicy", name: "Tingkat Pedas", selection_type: "single", is_required: false },
];

const addon_options: AddonOption[] = [
  { id: "ao_sugar_no", addon_group_id: "ag_sugar", name: "No Sugar", extra_price: 0 },
  { id: "ao_sugar_less", addon_group_id: "ag_sugar", name: "Less Sugar", extra_price: 0 },
  { id: "ao_sugar_normal", addon_group_id: "ag_sugar", name: "Normal Sugar", extra_price: 0 },
  { id: "ao_ice_no", addon_group_id: "ag_ice", name: "No Ice", extra_price: 0 },
  { id: "ao_ice_less", addon_group_id: "ag_ice", name: "Less Ice", extra_price: 0 },
  { id: "ao_ice_normal", addon_group_id: "ag_ice", name: "Normal Ice", extra_price: 0 },
  { id: "ao_shot_extra", addon_group_id: "ag_shot", name: "+1 Shot Espresso", extra_price: 8000 },
  { id: "ao_spicy_mild", addon_group_id: "ag_spicy", name: "Tidak Pedas", extra_price: 0 },
  { id: "ao_spicy_medium", addon_group_id: "ag_spicy", name: "Pedas Sedang", extra_price: 0 },
  { id: "ao_spicy_hot", addon_group_id: "ag_spicy", name: "Pedas Banget", extra_price: 0 },
];

const addon_recipe_modifiers: AddonRecipeModifier[] = [
  { id: "arm_1", addon_option_id: "ao_sugar_no", ingredient_id: ingByName("out_dago", "Gula Cair").id, quantity_delta: 0, mode: "override" },
  { id: "arm_2", addon_option_id: "ao_sugar_less", ingredient_id: ingByName("out_dago", "Gula Cair").id, quantity_delta: 8, mode: "override" },
  { id: "arm_3", addon_option_id: "ao_sugar_normal", ingredient_id: ingByName("out_dago", "Gula Cair").id, quantity_delta: 15, mode: "override" },
  { id: "arm_4", addon_option_id: "ao_ice_no", ingredient_id: ingByName("out_dago", "Es Batu").id, quantity_delta: 0, mode: "override" },
  { id: "arm_5", addon_option_id: "ao_ice_less", ingredient_id: ingByName("out_dago", "Es Batu").id, quantity_delta: 70, mode: "override" },
  { id: "arm_6", addon_option_id: "ao_ice_normal", ingredient_id: ingByName("out_dago", "Es Batu").id, quantity_delta: 100, mode: "override" },
  { id: "arm_7", addon_option_id: "ao_shot_extra", ingredient_id: ingByName("out_dago", "Espresso Bean").id, quantity_delta: 9, mode: "delta" },
  { id: "arm_8", addon_option_id: "ao_spicy_medium", ingredient_id: ingByName("out_dago", "Cabe Merah").id, quantity_delta: 5, mode: "delta" },
  { id: "arm_9", addon_option_id: "ao_spicy_hot", ingredient_id: ingByName("out_dago", "Cabe Merah").id, quantity_delta: 12, mode: "delta" },
];

const menu_addon_groups: MenuAddonGroup[] = [
  { menu_id: "mn_ice_latte", addon_group_id: "ag_sugar" },
  { menu_id: "mn_ice_latte", addon_group_id: "ag_ice" },
  { menu_id: "mn_ice_latte", addon_group_id: "ag_shot" },
  { menu_id: "mn_hot_latte", addon_group_id: "ag_sugar" },
  { menu_id: "mn_hot_latte", addon_group_id: "ag_shot" },
  { menu_id: "mn_americano", addon_group_id: "ag_ice" },
  { menu_id: "mn_americano", addon_group_id: "ag_shot" },
  { menu_id: "mn_es_teh", addon_group_id: "ag_sugar" },
  { menu_id: "mn_es_teh", addon_group_id: "ag_ice" },
  { menu_id: "mn_hot_choco", addon_group_id: "ag_sugar" },
  { menu_id: "mn_nasi_goreng", addon_group_id: "ag_spicy" },
  { menu_id: "mn_mie_goreng", addon_group_id: "ag_spicy" },
];

const bundles: Bundle[] = [
  {
    id: "bn_hemat",
    name: "Paket Hemat",
    price: 42000,
    is_active: true,
    description: "Nasi Goreng + Es Teh Manis",
    outlet_ids: ["out_dago", "out_pim"],
  },
];

const bundle_items: BundleItem[] = [
  { bundle_id: "bn_hemat", menu_id: "mn_nasi_goreng", quantity: 1 },
  { bundle_id: "bn_hemat", menu_id: "mn_es_teh", quantity: 1 },
];

const discounts: Discount[] = [
  {
    id: "dsc_happy",
    name: "Happy Hour Minuman",
    type: "percent",
    value: 20,
    scope: "category",
    scope_ref_id: "cat_minuman",
    start_at: "2026-04-01",
    end_at: "2026-12-31",
    active_hour_start: "14:00",
    active_hour_end: "17:00",
    is_active: true,
  },
  {
    id: "dsc_opening",
    name: "Grand Opening PIM",
    type: "nominal",
    value: 10000,
    scope: "all",
    start_at: "2026-04-20",
    end_at: "2026-05-20",
    is_active: true,
  },
];

/**
 * Alias kept only so the generator below reads like prose.
 * The canonical value lives in `src/lib/constants.ts` (`MOCK_SEED_HISTORY_DAYS`).
 */
const SEED_HISTORY_DAYS = MOCK_SEED_HISTORY_DAYS;

/**
 * Weighted picker — samples an item whose `w` values form a probability
 * distribution. Deterministic given `Math.random`. Used to distribute
 * `order_type` and `status` in the seed.
 */
function weightedPick<T extends { w: number }>(items: T[]): T {
  const total = items.reduce((s, i) => s + i.w, 0);
  let r = Math.random() * total;
  for (const it of items) {
    r -= it.w;
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

function buildTransactions(): {
  transactions: Transaction[];
  stock_movements: StockMovement[];
} {
  const txs: Transaction[] = [];
  const movs: StockMovement[] = [];
  const cashierByOutlet: Record<string, string> = {
    out_dago: "usr_rudi",
    out_pim: "usr_mira",
  };
  const methods: PaymentMethod[] = ["cash", "qris", "card", "transfer"];
  let txCounter = 1;
  let movCounter = 1;

  const dagoMenus = menus.filter((m) => m.outlet_ids.includes("out_dago"));
  const pimMenus = menus.filter((m) => m.outlet_ids.includes("out_pim"));

  const menuHppByOutlet = (outlet: string) => {
    const byOutlet = ingredients.filter((i) => i.outlet_id === outlet);
    return (menuId: string) => {
      const menuRecipes = recipes.filter((r) => r.menu_id === menuId);
      return menuRecipes.reduce((sum, r) => {
        const rawIng = ingredients.find((i) => i.id === r.ingredient_id)!;
        const localIng = byOutlet.find((i) => i.name === rawIng.name)!;
        return sum + r.quantity * localIng.unit_price;
      }, 0);
    };
  };

  for (let day = 0; day < SEED_HISTORY_DAYS; day++) {
    const isToday = day === 0;
    for (const outlet of outlets) {
      const outletMenus = outlet.id === "out_dago" ? dagoMenus : pimMenus;
      const hppOf = menuHppByOutlet(outlet.id);
      // Recent 30 days have slightly denser volume to give the dashboard
      // realistic "last week" numbers without bloating the full seed.
      const perDay =
        day < 30
          ? 6 + Math.floor(Math.random() * 4)
          : 3 + Math.floor(Math.random() * 3);
      for (let t = 0; t < perDay; t++) {
        const when = new Date();
        when.setDate(when.getDate() - day);
        when.setHours(9 + Math.floor(Math.random() * 12));
        when.setMinutes(Math.floor(Math.random() * 60));

        const nItems = 1 + Math.floor(Math.random() * 3);
        const items = Array.from({ length: nItems }).map(() => {
          const menu = outletMenus[Math.floor(Math.random() * outletMenus.length)];
          const qty = 1 + Math.floor(Math.random() * 2);
          return { menu, qty };
        });

        const subtotal = items.reduce((s, i) => s + i.menu.price * i.qty, 0);
        // A configurable fraction of transactions get a small flat discount so
        // the "diskon" KPI has non-zero data in reports. See `MOCK_DISCOUNT_*`.
        const discountTotal =
          Math.random() < MOCK_DISCOUNT_PROBABILITY
            ? Math.round(subtotal * MOCK_DISCOUNT_RATE)
            : 0;
        const ppn = Math.round(
          ((subtotal - discountTotal) * DEFAULT_TAX_SETTINGS.ppn_percent) / 100,
        );
        const sc = Math.round(
          ((subtotal - discountTotal) *
            DEFAULT_TAX_SETTINGS.service_charge_percent) /
            100,
        );
        const total = subtotal - discountTotal + ppn + sc;
        const txId = `tx_${txCounter++}`;

        const orderType = weightedPick<{ w: number; v: OrderType }>([
          { v: "dine_in", w: 45 },
          { v: "take_away", w: 25 },
          { v: "delivery", w: 15 },
          { v: "online", w: 15 },
        ]).v;

        // Status distribution: most tx are `paid`. `open` is only allowed
        // for today's bucket (unfinished orders). `canceled`, `refunded`,
        // and `void` appear at low rates across history.
        //
        // `void` ≠ `canceled`:
        //   - canceled = dibatalkan SEBELUM dibuat, stok tidak tersentuh.
        //   - void     = sudah dibuat, menu keluar, stok terpotong,
        //                tapi tidak diterima pelanggan (salah staff).
        //                HPP tetap tercatat sebagai kerugian.
        const status: TransactionStatus = (() => {
          if (isToday && Math.random() < 0.15) return "open";
          const r = Math.random();
          if (r < 0.05) return "canceled";
          if (r < 0.08) return "refunded";
          if (r < 0.08 + MOCK_VOID_PROBABILITY) return "void";
          return "paid";
        })();

        const isVoid = status === "void";
        const voidReason = isVoid
          ? VOID_REASONS[Math.floor(Math.random() * VOID_REASONS.length)]
          : undefined;
        const voidedBy = isVoid ? cashierByOutlet[outlet.id] : undefined;
        const voidedAt = isVoid
          ? new Date(when.getTime() + 5 * 60_000).toISOString()
          : undefined;

        txs.push({
          id: txId,
          outlet_id: outlet.id,
          user_id: cashierByOutlet[outlet.id],
          subtotal,
          discount_total: discountTotal,
          ppn_amount: ppn,
          service_charge_amount: sc,
          grand_total: total,
          payment_method: methods[Math.floor(Math.random() * methods.length)],
          status,
          order_type: orderType,
          created_at: when.toISOString(),
          items: items.map((it, idx) => ({
            id: `${txId}_it${idx}`,
            transaction_id: txId,
            menu_id: it.menu.id,
            bundle_id: null,
            name_snapshot: it.menu.name,
            quantity: it.qty,
            unit_price: it.menu.price,
            hpp_snapshot: hppOf(it.menu.id),
            subtotal: it.menu.price * it.qty,
            addons: [],
          })),
          void_reason: voidReason,
          voided_by: voidedBy,
          voided_at: voidedAt,
        });

        // Both `paid` and `void` transactions consume stock — the menu was
        // actually made in both cases. `canceled` / `refunded` / `open`
        // do not move inventory.
        if (status !== "paid" && status !== "void") continue;

        for (const it of items) {
          const menuRecipes = recipes.filter((r) => r.menu_id === it.menu.id);
          for (const r of menuRecipes) {
            const rawIng = ingredients.find((i) => i.id === r.ingredient_id)!;
            const localIng = ingredients.find(
              (i) => i.outlet_id === outlet.id && i.name === rawIng.name,
            )!;
            movs.push({
              id: `mov_${movCounter++}`,
              ingredient_id: localIng.id,
              outlet_id: outlet.id,
              transaction_id: txId,
              type: "out_sale",
              quantity: r.quantity * it.qty,
              user_id: cashierByOutlet[outlet.id],
              created_at: when.toISOString(),
              notes: isVoid ? `Void: ${voidReason}` : undefined,
            });
          }
        }
      }
    }
  }

  return { transactions: txs, stock_movements: movs };
}

/**
 * Seed monthly net-sales targets for the current calendar year. Past months
 * get targets calibrated to roughly 90 % of the seeded actuals (so the
 * dashboard chart shows "on track"); future months use the last known target.
 */
function buildSalesTargets(): SalesTarget[] {
  const currentYear = new Date().getFullYear();
  const rows: SalesTarget[] = [];
  const updatedAt = new Date().toISOString();
  // Base monthly target (IDR). Canonical value lives in constants.
  const baseTarget = MOCK_BASE_MONTHLY_TARGET;
  // Seed previous and current year so the year selector on the dashboard
  // always has meaningful data to display.
  for (const year of [currentYear - 1, currentYear]) {
    for (let m = 1; m <= 12; m++) {
      // Slight month-to-month variance for visual interest in the chart.
      const variance = 1 + (m % 3) * 0.05;
      rows.push({
        id: `target_${year}_${m}`,
        year,
        month: m,
        target_amount: Math.round(baseTarget * variance),
        updated_at: updatedAt,
      });
    }
  }
  return rows;
}

/**
 * Seed one `OjolChannel` row per (outlet, platform). All three marketplaces
 * are pre-created so the Owner sees the full grid in Integrations; Dago is
 * pre-connected for demo, PIM is left disconnected as a realistic in-progress
 * onboarding state.
 */
function buildOjolChannels(): OjolChannel[] {
  const platforms: OjolPlatform[] = ["gofood", "grabfood", "shopeefood"];
  const rows: OjolChannel[] = [];
  for (const outlet of outlets) {
    for (const platform of platforms) {
      const connected = outlet.id === "out_dago";
      rows.push({
        id: `och_${outlet.id}_${platform}`,
        outlet_id: outlet.id,
        platform,
        store_name: `${outlet.name} — ${platform === "gofood" ? "GoFood" : platform === "grabfood" ? "GrabFood" : "ShopeeFood"}`,
        merchant_id: connected ? `${platform.toUpperCase()}-${outlet.id.toUpperCase()}-001` : "",
        api_key: connected ? `mock_${platform}_${outlet.id}_secret_xyz123` : "",
        is_connected: connected,
        auto_sync: connected,
        last_sync_at: connected ? nowIso : undefined,
        notes: connected ? undefined : "Belum terhubung. Minta kredensial ke merchant support.",
      });
    }
  }
  return rows;
}

/**
 * For every active menu in every platform the outlet is connected to,
 * create a listing with no price override and `is_available: true`. In the
 * mock this is just the cartesian product — in production the platform
 * returns `external_id` after the first successful sync.
 */
function buildMenuChannelListings(channels: OjolChannel[]): MenuChannelListing[] {
  const rows: MenuChannelListing[] = [];
  let counter = 1;
  const platforms: OjolPlatform[] = ["gofood", "grabfood", "shopeefood"];
  // One listing per (menu, platform) — platform toggle is global, per-outlet
  // availability is implied by the channel being connected for that outlet.
  for (const menu of menus) {
    for (const platform of platforms) {
      rows.push({
        id: `mcl_${counter++}`,
        menu_id: menu.id,
        platform,
        // A few demo overrides so the UI shows different prices across channels.
        price_override:
          platform === "gofood" && menu.id === "mn_ice_latte"
            ? menu.price + 3000
            : platform === "grabfood" && menu.id === "mn_nasi_goreng"
              ? menu.price + 2500
              : null,
        is_available: menu.is_active,
        sync_status: channels.some((c) => c.platform === platform && c.is_connected)
          ? "synced"
          : "pending",
        last_sync_at: channels.some((c) => c.platform === platform && c.is_connected)
          ? nowIso
          : undefined,
      });
    }
  }
  return rows;
}

export function buildSeed(): MockDatabase {
  const { transactions, stock_movements } = buildTransactions();
  const ojolChannels = buildOjolChannels();
  return {
    outlets,
    users,
    categories,
    menus,
    recipes,
    ingredients,
    addon_groups,
    addon_options,
    addon_recipe_modifiers,
    menu_addon_groups,
    bundles,
    bundle_items,
    discounts,
    transactions,
    stock_movements,
    audit_logs: [],
    attendances: [],
    checklist_templates: buildDefaultChecklistTemplates(),
    attendance_settings: { ...DEFAULT_ATTENDANCE_SETTINGS },
    tax_settings: { ...DEFAULT_TAX_SETTINGS },
    sales_targets: buildSalesTargets(),
    ojol_channels: ojolChannels,
    menu_channel_listings: buildMenuChannelListings(ojolChannels),
    ojol_sync_logs: [],
  };
}
