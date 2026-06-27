import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Run on all routes except static assets, image optimization, /api/sync (does its
  // own auth — Vercel cron bearer OR owner) and /api/version (public deploy-freshness
  // probe — returns the running commit SHA so we can verify prod == latest).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/sync|api/version|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
