"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { reportsApi, stockMovementsApi, ingredientsApi } from "@/lib/api";
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
import { formatDateTime, formatIDR, formatNumber } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { canViewCosts } from "@/lib/rbac";

export default function WasteReportPage() {
  const outletId = useOutletStore((s) => s.selectedOutletId);
  const user = useAuthStore((s) => s.user);
  const canSeeValue = canViewCosts(user?.role);
  const [range, setRange] = useState<DateRange>(toRange("30d"));

  const { data: waste } = useQuery({
    queryKey: ["report.waste", outletId, range.start, range.end],
    queryFn: () =>
      reportsApi.wasteSummary({
        outlet_id: outletId,
        start: range.start,
        end: range.end,
      }),
  });

  const { data: movements = [] } = useQuery({
    queryKey: ["report.waste.movements", outletId, range.start, range.end],
    queryFn: () =>
      stockMovementsApi.list({
        outlet_id: outletId,
        types: ["out_waste", "adjustment"],
        start: range.start,
        end: range.end,
      }),
  });

  const { data: ingredients = [] } = useQuery({
    queryKey: ["ingredients", "all"],
    queryFn: () => ingredientsApi.list(),
  });

  const exportRows = (waste?.by_ingredient ?? []).map((r) =>
    canSeeValue
      ? { bahan: r.name, qty: r.quantity, nilai_rp: Math.round(r.value) }
      : { bahan: r.name, qty: r.quantity },
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laporan Waste & Koreksi"
        description="Bahan yang rusak, kadaluarsa, atau dikoreksi di luar transaksi penjualan. Monitor untuk efisiensi operasional."
        actions={
          <ExportButton data={exportRows} filename="waste" />
        }
      />

      <DateRangePicker value={range} onChange={setRange} />

      <div
        className={
          canSeeValue
            ? "grid grid-cols-1 gap-4 md:grid-cols-3"
            : "grid grid-cols-1 gap-4 md:grid-cols-2"
        }
      >
        {canSeeValue ? (
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase text-muted-foreground">
                Total Kerugian
              </p>
              <p className="mt-1 text-2xl font-semibold tabular text-red-600">
                {formatIDR(waste?.total_value ?? 0)}
              </p>
            </CardContent>
          </Card>
        ) : null}
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">
              Bahan Terdampak
            </p>
            <p className="mt-1 text-2xl font-semibold tabular">
              {waste?.by_ingredient.length ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">
              Event Tercatat
            </p>
            <p className="mt-1 text-2xl font-semibold tabular">
              {movements.length}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Ranking Kerugian per Bahan</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bahan</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  {canSeeValue ? (
                    <TableHead className="text-right">Kerugian</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {waste?.by_ingredient.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={canSeeValue ? 3 : 2}
                      className="text-center text-sm text-muted-foreground"
                    >
                      Belum ada waste di periode ini.
                    </TableCell>
                  </TableRow>
                ) : (
                  waste?.by_ingredient.map((r) => (
                    <TableRow key={r.ingredient_id}>
                      <TableCell className="text-sm">{r.name}</TableCell>
                      <TableCell className="text-right tabular">
                        {formatNumber(r.quantity)}
                      </TableCell>
                      {canSeeValue ? (
                        <TableCell className="text-right tabular text-red-600">
                          {formatIDR(r.value)}
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
            <CardTitle className="text-sm">Riwayat Event</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Waktu</TableHead>
                  <TableHead>Bahan</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead>Catatan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.slice(0, 20).map((m) => {
                  const ing = ingredients.find(
                    (i) => i.id === m.ingredient_id,
                  );
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs tabular text-muted-foreground">
                        {formatDateTime(m.created_at)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {ing?.name ?? "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={m.type === "out_waste" ? "danger" : "warning"}
                        >
                          {m.type === "out_waste" ? "Waste" : "Adjust"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {m.notes ?? "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {movements.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-sm text-muted-foreground"
                    >
                      Tidak ada event.
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
