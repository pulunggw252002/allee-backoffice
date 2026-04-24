"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { taxSettingsApi } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime, formatIDR, formatPercent } from "@/lib/format";
import { Loader2, Save, Receipt } from "lucide-react";

const EXAMPLE_SUBTOTAL = 50_000;

export default function SettingsPage() {
  const qc = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ["taxSettings"],
    queryFn: () => taxSettingsApi.get(),
  });

  const [ppn, setPpn] = useState<string>("");
  const [sc, setSc] = useState<string>("");

  useEffect(() => {
    if (settings) {
      setPpn(String(settings.ppn_percent));
      setSc(String(settings.service_charge_percent));
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: () =>
      taxSettingsApi.update({
        ppn_percent: Number(ppn),
        service_charge_percent: Number(sc),
      }),
    onSuccess: () => {
      toast.success("Pengaturan pajak diperbarui");
      qc.invalidateQueries({ queryKey: ["taxSettings"] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan"),
  });

  const ppnNum = Number(ppn);
  const scNum = Number(sc);
  const ppnValid = Number.isFinite(ppnNum) && ppnNum >= 0 && ppnNum <= 100;
  const scValid = Number.isFinite(scNum) && scNum >= 0 && scNum <= 100;
  const isDirty =
    settings != null &&
    (ppnNum !== settings.ppn_percent ||
      scNum !== settings.service_charge_percent);

  const ppnAmount = ppnValid
    ? Math.round((EXAMPLE_SUBTOTAL * ppnNum) / 100)
    : 0;
  const scAmount = scValid
    ? Math.round((EXAMPLE_SUBTOTAL * scNum) / 100)
    : 0;
  const grandTotal = EXAMPLE_SUBTOTAL + ppnAmount + scAmount;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pengaturan"
        description="Konfigurasi global yang berlaku untuk semua outlet & seluruh menu."
      />

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Receipt className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base">PPN & Service Charge</CardTitle>
              <CardDescription>
                Nilai persentase ini dipakai oleh POS untuk menghitung pajak dan
                service charge di setiap transaksi — berlaku untuk seluruh menu
                di semua outlet.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Memuat…</p>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ppn">PPN (%)</Label>
                  <Input
                    id="ppn"
                    type="number"
                    step="0.1"
                    min={0}
                    max={100}
                    value={ppn}
                    onChange={(e) => setPpn(e.target.value)}
                    placeholder="11"
                  />
                  <p className="text-xs text-muted-foreground">
                    Standar Indonesia: 11%.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sc">Service Charge (%)</Label>
                  <Input
                    id="sc"
                    type="number"
                    step="0.1"
                    min={0}
                    max={100}
                    value={sc}
                    onChange={(e) => setSc(e.target.value)}
                    placeholder="5"
                  />
                  <p className="text-xs text-muted-foreground">
                    Set 0 jika tidak memakai service charge.
                  </p>
                </div>
              </div>

              <div className="rounded-md border bg-muted/40 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Preview perhitungan
                </p>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Subtotal (contoh)
                    </span>
                    <span className="tabular">
                      {formatIDR(EXAMPLE_SUBTOTAL)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      PPN ({ppnValid ? formatPercent(ppnNum) : "-"})
                    </span>
                    <span className="tabular">{formatIDR(ppnAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Service Charge ({scValid ? formatPercent(scNum) : "-"})
                    </span>
                    <span className="tabular">{formatIDR(scAmount)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1 font-semibold">
                    <span>Total</span>
                    <span className="tabular">{formatIDR(grandTotal)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {settings
                    ? `Terakhir diperbarui ${formatDateTime(settings.updated_at)}`
                    : ""}
                </p>
                <Button
                  type="button"
                  onClick={() => updateMutation.mutate()}
                  disabled={
                    !isDirty ||
                    !ppnValid ||
                    !scValid ||
                    updateMutation.isPending
                  }
                >
                  {updateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Simpan
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
