import { Badge } from "@/components/ui/badge";
import { ROLE_LABEL, type Role } from "@/types";

export function RoleBadge({ role }: { role: Role }) {
  const variant: Record<Role, "default" | "secondary" | "outline"> = {
    owner: "default",
    kepala_toko: "secondary",
    kasir: "outline",
    kitchen: "outline",
    barista: "outline",
    waiters: "outline",
  };
  return <Badge variant={variant[role]}>{ROLE_LABEL[role]}</Badge>;
}
