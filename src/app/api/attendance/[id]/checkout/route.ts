/**
 * POST /api/attendance/:id/checkout
 */
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db/client";
import { requireSession } from "@/server/auth/session";
import { badRequest, handle, notFound, nowIso, readJson } from "@/server/api/helpers";
import { logAudit } from "@/server/api/audit";

type Ctx = { params: Promise<{ id: string }> };

const ChecklistItem = z.object({
  id: z.string(),
  label: z.string(),
  done: z.boolean(),
});

const Input = z.object({
  check_out_selfie: z.string().min(1),
  check_out_station_photo: z.string().min(1),
  after_checklist: z.array(ChecklistItem),
  check_out_notes: z.string().optional(),
});

export async function POST(req: Request, { params }: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    const { id } = await params;
    const att = await db
      .select()
      .from(schema.attendance)
      .where(eq(schema.attendance.id, id))
      .get();
    if (!att) notFound("Attendance");
    // Cross-user guard: kasir/barista hanya boleh checkout record sendiri,
    // owner boleh untuk siapa saja (override administratif). Kepala toko
    // boleh untuk staff di outlet-nya.
    if (
      session.domainUser.role !== "owner" &&
      att.user_id !== session.domainUser.id &&
      !(
        session.domainUser.role === "kepala_toko" &&
        att.outlet_id === session.domainUser.outlet_id
      )
    ) {
      notFound("Attendance");
    }
    // Idempotency: tolak double checkout. Network retry tidak boleh menimpa
    // checkout time yang sudah tercatat — itu menghapus durasi shift asli.
    if (att.check_out_at) {
      badRequest("Sudah check-out untuk attendance ini");
    }
    const input = await readJson(req, Input);
    await db
      .update(schema.attendance)
      .set({
        check_out_at: nowIso(),
        check_out_selfie: input.check_out_selfie,
        check_out_station_photo: input.check_out_station_photo,
        after_checklist: input.after_checklist,
        check_out_notes: input.check_out_notes ?? null,
      })
      .where(eq(schema.attendance.id, id));
    await logAudit(session, {
      action: "check_out",
      entity: "attendance",
      entity_id: id,
      entity_name: `${att.user_name} • ${att.date}`,
      outlet_id: att.outlet_id,
    });
    return { ok: true };
  });
}
