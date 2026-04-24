/**
 * GET  /api/checklists?station=&type=  — list checklist templates
 * POST /api/checklists                  — add new item (owner)
 */
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db/client";
import { requireRole, requireSession } from "@/server/auth/session";
import { genId, handle, readJson } from "@/server/api/helpers";
import { logAudit } from "@/server/api/audit";

export async function GET(req: Request) {
  return handle(async () => {
    await requireSession();
    const url = new URL(req.url);
    const station = url.searchParams.get("station");
    const type = url.searchParams.get("type");
    const filters = [];
    if (station) filters.push(eq(schema.checklist_templates.station, station as never));
    if (type) filters.push(eq(schema.checklist_templates.type, type as never));
    return db
      .select()
      .from(schema.checklist_templates)
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(asc(schema.checklist_templates.sort_order))
      .all();
  });
}

const Input = z.object({
  station: z.enum(["bar", "kitchen", "cashier", "service", "management"]),
  type: z.enum(["before", "after"]),
  label: z.string().min(1),
  sort_order: z.number().int().default(0),
});

export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    requireRole(session, ["owner"]);
    const input = await readJson(req, Input);
    const row = { id: genId("chk"), ...input };
    await db.insert(schema.checklist_templates).values(row);
    await logAudit(session, {
      action: "create",
      entity: "checklist_template",
      entity_id: row.id,
      entity_name: row.label,
    });
    return row;
  });
}
