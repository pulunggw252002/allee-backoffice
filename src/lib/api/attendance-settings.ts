import { appendAudit, getDb, mutate } from "@/lib/mock/db";
import { config } from "@/lib/config";
import type { AttendanceSettings } from "@/types";
import { delay } from "./_latency";
import { http } from "./http";

export async function get(): Promise<AttendanceSettings> {
  if (config.api.useRealBackend) {
    return http.get<AttendanceSettings>("/api/attendance-settings");
  }
  const db = getDb();
  return delay({ ...db.attendance_settings });
}

function validateHHmm(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    throw new Error("Format jam harus HH:mm (contoh 09:00)");
  }
  const [h, m] = value.split(":").map(Number);
  if (h < 0 || h > 23 || m < 0 || m > 59) {
    throw new Error("Jam tidak valid");
  }
}

export async function update(input: {
  check_in_cutoff: string;
}): Promise<AttendanceSettings> {
  validateHHmm(input.check_in_cutoff);
  if (config.api.useRealBackend) {
    return http.put<AttendanceSettings>("/api/attendance-settings", input);
  }
  return delay(
    mutate((db) => {
      const before = { ...db.attendance_settings };
      db.attendance_settings = {
        ...db.attendance_settings,
        check_in_cutoff: input.check_in_cutoff,
        updated_at: new Date().toISOString(),
      };
      appendAudit(db, {
        action: "update",
        entity: "attendance_settings",
        entity_id: "attendance_settings",
        entity_name: "Batas absen masuk",
        changes: [
          {
            field: "check_in_cutoff",
            before: before.check_in_cutoff,
            after: db.attendance_settings.check_in_cutoff,
          },
        ],
      });
      return db.attendance_settings;
    }),
  );
}
