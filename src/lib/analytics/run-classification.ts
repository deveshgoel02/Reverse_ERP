import { prisma } from "@/lib/db";
import { classifyStock } from "./classify";
import { getCategoryAverageVelocity, getDaysSinceLastSale, getRecentVelocity, getUnitsSoldSince } from "./aggregate";
import { getSettings } from "@/lib/settings/get";
import type { StockStatus } from "@/lib/enums";

export interface ClassificationRunResult {
  skuId: string;
  skuCode: string;
  status: StockStatus;
  reason: string;
}

/**
 * Runs Module K's stock classification for every SKU in a business and
 * persists the result onto Inventory.status. Intended to run after any
 * import/sale/purchase batch, or on a schedule — see docs/ARCHITECTURE.md
 * "Recompute pipeline".
 */
export async function classifyAllSkusForBusiness(businessId: string): Promise<ClassificationRunResult[]> {
  const skus = await prisma.sku.findMany({
    where: { businessId, status: "ACTIVE" },
    include: { inventory: true, product: { select: { categoryId: true } } },
  });

  const results: ClassificationRunResult[] = [];
  const categoryVelocityCache = new Map<string, number>();

  for (const sku of skus) {
    if (!sku.inventory) continue;
    const settings = await getSettings(businessId, { categoryId: sku.product.categoryId ?? undefined });

    const categoryId = sku.product.categoryId;
    let categoryAverageVelocity: number | undefined;
    if (categoryId) {
      if (!categoryVelocityCache.has(categoryId)) {
        categoryVelocityCache.set(categoryId, await getCategoryAverageVelocity(categoryId));
      }
      categoryAverageVelocity = categoryVelocityCache.get(categoryId);
    }

    const [daysSinceLastSale, recentVelocity, unitsSoldInDeadStockWindow] = await Promise.all([
      getDaysSinceLastSale(sku.id),
      getRecentVelocity(sku.id, 60),
      getUnitsSoldSince(sku.id, settings.deadStockDays),
    ]);

    const result = classifyStock(
      {
        currentQuantity: sku.inventory.currentQuantity,
        daysSinceLastSale,
        recentVelocity,
        unitsSoldInDeadStockWindow,
        categoryAverageVelocity,
        stockAgeDays: sku.inventory.stockAgeDays,
      },
      settings,
    );

    await prisma.inventory.update({ where: { skuId: sku.id }, data: { status: result.status } });
    results.push({ skuId: sku.id, skuCode: sku.code, status: result.status, reason: result.reason });
  }

  return results;
}
