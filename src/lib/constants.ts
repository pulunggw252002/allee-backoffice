/**
 * Business-logic constants that are NOT env-driven (part of domain semantics,
 * not deployment config). Prefer named imports from here instead of magic
 * numbers scattered across pages.
 */

/** Stock is "low" when `current_stock <= min_qty * LOW_STOCK_WARNING_MULT`. */
export const LOW_STOCK_WARNING_MULT = 1.5;

/** Stock opname difference threshold (%) above which rows are flagged. */
export const OPNAME_THRESHOLD_PCT = 5;

/** Margin (%) bands used by menu list badge colors. */
export const MARGIN_GOOD_PCT = 50;
export const MARGIN_WARN_PCT = 30;

/** Margin (%) bands for bundling (lower because bundles discount bundle price). */
export const BUNDLE_MARGIN_GOOD_PCT = 40;
export const BUNDLE_MARGIN_WARN_PCT = 20;

/** Default number of recent items to show in "Riwayat" lists on forms. */
export const RECENT_MOVEMENTS_LIMIT = 30;

import type { OrderType, PaymentMethod, TransactionStatus } from "@/types";

/**
 * Canonical payment method list — mirrors POS ALLEE. When the backend is wired
 * up, this order drives both the filter dropdown in Reports → Transactions and
 * the order in which labels appear in receipts.
 */
export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  "cash",
  "qris",
  "card",
  "transfer",
];

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Tunai",
  qris: "QRIS",
  card: "Kartu",
  transfer: "Transfer",
};

export const ORDER_TYPES: readonly OrderType[] = [
  "dine_in",
  "take_away",
  "delivery",
  "online",
];

export const ORDER_TYPE_LABEL: Record<OrderType, string> = {
  dine_in: "Dine In",
  take_away: "Take Away",
  delivery: "Delivery",
  online: "Online",
};

export const TRANSACTION_STATUSES: readonly TransactionStatus[] = [
  "open",
  "paid",
  "canceled",
  "refunded",
  "void",
];

export const TRANSACTION_STATUS_LABEL: Record<TransactionStatus, string> = {
  open: "Terbuka",
  paid: "Lunas",
  canceled: "Dibatalkan",
  refunded: "Dikembalikan",
  void: "Void",
};

/**
 * Daftar alasan yang umum dipilih saat staff melakukan void order. Dipakai
 * oleh laporan Void (group-by reason) dan oleh mock seed untuk menghasilkan
 * data realistis. Kalau backend punya endpoint `GET /void-reasons` di masa
 * depan, list ini cukup digantikan oleh hasil fetch tanpa mengubah UI.
 */
export const VOID_REASONS: readonly string[] = [
  "Salah menu",
  "Salah isi / topping",
  "Salah input kasir",
  "Pelanggan batal setelah dibuat",
  "Pesanan tidak diambil pelanggan",
  "Kesalahan peracikan",
  "Rasa / kualitas tidak sesuai",
];

/**
 * Recharts color tokens — map 1:1 to CSS variables declared in globals.css
 * (`--chart-1` … `--chart-5`). Reference these in components so theme toggles
 * and future rebrands flow through a single source.
 */
export const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
] as const;

/* ------------------------------------------------------------------
 * Localized calendar labels — shared by charts and API aggregations.
 * Single source so renaming (e.g. switching to English) touches one file.
 * ------------------------------------------------------------------ */

/** Weekday abbreviations, Monday-first. Used by weekly bar chart. */
export const WEEKDAY_SHORT_LABELS_ID: readonly string[] = [
  "Sen",
  "Sel",
  "Rab",
  "Kam",
  "Jum",
  "Sab",
  "Min",
];

/** Month abbreviations, January-first. Used by year-over-year chart. */
export const MONTH_SHORT_LABELS_ID: readonly string[] = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

/** Full month names, January-first. Used by month-picker labels and audit. */
export const MONTH_LONG_LABELS_ID: readonly string[] = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

/* ------------------------------------------------------------------
 * Dashboard layout & windowing defaults — keep UI and API in lockstep.
 * Adjust here and every dashboard query / skeleton follows.
 * ------------------------------------------------------------------ */

/** Default rolling window (days) for the Owner dashboard KPIs and charts. */
export const DASHBOARD_WINDOW_DAYS = 30;

/** Number of days used by the "7-day trend" card on the dashboard. */
export const DASHBOARD_TREND_DAYS = 7;

/** How many past years the Target-vs-Actual year selector offers. */
export const DASHBOARD_TARGET_YEARS_BACK = 1;

/** Peak-hours card: how many top hours to surface. */
export const DASHBOARD_PEAK_HOURS_COUNT = 3;

/** Top/bottom menu list: how many rows to show. */
export const DASHBOARD_MENU_LIST_LIMIT = 5;

/** Low-stock panel: how many rows to render before truncation. */
export const DASHBOARD_LOW_STOCK_LIMIT = 8;

/** Kepala Toko "Ringkasan Bahan" card: rows before "lihat semua". */
export const DASHBOARD_INGREDIENT_PREVIEW_LIMIT = 12;

/**
 * Standard chart heights (px). Centralising these keeps skeleton placeholders
 * identical to their real counterparts so pages don't "jump" on load.
 */
export const CHART_HEIGHT = {
  /** Sales trend / daily net (medium). */
  trend: 240,
  /** Weekly / hourly bars (compact). */
  bars: 220,
  /** Full-width comparisons (tall). */
  comparison: 280,
  /** Donut / pie (square-ish). */
  pie: 180,
  /** Monthly target vs actual composed chart. */
  target: 260,
} as const;

/** Skeleton heights (Tailwind classes) that match the cards above. */
export const DASHBOARD_SKELETON = {
  kpi: "h-32",
  kpiCompact: "h-28",
  chartTrend: "h-[280px]",
  chartTall: "h-[360px]",
  chartMedium: "h-[320px]",
} as const;

/* ------------------------------------------------------------------
 * Mock-seed tuning knobs — surfaced here so the demo can be re-shaped
 * without touching the generator. These are consumed exclusively by
 * `src/lib/mock/seed.ts`; a real backend never reads them.
 * ------------------------------------------------------------------ */

/** How many days of history to seed. ≥ 395 so year-over-year chart has data. */
export const MOCK_SEED_HISTORY_DAYS = 420;

/** Probability that any given paid transaction gets a discount. 0..1. */
export const MOCK_DISCOUNT_PROBABILITY = 0.25;

/** Discount magnitude when applied (5 % of subtotal). */
export const MOCK_DISCOUNT_RATE = 0.05;

/** Baseline monthly sales target used to build `sales_targets` seed rows. */
export const MOCK_BASE_MONTHLY_TARGET = 45_000_000;

/**
 * Probability (0..1) that a given transaction gets seeded with `status = "void"`
 * instead of `"paid"`. Keeps the demo realistic without overwhelming metrics.
 */
export const MOCK_VOID_PROBABILITY = 0.03;
