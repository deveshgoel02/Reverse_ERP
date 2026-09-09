/** Small, dependency-free statistics helpers used by the forecasting engine. */

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/** Coefficient of variation — a scale-independent measure of demand variability. */
export function coefficientOfVariation(values: number[]): number {
  const m = mean(values);
  if (m === 0) return 0;
  return stddev(values) / m;
}

export function simpleMovingAverage(values: number[], window?: number): number {
  const slice = window ? values.slice(-window) : values;
  return mean(slice);
}

/** Weighted moving average: most-recent period gets the highest weight. */
export function weightedMovingAverage(values: number[]): number {
  if (values.length === 0) return 0;
  const weights = values.map((_, i) => i + 1); // 1..n, n = most recent
  const weightSum = weights.reduce((a, b) => a + b, 0);
  return values.reduce((sum, v, i) => sum + v * weights[i], 0) / weightSum;
}

/** Single exponential smoothing. Returns the smoothed level after the last observation
 * (i.e. the one-step-ahead forecast), plus the full smoothed series for residual analysis. */
export function exponentialSmoothing(
  values: number[],
  alpha = 0.4,
): { forecast: number; series: number[] } {
  if (values.length === 0) return { forecast: 0, series: [] };
  const series: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    series.push(alpha * values[i] + (1 - alpha) * series[i - 1]);
  }
  return { forecast: series[series.length - 1], series };
}

export interface LinearRegressionResult {
  slope: number;
  intercept: number;
  /** R^2, 0..1 — how well the line fits (proxy for trend confidence). */
  rSquared: number;
}

/** Ordinary least squares over index (0..n-1) vs. value. */
export function linearRegression(values: number[]): LinearRegressionResult {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] ?? 0, rSquared: 0 };

  const xs = values.map((_, i) => i);
  const xMean = mean(xs);
  const yMean = mean(values);

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xMean) * (values[i] - yMean);
    den += (xs[i] - xMean) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = yMean - slope * xMean;

  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const predicted = intercept + slope * xs[i];
    ssRes += (values[i] - predicted) ** 2;
    ssTot += (values[i] - yMean) ** 2;
  }
  const rSquared = ssTot === 0 ? 0 : Math.max(0, 1 - ssRes / ssTot);

  return { slope, intercept, rSquared };
}

/**
 * Very small-sample seasonality check: groups values by position within a
 * `periodLength` cycle (e.g. 12 for months) and compares between-group
 * variance to within-group variance (a simplified one-way ANOVA F-ratio
 * proxy). Requires at least 2 full cycles of data to say anything.
 */
export function detectSeasonality(values: number[], periodLength = 12): boolean {
  if (values.length < periodLength * 2) return false;

  const groups: number[][] = Array.from({ length: periodLength }, () => []);
  values.forEach((v, i) => groups[i % periodLength].push(v));

  const groupMeans = groups.map((g) => mean(g));
  const overallMean = mean(values);

  const betweenGroupVariance = mean(groupMeans.map((gm) => (gm - overallMean) ** 2));
  const withinGroupVariance = mean(
    groups.flatMap((g, i) => g.map((v) => (v - groupMeans[i]) ** 2)),
  );

  if (withinGroupVariance === 0) return betweenGroupVariance > 0;
  const fRatio = betweenGroupVariance / withinGroupVariance;
  // Heuristic threshold — this is a lightweight signal for method selection,
  // not a formal significance test.
  return fRatio > 1.0;
}
