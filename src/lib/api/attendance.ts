import { appendAudit, getDb, mutate } from "@/lib/mock/db";
import { uid } from "@/lib/utils";
import { config } from "@/lib/config";
import {
  stationForRole,
  type Attendance,
  type AttendanceChecklistItem,
  type Role,
  type Station,
} from "@/types";
import { delay } from "./_latency";
import { http } from "./http";
import { qs } from "./_qs";

function buildChecklistFromDb(
  station: Station,
  type: "before" | "after",
): AttendanceChecklistItem[] {
  const db = getDb();
  const prefix = type === "before" ? "bc" : "ac";
  return db.checklist_templates
    .filter((c) => c.station === station && c.type === type)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((c, idx) => ({ id: `${prefix}-${idx}-${c.id}`, label: c.label, done: false }));
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export interface AttendanceFilters {
  user_id?: string | null;
  outlet_id?: string | null;
  date?: string;
  start?: string;
  end?: string;
}

export async function list(filters: AttendanceFilters = {}): Promise<Attendance[]> {
  if (config.api.useRealBackend) {
    return http.get<Attendance[]>(`/api/attendance${qs(filters)}`);
  }
  const db = getDb();
  const startMs = filters.start ? new Date(filters.start).getTime() : null;
  const endMs = filters.end ? new Date(filters.end).getTime() : null;
  const items = db.attendances.filter((a) => {
    if (filters.user_id && a.user_id !== filters.user_id) return false;
    if (filters.outlet_id && a.outlet_id !== filters.outlet_id) return false;
    if (filters.date && a.date !== filters.date) return false;
    if (startMs !== null || endMs !== null) {
      const t = new Date(a.check_in_at).getTime();
      if (startMs !== null && t < startMs) return false;
      if (endMs !== null && t > endMs) return false;
    }
    return true;
  });
  items.sort(
    (a, b) =>
      new Date(b.check_in_at).getTime() - new Date(a.check_in_at).getTime(),
  );
  return delay([...items]);
}

export async function getToday(
  user_id: string,
  date: string,
): Promise<Attendance | null> {
  if (config.api.useRealBackend) {
    const rows = await http.get<Attendance[]>(
      `/api/attendance${qs({ user_id, date })}`,
    );
    return rows[0] ?? null;
  }
  const db = getDb();
  const match = db.attendances.find(
    (a) => a.user_id === user_id && a.date === date,
  );
  return delay(match ?? null);
}

export function buildBeforeChecklist(station: Station): AttendanceChecklistItem[] {
  return buildChecklistFromDb(station, "before");
}

export function buildAfterChecklist(station: Station): AttendanceChecklistItem[] {
  return buildChecklistFromDb(station, "after");
}

export interface CheckInInput {
  user_id: string;
  user_name: string;
  user_role: Role;
  outlet_id: string;
  selfie: string;
  station_photo: string;
  checklist: AttendanceChecklistItem[];
  notes?: string;
}

export async function checkIn(input: CheckInInput): Promise<Attendance> {
  if (config.api.useRealBackend) {
    return http.post<Attendance>("/api/attendance", {
      outlet_id: input.outlet_id,
      selfie: input.selfie,
      station_photo: input.station_photo,
      checklist: input.checklist,
      notes: input.notes,
    });
  }
  return delay(
    mutate((db) => {
      const now = new Date();
      const date = now.toISOString().slice(0, 10);
      const existing = db.attendances.find(
        (a) => a.user_id === input.user_id && a.date === date,
      );
      if (existing) {
        throw new Error("Kamu sudah absen masuk hari ini");
      }
      const station = stationForRole(input.user_role);
      const cutoff = db.attendance_settings.check_in_cutoff;
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const is_late = nowMinutes > toMinutes(cutoff);
      const record: Attendance = {
        id: uid("att"),
        user_id: input.user_id,
        user_name: input.user_name,
        user_role: input.user_role,
        outlet_id: input.outlet_id,
        station,
        date,
        check_in_at: now.toISOString(),
        check_in_selfie: input.selfie,
        check_in_station_photo: input.station_photo,
        before_checklist: input.checklist,
        check_in_notes: input.notes,
        is_late,
      };
      db.attendances.push(record);
      appendAudit(db, {
        action: "check_in",
        entity: "attendance",
        entity_id: record.id,
        entity_name: `${input.user_name} (${station})`,
        outlet_id: input.outlet_id,
        notes: `Absen masuk${is_late ? " (TERLAMBAT)" : ""} — ${
          input.checklist.filter((c) => c.done).length
        }/${input.checklist.length} checklist selesai`,
        actor: {
          id: input.user_id,
          name: input.user_name,
          role: input.user_role,
        },
      });
      return record;
    }),
  );
}

export interface CheckOutInput {
  id: string;
  selfie: string;
  station_photo: string;
  checklist: AttendanceChecklistItem[];
  notes?: string;
}

export async function checkOut(input: CheckOutInput): Promise<Attendance> {
  if (config.api.useRealBackend) {
    return http.post<Attendance>(`/api/attendance/${input.id}/checkout`, {
      selfie: input.selfie,
      station_photo: input.station_photo,
      checklist: input.checklist,
      notes: input.notes,
    });
  }
  return delay(
    mutate((db) => {
      const record = db.attendances.find((a) => a.id === input.id);
      if (!record) throw new Error("Absen tidak ditemukan");
      if (record.check_out_at) throw new Error("Kamu sudah absen pulang");
      const now = new Date();
      record.check_out_at = now.toISOString();
      record.check_out_selfie = input.selfie;
      record.check_out_station_photo = input.station_photo;
      record.after_checklist = input.checklist;
      record.check_out_notes = input.notes;
      appendAudit(db, {
        action: "check_out",
        entity: "attendance",
        entity_id: record.id,
        entity_name: `${record.user_name} (${record.station})`,
        outlet_id: record.outlet_id,
        notes: `Absen pulang — ${
          input.checklist.filter((c) => c.done).length
        }/${input.checklist.length} checklist selesai`,
        actor: {
          id: record.user_id,
          name: record.user_name,
          role: record.user_role,
        },
      });
      return record;
    }),
  );
}
