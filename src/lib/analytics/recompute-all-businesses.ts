import { prisma } from "@/lib/db";
import { runIntelligencePipeline } from "./run-all";

/**
 * Runs the full intelligence pipeline for every business. Used by both the
 * in-process scheduler (src/instrumentation.ts) and the HTTP cron endpoint
 * (src/app/api/cron/recompute/route.ts), so aging/alerts/forecasts stay
 * fresh even on days with no imports or transactions — e.g. a SKU crossing
 * the dead-stock day threshold purely because time passed, with no new
 * sales to trigger a recalculation otherwise.
 */
export async function recomputeAllBusinesses(): Promise<{ businessCount: number; results: Record<string, Awaited<ReturnType<typeof runIntelligencePipeline>>> }> {
  const businesses = await prisma.business.findMany({ select: { id: true, name: true } });
  const results: Record<string, Awaited<ReturnType<typeof runIntelligencePipeline>>> = {};

  for (const business of businesses) {
    results[business.id] = await runIntelligencePipeline(business.id);
  }

  return { businessCount: businesses.length, results };
}
