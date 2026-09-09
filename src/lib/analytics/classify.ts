import type { StockStatus } from "@/lib/enums";
import type { SettingsShape } from "@/lib/settings/defaults";

export interface StockClassificationInput {
  currentQuantity: number;
  /** Days since the most recent sale of this SKU, or null if it has never sold. */
  daysSinceLastSale: number | null;
  /** Units sold per day, averaged over a recent window (e.g. last 30-60 days). */
  recentVelocity: number;
  /** Units sold in the dead-stock lookback window (e.g. last `deadStockDays` days). */
  unitsSoldInDeadStockWindow: number;
  /** Average recentVelocity across the SKU's category, for relative fast-moving comparison. Optional. */
  categoryAverageVelocity?: number;
  /** Days since stock was first received (age of the current holding). */
  stockAgeDays: number | null;
}

export interface StockClassificationResult {
  status: StockStatus;
  /** Human-readable reason, grounded in the actual numbers used — never a bare label. */
  reason: string;
  daysCover: number | null;
}

const EPSILON = 0.001;

/**
 * Deterministic, settings-driven classification. Order matters: earlier
 * rules take priority (e.g. a SKU with zero stock is always OUT_OF_STOCK
 * regardless of how it was previously selling). Every threshold comes from
 * `settings`, which the caller resolves from Setting overrides layered over
 * DEFAULT_SETTINGS (see src/lib/settings/get.ts) — nothing here is
 * hard-coded so the owner can tune it from the UI.
 */
export function classifyStock(
  input: StockClassificationInput,
  settings: SettingsShape,
): StockClassificationResult {
  const { currentQuantity, daysSinceLastSale, recentVelocity, unitsSoldInDeadStockWindow, stockAgeDays } = input;

  if (currentQuantity <= 0) {
    return { status: "OUT_OF_STOCK", reason: "No units currently in stock.", daysCover: 0 };
  }

  const neverSold = daysSinceLastSale === null;
  if (
    (neverSold && (stockAgeDays ?? 0) >= settings.deadStockDays) ||
    (!neverSold &&
      daysSinceLastSale! >= settings.deadStockDays &&
      unitsSoldInDeadStockWindow < settings.deadStockMinUnitsSold)
  ) {
    const basis = neverSold
      ? `received ${stockAgeDays} days ago and has never sold`
      : `last sold ${daysSinceLastSale} days ago, only ${unitsSoldInDeadStockWindow} unit(s) sold in that time`;
    return {
      status: "DEAD_STOCK",
      reason: `Stock has been ${basis} — meets the dead-stock threshold (${settings.deadStockDays} days).`,
      daysCover: null,
    };
  }

  if (!neverSold && daysSinceLastSale! >= settings.atRiskDays) {
    return {
      status: "AT_RISK",
      reason: `Last sold ${daysSinceLastSale} days ago (at-risk threshold: ${settings.atRiskDays} days).`,
      daysCover: recentVelocity > EPSILON ? round1(currentQuantity / recentVelocity) : null,
    };
  }

  if (!neverSold && daysSinceLastSale! >= settings.slowMovingDays) {
    return {
      status: "SLOW_MOVING",
      reason: `Last sold ${daysSinceLastSale} days ago (slow-moving threshold: ${settings.slowMovingDays} days).`,
      daysCover: recentVelocity > EPSILON ? round1(currentQuantity / recentVelocity) : null,
    };
  }

  const daysCover = recentVelocity > EPSILON ? currentQuantity / recentVelocity : null;

  if (daysCover !== null && daysCover >= settings.overstockedDaysCover) {
    return {
      status: "OVERSTOCKED",
      reason: `Current stock (${currentQuantity} units) covers ~${round1(daysCover)} days of demand at recent velocity — above the overstock threshold (${settings.overstockedDaysCover} days).`,
      daysCover: round1(daysCover),
    };
  }

  if (daysCover !== null && daysCover <= settings.understockedDaysCover) {
    return {
      status: "UNDERSTOCKED",
      reason: `Current stock (${currentQuantity} units) covers only ~${round1(daysCover)} days of demand at recent velocity — below the understock threshold (${settings.understockedDaysCover} days).`,
      daysCover: round1(daysCover),
    };
  }

  if (
    input.categoryAverageVelocity !== undefined &&
    input.categoryAverageVelocity > EPSILON &&
    recentVelocity >= input.categoryAverageVelocity * settings.fastMovingVelocityMultiplier
  ) {
    return {
      status: "FAST_MOVING",
      reason: `Selling at ${round1(recentVelocity)} units/day, ${round1(recentVelocity / input.categoryAverageVelocity)}x the category average.`,
      daysCover: daysCover !== null ? round1(daysCover) : null,
    };
  }

  return {
    status: daysCover === null ? "NORMAL" : "HEALTHY",
    reason: "Selling at a normal pace with no aging, overstock, or understock signals.",
    daysCover: daysCover !== null ? round1(daysCover) : null,
  };
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
