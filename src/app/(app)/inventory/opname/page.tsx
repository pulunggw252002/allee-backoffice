"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ingredientsApi, outletsApi } from "@/lib/api";
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
import { formatNumber, formatIDR, formatPercent } from "@/lib/format";
import { OPNAME_THRESHOLD_PCT } from "@/lib/constants";
import { canViewCosts, isAllOutletsAllowed } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { Loader2, ClipboardCheck } from "lucide-react";

function diffPercent(actual: number, system: number): number {
  if (system === 0) return actual === 0 ? 0 : Infinity * Math.sign(actual);
  return ((actual - system) / system) * 100;
}

export default function OpnamePage() {
  const user = useAuthStore((s) => s.user);
  const canSeeValue = canViewCosts(user?.role);
  const allOutletsAllowed = isAllOutletsAllowed(user?.role);
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

  const allowedOutlets = useMemo(
    () =>
      allOutletsAllowed
        ? outlets
        : outlets.filter((o) => o.id === user?.outlet_id),
    [outlets, user, allOutletsAllowed],
  );

  const [outletId, setOutletId] = useState(outletSelected ?? "");
  useEffect(() => {
    if (!allOutletsAllowed && user?.outlet_id) {
      if (outletId !== user.outlet_id) setOutletId(user.outlet_id);
      return;
    }
    if (!outletId && outlets.length > 0) setOutletId(outlets[0].id);
  }, [outlets, outletId, user, allOutletsAllowed]);

  const [notes, setNotes] = useState("");
  const [actuals, setActuals] = useState<Record<string, number>>({});

  const ingredientsForOutlet = allIngredients.filter(
    (i) => i.outlet_id === outletId,
  );

  useEffect(() => {
    setActuals((prev) => {
      const next: Record<string, number> = {};
      ingredientsForOutlet.forEach((i) => {
        next[i.id] = prev[i.id] ?? i.current_stock;
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outletId, ingredientsForOutlet.length]);

  const totalDiffValue = ingredientsForOutlet.reduce((sum, i) => {
    const actual = actuals[i.id] ?? i.current_stock;
    const diff = actual - i.current_stock;
    return sum + diff * i.unit_price;
  }, 0);

  const overThresholdCount = ingredientsForOutlet.reduce((count, i) => {
    const actual = actuals[i.id] ?? i.current_stock;
    const pct = diffPercent(actual, i.current_stock);
    return Math.abs(pct) > OPNAME_THRESHOLD_PCT ? count + 1 : count;
  }, 0);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("User tidak login");
      if (ingredientsForOutlet.length === 0)
        throw new Error("Tidak ada bahan untuk opname");
      return ingredientsApi.opname({
        outlet_id: outletId,
        user_id: user.id,
        notes: notes || undefined,
        items: ingredientsForOutlet.map((i) => ({
          ingredient_id: i.id,
          actual_qty: actuals[i.id] ?? i.current_stock,
        })),
      });
    },
    onSuccess: () => {
      toast.success("Opname tersimpan");
      qc.invalidateQueries({ queryKey: ["ingredients"] });
      qc.invalidateQueries({ queryKey: ["movements"] });
      setNotes("");
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Gagal");
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Opname"
        description="Penghitungan fisik stok vs sistem. Sistem akan otomatis menyesuaikan dengan menambah entri opname di riwayat movement."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm">
              Hitung Fisik ({ingredientsForOutlet.length} bahan)
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                · ambang selisih {OPNAME_THRESHOLD_PCT}%
              </span>
            </CardTitle>
            <div className="w-52">
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
          </CardHeader>
          <CardContent>
            {ingredientsForOutlet.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Tidak ada bahan untuk outlet ini.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bahan</TableHead>
                    <TableHead className="text-right">Sistem</TableHead>
                    <TableHead className="w-32 text-right">Fisik</TableHead>
                    <TableHead className="text-right">Selisih</TableHead>
                    <TableHead className="text-right">%</TableHead>
                    {canSeeValue ? (
                      <TableHead className="text-right">Nilai</TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ingredientsForOutlet.map((i) => {
                    const actual = actuals[i.id] ?? i.current_stock;
                    const diff = actual - i.current_stock;
                    const diffValue = diff * i.unit_price;
                    const pct = diffPercent(actual, i.current_stock);
                    const exceeds = Math.abs(pct) > OPNAME_THRESHOLD_PCT;
                    const exceedsOver = exceeds && diff > 0;
                    const exceedsUnder = exceeds && diff < 0;
                    return (
                      <TableRow
                        key={i.id}
                        className={cn(
                          exceedsOver &&
                            "bg-emerald-500/10 hover:bg-emerald-500/15",
                          exceedsUnder && "bg-red-500/10 hover:bg-red-500/15",
                        )}
                      >
                        <TableCell>
                          <p className="text-sm font-medium">{i.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {i.unit}
                          </p>
                        </TableCell>
                        <TableCell className="text-right tabular text-muted-foreground">
                          {formatNumber(i.current_stock)}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.1"
                            value={actual}
                            onChange={(e) =>
                              setActuals((prev) => ({
                                ...prev,
                                [i.id]: Number(e.target.value),
                              }))
                            }
                            className="h-8 text-right"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          {diff === 0 ? (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          ) : (
                            <Badge
                              variant={
                                exceedsOver
                                  ? "success"
                                  : exceedsUnder
                                    ? "danger"
                                    : "secondary"
                              }
                            >
                              {diff > 0 ? "+" : ""}
                              {formatNumber(diff)}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right text-xs tabular",
                            exceedsOver && "font-semibold text-emerald-600",
                            exceedsUnder && "font-semibold text-red-600",
                            !exceeds && "text-muted-foreground",
                          )}
                        >
                          {diff === 0
                            ? "—"
                            : Number.isFinite(pct)
                              ? `${pct > 0 ? "+" : ""}${formatPercent(pct, 1)}`
                              : diff > 0
                                ? "+∞"
                                : "-∞"}
                        </TableCell>
                        {canSeeValue ? (
                          <TableCell className="text-right text-xs tabular">
                            {diff === 0
                              ? "-"
                              : `${diff > 0 ? "+" : ""}${formatIDR(diffValue)}`}
                          </TableCell>
                        ) : null}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">Ringkasan & Submit</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {canSeeValue ? (
              <div className="rounded-md bg-muted/50 p-3">
                <p className="text-xs uppercase text-muted-foreground">
                  Total Nilai Selisih
                </p>
                <p
                  className={
                    totalDiffValue === 0
                      ? "mt-1 text-xl font-semibold tabular"
                      : totalDiffValue > 0
                        ? "mt-1 text-xl font-semibold tabular text-emerald-600"
                        : "mt-1 text-xl font-semibold tabular text-red-600"
                  }
                >
                  {formatIDR(totalDiffValue)}
                </p>
              </div>
            ) : null}
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase text-muted-foreground">
                Di luar ambang {OPNAME_THRESHOLD_PCT}%
              </p>
              <p
                className={cn(
                  "mt-1 text-xl font-semibold tabular",
                  overThresholdCount > 0 && "text-amber-600",
                )}
              >
                {overThresholdCount} bahan
              </p>
            </div>
            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Catatan untuk audit (opsional)"
              />
            </div>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="w-full"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ClipboardCheck className="h-4 w-4" />
              )}
              Submit Opname
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
