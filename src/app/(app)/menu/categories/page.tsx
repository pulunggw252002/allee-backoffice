"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FolderTree, Pencil, Plus, Trash2 } from "lucide-react";
import { categoriesApi, menusApi } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { CategoryDialog } from "@/components/menu/category-form";

export default function CategoriesPage() {
  const qc = useQueryClient();

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: () => categoriesApi.list(),
  });

  // Hitung jumlah menu per kategori — supaya owner tahu kategori mana yang
  // masih dipakai sebelum nge-klik delete (FK `menus.category_id` ON DELETE
  // RESTRICT, jadi delete bakal gagal).
  const { data: menus = [] } = useQuery({
    queryKey: ["menus", "for-category-count"],
    queryFn: () => menusApi.list(),
  });

  const menuCountByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of menus) {
      map.set(m.category_id, (map.get(m.category_id) ?? 0) + 1);
    }
    return map;
  }, [menus]);

  const removeMutation = useMutation({
    mutationFn: (id: string) => categoriesApi.remove(id),
    onSuccess: () => {
      toast.success("Kategori dihapus");
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus");
    },
  });

  const sorted = useMemo(
    () => [...categories].sort((a, b) => a.sort_order - b.sort_order),
    [categories],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kategori Menu"
        description="Kelompokkan menu agar mudah ditelusuri di POS dan filter Backoffice. Perubahan otomatis di-sync ke POS."
        actions={
          <CategoryDialog
            defaultSortOrder={categories.length + 1}
            trigger={
              <Button>
                <Plus className="h-4 w-4" /> Tambah Kategori
              </Button>
            }
          />
        }
      />

      {isLoading ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Memuat kategori…
          </CardContent>
        </Card>
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={FolderTree}
          title="Belum ada kategori"
          description="Buat kategori pertama untuk mulai mengelompokkan menu."
          action={
            <CategoryDialog
              defaultSortOrder={1}
              trigger={
                <Button>
                  <Plus className="h-4 w-4" /> Tambah Kategori
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
                <TableHead className="w-20">Urutan</TableHead>
                <TableHead>Nama Kategori</TableHead>
                <TableHead>Jumlah Menu</TableHead>
                <TableHead className="w-32 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((cat) => {
                const count = menuCountByCategory.get(cat.id) ?? 0;
                return (
                  <TableRow key={cat.id}>
                    <TableCell className="tabular text-muted-foreground">
                      {cat.sort_order}
                    </TableCell>
                    <TableCell className="font-medium">{cat.name}</TableCell>
                    <TableCell>
                      {count > 0 ? (
                        <Badge variant="secondary">{count} menu</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Belum ada menu
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <CategoryDialog
                          initial={cat}
                          trigger={
                            <Button variant="ghost" size="icon">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={
                            removeMutation.isPending || count > 0
                          }
                          title={
                            count > 0
                              ? "Pindahkan menu ke kategori lain dulu"
                              : "Hapus kategori"
                          }
                          onClick={() => {
                            if (
                              confirm(
                                `Hapus kategori "${cat.name}"? Tindakan ini tidak bisa dibatalkan.`,
                              )
                            ) {
                              removeMutation.mutate(cat.id);
                            }
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
