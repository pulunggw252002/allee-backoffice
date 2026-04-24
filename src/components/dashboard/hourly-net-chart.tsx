"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
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
import { formatIDR } from "@/lib/format";
import { CHART_HEIGHT } from "@/lib/constants";
import type { HourlyNetPoint } from "@/lib/api/reports";

export function HourlyNetChart({ data }: { data: HourlyNetPoint[] }) {
  const rows = data.map((d) => ({
    ...d,
    label: `${String(d.hour).padStart(2, "0")}:00`,
  }));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Penjualan Bersih per Jam</CardTitle>
      </CardHeader>
      <CardContent className="pl-1">
        <ResponsiveContainer width="100%" height={CHART_HEIGHT.bars}>
          <BarChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="label"
              stroke="hsl(var(--muted-foreground))"
              fontSize={10}
              interval={2}
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
              formatter={(value: number, _name, props) => [
                formatIDR(value),
                `${props.payload.transaction_count} transaksi`,
              ]}
              labelFormatter={(l) => `Jam ${l}`}
            />
            <Bar
              dataKey="net_sales"
              fill="hsl(var(--chart-4))"
              radius={[3, 3, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
