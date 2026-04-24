"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ingredientsApi, outletsApi } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { useOutletStore } from "@/stores/outlet-store";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { StockBadge } from "@/components/shared/stock-badge";
import { IngredientDialog } from "@/components/inventory/ingredient-form";
import { formatIDR, formatNumber, formatDateTime } from "@/lib/format";
import { LOW_STOCK_WARNING_MULT } from "@/lib/constants";
import { canManageInventoryMaster } from "@/lib/rbac";
import { Boxes, Plus, Search, ArrowDownToLine, ArrowUpFromLine, ClipboardCheck, Pencil, Trash2 } from "lucide-react";

export default function InventoryPage() {
  const outletId = useOutletStore((s) => s.selectedOutletId);
  const user = useAuthStore((s) => s.user);
  const canManage = canManageInventoryMaster(user?.role);
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [filterLow, setFilterLow] = useState(false);

  const { data: ingredients = [], isLoading } = useQuery({
    queryKey: ["ingredients", outletId],
    queryFn: () => ingredientsApi.list({ outlet_id: outletId }),
  });
  const { data: outlets = [] } = useQuery({
    queryKey: ["outlets"],
    queryFn: () => outletsApi.list(),
  });

  const filtered = useMemo(() => {
    return ingredients.filter((i) => {
      if (query && !i.name.toLowerCase().includes(query.toLowerCase()))
        return false;
      if (filterLow && i.current_stock > i.min_qty * LOW_STOCK_WARNING_MULT)
        return false;
      return true;
    });
  }, [ingredients, query, filterLow]);

  const totalValue = filtered.reduce(
    (s, i) => s + i.current_stock * i.unit_price,
    0,
  );
  const lowCount = ingredients.filter(
    (i) => i.current_stock <= i.min_qty * LOW_STOCK_WARNING_MULT,
  ).length;
  const criticalCount = ingredients.filter(
    (i) => i.current_stock <= i.min_qty,
  ).length;

  const removeMutation = useMutation({
    mutationFn: (id: string) => ingredientsApi.remove(id),
    onSuccess: () => {
      toast.success("Bahan dihapus");
      qc.invalidateQueries({ queryKey: ["ingredients"] });
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description={
          canManage
            ? "Stok bahan baku per outlet. Low stock < 1.5× min; kritis ≤ min."
            : "Stok bahan baku per outlet. Anda hanya dapat menambah qty via Stok Masuk / Opname. Harga per unit ditentukan Owner."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/inventory/stock-in">
                <ArrowDownToLine className="h-4 w-4" /> Stok Masuk
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/inventory/stock-out">
                <ArrowUpFromLine className="h-4 w-4" /> Stok Keluar
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/inventory/opname">
                <ClipboardCheck className="h-4 w-4" /> Opname
              </Link>
            </Button>
            {canManage ? (
              <IngredientDialog
                trigger={
                  <Button>
                    <Plus className="h-4 w-4" /> Tambah Bahan
                  </Button>
                }
              />
            ) : null}
          </div>
        }
      />

      <div
        className={
          canManage
            ? "grid grid-cols-1 gap-4 md:grid-cols-4"
            : "grid grid-cols-1 gap-4 md:grid-cols-3"
        }
      >
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Total Bahan</p>
            <p className="mt-1 text-2xl font-semibold tabular">
              {ingredients.length}
            </p>
          </CardContent>
        </Card>
        {canManage ? (
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase text-muted-foreground">Nilai Stok</p>
              <p className="mt-1 text-2xl font-semibold tabular">
                {formatIDR(totalValue, { compact: true })}
              </p>
            </CardContent>
          </Card>
        ) : null}
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Low Stock</p>
            <p className="mt-1 text-2xl font-semibold tabular text-amber-600">
              {lowCount}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Perlu dipantau</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Kritis</p>
            <p className="mt-1 text-2xl font-semibold tabular text-red-600">
              {criticalCount}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">≤ min qty</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama bahan…"
            className="pl-9"
          />
        </div>
        <Button
          variant={filterLow ? "default" : "outline"}
          onClick={() => setFilterLow((v) => !v)}
        >
          {filterLow ? "Tampilkan semua" : "Hanya low stock"}
        </Button>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Memuat bahan…
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="Tidak ada bahan"
          description="Tambah bahan baku untuk mulai melacak stok per outlet."
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Bahan</TableHead>
                <TableHead>Outlet</TableHead>
                <TableHead className="text-right">Stok</TableHead>
                <TableHead className="text-right">Min Qty</TableHead>
                {canManage ? (
                  <>
                    <TableHead className="text-right">Harga/Unit</TableHead>
                    <TableHead className="text-right">Nilai</TableHead>
                  </>
                ) : null}
                <TableHead>Status</TableHead>
                <TableHead>Diperbarui</TableHead>
                {canManage ? <TableHead className="w-24" /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((i) => {
                const outlet = outlets.find((o) => o.id === i.outlet_id);
                return (
                  <TableRow key={i.id}>
                    <TableCell>
                      <p className="font-medium">{i.name}</p>
                      {i.storage_location ? (
                        <p className="text-xs text-muted-foreground">
                          {i.storage_location}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-xs">{outlet?.name ?? "-"}</TableCell>
                    <TableCell className="text-right tabular">
                      {formatNumber(i.current_stock)} {i.unit}
                    </TableCell>
                    <TableCell className="text-right tabular text-muted-foreground">
                      {formatNumber(i.min_qty)} {i.unit}
                    </TableCell>
                    {canManage ? (
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
                      <StockBadge
                        current={i.current_stock}
                        min={i.min_qty}
                      />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground tabular">
                      {formatDateTime(i.updated_at)}
                    </TableCell>
                    {canManage ? (
                      <TableCell>
                        <div className="flex gap-1">
                          <IngredientDialog
                            initial={i}
                            trigger={
                              <Button variant="ghost" size="icon">
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            }
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm(`Hapus "${i.name}"?`))
                                removeMutation.mutate(i.id);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
