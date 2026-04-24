"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  ImageIcon,
  Loader2,
  LogIn,
  LogOut,
  Settings,
  User as UserIcon,
} from "lucide-react";
import {
  attendanceApi,
  attendanceSettingsApi,
  outletsApi,
} from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { useOutletStore } from "@/stores/outlet-store";
import { canAccessManagement } from "@/lib/rbac";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { RoleBadge } from "@/components/shared/role-badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AttendanceRecap } from "@/components/attendance/attendance-recap";
import { AttendanceSettingsPanel } from "@/components/attendance/attendance-settings-panel";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import {
  STATION_LABEL,
  stationForRole,
  type Attendance,
  type AttendanceChecklistItem,
} from "@/types";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Gagal membaca file"));
    reader.readAsDataURL(file);
  });
}

function useLiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function ClockCard({ now, cutoff }: { now: Date; cutoff?: string }) {
  const timeStr = format(now, "HH:mm:ss", { locale: idLocale });
  const dateStr = format(now, "EEEE, dd MMMM yyyy", { locale: idLocale });
  const mins = now.getHours() * 60 + now.getMinutes();
  const late = cutoff
    ? (() => {
        const [h, m] = cutoff.split(":").map(Number);
        return mins > h * 60 + m;
      })()
    : false;
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-6">
        <div className="rounded-full bg-primary/10 p-3 text-primary">
          <Clock className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <p className="text-3xl font-semibold tabular-nums tracking-tight">
            {timeStr}
          </p>
          <p className="text-sm capitalize text-muted-foreground">{dateStr}</p>
          {cutoff ? (
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span>
                Batas absen masuk: <strong>{cutoff}</strong>
              </span>
              {late ? (
                <Badge variant="danger" className="px-1.5 py-0 text-[10px]">
                  Terlambat
                </Badge>
              ) : null}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function PhotoField({
  id,
  label,
  hint,
  value,
  onChange,
  capture,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  onChange: (dataUrl: string) => void;
  capture?: "user" | "environment";
}) {
  const [loading, setLoading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      onChange(dataUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membaca foto");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="rounded-lg border bg-muted/30 p-3">
        {value ? (
          <div className="space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt={label}
              className="aspect-video w-full rounded-md object-cover"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Foto siap
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange("")}
              >
                Ganti
              </Button>
            </div>
          </div>
        ) : (
          <label
            htmlFor={id}
            className="flex cursor-pointer flex-col items-center justify-center gap-2 py-8 text-center text-xs text-muted-foreground transition hover:text-foreground"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : capture === "user" ? (
              <Camera className="h-5 w-5" />
            ) : (
              <ImageIcon className="h-5 w-5" />
            )}
            <span className="font-medium">{hint}</span>
            <span>Ketuk untuk pilih / ambil foto</span>
          </label>
        )}
        <input
          id={id}
          type="file"
          accept="image/*"
          capture={capture}
          className="hidden"
          onChange={handleFile}
        />
      </div>
    </div>
  );
}

function ChecklistField({
  items,
  onToggle,
}: {
  items: AttendanceChecklistItem[];
  onToggle: (id: string, done: boolean) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="text-xs italic text-muted-foreground">
        Tidak ada checklist untuk station ini. Owner dapat menambahkannya di
        tab Pengaturan.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <label
          key={item.id}
          htmlFor={item.id}
          className={cn(
            "flex items-start gap-3 rounded-md border bg-card p-3 text-sm transition",
            item.done && "border-primary/40 bg-primary/5",
          )}
        >
          <Checkbox
            id={item.id}
            checked={item.done}
            onCheckedChange={(checked) =>
              onToggle(item.id, checked === true)
            }
            className="mt-0.5"
          />
          <span
            className={cn(
              "flex-1 leading-snug",
              item.done && "text-muted-foreground line-through",
            )}
          >
            {item.label}
          </span>
        </label>
      ))}
    </div>
  );
}

