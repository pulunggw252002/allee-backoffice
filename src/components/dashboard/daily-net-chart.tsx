"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, isValid, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatIDR } from "@/lib/format";
import { CHART_HEIGHT } from "@/lib/constants";
import type { DailySeriesPoint } from "@/lib/api/reports";

// Safe-parse so Recharts' Tooltip + tick formatters don't crash with
// `RangeError: Invalid time value` when data is loading or contains an
// unexpected non-ISO label.
function safeParseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value) return null;
  const d = parseISO(value);
  return isValid(d) ? d : null;
}

export function DailyNetChart({
  data,
  days,
}: {
  data: DailySeriesPoint[];
  days: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">
          Penjualan Bersih Harian ({days} Hari)
        </CardTitle>
      </CardHeader>
      <CardContent className="pl-1">
        <ResponsiveContainer width="100%" height={CHART_HEIGHT.trend}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="daily-net" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="hsl(var(--chart-5))"
                  stopOpacity={0.5}
                />
                <stop
                  offset="100%"
                  stopColor="hsl(var(--chart-5))"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="date"
              tickFormatter={(v) => {
                const d = safeParseDate(v);
                return d ? format(d, "dd/MM", { locale: idLocale }) : "";
              }}
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              interval={Math.max(0, Math.floor(days / 10))}
            />
            <YAxis
              tickFormatter={(v) => formatIDR(v, { compact: true })}
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              width={60}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelFormatter={(v) => {
                const d = safeParseDate(v);
                return d
                  ? format(d, "dd MMM yyyy", { locale: idLocale })
                  : String(v ?? "");
              }}
              formatter={(value: number) => [formatIDR(value), "Net Sales"]}
            />
            <Area
              type="monotone"
              dataKey="net_sales"
              stroke="hsl(var(--chart-5))"
              strokeWidth={2}
              fill="url(#daily-net)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
