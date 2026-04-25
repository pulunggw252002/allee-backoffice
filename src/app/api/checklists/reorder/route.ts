/**
 * POST /api/checklists/reorder
 * Body: { station, type, ordered_ids: string[] }
 * Rewrites `sort_order` to match the index of each id in `ordered_ids`.
 */
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db/client";
import { requireRole, requireSession } from "@/server/auth/session";
import { handle, readJson } from "@/server/api/helpers";
import { logAudit } from "@/server/api/audit";

const Input = z.object({
  station: z.enum(["bar", "kitchen", "cashier", "service", "management"]),
  type: z.enum(["before", "after"]),
  // Reject duplicates: if the same id appears twice the second write clobbers
  // the first with a different sort_order — the client is already broken and
  // we shouldn't let that shape hit the DB.
  ordered_ids: z.array(z.string()).refine(
    (ids) => new Set(ids).size === ids.length,
    { message: "ordered_ids harus unik" },
  ),
});

export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    requireRole(session, ["owner"]);
    const input = await readJson(req, Input);

    // Whole-list reorder in one transaction — partial rewrites leave the
    // checklist in a state where two items share the same sort_order.
    await db.transaction(async (tx) => {
      for (let idx = 0; idx < input.ordered_ids.length; idx++) {
        const id = input.ordered_ids[idx];
        await tx
          .update(schema.checklist_templates)
          .set({ sort_order: idx })
          .where(
            and(
              eq(schema.checklist_templates.id, id),
              eq(schema.checklist_templates.station, input.station),
              eq(schema.checklist_templates.type, input.type),
            ),
          );
      }
    });

    await logAudit(session, {
      action: "update",
      entity: "checklist_template",
      entity_id: `${input.station}:${input.type}`,
      entity_name: `Checklist ${input.station} (${input.type}) — reorder`,
      notes: `${input.ordered_ids.length} item dirapikan ulang`,
    });

    return { ok: true };
  });
}
