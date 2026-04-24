/**
 * PATCH /api/ojol/channels/:id — update channel config (owner-only).
 *
 * Body accepts any subset of:
 *   { store_name, merchant_id, api_key, is_connected, auto_sync, notes }
 *
 * `api_key` is a write-only field; the response masks it. Sending `""`
 * clears the key.
 */
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db/client";
import { requireRole, requireSession } from "@/server/auth/session";
import { handle, notFound, readJson } from "@/server/api/helpers";
import { logAudit, diffChanges } from "@/server/api/audit";
import { maskKey } from "@/server/api/ojol-utils";

type Ctx = { params: Promise<{ id: string }> };

const Input = z
  .object({
    store_name: z.string(),
    merchant_id: z.string(),
    api_key: z.string(),
    is_connected: z.boolean(),
    auto_sync: z.boolean(),
    notes: z.string().nullable(),
  })
  .partial();

export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    requireRole(session, ["owner"]);
    const { id } = await params;
    const before = await db
      .select()
      .from(schema.ojol_channels)
      .where(eq(schema.ojol_channels.id, id))
      .get();
    if (!before) notFound("Channel");

    const input = await readJson(req, Input);
    await db
      .update(schema.ojol_channels)
      .set(input)
      .where(eq(schema.ojol_channels.id, id));

    const after = await db
      .select()
      .from(schema.ojol_channels)
      .where(eq(schema.ojol_channels.id, id))
      .get();

    await logAudit(session, {
      action: "update",
      entity: "ojol_channel",
      entity_id: after!.id,
      entity_name: `${after!.platform} — ${after!.store_name}`,
      outlet_id: after!.outlet_id,
      // Keep the API key out of the audit payload (write-only secret).
      changes: diffChanges(
        {
          ...(before as unknown as Record<string, unknown>),
          api_key: "***",
        },
        {
          ...(after as unknown as Record<string, unknown>),
          api_key: "***",
        },
      ),
    });

    return { ...after, api_key: maskKey(after!.api_key) };
  });
}
