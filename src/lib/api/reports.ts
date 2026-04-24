import { getDb } from "@/lib/mock/db";
import { config } from "@/lib/config";
import type {
  OrderType,
  PaymentMethod,
  Transaction,
  TransactionStatus,
} from "@/types";
import { delay } from "./_latency";
import { http } from "./http";
import { qs } from "./_qs";
import {
  DASHBOARD_PEAK_HOURS_COUNT,
  LOW_STOCK_WARNING_MULT,
  MONTH_SHORT_LABELS_ID,
  WEEKDAY_SHORT_LABELS_ID,
} from "@/lib/constants";

/** Transactions that contribute to net sales figures. */
const PAID_STATUSES: readonly TransactionStatus[] = ["paid"];

function isPaid(t: Transaction) {
  return t.status === "paid";
}
function isRefunded(t: Transaction) {
  return t.status === "refunded";
}
function isCanceled(t: Transaction) {
  return t.status === "canceled";
}
function isOpen(t: Transaction) {
  return t.status === "open";
}
function isVoid(t: Transaction) {
  return t.status === "void";
}

/** Sum HPP of all items in a transaction (cost of goods actually made). */
function txHpp(t: Transaction) {
  return t.items.reduce((s, it) => s + it.hpp_snapshot * it.quantity, 0);
}

/** Count total units made in a transaction across all items. */
function txUnits(t: Transaction) {
  return t.items.reduce((s, it) => s + it.quantity, 0);
}

/** Net value of a single paid transaction = subtotal − discount. */
function txNet(t: Transaction) {
  return t.subtotal - t.discount_total;
}

export interface SalesSummary {
  revenue: number;
  hpp: number;
  profit: number;
  discount: number;
  ppn: number;
  service_charge: number;
  transaction_count: number;
  item_count: number;
  /** Profit margin as a percentage: 0..100. 0 if revenue = 0. */
  margin_percent: number;
}

function filterTx(
  items: Transaction[],
  params: { outlet_id?: string | null; start?: string; end?: string },
) {
  let list = items;
  if (params.outlet_id) list = list.filter((t) => t.outlet_id === params.outlet_id);
  if (params.start) {
    const start = new Date(params.start).getTime();
    list = list.filter((t) => new Date(t.created_at).getTime() >= start);
  }
  if (params.end) {
    const end = new Date(params.end).getTime();
    list = list.filter((t) => new Date(t.created_at).getTime() <= end);
  }
  return list;
}

export async function summary(params: {
  outlet_id?: string | null;
  start?: string;
  end?: string;
}): Promise<SalesSummary> {
  if (config.api.useRealBackend) {
    return http.get<SalesSummary>(`/api/reports/summary${qs(params)}`);
  }
  const db = getDb();
  const items = filterTx(db.transactions, params).filter((t) =>
    PAID_STATUSES.includes(t.status),
  );
  let revenue = 0,
    hpp = 0,
    discount = 0,
    ppn = 0,
    sc = 0,
    itemCount = 0;
  for (const t of items) {
    revenue += t.subtotal;
    discount += t.discount_total;
    ppn += t.ppn_amount;
    sc += t.service_charge_amount;
    for (const it of t.items) {
      hpp += it.hpp_snapshot * it.quantity;
      itemCount += it.quantity;
    }
  }
  const profit = revenue - hpp - discount;
  const margin_percent = revenue > 0 ? (profit / revenue) * 100 : 0;
  return delay({
    revenue,
    hpp,
    profit,
    discount,
    ppn,
    service_charge: sc,
    transaction_count: items.length,
    item_count: itemCount,
    margin_percent,
  });
}

export interface DailySeriesPoint {
  date: string;
  revenue: number;
  profit: number;
  net_sales: number;
}

