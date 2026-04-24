"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { ingredientsApi, outletsApi } from "@/lib/api";
import type { Ingredient } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const UNITS = ["gr", "kg", "ml", "liter", "pcs", "butir", "ekor"];

export function IngredientDialog({
  trigger,
  initial,
}: {
  trigger: React.ReactNode;
  initial?: Ingredient;
}) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { data: outlets = [] } = useQuery({
    queryKey: ["outlets"],
    queryFn: () => outletsApi.list(),
  });

  const [name, setName] = useState(initial?.name ?? "");
  const [outletId, setOutletId] = useState(initial?.outlet_id ?? "");
  const [unit, setUnit] = useState(initial?.unit ?? "gr");
  const [unitPrice, setUnitPrice] = useState<number>(initial?.unit_price ?? 0);
  const [currentStock, setCurrentStock] = useState<number>(
    initial?.current_stock ?? 0,
  );
  const [minQty, setMinQty] = useState<number>(initial?.min_qty ?? 0);
  const [storage, setStorage] = useState(initial?.storage_location ?? "");

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Nama bahan wajib diisi");
      if (!outletId) throw new Error("Pilih outlet");
      const payload = {
        name: name.trim(),
        outlet_id: outletId,
        unit,
        unit_price: unitPrice,
        current_stock: currentStock,
        min_qty: minQty,
        storage_location: storage || undefined,
      };
      return initial
        ? ingredientsApi.update(initial.id, payload)
        : ingredientsApi.create(payload);
    },
    onSuccess: () => {
      toast.success(initial ? "Bahan diperbarui" : "Bahan ditambahkan");
      qc.invalidateQueries({ queryKey: ["ingredients"] });
      setOpen(false);
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan");
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {initial ? "Edit Bahan" : "Tambah Bahan"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Nama Bahan</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Susu UHT"
            />
          </div>
          <div className="space-y-2">
            <Label>Outlet</Label>
            <Select value={outletId} onValueChange={setOutletId}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih outlet" />
              </SelectTrigger>
              <SelectContent>
                {outlets.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Unit</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Harga per Unit (Rp)</Label>
              <Input
                type="number"
                value={unitPrice || ""}
                onChange={(e) => setUnitPrice(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Stok Awal</Label>
              <Input
                type="number"
                step="0.1"
                value={currentStock}
                onChange={(e) => setCurrentStock(Number(e.target.value))}
                disabled={!!initial}
              />
              {initial ? (
                <p className="text-xs text-muted-foreground">
                  Untuk ubah stok, gunakan Stok Masuk / Opname.
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>Min Qty (alert)</Label>
              <Input
                type="number"
                step="0.1"
                value={minQty}
                onChange={(e) => setMinQty(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Lokasi Penyimpanan</Label>
            <Input
              value={storage}
              onChange={(e) => setStorage(e.target.value)}
              placeholder="Kulkas / Rak / Dry Storage"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            Batal
          </Button>
          <Button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
