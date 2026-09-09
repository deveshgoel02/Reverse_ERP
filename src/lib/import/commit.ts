import { prisma } from "@/lib/db";
import { recalcInventoryForSkus } from "@/lib/inventory/recalc";
import { writeAuditLog } from "@/lib/audit/log";
import type { ImportEntityType } from "@/lib/enums";

type NormalizedRow = Record<string, string | number | Date | null>;

export interface CommitSummary {
  imported: number;
  rejected: number;
}

/**
 * Commits every VALID/WARNING row of a validated import into real records
 * — Module I STEP 9. Runs row-by-row with its own try/catch so one bad row
 * (e.g. a SKU code that doesn't exist yet) doesn't fail the whole batch;
 * that row is instead marked REJECTED with the reason, same as the
 * spec asks for ("show affected rows" — Module 20).
 */
export async function commitImport(importId: string, businessId: string, userId: string): Promise<CommitSummary> {
  const imp = await prisma.import.findFirstOrThrow({ where: { id: importId, businessId } });
  const rows = await prisma.importRow.findMany({
    where: { importId, status: { in: ["VALID", "WARNING"] } },
    orderBy: { rowNumber: "asc" },
  });

  const entityType = imp.entityType as ImportEntityType;
  const affectedSkuIds = new Set<string>();
  let imported = 0;
  let rejected = 0;

  for (const row of rows) {
    const normalized = row.normalizedData as NormalizedRow;
    try {
      const result = await commitRow(entityType, businessId, normalized);
      if (result.skuId) affectedSkuIds.add(result.skuId);
      await prisma.importRow.update({
        where: { id: row.id },
        data: { status: "IMPORTED", createdEntityType: result.entityType, createdEntityId: result.entityId },
      });
      imported++;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      await prisma.importRow.update({
        where: { id: row.id },
        data: { status: "REJECTED", errors: [...(row.errors as string[] | null ?? []), `Commit failed: ${message}`] },
      });
      rejected++;
    }
  }

  if (affectedSkuIds.size > 0) {
    await recalcInventoryForSkus([...affectedSkuIds]);
  }

  await prisma.import.update({
    where: { id: importId },
    data: {
      status: "IMPORTED",
      successfulRows: imported,
      rejectedRows: (imp.rejectedRows ?? 0) + rejected,
      completedAt: new Date(),
    },
  });

  await writeAuditLog({
    businessId,
    actorId: userId,
    action: "IMPORT",
    entityType: "Import",
    entityId: importId,
    newValue: { imported, rejected, filename: imp.filename, entityType: imp.entityType },
  });

  return { imported, rejected };
}

