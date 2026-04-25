import { Plug } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * Integration hub landing — fitur masih dalam pengembangan. Sidebar entry
 * sudah di-lock (lihat `nav-config.ts` `comingSoon: true`), tapi route
 * tetap dipertahankan supaya kalau ada yang akses URL langsung tetap
 * mendapat halaman "Segera Hadir" yang konsisten alih-alih 404.
 *
 * Sub-route `/integrations/ojol` masih hidup untuk pra-konfigurasi
 * channel & listing override — sync action di sana juga sudah di-block.
 */
export default function IntegrationsIndex() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrasi"
        description="Sinkronisasi menu & order ke marketplace ojol dan kanal eksternal lainnya."
      />
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-300">
            <Plug className="h-6 w-6" />
          </div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Fitur Integrasi</h2>
            <Badge variant="outline">Segera Hadir</Badge>
          </div>
          <p className="max-w-md text-sm text-muted-foreground">
            Integrasi otomatis ke GoFood, GrabFood, ShopeeFood, dan kanal
            marketplace lain sedang dalam pengembangan. Konfigurasi channel
            & harga override akan tersedia begitu integrasi API marketplace
            siap.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
