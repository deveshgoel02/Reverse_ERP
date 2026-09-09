import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createSale } from "@/lib/sales/create";
import { createPurchase } from "@/lib/purchases/create";
import { recalcInventoryForSkus, recordMovement } from "@/lib/inventory/recalc";
import { createTestSku, createTestUser } from "./helpers/test-db";

describe("createSale (manual entry)", () => {
  it("creates a sale with a matching negative inventory movement", async () => {
    const { business, sku } = await createTestSku();
    const user = await createTestUser(business.id);
    await recordMovement({ businessId: business.id, skuId: sku.id, type: "OPENING", quantity: 50 });

    const result = await createSale(business.id, user.id, {
      saleDate: "2026-06-01",
      items: [{ skuId: sku.id, quantity: 5, unitPrice: 1500, discount: 0, tax: 0 }],
    });

    const movements = await prisma.inventoryMovement.findMany({ where: { referenceId: result.saleId } });
    expect(movements).toHaveLength(1);
    expect(movements[0].quantity).toBe(-5);
    expect(movements[0].type).toBe("SALE");

    const saleItems = await prisma.saleItem.findMany({ where: { saleId: result.saleId } });
    expect(saleItems[0].totalAmount.toNumber()).toBe(5 * 1500);
  });

  it("rejects a sale referencing a SKU from a different business", async () => {
    const { business: businessA } = await createTestSku();
    const userA = await createTestUser(businessA.id);
    const { sku: skuB } = await createTestSku();

    await expect(
      createSale(businessA.id, userA.id, {
        saleDate: "2026-06-01",
        items: [{ skuId: skuB.id, quantity: 1, unitPrice: 100, discount: 0, tax: 0 }],
      }),
    ).rejects.toThrow();
  });

  it("supports multiple line items in one invoice", async () => {
    const { business, sku: skuA } = await createTestSku();
    const user = await createTestUser(business.id);
    const product = await prisma.product.create({ data: { businessId: business.id, name: "Second Product" } });
    const skuC = await prisma.sku.create({ data: { businessId: business.id, productId: product.id, code: `MULTI-${Date.now()}` } });

    const result = await createSale(business.id, user.id, {
      saleDate: "2026-06-01",
      items: [
        { skuId: skuA.id, quantity: 2, unitPrice: 500, discount: 0, tax: 0 },
        { skuId: skuC.id, quantity: 3, unitPrice: 700, discount: 0, tax: 0 },
      ],
    });

    const saleItems = await prisma.saleItem.findMany({ where: { saleId: result.saleId } });
    expect(saleItems).toHaveLength(2);
    expect(result.skuIds.sort()).toEqual([skuA.id, skuC.id].sort());
  });
});

describe("createPurchase (manual entry)", () => {
  it("marks a fully-received purchase as RECEIVED and creates a receipt movement", async () => {
    const { business, sku } = await createTestSku();
    const user = await createTestUser(business.id);
    const supplier = await prisma.supplier.create({ data: { businessId: business.id, name: "Test Supplier" } });

    const result = await createPurchase(business.id, user.id, {
      supplierId: supplier.id,
      orderDate: "2026-06-01",
      items: [{ skuId: sku.id, quantityOrdered: 20, quantityReceived: 20, unitCost: 900 }],
    });

    const purchase = await prisma.purchase.findUniqueOrThrow({ where: { id: result.purchaseId } });
    expect(purchase.status).toBe("RECEIVED");

    const movements = await prisma.inventoryMovement.findMany({ where: { referenceId: result.purchaseId } });
    expect(movements).toHaveLength(1);
    expect(movements[0].quantity).toBe(20);

    await recalcInventoryForSkus([sku.id]);
    const inventory = await prisma.inventory.findUniqueOrThrow({ where: { skuId: sku.id } });
    expect(inventory.currentQuantity).toBe(20);
  });

  it("marks a partially-received purchase as PARTIALLY_RECEIVED and only moves the received quantity", async () => {
    const { business, sku } = await createTestSku();
    const user = await createTestUser(business.id);
    const supplier = await prisma.supplier.create({ data: { businessId: business.id, name: "Test Supplier" } });

    const result = await createPurchase(business.id, user.id, {
      supplierId: supplier.id,
      orderDate: "2026-06-01",
      items: [{ skuId: sku.id, quantityOrdered: 20, quantityReceived: 8, unitCost: 900 }],
    });

    const purchase = await prisma.purchase.findUniqueOrThrow({ where: { id: result.purchaseId } });
    expect(purchase.status).toBe("PARTIALLY_RECEIVED");

    const movements = await prisma.inventoryMovement.findMany({ where: { referenceId: result.purchaseId } });
    expect(movements[0].quantity).toBe(8);
  });

  it("marks a zero-received purchase as PENDING with no inventory movement", async () => {
    const { business, sku } = await createTestSku();
    const user = await createTestUser(business.id);
    const supplier = await prisma.supplier.create({ data: { businessId: business.id, name: "Test Supplier" } });

    const result = await createPurchase(business.id, user.id, {
      supplierId: supplier.id,
      orderDate: "2026-06-01",
      items: [{ skuId: sku.id, quantityOrdered: 20, quantityReceived: 0, unitCost: 900 }],
    });

    const purchase = await prisma.purchase.findUniqueOrThrow({ where: { id: result.purchaseId } });
    expect(purchase.status).toBe("PENDING");

    const movements = await prisma.inventoryMovement.findMany({ where: { referenceId: result.purchaseId } });
    expect(movements).toHaveLength(0);
  });

  it("rejects a purchase referencing a supplier from a different business", async () => {
    const { business: businessA, sku } = await createTestSku();
    const userA = await createTestUser(businessA.id);
    const { business: businessB } = await createTestSku();
    const supplierB = await prisma.supplier.create({ data: { businessId: businessB.id, name: "Other Business Supplier" } });

    await expect(
      createPurchase(businessA.id, userA.id, {
        supplierId: supplierB.id,
        orderDate: "2026-06-01",
        items: [{ skuId: sku.id, quantityOrdered: 5, quantityReceived: 5, unitCost: 100 }],
      }),
    ).rejects.toThrow();
  });
});