export async function dailySeries(params: {
  outlet_id?: string | null;
  days?: number;
}): Promise<DailySeriesPoint[]> {
  if (config.api.useRealBackend) {
    return http.get<DailySeriesPoint[]>(`/api/reports/daily-series${qs(params)}`);
  }
  const db = getDb();
  const days = params.days ?? 7;
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  const start = new Date(now);
  start.setDate(start.getDate() - days + 1);
  start.setHours(0, 0, 0, 0);
  const items = filterTx(db.transactions, {
    outlet_id: params.outlet_id,
    start: start.toISOString(),
    end: now.toISOString(),
  }).filter(isPaid);
  const buckets = new Map<string, DailySeriesPoint>();
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, { date: key, revenue: 0, profit: 0, net_sales: 0 });
  }
  for (const t of items) {
    const key = t.created_at.slice(0, 10);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.revenue += t.subtotal;
    const thpp = t.items.reduce(
      (s, it) => s + it.hpp_snapshot * it.quantity,
      0,
    );
    bucket.profit += t.subtotal - thpp - t.discount_total;
    bucket.net_sales += t.subtotal - t.discount_total;
  }
  return delay(Array.from(buckets.values()));
}

export interface TopMenuRow {
  menu_id: string;
  name: string;
  quantity: number;
  revenue: number;
}

export async function topMenus(params: {
  outlet_id?: string | null;
  limit?: number;
  days?: number;
}): Promise<TopMenuRow[]> {
  if (config.api.useRealBackend) {
    return http.get<TopMenuRow[]>(
      `/api/reports/top-menus${qs({ ...params, order: "desc" })}`,
    );
  }
  const db = getDb();
  const days = params.days ?? 7;
  const start = new Date();
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);
  const items = filterTx(db.transactions, {
    outlet_id: params.outlet_id,
    start: start.toISOString(),
  }).filter(isPaid);
  const map = new Map<string, TopMenuRow>();
  for (const t of items) {
    for (const it of t.items) {
      if (!it.menu_id) continue;
      const row = map.get(it.menu_id) ?? {
        menu_id: it.menu_id,
        name: it.name_snapshot,
        quantity: 0,
        revenue: 0,
      };
      row.quantity += it.quantity;
      row.revenue += it.subtotal;
      map.set(it.menu_id, row);
    }
  }
  return delay(
    Array.from(map.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, params.limit ?? 5),
  );
}

/**
 * Bottom-N menus by quantity sold in the window. A menu must have at least
 * one sale to appear; menus with zero sales are excluded (caller can fetch
 * the full menu list separately if they want "never sold" analysis).
 */
export async function bottomMenus(params: {
  outlet_id?: string | null;
  limit?: number;
  days?: number;
}): Promise<TopMenuRow[]> {
  if (config.api.useRealBackend) {
    return http.get<TopMenuRow[]>(
      `/api/reports/top-menus${qs({ ...params, order: "asc" })}`,
    );
  }
  const db = getDb();
  const days = params.days ?? 30;
  const start = new Date();
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);
  const items = filterTx(db.transactions, {
    outlet_id: params.outlet_id,
    start: start.toISOString(),
  }).filter(isPaid);
  const map = new Map<string, TopMenuRow>();
  for (const t of items) {
    for (const it of t.items) {
      if (!it.menu_id) continue;
      const row = map.get(it.menu_id) ?? {
        menu_id: it.menu_id,
        name: it.name_snapshot,
        quantity: 0,
        revenue: 0,
      };
      row.quantity += it.quantity;
      row.revenue += it.subtotal;
      map.set(it.menu_id, row);
    }
  }
  return delay(
    Array.from(map.values())
      .sort((a, b) => a.quantity - b.quantity)
      .slice(0, params.limit ?? 5),
  );
}

export interface LowStockItem {
  ingredient_id: string;
  name: string;
  outlet_id: string;
  outlet_name: string;
  current_stock: number;
  min_qty: number;
  unit: string;
  severity: "critical" | "warning";
}

export async function lowStock(params: {
  outlet_id?: string | null;
}): Promise<LowStockItem[]> {
  if (config.api.useRealBackend) {
    return http.get<LowStockItem[]>(`/api/reports/low-stock${qs(params)}`);
  }
  const db = getDb();
  const items: LowStockItem[] = [];
  for (const ing of db.ingredients) {
    if (params.outlet_id && ing.outlet_id !== params.outlet_id) continue;
    if (ing.current_stock > ing.min_qty * LOW_STOCK_WARNING_MULT) continue;
    const outlet = db.outlets.find((o) => o.id === ing.outlet_id);
    items.push({
      ingredient_id: ing.id,
      name: ing.name,
      outlet_id: ing.outlet_id,
      outlet_name: outlet?.name ?? "",
      current_stock: ing.current_stock,
      min_qty: ing.min_qty,
      unit: ing.unit,
      severity: ing.current_stock <= ing.min_qty ? "critical" : "warning",
    });
  }
  items.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "critical" ? -1 : 1;
    return a.current_stock / a.min_qty - b.current_stock / b.min_qty;
  });
  return delay(items);
}

