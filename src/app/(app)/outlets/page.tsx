"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { outletsApi, usersApi } from "@/lib/api";
import type { Outlet } from "@/types";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Plus,
  Pencil,
  Trash2,
  Store,
  MapPin,
  Phone,
  Clock,
  Loader2,
} from "lucide-react";

function OutletDialog({
  trigger,
  initial,
}: {
  trigger: React.ReactNode;
  initial?: Outlet;
}) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const [name, setName] = useState(initial?.name ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [openingHours, setOpeningHours] = useState(
    initial?.opening_hours ?? "",
  );
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Nama outlet wajib diisi");
      if (!city.trim()) throw new Error("Kota wajib diisi");
      const payload = {
        name: name.trim(),
        city: city.trim(),
        address,
        phone,
        opening_hours: openingHours,
        is_active: isActive,
      };
      return initial
        ? outletsApi.update(initial.id, payload)
        : outletsApi.create(payload);
    },
    onSuccess: () => {
      toast.success(initial ? "Outlet diperbarui" : "Outlet ditambahkan");
      qc.invalidateQueries({ queryKey: ["outlets"] });
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
            {initial ? "Edit Outlet" : "Tambah Outlet"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Nama Outlet</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ALLEE Dago"
              />
            </div>
            <div className="space-y-2">
              <Label>Kota</Label>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Bandung"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Alamat</Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Jl. Ir. H. Juanda No. 123"
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Telepon</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="022-..."
              />
            </div>
            <div className="space-y-2">
              <Label>Jam Buka</Label>
              <Input
                value={openingHours}
                onChange={(e) => setOpeningHours(e.target.value)}
                placeholder="08:00 - 22:00"
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

export default function OutletsPage() {
  const qc = useQueryClient();
  const { data: outlets = [], isLoading } = useQuery({
    queryKey: ["outlets"],
    queryFn: () => outletsApi.list(),
  });
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => usersApi.list(),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => outletsApi.remove(id),
    onSuccess: () => {
      toast.success("Outlet dinonaktifkan");
      qc.invalidateQueries({ queryKey: ["outlets"] });
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Outlet Management"
        description="Kelola outlet cabang. Pengaturan PPN & service charge global ada di menu Settings."
        actions={
          <OutletDialog
            trigger={
              <Button>
                <Plus className="h-4 w-4" /> Tambah Outlet
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
      ) : outlets.length === 0 ? (
        <EmptyState
          icon={Store}
          title="Belum ada outlet"
          description="Tambah outlet pertama untuk mulai operasional."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {outlets.map((o) => {
            const kepala = users.find(
              (u) =>
                u.role === "kepala_toko" &&
                u.outlet_id === o.id &&
                u.is_active,
            );
            const staffCount = users.filter(
              (u) =>
                u.outlet_id === o.id &&
                u.role !== "owner" &&
                u.is_active,
            ).length;
            return (
              <Card key={o.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        {o.name}
                        {o.is_active ? (
                          <Badge variant="success">Aktif</Badge>
                        ) : (
                          <Badge variant="secondary">Nonaktif</Badge>
                        )}
                      </CardTitle>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {o.city}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <OutletDialog
                        initial={o}
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
                          if (confirm(`Nonaktifkan "${o.name}"?`))
                            removeMutation.mutate(o.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{o.address || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    <span>{o.phone || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{o.opening_hours || "—"}</span>
                  </div>

                  <div className="flex items-center justify-between pt-1 text-xs">
                    <span className="text-muted-foreground">
                      Kepala Toko:{" "}
                      <span className="font-medium text-foreground">
                        {kepala?.name ?? "—"}
                      </span>
                    </span>
                    <Badge variant="outline">{staffCount} staff</Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
