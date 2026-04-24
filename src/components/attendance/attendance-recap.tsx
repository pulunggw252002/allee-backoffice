"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { attendanceApi, outletsApi } from "@/lib/api";
import { EmptyState } from "@/components/shared/empty-state";
import { RoleBadge } from "@/components/shared/role-badge";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { STATION_LABEL, type Station } from "@/types";
import { cn } from "@/lib/utils";

function toDateStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function durationMinutes(a: string, b: string): number {
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000));
}

function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return `${h}j ${m}m`;
}

const STATION_OPTIONS: Array<{ value: "all" | Station; label: string }> = [
  { value: "all", label: "Semua station" },
  { value: "bar", label: STATION_LABEL.bar },
  { value: "kitchen", label: STATION_LABEL.kitchen },
  { value: "cashier", label: STATION_LABEL.cashier },
  { value: "service", label: STATION_LABEL.service },
  { value: "management", label: STATION_LABEL.management },
];

export function AttendanceRecap() {
  const [start, setStart] = useState(() => toDateStr(-6));
  const [end, setEnd] = useState(() => toDateStr(0));
  const [stationFilter, setStationFilter] = useState<"all" | Station>("all");
  const [outletFilter, setOutletFilter] = useState<string>("all");

  const { data: outlets = [] } = useQuery({
    queryKey: ["outlets"],
    queryFn: () => outletsApi.list(),
  });

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["attendance", "recap", start, end],
    queryFn: () =>
      attendanceApi.list({
        start: `${start}T00:00:00`,
        end: `${end}T23:59:59`,
      }),
  });

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (stationFilter !== "all" && r.station !== stationFilter) return false;
      if (outletFilter !== "all" && r.outlet_id !== outletFilter) return false;
      return true;
    });
  }, [records, stationFilter, outletFilter]);

  const totalCheckIn = filtered.length;
  const totalLate = filtered.filter((r) => r.is_late).length;
  const totalOpen = filtered.filter((r) => !r.check_out_at).length;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 py-5">
            <div className="rounded-full bg-emerald-500/10 p-3 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">
                Total absen masuk
              </p>
              <p className="text-2xl font-semibold tabular-nums">
                {totalCheckIn}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-5">
            <div className="rounded-full bg-red-500/10 p-3 text-red-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">
                Terlambat
              </p>
              <p className="text-2xl font-semibold tabular-nums">
                {totalLate}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-5">
            <div className="rounded-full bg-amber-500/10 p-3 text-amber-600">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">
                Belum pulang
              </p>
              <p className="text-2xl font-semibold tabular-nums">
                {totalOpen}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filter rekap</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="start">Dari tanggal</Label>
              <Input
                id="start"
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end">Sampai tanggal</Label>
              <Input
                id="end"
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Station</Label>
              <Select
                value={stationFilter}
                onValueChange={(v) => setStationFilter(v as "all" | Station)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATION_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Outlet</Label>
              <Select value={outletFilter} onValueChange={setOutletFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua outlet</SelectItem>
                  {outlets.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Rekap absen ({filtered.length} data)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Memuat…</p>
          ) : filtered.length === 0 ? (
            <EmptyState
              title="Belum ada data absen"
              description="Coba perlebar rentang tanggal atau ubah filter."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>Station</TableHead>
                    <TableHead>Outlet</TableHead>
                    <TableHead>Masuk</TableHead>
                    <TableHead>Pulang</TableHead>
                    <TableHead>Durasi</TableHead>
                    <TableHead className="text-right">Checklist</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const outletName =
                      outlets.find((o) => o.id === r.outlet_id)?.name ?? "—";
                    const beforeDone = r.before_checklist.filter(
                      (c) => c.done,
                    ).length;
                    const beforeTotal = r.before_checklist.length;
                    const after = r.after_checklist ?? [];
                    const afterDone = after.filter((c) => c.done).length;
                    const afterTotal = after.length;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="tabular-nums">
                          {format(new Date(r.check_in_at), "dd/MM", {
                            locale: idLocale,
                          })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 font-medium">
                            <span>{r.user_name}</span>
                            <RoleBadge role={r.user_role} />
                          </div>
                        </TableCell>
                        <TableCell>{STATION_LABEL[r.station]}</TableCell>
                        <TableCell>{outletName}</TableCell>
                        <TableCell
                          className={cn(
                            "tabular-nums",
                            r.is_late && "font-medium text-red-600",
                          )}
                        >
                          <div className="flex items-center gap-1.5">
                            {format(new Date(r.check_in_at), "HH:mm")}
                            {r.is_late ? (
                              <Badge variant="danger" className="px-1.5 py-0 text-[10px]">
                                Terlambat
                              </Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {r.check_out_at ? (
                            format(new Date(r.check_out_at), "HH:mm")
                          ) : (
                            <Badge variant="secondary">Bekerja</Badge>
                          )}
                        </TableCell>
                        <TableCell className="tabular-nums text-xs text-muted-foreground">
                          {r.check_out_at
                            ? formatDuration(
                                durationMinutes(
                                  r.check_in_at,
                                  r.check_out_at,
                                ),
                              )
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          Masuk {beforeDone}/{beforeTotal}
                          {r.check_out_at ? (
                            <>
                              {" "}
                              · Pulang {afterDone}/{afterTotal}
                            </>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
