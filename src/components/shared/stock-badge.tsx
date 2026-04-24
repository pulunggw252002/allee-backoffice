import { Badge } from "@/components/ui/badge";

export function StockBadge({
  current,
  min,
}: {
  current: number;
  min: number;
}) {
  if (current <= min) {
    return <Badge variant="danger">Kritis</Badge>;
  }
  if (current <= min * 1.5) {
    return <Badge variant="warning">Rendah</Badge>;
  }
  return <Badge variant="success">Aman</Badge>;
}
