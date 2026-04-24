"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { outletsApi, transactionsApi, usersApi } from "@/lib/api";
import { useOutletStore } from "@/stores/outlet-store";
import { PageHeader } from "@/components/shared/page-header";
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
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  DateRangePicker,
  toRange,
  type DateRange,
} from "@/components/reports/date-range-picker";
import { ExportButton } from "@/components/reports/export-button";
import { formatIDR, formatDateTime } from "@/lib/format";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL } from "@/lib/constants";
import type { PaymentMethod, Transaction } from "@/types";
import { Search, Eye } from "lucide-react";

export default function TransactionsReportPage() {
  const outletId = useOutletStore((s) => s.selectedOutletId);
  const [range, setRange] = useState<DateRange>(toRange("7d"));
  const [payment, setPayment] = useState<PaymentMethod | "all">("all");
  const [query, setQuery] = useState("");

  const { data: txs = [] } = useQuery({
    queryKey: ["report.tx", outletId, range.start, range.end],
    queryFn: () =>
      transactionsApi.list({
        outlet_id: outletId,
        start: range.start,
        end: range.end,
      }),
  });
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => usersApi.list(),
  });
  const { data: outlets = [] } = useQuery({
    queryKey: ["outlets"],
    queryFn: () => outletsApi.list(),
  });

  const filtered = useMemo(() => {
    return txs.filter((t) => {
      if (payment !== "all" && t.payment_method !== payment) return false;
      if (query) {
        const q = query.toLowerCase();
        if (
          !t.id.toLowerCase().includes(q) &&
          !t.items.some((it) =>
            it.name_snapshot.toLowerCase().includes(q),
          )
        )
          return false;
      }
      return true;
    });
  }, [txs, payment, query]);

  const totalRevenue = filtered.reduce((s, t) => s + t.grand_total, 0);

  const exportRows = filtered.map((t) => ({
    id: t.id,
    waktu: t.created_at,
    outlet: outlets.find((o) => o.id === t.outlet_id)?.name ?? "",
    kasir: users.find((u) => u.id === t.user_id)?.name ?? "",
    items: t.items.length,
    subtotal: t.subtotal,
    diskon: t.discount_total,
    ppn: t.ppn_amount,
    sc: t.service_charge_amount,
    total: t.grand_total,
    bayar: t.payment_method,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Riwayat Transaksi"
        description="Detail setiap transaksi, termasuk payment method dan cashier."
        actions={
          <ExportButton
            data={exportRows}
            filename={`transactions-${range.start.slice(0, 10)}`}
          />
        }
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <DateRangePicker value={range} onChange={setRange} />
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari ID atau item…"
              className="w-[220px] pl-9"
            />
          </div>
          <Select
            value={payment}
            onValueChange={(v) => setPayment(v as PaymentMethod | "all")}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua bayar</SelectItem>
              {PAYMENT_METHODS.map((m) => (
                <SelectItem key={m} value={m}>
                  {PAYMENT_METHOD_LABEL[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Transaksi</p>
            <p className="mt-1 text-2xl font-semibold tabular">
              {filtered.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Gross Sales</p>
            <p className="mt-1 text-2xl font-semibold tabular">
              {formatIDR(totalRevenue)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">
              Rata-rata Ticket
            </p>
            <p className="mt-1 text-2xl font-semibold tabular">
              {formatIDR(
                filtered.length > 0 ? totalRevenue / filtered.length : 0,
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Daftar Transaksi</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Waktu</TableHead>
                <TableHead>Outlet</TableHead>
                <TableHead>Kasir</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Bayar</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-sm text-muted-foreground"
                  >
                    Tidak ada transaksi.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.slice(0, 100).map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs">
                      {t.id.slice(0, 10)}
                    </TableCell>
                    <TableCell className="text-xs tabular text-muted-foreground">
                      {formatDateTime(t.created_at)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {outlets.find((o) => o.id === t.outlet_id)?.name ?? ""}
                    </TableCell>
                    <TableCell className="text-xs">
                      {users.find((u) => u.id === t.user_id)?.name ?? ""}
                    </TableCell>
                    <TableCell className="text-xs">
                      {t.items.length}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="uppercase text-xs">
                        {PAYMENT_METHOD_LABEL[t.payment_method]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular">
                      {formatIDR(t.grand_total)}
                    </TableCell>
                    <TableCell>
                      <TransactionDetailDialog tx={t} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function TransactionDetailDialog({ tx }: { tx: Transaction }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Eye className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm">{tx.id}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground tabular">
            {formatDateTime(tx.created_at)}
          </div>
          <ul className="divide-y rounded-md border">
            {tx.items.map((it) => (
              <li key={it.id} className="p-2">
                <div className="flex items-center justify-between text-sm">
                  <span>
                    {it.name_snapshot}{" "}
                    <span className="text-muted-foreground">
                      ×{it.quantity}
                    </span>
                  </span>
                  <span className="tabular">{formatIDR(it.subtotal)}</span>
                </div>
                {it.addons.length > 0 ? (
                  <ul className="mt-1 space-y-0.5 pl-3 text-xs text-muted-foreground">
                    {it.addons.map((a) => (
                      <li key={a.id}>
                        + {a.name_snapshot}
                        {a.extra_price > 0
                          ? ` (${formatIDR(a.extra_price)})`
                          : ""}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="space-y-1 rounded-md bg-muted/50 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular">{formatIDR(tx.subtotal)}</span>
            </div>
            {tx.discount_total > 0 ? (
              <div className="flex justify-between text-amber-600">
                <span>Diskon</span>
                <span className="tabular">
                  −{formatIDR(tx.discount_total)}
                </span>
              </div>
            ) : null}
            <div className="flex justify-between">
              <span className="text-muted-foreground">PPN</span>
              <span className="tabular">{formatIDR(tx.ppn_amount)}</span>
            </div>
            {tx.service_charge_amount > 0 ? (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Service Charge</span>
                <span className="tabular">
                  {formatIDR(tx.service_charge_amount)}
                </span>
              </div>
            ) : null}
            <div className="flex justify-between border-t pt-1 font-semibold">
              <span>Total</span>
              <span className="tabular">{formatIDR(tx.grand_total)}</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
