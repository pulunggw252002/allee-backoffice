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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatIDR } from "@/lib/format";
import { CHART_HEIGHT, MONTH_SHORT_LABELS_ID } from "@/lib/constants";
import type { MonthlyTargetActual } from "@/lib/api/reports";

export function MonthlyTargetChart({
  data,
  year,
  years,
  onYearChange,
}: {
  data: MonthlyTargetActual[];
  year: number;
  years: number[];
  onYearChange: (year: number) => void;
}) {
  const rows = data.map((d) => ({
    month: MONTH_SHORT_LABELS_ID[d.month - 1],
    target: d.target,
    actual: d.actual,
  }));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Target vs Aktual (Bulanan)</CardTitle>
          <Select
            value={String(year)}
            onValueChange={(v) => onYearChange(Number(v))}
          >
            <SelectTrigger className="h-8 w-[110px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="pl-1">
        <ResponsiveContainer width="100%" height={CHART_HEIGHT.target}>
          <ComposedChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="month"
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
              formatter={(value: number, name) => [
                formatIDR(value),
                name === "target" ? "Target" : "Aktual",
              ]}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar
              dataKey="target"
              name="Target"
              fill="hsl(var(--chart-3))"
              radius={[4, 4, 0, 0]}
              opacity={0.6}
            />
            <Line
              type="monotone"
              dataKey="actual"
              name="Aktual"
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
