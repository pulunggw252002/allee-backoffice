"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatIDR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CHART_HEIGHT } from "@/lib/constants";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { YearComparisonResult } from "@/lib/api/reports";

export function MonthComparisonChart({
  data,
}: {
  data: YearComparisonResult;
}) {
  const delta = data.delta_percent;
  const trend =
    delta > 0.5 ? "up" : delta < -0.5 ? "down" : "flat";

  const TrendIcon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  const trendClass =
    trend === "up"
      ? "text-emerald-600 dark:text-emerald-400"
      : trend === "down"
        ? "text-red-600 dark:text-red-400"
        : "text-muted-foreground";

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-sm">
              Perbandingan Bulanan (Tahun Ini vs Tahun Lalu)
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {data.previous_year} vs {data.current_year} · Net sales per bulan
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex items-center gap-1 text-sm font-semibold tabular",
                trendClass,
              )}
            >
              <TrendIcon className="h-4 w-4" />
              {delta > 0 ? "+" : ""}
              {delta.toFixed(1)}%
            </div>
            <Badge variant="secondary" className="text-[10px]">
              YoY
            </Badge>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-md border p-2">
            <p className="text-muted-foreground">Total {data.previous_year}</p>
            <p className="mt-1 font-semibold tabular">
              {formatIDR(data.total_previous)}
            </p>
          </div>
          <div className="rounded-md border p-2">
            <p className="text-muted-foreground">Total {data.current_year}</p>
            <p className="mt-1 font-semibold tabular">
              {formatIDR(data.total_current)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pl-1">
        <ResponsiveContainer width="100%" height={CHART_HEIGHT.comparison}>
          <BarChart
            data={data.months}
            barCategoryGap="20%"
            barGap={4}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="label"
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
            />
            <YAxis
              tickFormatter={(v) => formatIDR(v, { compact: true })}
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              width={64}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelFormatter={(l) => `Bulan ${l}`}
              formatter={(value: number, name) => [
                formatIDR(value),
                name === "current"
                  ? String(data.current_year)
                  : String(data.previous_year),
              ]}
            />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              formatter={(value) =>
                value === "current"
                  ? String(data.current_year)
                  : String(data.previous_year)
              }
            />
            <Bar
              dataKey="previous"
              name="previous"
              fill="hsl(var(--chart-4))"
              radius={[3, 3, 0, 0]}
            />
            <Bar
              dataKey="current"
              name="current"
              fill="hsl(var(--chart-1))"
              radius={[3, 3, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