function AttendanceSummaryCard({ attendance }: { attendance: Attendance }) {
  const [preview, setPreview] = useState<{ src: string; label: string } | null>(
    null,
  );

  const doneIn = attendance.before_checklist.filter((c) => c.done).length;
  const totalIn = attendance.before_checklist.length;
  const after = attendance.after_checklist ?? [];
  const doneOut = after.filter((c) => c.done).length;
  const totalOut = after.length;

  const openPreview = (src: string, label: string) =>
    setPreview({ src, label });

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            Absen masuk tercatat
            {attendance.is_late ? (
              <Badge variant="danger" className="ml-1">
                <AlertTriangle className="mr-1 h-3 w-3" /> Terlambat
              </Badge>
            ) : null}
          </CardTitle>
          <CardDescription>
            {formatDateTime(attendance.check_in_at)} ·{" "}
            {STATION_LABEL[attendance.station]}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() =>
                openPreview(attendance.check_in_selfie, "Foto diri — masuk")
              }
              className="group overflow-hidden rounded-md border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={attendance.check_in_selfie}
                alt="Foto diri masuk"
                className="aspect-video w-full object-cover transition group-hover:opacity-90"
              />
              <p className="px-2 py-1 text-xs text-muted-foreground">
                Foto diri
              </p>
            </button>
            <button
              type="button"
              onClick={() =>
                openPreview(
                  attendance.check_in_station_photo,
                  "Foto station — masuk",
                )
              }
              className="group overflow-hidden rounded-md border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={attendance.check_in_station_photo}
                alt="Foto station masuk"
                className="aspect-video w-full object-cover transition group-hover:opacity-90"
              />
              <p className="px-2 py-1 text-xs text-muted-foreground">
                Foto station
              </p>
            </button>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Before opening checklist — {doneIn}/{totalIn}
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              {attendance.before_checklist.map((c) => (
                <li key={c.id} className="flex items-start gap-2">
                  <Checkbox checked={c.done} disabled className="mt-0.5" />
                  <span
                    className={cn(
                      c.done && "text-muted-foreground line-through",
                    )}
                  >
                    {c.label}
                  </span>
                </li>
              ))}
            </ul>
            {attendance.check_in_notes ? (
              <p className="mt-2 rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                Catatan: {attendance.check_in_notes}
              </p>
            ) : null}
          </div>
          {attendance.check_out_at ? (
            <div className="space-y-4 border-t pt-4">
              <div>
                <p className="font-medium">
                  Absen pulang — {formatDateTime(attendance.check_out_at)}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {attendance.check_out_selfie ? (
                  <button
                    type="button"
                    onClick={() =>
                      openPreview(
                        attendance.check_out_selfie!,
                        "Foto diri — pulang",
                      )
                    }
                    className="group overflow-hidden rounded-md border"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={attendance.check_out_selfie}
                      alt="Foto diri pulang"
                      className="aspect-video w-full object-cover transition group-hover:opacity-90"
                    />
                    <p className="px-2 py-1 text-xs text-muted-foreground">
                      Foto diri
                    </p>
                  </button>
                ) : null}
                {attendance.check_out_station_photo ? (
                  <button
                    type="button"
                    onClick={() =>
                      openPreview(
                        attendance.check_out_station_photo!,
                        "Foto station — pulang",
                      )
                    }
                    className="group overflow-hidden rounded-md border"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={attendance.check_out_station_photo}
                      alt="Foto station pulang"
                      className="aspect-video w-full object-cover transition group-hover:opacity-90"
                    />
                    <p className="px-2 py-1 text-xs text-muted-foreground">
                      Foto station
                    </p>
                  </button>
                ) : null}
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  After closing checklist — {doneOut}/{totalOut}
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {after.map((c) => (
                    <li key={c.id} className="flex items-start gap-2">
                      <Checkbox checked={c.done} disabled className="mt-0.5" />
                      <span
                        className={cn(
                          c.done && "text-muted-foreground line-through",
                        )}
                      >
                        {c.label}
                      </span>
                    </li>
                  ))}
                </ul>
                {attendance.check_out_notes ? (
                  <p className="mt-2 rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                    Catatan: {attendance.check_out_notes}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
      <Dialog
        open={preview !== null}
        onOpenChange={(open) => !open && setPreview(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{preview?.label}</DialogTitle>
            <DialogDescription>Tap di luar untuk menutup.</DialogDescription>
          </DialogHeader>
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview.src}
              alt={preview.label}
              className="w-full rounded-md"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function SelfAttendancePanel() {
  const user = useAuthStore((s) => s.user);
  const selectedOutletId = useOutletStore((s) => s.selectedOutletId);
  const qc = useQueryClient();
  const now = useLiveClock();
  const date = todayStr();

  const station = user ? stationForRole(user.role) : "management";
  const effectiveOutletId = user?.outlet_id ?? selectedOutletId ?? null;

  const { data: settings } = useQuery({
    queryKey: ["attendanceSettings"],
    queryFn: () => attendanceSettingsApi.get(),
  });

  const { data: attendanceToday, isLoading } = useQuery({
    queryKey: ["attendance", "today", user?.id, date],
    queryFn: () => attendanceApi.getToday(user!.id, date),
    enabled: !!user,
  });

  const { data: outlets = [] } = useQuery({
    queryKey: ["outlets"],
    queryFn: () => outletsApi.list(),
  });

  const [inSelfie, setInSelfie] = useState("");
  const [inStationPhoto, setInStationPhoto] = useState("");
  const [inChecklist, setInChecklist] = useState<AttendanceChecklistItem[]>([]);
  const [inNotes, setInNotes] = useState("");

  const [outSelfie, setOutSelfie] = useState("");
  const [outStationPhoto, setOutStationPhoto] = useState("");
  const [outChecklist, setOutChecklist] = useState<AttendanceChecklistItem[]>(
    [],
  );
  const [outNotes, setOutNotes] = useState("");

  useEffect(() => {
    if (!attendanceToday && user) {
      setInChecklist(attendanceApi.buildBeforeChecklist(station));
    }
  }, [attendanceToday, user, station]);

  useEffect(() => {
    if (attendanceToday && !attendanceToday.check_out_at) {
      setOutChecklist(attendanceApi.buildAfterChecklist(station));
    }
  }, [attendanceToday, station]);

  const checkInMutation = useMutation({
    mutationFn: () => {
      if (!user) throw new Error("User tidak ditemukan");
      if (!effectiveOutletId)
        throw new Error("Outlet belum dipilih — hubungi Owner.");
      if (!inSelfie) throw new Error("Foto diri wajib diisi");
      if (!inStationPhoto) throw new Error("Foto station wajib diisi");
      return attendanceApi.checkIn({
        user_id: user.id,
        user_name: user.name,
        user_role: user.role,
        outlet_id: effectiveOutletId,
        selfie: inSelfie,
        station_photo: inStationPhoto,
        checklist: inChecklist,
        notes: inNotes.trim() || undefined,
      });
    },
    onSuccess: (record) => {
      if (record.is_late) {
        toast.warning("Absen tercatat, tapi kamu TERLAMBAT", {
          description: `Batas absen ${settings?.check_in_cutoff ?? ""}`,
        });
      } else {
        toast.success("Absen masuk berhasil");
      }
      setInSelfie("");
      setInStationPhoto("");
      setInNotes("");
      qc.invalidateQueries({ queryKey: ["attendance"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Gagal absen masuk");
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: () => {
      if (!attendanceToday) throw new Error("Belum ada absen masuk hari ini");
      if (!outSelfie) throw new Error("Foto diri wajib diisi");
      if (!outStationPhoto) throw new Error("Foto station wajib diisi");
      return attendanceApi.checkOut({
        id: attendanceToday.id,
        selfie: outSelfie,
        station_photo: outStationPhoto,
        checklist: outChecklist,
        notes: outNotes.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Absen pulang berhasil");
      setOutSelfie("");
      setOutStationPhoto("");
      setOutNotes("");
      qc.invalidateQueries({ queryKey: ["attendance"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Gagal absen pulang");
    },
  });

  const outletName = useMemo(() => {
    const match = outlets.find((o) => o.id === effectiveOutletId);
    return match?.name ?? "—";
  }, [outlets, effectiveOutletId]);

  if (!user) return null;

  const inChecklistDone = inChecklist.filter((c) => c.done).length;
  const outChecklistDone = outChecklist.filter((c) => c.done).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <ClockCard now={now} cutoff={settings?.check_in_cutoff} />
        <Card>
          <CardContent className="flex items-center gap-4 py-6">
            <div className="rounded-full bg-muted p-3">
              <UserIcon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">
                Pekerja
              </p>
              <p className="font-medium">{user.name}</p>
              <div className="mt-1 flex items-center gap-2">
                <RoleBadge role={user.role} />
                <span className="text-xs text-muted-foreground">
                  · {STATION_LABEL[station]}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-6">
            <div className="rounded-full bg-muted p-3">
              <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Outlet</p>
              <p className="font-medium">{outletName}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {attendanceToday
                  ? attendanceToday.check_out_at
                    ? "Shift selesai"
                    : "Sedang bekerja"
                  : "Belum absen"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memuat…
          </CardContent>
        </Card>
      ) : attendanceToday ? (
        <div className="space-y-6">
          <AttendanceSummaryCard attendance={attendanceToday} />
          {!attendanceToday.check_out_at ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LogOut className="h-5 w-5" /> Absen pulang
                </CardTitle>
                <CardDescription>
                  Lengkapi after closing checklist lalu upload foto penutup.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <PhotoField
                    id="out-selfie"
                    label="Foto diri"
                    hint="Selfie sebelum pulang"
                    value={outSelfie}
                    onChange={setOutSelfie}
                    capture="user"
                  />
                  <PhotoField
                    id="out-station"
                    label="Foto station"
                    hint="Kondisi station saat tutup"
                    value={outStationPhoto}
                    onChange={setOutStationPhoto}
                    capture="environment"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>After closing checklist</Label>
                    <Badge variant="secondary">
                      {outChecklistDone}/{outChecklist.length}
                    </Badge>
                  </div>
                  <ChecklistField
                    items={outChecklist}
                    onToggle={(id, done) =>
                      setOutChecklist((prev) =>
                        prev.map((c) => (c.id === id ? { ...c, done } : c)),
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="out-notes">Catatan (opsional)</Label>
                  <Textarea
                    id="out-notes"
                    value={outNotes}
                    onChange={(e) => setOutNotes(e.target.value)}
                    placeholder="Kendala atau catatan untuk shift berikutnya"
                    rows={3}
                  />
                </div>
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => checkOutMutation.mutate()}
                  disabled={checkOutMutation.isPending}
                >
                  {checkOutMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Mengirim…
                    </>
                  ) : (
                    <>
                      <LogOut className="mr-2 h-4 w-4" /> Absen pulang sekarang
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LogIn className="h-5 w-5" /> Absen masuk
            </CardTitle>
            <CardDescription>
              Upload foto diri & station, isi before opening checklist untuk
              station {STATION_LABEL[station]}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {!effectiveOutletId ? (
              <EmptyState
                icon={ClipboardCheck}
                title="Outlet belum terpasang"
                description="Akun kamu belum terhubung ke outlet. Hubungi Owner atau Kepala Toko."
              />
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <PhotoField
                    id="in-selfie"
                    label="Foto diri"
                    hint="Selfie saat datang"
                    value={inSelfie}
                    onChange={setInSelfie}
                    capture="user"
                  />
                  <PhotoField
                    id="in-station"
                    label="Foto station"
                    hint="Kondisi station sebelum buka"
                    value={inStationPhoto}
                    onChange={setInStationPhoto}
                    capture="environment"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Before opening checklist</Label>
                    <Badge variant="secondary">
                      {inChecklistDone}/{inChecklist.length}
                    </Badge>
                  </div>
                  <ChecklistField
                    items={inChecklist}
                    onToggle={(id, done) =>
                      setInChecklist((prev) =>
                        prev.map((c) => (c.id === id ? { ...c, done } : c)),
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="in-notes">Catatan (opsional)</Label>
                  <Textarea
                    id="in-notes"
                    value={inNotes}
                    onChange={(e) => setInNotes(e.target.value)}
                    placeholder="Contoh: mesin espresso butuh maintenance"
                    rows={3}
                  />
                </div>
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => checkInMutation.mutate()}
                  disabled={checkInMutation.isPending}
                >
                  {checkInMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Mengirim…
                    </>
                  ) : (
                    <>
                      <LogIn className="mr-2 h-4 w-4" /> Absen masuk sekarang
                    </>
                  )}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function AttendancePage() {
  const user = useAuthStore((s) => s.user);

  if (!user) return null;

  const canManage = canAccessManagement(user.role);
  const isOwner = user.role === "owner";

  if (!canManage) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Absensi"
          description="Waktu mengikuti jam online saat kamu submit. Lengkapi foto dan checklist station."
        />
        <SelfAttendancePanel />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Absensi"
        description="Kelola absensi tim, lihat rekap, dan atur checklist per station."
      />
      <Tabs defaultValue="self" className="space-y-4">
        <TabsList>
          <TabsTrigger value="self">
            <UserIcon className="mr-2 h-4 w-4" /> Absen Saya
          </TabsTrigger>
          <TabsTrigger value="recap">
            <ClipboardCheck className="mr-2 h-4 w-4" /> Rekap
          </TabsTrigger>
          {isOwner ? (
            <TabsTrigger value="settings">
              <Settings className="mr-2 h-4 w-4" /> Pengaturan
            </TabsTrigger>
          ) : null}
        </TabsList>
        <TabsContent value="self">
          <SelfAttendancePanel />
        </TabsContent>
        <TabsContent value="recap">
          <AttendanceRecap />
        </TabsContent>
        {isOwner ? (
          <TabsContent value="settings">
            <AttendanceSettingsPanel />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
