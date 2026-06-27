import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Deploy-freshness probe: returns the commit SHA of the running deployment so the
// supervised-check can assert prod == latest commit (catches stale/failed deploys).
// Vercel injects VERCEL_GIT_COMMIT_SHA at build/runtime automatically.
export function GET() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.NEXT_PUBLIC_COMMIT_SHA ?? "unknown";
  return NextResponse.json({
    sha,
    short: sha.slice(0, 7),
    ref: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
    builtAt: process.env.VERCEL_DEPLOYMENT_ID ? undefined : new Date().toISOString(),
  });
}
