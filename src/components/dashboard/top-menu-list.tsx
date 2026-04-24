import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TopMenuRow } from "@/lib/api/reports";
import { formatIDR } from "@/lib/format";
import {
  DASHBOARD_MENU_LIST_LIMIT,
  DASHBOARD_WINDOW_DAYS,
} from "@/lib/constants";

export function TopMenuList({
  data,
  limit = DASHBOARD_MENU_LIST_LIMIT,
  days = DASHBOARD_WINDOW_DAYS,
}: {
  data: TopMenuRow[];
  limit?: number;
  days?: number;
}) {
  const max = data[0]?.quantity ?? 1;
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-sm">
          Top {limit} Menu Terlaris ({days} Hari)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada transaksi.</p>
        ) : (
          data.map((row, idx) => (
            <div key={row.menu_id} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">
                  #{idx + 1} {row.name}
                </span>
                <span className="text-muted-foreground tabular">
                  {row.quantity} porsi · {formatIDR(row.revenue, { compact: true })}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(row.quantity / max) * 100}%` }}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
