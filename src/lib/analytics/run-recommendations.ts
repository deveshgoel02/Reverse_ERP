import { prisma } from "@/lib/db";
import { recommendOrder } from "./recommend";
import { projectForecastAcrossPeriods, type ForecastResult } from "@/lib/forecasting/forecast";
import { getIncomingStock, getRecentVelocity } from "./aggregate";
import { getSettings } from "@/lib/settings/get";
import { getLatestForecast } from "./run-forecasts";

/**
 * Generates fresh Recommendation rows (Module M) for every active SKU that
 * has a forecast. Always PENDING — never auto-decided. Superseding old
 * pending recommendations for the same SKU rather than piling up
 * duplicates, so the owner's queue reflects current numbers.
 */
export async function generateRecommendationsForBusiness(businessId: string): Promise<number> {
  const skus = await prisma.sku.findMany({
    where: { businessId, status: "ACTIVE" },
    include: { inventory: true, product: { include: { supplier: true, category: true } } },
  });

  let count = 0;
  for (const sku of skus) {
    if (!sku.inventory) continue;

    const forecast = await getLatestForecast(sku.id);
    const settings = await getSettings(businessId, {
      brandId: sku.product.brandId ?? undefined,
      categoryId: sku.product.categoryId ?? undefined,
    });

    const leadTimeDays = sku.product.supplier?.leadTimeDays ?? settings.defaultLeadTimeDays;
    const safetyStockDays = settings.defaultSafetyStockDays;
    const periodsAheadForLeadTime = Math.max(1, (leadTimeDays + safetyStockDays) / 30);

    let forecastDemandDuringLeadTime = 0;
    let forecastUpperBound = 0;
    let forecastConfidence: "HIGH" | "MEDIUM" | "LOW" = "LOW";

    if (forecast) {
      const projected = projectForecastAcrossPeriods(
        {
          method: forecast.method,
          expectedDemand: forecast.expectedDemand,
          lowerBound: forecast.lowerBound,
          upperBound: forecast.upperBound,
          trend: forecast.trend,
          confidence: forecast.confidence,
          inputsJson: forecast.inputsJson as ForecastResult["inputsJson"],
        } as ForecastResult,
        periodsAheadForLeadTime,
      );
      forecastDemandDuringLeadTime = projected.expectedDemand;
      forecastUpperBound = projected.upperBound;
      forecastConfidence = forecast.confidence as "HIGH" | "MEDIUM" | "LOW";
    }

    const [incomingStock, recentVelocity] = await Promise.all([
      getIncomingStock(sku.id),
      getRecentVelocity(sku.id, 60),
    ]);

    const result = recommendOrder(
      {
        currentStock: sku.inventory.currentQuantity,
        incomingStock,
        forecastDemandDuringLeadTime,
        forecastUpperBound,
        forecastConfidence,
        leadTimeDays,
        safetyStockDays,
        recentVelocity,
        classification: sku.inventory.status as never,
        minOrderQty: sku.minOrderQty ?? undefined,
      },
      settings,
    );

    // Supersede prior pending recommendations for this SKU so the queue doesn't pile up stale
    // advice. SUPERSEDED is distinct from REJECTED — the owner never acted on these, the system
    // just recomputed with fresher numbers.
    await prisma.recommendation.updateMany({
      where: { skuId: sku.id, status: "PENDING" },
      data: { status: "SUPERSEDED", decidedAt: new Date() },
    });

    await prisma.recommendation.create({
      data: {
        businessId,
        skuId: sku.id,
        type: result.type,
        recommendedQty: result.recommendedQty,
        reason: result.reason,
        inputsJson: result.inputsUsed,
        confidence: result.confidence,
        expectedImpact: result.expectedImpact,
        status: "PENDING",
      },
    });
    count++;
  }
  return count;
}
