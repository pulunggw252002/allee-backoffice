/**
 * Shared utilities for API route handlers.
 *
 * Kept intentionally thin — no request-scoped context / heavy DI. Each route
 * calls `handle(fn)` which wraps its async body in try/catch, serializes
 * Zod errors to 400, and forwards everything else as 500 with a JSON body.
 */

import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
  }
}

export async function handle<T>(
  fn: () => Promise<T>,
): Promise<NextResponse<T | { error: string; details?: unknown }>> {
  try {
    const result = await fn();
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json(
        { error: err.message, details: err.body },
        { status: err.status },
      );
    }
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: err.flatten() },
        { status: 400 },
      );
    }
    console.error("[api] unhandled error:", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Parse a request body against a Zod schema. Throws `ZodError` on failure —
 * `handle()` catches it and turns it into a 400 response.
 */
export async function readJson<T>(
  req: Request,
  schema: ZodSchema<T>,
): Promise<T> {
  const raw = await req.json().catch(() => ({}));
  return schema.parse(raw);
}

export function genId(prefix = "id"): string {
  // 12-char base36 — enough entropy for a single-tenant DB, stays readable.
  const rand = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `${prefix}_${time}${rand}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function notFound(entity: string): never {
  throw new HttpError(404, `${entity} not found`);
}

export function badRequest(message: string, body?: unknown): never {
  throw new HttpError(400, message, body);
}
