/**
 * GET /api/tax-settings  — singleton read
 * PUT /api/tax-settings  — singleton upsert (owner)
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
      .from(schema.tax_settings)
      .where(eq(schema.tax_settings.id, SINGLETON))
      .get();
    return (
      row ?? {
        id: SINGLETON,
        ppn_percent: 11,
        service_charge_percent: 0,
        updated_at: nowIso(),
      }
    );
  });
}

const Input = z.object({
  ppn_percent: z.number().min(0).max(100),
  service_charge_percent: z.number().min(0).max(100),
});

export async function PUT(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    requireRole(session, ["owner"]);
    const input = await readJson(req, Input);
    const existing = await db
      .select()
      .from(schema.tax_settings)
      .where(eq(schema.tax_settings.id, SINGLETON))
      .get();
    const next = { id: SINGLETON, ...input, updated_at: nowIso() };
    if (existing) {
      await db
        .update(schema.tax_settings)
        .set(next)
        .where(eq(schema.tax_settings.id, SINGLETON));
    } else {
      await db.insert(schema.tax_settings).values(next);
    }
    await logAudit(session, {
      action: "update",
      entity: "tax_settings",
      entity_id: SINGLETON,
      entity_name: "Tax settings",
    });
    return next;
  });
}
