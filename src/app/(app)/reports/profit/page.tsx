"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { menusApi, reportsApi, transactionsApi } from "@/lib/api";
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
import { formatIDR, formatPercent } from "@/lib/format";
import { calcMargin, marginToBadgeVariant } from "@/lib/hpp";

export default function ProfitReportPage() {
  const outletId = useOutletStore((s) => s.selectedOutletId);
  const [range, setRange] = useState<DateRange>(toRange("30d"));

  const { data: summary } = useQuery({
    queryKey: ["report.profit.summary", outletId, range.start, range.end],
    queryFn: () =>
      reportsApi.summary({
        outlet_id: outletId,
        start: range.start,
        end: range.end,
      }),
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["report.profit.tx", outletId, range.start, range.end],
    queryFn: () =>
      transactionsApi.list({
        outlet_id: outletId,
        start: range.start,
        end: range.end,
      }),
  });

  const { data: menus = [] } = useQuery({
    queryKey: ["menus", "all-report"],
    queryFn: () => menusApi.list(),
  });

  const perMenu = new Map<
    string,
    { menu_id: string; name: string; qty: number; revenue: number; hpp: number }
  >();
  for (const t of transactions) {
    for (const it of t.items) {
      if (!it.menu_id) continue;
      const row = perMenu.get(it.menu_id) ?? {
        menu_id: it.menu_id,
        name: it.name_snapshot,
        qty: 0,
        revenue: 0,
        hpp: 0,
      };
      row.qty += it.quantity;
      row.revenue += it.subtotal;
      row.hpp += it.hpp_snapshot * it.quantity;
      perMenu.set(it.menu_id, row);
    }
  }
  const rows = Array.from(perMenu.values())
    .map((r) => ({ ...r, profit: r.revenue - r.hpp }))
    .sort((a, b) => b.profit - a.profit);

  const totalMargin =
    summary && summary.revenue > 0
      ? (summary.profit / summary.revenue) * 100
      : 0;

  const exportRows = rows.map((r) => ({
    menu_id: r.menu_id,
    menu: r.name,
    qty_terjual: r.qty,
    revenue: r.revenue,
    hpp: r.hpp,
    profit: r.profit,
    margin_pct: Math.round(calcMargin(r.revenue, r.hpp) * 10) / 10,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laporan Profit"
        description="Revenue − HPP − Diskon per menu. Identifikasi menu paling untung & yang perlu dievaluasi."
        actions={
          <ExportButton
            data={exportRows}
            filename={`profit-${range.start.slice(0, 10)}`}
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
            <p className="text-xs uppercase text-muted-foreground">HPP Total</p>
            <p className="mt-1 text-2xl font-semibold tabular">
              {formatIDR(summary?.hpp ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Diskon</p>
            <p className="mt-1 text-2xl font-semibold tabular">
              {formatIDR(summary?.discount ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Profit</p>
            <p className="mt-1 text-2xl font-semibold tabular text-emerald-600">
              {formatIDR(summary?.profit ?? 0)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Margin {formatPercent(totalMargin)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Profit per Menu</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Menu</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">HPP</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead className="text-right">Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-sm text-muted-foreground"
                  >
                    Belum ada data.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => {
                  const m = menus.find((x) => x.id === r.menu_id);
                  const margin = calcMargin(r.revenue, r.hpp);
                  return (
                    <TableRow key={r.menu_id}>
                      <TableCell>
                        <p className="font-medium">{m?.name ?? r.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {m?.sku ?? ""}
                        </p>
                      </TableCell>
                      <TableCell className="text-right tabular">
                        {r.qty}
                      </TableCell>
                      <TableCell className="text-right tabular">
                        {formatIDR(r.revenue)}
                      </TableCell>
                      <TableCell className="text-right tabular text-muted-foreground">
                        {formatIDR(r.hpp)}
                      </TableCell>
                      <TableCell
                        className={
                          r.profit >= 0
                            ? "text-right tabular text-emerald-600"
                            : "text-right tabular text-red-600"
                        }
                      >
                        {formatIDR(r.profit)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={marginToBadgeVariant(margin)}>
                          {formatPercent(margin)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
