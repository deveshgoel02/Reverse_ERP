import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { recalcInventoryForSku, recordMovement } from "@/lib/inventory/recalc";
import { createTestSku } from "./helpers/test-db";

describe("recalcInventoryForSku", () => {
  it("computes current quantity as the sum of signed movements", async () => {
    const { business, sku } = await createTestSku();

    await recordMovement({ businessId: business.id, skuId: sku.id, type: "OPENING", quantity: 100 });
    await recordMovement({
      businessId: business.id,
      skuId: sku.id,
      type: "PURCHASE_RECEIPT",
      quantity: 50,
      unitCost: 800,
    });
    await recordMovement({ businessId: business.id, skuId: sku.id, type: "SALE", quantity: -30 });
    await recordMovement({ businessId: business.id, skuId: sku.id, type: "DAMAGE", quantity: -5 });

    const inventory = await prisma.inventory.findUnique({ where: { skuId: sku.id } });
    expect(inventory).not.toBeNull();
    expect(inventory!.currentQuantity).toBe(100 + 50 - 30 - 5);
    expect(inventory!.quantityReceived).toBe(150);
    expect(inventory!.quantitySold).toBe(30);
    expect(inventory!.quantityDamaged).toBe(5);
  });

  it("never goes negative in inventoryValue even if oversold in the ledger", async () => {
    const { business, sku } = await createTestSku();
    await recordMovement({ businessId: business.id, skuId: sku.id, type: "OPENING", quantity: 5 });
    await recordMovement({ businessId: business.id, skuId: sku.id, type: "SALE", quantity: -10 });

    const inventory = await prisma.inventory.findUnique({ where: { skuId: sku.id } });
    expect(inventory!.currentQuantity).toBe(-5);
    expect(Number(inventory!.inventoryValue)).toBe(0);
  });

  it("is idempotent — recalculating twice gives the same result", async () => {
    const { business, sku } = await createTestSku();
    await recordMovement({ businessId: business.id, skuId: sku.id, type: "OPENING", quantity: 40 });
    await recalcInventoryForSku(sku.id);
    await recalcInventoryForSku(sku.id);

    const inventory = await prisma.inventory.findUnique({ where: { skuId: sku.id } });
    expect(inventory!.currentQuantity).toBe(40);
  });

  it("computes a weighted-average cost across purchase receipts for inventoryValue", async () => {
    const { business, sku } = await createTestSku({ purchasePrice: 0 });
    // 10 units @ 100 + 10 units @ 200 = weighted average cost 150/unit, 20 units on hand -> value 3000.
    await recordMovement({ businessId: business.id, skuId: sku.id, type: "PURCHASE_RECEIPT", quantity: 10, unitCost: 100 });
    await recordMovement({ businessId: business.id, skuId: sku.id, type: "PURCHASE_RECEIPT", quantity: 10, unitCost: 200 });

    const inventory = await prisma.inventory.findUnique({ where: { skuId: sku.id } });
    expect(inventory!.currentQuantity).toBe(20);
    expect(Number(inventory!.inventoryValue)).toBe(3000);
  });

  it("tracks lastSaleAt only from SALE movements", async () => {
    const { business, sku } = await createTestSku();
    const saleDate = new Date("2026-01-15");
    await recordMovement({ businessId: business.id, skuId: sku.id, type: "OPENING", quantity: 20, occurredAt: new Date("2026-01-01") });
    await recordMovement({ businessId: business.id, skuId: sku.id, type: "SALE", quantity: -5, occurredAt: saleDate });

    const inventory = await prisma.inventory.findUnique({ where: { skuId: sku.id } });
    expect(inventory!.lastSaleAt?.toISOString()).toBe(saleDate.toISOString());
  });
});
