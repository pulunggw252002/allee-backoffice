"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { bundlesApi, menusApi, outletsApi } from "@/lib/api";
import type { BundleWithItems, BundleInput } from "@/lib/api/bundles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
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
import { formatIDR, formatPercent } from "@/lib/format";
import { calcMargin, marginToBadgeVariant } from "@/lib/hpp";

interface ItemRow {
  menu_id: string;
  quantity: number;
}

export function BundleDialog({
  trigger,
  initial,
}: {
  trigger: React.ReactNode;
  initial?: BundleWithItems;
}) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const { data: menus = [] } = useQuery({
    queryKey: ["menus", "all-bundle"],
    queryFn: () => menusApi.list(),
    enabled: open,
  });
  const { data: outlets = [] } = useQuery({
    queryKey: ["outlets"],
    queryFn: () => outletsApi.list(),
  });

  const [name, setName] = useState(initial?.name ?? "");
  const [price, setPrice] = useState<number>(initial?.price ?? 0);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [outletIds, setOutletIds] = useState<string[]>(
    initial?.outlet_ids ?? [],
  );
  const [items, setItems] = useState<ItemRow[]>(
    initial?.items.map((i) => ({
      menu_id: i.menu_id,
      quantity: i.quantity,
    })) ?? [],
  );

  const totalHpp = useMemo(
    () =>
      items.reduce((sum, it) => {
        const m = menus.find((mm) => mm.id === it.menu_id);
        return sum + (m?.hpp_cached ?? 0) * it.quantity;
      }, 0),
    [items, menus],
  );
  const componentPrice = useMemo(
    () =>
      items.reduce((sum, it) => {
        const m = menus.find((mm) => mm.id === it.menu_id);
        return sum + (m?.price ?? 0) * it.quantity;
      }, 0),
    [items, menus],
  );
  const margin = calcMargin(price, totalHpp);
  const saving = componentPrice - price;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Nama bundle wajib diisi");
      if (price <= 0) throw new Error("Harga harus > 0");
      if (items.length === 0) throw new Error("Minimal 1 item");
      if (outletIds.length === 0) throw new Error("Pilih outlet");
      const payload: BundleInput = {
        name: name.trim(),
        price,
        is_active: isActive,
        description,
        outlet_ids: outletIds,
        items: items.filter((i) => i.menu_id && i.quantity > 0),
      };
      return initial
        ? bundlesApi.update(initial.id, payload)
        : bundlesApi.create(payload);
    },
    onSuccess: () => {
      toast.success(initial ? "Bundle diperbarui" : "Bundle ditambahkan");
      qc.invalidateQueries({ queryKey: ["bundles"] });
      setOpen(false);
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan");
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initial ? "Edit Bundle" : "Buat Bundle"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Nama Bundle</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Paket Hemat"
              />
            </div>
            <div className="space-y-2">
              <Label>Harga Bundle</Label>
              <Input
                type="number"
                value={price || ""}
                onChange={(e) => setPrice(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Deskripsi</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Outlet</Label>
            <div className="grid grid-cols-2 gap-2">
              {outlets.map((o) => (
                <label
                  key={o.id}
                  className="flex items-center gap-2 rounded-md border p-2"
                >
                  <Checkbox
                    checked={outletIds.includes(o.id)}
                    onCheckedChange={() =>
                      setOutletIds((prev) =>
                        prev.includes(o.id)
                          ? prev.filter((x) => x !== o.id)
                          : [...prev, o.id],
                      )
                    }
                  />
                  <span className="text-sm">{o.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Komponen Menu</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const first = menus[0];
                  if (!first) return;
                  setItems((prev) => [
                    ...prev,
                    { menu_id: first.id, quantity: 1 },
                  ]);
                }}
              >
                <Plus className="h-3.5 w-3.5" /> Tambah Item
              </Button>
            </div>
            {items.length === 0 ? (
              <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                Belum ada item. Tambah menu untuk menyusun bundle.
              </p>
            ) : (
              <div className="space-y-2">
                {items.map((it, idx) => {
                  const menu = menus.find((m) => m.id === it.menu_id);
                  return (
                    <div
                      key={idx}
                      className="grid grid-cols-12 items-center gap-2 rounded-md border p-2"
                    >
                      <div className="col-span-6">
                        <Select
                          value={it.menu_id}
                          onValueChange={(v) =>
                            setItems((prev) =>
                              prev.map((x, i) =>
                                i === idx ? { ...x, menu_id: v } : x,
                              ),
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {menus
                              .filter((m) => m.type === "regular")
                              .map((m) => (
                                <SelectItem key={m.id} value={m.id}>
                                  {m.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          value={it.quantity}
                          min={1}
                          onChange={(e) =>
                            setItems((prev) =>
                              prev.map((x, i) =>
                                i === idx
                                  ? {
                                      ...x,
                                      quantity: Number(e.target.value),
                                    }
                                  : x,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="col-span-3 text-right text-xs tabular text-muted-foreground">
                        {menu
                          ? `${formatIDR(menu.price)} × ${it.quantity}`
                          : ""}
                      </div>
                      <div className="col-span-1 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setItems((prev) => prev.filter((_, i) => i !== idx))
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-md bg-muted/50 p-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Harga Komponen</span>
              <span className="tabular">{formatIDR(componentPrice)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">HPP Bundle</span>
              <span className="tabular">{formatIDR(totalHpp)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Customer Hemat</span>
              <span
                className={
                  saving > 0
                    ? "tabular text-emerald-600"
                    : "tabular text-red-600"
                }
              >
                {formatIDR(saving)}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t pt-2 text-sm">
              <span className="text-muted-foreground">Margin Bundle</span>
              <Badge variant={marginToBadgeVariant(margin, "bundle")}>
                {formatPercent(margin)}
              </Badge>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <Label>Aktif</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
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
