/**
 * Synthetic email format for Better Auth.
 *
 * The backoffice login UX is "nama + password", but Better Auth needs an
 * email. We bridge the two by deriving a deterministic synthetic email
 * `<slug(name)>@allee.local` from the display name. The synthetic email is
 * stored on `user_auth.email` and looked up at login time.
 *
 * **Single source of truth.** This helper MUST be imported by every place
 * that maps name → email:
 *   - `scripts/seed.ts` (seed-time creation)
 *   - `src/app/api/users/route.ts` (owner creates user via UI)
 *   - `src/app/api/users/[id]/route.ts` (owner renames user)
 *   - `src/lib/api/users.ts` (client-side login)
 *
 * If create/rename and login disagree on the slug rules, the email written
 * at create time and the email looked up at login time mismatch and login
 * silently fails — that was the original bug this module fixes.
 *
 * Slug rules:
 *   - lowercase
 *   - strip combining diacritics (so "Café" → "cafe")
 *   - any run of non-word chars collapses to a single `-`
 *   - trim leading/trailing `-`
 *
 * Examples:
 *   "Budi"               → "budi@allee.local"
 *   "Rudi Kasir"         → "rudi-kasir@allee.local"
 *   "POS Renon Service"  → "pos-renon-service@allee.local"
 *   "Café Manager"       → "cafe-manager@allee.local"
 */

export function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining diacritics
    .replace(/[^\w]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function emailFromName(name: string): string {
  return `${slugifyName(name)}@allee.local`;
}
