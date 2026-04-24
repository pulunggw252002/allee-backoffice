"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuthStore } from "@/stores/auth-store";
import { useOutletStore } from "@/stores/outlet-store";
import { usersApi } from "@/lib/api";
import { canAccessBackoffice, defaultLandingForRole } from "@/lib/rbac";
import { DEMO_USER_PASSWORD } from "@/lib/mock/seed";
import { toast } from "sonner";
import { Coffee, Loader2 } from "lucide-react";
import { RoleBadge } from "@/components/shared/role-badge";

const DEMO = [
  { name: "Budi", role: "Owner", description: "Full access, semua outlet" },
  { name: "Andi", role: "Kepala Toko", description: "Outlet ALLEE Dago" },
  { name: "Dewi Barista", role: "Barista", description: "Absen + lihat resep minuman" },
  { name: "Joni Kitchen", role: "Kitchen", description: "Absen + lihat resep makanan" },
  { name: "Rudi Kasir", role: "Kasir", description: "Absen only" },
  { name: "Mira Waiters", role: "Waiters", description: "Absen only" },
];

export default function LoginPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const setUser = useAuthStore((s) => s.setUser);
  const setOutletId = useOutletStore((s) => s.setOutletId);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await usersApi.authenticate(name, password);
      if (!user) {
        toast.error("Nama atau password salah");
        return;
      }
      if (!canAccessBackoffice(user.role)) {
        toast.error("Role ini tidak punya akses", {
          description: "Hubungi Owner untuk memastikan akses Anda.",
        });
        return;
      }
      setUser(user);
      setOutletId(user.outlet_id);
      toast.success(`Selamat datang, ${user.name}`);
      router.push(defaultLandingForRole(user.role));
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (n: string) => {
    setName(n);
    setPassword(DEMO_USER_PASSWORD);
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl items-center px-4 py-10">
      <div className="grid w-full gap-8 lg:grid-cols-2">
        <div className="hidden flex-col justify-between rounded-2xl border bg-card p-10 lg:flex">
          <div>
            <div className="inline-flex items-center gap-2 rounded-md border px-3 py-1 text-xs font-medium">
              <Coffee className="h-3.5 w-3.5" />
              ALLEE BACKOFFICE
            </div>
            <h2 className="mt-6 text-3xl font-semibold leading-tight tracking-tight">
              Kontrol penuh operasional F&B Anda — dari satu cockpit.
            </h2>
            <p className="mt-4 text-sm text-muted-foreground">
              Kelola menu berbasis resep, stok bahan multi-outlet, staff, dan
              laporan profit real-time. Semua perubahan langsung tersinkron ke
              aplikasi POS di lapangan.
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-6 pt-8">
            <div>
              <dt className="text-xs uppercase text-muted-foreground">Outlet</dt>
              <dd className="mt-1 text-2xl font-semibold">2</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-muted-foreground">Menu aktif</dt>
              <dd className="mt-1 text-2xl font-semibold">10</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-muted-foreground">Role</dt>
              <dd className="mt-1 text-2xl font-semibold">6</dd>
            </div>
          </dl>
        </div>
        <div className="flex items-center">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Masuk ke Backoffice</CardTitle>
              <CardDescription>
                Gunakan nama dan password yang didaftarkan oleh Owner.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nama</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="contoh: Budi"
                    autoComplete="username"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Memproses
                    </>
                  ) : (
                    "Masuk"
                  )}
                </Button>
              </form>
              <div className="rounded-lg border bg-muted/40 p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Akun demo (klik untuk isi otomatis · password:{" "}
                  <code className="rounded bg-background px-1">
                    {DEMO_USER_PASSWORD}
                  </code>
                  )
                </p>
                <div className="mt-2 grid gap-1.5">
                  {DEMO.map((d) => (
                    <button
                      key={d.name}
                      type="button"
                      onClick={() => fillDemo(d.name)}
                      className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-left text-xs transition hover:bg-accent"
                    >
                      <div>
                        <p className="font-medium">{d.name}</p>
                        <p className="text-muted-foreground">{d.description}</p>
                      </div>
                      <RoleBadge
                        role={
                          d.role === "Owner"
                            ? "owner"
                            : d.role === "Kepala Toko"
                              ? "kepala_toko"
                              : d.role === "Barista"
                                ? "barista"
                                : d.role === "Kitchen"
                                  ? "kitchen"
                                  : d.role === "Waiters"
                                    ? "waiters"
                                    : "kasir"
                        }
                      />
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
