import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

/**
 * Deterministic inventory recomputation — Module 12 of the spec:
 *   Current Stock = Opening + Purchases + TransfersIn + ReturnsIn
 *                  - Sales - TransfersOut - ReturnsOut - Damaged/Lost
 *
 * InventoryMovement rows already store signed quantities (positive = in,
 * negative = out), so currentQuantity is simply the sum of every movement
 * for the SKU. This function is the ONLY place that writes the Inventory
 * cache table; it always replays the full ledger rather than incrementing
 * in place, so it can never drift from the ledger even if a caller made a
 * mistake elsewhere. No LLM or heuristic is involved — see Module 29 of
 * the spec ("business-critical calculation rule").
 *
 * Costing simplification: inventoryValue uses a single weighted-average
 * cost across all PURCHASE_RECEIPT movements, not FIFO/LIFO lot tracking.
 * That's a deliberate MVP simplification — documented in
 * docs/DATA_MODEL.md — appropriate for a distributor at this scale.
 */
export async function recalcInventoryForSku(skuId: string): Promise<void> {
  const [movements, sku] = await Promise.all([
    prisma.inventoryMovement.findMany({
      where: { skuId },
      orderBy: { occurredAt: "asc" },
    }),
    prisma.sku.findUniqueOrThrow({ where: { id: skuId } }),
  ]);

  let quantityReceived = 0;
  let quantitySold = 0;
  let quantityReturned = 0;
  let quantityDamaged = 0;
  let currentQuantity = 0;
  let firstReceivedAt: Date | null = null;
  let lastMovementAt: Date | null = null;
  let lastSaleAt: Date | null = null;
  let costWeightedSum = 0;
  let costWeightTotal = 0;

  for (const m of movements) {
    currentQuantity += m.quantity;
    lastMovementAt = m.occurredAt;

    switch (m.type) {
      case "OPENING":
      case "PURCHASE_RECEIPT":
      case "TRANSFER_IN":
        quantityReceived += m.quantity;
        if (!firstReceivedAt) firstReceivedAt = m.occurredAt;
        if (m.type === "PURCHASE_RECEIPT" && m.unitCost) {
          costWeightedSum += Number(m.unitCost) * m.quantity;
          costWeightTotal += m.quantity;
        }
        break;
      case "SALE":
        quantitySold += Math.abs(m.quantity);
        lastSaleAt = m.occurredAt;
        break;
      case "RETURN_IN":
        quantityReturned += m.quantity;
        break;
      case "DAMAGE":
        quantityDamaged += Math.abs(m.quantity);
        break;
      // TRANSFER_OUT, RETURN_OUT, ADJUSTMENT already folded into currentQuantity above.
    }
  }

  const averageCost =
    costWeightTotal > 0 ? costWeightedSum / costWeightTotal : sku.purchasePrice ? Number(sku.purchasePrice) : 0;
  const inventoryValue = new Prisma.Decimal(Math.max(0, currentQuantity) * averageCost);

  const stockAgeDays = firstReceivedAt
    ? Math.floor((Date.now() - firstReceivedAt.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  await prisma.inventory.upsert({
    where: { skuId },
    create: {
      skuId,
      quantityReceived,
      quantitySold,
      quantityReturned,
      quantityDamaged,
      currentQuantity,
      inventoryValue,
      firstReceivedAt,
      lastMovementAt,
      lastSaleAt,
      stockAgeDays,
    },
    update: {
      quantityReceived,
      quantitySold,
      quantityReturned,
      quantityDamaged,
      currentQuantity,
      inventoryValue,
      firstReceivedAt,
      lastMovementAt,
      lastSaleAt,
      stockAgeDays,
    },
  });
}

export async function recalcInventoryForSkus(skuIds: string[]): Promise<void> {
  const unique = Array.from(new Set(skuIds));
  for (const skuId of unique) {
    await recalcInventoryForSku(skuId);
  }
}

export async function recalcInventoryForBusiness(businessId: string): Promise<void> {
  const skus = await prisma.sku.findMany({ where: { businessId }, select: { id: true } });
  await recalcInventoryForSkus(skus.map((s) => s.id));
}

/**
 * Records a new movement and immediately recomputes the affected SKU's
 * cached balance. This is the standard way the rest of the app should
 * change stock — never edit the Inventory row directly.
 */
export async function recordMovement(input: {
  businessId: string;
  skuId: string;
  type: Prisma.InventoryMovementCreateInput["type"];
  quantity: number;
  unitCost?: number | null;
  referenceType?: string | null;
  referenceId?: string | null;
  note?: string | null;
  occurredAt?: Date;
  createdById?: string | null;
}): Promise<void> {
  await prisma.inventoryMovement.create({
    data: {
      businessId: input.businessId,
      skuId: input.skuId,
      type: input.type,
      quantity: input.quantity,
      unitCost: input.unitCost ?? undefined,
      referenceType: input.referenceType ?? undefined,
      referenceId: input.referenceId ?? undefined,
      note: input.note ?? undefined,
      occurredAt: input.occurredAt ?? new Date(),
      createdById: input.createdById ?? undefined,
    },
  });
  await recalcInventoryForSku(input.skuId);
}
