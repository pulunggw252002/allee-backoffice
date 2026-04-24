import { z } from "zod";
import { db, schema } from "@/server/db/client";
import { requireRole, requireSession } from "@/server/auth/session";
import { genId, handle, nowIso, readJson } from "@/server/api/helpers";
import { logAudit } from "@/server/api/audit";

export async function GET() {
  return handle(async () => {
    await requireSession();
    return db.select().from(schema.sales_targets).all();
  });
}

const Input = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  target_amount: z.number().nonnegative(),
});

export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    requireRole(session, ["owner"]);
    const input = await readJson(req, Input);
    const row = { id: genId("tgt"), ...input, updated_at: nowIso() };
    await db.insert(schema.sales_targets).values(row);
    await logAudit(session, {
      action: "create",
      entity: "sales_target",
      entity_id: row.id,
      entity_name: `${input.year}-${String(input.month).padStart(2, "0")}`,
    });
    return row;
  });
}
