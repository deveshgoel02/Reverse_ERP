import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit/log";

export const createPurchaseSchema = z.object({
  supplierId: z.string().min(1),
  orderDate: z.string().min(1),
  expectedDeliveryDate: z.string().optional(),
  invoiceRef: z.string().optional(),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        skuId: z.string().min(1),
        quantityOrdered: z.coerce.number().int().positive(),
        quantityReceived: z.coerce.number().int().nonnegative().default(0),
        unitCost: z.coerce.number().nonnegative(),
      }),
    )
    .min(1, "At least one line item is required."),
});

export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;

/** Manual purchase-order entry — mirrors src/lib/import/commit.ts's PURCHASES case. */
export async function createPurchase(businessId: string, actorId: string, input: CreatePurchaseInput) {
  const supplier = await prisma.supplier.findFirst({ where: { id: input.supplierId, businessId } });
  if (!supplier) throw new Error("Supplier not found.");

  const skuIds = input.items.map((i) => i.skuId);
  const skus = await prisma.sku.findMany({ where: { id: { in: skuIds }, businessId } });
  if (skus.length !== new Set(skuIds).size) {
    throw new Error("One or more selected SKUs could not be found.");
  }

  const orderDate = new Date(input.orderDate);
  const totalOrdered = input.items.reduce((sum, i) => sum + i.quantityOrdered, 0);
  const totalReceived = input.items.reduce((sum, i) => sum + i.quantityReceived, 0);
  const status = totalReceived >= totalOrdered ? "RECEIVED" : totalReceived > 0 ? "PARTIALLY_RECEIVED" : "PENDING";

  const purchase = await prisma.purchase.create({
    data: {
      businessId,
      supplierId: input.supplierId,
      invoiceRef: input.invoiceRef || undefined,
      orderDate,
      expectedDeliveryDate: input.expectedDeliveryDate ? new Date(input.expectedDeliveryDate) : undefined,
      status,
      notes: input.notes || undefined,
      items: {
        create: input.items.map((i) => ({
          skuId: i.skuId,
          quantityOrdered: i.quantityOrdered,
          quantityReceived: i.quantityReceived,
          unitCost: i.unitCost,
        })),
      },
    },
    include: { items: true },
  });

  const receivedMovements = purchase.items.filter((i) => i.quantityReceived > 0);
  if (receivedMovements.length > 0) {
    await prisma.inventoryMovement.createMany({
      data: receivedMovements.map((item) => ({
        businessId,
        skuId: item.skuId,
        type: "PURCHASE_RECEIPT",
        quantity: item.quantityReceived,
        unitCost: item.unitCost,
        referenceType: "Purchase",
        referenceId: purchase.id,
        occurredAt: orderDate,
        createdById: actorId,
      })),
    });
  }

  await writeAuditLog({
    businessId,
    actorId,
    action: "CREATE",
    entityType: "Purchase",
    entityId: purchase.id,
    newValue: { invoiceRef: purchase.invoiceRef, status, itemCount: input.items.length },
  });

  return { purchaseId: purchase.id, skuIds: [...new Set(skuIds)] };
}
