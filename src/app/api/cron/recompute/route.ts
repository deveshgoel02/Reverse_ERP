import { NextResponse } from "next/server";
import { recomputeAllBusinesses } from "@/lib/analytics/recompute-all-businesses";

/**
 * HTTP-triggered recompute, for deployments where the in-process scheduler
 * (src/instrumentation.ts) doesn't apply — serverless platforms recycle
 * the process between requests, so a `setInterval` set up at boot won't
 * reliably fire. Point an external scheduler at this route instead:
 * Vercel Cron (vercel.json), a GitHub Actions scheduled workflow, a
 * server's own crontab calling curl, cron-job.org, etc.
 *
 * Protected by a shared secret (CRON_SECRET) so this can't be triggered by
 * anyone who finds the URL. In production, a missing/wrong secret is
 * always rejected; in development, an unset secret is allowed (with a
 * console warning) so this is easy to test locally.
 */
export async function POST(request: Request) {
  const configuredSecret = process.env.CRON_SECRET;
  const providedSecret = request.headers.get("x-cron-secret");

  if (configuredSecret) {
    if (providedSecret !== configuredSecret) {
      return NextResponse.json({ error: "Invalid or missing x-cron-secret header." }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "CRON_SECRET is not configured — refusing to run in production without one." }, { status: 401 });
  } else {
    console.warn("[cron/recompute] CRON_SECRET is not set — allowing this request because NODE_ENV !== 'production'.");
  }

  const result = await recomputeAllBusinesses();
  return NextResponse.json(result);
}

/** Convenience for manual/browser testing in development — same auth rules as POST. */
export async function GET(request: Request) {
  return POST(request);
}
