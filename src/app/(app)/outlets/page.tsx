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
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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

/**
 * Parse JSON-stringified receipt_footer (the storage format) ke array string
 * yang enak diedit di textarea (1 baris = 1 line struk).
 */
function parseReceiptFooter(raw: string | null | undefined): string {
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.join("\n");
  } catch {
    // raw ternyata bukan JSON valid → tampilkan apa adanya, biarkan user fix.
  }
  return raw;
}

function OutletDialog({
  trigger,
  initial,
}: {
  trigger: React.ReactNode;
  initial?: Outlet;
}) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  // Basic info
  const [name, setName] = useState(initial?.name ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [openingHours, setOpeningHours] = useState(
    initial?.opening_hours ?? "",
  );
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);

  // Receipt customization
  const [brandName, setBrandName] = useState(initial?.brand_name ?? "");
  const [brandSubtitle, setBrandSubtitle] = useState(
    initial?.brand_subtitle ?? "",
  );
  const [taxId, setTaxId] = useState(initial?.tax_id ?? "");
  const [receiptFooter, setReceiptFooter] = useState(
    parseReceiptFooter(initial?.receipt_footer),
  );

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
        // Receipt fields — kosongkan ⇒ null (POS akan fallback ke default).
        brand_name: brandName.trim() || null,
        brand_subtitle: brandSubtitle.trim() || null,
        tax_id: taxId.trim() || null,
        // Server-side normalize akan split per newline & JSON.stringify.
        receipt_footer: receiptFooter,
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

  // Live preview lines
  const previewBrand = brandName.trim() || name.trim() || "POS";
  const previewFooterLines = receiptFooter
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {initial ? "Edit Outlet" : "Tambah Outlet"}
          </DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="info" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="info">Info Outlet</TabsTrigger>
            <TabsTrigger value="receipt">Edit Struk</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-3 pt-2">
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
          </TabsContent>

          <TabsContent value="receipt" className="grid gap-4 pt-2 md:grid-cols-2">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Brand Name (Header Struk)</Label>
                <Input
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="Kosongkan untuk pakai nama outlet"
                />
                <p className="text-xs text-muted-foreground">
                  Kalau kosong, header struk pakai nama outlet ({name || "—"}).
                </p>
              </div>
              <div className="space-y-2">
                <Label>Tagline / Subtitle</Label>
                <Input
                  value={brandSubtitle}
                  onChange={(e) => setBrandSubtitle(e.target.value)}
                  placeholder="Specialty Coffee & Brunch"
                />
              </div>
              <div className="space-y-2">
                <Label>NPWP</Label>
                <Input
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  placeholder="00.000.000.0-000.000 (opsional, untuk PKP)"
                />
              </div>
              <div className="space-y-2">
                <Label>Footer Struk</Label>
                <Textarea
                  value={receiptFooter}
                  onChange={(e) => setReceiptFooter(e.target.value)}
                  placeholder={"Terima kasih ☕\nSampai jumpa kembali!"}
                  rows={5}
                />
                <p className="text-xs text-muted-foreground">
                  Tiap baris = 1 line di footer struk. Kosongkan kalau tidak
                  perlu footer khusus.
                </p>
              </div>
            </div>

            {/* Live preview */}
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Preview Struk
              </p>
              <div className="mx-auto max-w-[260px] font-mono text-[12px] leading-snug">
                <div className="text-center">
                  <p className="text-sm font-bold">{previewBrand}</p>
                  {brandSubtitle.trim() && (
                    <p className="text-[11px]">{brandSubtitle}</p>
                  )}
                  {address.trim() && (
                    <p className="text-[10px]">{address}</p>
                  )}
                  {phone.trim() && (
                    <p className="text-[10px]">Telp: {phone}</p>
                  )}
                  {taxId.trim() && (
                    <p className="text-[10px]">NPWP: {taxId}</p>
                  )}
                  <p className="text-[11px]">
                    --------------------------------
                  </p>
                </div>
                <div className="text-[11px]">
                  <div className="flex justify-between">
                    <span>Sample Item</span>
                    <span>Rp 25.000</span>
                  </div>
                  <p className="text-[11px]">
                    --------------------------------
                  </p>
                  <div className="flex justify-between font-bold">
                    <span>TOTAL</span>
                    <span>Rp 25.000</span>
                  </div>
                </div>
                <div className="mt-2 text-center text-[11px]">
                  {previewFooterLines.length === 0 ? (
                    <p className="italic text-muted-foreground">
                      (footer kosong)
                    </p>
                  ) : (
                    previewFooterLines.map((line, i) => <p key={i}>{line}</p>)
                  )}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

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
