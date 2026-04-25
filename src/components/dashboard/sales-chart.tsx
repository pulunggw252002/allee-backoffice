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
import type {
  DailySeriesPoint,
  HourlySeriesPoint,
} from "@/lib/api/reports";
import { formatIDR } from "@/lib/format";
import { CHART_HEIGHT } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Safe-parse a YYYY-MM-DD (or full ISO) string into a Date.
 *
 * Recharts' Tooltip can fire `labelFormatter` with `undefined`/empty input
 * during transient loading or hover-near-edge states. `parseISO("")` returns
 * an Invalid Date which then makes `format()` throw `RangeError: Invalid
 * time value`. Returning `null` lets callers fall back to a literal label
 * instead of crashing the chart.
 */
function safeParseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value) return null;
  const d = parseISO(value);
  return isValid(d) ? d : null;
}

/**
 * Polymorphic sales trend chart.
 *
 *  - `mode="day"` (default): X-axis is calendar dates, one tick per day.
 *    Used for 7d / 30d / month-to-date windows. `data[].date` is YYYY-MM-DD.
 *  - `mode="hour"`: X-axis is hour-of-day (00:00..23:00). Used when the
 *    operator picks a single-day range so the chart isn't a single dot —
 *    it shows the within-day distribution. `data[].hour` is 0..23.
 *
 * Same visual treatment (revenue area + profit area) in both modes.
 */
type DayProps = {
  mode?: "day";
  data: DailySeriesPoint[];
  /** Title hint, e.g. "7 Hari" or specific date range. */
  windowLabel: string;
};

type HourProps = {
  mode: "hour";
  data: HourlySeriesPoint[];
  /** Title hint, usually the date being inspected. */
  windowLabel: string;
};

export function SalesChart(props: DayProps | HourProps) {
  const isHour = props.mode === "hour";
  const data = props.data as Array<DailySeriesPoint | HourlySeriesPoint>;
  const xKey = isHour ? "hour" : "date";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">
          Tren Penjualan {props.windowLabel}
        </CardTitle>
      </CardHeader>
      <CardContent className="pl-1">
        <ResponsiveContainer width="100%" height={CHART_HEIGHT.trend}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="revenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.5} />
                <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="profit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--chart-2))" stopOpacity={0.5} />
                <stop offset="100%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey={xKey}
              tickFormatter={(v) => {
                if (isHour) {
                  const h = Number(v);
                  return Number.isFinite(h)
                    ? `${String(h).padStart(2, "0")}:00`
                    : "";
                }
                const d = safeParseDate(v);
                return d ? format(d, "dd/MM", { locale: idLocale }) : "";
              }}
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              interval="preserveStartEnd"
              minTickGap={isHour ? 24 : 18}
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
                if (isHour) {
                  const h = Number(v);
                  if (!Number.isFinite(h)) return "";
                  return `Jam ${String(h).padStart(2, "0")}:00–${String(
                    (h + 1) % 24,
                  ).padStart(2, "0")}:00`;
                }
                const d = safeParseDate(v);
                return d
                  ? format(d, "dd MMM yyyy", { locale: idLocale })
                  : String(v ?? "");
              }}
              formatter={(value: number, name) => [
                formatIDR(value),
                name === "revenue" ? "Revenue" : "Profit",
              ]}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="hsl(var(--chart-1))"
              strokeWidth={2}
              fill="url(#revenue)"
            />
            <Area
              type="monotone"
              dataKey="profit"
              stroke="hsl(var(--chart-2))"
              strokeWidth={2}
              fill="url(#profit)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