export interface WasteSummary {
  total_value: number;
  by_ingredient: Array<{
    ingredient_id: string;
    name: string;
    quantity: number;
    value: number;
  }>;
}

export async function wasteSummary(params: {
  outlet_id?: string | null;
  start?: string;
  end?: string;
}): Promise<WasteSummary> {
  if (config.api.useRealBackend) {
    return http.get<WasteSummary>(`/api/reports/waste-summary${qs(params)}`);
  }
  const db = getDb();
  let movs = db.stock_movements.filter(
    (m) => m.type === "out_waste" || (m.type === "adjustment" && m.quantity < 0),
  );
  if (params.outlet_id)
    movs = movs.filter((m) => m.outlet_id === params.outlet_id);
  if (params.start) {
    const start = new Date(params.start).getTime();
    movs = movs.filter((m) => new Date(m.created_at).getTime() >= start);
  }
  if (params.end) {
    const end = new Date(params.end).getTime();
    movs = movs.filter((m) => new Date(m.created_at).getTime() <= end);
  }
  const map = new Map<
    string,
    { ingredient_id: string; name: string; quantity: number; value: number }
  >();
  for (const m of movs) {
    const ing = db.ingredients.find((i) => i.id === m.ingredient_id);
    if (!ing) continue;
    const qty = Math.abs(m.quantity);
    const row = map.get(ing.id) ?? {
      ingredient_id: ing.id,
      name: `${ing.name} (${ing.outlet_id})`,
      quantity: 0,
      value: 0,
    };
    row.quantity += qty;
    row.value += qty * ing.unit_price;
    map.set(ing.id, row);
  }
  const rows = Array.from(map.values()).sort((a, b) => b.value - a.value);
  return delay({
    total_value: rows.reduce((s, r) => s + r.value, 0),
    by_ingredient: rows,
  });
}

export interface InventoryValueItem {
  outlet_id: string;
  outlet_name: string;
  total_value: number;
  items_count: number;
}

export async function inventoryValue(): Promise<InventoryValueItem[]> {
  if (config.api.useRealBackend) {
    return http.get<InventoryValueItem[]>("/api/reports/inventory-value");
  }
  const db = getDb();
  const result: InventoryValueItem[] = db.outlets.map((o) => {
    const items = db.ingredients.filter((i) => i.outlet_id === o.id);
    return {
      outlet_id: o.id,
      outlet_name: o.name,
      total_value: items.reduce(
        (sum, i) => sum + i.current_stock * i.unit_price,
        0,
      ),
      items_count: items.length,
    };
  });
  return delay(result);
}

/* ------------------------------------------------------------------
 * Dashboard KPI aggregations — used by OwnerDashboard
 * ------------------------------------------------------------------ */

export interface DashboardKpis {
  /** Net sales (paid − discounts) for the window. */
  net_sales: number;
  /** Average transaction value = net_sales / paid_count (0 if none). */
  avg_ticket: number;
  /** Number of paid transactions in the window. */
  paid_count: number;
  /** Number of refunded transactions in the window. */
  refund_count: number;
  /** Number of canceled transactions in the window. */
  canceled_count: number;
  /** Number of transactions still open (not yet paid) in the window. */
  open_count: number;
  /** Number of orders with `order_type === "online"` in the window. */
  online_count: number;
  /** Number of void transactions (salah staff, stok kepakai tanpa revenue). */
  void_count: number;
  /** Total HPP (IDR) hilang karena void — ini adalah kerugian operasional. */
  void_loss: number;
}

