/**
 * GET /api/session — return the currently authenticated domain user, or 401.
 * The frontend's auth store calls this after Better Auth sign-in to hydrate
 * role + outlet_id without duplicating the lookup in every page.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "@/server/auth/session";

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    id: session.domainUser.id,
    name: session.domainUser.name,
    role: session.domainUser.role,
    outlet_id: session.domainUser.outlet_id,
    email: session.authEmail,
  });
}
