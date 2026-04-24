import { z } from "zod";
import { db, schema } from "@/server/db/client";
import { requireRole, requireSession } from "@/server/auth/session";
import { genId, handle, readJson } from "@/server/api/helpers";
import { logAudit } from "@/server/api/audit";

export async function GET() {
  return handle(async () => {
    await requireSession();
    return db.select().from(schema.discounts).all();
  });
}

const Input = z
  .object({
    name: z.string().min(1),
    type: z.enum(["percent", "nominal"]),
    // Unbounded value is a footgun — a typo turns a 10% off into 1000% off
    // and every transaction for the day goes free. Cap to a billion IDR
    // nominally; percent is re-checked below.
    value: z.number().nonnegative().max(1_000_000_000),
    scope: z.enum(["all", "category", "menu"]).default("all"),
    scope_ref_id: z.string().optional(),
    start_at: z.string().optional(),
    end_at: z.string().optional(),
    active_hour_start: z.string().optional(),
    active_hour_end: z.string().optional(),
    is_active: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.type === "percent" && data.value > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Diskon persen tidak boleh lebih dari 100%",
        path: ["value"],
      });
    }
  });

export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    requireRole(session, ["owner"]);
    const input = await readJson(req, Input);
    const row = {
      id: genId("dsc"),
      ...input,
      scope_ref_id: input.scope_ref_id ?? null,
      start_at: input.start_at ?? null,
      end_at: input.end_at ?? null,
      active_hour_start: input.active_hour_start ?? null,
      active_hour_end: input.active_hour_end ?? null,
    };
    await db.insert(schema.discounts).values(row);
    await logAudit(session, {
      action: "create",
      entity: "discount",
      entity_id: row.id,
      entity_name: row.name,
    });
    return row;
  });
}
