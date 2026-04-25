"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { categoriesApi } from "@/lib/api";
import type { MenuCategory } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Create-or-edit dialog for menu kategori.
 *
 * Sengaja minimal — schema kategori cuma {name, sort_order}. POS men-cache
 * daftar kategori; setiap mutate di sini akan trigger `firePosSync` di route
 * handler supaya POS refresh dalam hitungan detik (lihat
 * `src/app/api/categories/route.ts`).
 */
export function CategoryDialog({
  trigger,
  initial,
  defaultSortOrder,
  onDone,
}: {
  trigger: React.ReactNode;
  initial?: MenuCategory;
  /**
   * Sort order default untuk kategori baru — biasanya `categories.length + 1`
   * supaya item baru muncul di paling bawah list. Diabaikan saat edit.
   */
  defaultSortOrder?: number;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initial?.name ?? "");
  const [sortOrder, setSortOrder] = useState<number>(
    initial?.sort_order ?? defaultSortOrder ?? 0,
  );
  const qc = useQueryClient();

  const reset = () => {
    setName(initial?.name ?? "");
    setSortOrder(initial?.sort_order ?? defaultSortOrder ?? 0);
  };

  const save = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Nama kategori wajib diisi");
      if (initial) {
        return categoriesApi.update(initial.id, {
          name: trimmed,
          sort_order: sortOrder,
        });
      }
      return categoriesApi.create(trimmed);
    },
    onSuccess: () => {
      toast.success(initial ? "Kategori diperbarui" : "Kategori ditambahkan");
      qc.invalidateQueries({ queryKey: ["categories"] });
      setOpen(false);
      onDone?.();
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan");
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {initial ? "Edit Kategori" : "Tambah Kategori"}
          </DialogTitle>
          <DialogDescription>
            Kategori dipakai untuk mengelompokkan menu di POS dan filter di
            Backoffice. Perubahan akan ter-sync ke POS dalam beberapa detik.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="cat-name">Nama Kategori</Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="contoh: Kopi, Non-Kopi, Makanan"
              autoFocus
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cat-sort">Urutan Tampil</Label>
            <Input
              id="cat-sort"
              type="number"
              min={0}
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
            />
            <p className="text-xs text-muted-foreground">
              Angka kecil tampil duluan. Pakai 0, 1, 2, … untuk mengatur posisi
              kategori di POS.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={save.isPending}
            >
              Batal
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Menyimpan
                </>
              ) : initial ? (
                "Simpan Perubahan"
              ) : (
                "Tambah Kategori"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
