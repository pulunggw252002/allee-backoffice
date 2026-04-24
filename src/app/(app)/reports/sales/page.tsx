"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { reportsApi, transactionsApi } from "@/lib/api";
import { useOutletStore } from "@/stores/outlet-store";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DateRangePicker,
  toRange,
  type DateRange,
} from "@/components/reports/date-range-picker";
import { ExportButton } from "@/components/reports/export-button";
import { SalesChart } from "@/components/dashboard/sales-chart";
import { formatIDR, formatDateTime, formatNumber } from "@/lib/format";
import { DASHBOARD_WINDOW_DAYS, PAYMENT_METHOD_LABEL } from "@/lib/constants";

const TOP_MENU_LIMIT = 10;

export default function SalesReportPage() {
  const outletId = useOutletStore((s) => s.selectedOutletId);
  const [range, setRange] = useState<DateRange>(toRange("7d"));

  const { data: summary } = useQuery({
    queryKey: ["report.sales.summary", outletId, range.start, range.end],
    queryFn: () =>
      reportsApi.summary({
        outlet_id: outletId,
        start: range.start,
        end: range.end,
      }),
  });

  const diffDays = Math.max(
    1,
    Math.ceil(
      (new Date(range.end).getTime() - new Date(range.start).getTime()) /
        86400000,
    ),
  );
  const seriesDays = Math.min(diffDays, 90);

  const { data: series = [] } = useQuery({
    queryKey: ["report.sales.series", outletId, seriesDays],
    queryFn: () =>
      reportsApi.dailySeries({
        outlet_id: outletId,
        days: seriesDays,
      }),
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["report.sales.tx", outletId, range.start, range.end],
    queryFn: () =>
      transactionsApi.list({
        outlet_id: outletId,
        start: range.start,
        end: range.end,
      }),
  });

  const { data: topMenus = [] } = useQuery({
    queryKey: ["report.sales.top", outletId],
    queryFn: () =>
      reportsApi.topMenus({
        outlet_id: outletId,
        days: DASHBOARD_WINDOW_DAYS,
        limit: TOP_MENU_LIMIT,
      }),
  });

  const exportRows = transactions.flatMap((t) =>
    t.items.map((it) => ({
      transaction_id: t.id,
      waktu: t.created_at,
      outlet: t.outlet_id,
      item: it.name_snapshot,
      qty: it.quantity,
      unit_price: it.unit_price,
      subtotal: it.subtotal,
      payment: t.payment_method,
    })),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laporan Penjualan"
        description="Ringkasan revenue, transaksi, dan menu terlaris di periode terpilih."
        actions={
          <ExportButton
            data={exportRows}
            filename={`sales-${range.start.slice(0, 10)}`}
          />
        }
      />

      <DateRangePicker value={range} onChange={setRange} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Revenue</p>
            <p className="mt-1 text-2xl font-semibold tabular">
              {formatIDR(summary?.revenue ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">
              Transaksi
            </p>
            <p className="mt-1 text-2xl font-semibold tabular">
              {formatNumber(summary?.transaction_count ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">
              Porsi Terjual
            </p>
            <p className="mt-1 text-2xl font-semibold tabular">
              {formatNumber(summary?.item_count ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Diskon</p>
            <p className="mt-1 text-2xl font-semibold tabular text-amber-600">
              {formatIDR(summary?.discount ?? 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <SalesChart data={series} days={seriesDays} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Top {TOP_MENU_LIMIT} Menu ({DASHBOARD_WINDOW_DAYS} hari)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Menu</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topMenus.map((m, idx) => (
                  <TableRow key={m.menu_id}>
                    <TableCell className="text-sm">
                      <span className="text-muted-foreground tabular">
                        #{idx + 1}
                      </span>{" "}
                      {m.name}
                    </TableCell>
                    <TableCell className="text-right tabular">
                      {formatNumber(m.quantity)}
                    </TableCell>
                    <TableCell className="text-right tabular">
                      {formatIDR(m.revenue)}
                    </TableCell>
                  </TableRow>
                ))}
                {topMenus.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-sm text-muted-foreground"
                    >
                      Belum ada penjualan.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Transaksi Terakhir</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Waktu</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Bayar</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.slice(0, 10).map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-xs tabular text-muted-foreground">
                      {formatDateTime(t.created_at)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {t.items.length} items
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="uppercase text-xs">
                        {PAYMENT_METHOD_LABEL[t.payment_method]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular">
                      {formatIDR(t.grand_total)}
                    </TableCell>
                  </TableRow>
                ))}
                {transactions.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-sm text-muted-foreground"
                    >
                      Tidak ada transaksi.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
