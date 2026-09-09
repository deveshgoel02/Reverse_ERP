import type { RecommendationType, Confidence, StockStatus } from "@/lib/enums";
import type { SettingsShape } from "@/lib/settings/defaults";

export interface RecommendationInput {
  currentStock: number;
  /** Quantity already on order from a supplier but not yet received. */
  incomingStock: number;
  /** Forecast demand expected during (lead time + safety stock window). */
  forecastDemandDuringLeadTime: number;
  forecastUpperBound: number;
  forecastConfidence: Confidence;
  leadTimeDays: number;
  safetyStockDays: number;
  /** Units sold per day, recent average — used as a fallback when forecast demand is 0/unavailable. */
  recentVelocity: number;
  classification: StockStatus;
  minOrderQty?: number;
}

export interface RecommendationResult {
  type: RecommendationType;
  recommendedQty: number | null;
  reason: string;
  confidence: Confidence;
  expectedImpact: string;
  inputsUsed: Record<string, number | string | null>;
}

/**
 * Deterministic reorder recommendation. This function NEVER places an
 * order — it only returns a suggestion + full explanation. See Module M in
 * the spec / docs/AI_AND_FORECASTING.md: the owner always makes the final
 * call, and every field here is stored on the Recommendation row so the
 * decision is auditable.
 */
export function recommendOrder(
  input: RecommendationInput,
  settings: SettingsShape,
): RecommendationResult {
  const {
    currentStock,
    incomingStock,
    forecastDemandDuringLeadTime,
    forecastUpperBound,
    forecastConfidence,
    leadTimeDays,
    safetyStockDays,
    recentVelocity,
    classification,
    minOrderQty,
  } = input;

  const safetyStock = recentVelocity * safetyStockDays;
  // Fall back to velocity-based demand if the forecast has no signal (e.g. brand new SKU).
  const effectiveDemand =
    forecastDemandDuringLeadTime > 0 ? forecastDemandDuringLeadTime : recentVelocity * leadTimeDays;
  const reorderPoint = round1(effectiveDemand + safetyStock);
  const availableStock = currentStock + incomingStock;
  const gap = round1(reorderPoint - availableStock);

  const inputsUsed: Record<string, number | string | null> = {
    currentStock,
    incomingStock,
    availableStock,
    reorderPoint,
    forecastDemandDuringLeadTime: round1(forecastDemandDuringLeadTime),
    forecastUpperBound: round1(forecastUpperBound),
    leadTimeDays,
    safetyStockDays,
    safetyStock: round1(safetyStock),
    recentVelocity: round1(recentVelocity),
    classification,
  };

  // Dead/at-risk stock overrides the pure math: don't recommend buying more
  // of something that isn't moving, even if a short recent blip suggests a gap.
  if (classification === "DEAD_STOCK" || classification === "AT_RISK") {
    if (gap > 0) {
      return {
        type: "REVIEW_MANUALLY",
        recommendedQty: null,
        reason: `Stock is classified ${classification.replace("_", " ").toLowerCase()}, but the reorder math shows a demand gap of ${gap} units — this conflict needs a human look before ordering.`,
        confidence: "LOW",
        expectedImpact: "Avoids blindly reordering stock that historically hasn't moved.",
        inputsUsed,
      };
    }
    return {
      type: "DO_NOT_ORDER",
      recommendedQty: 0,
      reason: `Stock is classified ${classification.replace("_", " ").toLowerCase()} (current stock ${currentStock} units) — do not order more until it starts moving.`,
      confidence: "HIGH",
      expectedImpact: "Prevents adding to inventory that is already not selling.",
      inputsUsed,
    };
  }

  if (classification === "OVERSTOCKED" || (gap <= 0 && availableStock > reorderPoint * settings.reorderExcessMultiplier)) {
    return {
      type: "ORDER_LESS",
      recommendedQty: null,
      reason: `Available stock (${availableStock} units) is significantly above the reorder point (${reorderPoint} units) implied by forecast demand during lead time. Reduce the next order quantity.`,
      confidence: forecastConfidence,
      expectedImpact: "Reduces excess inventory exposure and holding cost.",
      inputsUsed,
    };
  }

  if (gap > 0) {
    const recommendedQty = Math.ceil(Math.max(gap, minOrderQty ?? 0));
    return {
      type: "ORDER_MORE",
      recommendedQty,
      reason: `Current stock is insufficient for forecast demand during the supplier lead time. Available stock ${availableStock} units vs. reorder point ${reorderPoint} units (demand ${round1(effectiveDemand)} over ${leadTimeDays} lead-time days + ${round1(safetyStock)} safety stock).`,
      confidence: forecastConfidence,
      expectedImpact: `Closes an estimated ${gap}-unit demand gap before stock runs out.`,
      inputsUsed,
    };
  }

  return {
    type: "MAINTAIN",
    recommendedQty: 0,
    reason: `Available stock (${availableStock} units) comfortably covers the reorder point (${reorderPoint} units). No change needed.`,
    confidence: forecastConfidence,
    expectedImpact: "No action required at this time.",
    inputsUsed,
  };
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
