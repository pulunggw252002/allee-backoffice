"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ingredientsApi, outletsApi, stockMovementsApi } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { useOutletStore } from "@/stores/outlet-store";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatNumber } from "@/lib/format";
import { RECENT_MOVEMENTS_LIMIT } from "@/lib/constants";
import { isAllOutletsAllowed } from "@/lib/rbac";
import { Loader2, ArrowUpFromLine } from "lucide-react";

type Reason = "waste" | "rusak" | "koreksi" | "transfer";

const REASON_LABEL: Record<Reason, string> = {
  waste: "Waste",
  rusak: "Rusak / Expired",
  koreksi: "Koreksi",
  transfer: "Transfer Outlet",
};

export default function StockOutPage() {
  const user = useAuthStore((s) => s.user);
  const outletSelected = useOutletStore((s) => s.selectedOutletId);
  const qc = useQueryClient();

  const { data: outlets = [] } = useQuery({
    queryKey: ["outlets"],
    queryFn: () => outletsApi.list(),
  });
  const { data: allIngredients = [] } = useQuery({
    queryKey: ["ingredients", "all"],
    queryFn: () => ingredientsApi.list(),
  });

  const allOutletsAllowed = isAllOutletsAllowed(user?.role);
  const allowedOutlets = useMemo(
    () =>
      allOutletsAllowed
        ? outlets
        : outlets.filter((o) => o.id === user?.outlet_id),
    [outlets, user, allOutletsAllowed],
  );
  const defaultOutletId =
    !allOutletsAllowed && user?.outlet_id
      ? user.outlet_id
      : outletSelected ?? outlets[0]?.id ?? "";

  const [outletId, setOutletId] = useState(defaultOutletId);
  const [ingredientId, setIngredientId] = useState("");
  const [quantity, setQuantity] = useState<number>(0);
  const [reason, setReason] = useState<Reason>("waste");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (
      !allOutletsAllowed &&
      user?.outlet_id &&
      outletId !== user.outlet_id
    ) {
      setOutletId(user.outlet_id);
    }
  }, [user, outletId, allOutletsAllowed]);

  const ingredientsForOutlet = allIngredients.filter(
    (i) => i.outlet_id === outletId,
  );
  const selectedIng = allIngredients.find((i) => i.id === ingredientId);

  const { data: movements = [] } = useQuery({
    queryKey: ["movements", outletId, "out"],
    queryFn: () =>
      stockMovementsApi.list({
        outlet_id: outletId,
        types: ["out_waste", "adjustment"],
      }),
    enabled: !!outletId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!ingredientId) throw new Error("Pilih bahan");
      if (quantity <= 0) throw new Error("Qty harus > 0");
      if (!user) throw new Error("User tidak login");
      if (selectedIng && quantity > selectedIng.current_stock) {
        throw new Error(
          `Stok hanya ${formatNumber(selectedIng.current_stock)} ${selectedIng.unit}`,
        );
      }
      return ingredientsApi.stockOut({
        ingredient_id: ingredientId,
        outlet_id: outletId,
        quantity,
        reason,
        notes: notes || undefined,
        user_id: user.id,
      });
    },
    onSuccess: () => {
      toast.success("Stok keluar dicatat");
      qc.invalidateQueries({ queryKey: ["ingredients"] });
      qc.invalidateQueries({ queryKey: ["movements"] });
      setIngredientId("");
      setQuantity(0);
      setNotes("");
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Gagal");
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stok Keluar (Waste / Koreksi)"
        description="Catat pengurangan stok di luar penjualan: waste, kerusakan, koreksi, atau transfer."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">Form Outbound</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Outlet</Label>
              <Select
                value={outletId}
                onValueChange={setOutletId}
                disabled={!allOutletsAllowed}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allowedOutlets.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Bahan</Label>
              <Select value={ingredientId} onValueChange={setIngredientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih bahan" />
                </SelectTrigger>
                <SelectContent>
                  {ingredientsForOutlet.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name} ({i.unit})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedIng ? (
                <p className="text-xs text-muted-foreground">
                  Stok saat ini:{" "}
                  <span className="tabular">
                    {formatNumber(selectedIng.current_stock)} {selectedIng.unit}
                  </span>
                </p>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Qty</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={quantity || ""}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Alasan</Label>
                <Select value={reason} onValueChange={(v) => setReason(v as Reason)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(REASON_LABEL).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Detail tambahan untuk audit"
              />
            </div>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="w-full"
              variant="destructive"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUpFromLine className="h-4 w-4" />
              )}
              Simpan Stok Keluar
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Riwayat Stok Keluar</CardTitle>
          </CardHeader>
          <CardContent>
            {movements.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Belum ada riwayat untuk outlet ini.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Waktu</TableHead>
                    <TableHead>Bahan</TableHead>
                    <TableHead>Tipe</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Catatan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.slice(0, RECENT_MOVEMENTS_LIMIT).map((m) => {
                    const ing = allIngredients.find(
                      (i) => i.id === m.ingredient_id,
                    );
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="text-xs tabular text-muted-foreground">
                          {formatDateTime(m.created_at)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {ing?.name ?? "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={m.type === "out_waste" ? "danger" : "warning"}>
                            {m.type === "out_waste" ? "Waste" : "Adjust"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular text-red-600">
                          {formatNumber(m.quantity)} {ing?.unit ?? ""}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {m.notes ?? "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
