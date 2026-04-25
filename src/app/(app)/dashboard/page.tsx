"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useAuthStore } from "@/stores/auth-store";
import { useOutletStore } from "@/stores/outlet-store";
import { ingredientsApi, reportsApi } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { SalesChart } from "@/components/dashboard/sales-chart";
import { TopMenuList } from "@/components/dashboard/top-menu-list";
import { BottomMenuList } from "@/components/dashboard/bottom-menu-list";
import { LowStockPanel } from "@/components/dashboard/low-stock-panel";
import { MonthlyTargetChart } from "@/components/dashboard/monthly-target-chart";
import { WeeklyNetChart } from "@/components/dashboard/weekly-net-chart";
import { HourlyNetChart } from "@/components/dashboard/hourly-net-chart";
import { DailyNetChart } from "@/components/dashboard/daily-net-chart";
import { MonthComparisonChart } from "@/components/dashboard/month-comparison-chart";
import { PaymentMethodChart } from "@/components/dashboard/payment-method-chart";
import { OrderTypeChart } from "@/components/dashboard/order-type-chart";
import {
  formatDateTime,
  formatIDR,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import {
  DASHBOARD_INGREDIENT_PREVIEW_LIMIT,
  DASHBOARD_MENU_LIST_LIMIT,
  DASHBOARD_SKELETON,
  DASHBOARD_TARGET_YEARS_BACK,
  DASHBOARD_TREND_DAYS,
  DASHBOARD_WINDOW_DAYS,
  LOW_STOCK_WARNING_MULT,
} from "@/lib/constants";
import {
  AlertTriangle,
  Ban,
  Boxes,
  CircleDollarSign,
  Clock,
  Coins,
  Globe,
  PackageCheck,
  PackageSearch,
  Receipt,
  ReceiptText,
  RotateCcw,
  TrendingUp,
  XOctagon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function KepalaTokoDashboard() {
  const outletId = useOutletStore((s) => s.selectedOutletId);
  const user = useAuthStore((s) => s.user);
  const effectiveOutletId = user?.outlet_id ?? outletId;

  const { data: lowStock = [], isLoading: loadingLow } = useQuery({
    queryKey: ["dashboard.lowStock", effectiveOutletId],
    queryFn: () => reportsApi.lowStock({ outlet_id: effectiveOutletId }),
  });

  const { data: ingredients = [], isLoading: loadingIng } = useQuery({
    queryKey: ["ingredients", effectiveOutletId],
    queryFn: () =>
      ingredientsApi.list(
        effectiveOutletId ? { outlet_id: effectiveOutletId } : undefined,
      ),
  });

  const totalItems = ingredients.length;
  const criticalCount = lowStock.filter((i) => i.severity === "critical").length;
  const warningCount = lowStock.filter((i) => i.severity === "warning").length;
  const safeCount = Math.max(0, totalItems - criticalCount - warningCount);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Halo, ${user?.name ?? "User"}`}
        description="Ringkasan stok bahan di outlet Anda."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {loadingIng || loadingLow ? (
          <>
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </>
        ) : (
          <>
            <KpiCard
              label="Total Bahan"
              value={formatNumber(totalItems)}
              icon={Boxes}
              hint="SKU aktif di outlet"
            />
            <KpiCard
              label="Stok Kritis"
              value={formatNumber(criticalCount)}
              icon={AlertTriangle}
              tone={criticalCount > 0 ? "danger" : "default"}
              hint="≤ minimum stok"
            />
            <KpiCard
              label="Perlu Perhatian"
              value={formatNumber(warningCount)}
              icon={PackageSearch}
              tone={warningCount > 0 ? "warning" : "default"}
              hint="≤ 1.5× minimum"
            />
            <KpiCard
              label="Stok Aman"
              value={formatNumber(safeCount)}
              icon={PackageCheck}
              tone={safeCount > 0 ? "success" : "default"}
              hint="di atas ambang aman"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <LowStockPanel items={lowStock} />
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Aksi Cepat</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href="/inventory/stock-in">
                <PackageCheck className="h-4 w-4" /> Input Stok Masuk
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href="/inventory">
                <Boxes className="h-4 w-4" /> Lihat Daftar Bahan
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href="/inventory/opname">
                <PackageSearch className="h-4 w-4" /> Stock Opname
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href="/reports/inventory">
                <ReceiptText className="h-4 w-4" /> Laporan Inventory
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {!loadingIng && ingredients.length > 0 ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Ringkasan Bahan</CardTitle>
              <Badge variant="secondary">{ingredients.length} item</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {ingredients.slice(0, DASHBOARD_INGREDIENT_PREVIEW_LIMIT).map((ing) => {
                const isCritical = ing.current_stock <= ing.min_qty;
                const isWarning =
                  !isCritical &&
                  ing.current_stock <= ing.min_qty * LOW_STOCK_WARNING_MULT;
                return (
                  <li
                    key={ing.id}
                    className="flex items-center justify-between rounded-md border p-2 text-xs"
                  >
                    <div>
                      <p className="font-medium">{ing.name}</p>
                      <p className="text-muted-foreground">
                        min {formatNumber(ing.min_qty)} {ing.unit}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 tabular">
                      <span className="font-medium">
                        {formatNumber(ing.current_stock)} {ing.unit}
                      </span>
                      {isCritical ? (
                        <Badge variant="danger" className="px-1.5 py-0 text-[10px]">
                          Kritis
                        </Badge>
                      ) : isWarning ? (
                        <Badge variant="warning" className="px-1.5 py-0 text-[10px]">
                          Rendah
                        </Badge>
                      ) : (
                        <Badge variant="success" className="px-1.5 py-0 text-[10px]">
                          Aman
                        </Badge>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            {ingredients.length > DASHBOARD_INGREDIENT_PREVIEW_LIMIT ? (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Menampilkan {DASHBOARD_INGREDIENT_PREVIEW_LIMIT} dari {ingredients.length} bahan.{" "}
                <Link
                  href="/inventory"
                  className="font-medium text-foreground underline"
                >
                  Lihat semua
                </Link>
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function OwnerDashboard() {
  const user = useAuthStore((s) => s.user);
  const outletId = useOutletStore((s) => s.selectedOutletId);

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(currentYear);
  const years = useMemo(() => {
    const out: number[] = [];
    for (let i = DASHBOARD_TARGET_YEARS_BACK; i >= 0; i--) {
      out.push(currentYear - i);
    }
    return out;
  }, [currentYear]);

  const windowRange = useMemo(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setDate(end.getDate() - (DASHBOARD_WINDOW_DAYS - 1));
    start.setHours(0, 0, 0, 0);
    return { start: start.toISOString(), end: end.toISOString() };
  }, []);

  const { data: kpis, isLoading: loadingKpis } = useQuery({
    queryKey: ["dashboard.kpis", outletId, windowRange.start, windowRange.end],
    queryFn: () =>
      reportsApi.dashboardKpis({
        outlet_id: outletId,
        start: windowRange.start,
        end: windowRange.end,
      }),
  });

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["dashboard.summary", outletId, windowRange.start, windowRange.end],
    queryFn: () =>
      reportsApi.summary({
        outlet_id: outletId,
        start: windowRange.start,
        end: windowRange.end,
      }),
  });

  const { data: series = [], isLoading: loadingSeries } = useQuery({
    queryKey: ["dashboard.series", outletId, DASHBOARD_TREND_DAYS],
    queryFn: () =>
      reportsApi.dailySeries({
        outlet_id: outletId,
        days: DASHBOARD_TREND_DAYS,
      }),
  });

  const { data: dailyNet = [], isLoading: loadingDaily } = useQuery({
    queryKey: ["dashboard.dailyNet", outletId, DASHBOARD_WINDOW_DAYS],
    queryFn: () =>
      reportsApi.dailySeries({
        outlet_id: outletId,
        days: DASHBOARD_WINDOW_DAYS,
      }),
  });

  const { data: topMenus = [] } = useQuery({
    queryKey: ["dashboard.topMenus", outletId, DASHBOARD_WINDOW_DAYS],
    queryFn: () =>
      reportsApi.topMenus({
        outlet_id: outletId,
        days: DASHBOARD_WINDOW_DAYS,
        limit: DASHBOARD_MENU_LIST_LIMIT,
      }),
  });

  const { data: bottomMenus = [] } = useQuery({
    queryKey: ["dashboard.bottomMenus", outletId, DASHBOARD_WINDOW_DAYS],
    queryFn: () =>
      reportsApi.bottomMenus({
        outlet_id: outletId,
        days: DASHBOARD_WINDOW_DAYS,
        limit: DASHBOARD_MENU_LIST_LIMIT,
      }),
  });

  const { data: lowStock = [] } = useQuery({
    queryKey: ["dashboard.lowStock", outletId],
    queryFn: () => reportsApi.lowStock({ outlet_id: outletId }),
  });

  const { data: targetActual = [], isLoading: loadingTarget } = useQuery({
    queryKey: ["dashboard.targetActual", outletId, year],
    queryFn: () =>
      reportsApi.monthlyTargetVsActual({ outlet_id: outletId, year }),
  });

  const { data: weekly = [], isLoading: loadingWeekly } = useQuery({
    queryKey: ["dashboard.weekly", outletId, windowRange.start, windowRange.end],
    queryFn: () =>
      reportsApi.weeklyNet({
        outlet_id: outletId,
        start: windowRange.start,
        end: windowRange.end,
      }),
  });

  const { data: hourly = [], isLoading: loadingHourly } = useQuery({
    queryKey: ["dashboard.hourly", outletId, windowRange.start, windowRange.end],
    queryFn: () =>
      reportsApi.hourlyNet({
        outlet_id: outletId,
        start: windowRange.start,
        end: windowRange.end,
      }),
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["dashboard.payments", outletId, windowRange.start, windowRange.end],
    queryFn: () =>
      reportsApi.paymentMethodBreakdown({
        outlet_id: outletId,
        start: windowRange.start,
        end: windowRange.end,
      }),
  });

  const { data: orderTypes = [] } = useQuery({
    queryKey: ["dashboard.orderTypes", outletId, windowRange.start, windowRange.end],
    queryFn: () =>
      reportsApi.orderTypeBreakdown({
        outlet_id: outletId,
        start: windowRange.start,
        end: windowRange.end,
      }),
  });

  const { data: monthCompare, isLoading: loadingMonthCompare } = useQuery({
    queryKey: ["dashboard.yearCompare", outletId],
    queryFn: () => reportsApi.yearComparison({ outlet_id: outletId }),
  });

  const { data: peakHours = [] } = useQuery({
    queryKey: ["dashboard.peakHours", outletId, windowRange.start, windowRange.end],
    queryFn: () =>
      reportsApi.topHours({
        outlet_id: outletId,
        start: windowRange.start,
        end: windowRange.end,
      }),
  });

  const { data: recentVoids = [], isLoading: loadingVoids } = useQuery({
    queryKey: [
      "dashboard.recentVoids",
      outletId,
      windowRange.start,
      windowRange.end,
    ],
    queryFn: () =>
      reportsApi.voidList({
        outlet_id: outletId,
        start: windowRange.start,
        end: windowRange.end,
        limit: DASHBOARD_MENU_LIST_LIMIT,
      }),
  });

  const margin = summary?.margin_percent ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Halo, ${user?.name ?? "User"}`}
        description={`Ringkasan performa ${DASHBOARD_WINDOW_DAYS} hari terakhir${outletId ? " · outlet terpilih" : " · semua outlet"}.`}
      />

      {/* Row 1 — 4 financial KPIs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {loadingKpis || loadingSummary ? (
          <>
            <Skeleton className={DASHBOARD_SKELETON.kpi} />
            <Skeleton className={DASHBOARD_SKELETON.kpi} />
            <Skeleton className={DASHBOARD_SKELETON.kpi} />
            <Skeleton className={DASHBOARD_SKELETON.kpi} />
          </>
        ) : (
          <>
            <KpiCard
              label="Penjualan Bersih"
              value={formatIDR(kpis?.net_sales ?? 0)}
              icon={Coins}
              hint={`${kpis?.paid_count ?? 0} transaksi lunas`}
            />
            <KpiCard
              label="Rata-rata / Transaksi"
              value={formatIDR(kpis?.avg_ticket ?? 0)}
              icon={CircleDollarSign}
              hint={`Rata-rata ${DASHBOARD_WINDOW_DAYS} hari`}
            />
            <KpiCard
              label={`Profit ${DASHBOARD_WINDOW_DAYS} Hari`}
              value={formatIDR(summary?.profit ?? 0)}
              tone={summary && summary.profit > 0 ? "success" : "default"}
              icon={TrendingUp}
              hint={`Margin ${formatPercent(margin)}`}
            />
            <KpiCard
              label="PPN + Service Charge"
              value={formatIDR(
                (summary?.ppn ?? 0) + (summary?.service_charge ?? 0),
              )}
              icon={ReceiptText}
              hint={`Dikumpulkan ${DASHBOARD_WINDOW_DAYS} hari`}
            />
          </>
        )}
      </div>

      {/* Row 2 — 4 status KPIs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {loadingKpis ? (
          <>
            <Skeleton className={DASHBOARD_SKELETON.kpiCompact} />
            <Skeleton className={DASHBOARD_SKELETON.kpiCompact} />
            <Skeleton className={DASHBOARD_SKELETON.kpiCompact} />
            <Skeleton className={DASHBOARD_SKELETON.kpiCompact} />
          </>
        ) : (
          <>
            <KpiCard
              label="Pengembalian (Refund)"
              value={formatNumber(kpis?.refund_count ?? 0)}
              icon={RotateCcw}
              tone={(kpis?.refund_count ?? 0) > 0 ? "warning" : "default"}
              hint="Transaksi dikembalikan"
            />
            <KpiCard
              label="Dibatalkan"
              value={formatNumber(kpis?.canceled_count ?? 0)}
              icon={Ban}
              tone={(kpis?.canceled_count ?? 0) > 0 ? "danger" : "default"}
              hint="Transaksi dibatalkan"
            />
            <KpiCard
              label="Pesanan Terbuka"
              value={formatNumber(kpis?.open_count ?? 0)}
              icon={Receipt}
              tone={(kpis?.open_count ?? 0) > 0 ? "warning" : "default"}
              hint="Belum dibayar"
            />
            <KpiCard
              label="Pesanan Online"
              value={formatNumber(kpis?.online_count ?? 0)}
              icon={Globe}
              hint="Marketplace / aplikasi"
            />
          </>
        )}
      </div>

      {/* Row 2.5 — Void orders (stok terpakai, no revenue) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          {loadingKpis ? (
            <>
              <Skeleton className={DASHBOARD_SKELETON.kpiCompact} />
              <Skeleton className={DASHBOARD_SKELETON.kpiCompact} />
            </>
          ) : (
            <>
              <KpiCard
                label="Pesanan Void"
                value={formatNumber(kpis?.void_count ?? 0)}
                icon={XOctagon}
                tone={(kpis?.void_count ?? 0) > 0 ? "danger" : "default"}
                hint="Dibuat tapi tidak diterima"
              />
              <KpiCard
                label="Kerugian Void (HPP)"
                value={formatIDR(kpis?.void_loss ?? 0)}
                icon={Coins}
                tone={(kpis?.void_loss ?? 0) > 0 ? "danger" : "default"}
                hint={`${DASHBOARD_WINDOW_DAYS} hari terakhir`}
              />
            </>
          )}
        </div>
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <XOctagon className="h-4 w-4 text-red-500" /> Pesanan Void Terakhir
              </CardTitle>
              <Button asChild variant="outline" size="sm">
                <Link href="/reports/void">Lihat laporan lengkap</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingVoids ? (
              <Skeleton className="h-32" />
            ) : recentVoids.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Tidak ada pesanan void di periode ini. Kerja bagus!
              </p>
            ) : (
              <ul className="space-y-2">
                {recentVoids.map((v) => (
                  <li
                    key={v.id}
                    className="flex items-start justify-between gap-3 rounded-md border p-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{v.items_label}</p>
                      <p className="text-muted-foreground">
                        {v.reason} · {v.user_name}
                      </p>
                    </div>
                    <div className="shrink-0 text-right tabular">
                      <p className="font-medium text-red-600">
                        −{formatIDR(v.loss, { compact: true })}
                      </p>
                      <p className="text-muted-foreground">
                        {formatDateTime(v.created_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3 — Monthly target vs actual (full width) */}
      <div>
        {loadingTarget ? (
          <Skeleton className={DASHBOARD_SKELETON.chartMedium} />
        ) : (
          <MonthlyTargetChart
            data={targetActual}
            year={year}
            years={years}
            onYearChange={setYear}
          />
        )}
      </div>

      {/* Row 4 — 7-day trend + Top menu */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {loadingSeries ? (
            <Skeleton className={DASHBOARD_SKELETON.chartMedium} />
          ) : (
            <SalesChart
              data={series}
              windowLabel={`${DASHBOARD_TREND_DAYS} Hari`}
            />
          )}
        </div>
        <TopMenuList data={topMenus} />
      </div>

      {/* Row 5 — Daily net 30-day + Bottom menu */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {loadingDaily ? (
            <Skeleton className={DASHBOARD_SKELETON.chartTrend} />
          ) : (
            <DailyNetChart data={dailyNet} days={DASHBOARD_WINDOW_DAYS} />
          )}
        </div>
        <BottomMenuList data={bottomMenus} days={DASHBOARD_WINDOW_DAYS} />
      </div>

      {/* Row 5.5 — Year-over-year comparison (full width) */}
      <div>
        {loadingMonthCompare || !monthCompare ? (
          <Skeleton className={DASHBOARD_SKELETON.chartTall} />
        ) : (
          <MonthComparisonChart data={monthCompare} />
        )}
      </div>

      {/* Row 6 — Weekly + Hourly side-by-side */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {loadingWeekly ? (
          <Skeleton className={DASHBOARD_SKELETON.chartTrend} />
        ) : (
          <WeeklyNetChart data={weekly} />
        )}
        {loadingHourly ? (
          <Skeleton className={DASHBOARD_SKELETON.chartTrend} />
        ) : (
          <HourlyNetChart data={hourly} />
        )}
      </div>

      {/* Row 7 — Payment method + Order type pies */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PaymentMethodChart data={payments} />
        <OrderTypeChart data={orderTypes} />
      </div>

      {/* Row 8 — Low stock */}
      <LowStockPanel items={lowStock} />

      {/* Peak hours surfaced from pre-aggregated API. */}
      {peakHours.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" /> Jam Tersibuk
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PeakHoursSummary rows={peakHours} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function PeakHoursSummary({
  rows,
}: {
  rows: { hour: number; net_sales: number; transaction_count: number }[];
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Belum ada transaksi.</p>
    );
  }
  return (
    <ul className="flex flex-wrap gap-3 text-xs">
      {rows.map((h, i) => (
        <li
          key={h.hour}
          className="flex items-center gap-2 rounded-md border px-3 py-2"
        >
          <Badge variant={i === 0 ? "success" : "secondary"}>#{i + 1}</Badge>
          <div>
            <p className="font-medium">
              {String(h.hour).padStart(2, "0")}:00 – {String((h.hour + 1) % 24).padStart(2, "0")}:00
            </p>
            <p className="text-muted-foreground tabular">
              {formatIDR(h.net_sales, { compact: true })} · {h.transaction_count} tx
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  if (!user) return null;
  if (user.role === "kepala_toko") return <KepalaTokoDashboard />;
  return <OwnerDashboard />;
}