export async function dashboardKpis(params: {
  outlet_id?: string | null;
  start?: string;
  end?: string;
}): Promise<DashboardKpis> {
  if (config.api.useRealBackend) {
    return http.get<DashboardKpis>(`/api/reports/dashboard-kpis${qs(params)}`);
  }
  const db = getDb();
  const all = filterTx(db.transactions, params);
  const paid = all.filter(isPaid);
  const voids = all.filter(isVoid);
  const netSales = paid.reduce((s, t) => s + txNet(t), 0);
  const avgTicket = paid.length > 0 ? netSales / paid.length : 0;
  const voidLoss = voids.reduce((s, t) => s + txHpp(t), 0);
  return delay({
    net_sales: netSales,
    avg_ticket: avgTicket,
    paid_count: paid.length,
    refund_count: all.filter(isRefunded).length,
    canceled_count: all.filter(isCanceled).length,
    open_count: all.filter(isOpen).length,
    online_count: all.filter((t) => isPaid(t) && t.order_type === "online").length,
    void_count: voids.length,
    void_loss: voidLoss,
  });
}

/* ------------------------------------------------------------------
 * Monthly target vs actual — drives the yearly bar chart
 * ------------------------------------------------------------------ */

export interface MonthlyTargetActual {
  /** 1-12 */
  month: number;
  target: number;
  /** Net sales (paid − discount) for that calendar month. */
  actual: number;
}

export async function monthlyTargetVsActual(params: {
  outlet_id?: string | null;
  year: number;
}): Promise<MonthlyTargetActual[]> {
  if (config.api.useRealBackend) {
    return http.get<MonthlyTargetActual[]>(
      `/api/reports/monthly-target${qs(params)}`,
    );
  }
  const db = getDb();
  const { year } = params;
  const result: MonthlyTargetActual[] = [];
  for (let m = 1; m <= 12; m++) {
    const start = new Date(year, m - 1, 1, 0, 0, 0, 0).toISOString();
    const end = new Date(year, m, 0, 23, 59, 59, 999).toISOString();
    const paid = filterTx(db.transactions, {
      outlet_id: params.outlet_id,
      start,
      end,
    }).filter(isPaid);
    const actual = paid.reduce((s, t) => s + txNet(t), 0);
    const target =
      db.sales_targets.find((x) => x.year === year && x.month === m)
        ?.target_amount ?? 0;
    result.push({ month: m, target, actual });
  }
  return delay(result);
}

/* ------------------------------------------------------------------
 * Weekly / Hourly / Payment / Order-type breakdowns
 * ------------------------------------------------------------------ */

export interface WeeklyNetPoint {
  /** 0 = Monday … 6 = Sunday (ISO-style weekday index used in chart) */
  weekday: number;
  label: string;
  net_sales: number;
  transaction_count: number;
}

export async function weeklyNet(params: {
  outlet_id?: string | null;
  start?: string;
  end?: string;
}): Promise<WeeklyNetPoint[]> {
  if (config.api.useRealBackend) {
    return http.get<WeeklyNetPoint[]>(`/api/reports/weekly-net${qs(params)}`);
  }
  const db = getDb();
  const paid = filterTx(db.transactions, params).filter(isPaid);
  const buckets: WeeklyNetPoint[] = WEEKDAY_SHORT_LABELS_ID.map((label, i) => ({
    weekday: i,
    label,
    net_sales: 0,
    transaction_count: 0,
  }));
  for (const t of paid) {
    const d = new Date(t.created_at);
    // Convert JS (0=Sun..6=Sat) → Mon-first (0=Mon..6=Sun)
    const idx = (d.getDay() + 6) % 7;
    buckets[idx].net_sales += txNet(t);
    buckets[idx].transaction_count += 1;
  }
  return delay(buckets);
}

export interface HourlyNetPoint {
  /** 0-23 */
  hour: number;
  net_sales: number;
  transaction_count: number;
}

export async function hourlyNet(params: {
  outlet_id?: string | null;
  start?: string;
  end?: string;
}): Promise<HourlyNetPoint[]> {
  if (config.api.useRealBackend) {
    return http.get<HourlyNetPoint[]>(`/api/reports/hourly-net${qs(params)}`);
  }
  const db = getDb();
  const paid = filterTx(db.transactions, params).filter(isPaid);
  const buckets: HourlyNetPoint[] = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    net_sales: 0,
    transaction_count: 0,
  }));
  for (const t of paid) {
    const h = new Date(t.created_at).getHours();
    buckets[h].net_sales += txNet(t);
    buckets[h].transaction_count += 1;
  }
  return delay(buckets);
}

export interface PaymentMethodRow {
  method: PaymentMethod;
  count: number;
  amount: number;
}

