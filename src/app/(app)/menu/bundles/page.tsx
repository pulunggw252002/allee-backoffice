"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { bundlesApi, menusApi, outletsApi } from "@/lib/api";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { BundleDialog } from "@/components/menu/bundle-form";
import { formatIDR, formatPercent } from "@/lib/format";
import { calcMargin, marginToBadgeVariant } from "@/lib/hpp";
import { Plus, Pencil, Trash2, Package } from "lucide-react";

export default function BundlesPage() {
  const qc = useQueryClient();
  const { data: bundles = [], isLoading } = useQuery({
    queryKey: ["bundles"],
    queryFn: () => bundlesApi.list(),
  });
  const { data: menus = [] } = useQuery({
    queryKey: ["menus", "all-bundle"],
    queryFn: () => menusApi.list(),
  });
  const { data: outlets = [] } = useQuery({
    queryKey: ["outlets"],
    queryFn: () => outletsApi.list(),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => bundlesApi.remove(id),
    onSuccess: () => {
      toast.success("Bundle dinonaktifkan");
      qc.invalidateQueries({ queryKey: ["bundles"] });
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Menu Bundling"
        description="Paket menu dengan harga promo. HPP & margin terhitung otomatis dari komponen menunya."
        actions={
          <BundleDialog
            trigger={
              <Button>
                <Plus className="h-4 w-4" /> Tambah Bundle
              </Button>
            }
          />
        }
      />

      {isLoading ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Memuat bundle…
          </CardContent>
        </Card>
      ) : bundles.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Belum ada bundle"
          description="Buat paket untuk dorong AOV dan bantu clearance stock."
          action={
            <BundleDialog
              trigger={
                <Button>
                  <Plus className="h-4 w-4" /> Tambah Bundle
                </Button>
              }
            />
          }
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Komponen</TableHead>
                <TableHead className="text-right">Harga</TableHead>
                <TableHead className="text-right">HPP</TableHead>
                <TableHead className="text-right">Margin</TableHead>
                <TableHead>Outlet</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {bundles.map((b) => {
                const margin = calcMargin(b.price, b.hpp);
                return (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell className="text-xs">
                      {b.items
                        .map((it) => {
                          const m = menus.find((x) => x.id === it.menu_id);
                          return `${m?.name ?? "?"} ×${it.quantity}`;
                        })
                        .join(" + ")}
                    </TableCell>
                    <TableCell className="text-right tabular">
                      {formatIDR(b.price)}
                    </TableCell>
                    <TableCell className="text-right tabular text-muted-foreground">
                      {formatIDR(b.hpp)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={marginToBadgeVariant(margin, "bundle")}>
                        {formatPercent(margin)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {b.outlet_ids.length === outlets.length
                        ? "Semua outlet"
                        : b.outlet_ids
                            .map(
                              (id) =>
                                outlets.find((o) => o.id === id)?.name ?? "",
                            )
                            .filter(Boolean)
                            .join(", ")}
                    </TableCell>
                    <TableCell>
                      {b.is_active ? (
                        <Badge variant="success">Aktif</Badge>
                      ) : (
                        <Badge variant="secondary">Nonaktif</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <BundleDialog
                          initial={b}
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
                            if (confirm(`Nonaktifkan "${b.name}"?`))
                              removeMutation.mutate(b.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
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
