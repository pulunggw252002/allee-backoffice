/**
 * Shared helpers for ojol (GoFood/GrabFood/ShopeeFood) channel routes.
 *
 * Lives outside `src/app/api/` because Next.js App Router only permits
 * HTTP method handlers to be exported from `route.ts` files — any extra
 * export breaks the `next build` type check.
 */

/**
 * Mask an API key / merchant secret for display. Leaks only the last 4
 * characters so Owner can cross-check which key is active without the
 * full credential ever leaving the server.
 */
export function maskKey(raw: string | null | undefined): string {
  if (!raw) return "";
  if (raw.length <= 4) return "••••";
  return `••••${raw.slice(-4)}`;
}
