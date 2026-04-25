"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface DateRange {
  start: string;
  end: string;
}

export function toRange(preset: string): DateRange {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const endIso = today.toISOString();
  const start = new Date(today);
  if (preset === "today") {
    start.setHours(0, 0, 0, 0);
  } else if (preset === "7d") {
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  } else if (preset === "30d") {
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
  } else if (preset === "mtd") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  }
  return { start: start.toISOString(), end: endIso };
}

export function DateRangePicker({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (v: DateRange) => void;
}) {
  const [preset, setPreset] = useState("7d");

  const handlePreset = (p: string) => {
    setPreset(p);
    if (p !== "custom") onChange(toRange(p));
  };

  const handleCustom = (key: "start" | "end", dateStr: string) => {
    setPreset("custom");
    if (!dateStr) return;
    // `new Date("YYYY-MM-DD")` di-parse sebagai UTC midnight — di timezone
    // negatif (US) ini menggeser calendar day mundur sehari. Force parsing
    // sebagai local time dengan menambah "T00:00:00", lalu setHours kalibrasi
    // ulang. Indonesia UTC+7 tidak terpengaruh, tapi defensive supaya laporan
    // tetap benar kalau backoffice diakses dari luar negeri.
    const d = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(d.getTime())) return;
    if (key === "end") d.setHours(23, 59, 59, 999);
    else d.setHours(0, 0, 0, 0);
    onChange({ ...value, [key]: d.toISOString() });
  };

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end">
      <div className="space-y-1">
        <Label className="text-xs">Periode</Label>
        <Select value={preset} onValueChange={handlePreset}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Hari ini</SelectItem>
            <SelectItem value="7d">7 hari terakhir</SelectItem>
            <SelectItem value="30d">30 hari terakhir</SelectItem>
            <SelectItem value="mtd">Bulan ini</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Mulai</Label>
        <Input
          type="date"
          value={value.start.slice(0, 10)}
          onChange={(e) => handleCustom("start", e.target.value)}
          className="w-[160px]"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Selesai</Label>
        <Input
          type="date"
          value={value.end.slice(0, 10)}
          onChange={(e) => handleCustom("end", e.target.value)}
          className="w-[160px]"
        />
      </div>
    </div>
  );
}
