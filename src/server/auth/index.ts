/**
 * Better Auth configuration.
 *
 * We use email + password credentials — the "email" is a synthetic
 * `name@allee.local` so the existing login UX (nama + password) keeps working
 * without forcing every staff member to have a real email address. The
 * backend `/api/session` route resolves the authenticated user's domain
 * identity (role + outlet) via `user_auth.domain_user_id`.
 *
 * Drizzle adapter shares the same SQLite connection as the domain data so
 * everything lives in a single file — easy VPS backups (`cp app.db`).
 */

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/server/db/client";
import * as schema from "@/server/db/schema";

function requireSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) {
    // Don't crash the build — Next.js evaluates this module at build time,
    // and CI won't have the secret. At runtime we fall back to a dev stub
    // but log loudly so it's caught in staging.
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[auth] BETTER_AUTH_SECRET missing or < 32 chars. " +
          "Sessions will not be secure. Set it in your production env.",
      );
    }
    return secret ?? "insecure-dev-only-secret-please-set-env-var-today";
  }
  return secret;
}

/**
 * Resolve the public base URL for Better Auth.
 *
 * Priority:
 *   1. `BETTER_AUTH_URL` — explicit override (what custom domains use).
 *   2. `VERCEL_PROJECT_PRODUCTION_URL` — stable prod URL Vercel auto-injects;
 *      doesn't change between deploys.
 *   3. `VERCEL_URL` — per-deployment URL (preview/branch deploys).
 *   4. `http://localhost:3000` — local dev fallback.
 *
 * Cookies are bound to this origin, so it must match what the browser sees.
 * On a custom domain you MUST set `BETTER_AUTH_URL` explicitly — otherwise
 * Better Auth would fall back to the *.vercel.app host and cookies would
 * never reach the canonical domain.
 */
function resolveBaseURL(): string {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export const auth = betterAuth({
  baseURL: resolveBaseURL(),
  secret: requireSecret(),
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      user: schema.user_auth,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    // Staff accounts are pre-created via seed + user management UI.
    // Self-signup is off — only Owner can create new users.
    disableSignUp: true,
    // Don't enforce email verification (synthetic emails are @allee.local).
    requireEmailVerification: false,
    minPasswordLength: 4,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh each day
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 min in-memory cache per Next.js instance
    },
  },
  advanced: {
    cookiePrefix: "allee",
    // Same-site for a single-host deployment. Switch to "none" + secure=true
    // only if frontend and API run on different hostnames.
    defaultCookieAttributes: {
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  },
});

export type Auth = typeof auth;
