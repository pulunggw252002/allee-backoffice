"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { menusApi, categoriesApi, outletsApi } from "@/lib/api";
import { useOutletStore } from "@/stores/outlet-store";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { formatIDR, formatPercent } from "@/lib/format";
import { calcMargin, marginToBadgeVariant } from "@/lib/hpp";
import { Coffee, Plus, Search } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { useAuthStore } from "@/stores/auth-store";
import { canViewCosts } from "@/lib/rbac";

export default function MenuListPage() {
  const outletId = useOutletStore((s) => s.selectedOutletId);
  const user = useAuthStore((s) => s.user);
  const showPrice = canViewCosts(user?.role);
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string>("all");
  // Filter status aktif/nonaktif. Default "active" supaya daftar tidak
  // kepenuhan menu lama — menu tidak pernah dihapus (akan mengganggu
  // riwayat inventory/transaksi), hanya dinonaktifkan. Owner bisa beralih
  // ke "inactive" atau "all" kapan saja.
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">(
    "active",
  );

  const { data: menus = [], isLoading } = useQuery({
    queryKey: ["menus", outletId],
    queryFn: () => menusApi.list({ outlet_id: outletId }),
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => categoriesApi.list(),
  });
  const { data: outlets = [] } = useQuery({
    queryKey: ["outlets"],
    queryFn: () => outletsApi.list(),
  });

  const filtered = useMemo(() => {
    return menus.filter((m) => {
      if (statusFilter === "active" && !m.is_active) return false;
      if (statusFilter === "inactive" && m.is_active) return false;
      if (categoryId !== "all" && m.category_id !== categoryId) return false;
      if (query && !m.name.toLowerCase().includes(query.toLowerCase()) && !m.sku.toLowerCase().includes(query.toLowerCase()))
        return false;
      return true;
    });
  }, [menus, query, categoryId, statusFilter]);

  // KPI count — pakai total menu mentah agar "aktif" konsisten saat filter
  // berubah. Menu yang disembunyikan tetap terhitung di total, tapi hanya
  // ditampilkan di tabel kalau filter mencakupnya.
  const totalActiveCount = menus.filter((m) => m.is_active).length;
  const totalInactiveCount = menus.length - totalActiveCount;
  const totalHpp = filtered.reduce((s, m) => s + m.hpp_cached, 0);
  const avgMargin =
    filtered.length > 0
      ? filtered.reduce((s, m) => s + calcMargin(m.price, m.hpp_cached), 0) /
        filtered.length
      : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Menu Management"
        description={
          showPrice
            ? "Katalog menu yang tersedia di POS. Kelola resep, HPP, add-on, bundling, dan diskon."
            : "Katalog menu. Hanya dapat dilihat; perubahan resep & harga dilakukan oleh Owner."
        }
        actions={
          showPrice ? (
            <Button asChild>
              <Link href="/menu/new">
                <Plus className="h-4 w-4" /> Tambah Menu
              </Link>
            </Button>
          ) : null
        }
      />

      <div className={showPrice ? "grid grid-cols-3 gap-4" : "grid grid-cols-1 gap-4"}>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Total Menu</p>
            <p className="mt-1 text-2xl font-semibold tabular">{menus.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {totalActiveCount} aktif · {totalInactiveCount} nonaktif
            </p>
          </CardContent>
        </Card>
        {showPrice ? (
          <>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs uppercase text-muted-foreground">Total HPP</p>
                <p className="mt-1 text-2xl font-semibold tabular">{formatIDR(totalHpp)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Sum HPP semua menu</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs uppercase text-muted-foreground">Margin Rata-rata</p>
                <p className="mt-1 text-2xl font-semibold tabular">{formatPercent(avgMargin)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Menu yang ditampilkan</p>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama atau SKU…"
            className="pl-9"
          />
        </div>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Kategori</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(v) =>
            setStatusFilter(v as "active" | "inactive" | "all")
          }
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">
              Aktif ({totalActiveCount})
            </SelectItem>
            <SelectItem value="inactive">
              Nonaktif ({totalInactiveCount})
            </SelectItem>
            <SelectItem value="all">Semua Status</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {statusFilter === "inactive" ? (
        <p className="text-xs text-muted-foreground">
          Menampilkan menu nonaktif. Menu yang dinonaktifkan tidak muncul di
          POS dan tidak di-sync ke marketplace ojol, namun tetap tersimpan
          agar riwayat inventory dan transaksi tidak terganggu.
        </p>
      ) : null}

      {isLoading ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Memuat menu…
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Coffee}
          title="Tidak ada menu"
          description="Ubah filter atau tambahkan menu baru untuk memulai."
          action={
            showPrice ? (
              <Button asChild>
                <Link href="/menu/new">
                  <Plus className="h-4 w-4" /> Tambah Menu
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Menu</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Kategori</TableHead>
                {showPrice ? (
                  <>
                    <TableHead className="text-right">Harga</TableHead>
                    <TableHead className="text-right">HPP</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                  </>
                ) : null}
                <TableHead>Outlet</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((menu) => {
                const cat = categories.find((c) => c.id === menu.category_id);
                const margin = calcMargin(menu.price, menu.hpp_cached);
                return (
                  <TableRow key={menu.id} className="cursor-pointer">
                    <TableCell>
                      <Link
                        href={`/menu/${menu.id}`}
                        className="block font-medium hover:underline"
                      >
                        {menu.name}
                      </Link>
                      {menu.description ? (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {menu.description}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {menu.sku}
                    </TableCell>
                    <TableCell className="text-xs">{cat?.name ?? "-"}</TableCell>
                    {showPrice ? (
                      <>
                        <TableCell className="text-right tabular">
                          {formatIDR(menu.price)}
                        </TableCell>
                        <TableCell className="text-right tabular text-muted-foreground">
                          {formatIDR(menu.hpp_cached)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={marginToBadgeVariant(margin)}>
                            {formatPercent(margin)}
                          </Badge>
                        </TableCell>
                      </>
                    ) : null}
                    <TableCell className="text-xs">
                      {menu.outlet_ids.length === outlets.length
                        ? "Semua outlet"
                        : menu.outlet_ids
                            .map((id) => outlets.find((o) => o.id === id)?.name)
                            .filter(Boolean)
                            .join(", ")}
                    </TableCell>
                    <TableCell>
                      {menu.is_active ? (
                        <Badge variant="success">Aktif</Badge>
                      ) : (
                        <Badge variant="secondary">Nonaktif</Badge>
                      )}
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
