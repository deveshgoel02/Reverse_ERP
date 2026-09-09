import { prisma } from "@/lib/db";
import type { HistoricalDemandPoint } from "@/lib/forecasting/forecast";

/** Groups a SKU's sold quantities by calendar month, oldest first. Only returns months that actually have data — never fabricates zero-filled gaps, per spec Module 3 ("never fabricate historical data"). */
export async function getMonthlyDemandForSku(skuId: string): Promise<HistoricalDemandPoint[]> {
  const items = await prisma.saleItem.findMany({
    where: { skuId },
    select: { quantity: true, sale: { select: { saleDate: true } } },
  });

  const byMonth = new Map<string, number>();
  for (const item of items) {
    const d = item.sale.saleDate;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    byMonth.set(key, (byMonth.get(key) ?? 0) + item.quantity);
  }

  return Array.from(byMonth.entries())
    .map(([key, quantity]) => {
      const [year, month] = key.split("-").map(Number);
      return { periodStart: new Date(year, month - 1, 1), quantity };
    })
    .sort((a, b) => a.periodStart.getTime() - b.periodStart.getTime());
}

/** Average units sold per day over the trailing `windowDays`. */
export async function getRecentVelocity(skuId: string, windowDays = 60): Promise<number> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const result = await prisma.saleItem.aggregate({
    where: { skuId, sale: { saleDate: { gte: since } } },
    _sum: { quantity: true },
  });
  return (result._sum.quantity ?? 0) / windowDays;
}

export async function getDaysSinceLastSale(skuId: string): Promise<number | null> {
  const inventory = await prisma.inventory.findUnique({ where: { skuId }, select: { lastSaleAt: true } });
  if (!inventory?.lastSaleAt) return null;
  return Math.floor((Date.now() - inventory.lastSaleAt.getTime()) / (1000 * 60 * 60 * 24));
}

export async function getUnitsSoldSince(skuId: string, days: number): Promise<number> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const result = await prisma.saleItem.aggregate({
    where: { skuId, sale: { saleDate: { gte: since } } },
    _sum: { quantity: true },
  });
  return result._sum.quantity ?? 0;
}

/** Average recent velocity across all active SKUs in a category, for relative fast-moving comparison. */
export async function getCategoryAverageVelocity(categoryId: string | null, windowDays = 60): Promise<number> {
  if (!categoryId) return 0;
  const skus = await prisma.sku.findMany({
    where: { product: { categoryId }, status: "ACTIVE" },
    select: { id: true },
  });
  if (skus.length === 0) return 0;
  const velocities = await Promise.all(skus.map((s) => getRecentVelocity(s.id, windowDays)));
  return velocities.reduce((a, b) => a + b, 0) / velocities.length;
}

/** Quantity already on order (not yet received) from open/partial purchases for a SKU. */
export async function getIncomingStock(skuId: string): Promise<number> {
  const items = await prisma.purchaseItem.findMany({
    where: {
      skuId,
      purchase: { status: { in: ["PENDING", "PARTIALLY_RECEIVED"] } },
    },
    select: { quantityOrdered: true, quantityReceived: true },
  });
  return items.reduce((sum, i) => sum + Math.max(0, i.quantityOrdered - i.quantityReceived), 0);
}
