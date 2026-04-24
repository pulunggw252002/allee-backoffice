"use client";

import { useQuery } from "@tanstack/react-query";
import { ingredientsApi, outletsApi, reportsApi } from "@/lib/api";
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
import { ExportButton } from "@/components/reports/export-button";
import { StockBadge } from "@/components/shared/stock-badge";
import { formatIDR, formatNumber } from "@/lib/format";
import { canViewCosts } from "@/lib/rbac";

export default function InventoryReportPage() {
  const outletId = useOutletStore((s) => s.selectedOutletId);
  const user = useAuthStore((s) => s.user);
  const canSeeValue = canViewCosts(user?.role);

  const { data: ingredients = [] } = useQuery({
    queryKey: ["ingredients", outletId],
    queryFn: () => ingredientsApi.list({ outlet_id: outletId }),
  });
  const { data: outlets = [] } = useQuery({
    queryKey: ["outlets"],
    queryFn: () => outletsApi.list(),
  });
  const { data: valueByOutlet = [] } = useQuery({
    queryKey: ["inventory.value"],
    queryFn: () => reportsApi.inventoryValue(),
  });

  const totalValue = ingredients.reduce(
    (s, i) => s + i.current_stock * i.unit_price,
    0,
  );
  const criticalCount = ingredients.filter(
    (i) => i.current_stock <= i.min_qty,
  ).length;

  const exportRows = ingredients.map((i) => {
    const base = {
      outlet: outlets.find((o) => o.id === i.outlet_id)?.name ?? "",
      nama: i.name,
      unit: i.unit,
      stok: i.current_stock,
      min: i.min_qty,
    };
    return canSeeValue
      ? {
          ...base,
          harga_per_unit: i.unit_price,
          nilai_stok: Math.round(i.current_stock * i.unit_price),
        }
      : base;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laporan Inventory"
        description="Posisi stok & nilai inventory per outlet. Identifikasi bahan kritis untuk restock."
        actions={
          <ExportButton data={exportRows} filename="inventory" />
        }
      />

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
                Total Nilai Stok
              </p>
              <p className="mt-1 text-2xl font-semibold tabular">
                {formatIDR(totalValue, { compact: true })}
              </p>
            </CardContent>
          </Card>
        ) : null}
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">
              Jenis Bahan
            </p>
            <p className="mt-1 text-2xl font-semibold tabular">
              {ingredients.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Kritis</p>
            <p className="mt-1 text-2xl font-semibold tabular text-red-600">
              {criticalCount}
            </p>
          </CardContent>
        </Card>
      </div>

      {!outletId && canSeeValue ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Nilai Stok per Outlet</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Outlet</TableHead>
                  <TableHead className="text-right">Jenis Bahan</TableHead>
                  <TableHead className="text-right">Total Nilai</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {valueByOutlet.map((v) => (
                  <TableRow key={v.outlet_id}>
                    <TableCell className="font-medium">
                      {v.outlet_name}
                    </TableCell>
                    <TableCell className="text-right tabular">
                      {v.items_count}
                    </TableCell>
                    <TableCell className="text-right tabular">
                      {formatIDR(v.total_value)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Detail Stok</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bahan</TableHead>
                <TableHead>Outlet</TableHead>
                <TableHead className="text-right">Stok</TableHead>
                <TableHead className="text-right">Min</TableHead>
                {canSeeValue ? (
                  <>
                    <TableHead className="text-right">Harga</TableHead>
                    <TableHead className="text-right">Nilai</TableHead>
                  </>
                ) : null}
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ingredients.map((i) => (
                <TableRow key={i.id}>
                  <TableCell>{i.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {outlets.find((o) => o.id === i.outlet_id)?.name}
                  </TableCell>
                  <TableCell className="text-right tabular">
                    {formatNumber(i.current_stock)} {i.unit}
                  </TableCell>
                  <TableCell className="text-right tabular text-muted-foreground">
                    {formatNumber(i.min_qty)}
                  </TableCell>
                  {canSeeValue ? (
                    <>
                      <TableCell className="text-right tabular">
                        {formatIDR(i.unit_price)}
                      </TableCell>
                      <TableCell className="text-right tabular">
                        {formatIDR(i.current_stock * i.unit_price)}
                      </TableCell>
                    </>
                  ) : null}
                  <TableCell>
                    <StockBadge current={i.current_stock} min={i.min_qty} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
