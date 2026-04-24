"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { menusApi } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { MenuForm } from "@/components/menu/menu-form";
import { Card, CardContent } from "@/components/ui/card";
import { useAuthStore } from "@/stores/auth-store";
import { canViewCosts } from "@/lib/rbac";

export default function EditMenuPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const user = useAuthStore((s) => s.user);
  const isOwner = canViewCosts(user?.role);

  const { data, isLoading } = useQuery({
    queryKey: ["menus", id],
    queryFn: () => menusApi.get(id),
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-sm text-muted-foreground">
          Memuat menu…
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-sm text-muted-foreground">
          Menu tidak ditemukan.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit: ${data.name}`}
        description={
          isOwner
            ? `SKU ${data.sku} · Ubah resep, harga, atau add-on menu ini.`
            : `SKU ${data.sku} · Detail menu hanya dapat dilihat. Perubahan resep/harga dilakukan oleh Owner.`
        }
      />
      <MenuForm initial={data} />
    </div>
  );
}
