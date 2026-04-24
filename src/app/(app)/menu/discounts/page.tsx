"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  categoriesApi,
  discountsApi,
  menusApi,
} from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import type { Discount, DiscountScope, DiscountType } from "@/types";
import { formatIDR, formatPercent } from "@/lib/format";
import { Plus, Pencil, Trash2, Percent, Loader2 } from "lucide-react";

function DiscountDialog({
  trigger,
  initial,
}: {
  trigger: React.ReactNode;
  initial?: Discount;
}) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => categoriesApi.list(),
    enabled: open,
  });
  const { data: menus = [] } = useQuery({
    queryKey: ["menus", "all-discount"],
    queryFn: () => menusApi.list(),
    enabled: open,
  });

  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<DiscountType>(initial?.type ?? "percent");
  const [value, setValue] = useState<number>(initial?.value ?? 0);
  const [scope, setScope] = useState<DiscountScope>(initial?.scope ?? "all");
  const [scopeRefId, setScopeRefId] = useState(initial?.scope_ref_id ?? "");
  const [startAt, setStartAt] = useState(initial?.start_at?.slice(0, 10) ?? "");
  const [endAt, setEndAt] = useState(initial?.end_at?.slice(0, 10) ?? "");
  const [hourStart, setHourStart] = useState(initial?.active_hour_start ?? "");
  const [hourEnd, setHourEnd] = useState(initial?.active_hour_end ?? "");
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Nama diskon wajib diisi");
      if (value <= 0) throw new Error("Nilai harus > 0");
      if (type === "percent" && value > 100)
        throw new Error("Persen maksimum 100");
      const payload = {
        name: name.trim(),
        type,
        value,
        scope,
        scope_ref_id: scope === "all" ? undefined : scopeRefId || undefined,
        start_at: startAt ? new Date(startAt).toISOString() : undefined,
        end_at: endAt ? new Date(endAt).toISOString() : undefined,
        active_hour_start: hourStart || undefined,
        active_hour_end: hourEnd || undefined,
        is_active: isActive,
      };
      return initial
        ? discountsApi.update(initial.id, payload)
        : discountsApi.create(payload);
    },
    onSuccess: () => {
      toast.success(initial ? "Diskon diperbarui" : "Diskon ditambahkan");
      qc.invalidateQueries({ queryKey: ["discounts"] });
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
          <DialogTitle>{initial ? "Edit Diskon" : "Buat Diskon"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nama Diskon</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Happy Hour"
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipe</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as DiscountType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Persen (%)</SelectItem>
                  <SelectItem value="nominal">Nominal (Rp)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>
                Nilai {type === "percent" ? "(%)" : "(Rp)"}
              </Label>
              <Input
                type="number"
                value={value || ""}
                onChange={(e) => setValue(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Scope</Label>
              <Select
                value={scope}
                onValueChange={(v) => setScope(v as DiscountScope)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua menu</SelectItem>
                  <SelectItem value="category">Per kategori</SelectItem>
                  <SelectItem value="menu">Per menu</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {scope === "category" ? (
              <div className="space-y-2">
                <Label>Kategori</Label>
                <Select value={scopeRefId} onValueChange={setScopeRefId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : scope === "menu" ? (
              <div className="space-y-2">
                <Label>Menu</Label>
                <Select value={scopeRefId} onValueChange={setScopeRefId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih menu" />
                  </SelectTrigger>
                  <SelectContent>
                    {menus.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Mulai (tanggal)</Label>
              <Input
                type="date"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Selesai (tanggal)</Label>
              <Input
                type="date"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Jam Aktif Mulai</Label>
              <Input
                type="time"
                value={hourStart}
                onChange={(e) => setHourStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Jam Aktif Selesai</Label>
              <Input
                type="time"
                value={hourEnd}
                onChange={(e) => setHourEnd(e.target.value)}
              />
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

export default function DiscountsPage() {
  const qc = useQueryClient();
  const { data: discounts = [], isLoading } = useQuery({
    queryKey: ["discounts"],
    queryFn: () => discountsApi.list(),
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => categoriesApi.list(),
  });
  const { data: menus = [] } = useQuery({
    queryKey: ["menus", "all-discount"],
    queryFn: () => menusApi.list(),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => discountsApi.remove(id),
    onSuccess: () => {
      toast.success("Diskon dinonaktifkan");
      qc.invalidateQueries({ queryKey: ["discounts"] });
    },
  });

  const scopeLabel = (d: Discount) => {
    if (d.scope === "all") return "Semua menu";
    if (d.scope === "category") {
      const c = categories.find((x) => x.id === d.scope_ref_id);
      return `Kategori: ${c?.name ?? "?"}`;
    }
    const m = menus.find((x) => x.id === d.scope_ref_id);
    return `Menu: ${m?.name ?? "?"}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Diskon"
        description="Diskon persentase atau nominal, dengan batasan waktu dan scope tertentu."
        actions={
          <DiscountDialog
            trigger={
              <Button>
                <Plus className="h-4 w-4" /> Tambah Diskon
              </Button>
            }
          />
        }
      />

      {isLoading ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Memuat…
          </CardContent>
        </Card>
      ) : discounts.length === 0 ? (
        <EmptyState
          icon={Percent}
          title="Belum ada diskon"
          description="Buat promo untuk happy hour, grand opening, dll."
          action={
            <DiscountDialog
              trigger={
                <Button>
                  <Plus className="h-4 w-4" /> Tambah Diskon
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
                <TableHead>Nilai</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Periode</TableHead>
                <TableHead>Jam Aktif</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {discounts.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell className="tabular">
                    {d.type === "percent"
                      ? formatPercent(d.value)
                      : formatIDR(d.value)}
                  </TableCell>
                  <TableCell className="text-xs">{scopeLabel(d)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground tabular">
                    {d.start_at
                      ? `${d.start_at.slice(0, 10)} → ${d.end_at?.slice(0, 10) ?? "—"}`
                      : "Tidak terbatas"}
                  </TableCell>
                  <TableCell className="text-xs tabular">
                    {d.active_hour_start
                      ? `${d.active_hour_start}–${d.active_hour_end ?? "?"}`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {d.is_active ? (
                      <Badge variant="success">Aktif</Badge>
                    ) : (
                      <Badge variant="secondary">Nonaktif</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <DiscountDialog
                        initial={d}
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
                          if (confirm(`Nonaktifkan "${d.name}"?`))
                            removeMutation.mutate(d.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
