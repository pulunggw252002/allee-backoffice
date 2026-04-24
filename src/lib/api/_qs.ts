/**
 * Tiny query-string helper for the real-backend branch of each API module.
 * Nullish and empty values are skipped. Arrays are repeated: `?types=in&types=out`.
 *
 * Accepts any object shape (interfaces don't get implicit index signatures in
 * TS, so we type the param as `object` and coerce to entries via `Object.entries`).
 */
export function qs(params?: object | null): string {
  if (!params) return "";
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params as Record<string, unknown>)) {
    if (v === null || v === undefined || v === "") continue;
    if (Array.isArray(v)) {
      for (const item of v) {
        if (item === null || item === undefined || item === "") continue;
        usp.append(k, String(item));
      }
    } else {
      usp.set(k, String(v));
    }
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}
