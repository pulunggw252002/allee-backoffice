"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import {
  attendanceSettingsApi,
  checklistsApi,
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  STATION_LABEL,
  type ChecklistTemplate,
  type ChecklistType,
  type Station,
} from "@/types";

const STATIONS: Station[] = [
  "bar",
  "kitchen",
  "cashier",
  "service",
  "management",
];

function ChecklistEditor({
  station,
  type,
  items,
}: {
  station: Station;
  type: ChecklistType;
  items: ChecklistTemplate[];
}) {
  const qc = useQueryClient();
  const [newLabel, setNewLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["checklistTemplates"] });

  const createMutation = useMutation({
    mutationFn: () =>
      checklistsApi.create({ station, type, label: newLabel }),
    onSuccess: () => {
      toast.success("Checklist ditambahkan");
      setNewLabel("");
      invalidate();
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Gagal menambah"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, label }: { id: string; label: string }) =>
      checklistsApi.update(id, { label }),
    onSuccess: () => {
      toast.success("Checklist diperbarui");
      setEditingId(null);
      invalidate();
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Gagal memperbarui"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => checklistsApi.remove(id),
    onSuccess: () => {
      toast.success("Checklist dihapus");
      invalidate();
    },
  });

  const ordered = [...items].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="space-y-3">
      {ordered.length === 0 ? (
        <p className="rounded-md border border-dashed bg-muted/30 p-4 text-center text-xs italic text-muted-foreground">
          Belum ada checklist. Tambahkan item di bawah.
        </p>
      ) : (
        <ul className="space-y-2">
          {ordered.map((it, idx) => (
            <li
              key={it.id}
              className="flex items-center gap-2 rounded-md border bg-card p-2"
            >
              <span className="w-5 shrink-0 text-center text-xs text-muted-foreground">
                {idx + 1}.
              </span>
              {editingId === it.id ? (
                <>
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="h-8 flex-1"
                    autoFocus
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      updateMutation.mutate({ id: it.id, label: editValue })
                    }
                    disabled={updateMutation.isPending}
                  >
                    <Check className="h-4 w-4 text-emerald-600" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => setEditingId(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm">{it.label}</span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setEditingId(it.id);
                      setEditValue(it.label);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Hapus "${it.label}"?`)) {
                        deleteMutation.mutate(it.id);
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-600" />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Tambah item checklist…"
          onKeyDown={(e) => {
            if (e.key === "Enter" && newLabel.trim()) {
              e.preventDefault();
              createMutation.mutate();
            }
          }}
        />
        <Button
          type="button"
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending || !newLabel.trim()}
        >
          <Plus className="h-4 w-4" /> Tambah
        </Button>
      </div>
    </div>
  );
}

function StationChecklistCard({
  station,
  templates,
}: {
  station: Station;
  templates: ChecklistTemplate[];
}) {
  const before = templates.filter(
    (c) => c.station === station && c.type === "before",
  );
  const after = templates.filter(
    (c) => c.station === station && c.type === "after",
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Station: {STATION_LABEL[station]}
        </CardTitle>
        <CardDescription>
          Checklist yang tampil untuk pekerja di station ini saat absen.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="before" className="w-full">
          <TabsList>
            <TabsTrigger value="before">
              Sebelum buka
              <Badge variant="secondary" className="ml-2">
                {before.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="after">
              Sesudah tutup
              <Badge variant="secondary" className="ml-2">
                {after.length}
              </Badge>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="before" className="mt-4">
            <ChecklistEditor
              station={station}
              type="before"
              items={before}
            />
          </TabsContent>
          <TabsContent value="after" className="mt-4">
            <ChecklistEditor station={station} type="after" items={after} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function CutoffCard() {
  const qc = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ["attendanceSettings"],
    queryFn: () => attendanceSettingsApi.get(),
  });
  const [value, setValue] = useState("");

  useEffect(() => {
    if (settings) setValue(settings.check_in_cutoff);
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: () =>
      attendanceSettingsApi.update({ check_in_cutoff: value }),
    onSuccess: () => {
      toast.success("Batas jam absen diperbarui");
      qc.invalidateQueries({ queryKey: ["attendanceSettings"] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan"),
  });

  const isDirty = settings && value !== settings.check_in_cutoff;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Batas jam absen masuk</CardTitle>
        <CardDescription>
          Pekerja yang absen setelah jam ini akan ditandai{" "}
          <strong>terlambat</strong> di rekap.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="cutoff">Jam maksimal (HH:mm)</Label>
            <Input
              id="cutoff"
              type="time"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-40"
            />
          </div>
          <Button
            type="button"
            onClick={() => updateMutation.mutate()}
            disabled={!isDirty || updateMutation.isPending || !value}
          >
            <Save className="h-4 w-4" /> Simpan
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function AttendanceSettingsPanel() {
  const { data: templates = [] } = useQuery({
    queryKey: ["checklistTemplates"],
    queryFn: () => checklistsApi.list(),
  });

  const [activeStation, setActiveStation] = useState<Station>("bar");

  const stationCounts = useMemo(() => {
    const counts: Record<Station, number> = {
      bar: 0,
      kitchen: 0,
      cashier: 0,
      service: 0,
      management: 0,
    };
    for (const t of templates) counts[t.station] += 1;
    return counts;
  }, [templates]);

  return (
    <div className="space-y-4">
      <CutoffCard />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Checklist per station</CardTitle>
          <CardDescription>
            Atur item checklist yang wajib diisi saat absen masuk & pulang per
            station.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs
            value={activeStation}
            onValueChange={(v) => setActiveStation(v as Station)}
          >
            <TabsList className="flex-wrap h-auto">
              {STATIONS.map((s) => (
                <TabsTrigger key={s} value={s}>
                  {STATION_LABEL[s]}
                  <Badge variant="secondary" className="ml-2">
                    {stationCounts[s]}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>
            {STATIONS.map((s) => (
              <TabsContent key={s} value={s} className="mt-4">
                <StationChecklistCard station={s} templates={templates} />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
