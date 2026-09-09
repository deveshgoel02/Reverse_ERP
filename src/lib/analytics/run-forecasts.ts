import { prisma } from "@/lib/db";
import { forecastDemand } from "@/lib/forecasting/forecast";
import { getMonthlyDemandForSku } from "./aggregate";

/** Generates one next-month Forecast row per active SKU — Module L. */
export async function generateForecastsForBusiness(businessId: string): Promise<number> {
  const skus = await prisma.sku.findMany({ where: { businessId, status: "ACTIVE" }, select: { id: true } });

  let count = 0;
  for (const sku of skus) {
    const history = await getMonthlyDemandForSku(sku.id);
    if (history.length === 0) continue; // never sold — nothing to forecast, no Forecast row written

    const result = forecastDemand(history);
    const lastPeriod = history[history.length - 1].periodStart;
    const periodStart = new Date(lastPeriod.getFullYear(), lastPeriod.getMonth() + 1, 1);
    const periodEnd = new Date(lastPeriod.getFullYear(), lastPeriod.getMonth() + 2, 0);

    await prisma.forecast.create({
      data: {
        businessId,
        skuId: sku.id,
        periodStart,
        periodEnd,
        method: result.method,
        expectedDemand: result.expectedDemand,
        lowerBound: result.lowerBound,
        upperBound: result.upperBound,
        trend: result.trend,
        confidence: result.confidence,
        inputsJson: result.inputsJson,
      },
    });
    count++;
  }
  return count;
}

/** Most recent Forecast row for a SKU, if any. */
export async function getLatestForecast(skuId: string) {
  return prisma.forecast.findFirst({ where: { skuId }, orderBy: { generatedAt: "desc" } });
}
