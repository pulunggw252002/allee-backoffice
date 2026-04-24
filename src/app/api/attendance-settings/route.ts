/**
 * GET /api/attendance-settings  — singleton read
 * PUT /api/attendance-settings  — singleton upsert (owner)
 */
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db/client";
import { requireRole, requireSession } from "@/server/auth/session";
import { handle, nowIso, readJson } from "@/server/api/helpers";
import { logAudit } from "@/server/api/audit";

const SINGLETON = "singleton";

export async function GET() {
  return handle(async () => {
    await requireSession();
    const row = await db
      .select()
      .from(schema.attendance_settings)
      .where(eq(schema.attendance_settings.id, SINGLETON))
      .get();
    return row ?? { id: SINGLETON, check_in_cutoff: "09:00", updated_at: nowIso() };
  });
}

const Input = z.object({
  check_in_cutoff: z.string().regex(/^\d{2}:\d{2}$/),
});

export async function PUT(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    requireRole(session, ["owner"]);
    const input = await readJson(req, Input);
    const existing = await db
      .select()
      .from(schema.attendance_settings)
      .where(eq(schema.attendance_settings.id, SINGLETON))
      .get();
    const next = { id: SINGLETON, ...input, updated_at: nowIso() };
    if (existing) {
      await db
        .update(schema.attendance_settings)
        .set(next)
        .where(eq(schema.attendance_settings.id, SINGLETON));
    } else {
      await db.insert(schema.attendance_settings).values(next);
    }
    await logAudit(session, {
      action: "update",
      entity: "attendance_settings",
      entity_id: SINGLETON,
      entity_name: "Attendance settings",
    });
    return next;
  });
}
