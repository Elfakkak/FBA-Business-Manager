import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Run on all routes except static assets, image optimization, and /api/sync
  // (that route does its own auth — Vercel cron bearer OR signed-in owner — so the
  // session middleware must not redirect the cron's no-cookie request to /login).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/sync|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
