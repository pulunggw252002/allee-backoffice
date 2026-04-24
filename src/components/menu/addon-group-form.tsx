"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { addonsApi, ingredientsApi, outletsApi } from "@/lib/api";
import type { AddonGroupWithDetails, AddonGroupInput } from "@/lib/api/addons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { formatIDR } from "@/lib/format";

interface OptionRow {
  id?: string;
  name: string;
  extra_price: number;
  modifiers: Array<{
    ingredient_id: string;
    quantity_delta: number;
    mode: "override" | "delta";
  }>;
}

export function AddonGroupDialog({
  trigger,
  initial,
  onDone,
}: {
  trigger: React.ReactNode;
  initial?: AddonGroupWithDetails;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { data: outlets = [] } = useQuery({
    queryKey: ["outlets"],
    queryFn: () => outletsApi.list(),
  });
  const { data: allIngredients = [] } = useQuery({
    queryKey: ["ingredients", "all"],
    queryFn: () => ingredientsApi.list(),
    enabled: open,
  });

  const refOutletId = outlets[0]?.id;
  const ingredientsRef = allIngredients.filter(
    (i) => i.outlet_id === refOutletId,
  );

  const [name, setName] = useState(initial?.name ?? "");
  const [selectionType, setSelectionType] = useState<"single" | "multi">(
    initial?.selection_type ?? "single",
  );
  const [isRequired, setIsRequired] = useState(initial?.is_required ?? false);
  const [options, setOptions] = useState<OptionRow[]>(
    initial?.options.map((o) => ({
      id: o.id,
      name: o.name,
      extra_price: o.extra_price,
      modifiers: o.modifiers.map((m) => ({
        ingredient_id: m.ingredient_id,
        quantity_delta: m.quantity_delta,
        mode: m.mode,
      })),
    })) ?? [{ name: "", extra_price: 0, modifiers: [] }],
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Nama group wajib diisi");
      if (options.length === 0) throw new Error("Minimal 1 opsi");
      const payload: AddonGroupInput = {
        name: name.trim(),
        selection_type: selectionType,
        is_required: isRequired,
        options: options.map((o) => ({
          name: o.name.trim(),
          extra_price: o.extra_price,
          modifiers: o.modifiers.filter((m) => m.ingredient_id),
        })),
      };
      return initial
        ? addonsApi.updateGroup(initial.id, payload)
        : addonsApi.createGroup(payload);
    },
    onSuccess: () => {
      toast.success(initial ? "Group diperbarui" : "Group ditambahkan");
      qc.invalidateQueries({ queryKey: ["addonGroups"] });
      setOpen(false);
      onDone?.();
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan");
    },
  });

  const updateOption = (idx: number, patch: Partial<OptionRow>) => {
    setOptions((prev) =>
      prev.map((o, i) => (i === idx ? { ...o, ...patch } : o)),
    );
  };

  const addModifier = (optIdx: number) => {
    if (!ingredientsRef.length) return;
    updateOption(optIdx, {
      modifiers: [
        ...options[optIdx].modifiers,
        {
          ingredient_id: ingredientsRef[0].id,
          quantity_delta: 0,
          mode: "delta",
        },
      ],
    });
  };

  const updateModifier = (
    optIdx: number,
    modIdx: number,
    patch: Partial<OptionRow["modifiers"][number]>,
  ) => {
    updateOption(optIdx, {
      modifiers: options[optIdx].modifiers.map((m, i) =>
        i === modIdx ? { ...m, ...patch } : m,
      ),
    });
  };

  const removeModifier = (optIdx: number, modIdx: number) => {
    updateOption(optIdx, {
      modifiers: options[optIdx].modifiers.filter((_, i) => i !== modIdx),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initial ? "Edit Add-on Group" : "Buat Add-on Group"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Nama Group</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="contoh: Sugar Level"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipe Pemilihan</Label>
              <Select
                value={selectionType}
                onValueChange={(v) =>
                  setSelectionType(v as "single" | "multi")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Pilih 1 (single)</SelectItem>
                  <SelectItem value="multi">Pilih banyak (multi)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Wajib Dipilih</p>
              <p className="text-xs text-muted-foreground">
                Customer harus memilih minimal 1 opsi sebelum checkout.
              </p>
            </div>
            <Switch checked={isRequired} onCheckedChange={setIsRequired} />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Opsi</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setOptions((prev) => [
                    ...prev,
                    { name: "", extra_price: 0, modifiers: [] },
                  ])
                }
              >
                <Plus className="h-3.5 w-3.5" /> Tambah Opsi
              </Button>
            </div>
            {options.map((opt, idx) => (
              <div key={idx} className="space-y-3 rounded-md border p-3">
                <div className="grid grid-cols-12 items-center gap-2">
                  <div className="col-span-6">
                    <Input
                      value={opt.name}
                      onChange={(e) =>
                        updateOption(idx, { name: e.target.value })
                      }
                      placeholder="Nama opsi (contoh: No Sugar)"
                    />
                  </div>
                  <div className="col-span-4">
                    <Input
                      type="number"
                      value={opt.extra_price || ""}
                      onChange={(e) =>
                        updateOption(idx, {
                          extra_price: Number(e.target.value),
                        })
                      }
                      placeholder="Extra Rp"
                    />
                  </div>
                  <div className="col-span-2 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setOptions((prev) => prev.filter((_, i) => i !== idx))
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="rounded-md bg-muted/50 p-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium">
                      Recipe Modifier{" "}
                      <span className="text-muted-foreground">
                        (opsional)
                      </span>
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => addModifier(idx)}
                    >
                      <Plus className="h-3 w-3" /> Modifier
                    </Button>
                  </div>
                  {opt.modifiers.length === 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Tambah modifier untuk mengubah konsumsi bahan saat opsi
                      ini dipilih.
                    </p>
                  ) : (
                    <div className="mt-2 space-y-1.5">
                      {opt.modifiers.map((m, mi) => (
                        <div
                          key={mi}
                          className="grid grid-cols-12 items-center gap-1.5"
                        >
                          <div className="col-span-5">
                            <Select
                              value={m.ingredient_id}
                              onValueChange={(v) =>
                                updateModifier(idx, mi, { ingredient_id: v })
                              }
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ingredientsRef.map((i) => (
                                  <SelectItem key={i.id} value={i.id}>
                                    {i.name} ({i.unit})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-3">
                            <Select
                              value={m.mode}
                              onValueChange={(v) =>
                                updateModifier(idx, mi, {
                                  mode: v as "override" | "delta",
                                })
                              }
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="delta">+/− delta</SelectItem>
                                <SelectItem value="override">
                                  override
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-3">
                            <Input
                              type="number"
                              step="0.1"
                              value={m.quantity_delta}
                              onChange={(e) =>
                                updateModifier(idx, mi, {
                                  quantity_delta: Number(e.target.value),
                                })
                              }
                              className="h-8 text-xs"
                            />
                          </div>
                          <div className="col-span-1 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => removeModifier(idx, mi)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {opt.extra_price > 0 ? (
                  <Badge variant="outline" className="text-xs">
                    +{formatIDR(opt.extra_price)}
                  </Badge>
                ) : null}
              </div>
            ))}
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
