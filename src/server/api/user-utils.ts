/**
 * Shared helpers for user API routes.
 *
 * Lives outside `src/app/api/` because Next.js App Router only permits
 * HTTP method handlers to be exported from `route.ts` files — any extra
 * export breaks the `next build` type check.
 */

/**
 * Strip the server-only PIN hash from a user row before sending to the
 * client. We replace it with a string marker (`"***"` when a PIN is set,
 * `null` otherwise) so the frontend can read `user.pos_pin` as a truthy
 * "has POS access" flag without ever seeing the hash.
 */
export function maskPin<T extends { pos_pin_hash?: string | null }>(row: T) {
  const { pos_pin_hash, ...rest } = row;
  return { ...rest, pos_pin: pos_pin_hash ? "***" : null };
}
