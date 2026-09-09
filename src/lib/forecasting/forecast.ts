import {
  coefficientOfVariation,
  detectSeasonality,
  exponentialSmoothing,
  linearRegression,
  mean,
  simpleMovingAverage,
  stddev,
} from "./statistics";
import type { Confidence, ForecastMethod, Trend } from "@/lib/enums";

export interface HistoricalDemandPoint {
  /** Start of the bucket, e.g. first of the month. */
  periodStart: Date;
  quantity: number;
}

export interface ForecastResult {
  method: ForecastMethod;
  /** Point forecast for the single next period (same bucket size as input, e.g. one month). */
  expectedDemand: number;
  lowerBound: number;
  upperBound: number;
  trend: Trend;
  confidence: Confidence;
  /** Everything needed to explain the number to a non-technical owner. */
  inputsJson: {
    periodsUsed: number;
    historicalValues: number[];
    coefficientOfVariation: number;
    trendSlope: number;
    trendRSquared: number;
    seasonalityDetected: boolean;
    note: string;
  };
}

const MIN_POINTS_FOR_ANY_FORECAST = 2;
const MIN_POINTS_FOR_TREND_METHOD = 4;
const MIN_POINTS_FOR_SEASONAL = 24; // 2 full yearly cycles of monthly data
const Z_FOR_RANGE = 1.28; // ~80% business-friendly interval, not a formal CI guarantee

/**
 * Selects a forecasting method appropriate to how much (and how stable) the
 * history is, and produces a single-next-period forecast with an explicit
 * uncertainty range. Never claims false precision: with under
 * MIN_POINTS_FOR_ANY_FORECAST points it returns method "INSUFFICIENT_DATA"
 * and the caller (src/lib/forecasting/index.ts / the UI) must say so plainly
 * rather than display a number.
 */
export function forecastDemand(history: HistoricalDemandPoint[]): ForecastResult {
  const sorted = [...history].sort((a, b) => a.periodStart.getTime() - b.periodStart.getTime());
  const values = sorted.map((p) => p.quantity);
  const n = values.length;
  const cv = coefficientOfVariation(values);

  if (n < MIN_POINTS_FOR_ANY_FORECAST) {
    const naive = values[0] ?? 0;
    return {
      method: "INSUFFICIENT_DATA",
      expectedDemand: naive,
      lowerBound: 0,
      upperBound: naive * 2,
      trend: "UNKNOWN",
      confidence: "LOW",
      inputsJson: {
        periodsUsed: n,
        historicalValues: values,
        coefficientOfVariation: cv,
        trendSlope: 0,
        trendRSquared: 0,
        seasonalityDetected: false,
        note: "Fewer than 2 historical periods available — insufficient data for a reliable forecast.",
      },
    };
  }

  if (n < MIN_POINTS_FOR_TREND_METHOD) {
    const forecast = simpleMovingAverage(values);
    const spread = Math.max(stddev(values), forecast * 0.3);
    return {
      method: "MOVING_AVERAGE",
      expectedDemand: round1(forecast),
      lowerBound: round1(Math.max(0, forecast - Z_FOR_RANGE * spread)),
      upperBound: round1(forecast + Z_FOR_RANGE * spread),
      trend: "UNKNOWN",
      confidence: "LOW",
      inputsJson: {
        periodsUsed: n,
        historicalValues: values,
        coefficientOfVariation: cv,
        trendSlope: 0,
        trendRSquared: 0,
        seasonalityDetected: false,
        note: `Only ${n} historical periods available — using a simple average with a wide range.`,
      },
    };
  }

  const seasonalityDetected = n >= MIN_POINTS_FOR_SEASONAL && detectSeasonality(values, 12);
  const regression = linearRegression(values);
  const trendStrength = Math.abs(regression.slope) > mean(values) * 0.02 && regression.rSquared > 0.4;

  let method: ForecastMethod;
  let forecast: number;
  let residuals: number[];

  if (seasonalityDetected) {
    method = "SEASONAL_NAIVE";
    const cyclePositions = values
      .map((v, i) => ({ v, phase: i % 12 }))
      .filter((p) => p.phase === n % 12)
      .map((p) => p.v);
    const seasonalBase = mean(cyclePositions.slice(-3));
    // Apply the overall trend direction as a mild adjustment to the seasonal base.
    const trendAdjustment = regression.slope * (n - (cyclePositions.length > 0 ? n - cyclePositions.length : 0));
    forecast = Math.max(0, seasonalBase + (trendStrength ? trendAdjustment * 0.3 : 0));
    residuals = values.map((v, i) => v - mean(values.filter((_, j) => j % 12 === i % 12)));
  } else if (trendStrength) {
    method = "LINEAR_REGRESSION";
    forecast = Math.max(0, regression.intercept + regression.slope * n);
    residuals = values.map((v, i) => v - (regression.intercept + regression.slope * i));
  } else {
    method = "EXPONENTIAL_SMOOTHING";
    const alpha = cv > 0.6 ? 0.6 : cv > 0.3 ? 0.4 : 0.25;
    const smoothed = exponentialSmoothing(values, alpha);
    forecast = smoothed.forecast;
    residuals = values.map((v, i) => v - smoothed.series[i]);
  }

  const residualSpread = Math.max(stddev(residuals), forecast * 0.1);

  const trend: Trend = seasonalityDetected
    ? "SEASONAL"
    : trendStrength
      ? regression.slope > 0
        ? "INCREASING"
        : "DECREASING"
      : "STABLE";

  const confidence: Confidence =
    n >= 12 && cv < 0.35
      ? "HIGH"
      : n >= 6 && cv < 0.6
        ? "MEDIUM"
        : "LOW";

  return {
    method,
    expectedDemand: round1(forecast),
    lowerBound: round1(Math.max(0, forecast - Z_FOR_RANGE * residualSpread)),
    upperBound: round1(forecast + Z_FOR_RANGE * residualSpread),
    trend,
    confidence,
    inputsJson: {
      periodsUsed: n,
      historicalValues: values,
      coefficientOfVariation: round3(cv),
      trendSlope: round3(regression.slope),
      trendRSquared: round3(regression.rSquared),
      seasonalityDetected,
      note: `${method} selected from ${n} historical periods.`,
    },
  };
}

/**
 * Projects the single-period forecast forward across multiple periods
 * (e.g. "next quarter" = 3 monthly periods). This is a deliberate
 * simplification — it scales the point forecast linearly and widens the
 * uncertainty band with the square root of the horizon (as independent-period
 * variance would) rather than re-fitting a multi-step model.
 */
export function projectForecastAcrossPeriods(
  singlePeriod: ForecastResult,
  periodsAhead: number,
): { expectedDemand: number; lowerBound: number; upperBound: number } {
  const expectedDemand = round1(singlePeriod.expectedDemand * periodsAhead);
  const perPeriodSpread = (singlePeriod.upperBound - singlePeriod.expectedDemand) / Z_FOR_RANGE;
  const widenedSpread = perPeriodSpread * Math.sqrt(periodsAhead);
  return {
    expectedDemand,
    lowerBound: round1(Math.max(0, expectedDemand - Z_FOR_RANGE * widenedSpread)),
    upperBound: round1(expectedDemand + Z_FOR_RANGE * widenedSpread),
  };
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}
