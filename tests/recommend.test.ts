import { describe, expect, it } from "vitest";
import { recommendOrder } from "@/lib/analytics/recommend";
import { DEFAULT_SETTINGS } from "@/lib/settings/defaults";

const base = {
  currentStock: 35,
  incomingStock: 0,
  forecastDemandDuringLeadTime: 0,
  forecastUpperBound: 0,
  forecastConfidence: "MEDIUM" as const,
  leadTimeDays: 20,
  safetyStockDays: 14,
  recentVelocity: 3,
  classification: "HEALTHY" as const,
};

describe("recommendOrder", () => {
  it("recommends ORDER_MORE when available stock can't cover lead-time demand", () => {
    const result = recommendOrder(
      { ...base, currentStock: 22, forecastDemandDuringLeadTime: 90 },
      DEFAULT_SETTINGS,
    );
    expect(result.type).toBe("ORDER_MORE");
    expect(result.recommendedQty).toBeGreaterThan(0);
  });

  it("respects minOrderQty as a floor on the recommended quantity", () => {
    const result = recommendOrder(
      { ...base, currentStock: 22, forecastDemandDuringLeadTime: 30, minOrderQty: 500 },
      DEFAULT_SETTINGS,
    );
    expect(result.type).toBe("ORDER_MORE");
    expect(result.recommendedQty).toBeGreaterThanOrEqual(500);
  });

  it("recommends DO_NOT_ORDER for dead stock with no demand gap", () => {
    const result = recommendOrder(
      { ...base, currentStock: 420, recentVelocity: 0.1, forecastDemandDuringLeadTime: 5, classification: "DEAD_STOCK" },
      DEFAULT_SETTINGS,
    );
    expect(result.type).toBe("DO_NOT_ORDER");
    expect(result.recommendedQty).toBe(0);
  });

  it("flags REVIEW_MANUALLY when dead-stock classification conflicts with a genuine demand gap", () => {
    const result = recommendOrder(
      { ...base, currentStock: 2, recentVelocity: 0.1, forecastDemandDuringLeadTime: 50, classification: "DEAD_STOCK" },
      DEFAULT_SETTINGS,
    );
    expect(result.type).toBe("REVIEW_MANUALLY");
  });

  it("recommends ORDER_LESS for overstocked classification", () => {
    const result = recommendOrder(
      { ...base, currentStock: 400, recentVelocity: 1, forecastDemandDuringLeadTime: 20, classification: "OVERSTOCKED" },
      DEFAULT_SETTINGS,
    );
    expect(result.type).toBe("ORDER_LESS");
  });

  it("recommends MAINTAIN when stock covers the reorder point without being excessive", () => {
    // reorderPoint = forecastDemand(20) + safetyStock(1*14=14) = 34.
    // 45 is above 34 (no gap) but below 34*1.5=51 (not excess enough for ORDER_LESS).
    const result = recommendOrder(
      { ...base, currentStock: 45, recentVelocity: 1, forecastDemandDuringLeadTime: 20 },
      DEFAULT_SETTINGS,
    );
    expect(result.type).toBe("MAINTAIN");
  });

  it("accounts for incoming stock already on order", () => {
    const withoutIncoming = recommendOrder(
      { ...base, currentStock: 10, forecastDemandDuringLeadTime: 90 },
      DEFAULT_SETTINGS,
    );
    const withIncoming = recommendOrder(
      { ...base, currentStock: 10, incomingStock: 80, forecastDemandDuringLeadTime: 90 },
      DEFAULT_SETTINGS,
    );
    expect(withIncoming.recommendedQty ?? 0).toBeLessThan(withoutIncoming.recommendedQty ?? 0);
  });

  it("never recommends ordering for a value that results in placing an actual order (advisory only)", () => {
    const result = recommendOrder(
      { ...base, currentStock: 22, forecastDemandDuringLeadTime: 90 },
      DEFAULT_SETTINGS,
    );
    // The result is a plain data object — calling this function has no side effects.
    expect(result).not.toHaveProperty("orderPlaced");
    expect(result.reason.length).toBeGreaterThan(0);
  });
});
