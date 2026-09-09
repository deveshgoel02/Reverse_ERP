import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit/log";

export const createSaleSchema = z.object({
  customerId: z.string().optional(),
  saleDate: z.string().min(1),
  invoiceRef: z.string().optional(),
  salesperson: z.string().optional(),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        skuId: z.string().min(1),
        quantity: z.coerce.number().int().positive(),
        unitPrice: z.coerce.number().nonnegative(),
        discount: z.coerce.number().nonnegative().default(0),
        tax: z.coerce.number().nonnegative().default(0),
      }),
    )
    .min(1, "At least one line item is required."),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;

/**
 * Manual sale entry — the one-off counterpart to the bulk import path
 * (src/lib/import/commit.ts's SALES case). Deliberately mirrors that
 * logic (same movement-creation shape) so both paths produce identical,
 * consistent ledger entries.
 */
export async function createSale(businessId: string, actorId: string, input: CreateSaleInput) {
  const skuIds = input.items.map((i) => i.skuId);
  const skus = await prisma.sku.findMany({ where: { id: { in: skuIds }, businessId } });
  if (skus.length !== new Set(skuIds).size) {
    throw new Error("One or more selected SKUs could not be found.");
  }

  const saleDate = new Date(input.saleDate);
  const items = input.items.map((i) => ({
    skuId: i.skuId,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    discount: i.discount,
    tax: i.tax,
    totalAmount: i.quantity * i.unitPrice - i.discount + i.tax,
  }));

  const sale = await prisma.sale.create({
    data: {
      businessId,
      customerId: input.customerId || undefined,
      invoiceRef: input.invoiceRef || undefined,
      saleDate,
      salesperson: input.salesperson || undefined,
      notes: input.notes || undefined,
      items: { create: items },
    },
    include: { items: true },
  });

  await prisma.inventoryMovement.createMany({
    data: sale.items.map((item) => ({
      businessId,
      skuId: item.skuId,
      type: "SALE",
      quantity: -item.quantity,
      referenceType: "Sale",
      referenceId: sale.id,
      occurredAt: saleDate,
      createdById: actorId,
    })),
  });

  await writeAuditLog({
    businessId,
    actorId,
    action: "CREATE",
    entityType: "Sale",
    entityId: sale.id,
    newValue: { invoiceRef: sale.invoiceRef, itemCount: items.length },
  });

  return { saleId: sale.id, skuIds: [...new Set(skuIds)] };
}
