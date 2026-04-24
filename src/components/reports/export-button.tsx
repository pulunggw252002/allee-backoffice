"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return "";
  const keys = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n"))
      return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const header = keys.join(",");
  const body = rows.map((r) => keys.map((k) => escape(r[k])).join(","));
  return [header, ...body].join("\n");
}

export function ExportButton<T extends Record<string, unknown>>({
  data,
  filename,
  disabled,
}: {
  data: T[];
  filename: string;
  disabled?: boolean;
}) {
  const handleClick = () => {
    const csv = toCsv(data);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Button
      variant="outline"
      onClick={handleClick}
      disabled={disabled || data.length === 0}
    >
      <Download className="h-4 w-4" /> Export CSV
    </Button>
  );
}
