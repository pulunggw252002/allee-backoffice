"use client";

import { useQuery } from "@tanstack/react-query";
import { outletsApi } from "@/lib/api";
import { useOutletStore } from "@/stores/outlet-store";
import { useAuthStore } from "@/stores/auth-store";
import { isAllOutletsAllowed } from "@/lib/rbac";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Store } from "lucide-react";

const ALL = "__all__";

export function OutletSwitcher() {
  const user = useAuthStore((s) => s.user);
  const selectedId = useOutletStore((s) => s.selectedOutletId);
  const setOutletId = useOutletStore((s) => s.setOutletId);
  const { data: outlets = [] } = useQuery({
    queryKey: ["outlets"],
    queryFn: () => outletsApi.list(),
  });
  const allowAll = isAllOutletsAllowed(user?.role);

  const value = selectedId === null ? ALL : selectedId;

  return (
    <Select
      value={value}
      onValueChange={(v) => setOutletId(v === ALL ? null : v)}
      disabled={!allowAll}
    >
      <SelectTrigger className="h-9 w-[200px]">
        <div className="flex items-center gap-2">
          <Store className="h-3.5 w-3.5" />
          <SelectValue placeholder="Pilih outlet" />
        </div>
      </SelectTrigger>
      <SelectContent>
        {allowAll ? <SelectItem value={ALL}>Semua Outlet</SelectItem> : null}
        {outlets.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
