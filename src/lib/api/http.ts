/**
 * Typed `fetch` wrapper used when `config.api.useRealBackend` is true.
 *
 * Every `src/lib/api/<resource>.ts` module is currently backed by the
 * in-memory mock (`lib/mock/db.ts`). When the real backend is ready, each
 * module can swap its body to call `http.get/post/patch/del` with the same
 * signature — no hooks or components need to change.
 *
 * Keep this thin. No feature flags here; the decision of mock vs. real
 * lives in each resource module so we can migrate one at a time.
 */

import { config, storageKey } from "@/lib/config";

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
    this.name = "ApiError";
  }
}

function joinUrl(path: string): string {
  const base = config.api.baseUrl.replace(/\/+$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

function readAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey("auth"));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      state?: { user?: { id?: string; token?: string } | null };
    };
    return parsed?.state?.user?.token ?? null;
  } catch {
    return null;
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  init?: RequestInit,
): Promise<T> {
  if (!config.api.useRealBackend) {
    throw new ApiError(
      0,
      "Real backend is disabled. Set NEXT_PUBLIC_USE_REAL_BACKEND=true.",
      null,
    );
  }
  // Prefer Better Auth session cookies (credentials: 'include'). The legacy
  // localStorage token is kept as an Authorization fallback for older mock
  // sessions — in a real backend deploy Better Auth sets an httpOnly cookie
  // that the browser attaches automatically.
  const token = readAuthToken();
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((init?.headers as Record<string, string> | undefined) ?? {}),
  };
  const res = await fetch(joinUrl(path), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: "include",
    ...init,
  });
  const text = await res.text();
  const parsed: unknown = text ? safeJson(text) : null;
  if (!res.ok) {
    // Surface backend-provided messages so UI toasts can show meaningful
    // text. Our route handlers return `{ error, details }` (see
    // `src/server/api/helpers.ts`), but Better Auth and other libs use
    // `{ message }` — accept both.
    const msg =
      pickStringField(parsed, "error") ||
      pickStringField(parsed, "message") ||
      res.statusText ||
      "Request failed";
    throw new ApiError(res.status, msg, parsed);
  }
  return parsed as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function pickStringField(value: unknown, key: string): string | null {
  if (typeof value !== "object" || value === null) return null;
  const v = (value as Record<string, unknown>)[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}

export const http = {
  get: <T>(path: string, init?: RequestInit) =>
    request<T>("GET", path, undefined, init),
  post: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>("POST", path, body, init),
  patch: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>("PATCH", path, body, init),
  put: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>("PUT", path, body, init),
  del: <T>(path: string, init?: RequestInit) =>
    request<T>("DELETE", path, undefined, init),
};
