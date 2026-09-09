import { describe, expect, it } from "vitest";
import { classifyStock } from "@/lib/analytics/classify";
import { DEFAULT_SETTINGS } from "@/lib/settings/defaults";

const base = {
  currentQuantity: 50,
  daysSinceLastSale: 10,
  recentVelocity: 2,
  unitsSoldInDeadStockWindow: 20,
  stockAgeDays: 30,
};

describe("classifyStock", () => {
  it("classifies zero stock as OUT_OF_STOCK regardless of history", () => {
    const result = classifyStock({ ...base, currentQuantity: 0 }, DEFAULT_SETTINGS);
    expect(result.status).toBe("OUT_OF_STOCK");
  });

  it("classifies never-sold aged stock as DEAD_STOCK", () => {
    const result = classifyStock(
      { ...base, daysSinceLastSale: null, stockAgeDays: 200, unitsSoldInDeadStockWindow: 0 },
      DEFAULT_SETTINGS,
    );
    expect(result.status).toBe("DEAD_STOCK");
  });

  it("classifies long-unsold, barely-moving stock as DEAD_STOCK", () => {
    const result = classifyStock(
      { ...base, daysSinceLastSale: 200, unitsSoldInDeadStockWindow: 1 },
      DEFAULT_SETTINGS,
    );
    expect(result.status).toBe("DEAD_STOCK");
  });

  it("does not call it dead stock if enough units still sold recently despite the gap", () => {
    const result = classifyStock(
      { ...base, daysSinceLastSale: 200, unitsSoldInDeadStockWindow: 10 },
      DEFAULT_SETTINGS,
    );
    expect(result.status).not.toBe("DEAD_STOCK");
  });

  it("classifies mid-range staleness as AT_RISK before SLOW_MOVING threshold", () => {
    const result = classifyStock({ ...base, daysSinceLastSale: 160 }, DEFAULT_SETTINGS);
    expect(result.status).toBe("AT_RISK");
  });

  it("classifies moderate staleness as SLOW_MOVING", () => {
    const result = classifyStock({ ...base, daysSinceLastSale: 100 }, DEFAULT_SETTINGS);
    expect(result.status).toBe("SLOW_MOVING");
  });

  it("classifies high days-cover as OVERSTOCKED", () => {
    const result = classifyStock(
      { ...base, currentQuantity: 500, recentVelocity: 1, daysSinceLastSale: 5 },
      DEFAULT_SETTINGS,
    );
    expect(result.status).toBe("OVERSTOCKED");
  });

  it("classifies low days-cover as UNDERSTOCKED", () => {
    const result = classifyStock(
      { ...base, currentQuantity: 5, recentVelocity: 2, daysSinceLastSale: 1 },
      DEFAULT_SETTINGS,
    );
    expect(result.status).toBe("UNDERSTOCKED");
  });

  it("classifies high relative velocity as FAST_MOVING", () => {
    // daysCover = 200/10 = 20, inside the healthy 14-120 day-cover band, so
    // this only reaches FAST_MOVING and isn't short-circuited by UNDERSTOCKED.
    const result = classifyStock(
      { ...base, currentQuantity: 200, recentVelocity: 10, daysSinceLastSale: 1, categoryAverageVelocity: 2 },
      DEFAULT_SETTINGS,
    );
    expect(result.status).toBe("FAST_MOVING");
  });

  it("falls back to HEALTHY when nothing else applies", () => {
    const result = classifyStock(
      { ...base, currentQuantity: 60, recentVelocity: 1, daysSinceLastSale: 2 },
      DEFAULT_SETTINGS,
    );
    expect(result.status).toBe("HEALTHY");
  });
});