async function commitRow(
  entityType: ImportEntityType,
  businessId: string,
  n: NormalizedRow,
): Promise<{ entityType: string; entityId: string; skuId?: string }> {
  switch (entityType) {
    case "CUSTOMERS": {
      const customer = await prisma.customer.upsert({
        where: { businessId_name: { businessId, name: String(n.name) } },
        create: {
          businessId,
          name: String(n.name),
          phone: str(n.phone),
          email: str(n.email),
          city: str(n.city),
          address: str(n.address),
        },
        update: { phone: str(n.phone) ?? undefined, email: str(n.email) ?? undefined, city: str(n.city) ?? undefined },
      });
      return { entityType: "Customer", entityId: customer.id };
    }

    case "SUPPLIERS": {
      const supplier = await prisma.supplier.upsert({
        where: { businessId_name: { businessId, name: String(n.name) } },
        create: {
          businessId,
          name: String(n.name),
          phone: str(n.phone),
          email: str(n.email),
          address: str(n.address),
          leadTimeDays: n.leadTimeDays ? Number(n.leadTimeDays) : undefined,
        },
        update: { phone: str(n.phone) ?? undefined, email: str(n.email) ?? undefined },
      });
      return { entityType: "Supplier", entityId: supplier.id };
    }

    case "PRODUCTS": {
      let brandId: string | undefined;
      if (n.brandName) {
        const brand = await prisma.brand.upsert({
          where: { businessId_name: { businessId, name: String(n.brandName) } },
          create: { businessId, name: String(n.brandName) },
          update: {},
        });
        brandId = brand.id;
      }
      let categoryId: string | undefined;
      if (n.categoryName) {
        // Top-level category lookup (parentId null) can't use a compound-unique
        // upsert cleanly since SQLite/Prisma treat NULL specially in unique
        // constraints — find-then-create sidesteps it.
        const existingCategory = await prisma.category.findFirst({
          where: { businessId, parentId: null, name: String(n.categoryName) },
        });
        const category = existingCategory ?? (await prisma.category.create({ data: { businessId, name: String(n.categoryName) } }));
        categoryId = category.id;
      }

      const existingSku = await prisma.sku.findUnique({ where: { businessId_code: { businessId, code: String(n.skuCode) } } });
      let productId: string;
      if (existingSku) {
        productId = existingSku.productId;
      } else {
        const product = await prisma.product.create({
          data: { businessId, name: String(n.productName ?? n.skuCode), brandId, categoryId, gender: str(n.gender) },
        });
        productId = product.id;
      }

      const sku = await prisma.sku.upsert({
        where: { businessId_code: { businessId, code: String(n.skuCode) } },
        create: {
          businessId,
          productId,
          code: String(n.skuCode),
          size: str(n.size),
          color: str(n.color),
          purchasePrice: n.purchasePrice != null ? Number(n.purchasePrice) : undefined,
          sellingPrice: n.sellingPrice != null ? Number(n.sellingPrice) : undefined,
          mrp: n.mrp != null ? Number(n.mrp) : undefined,
        },
        update: {
          purchasePrice: n.purchasePrice != null ? Number(n.purchasePrice) : undefined,
          sellingPrice: n.sellingPrice != null ? Number(n.sellingPrice) : undefined,
          mrp: n.mrp != null ? Number(n.mrp) : undefined,
        },
      });
      return { entityType: "Sku", entityId: sku.id, skuId: sku.id };
    }

    case "INVENTORY": {
      const sku = await findSkuOrThrow(businessId, String(n.skuCode));
      const inventory = await prisma.inventory.findUnique({ where: { skuId: sku.id } });
      const currentQty = inventory?.currentQuantity ?? 0;
      const targetQty = Number(n.quantity);
      const delta = targetQty - currentQty;

      const movement = await prisma.inventoryMovement.create({
        data: {
          businessId,
          skuId: sku.id,
          type: inventory ? "ADJUSTMENT" : "OPENING",
          quantity: delta,
          referenceType: "Import",
          note: str(n.note) ?? "Stock-take import",
          occurredAt: n.asOfDate instanceof Date ? n.asOfDate : new Date(),
        },
      });
      return { entityType: "InventoryMovement", entityId: movement.id, skuId: sku.id };
    }

    case "SALES": {
      const sku = await findSkuOrThrow(businessId, String(n.skuCode));
      let customerId: string | undefined;
      if (n.customerName) {
        const customer = await prisma.customer.upsert({
          where: { businessId_name: { businessId, name: String(n.customerName) } },
          create: { businessId, name: String(n.customerName) },
          update: {},
        });
        customerId = customer.id;
      }

      const quantity = Number(n.quantity);
      const unitPrice = n.unitPrice != null ? Number(n.unitPrice) : sku.sellingPrice ? Number(sku.sellingPrice) : 0;
      const discount = n.discount != null ? Number(n.discount) : 0;
      const tax = n.tax != null ? Number(n.tax) : 0;
      const totalAmount = quantity * unitPrice - discount + tax;
      const saleDate = n.saleDate instanceof Date ? n.saleDate : new Date();

      const sale = await prisma.sale.create({
        data: {
          businessId,
          customerId,
          invoiceRef: str(n.invoiceRef),
          saleDate,
          items: { create: [{ skuId: sku.id, quantity, unitPrice, discount, tax, totalAmount }] },
        },
      });

      await prisma.inventoryMovement.create({
        data: {
          businessId,
          skuId: sku.id,
          type: "SALE",
          quantity: -quantity,
          referenceType: "Sale",
          referenceId: sale.id,
          occurredAt: saleDate,
          note: "Imported historical sale",
        },
      });
      return { entityType: "Sale", entityId: sale.id, skuId: sku.id };
    }

    case "PURCHASES": {
      const sku = await findSkuOrThrow(businessId, String(n.skuCode));
      const supplier = await prisma.supplier.upsert({
        where: { businessId_name: { businessId, name: String(n.supplierName) } },
        create: { businessId, name: String(n.supplierName) },
        update: {},
      });

      const quantityOrdered = Number(n.quantityOrdered);
      const quantityReceived = n.quantityReceived != null ? Number(n.quantityReceived) : quantityOrdered;
      const unitCost = Number(n.unitCost);
      const orderDate = n.orderDate instanceof Date ? n.orderDate : new Date();
      const status = quantityReceived >= quantityOrdered ? "RECEIVED" : quantityReceived > 0 ? "PARTIALLY_RECEIVED" : "PENDING";

      const purchase = await prisma.purchase.create({
        data: {
          businessId,
          supplierId: supplier.id,
          invoiceRef: str(n.invoiceRef),
          orderDate,
          status,
          items: { create: [{ skuId: sku.id, quantityOrdered, quantityReceived, unitCost }] },
        },
      });

      if (quantityReceived > 0) {
        await prisma.inventoryMovement.create({
          data: {
            businessId,
            skuId: sku.id,
            type: "PURCHASE_RECEIPT",
            quantity: quantityReceived,
            unitCost,
            referenceType: "Purchase",
            referenceId: purchase.id,
            occurredAt: orderDate,
            note: "Imported historical purchase",
          },
        });
      }
      return { entityType: "Purchase", entityId: purchase.id, skuId: sku.id };
    }
  }
}

async function findSkuOrThrow(businessId: string, code: string) {
  const sku = await prisma.sku.findUnique({ where: { businessId_code: { businessId, code } } });
  if (!sku) throw new Error(`SKU "${code}" does not exist yet — import a Products file first, or add it manually.`);
  return sku;
}

function str(v: string | number | Date | null | undefined): string | undefined {
  if (v === null || v === undefined) return undefined;
  return String(v);
}
