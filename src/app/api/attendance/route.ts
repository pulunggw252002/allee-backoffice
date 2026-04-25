/**
 * GET  /api/attendance?outlet_id=&date=
 * POST /api/attendance          — check-in
 */
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db/client";
import { requireSession, scopedOutletId } from "@/server/auth/session";
import { badRequest, genId, handle, nowIso, readJson } from "@/server/api/helpers";
import { logAudit } from "@/server/api/audit";
import { stationForRole } from "@/types";

export async function GET(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    const url = new URL(req.url);
    const outletId = scopedOutletId(session, url.searchParams.get("outlet_id"));
    const date = url.searchParams.get("date");
    const filters = [];
    if (outletId) filters.push(eq(schema.attendance.outlet_id, outletId));
    if (date) filters.push(eq(schema.attendance.date, date));
    return db
      .select()
      .from(schema.attendance)
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(desc(schema.attendance.check_in_at))
      .all();
  });
}

const ChecklistItem = z.object({
  id: z.string(),
  label: z.string(),
  done: z.boolean(),
});

const CheckInInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  check_in_selfie: z.string().min(1),
  check_in_station_photo: z.string().min(1),
  before_checklist: z.array(ChecklistItem),
  check_in_notes: z.string().optional(),
  is_late: z.boolean().optional(),
});

export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    const input = await readJson(req, CheckInInput);
    const { domainUser } = session;
    if (!domainUser.outlet_id) {
      throw new Error("User tidak ter-assign ke outlet manapun");
    }
    // Idempotency: tolak double check-in di hari yang sama untuk user yang
    // sama. Tanpa guard ini, network retry dari POS bisa bikin 2-3 row
    // attendance untuk satu shift, dan laporan kehadiran jadi ambigu.
    const existing = await db
      .select({ id: schema.attendance.id })
      .from(schema.attendance)
      .where(
        and(
          eq(schema.attendance.user_id, domainUser.id),
          eq(schema.attendance.date, input.date),
        ),
      )
      .get();
    if (existing) {
      badRequest(`Sudah check-in untuk tanggal ${input.date}`);
    }
    const row = {
      id: genId("att"),
      user_id: domainUser.id,
      user_name: domainUser.name,
      user_role: domainUser.role,
      outlet_id: domainUser.outlet_id,
      station: stationForRole(domainUser.role),
      date: input.date,
      check_in_at: nowIso(),
      check_in_selfie: input.check_in_selfie,
      check_in_station_photo: input.check_in_station_photo,
      before_checklist: input.before_checklist,
      check_in_notes: input.check_in_notes ?? null,
      is_late: input.is_late ?? null,
      check_out_at: null,
      check_out_selfie: null,
      check_out_station_photo: null,
      after_checklist: null,
      check_out_notes: null,
    };
    await db.insert(schema.attendance).values(row);
    await logAudit(session, {
      action: "check_in",
      entity: "attendance",
      entity_id: row.id,
      entity_name: `${domainUser.name} • ${input.date}`,
      outlet_id: domainUser.outlet_id,
    });
    return row;
  });
}
