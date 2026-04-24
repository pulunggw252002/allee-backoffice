import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { LowStockItem } from "@/lib/api/reports";
import { formatNumber } from "@/lib/format";
import { DASHBOARD_LOW_STOCK_LIMIT } from "@/lib/constants";
import { AlertTriangle } from "lucide-react";

export function LowStockPanel({
  items,
  limit = DASHBOARD_LOW_STOCK_LIMIT,
}: {
  items: LowStockItem[];
  limit?: number;
}) {
  const visible = items.slice(0, limit);
  const hidden = Math.max(0, items.length - visible.length);
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Peringatan Stok Rendah</CardTitle>
          <Badge variant={items.length > 0 ? "danger" : "success"}>
            {items.length} item
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Semua bahan dalam kondisi aman.
          </p>
        ) : (
          <ul className="space-y-2">
            {visible.map((item) => (
              <li
                key={item.ingredient_id}
                className="flex items-center justify-between rounded-md border p-2 text-xs"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle
                    className={
                      item.severity === "critical"
                        ? "h-3.5 w-3.5 text-red-500"
                        : "h-3.5 w-3.5 text-amber-500"
                    }
                  />
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-muted-foreground">{item.outlet_name}</p>
                  </div>
                </div>
                <div className="text-right tabular">
                  <p className="font-medium">
                    {formatNumber(item.current_stock)} {item.unit}
                  </p>
                  <p className="text-muted-foreground">
                    min {formatNumber(item.min_qty)} {item.unit}
                  </p>
                </div>
              </li>
            ))}
            {hidden > 0 ? (
              <li className="pt-1 text-center text-[11px] text-muted-foreground">
                +{hidden} bahan lainnya
              </li>
            ) : null}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
