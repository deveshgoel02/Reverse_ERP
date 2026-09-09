import { prisma } from "@/lib/db";

/**
 * All read queries for Module A (Executive Dashboard), which the spec says
 * must answer 7 questions within a few seconds. Everything here reads
 * already-computed state (Inventory.status, Recommendation, Alert,
 * Forecast) written by the intelligence pipeline — no on-the-fly
 * recomputation in the request path.
 */
export async function getDashboardData(businessId: string) {
  const [
    totals,
    statusCounts,
    openAlerts,
    fastMoving,
    slowest,
    orderMore,
    orderLess,
    upcomingDeadlines,
    salesLast30,
    salesPrior30,
  ] = await Promise.all([
    getTotals(businessId),
    getStatusCounts(businessId),
    getOpenAlerts(businessId),
    getTopByVelocity(businessId, "desc"),
    getTopByVelocity(businessId, "asc"),
    getTopRecommendations(businessId, "ORDER_MORE"),
    getTopRecommendations(businessId, ["ORDER_LESS", "DO_NOT_ORDER"]),
    getUpcomingDeadlines(businessId),
    getSalesValueSince(businessId, 30),
    getSalesValueSince(businessId, 60, 30),
  ]);

  return {
    totals,
    statusCounts,
    openAlerts,
    fastMoving,
    slowest,
    orderMore,
    orderLess,
    upcomingDeadlines,
    salesLast30,
    salesPrior30,
  };
}

async function getTotals(businessId: string) {
  const skus = await prisma.sku.findMany({
    where: { businessId, status: "ACTIVE" },
    select: { inventory: { select: { currentQuantity: true, inventoryValue: true } } },
  });
  const totalUnits = skus.reduce((sum, s) => sum + (s.inventory?.currentQuantity ?? 0), 0);
  const totalValue = skus.reduce((sum, s) => sum + (s.inventory ? Number(s.inventory.inventoryValue) : 0), 0);
  return { totalUnits, totalValue, skuCount: skus.length };
}

async function getStatusCounts(businessId: string) {
  const rows = await prisma.inventory.groupBy({
    by: ["status"],
    where: { sku: { businessId, status: "ACTIVE" } },
    _count: true,
    _sum: { currentQuantity: true, inventoryValue: true },
  });
  return rows.map((r) => ({
    status: r.status,
    count: r._count,
    units: r._sum.currentQuantity ?? 0,
    value: Number(r._sum.inventoryValue ?? 0),
  }));
}

async function getOpenAlerts(businessId: string) {
  return prisma.alert.findMany({
    where: { businessId, status: "OPEN" },
    orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    take: 8,
  });
}

async function getTopByVelocity(businessId: string, direction: "asc" | "desc") {
  // Approximate "fastest/slowest selling" from the trailing-60-day quantity already
  // summarized in Inventory via the classification pass isn't stored directly, so
  // derive it from SaleItem here, scoped to the last 60 days, and combine with product info.
  const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  const grouped = await prisma.saleItem.groupBy({
    by: ["skuId"],
    where: { sale: { businessId, saleDate: { gte: since } } },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: direction } },
    take: 6,
  });
  const skuIds = grouped.map((g) => g.skuId);
  if (skuIds.length === 0) return [];
  const skus = await prisma.sku.findMany({
    where: { id: { in: skuIds } },
    include: { product: { include: { brand: true } } },
  });
  const skuMap = new Map(skus.map((s) => [s.id, s]));
  return grouped
    .map((g) => {
      const sku = skuMap.get(g.skuId);
      if (!sku) return null;
      return {
        skuId: g.skuId,
        code: sku.code,
        productName: sku.product.name,
        brand: sku.product.brand?.name ?? "—",
        unitsSold60d: g._sum.quantity ?? 0,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

async function getTopRecommendations(businessId: string, type: string | string[]) {
  return prisma.recommendation.findMany({
    where: {
      businessId,
      status: "PENDING",
      type: Array.isArray(type) ? { in: type } : type,
    },
    include: { sku: { include: { product: { include: { brand: true } } } } },
    orderBy: { generatedAt: "desc" },
    take: 6,
  });
}

async function getUpcomingDeadlines(businessId: string) {
  return prisma.stockDeadline.findMany({
    where: { businessId, status: "OPEN" },
    include: { sku: { include: { product: true } } },
    orderBy: { deadlineDate: "asc" },
    take: 6,
  });
}

/** Total sale value in a trailing window, optionally offset (for period-over-period comparison). */
async function getSalesValueSince(businessId: string, daysBack: number, offsetDays = 0): Promise<number> {
  const end = offsetDays > 0 ? new Date(Date.now() - offsetDays * 24 * 60 * 60 * 1000) : new Date();
  const start = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
  const result = await prisma.saleItem.aggregate({
    where: { sale: { businessId, saleDate: { gte: start, lt: end } } },
    _sum: { totalAmount: true },
  });
  return Number(result._sum.totalAmount ?? 0);
}