export async function paymentMethodBreakdown(params: {
  outlet_id?: string | null;
  start?: string;
  end?: string;
}): Promise<PaymentMethodRow[]> {
  if (config.api.useRealBackend) {
    return http.get<PaymentMethodRow[]>(
      `/api/reports/payment-breakdown${qs(params)}`,
    );
  }
  const db = getDb();
  const paid = filterTx(db.transactions, params).filter(isPaid);
  const map = new Map<PaymentMethod, PaymentMethodRow>();
  for (const t of paid) {
    const row = map.get(t.payment_method) ?? {
      method: t.payment_method,
      count: 0,
      amount: 0,
    };
    row.count += 1;
    row.amount += txNet(t);
    map.set(t.payment_method, row);
  }
  return delay(Array.from(map.values()).sort((a, b) => b.amount - a.amount));
}

export interface OrderTypeRow {
  type: OrderType;
  count: number;
  amount: number;
}

export async function orderTypeBreakdown(params: {
  outlet_id?: string | null;
  start?: string;
  end?: string;
}): Promise<OrderTypeRow[]> {
  if (config.api.useRealBackend) {
    return http.get<OrderTypeRow[]>(
      `/api/reports/order-type-breakdown${qs(params)}`,
    );
  }
  const db = getDb();
  const paid = filterTx(db.transactions, params).filter(isPaid);
  const map = new Map<OrderType, OrderTypeRow>();
  for (const t of paid) {
    const row = map.get(t.order_type) ?? {
      type: t.order_type,
      count: 0,
      amount: 0,
    };
    row.count += 1;
    row.amount += txNet(t);
    map.set(t.order_type, row);
  }
  return delay(Array.from(map.values()).sort((a, b) => b.amount - a.amount));
}

/* ------------------------------------------------------------------
 * Year-over-year comparison — net sales aggregated per calendar month
 * for the current year vs the previous year. Drives the side-by-side
 * bar chart on the dashboard.
 * ------------------------------------------------------------------ */

export interface YearComparisonMonth {
  /** 1-12 */
  month: number;
  /** Short localized label, e.g. "Jan". */
  label: string;
  /** Net sales for `current_year`, this month. */
  current: number;
  /** Net sales for `previous_year`, this month. */
  previous: number;
}

export interface YearComparisonResult {
  current_year: number;
  previous_year: number;
  /** Aggregate net sales of the current year so far. */
  total_current: number;
  /** Aggregate net sales of the previous year. */
  total_previous: number;
  /** Percentage change (0 if previous = 0). */
  delta_percent: number;
  months: YearComparisonMonth[];
}

export async function yearComparison(params: {
  outlet_id?: string | null;
  /** Anchor year (current). Defaults to today's year. Previous year = year - 1. */
  year?: number;
}): Promise<YearComparisonResult> {
  if (config.api.useRealBackend) {
    return http.get<YearComparisonResult>(
      `/api/reports/year-comparison${qs(params)}`,
    );
  }
  const db = getDb();
  const now = new Date();
  const currentYear = params.year ?? now.getFullYear();
  const previousYear = currentYear - 1;

  function monthNet(y: number, m: number): number {
    const start = new Date(y, m - 1, 1, 0, 0, 0, 0).toISOString();
    const end = new Date(y, m, 0, 23, 59, 59, 999).toISOString();
    const paid = filterTx(db.transactions, {
      outlet_id: params.outlet_id,
      start,
      end,
    }).filter(isPaid);
    return paid.reduce((s, t) => s + txNet(t), 0);
  }

  const months: YearComparisonMonth[] = [];
  let totalCurrent = 0;
  let totalPrevious = 0;
  for (let m = 1; m <= 12; m++) {
    const current = monthNet(currentYear, m);
    const previous = monthNet(previousYear, m);
    totalCurrent += current;
    totalPrevious += previous;
    months.push({
      month: m,
      label: MONTH_SHORT_LABELS_ID[m - 1],
      current,
      previous,
    });
  }

  const deltaPercent =
    totalPrevious > 0
      ? ((totalCurrent - totalPrevious) / totalPrevious) * 100
      : 0;

  return delay({
    current_year: currentYear,
    previous_year: previousYear,
    total_current: totalCurrent,
    total_previous: totalPrevious,
    delta_percent: deltaPercent,
    months,
  });
}

