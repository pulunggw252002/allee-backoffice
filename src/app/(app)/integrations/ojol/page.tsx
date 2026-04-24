"use client";

/**
 * Integrasi Ojol — per-outlet × per-platform menu sync dashboard.
 *
 * Tiga area utama:
 *  1. Kartu channel (GoFood / GrabFood / ShopeeFood) per outlet — status
 *     koneksi, auto-sync, tombol "Sync Sekarang".
 *  2. Tabel listing menu per platform — harga override + ketersediaan.
 *  3. Riwayat sync terbaru.
 */

import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  menusApi,
  ojolApi,
  outletsApi,
} from "@/lib/api";
import { useOutletStore } from "@/stores/outlet-store";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Check,
  Loader2,
  Pencil,
  Plug,
  RefreshCw,
  X,
} from "lucide-react";
import type {
  MenuChannelListing,
  OjolChannel,
  OjolPlatform,
  OjolSyncLog,
} from "@/types";
import { OJOL_PLATFORM_LABEL } from "@/types";
import { formatDateTime, formatIDR } from "@/lib/format";

const PLATFORMS: OjolPlatform[] = ["gofood", "grabfood", "shopeefood"];

const PLATFORM_COLOR: Record<OjolPlatform, string> = {
  gofood: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  grabfood: "bg-green-600/10 text-green-700 dark:text-green-300",
  shopeefood: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
};

// ─── Channel config dialog ────────────────────────────────────────────────

