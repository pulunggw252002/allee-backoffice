"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, isValid, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";

// Same defensive parser used in dashboard charts — Recharts can fire
// formatters with empty/undefined input during loading and crash with
// `RangeError: Invalid time value`. Returning null lets the formatter
// render an empty label instead.
function safeParseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value) return null;
  const d = parseISO(value);
  return isValid(d) ? d : null;
}
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatIDR, formatNumber } from "@/lib/format";
import { CHART_HEIGHT } from "@/lib/constants";
import type { VoidDailyPoint } from "@/lib/api/reports";

/**
 * Dual-axis chart: bar = kerugian HPP (Rp), line = jumlah void (count).
 * Kedua metric dipisah axis supaya skala yang berbeda tetap terbaca.
 */
export function VoidSeriesChart({
  data,
  days,
}: {
  data: VoidDailyPoint[];
  days: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Tren Void Harian ({days} Hari)</CardTitle>
      </CardHeader>
      <CardContent className="pl-1">
        <ResponsiveContainer width="100%" height={CHART_HEIGHT.target}>
          <ComposedChart data={data}>
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
              yAxisId="loss"
              tickFormatter={(v) => formatIDR(v, { compact: true })}
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              width={64}
            />
            <YAxis
              yAxisId="count"
              orientation="right"
              tickFormatter={(v) => formatNumber(v)}
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              width={36}
              allowDecimals={false}
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
              formatter={(value: number, name) => {
                if (name === "loss") return [formatIDR(value), "Kerugian"];
                return [formatNumber(value), "Jumlah Void"];
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              formatter={(v) => (v === "loss" ? "Kerugian (Rp)" : "Jumlah Void")}
            />
            <Bar
              yAxisId="loss"
              dataKey="loss"
              name="loss"
              fill="hsl(var(--chart-4))"
              radius={[3, 3, 0, 0]}
            />
            <Line
              yAxisId="count"
              type="monotone"
              dataKey="count"
              name="count"
              stroke="hsl(var(--chart-1))"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
