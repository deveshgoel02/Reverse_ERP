import { prisma } from "@/lib/db";
import type { Allotment } from "@prisma/client";

export interface AllotmentProgress {
  soldQty: number;
  remainingQty: number;
  percent: number;
}

type ProgressInput = Pick<Allotment, "id" | "salesmanId" | "customerId" | "brandId" | "createdAt" | "targetQuantity">;

/**
 * Live progress for one allotment: units of `brand` sold to `customer` by
 * `salesman` since the allotment was created. Computed from real
 * Sale/SaleItem records — never a stored counter — so it stays correct
 * even if sales are edited, backdated, or imported after the fact.
 */
export async function getAllotmentProgress(allotment: ProgressInput): Promise<AllotmentProgress> {
  // Sale.saleDate is a date (stored at UTC midnight), while createdAt carries
  // a time of day — comparing them directly would exclude same-day sales
  // recorded before the allotment's exact creation timestamp (a sale dated
  // today, entered at 10am, against an allotment created at 1pm today).
  // Use the start of the allotment's creation day instead.
  const startOfCreationDay = new Date(allotment.createdAt);
  startOfCreationDay.setUTCHours(0, 0, 0, 0);

  const result = await prisma.saleItem.aggregate({
    where: {
      sku: { product: { brandId: allotment.brandId } },
      sale: {
        salesmanId: allotment.salesmanId,
        customerId: allotment.customerId,
        saleDate: { gte: startOfCreationDay },
      },
    },
    _sum: { quantity: true },
  });
  const soldQty = result._sum.quantity ?? 0;
  const remainingQty = Math.max(allotment.targetQuantity - soldQty, 0);
  const percent = allotment.targetQuantity > 0 ? Math.min(100, Math.round((soldQty / allotment.targetQuantity) * 100)) : 0;
  return { soldQty, remainingQty, percent };
}

/** Batch version for list pages — one query per allotment, run concurrently. */
export async function getAllotmentProgressBatch(allotments: ProgressInput[]): Promise<Map<string, AllotmentProgress>> {
  const entries = await Promise.all(allotments.map(async (a) => [a.id, await getAllotmentProgress(a)] as const));
  return new Map(entries);
}