function ChannelConfigDialog({
  channel,
  trigger,
}: {
  channel: OjolChannel;
  trigger: React.ReactNode;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [storeName, setStoreName] = useState(channel.store_name);
  const [merchantId, setMerchantId] = useState(channel.merchant_id);
  const [apiKey, setApiKey] = useState("");
  const [isConnected, setIsConnected] = useState(channel.is_connected);
  const [autoSync, setAutoSync] = useState(channel.auto_sync);
  const [notes, setNotes] = useState(channel.notes ?? "");

  // Reset local form state whenever the dialog opens so the user always sees
  // the latest server values (and the api_key field is blank by design —
  // the real secret lives server-side). Without this, stale values from a
  // previous open would linger after a background refetch updates `channel`.
  useEffect(() => {
    if (!open) return;
    setStoreName(channel.store_name);
    setMerchantId(channel.merchant_id);
    setApiKey("");
    setIsConnected(channel.is_connected);
    setAutoSync(channel.auto_sync);
    setNotes(channel.notes ?? "");
  }, [open, channel]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Guardrail: you can't mark a channel as "Terhubung" without credentials
      // — the first sync attempt would fail anyway and leave a confusing
      // state. Validate merchant_id + api_key (either newly typed or already
      // stored server-side) before calling the backend.
      if (isConnected) {
        if (!merchantId.trim()) {
          throw new Error("Merchant ID wajib diisi untuk menghubungkan channel");
        }
        if (!apiKey && !channel.api_key) {
          throw new Error("API key wajib diisi untuk menghubungkan channel");
        }
      }
      return ojolApi.updateChannel(channel.id, {
        store_name: storeName,
        merchant_id: merchantId,
        // Only send api_key if the operator actually typed a new one —
        // empty string means "leave as-is" here (server would overwrite).
        ...(apiKey ? { api_key: apiKey } : {}),
        is_connected: isConnected,
        auto_sync: autoSync,
        notes: notes || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Konfigurasi channel disimpan");
      qc.invalidateQueries({ queryKey: ["ojol", "channels"] });
      setOpen(false);
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Konfigurasi {OJOL_PLATFORM_LABEL[channel.platform]}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Nama Toko di Platform</Label>
            <Input
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="Contoh: ALLEE Dago"
            />
          </div>
          <div className="space-y-2">
            <Label>Merchant ID</Label>
            <Input
              value={merchantId}
              onChange={(e) => setMerchantId(e.target.value)}
              placeholder="ID dari dashboard merchant"
            />
          </div>
          <div className="space-y-2">
            <Label>API Key / Secret</Label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                channel.api_key
                  ? "Kosongkan untuk tidak mengubah"
                  : "Tempelkan API key"
              }
            />
            <p className="text-xs text-muted-foreground">
              Key disimpan server-side. Frontend hanya melihat 4 karakter terakhir.
            </p>
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Channel Terhubung</p>
              <p className="text-xs text-muted-foreground">
                Matikan sementara jika merchant akun sedang suspend.
              </p>
            </div>
            <Switch checked={isConnected} onCheckedChange={setIsConnected} />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3 opacity-60">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">Auto-sync</p>
                <Badge variant="outline">Segera Hadir</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Perubahan menu/harga dari backoffice otomatis di-push ke platform.
                Fitur belum aktif — sync masih manual.
              </p>
            </div>
            <Switch checked={autoSync} onCheckedChange={setAutoSync} disabled />
          </div>
          <div className="space-y-2">
            <Label>Catatan (opsional)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan internal"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Batal
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Listing edit dialog ──────────────────────────────────────────────────

function ListingEditDialog({
  listing,
  basePrice,
  menuName,
  trigger,
}: {
  listing: MenuChannelListing;
  basePrice: number;
  menuName: string;
  trigger: React.ReactNode;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [useOverride, setUseOverride] = useState(listing.price_override !== null);
  const [price, setPrice] = useState<number>(listing.price_override ?? basePrice);
  const [isAvailable, setIsAvailable] = useState(listing.is_available);

  // Re-sync local state with the server copy when the dialog reopens. Without
  // this, editing → saving → reopening would show the previously typed value
  // even if a background refetch has a newer truth.
  useEffect(() => {
    if (!open) return;
    setUseOverride(listing.price_override !== null);
    setPrice(listing.price_override ?? basePrice);
    setIsAvailable(listing.is_available);
  }, [open, listing, basePrice]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (useOverride) {
        if (!Number.isFinite(price) || price < 0) {
          throw new Error("Harga harus angka ≥ 0");
        }
      }
      return ojolApi.updateListing(listing.id, {
        price_override: useOverride ? price : null,
        is_available: isAvailable,
      });
    },
    onSuccess: () => {
      toast.success("Listing disimpan (status: pending sync)");
      qc.invalidateQueries({ queryKey: ["ojol", "listings"] });
      setOpen(false);
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {menuName} — {OJOL_PLATFORM_LABEL[listing.platform]}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <p className="text-xs text-muted-foreground">Harga POS</p>
            <p className="font-semibold tabular">{formatIDR(basePrice)}</p>
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Override Harga</p>
              <p className="text-xs text-muted-foreground">
                Aktif: kirim harga khusus ke platform. Non-aktif: ikut harga POS.
              </p>
            </div>
            <Switch checked={useOverride} onCheckedChange={setUseOverride} />
          </div>
          {useOverride ? (
            <div className="space-y-2">
              <Label>Harga di Platform (IDR)</Label>
              <Input
                type="number"
                min={0}
                step={500}
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Tips: naikkan ~15-25% untuk menutup komisi ojol.
              </p>
            </div>
          ) : null}
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Tersedia di Platform</p>
              <p className="text-xs text-muted-foreground">
                Matikan untuk sembunyikan item tanpa mengubah POS.
              </p>
            </div>
            <Switch checked={isAvailable} onCheckedChange={setIsAvailable} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Batal
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Channel card ─────────────────────────────────────────────────────────

function ChannelCard({
  channel,
  pendingCount,
}: {
  channel: OjolChannel;
  pendingCount: number;
}) {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge className={PLATFORM_COLOR[channel.platform]}>
              {OJOL_PLATFORM_LABEL[channel.platform]}
            </Badge>
            {channel.is_connected ? (
              <Badge variant="success">
                <Check className="h-3 w-3" /> Terhubung
              </Badge>
            ) : (
              <Badge variant="secondary">
                <X className="h-3 w-3" /> Belum terhubung
              </Badge>
            )}
          </div>
          <ChannelConfigDialog
            channel={channel}
            trigger={
              <Button variant="ghost" size="icon">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            }
          />
        </div>
        <div>
          <p className="text-sm font-medium">{channel.store_name || "—"}</p>
          <p className="text-xs text-muted-foreground">
            {channel.merchant_id
              ? `Merchant: ${channel.merchant_id}`
              : "Merchant ID belum diisi"}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md border p-2">
            <p className="text-muted-foreground">Auto-sync</p>
            <p className="font-medium">{channel.auto_sync ? "Aktif" : "Non-aktif"}</p>
          </div>
          <div className="rounded-md border p-2">
            <p className="text-muted-foreground">Sync Terakhir</p>
            <p className="font-medium">
              {channel.last_sync_at
                ? formatDistanceToNow(new Date(channel.last_sync_at), {
                    addSuffix: true,
                    locale: localeId,
                  })
                : "Belum pernah"}
            </p>
          </div>
        </div>
        {pendingCount > 0 ? (
          <p className="rounded-md bg-amber-500/10 px-2 py-1 text-xs text-amber-700 dark:text-amber-300">
            {pendingCount} item menunggu sync
          </p>
        ) : null}
        {/*
         * Sync action sengaja di-block sampai integrasi marketplace API jadi.
         * Channel config + listing override masih bisa di-edit manual; tombol
         * di-disable & diberi label supaya operator tahu fitur belum siap.
         */}
        <Button
          className="w-full"
          variant="outline"
          disabled
          title="Fitur sync ke platform belum tersedia"
        >
          <RefreshCw className="h-4 w-4" />
          Sync Sekarang
          <Badge variant="outline" className="ml-2">
            Segera Hadir
          </Badge>
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────

export default function OjolIntegrationPage() {
  const selectedOutlet = useOutletStore((s) => s.selectedOutletId);
  const qc = useQueryClient();
  const [activePlatform, setActivePlatform] = useState<OjolPlatform>("gofood");

  const { data: outlets = [] } = useQuery({
    queryKey: ["outlets"],
    queryFn: () => outletsApi.list(),
  });

  // If "All outlets" is selected, fall back to the first outlet — ojol
  // sync is inherently per-outlet so we need a concrete target.
  const outletId =
    selectedOutlet ?? (outlets[0]?.id as string | undefined) ?? null;
  const outlet = outlets.find((o) => o.id === outletId);

  const { data: channels = [] } = useQuery({
    queryKey: ["ojol", "channels", outletId],
    queryFn: () =>
      outletId ? ojolApi.listChannels({ outlet_id: outletId }) : [],
    enabled: !!outletId,
  });
  const { data: listings = [] } = useQuery({
    queryKey: ["ojol", "listings"],
    queryFn: () => ojolApi.listListings(),
  });
  const { data: menus = [] } = useQuery({
    queryKey: ["menus", outletId],
    queryFn: () => menusApi.list({ outlet_id: outletId }),
  });
  const { data: syncLogs = [] } = useQuery<OjolSyncLog[]>({
    queryKey: ["ojol", "sync-logs", outletId],
    queryFn: () =>
      outletId
        ? ojolApi.listSyncLogs({ outlet_id: outletId, limit: 20 })
        : Promise.resolve([] as OjolSyncLog[]),
    enabled: !!outletId,
  });

  // Sync ke platform marketplace masih dimatikan — lihat ChannelCard. Setelah
  // integrasi API GoFood/GrabFood/ShopeeFood siap, balikkan `useMutation` di
  // sini dan teruskan ke `<ChannelCard onSync={...} isSyncing={...} />`.

  const pendingByPlatform = useMemo(() => {
    const map: Record<OjolPlatform, number> = {
      gofood: 0,
      grabfood: 0,
      shopeefood: 0,
    };
    const activeMenuIds = new Set(
      menus.filter((m) => m.is_active).map((m) => m.id),
    );
    for (const l of listings) {
      if (!activeMenuIds.has(l.menu_id)) continue;
      if (l.sync_status !== "synced") map[l.platform] += 1;
    }
    return map;
  }, [listings, menus]);

  const platformListings = useMemo(() => {
    const activeMenus = menus.filter((m) => m.is_active);
    return activeMenus
      .map((m) => {
        const listing = listings.find(
          (l) => l.menu_id === m.id && l.platform === activePlatform,
        );
        return { menu: m, listing };
      })
      .filter((r) => r.listing !== undefined) as Array<{
      menu: (typeof menus)[number];
      listing: MenuChannelListing;
    }>;
  }, [menus, listings, activePlatform]);

  if (!outletId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Integrasi Ojol"
          description="Sinkronisasi menu ke GoFood, GrabFood, dan ShopeeFood."
        />
        <EmptyState
          icon={Plug}
          title="Belum ada outlet"
          description="Tambahkan outlet terlebih dahulu sebelum menghubungkan marketplace."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrasi Ojol"
        description={
          outlet
            ? `Sinkronisasi menu ${outlet.name} ke GoFood, GrabFood, dan ShopeeFood. Pilih outlet di header untuk beralih.`
            : "Sinkronisasi menu ke GoFood, GrabFood, dan ShopeeFood."
        }
      />

      <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
        <span className="font-medium">Segera Hadir:</span> sync otomatis ke
        GoFood/GrabFood/ShopeeFood masih dalam pengembangan. Konfigurasi
        channel dan harga override sudah bisa di-edit; perubahan akan
        ter-push setelah integrasi API marketplace tersedia.
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {PLATFORMS.map((p) => {
          const ch = channels.find((c) => c.platform === p);
          if (!ch) return null;
          return (
            <ChannelCard
              key={p}
              channel={ch}
              pendingCount={pendingByPlatform[p]}
            />
          );
        })}
      </div>

      <div>
        <Tabs
          value={activePlatform}
          onValueChange={(v) => setActivePlatform(v as OjolPlatform)}
        >
          <TabsList>
            {PLATFORMS.map((p) => (
              <TabsTrigger key={p} value={p}>
                {OJOL_PLATFORM_LABEL[p]}
                {pendingByPlatform[p] > 0 ? (
                  <Badge variant="outline" className="ml-2">
                    {pendingByPlatform[p]}
                  </Badge>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>
          {PLATFORMS.map((p) => (
            <TabsContent key={p} value={p} className="mt-4">
              {platformListings.length === 0 ? (
                <EmptyState
                  icon={Plug}
                  title="Tidak ada menu aktif untuk outlet ini"
                  description="Aktifkan menu dari halaman Menu atau tambahkan menu baru."
                />
              ) : (
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Menu</TableHead>
                        <TableHead className="text-right">Harga POS</TableHead>
                        <TableHead className="text-right">
                          Harga {OJOL_PLATFORM_LABEL[p]}
                        </TableHead>
                        <TableHead>Ketersediaan</TableHead>
                        <TableHead>Status Sync</TableHead>
                        <TableHead className="w-12" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {platformListings.map(({ menu, listing }) => (
                        <TableRow key={listing.id}>
                          <TableCell>
                            <p className="font-medium">{menu.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {menu.sku}
                            </p>
                          </TableCell>
                          <TableCell className="text-right tabular">
                            {formatIDR(menu.price)}
                          </TableCell>
                          <TableCell className="text-right tabular">
                            {listing.price_override === null ? (
                              <span className="text-muted-foreground">
                                {formatIDR(menu.price)}
                              </span>
                            ) : (
                              <span className="font-medium">
                                {formatIDR(listing.price_override)}
                                {listing.price_override !== menu.price ? (
                                  <span className="ml-1 text-xs text-muted-foreground">
                                    (
                                    {listing.price_override > menu.price
                                      ? "+"
                                      : ""}
                                    {Math.round(
                                      ((listing.price_override - menu.price) /
                                        menu.price) *
                                        100,
                                    )}
                                    %)
                                  </span>
                                ) : null}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {listing.is_available ? (
                              <Badge variant="success">Tersedia</Badge>
                            ) : (
                              <Badge variant="secondary">Disembunyikan</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {listing.sync_status === "synced" ? (
                              <Badge variant="success">Synced</Badge>
                            ) : listing.sync_status === "pending" ? (
                              <Badge variant="outline">Pending</Badge>
                            ) : (
                              <Badge variant="destructive">Gagal</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <ListingEditDialog
                              listing={listing}
                              basePrice={menu.price}
                              menuName={menu.name}
                              trigger={
                                <Button variant="ghost" size="icon">
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              }
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">
          Riwayat Sync
        </h2>
        {syncLogs.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Belum ada riwayat sync. Klik &quot;Sync Sekarang&quot; di kartu
              platform di atas.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Waktu</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Oleh</TableHead>
                  <TableHead className="text-right">Item</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {syncLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="tabular text-xs">
                      {formatDateTime(log.started_at)}
                    </TableCell>
                    <TableCell>
                      <Badge className={PLATFORM_COLOR[log.platform]}>
                        {OJOL_PLATFORM_LABEL[log.platform]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {log.triggered_by_name}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular">
                      {log.items_synced}/{log.items_total}
                      {log.items_failed > 0 ? (
                        <span className="ml-1 text-destructive">
                          ({log.items_failed} gagal)
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {log.status === "success" ? (
                        <Badge variant="success">Sukses</Badge>
                      ) : log.status === "partial" ? (
                        <Badge variant="outline">Partial</Badge>
                      ) : log.status === "failed" ? (
                        <Badge variant="destructive">Gagal</Badge>
                      ) : (
                        <Badge variant="outline">Running</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  );
}
