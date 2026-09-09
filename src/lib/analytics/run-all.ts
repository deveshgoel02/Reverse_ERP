import { classifyAllSkusForBusiness } from "./run-classification";
import { generateForecastsForBusiness } from "./run-forecasts";
import { generateRecommendationsForBusiness } from "./run-recommendations";
import { generateAlertsForBusiness } from "@/lib/alerts/generate";

/**
 * The full intelligence pipeline, in dependency order:
 * classify stock -> forecast demand -> recommend orders -> raise alerts.
 * Call this after any import, or from a scheduled job — see
 * docs/ARCHITECTURE.md "Recompute pipeline". Each stage reads what the
 * previous stage wrote, so the order matters.
 */
export async function runIntelligencePipeline(businessId: string) {
  const classifications = await classifyAllSkusForBusiness(businessId);
  const forecastCount = await generateForecastsForBusiness(businessId);
  const recommendationCount = await generateRecommendationsForBusiness(businessId);
  const alertCount = await generateAlertsForBusiness(businessId);

  return {
    skusClassified: classifications.length,
    forecastsGenerated: forecastCount,
    recommendationsGenerated: recommendationCount,
    alertsCreated: alertCount,
  };
}
