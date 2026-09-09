import { mulberry32 } from "./rng";

export type DemandPattern = "GROWING" | "DECLINING" | "STABLE" | "DEAD" | "SEASONAL" | "ERRATIC";

/**
 * Synthetic monthly demand generator. Clearly labelled synthetic — see
 * prisma/seed/seed.ts header — used only to give the demo/dev database
 * something realistic-looking to compute analytics against. NEVER
 * presented as real Shoe Xpress history (spec Module 22).
 */
export function generateMonthlyDemand(pattern: DemandPattern, monthIndex: number, totalMonths: number, seed: number): number {
  const rng = mulberry32(seed * 1000 + monthIndex);
  const noise = () => (rng() - 0.5) * 6;

  switch (pattern) {
    case "GROWING": {
      const base = 8 + monthIndex * 1.1;
      return Math.max(0, Math.round(base + noise()));
    }
    case "DECLINING": {
      const base = 45 - monthIndex * 1.4;
      return Math.max(0, Math.round(base + noise()));
    }
    case "STABLE": {
      return Math.max(0, Math.round(22 + noise()));
    }
    case "DEAD": {
      // Sold briefly early on, then stopped moving — the archetypal dead-stock case.
      if (monthIndex < 3) return Math.max(0, Math.round(10 + noise()));
      return 0;
    }
    case "SEASONAL": {
      // Indian festive-season bump around Sep-Nov (month indices vary by start date; approximate with a sine wave).
      const seasonal = 14 + 20 * Math.max(0, Math.sin((2 * Math.PI * (monthIndex % 12)) / 12 + 1));
      return Math.max(0, Math.round(seasonal + noise()));
    }
    case "ERRATIC": {
      const spike = rng() > 0.75 ? randRange(rng, 30, 60) : randRange(rng, 0, 15);
      return Math.max(0, Math.round(spike));
    }
  }
}

function randRange(rng: () => number, min: number, max: number): number {
  return rng() * (max - min) + min;
}
