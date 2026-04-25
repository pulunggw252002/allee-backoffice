"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { outletsApi, usersApi } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { canAccessManagement, isAllOutletsAllowed } from "@/lib/rbac";
import type { Role, User } from "@/types";
import { ROLE_LABEL } from "@/types";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { RoleBadge } from "@/components/shared/role-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { KeyRound, Plus, Pencil, Trash2, Users as UsersIcon, Search, Loader2 } from "lucide-react";

// ─── POS PIN dialog ───────────────────────────────────────────────────────

/**
 * Owner-only dialog to set / rotate / clear a staff member's 4-6 digit
 * numeric PIN used to log in to the POS app. The PIN is separate from the
 * backoffice password — it is validated by the POS app, not Better Auth.
 */
function PosPinDialog({
  user,
  trigger,
}: {
  user: User;
  trigger: React.ReactNode;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const hasExistingPin = !!user.pos_pin;

  // Always clear the PIN inputs when the dialog opens — prior digits left
  // in memory from a previous open would be an obvious security footgun
  // (someone glancing at the Owner's screen could read the PIN).
  useEffect(() => {
    if (open) {
      setPin("");
      setConfirmPin("");
    }
  }, [open]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!/^\d{4,6}$/.test(pin)) throw new Error("PIN harus 4-6 digit angka");
      if (pin !== confirmPin) throw new Error("Konfirmasi PIN tidak cocok");
      return usersApi.setPosPin(user.id, pin);
    },
    onSuccess: () => {
      toast.success(`PIN POS untuk ${user.name} disimpan`);
      qc.invalidateQueries({ queryKey: ["users"] });
      setOpen(false);
      setPin("");
      setConfirmPin("");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan PIN"),
  });

  const clearMutation = useMutation({
    mutationFn: async () => usersApi.setPosPin(user.id, null),
    onSuccess: () => {
      toast.success(`PIN POS untuk ${user.name} dihapus`);
      qc.invalidateQueries({ queryKey: ["users"] });
      setOpen(false);
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Gagal hapus PIN"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>PIN POS — {user.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            PIN digunakan {user.name} untuk login ke aplikasi POS di outlet.
            PIN berbeda dengan password backoffice. Gunakan 4-6 digit angka.
          </p>
          <div className="space-y-2">
            <Label>PIN Baru</Label>
            <Input
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={pin}
              onChange={(e) =>
                setPin(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="4-6 digit angka"
            />
          </div>
          <div className="space-y-2">
            <Label>Konfirmasi PIN</Label>
            <Input
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={confirmPin}
              onChange={(e) =>
                setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="Ulangi PIN"
            />
          </div>
          {hasExistingPin ? (
            <p className="rounded-md bg-amber-500/10 px-2 py-1 text-xs text-amber-700 dark:text-amber-300">
              User sudah memiliki PIN. Menyimpan akan menggantinya.
            </p>
          ) : null}
        </div>
        <DialogFooter className="gap-2 sm:flex-row-reverse sm:justify-start">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || clearMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            Simpan
          </Button>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Batal
          </Button>
          {hasExistingPin ? (
            <Button
              variant="ghost"
              className="text-destructive sm:mr-auto"
              onClick={() => {
                if (confirm(`Hapus PIN POS untuk ${user.name}?`)) {
                  clearMutation.mutate();
                }
              }}
              disabled={clearMutation.isPending}
            >
              Hapus PIN
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UserDialog({
  trigger,
  initial,
}: {
  trigger: React.ReactNode;
  initial?: User;
}) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { data: outlets = [] } = useQuery({
    queryKey: ["outlets"],
    queryFn: () => outletsApi.list(),
  });

  const [name, setName] = useState(initial?.name ?? "");
  // Edit mode never pre-fills the password — the API masks the hash, and
  // even if it didn't, leaving the field blank doubles as "leave password
  // unchanged". Only on Create is it required.
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>(initial?.role ?? "kasir");
  const [outletId, setOutletId] = useState<string | null>(
    initial?.outlet_id ?? null,
  );
  const [contact, setContact] = useState(initial?.contact ?? "");
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);

  const isEdit = Boolean(initial);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Nama wajib diisi");
      if (!isEdit && !password.trim())
        throw new Error("Password wajib diisi");
      if (password && password.length < 4)
        throw new Error("Password minimal 4 karakter");
      if (!isAllOutletsAllowed(role) && !outletId) throw new Error("Pilih outlet");
      // On edit, omit the password key entirely if blank so the backend
      // keeps the existing hash. Sending an empty string would fail Zod's
      // `min(4)` validation.
      const basePayload = {
        name: name.trim(),
        role,
        outlet_id: isAllOutletsAllowed(role) ? null : outletId,
        contact: contact || undefined,
        is_active: isActive,
      };
      if (isEdit) {
        return usersApi.update(
          initial!.id,
          password ? { ...basePayload, password } : basePayload,
        );
      }
      return usersApi.create({ ...basePayload, password });
    },
    onSuccess: () => {
      toast.success(initial ? "User diperbarui" : "User ditambahkan");
      qc.invalidateQueries({ queryKey: ["users"] });
      setOpen(false);
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan");
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Edit User" : "Tambah User"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Nama (unik, digunakan untuk login)</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama depan atau nama panggilan"
            />
          </div>
          <div className="space-y-2">
            <Label>
              Password
              {isEdit && (
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  (kosongkan jika tidak diubah)
                </span>
              )}
            </Label>
            <Input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isEdit ? "Biarkan kosong = password lama tetap" : "Minimal 4 karakter"}
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground">
              Password di-hash (scrypt) di server. Login pakai nama + password ini.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={role}
                onValueChange={(v) => {
                  setRole(v as Role);
                  if (v === "owner") setOutletId(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!isAllOutletsAllowed(role) ? (
              <div className="space-y-2">
                <Label>Outlet</Label>
                <Select
                  value={outletId ?? ""}
                  onValueChange={(v) => setOutletId(v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih outlet" />
                  </SelectTrigger>
                  <SelectContent>
                    {outlets.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Akses Outlet</Label>
                <div className="flex h-10 items-center rounded-md border border-dashed px-3 text-sm text-muted-foreground">
                  Semua outlet
                </div>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Kontak (opsional)</Label>
            <Input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Nomor HP atau email"
            />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Aktif</p>
              <p className="text-xs text-muted-foreground">
                User non-aktif tidak dapat login.
              </p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            Batal
          </Button>
          <Button
            type="button"
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

export default function UsersPage() {
  const me = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => usersApi.list(),
  });
  const { data: outlets = [] } = useQuery({
    queryKey: ["outlets"],
    queryFn: () => outletsApi.list(),
  });

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (query && !u.name.toLowerCase().includes(query.toLowerCase()))
        return false;
      return true;
    });
  }, [users, query, roleFilter]);

  const removeMutation = useMutation({
    mutationFn: (id: string) => usersApi.remove(id),
    onSuccess: () => {
      toast.success("User dinonaktifkan");
      qc.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const backofficeCount = users.filter(
    (u) => canAccessManagement(u.role) && u.is_active,
  ).length;
  const posCount = users.filter(
    (u) => !canAccessManagement(u.role) && u.is_active,
  ).length;
  // Staff (non-management) yang sudah punya PIN POS — siap login ke
  // aplikasi POS. Digunakan untuk KPI "POS ready".
  const posReadyCount = users.filter(
    (u) => !canAccessManagement(u.role) && u.is_active && !!u.pos_pin,
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        description="Kelola user POS & backoffice. Owner, Kepala Toko dapat login di backoffice; role lain hanya akses POS."
        actions={
          <UserDialog
            trigger={
              <Button>
                <Plus className="h-4 w-4" /> Tambah User
              </Button>
            }
          />
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Total User</p>
            <p className="mt-1 text-2xl font-semibold tabular">{users.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">
              Akses Backoffice
            </p>
            <p className="mt-1 text-2xl font-semibold tabular">
              {backofficeCount}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Owner & Kepala Toko
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Akses POS</p>
            <p className="mt-1 text-2xl font-semibold tabular">{posCount}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Kasir/Kitchen/Barista/Waiters
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">
              PIN POS Aktif
            </p>
            <p className="mt-1 text-2xl font-semibold tabular">
              {posReadyCount}
              <span className="ml-1 text-sm text-muted-foreground">
                / {posCount}
              </span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Staf siap login ke POS
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama user…"
            className="pl-9"
          />
        </div>
        <Select
          value={roleFilter}
          onValueChange={(v) => setRoleFilter(v as Role | "all")}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Role</SelectItem>
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_LABEL[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Memuat user…
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title="Tidak ada user"
          description="Ubah filter atau tambah user baru."
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Outlet</TableHead>
                <TableHead>Kontak</TableHead>
                <TableHead>PIN POS</TableHead>
                <TableHead>Bergabung</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-36" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => {
                const outlet = outlets.find((o) => o.id === u.outlet_id);
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-2 font-medium">
                        <span>{u.name}</span>
                        {me?.id === u.id ? (
                          <Badge variant="outline">Anda</Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <RoleBadge role={u.role} />
                    </TableCell>
                    <TableCell className="text-xs">
                      {isAllOutletsAllowed(u.role)
                        ? "Semua outlet"
                        : (outlet?.name ?? "-")}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {u.contact ?? "-"}
                    </TableCell>
                    <TableCell>
                      {u.pos_pin ? (
                        <Badge variant="success">Aktif</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Belum diset
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground tabular">
                      {u.joined_at}
                    </TableCell>
                    <TableCell>
                      {u.is_active ? (
                        <Badge variant="success">Aktif</Badge>
                      ) : (
                        <Badge variant="secondary">Nonaktif</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <PosPinDialog
                          user={u}
                          trigger={
                            <Button
                              variant="ghost"
                              size="icon"
                              title={
                                u.pos_pin
                                  ? "Ubah / Hapus PIN POS"
                                  : "Set PIN POS"
                              }
                            >
                              <KeyRound className="h-3.5 w-3.5" />
                            </Button>
                          }
                        />
                        <UserDialog
                          initial={u}
                          trigger={
                            <Button variant="ghost" size="icon">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={me?.id === u.id}
                          onClick={() => {
                            if (confirm(`Nonaktifkan "${u.name}"?`))
                              removeMutation.mutate(u.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
