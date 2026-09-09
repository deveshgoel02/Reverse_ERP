/**
 * Default configurable thresholds. Every number here is intentionally NOT
 * hard-coded into classification/alert logic — it's read through
 * getSetting() (src/lib/settings/get.ts), which checks for a
 * business/brand/category-scoped override in the Setting table before
 * falling back to these defaults. The owner can change any of these from
 * Settings without a code change.
 */
export const DEFAULT_SETTINGS = {
  /** Days since last sale, with sales still occurring recently, before a SKU is "slow moving". */
  slowMovingDays: 90,
  /** Days since last sale before a SKU is considered "at risk". */
  atRiskDays: 150,
  /** Days since last sale (and near-zero recent velocity) before "dead stock". */
  deadStockDays: 180,
  /** Minimum units sold in the dead-stock lookback window to NOT be dead stock even past deadStockDays. */
  deadStockMinUnitsSold: 3,
  /** Sales-velocity percentile (of category) above which a SKU is "fast moving". */
  fastMovingVelocityMultiplier: 1.5,
  /** Days of inventory cover above which stock is "overstocked" (currentQty / recent daily velocity). */
  overstockedDaysCover: 120,
  /** Days of inventory cover below which stock is "understocked" relative to demand. */
  understockedDaysCover: 14,
  /** Alert lead times (days before a stock deadline) at which to raise an alert. */
  deadlineAlertWindowsDays: [30, 14, 7],
  /** Default safety-stock days used in reorder point calc when a SKU has no override. */
  defaultSafetyStockDays: 14,
  /** Default supplier lead time (days) used when a supplier has none recorded. */
  defaultLeadTimeDays: 21,
  /** Minimum number of historical demand periods (months) required before trusting a non-naive forecast method. */
  minPeriodsForTrendForecast: 4,
  /** Sales decline/spike alert threshold, as a fractional change vs. prior comparable period. */
  salesChangeAlertThreshold: 0.3,
  /** High inventory exposure threshold, as ₹ value per brand, above which an alert is raised. */
  highExposureValueThreshold: 500000,
  /** If available stock (on-hand + incoming) exceeds the reorder point by this multiple, recommend ordering less rather than just "maintain". */
  reorderExcessMultiplier: 1.5,
} as const;

export type SettingsShape = typeof DEFAULT_SETTINGS;
export type SettingKey = keyof SettingsShape;
