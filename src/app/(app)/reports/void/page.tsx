"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { reportsApi } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
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
import {
  DateRangePicker,
  toRange,
  type DateRange,
} from "@/components/reports/date-range-picker";
import { ExportButton } from "@/components/reports/export-button";
import { VoidSeriesChart } from "@/components/reports/void-series-chart";
import {
  formatDateTime,
  formatIDR,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import { canViewCosts } from "@/lib/rbac";
import { XOctagon, AlertTriangle, UserCircle2, UtensilsCrossed } from "lucide-react";

export default function VoidReportPage() {
  const outletId = useOutletStore((s) => s.selectedOutletId);
  const user = useAuthStore((s) => s.user);
  const canSeeCost = canViewCosts(user?.role);
  const [range, setRange] = useState<DateRange>(toRange("30d"));

  const seriesDays = useMemo(() => {
    const diff = Math.max(
      1,
      Math.ceil(
        (new Date(range.end).getTime() - new Date(range.start).getTime()) /
          86_400_000,
      ),
    );
    return Math.min(diff, 90);
  }, [range.start, range.end]);

  const { data: summary } = useQuery({
    queryKey: ["report.void.summary", outletId, range.start, range.end],
    queryFn: () =>
      reportsApi.voidSummary({
        outlet_id: outletId,
        start: range.start,
        end: range.end,
      }),
  });

  const { data: series = [] } = useQuery({
    queryKey: ["report.void.series", outletId, seriesDays],
    queryFn: () =>
      reportsApi.voidSeries({ outlet_id: outletId, days: seriesDays }),
  });

  const { data: byMenu = [] } = useQuery({
    queryKey: ["report.void.byMenu", outletId, range.start, range.end],
    queryFn: () =>
      reportsApi.voidByMenu({
        outlet_id: outletId,
        start: range.start,
        end: range.end,
      }),
  });

  const { data: byReason = [] } = useQuery({
    queryKey: ["report.void.byReason", outletId, range.start, range.end],
    queryFn: () =>
      reportsApi.voidByReason({
        outlet_id: outletId,
        start: range.start,
        end: range.end,
      }),
  });

  const { data: byStaff = [] } = useQuery({
    queryKey: ["report.void.byStaff", outletId, range.start, range.end],
    queryFn: () =>
      reportsApi.voidByStaff({
        outlet_id: outletId,
        start: range.start,
        end: range.end,
      }),
  });

  const { data: rows = [] } = useQuery({
    queryKey: ["report.void.list", outletId, range.start, range.end],
    queryFn: () =>
      reportsApi.voidList({
        outlet_id: outletId,
        start: range.start,
        end: range.end,
      }),
  });

  const exportRows = rows.map((r) =>
    canSeeCost
      ? {
          waktu: r.created_at,
          outlet: r.outlet_name,
          staff: r.user_name,
          item: r.items_label,
          jumlah_item: r.item_count,
          alasan: r.reason,
          kerugian_hpp: Math.round(r.loss),
        }
      : {
          waktu: r.created_at,
          outlet: r.outlet_name,
          staff: r.user_name,
          item: r.items_label,
          jumlah_item: r.item_count,
          alasan: r.reason,
        },
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laporan Order Void"
        description="Pesanan yang sudah dibuat (stok terpakai, menu keluar) tetapi tidak diterima pelanggan karena kesalahan staff. Tidak menghasilkan revenue, tapi HPP tercatat sebagai kerugian operasional."
        actions={<ExportButton data={exportRows} filename="void-orders" />}
      />

      <DateRangePicker value={range} onChange={setRange} />

      <div
        className={
          canSeeCost
            ? "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"
            : "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
        }
      >
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase text-muted-foreground">
                Jumlah Void
              </p>
              <XOctagon className="h-4 w-4 text-red-500" />
            </div>
            <p className="mt-1 text-2xl font-semibold tabular">
              {formatNumber(summary?.count ?? 0)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatNumber(summary?.item_count ?? 0)} porsi dibuat lalu di-void
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase text-muted-foreground">
                Rasio Void
              </p>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </div>
            <p className="mt-1 text-2xl font-semibold tabular">
              {formatPercent(summary?.rate_percent ?? 0)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Dari total transaksi paid + void
            </p>
          </CardContent>
        </Card>

        {canSeeCost ? (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase text-muted-foreground">
                  Total Kerugian (HPP)
                </p>
                <UtensilsCrossed className="h-4 w-4 text-red-500" />
              </div>
              <p className="mt-1 text-2xl font-semibold tabular text-red-600">
                {formatIDR(summary?.total_loss ?? 0)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Biaya bahan yang sudah terpakai
              </p>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase text-muted-foreground">
                Staff Terlibat
              </p>
              <UserCircle2 className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-1 text-2xl font-semibold tabular">
              {formatNumber(byStaff.length)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Unik user yang melakukan void
            </p>
          </CardContent>
        </Card>
      </div>

      <VoidSeriesChart data={series} days={seriesDays} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Ranking Menu Paling Sering Void</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Menu</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  {canSeeCost ? (
                    <TableHead className="text-right">Kerugian</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {byMenu.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={canSeeCost ? 3 : 2}
                      className="text-center text-sm text-muted-foreground"
                    >
                      Tidak ada menu di-void di periode ini.
                    </TableCell>
                  </TableRow>
                ) : (
                  byMenu.map((row, idx) => (
                    <TableRow key={row.menu_id}>
                      <TableCell className="text-sm">
                        <span className="text-muted-foreground tabular">
                          #{idx + 1}
                        </span>{" "}
                        {row.name}
                      </TableCell>
                      <TableCell className="text-right tabular">
                        {formatNumber(row.quantity)}
                      </TableCell>
                      {canSeeCost ? (
                        <TableCell className="text-right tabular text-red-600">
                          {formatIDR(row.loss)}
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Alasan Void</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alasan</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                  {canSeeCost ? (
                    <TableHead className="text-right">Kerugian</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {byReason.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={canSeeCost ? 3 : 2}
                      className="text-center text-sm text-muted-foreground"
                    >
                      Belum ada data.
                    </TableCell>
                  </TableRow>
                ) : (
                  byReason.map((row) => (
                    <TableRow key={row.reason}>
                      <TableCell className="max-w-[320px]">
                        <p
                          className="whitespace-pre-wrap break-words text-sm leading-relaxed"
                          title={row.reason}
                        >
                          {row.reason}
                        </p>
                      </TableCell>
                      <TableCell className="text-right tabular">
                        {formatNumber(row.count)}
                      </TableCell>
                      {canSeeCost ? (
                        <TableCell className="text-right tabular text-red-600">
                          {formatIDR(row.loss)}
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Ranking Staff</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff</TableHead>
                <TableHead className="text-right">Jumlah Void</TableHead>
                {canSeeCost ? (
                  <TableHead className="text-right">Kerugian</TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {byStaff.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={canSeeCost ? 3 : 2}
                    className="text-center text-sm text-muted-foreground"
                  >
                    Belum ada data.
                  </TableCell>
                </TableRow>
              ) : (
                byStaff.map((row) => (
                  <TableRow key={row.user_id}>
                    <TableCell className="text-sm">{row.user_name}</TableCell>
                    <TableCell className="text-right tabular">
                      {formatNumber(row.count)}
                    </TableCell>
                    {canSeeCost ? (
                      <TableCell className="text-right tabular text-red-600">
                        {formatIDR(row.loss)}
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Riwayat Pesanan Void</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Waktu</TableHead>
                <TableHead>Outlet</TableHead>
                <TableHead>Staff</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Alasan</TableHead>
                {canSeeCost ? (
                  <TableHead className="text-right">Kerugian</TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={canSeeCost ? 6 : 5}
                    className="text-center text-sm text-muted-foreground"
                  >
                    Tidak ada pesanan void di periode ini. Kerja bagus!
                  </TableCell>
                </TableRow>
              ) : (
                rows.slice(0, 50).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs tabular text-muted-foreground">
                      {formatDateTime(r.created_at)}
                    </TableCell>
                    <TableCell className="text-xs">{r.outlet_name}</TableCell>
                    <TableCell className="text-xs">{r.user_name}</TableCell>
                    <TableCell className="text-xs">{r.items_label}</TableCell>
                    <TableCell className="max-w-[280px]">
                      {/*
                       * Free-form reason yang ditulis kasir di POS — bisa
                       * pendek seperti "Salah menu" atau panjang seperti
                       * "Pelanggan ganti pesanan jadi minuman dingin".
                       * Tampilkan apa adanya dengan word-wrap supaya konteks
                       * dari operator tidak hilang.
                       */}
                      <p
                        className="whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground"
                        title={r.reason}
                      >
                        {r.reason}
                      </p>
                    </TableCell>
                    {canSeeCost ? (
                      <TableCell className="text-right tabular text-red-600">
                        {formatIDR(r.loss)}
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
