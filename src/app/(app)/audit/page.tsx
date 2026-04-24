"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  auditApi,
  outletsApi,
  usersApi,
} from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExportButton } from "@/components/reports/export-button";
import {
  DateRangePicker,
  toRange,
} from "@/components/reports/date-range-picker";
import { formatDateTime } from "@/lib/format";
import { ROLE_LABEL, type AuditAction, type AuditEntity } from "@/types";
import { History } from "lucide-react";

const ENTITY_OPTIONS: Array<{ value: AuditEntity | "all"; label: string }> = [
  { value: "all", label: "Semua Entity" },
  { value: "menu", label: "Menu" },
  { value: "ingredient", label: "Bahan" },
  { value: "addon_group", label: "Add-on" },
  { value: "bundle", label: "Bundle" },
  { value: "discount", label: "Diskon" },
  { value: "user", label: "User" },
  { value: "outlet", label: "Outlet" },
  { value: "category", label: "Kategori" },
  { value: "session", label: "Sesi" },
];

const ACTION_OPTIONS: Array<{ value: AuditAction | "all"; label: string }> = [
  { value: "all", label: "Semua Aksi" },
  { value: "create", label: "Create" },
  { value: "update", label: "Update" },
  { value: "delete", label: "Delete" },
  { value: "stock_in", label: "Stok Masuk" },
  { value: "stock_out", label: "Stok Keluar" },
  { value: "opname", label: "Opname" },
  { value: "login", label: "Login" },
  { value: "check_in", label: "Absen Masuk" },
  { value: "check_out", label: "Absen Pulang" },
];

const ACTION_BADGE: Record<
  AuditAction,
  { label: string; variant: "default" | "success" | "danger" | "outline" | "secondary" }
> = {
  create: { label: "Create", variant: "success" },
  update: { label: "Update", variant: "default" },
  delete: { label: "Delete", variant: "danger" },
  stock_in: { label: "Stock In", variant: "success" },
  stock_out: { label: "Stock Out", variant: "danger" },
  opname: { label: "Opname", variant: "secondary" },
  login: { label: "Login", variant: "outline" },
  check_in: { label: "Masuk", variant: "success" },
  check_out: { label: "Pulang", variant: "secondary" },
};

function renderValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Aktif" : "Nonaktif";
  if (Array.isArray(v)) return v.length === 0 ? "—" : v.join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export default function AuditPage() {
  const [entity, setEntity] = useState<AuditEntity | "all">("all");
  const [action, setAction] = useState<AuditAction | "all">("all");
  const [userId, setUserId] = useState<string>("all");
  const [outletId, setOutletId] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [range, setRange] = useState(() => toRange("30d"));

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => usersApi.list(),
  });
  const { data: outlets = [] } = useQuery({
    queryKey: ["outlets"],
    queryFn: () => outletsApi.list(),
  });

  const filters = {
    entity: entity === "all" ? null : entity,
    action: action === "all" ? null : action,
    user_id: userId === "all" ? null : userId,
    outlet_id: outletId === "all" ? null : outletId,
    search,
    start: range.start,
    end: range.end,
  };

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit", filters],
    queryFn: () => auditApi.list(filters),
  });

  const outletLookup = useMemo(
    () => Object.fromEntries(outlets.map((o) => [o.id, o.name])),
    [outlets],
  );

  const csvRows = logs.map((log) => ({
    waktu: formatDateTime(log.created_at),
    user: log.user_name,
    role: ROLE_LABEL[log.user_role],
    aksi: ACTION_BADGE[log.action].label,
    entity: log.entity,
    target: log.entity_name,
    outlet: log.outlet_id ? outletLookup[log.outlet_id] ?? log.outlet_id : "-",
    perubahan: log.changes
      .map(
        (c) => `${c.field}: ${renderValue(c.before)} → ${renderValue(c.after)}`,
      )
      .join(" | "),
    catatan: log.notes ?? "",
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        description="Riwayat siapa melakukan apa dan kapan di seluruh backoffice."
        actions={
          <ExportButton
            filename={`audit-log-${new Date().toISOString().slice(0, 10)}`}
            data={csvRows}
          />
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Filter</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <DateRangePicker value={range} onChange={setRange} />
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1">
              <Label className="text-xs">Entity</Label>
              <Select
                value={entity}
                onValueChange={(v) => setEntity(v as AuditEntity | "all")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Aksi</Label>
              <Select
                value={action}
                onValueChange={(v) => setAction(v as AuditAction | "all")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">User</Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua User</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Outlet</Label>
              <Select value={outletId} onValueChange={setOutletId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Outlet</SelectItem>
                  {outlets.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cari</Label>
              <Input
                placeholder="Nama / catatan"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">
            <History className="mr-2 inline h-4 w-4" />
            Log ({logs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Memuat...</p>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Tidak ada log yang cocok dengan filter.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-40">Waktu</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Aksi</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Perubahan</TableHead>
                    <TableHead>Catatan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs tabular">
                        {formatDateTime(log.created_at)}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium">{log.user_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {ROLE_LABEL[log.user_role]}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={ACTION_BADGE[log.action].variant}>
                          {ACTION_BADGE[log.action].label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium">
                          {log.entity_name}
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {log.entity}
                          {log.outlet_id
                            ? ` • ${outletLookup[log.outlet_id] ?? log.outlet_id}`
                            : ""}
                        </p>
                      </TableCell>
                      <TableCell>
                        {log.changes.length === 0 ? (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        ) : (
                          <ul className="space-y-0.5">
                            {log.changes.map((c, idx) => (
                              <li key={idx} className="text-xs">
                                <span className="font-medium">{c.field}</span>
                                <span className="text-muted-foreground">
                                  {": "}
                                  <span className="line-through">
                                    {renderValue(c.before)}
                                  </span>
                                  {" → "}
                                </span>
                                <span className="font-medium">
                                  {renderValue(c.after)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {log.notes ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
