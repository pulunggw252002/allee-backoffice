"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { printersApi } from "@/lib/api";
import type {
  Printer,
  PrinterConnection,
  PrinterType,
} from "@/lib/api/printers";
import type { Outlet } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

const TYPE_LABEL: Record<PrinterType, string> = {
  cashier: "Kasir (Receipt)",
  kitchen: "Dapur (Kitchen)",
  bar: "Bar / Barista",
  label: "Label / Sticker",
};

const CONNECTION_LABEL: Record<PrinterConnection, string> = {
  usb: "USB",
  bluetooth: "Bluetooth",
  network: "Network / LAN",
  other: "Lainnya",
};

interface Props {
  trigger: React.ReactNode;
  initial?: Printer;
  outlets: Outlet[];
  /** Outlet default saat create — biasanya outlet yg sedang difilter di list. */
  defaultOutletId?: string | null;
  onDone?: () => void;
}

export function PrinterDialog({
  trigger,
  initial,
  outlets,
  defaultOutletId,
  onDone,
}: Props) {
  const isEdit = Boolean(initial);
  const [open, setOpen] = useState(false);
  const [outletId, setOutletId] = useState<string>(
    initial?.outlet_id ?? defaultOutletId ?? outlets[0]?.id ?? "",
  );
  const [code, setCode] = useState(initial?.code ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<PrinterType>(initial?.type ?? "cashier");
  const [connection, setConnection] = useState<PrinterConnection>(
    initial?.connection ?? "usb",
  );
  const [address, setAddress] = useState(initial?.address ?? "");
  const [paperWidth, setPaperWidth] = useState<number>(
    initial?.paper_width ?? 32,
  );
  const [note, setNote] = useState(initial?.note ?? "");
  const [isActive, setIsActive] = useState<boolean>(initial?.is_active ?? true);
  const qc = useQueryClient();

  const reset = () => {
    setOutletId(initial?.outlet_id ?? defaultOutletId ?? outlets[0]?.id ?? "");
    setCode(initial?.code ?? "");
    setName(initial?.name ?? "");
    setType(initial?.type ?? "cashier");
    setConnection(initial?.connection ?? "usb");
    setAddress(initial?.address ?? "");
    setPaperWidth(initial?.paper_width ?? 32);
    setNote(initial?.note ?? "");
    setIsActive(initial?.is_active ?? true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const trimmedCode = code.trim();
      const trimmedName = name.trim();
      if (!outletId) throw new Error("Pilih outlet dulu");
      if (!trimmedCode) throw new Error("Kode printer wajib diisi");
      if (!trimmedName) throw new Error("Nama printer wajib diisi");
      if (paperWidth < 20 || paperWidth > 80) {
        throw new Error("Lebar kertas harus 20–80 karakter");
      }

      if (isEdit && initial) {
        return printersApi.update(initial.id, {
          code: trimmedCode,
          name: trimmedName,
          type,
          connection,
          address: address.trim() || null,
          paper_width: paperWidth,
          note: note.trim() || null,
          is_active: isActive,
        });
      }
      return printersApi.create({
        outlet_id: outletId,
        code: trimmedCode,
        name: trimmedName,
        type,
        connection,
        address: address.trim() || null,
        paper_width: paperWidth,
        note: note.trim() || null,
        is_active: isActive,
      });
    },
    onSuccess: () => {
      toast.success(isEdit ? "Printer diperbarui" : "Printer ditambahkan");
      qc.invalidateQueries({ queryKey: ["printers"] });
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Printer" : "Tambah Printer"}</DialogTitle>
          <DialogDescription>
            Daftar printer ini dipakai POS untuk routing struk & order ke dapur.
            Setelah disimpan, kasir di POS bisa memilih maks. 2 printer aktif
            (1 receipt + 1 kitchen) di menu Settings.
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
            <Label>Outlet</Label>
            <Select
              value={outletId}
              onValueChange={setOutletId}
              disabled={isEdit}
            >
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
            {isEdit ? (
              <p className="text-xs text-muted-foreground">
                Outlet tidak bisa diubah setelah printer dibuat. Buat printer
                baru kalau perlu pindah outlet.
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="prn-code">Kode</Label>
              <Input
                id="prn-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="P-CASHIER-1"
                autoFocus
                required
              />
              <p className="text-xs text-muted-foreground">
                Unik per outlet. Pakai prefix tipe (P-CASHIER-1, P-KITCHEN-A)
                supaya gampang dibaca kasir.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="prn-name">Nama</Label>
              <Input
                id="prn-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Printer Kasir Bar"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Peruntukan</Label>
              <Select value={type} onValueChange={(v) => setType(v as PrinterType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_LABEL) as PrinterType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Koneksi</Label>
              <Select
                value={connection}
                onValueChange={(v) => setConnection(v as PrinterConnection)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CONNECTION_LABEL) as PrinterConnection[]).map(
                    (c) => (
                      <SelectItem key={c} value={c}>
                        {CONNECTION_LABEL[c]}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="prn-address">Alamat / Identifier</Label>
              <Input
                id="prn-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="192.168.1.50:9100 / VID:0416"
              />
              <p className="text-xs text-muted-foreground">
                Optional — IP, MAC, atau VID/PID. Untuk dokumentasi & audit.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="prn-paper">Lebar Kertas (kolom)</Label>
              <Input
                id="prn-paper"
                type="number"
                min={20}
                max={80}
                value={paperWidth}
                onChange={(e) => setPaperWidth(Number(e.target.value) || 32)}
              />
              <p className="text-xs text-muted-foreground">
                58mm ≈ 32 kolom · 80mm ≈ 48 kolom.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="prn-note">Catatan</Label>
            <Textarea
              id="prn-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Lokasi fisik, kondisi, atau info tambahan"
              rows={2}
            />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Aktif</p>
              <p className="text-xs text-muted-foreground">
                Printer non-aktif tidak muncul di POS settings.
              </p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
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
              ) : isEdit ? (
                "Simpan Perubahan"
              ) : (
                "Tambah Printer"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
