/**
 * Better Auth catch-all route — handles sign-in, sign-out, session read,
 * password change, etc. The frontend hits `/api/auth/...` via the Better
 * Auth client (or plain fetch).
 */
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/server/auth";

export const { GET, POST } = toNextJsHandler(auth);
