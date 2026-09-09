/**
 * Next.js instrumentation hook — runs once when the server process boots
 * (see https://nextjs.org/docs/app/guides/instrumentation). Used here to
 * start an in-process scheduler that periodically re-runs the intelligence
 * pipeline (classify/forecast/recommend/alert) for every business, so
 * stock aging and alerts stay current even on days with no imports or
 * transactions.
 *
 * This only works for a long-running Node process (e.g. `next start` on a
 * VM/container). On a serverless platform (Vercel, etc.) the process is
 * recycled between requests, so `setInterval` won't reliably fire — use
 * the HTTP endpoint at /api/cron/recompute with an external scheduler
 * instead (see that route's doc comment). Both can be enabled at once
 * harmlessly (the pipeline is idempotent).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.DISABLE_RECOMPUTE_SCHEDULER === "true") return;

  const globalForScheduler = globalThis as unknown as { __recomputeSchedulerStarted?: boolean };
  if (globalForScheduler.__recomputeSchedulerStarted) return; // avoid double-start on dev hot reload
  globalForScheduler.__recomputeSchedulerStarted = true;

  const intervalMinutes = Number(process.env.RECOMPUTE_INTERVAL_MINUTES ?? "360"); // default: every 6 hours
  const intervalMs = Math.max(5, intervalMinutes) * 60 * 1000;

  const { recomputeAllBusinesses } = await import("@/lib/analytics/recompute-all-businesses");

  async function runOnce() {
    try {
      const result = await recomputeAllBusinesses();
      console.log(`[recompute-scheduler] ran for ${result.businessCount} business(es)`);
    } catch (err) {
      console.error("[recompute-scheduler] run failed:", err);
    }
  }

  // Fire once shortly after boot (data may already be stale from before the server started), then on the interval.
  setTimeout(runOnce, 30_000);
  setInterval(runOnce, intervalMs);

  console.log(`[recompute-scheduler] started, interval=${intervalMinutes}m`);
}
