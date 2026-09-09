import { describe, expect, it } from "vitest";
import { forecastDemand, projectForecastAcrossPeriods } from "@/lib/forecasting/forecast";
import {
  coefficientOfVariation,
  detectSeasonality,
  linearRegression,
  mean,
  stddev,
} from "@/lib/forecasting/statistics";

function monthly(values: number[]) {
  return values.map((quantity, i) => ({
    periodStart: new Date(2024, i, 1),
    quantity,
  }));
}

describe("statistics", () => {
  it("mean/stddev handle empty and single-value arrays", () => {
    expect(mean([])).toBe(0);
    expect(stddev([5])).toBe(0);
    expect(mean([2, 4, 6])).toBe(4);
  });

  it("coefficientOfVariation is 0 for a flat series", () => {
    expect(coefficientOfVariation([10, 10, 10, 10])).toBe(0);
  });

  it("linearRegression fits a perfect line exactly", () => {
    const { slope, intercept, rSquared } = linearRegression([10, 20, 30, 40, 50]);
    expect(slope).toBeCloseTo(10, 5);
    expect(intercept).toBeCloseTo(10, 5);
    expect(rSquared).toBeCloseTo(1, 5);
  });

  it("detectSeasonality requires at least 2 full cycles", () => {
    expect(detectSeasonality([1, 2, 3], 12)).toBe(false);
  });

  it("detectSeasonality finds a repeating annual spike", () => {
    const base = [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 50];
    const twoYears = [...base, ...base];
    expect(detectSeasonality(twoYears, 12)).toBe(true);
  });
});

describe("forecastDemand", () => {
  it("returns INSUFFICIENT_DATA for 0 or 1 historical points", () => {
    expect(forecastDemand([]).method).toBe("INSUFFICIENT_DATA");
    expect(forecastDemand(monthly([50])).method).toBe("INSUFFICIENT_DATA");
  });

  it("never fabricates confidence with sparse data", () => {
    const result = forecastDemand(monthly([50, 60]));
    expect(result.confidence).toBe("LOW");
  });

  it("uses MOVING_AVERAGE for 2-3 points", () => {
    const result = forecastDemand(monthly([100, 120, 110]));
    expect(result.method).toBe("MOVING_AVERAGE");
    expect(result.expectedDemand).toBeCloseTo(110, 0);
  });

  it("detects a clear increasing trend with enough points", () => {
    const result = forecastDemand(monthly([100, 110, 121, 133, 146, 160]));
    expect(result.trend).toBe("INCREASING");
    expect(result.method).toBe("LINEAR_REGRESSION");
    expect(result.expectedDemand).toBeGreaterThan(160);
  });

  it("detects a clear decreasing trend", () => {
    const result = forecastDemand(monthly([200, 180, 160, 140, 120, 100]));
    expect(result.trend).toBe("DECREASING");
    expect(result.expectedDemand).toBeLessThan(100);
  });

  it("treats flat, stable demand as STABLE with high confidence", () => {
    const result = forecastDemand(monthly([100, 102, 98, 101, 99, 100, 103, 97, 100, 101, 99, 100]));
    expect(result.trend).toBe("STABLE");
    expect(result.confidence).toBe("HIGH");
  });

  it("never returns a negative lower bound", () => {
    const result = forecastDemand(monthly([5, 30, 2, 40, 1, 35]));
    expect(result.lowerBound).toBeGreaterThanOrEqual(0);
  });

  it("expected demand is always non-negative", () => {
    const result = forecastDemand(monthly([50, 40, 30, 20, 10, 5]));
    expect(result.expectedDemand).toBeGreaterThanOrEqual(0);
  });

  it("picks up on seasonality with 2 years of data", () => {
    const base = [20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 100];
    const twoYears = monthly([...base, ...base]);
    const result = forecastDemand(twoYears);
    expect(result.method).toBe("SEASONAL_NAIVE");
    expect(result.trend).toBe("SEASONAL");
  });
});

describe("projectForecastAcrossPeriods", () => {
  it("scales the point forecast and widens the range for a longer horizon", () => {
    const single = forecastDemand(monthly([100, 102, 98, 101, 99, 100, 103, 97, 100, 101, 99, 100]));
    const quarter = projectForecastAcrossPeriods(single, 3);
    expect(quarter.expectedDemand).toBeCloseTo(single.expectedDemand * 3, 0);
    const singleSpread = single.upperBound - single.expectedDemand;
    const quarterSpread = quarter.upperBound - quarter.expectedDemand;
    expect(quarterSpread).toBeGreaterThan(singleSpread);
  });
});