/* ------------------------------------------------------------------
 * Peak hours — top N hours by net sales in the window. UI layer
 * should not re-sort `hourlyNet()` output; request this instead.
 * ------------------------------------------------------------------ */

export interface PeakHourRow {
  /** 0-23 */
  hour: number;
  net_sales: number;
  transaction_count: number;
}

export async function topHours(params: {
  outlet_id?: string | null;
  start?: string;
  end?: string;
  /** How many rows to return. Defaults to `DASHBOARD_PEAK_HOURS_COUNT`. */
  limit?: number;
}): Promise<PeakHourRow[]> {
  const all = await hourlyNet(params);
  const limit = params.limit ?? DASHBOARD_PEAK_HOURS_COUNT;
  return all
    .filter((h) => h.transaction_count > 0)
    .sort((a, b) => b.net_sales - a.net_sales)
    .slice(0, limit);
}

/* ------------------------------------------------------------------
 * Void report — pesanan yang sudah DIBUAT (stok terpotong, menu keluar)
 * tetapi TIDAK diterima pelanggan karena kesalahan staff. Tidak ada
 * revenue, tapi HPP tercatat sebagai kerugian operasional.
 *
 * Semua fungsi di bawah ini MENGHITUNG kerugian berdasarkan
 * `hpp_snapshot` setiap item transaksi void — sumber kebenaran untuk
 * "berapa IDR yang hilang" setara dengan `wasteSummary()`.
 * ------------------------------------------------------------------ */

export interface VoidSummary {
  /** Total transaksi void di periode. */
  count: number;
  /** Total item (porsi) yang dibuat lalu di-void. */
  item_count: number;
  /** Total HPP (IDR) hilang — biaya bahan yang sudah dipakai. */
  total_loss: number;
  /** Proporsi terhadap seluruh transaksi paid+void (0..100). */
  rate_percent: number;
}

export async function voidSummary(params: {
  outlet_id?: string | null;
  start?: string;
  end?: string;
}): Promise<VoidSummary> {
  if (config.api.useRealBackend) {
    return http.get<VoidSummary>(`/api/reports/void-summary${qs(params)}`);
  }
  const db = getDb();
  const all = filterTx(db.transactions, params);
  const voids = all.filter(isVoid);
  const paid = all.filter(isPaid);
  const total_loss = voids.reduce((s, t) => s + txHpp(t), 0);
  const item_count = voids.reduce((s, t) => s + txUnits(t), 0);
  const denom = voids.length + paid.length;
  const rate_percent = denom > 0 ? (voids.length / denom) * 100 : 0;
  return delay({
    count: voids.length,
    item_count,
    total_loss,
    rate_percent,
  });
}

export interface VoidDailyPoint {
  date: string;
  count: number;
  loss: number;
}

export async function voidSeries(params: {
  outlet_id?: string | null;
  days?: number;
}): Promise<VoidDailyPoint[]> {
  if (config.api.useRealBackend) {
    return http.get<VoidDailyPoint[]>(`/api/reports/void-series${qs(params)}`);
  }
  const db = getDb();
  const days = params.days ?? 30;
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  const start = new Date(now);
  start.setDate(start.getDate() - days + 1);
  start.setHours(0, 0, 0, 0);
  const voids = filterTx(db.transactions, {
    outlet_id: params.outlet_id,
    start: start.toISOString(),
    end: now.toISOString(),
  }).filter(isVoid);
  const buckets = new Map<string, VoidDailyPoint>();
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, { date: key, count: 0, loss: 0 });
  }
  for (const t of voids) {
    const key = t.created_at.slice(0, 10);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.count += 1;
    bucket.loss += txHpp(t);
  }
  return delay(Array.from(buckets.values()));
}

export interface VoidMenuRow {
  menu_id: string;
  name: string;
  quantity: number;
  loss: number;
}

