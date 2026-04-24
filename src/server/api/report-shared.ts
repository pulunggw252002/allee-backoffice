/**
 * Shared filter parsing + scoping for all `/api/reports/*` endpoints.
 *
 * Every report takes `outlet_id`, `start`, `end` in the query string.
 * `outlet_id` is clamped by `scopedOutletId()` so kepala_toko can't read
 * other outlets' data.
 */
import { and, eq, gte, lte, type SQL } from "drizzle-orm";
import { schema } from "@/server/db/client";
import type { ServerSession } from "@/server/auth/session";
import { scopedOutletId } from "@/server/auth/session";
import { badRequest } from "./helpers";

export interface ReportParams {
  outlet_id: string | null;
  start: string | null;
  end: string | null;
}

/**
 * Validates a report date param. Accepts `YYYY-MM-DD` or full ISO-8601
 * (`YYYY-MM-DDTHH:mm:ss.sssZ`) — both formats are used across reports and
 * compare correctly against SQLite TEXT columns storing ISO timestamps.
 * Returns `null` when the param is absent; throws 400 when it's malformed.
 */
function parseDateParam(value: string | null, field: string): string | null {
  if (value === null || value === "") return null;
  const iso = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?Z?)?$/;
  if (!iso.test(value)) {
    badRequest(`Parameter "${field}" harus format YYYY-MM-DD atau ISO-8601`);
  }
  // Parseability gate — "2026-13-45" matches the regex but Date rejects it.
  if (Number.isNaN(new Date(value).getTime())) {
    badRequest(`Parameter "${field}" bukan tanggal valid`);
  }
  return value;
}

export function readReportParams(
  session: ServerSession,
  req: Request,
): ReportParams {
  const url = new URL(req.url);
  return {
    outlet_id: scopedOutletId(session, url.searchParams.get("outlet_id")),
    start: parseDateParam(url.searchParams.get("start"), "start"),
    end: parseDateParam(url.searchParams.get("end"), "end"),
  };
}

export function txWhereClauses(params: ReportParams): SQL | undefined {
  const arr: SQL[] = [];
  if (params.outlet_id)
    arr.push(eq(schema.transactions.outlet_id, params.outlet_id));
  if (params.start) arr.push(gte(schema.transactions.created_at, params.start));
  if (params.end) arr.push(lte(schema.transactions.created_at, params.end));
  return arr.length === 0 ? undefined : and(...arr);
}
