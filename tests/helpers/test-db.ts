import { prisma } from "@/lib/db";

/** Creates a throwaway business + product + SKU for an integration test. Caller cleans up via afterEach/afterAll if needed. */
export async function createTestSku(overrides?: { purchasePrice?: number }) {
  const business = await prisma.business.create({ data: { name: `Test Business ${Date.now()}-${Math.random()}` } });
  const product = await prisma.product.create({
    data: { businessId: business.id, name: "Test Product" },
  });
  const sku = await prisma.sku.create({
    data: {
      businessId: business.id,
      productId: product.id,
      code: `TEST-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      purchasePrice: overrides?.purchasePrice ?? 1000,
    },
  });
  return { business, product, sku };
}
