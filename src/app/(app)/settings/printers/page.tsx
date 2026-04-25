"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Pencil,
  Plus,
  Printer as PrinterIcon,
  Trash2,
  Building2,
} from "lucide-react";
import { outletsApi, printersApi } from "@/lib/api";
import type { Printer } from "@/lib/api/printers";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { PrinterDialog } from "@/components/printers/printer-form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TYPE_LABEL: Record<Printer["type"], string> = {
  cashier: "Kasir",
  kitchen: "Dapur",
  bar: "Bar",
  label: "Label",
};

const TYPE_TONE: Record<Printer["type"], "default" | "secondary" | "outline"> = {
  cashier: "default",
  kitchen: "secondary",
  bar: "secondary",
  label: "outline",
};

const CONNECTION_LABEL: Record<Printer["connection"], string> = {
  usb: "USB",
  bluetooth: "Bluetooth",
  network: "Network",
  other: "Lainnya",
};

const ALL_OUTLETS = "__all__";

export default function PrintersSettingsPage() {
  const qc = useQueryClient();
  const [outletFilter, setOutletFilter] = useState<string>(ALL_OUTLETS);

  const { data: outlets = [] } = useQuery({
    queryKey: ["outlets"],
    queryFn: () => outletsApi.list(),
  });

  const { data: printers = [], isLoading } = useQuery({
    queryKey: ["printers", outletFilter],
    queryFn: () =>
      printersApi.list({
        outlet_id: outletFilter === ALL_OUTLETS ? null : outletFilter,
      }),
  });

  // Hitung jumlah printer per outlet — main monitoring metric yang owner mau
  // tahu: "outlet X punya berapa printer dan kode-nya apa saja".
  const printersByOutlet = useMemo(() => {
    const map = new Map<string, Printer[]>();
    for (const p of printers) {
      const list = map.get(p.outlet_id) ?? [];
      list.push(p);
      map.set(p.outlet_id, list);
    }
    return map;
  }, [printers]);

  const removeMutation = useMutation({
    mutationFn: (id: string) => printersApi.remove(id),
    onSuccess: () => {
      toast.success("Printer dihapus");
      qc.invalidateQueries({ queryKey: ["printers"] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus");
    },
  });

  const totalActive = printers.filter((p) => p.is_active).length;
  const totalInactive = printers.length - totalActive;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Printer"
        description="Kelola printer per outlet dan monitor jumlah printer aktif. POS tarik daftar ini lewat sync — kasir lalu pilih maks. 2 printer (receipt + kitchen) di settings POS."
        actions={
          <PrinterDialog
            outlets={outlets}
            defaultOutletId={
              outletFilter === ALL_OUTLETS ? undefined : outletFilter
            }
            trigger={
              <Button disabled={outlets.length === 0}>
                <Plus className="h-4 w-4" /> Tambah Printer
              </Button>
            }
          />
        }
      />

      {/* Monitoring summary cards — owner-friendly snapshot */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Total Printer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular">{printers.length}</p>
            <p className="text-xs text-muted-foreground">
              {totalActive} aktif · {totalInactive} non-aktif
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Outlet ter-cover
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular">
              {printersByOutlet.size}
              <span className="text-sm font-normal text-muted-foreground">
                {" / "}
                {outlets.length}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              Outlet dengan minimal 1 printer terdaftar.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Filter Outlet
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={outletFilter} onValueChange={setOutletFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_OUTLETS}>Semua outlet</SelectItem>
                {outlets.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      {/* Per-outlet breakdown — answers "berapa printer di outlet X & kodenya apa" */}
      {outlets.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Distribusi per Outlet
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {outlets.map((o) => {
                const list = printersByOutlet.get(o.id) ?? [];
                return (
                  <div
                    key={o.id}
                    className="rounded-md border p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{o.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {list.length === 0
                            ? "Belum ada printer"
                            : `${list.length} printer (${list.filter((p) => p.is_active).length} aktif)`}
                        </p>
                      </div>
                      <Badge variant={list.length > 0 ? "secondary" : "outline"}>
                        {list.length}
                      </Badge>
                    </div>
                    {list.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {list.map((p) => (
                          <Badge
                            key={p.id}
                            variant={p.is_active ? "secondary" : "outline"}
                            className="font-mono text-[10px]"
                            title={`${p.name} (${TYPE_LABEL[p.type]} · ${CONNECTION_LABEL[p.connection]})`}
                          >
                            {p.code}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Memuat printer…
          </CardContent>
        </Card>
      ) : printers.length === 0 ? (
        <EmptyState
          icon={PrinterIcon}
          title="Belum ada printer"
          description={
            outlets.length === 0
              ? "Buat outlet dulu sebelum menambah printer."
              : "Daftarkan printer pertama untuk outlet Anda — POS akan otomatis sync."
          }
          action={
            outlets.length > 0 ? (
              <PrinterDialog
                outlets={outlets}
                defaultOutletId={
                  outletFilter === ALL_OUTLETS ? undefined : outletFilter
                }
                trigger={
                  <Button>
                    <Plus className="h-4 w-4" /> Tambah Printer
                  </Button>
                }
              />
            ) : null
          }
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Kode</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Outlet</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead>Koneksi</TableHead>
                <TableHead>Alamat</TableHead>
                <TableHead className="w-20">Status</TableHead>
                <TableHead className="w-32 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {printers.map((p) => {
                const outlet = outlets.find((o) => o.id === p.outlet_id);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.code}</TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {outlet?.name ?? p.outlet_id}
                    </TableCell>
                    <TableCell>
                      <Badge variant={TYPE_TONE[p.type]}>
                        {TYPE_LABEL[p.type]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {CONNECTION_LABEL[p.connection]}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {p.address ?? "—"}
                    </TableCell>
                    <TableCell>
                      {p.is_active ? (
                        <Badge variant="success">Aktif</Badge>
                      ) : (
                        <Badge variant="outline">Nonaktif</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <PrinterDialog
                          outlets={outlets}
                          initial={p}
                          trigger={
                            <Button variant="ghost" size="icon">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={removeMutation.isPending}
                          onClick={() => {
                            if (
                              confirm(
                                `Hapus printer "${p.code} · ${p.name}"? Kasir di POS yang masih pakai akan kehilangan opsi ini.`,
                              )
                            ) {
                              removeMutation.mutate(p.id);
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
