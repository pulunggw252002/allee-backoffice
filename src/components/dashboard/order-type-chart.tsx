"use client";

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatIDR } from "@/lib/format";
import { CHART_COLORS, CHART_HEIGHT, ORDER_TYPE_LABEL } from "@/lib/constants";
import type { OrderTypeRow } from "@/lib/api/reports";

export function OrderTypeChart({ data }: { data: OrderTypeRow[] }) {
  const total = data.reduce((s, r) => s + r.amount, 0);
  const rows = data.map((r) => ({
    name: ORDER_TYPE_LABEL[r.type],
    amount: r.amount,
    count: r.count,
    type: r.type,
  }));
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-sm">Jenis Penjualan</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada transaksi.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 items-center">
            <ResponsiveContainer width="100%" height={CHART_HEIGHT.pie}>
              <PieChart>
                <Pie
                  data={rows}
                  dataKey="amount"
                  nameKey="name"
                  innerRadius={42}
                  outerRadius={72}
                  paddingAngle={2}
                >
                  {rows.map((_, i) => (
                    <Cell
                      key={i}
                      fill={CHART_COLORS[i % CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value: number) => formatIDR(value)}
                />
              </PieChart>
            </ResponsiveContainer>
            <ul className="space-y-2 text-xs">
              {rows.map((r, i) => {
                const pct = total > 0 ? (r.amount / total) * 100 : 0;
                return (
                  <li key={r.type} className="flex items-start gap-2">
                    <span
                      className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                      style={{
                        background: CHART_COLORS[i % CHART_COLORS.length],
                      }}
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{r.name}</span>
                        <span className="tabular">{pct.toFixed(1)}%</span>
                      </div>
                      <p className="text-muted-foreground tabular">
                        {formatIDR(r.amount, { compact: true })} · {r.count} tx
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