export async function voidByMenu(params: {
  outlet_id?: string | null;
  start?: string;
  end?: string;
  limit?: number;
}): Promise<VoidMenuRow[]> {
  if (config.api.useRealBackend) {
    return http.get<VoidMenuRow[]>(`/api/reports/void-by-menu${qs(params)}`);
  }
  const db = getDb();
  const voids = filterTx(db.transactions, params).filter(isVoid);
  const map = new Map<string, VoidMenuRow>();
  for (const t of voids) {
    for (const it of t.items) {
      if (!it.menu_id) continue;
      const row = map.get(it.menu_id) ?? {
        menu_id: it.menu_id,
        name: it.name_snapshot,
        quantity: 0,
        loss: 0,
      };
      row.quantity += it.quantity;
      row.loss += it.hpp_snapshot * it.quantity;
      map.set(it.menu_id, row);
    }
  }
  return delay(
    Array.from(map.values())
      .sort((a, b) => b.loss - a.loss)
      .slice(0, params.limit ?? 10),
  );
}

export interface VoidReasonRow {
  reason: string;
  count: number;
  loss: number;
}

export async function voidByReason(params: {
  outlet_id?: string | null;
  start?: string;
  end?: string;
}): Promise<VoidReasonRow[]> {
  if (config.api.useRealBackend) {
    return http.get<VoidReasonRow[]>(`/api/reports/void-by-reason${qs(params)}`);
  }
  const db = getDb();
  const voids = filterTx(db.transactions, params).filter(isVoid);
  const map = new Map<string, VoidReasonRow>();
  for (const t of voids) {
    const reason = t.void_reason ?? "Tanpa alasan";
    const row = map.get(reason) ?? { reason, count: 0, loss: 0 };
    row.count += 1;
    row.loss += txHpp(t);
    map.set(reason, row);
  }
  return delay(Array.from(map.values()).sort((a, b) => b.loss - a.loss));
}

export interface VoidStaffRow {
  user_id: string;
  user_name: string;
  count: number;
  loss: number;
}

export async function voidByStaff(params: {
  outlet_id?: string | null;
  start?: string;
  end?: string;
  limit?: number;
}): Promise<VoidStaffRow[]> {
  if (config.api.useRealBackend) {
    return http.get<VoidStaffRow[]>(`/api/reports/void-by-staff${qs(params)}`);
  }
  const db = getDb();
  const voids = filterTx(db.transactions, params).filter(isVoid);
  const map = new Map<string, VoidStaffRow>();
  for (const t of voids) {
    const actorId = t.voided_by ?? t.user_id;
    if (!actorId) continue;
    const user = db.users.find((u) => u.id === actorId);
    const row = map.get(actorId) ?? {
      user_id: actorId,
      user_name: user?.name ?? "Staff tidak dikenal",
      count: 0,
      loss: 0,
    };
    row.count += 1;
    row.loss += txHpp(t);
    map.set(actorId, row);
  }
  return delay(
    Array.from(map.values())
      .sort((a, b) => b.loss - a.loss)
      .slice(0, params.limit ?? 10),
  );
}

export interface VoidRow {
  id: string;
  created_at: string;
  outlet_id: string;
  outlet_name: string;
  user_id: string;
  user_name: string;
  reason: string;
  items_label: string;
  item_count: number;
  loss: number;
}

export async function voidList(params: {
  outlet_id?: string | null;
  start?: string;
  end?: string;
  limit?: number;
}): Promise<VoidRow[]> {
  if (config.api.useRealBackend) {
    return http.get<VoidRow[]>(`/api/reports/void-list${qs(params)}`);
  }
  const db = getDb();
  const voids = filterTx(db.transactions, params).filter(isVoid);
  const rows: VoidRow[] = voids
    .slice()
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .map((t) => {
      const outlet = db.outlets.find((o) => o.id === t.outlet_id);
      const actorId = t.voided_by ?? t.user_id;
      const user = actorId
        ? db.users.find((u) => u.id === actorId)
        : undefined;
      const names = t.items.map(
        (it) => `${it.name_snapshot}${it.quantity > 1 ? ` × ${it.quantity}` : ""}`,
      );
      return {
        id: t.id,
        created_at: t.created_at,
        outlet_id: t.outlet_id,
        outlet_name: outlet?.name ?? t.outlet_id,
        user_id: actorId ?? "",
        user_name: user?.name ?? "Staff tidak dikenal",
        reason: t.void_reason ?? "Tanpa alasan",
        items_label: names.join(", "),
        item_count: txUnits(t),
        loss: txHpp(t),
      };
    });
  const limit = params.limit ?? rows.length;
  return delay(rows.slice(0, limit));
}
