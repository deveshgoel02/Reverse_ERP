import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { detectProductMatchCandidates } from "@/lib/catalog/product-matching";
import { mergeProducts } from "@/lib/catalog/merge";

async function makeBusinessWithBrand() {
  const business = await prisma.business.create({ data: { name: `Test ${Date.now()}-${Math.random()}` } });
  const brand = await prisma.brand.create({ data: { businessId: business.id, name: "Adidas" } });
  const user = await prisma.user.create({
    data: { businessId: business.id, email: `u${Date.now()}${Math.random()}@test.com`, passwordHash: "x", name: "Test User" },
  });
  return { business, brand, user };
}

describe("detectProductMatchCandidates", () => {
  it("flags differently-spelled versions of the same product name", async () => {
    const { business, brand } = await makeBusinessWithBrand();
    await prisma.product.create({ data: { businessId: business.id, brandId: brand.id, name: "Adidas Campus 00s" } });
    await prisma.product.create({ data: { businessId: business.id, brandId: brand.id, name: "ADIDAS CAMPUS 00S" } });

    const created = await detectProductMatchCandidates(business.id);
    expect(created).toBe(1);

    const suggestions = await prisma.productMatchSuggestion.findMany({ where: { businessId: business.id } });
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].confidence).toBeGreaterThan(0.9);
  });

  it("does not flag clearly different products in the same brand", async () => {
    const { business, brand } = await makeBusinessWithBrand();
    await prisma.product.create({ data: { businessId: business.id, brandId: brand.id, name: "Adidas Campus 00s" } });
    await prisma.product.create({ data: { businessId: business.id, brandId: brand.id, name: "Adidas Ultraboost Light" } });

    const created = await detectProductMatchCandidates(business.id);
    expect(created).toBe(0);
  });

  it("is idempotent — running twice doesn't create duplicate suggestions", async () => {
    const { business, brand } = await makeBusinessWithBrand();
    await prisma.product.create({ data: { businessId: business.id, brandId: brand.id, name: "Reebok Club C 85" } });
    await prisma.product.create({ data: { businessId: business.id, brandId: brand.id, name: "Reebok-Club-C-85" } });

    await detectProductMatchCandidates(business.id);
    await detectProductMatchCandidates(business.id);

    const suggestions = await prisma.productMatchSuggestion.findMany({ where: { businessId: business.id } });
    expect(suggestions).toHaveLength(1);
  });
});

describe("mergeProducts", () => {
  it("moves SKUs to the surviving product and marks the loser MERGED", async () => {
    const { business, brand, user } = await makeBusinessWithBrand();
    const keep = await prisma.product.create({ data: { businessId: business.id, brandId: brand.id, name: "Adidas Campus 00s" } });
    const merge = await prisma.product.create({ data: { businessId: business.id, brandId: brand.id, name: "ADIDAS CAMPUS 00S" } });
    const sku = await prisma.sku.create({ data: { businessId: business.id, productId: merge.id, code: `SKU-${Date.now()}` } });

    await mergeProducts(business.id, user.id, keep.id, merge.id);

    const updatedSku = await prisma.sku.findUniqueOrThrow({ where: { id: sku.id } });
    expect(updatedSku.productId).toBe(keep.id);

    const updatedMergeProduct = await prisma.product.findUniqueOrThrow({ where: { id: merge.id } });
    expect(updatedMergeProduct.status).toBe("MERGED");
    expect(updatedMergeProduct.mergedIntoId).toBe(keep.id);

    const auditEntries = await prisma.auditLog.findMany({ where: { businessId: business.id, action: "MERGE" } });
    expect(auditEntries.length).toBeGreaterThan(0);
  });

  it("refuses to merge a product into itself", async () => {
    const { business, brand, user } = await makeBusinessWithBrand();
    const product = await prisma.product.create({ data: { businessId: business.id, brandId: brand.id, name: "Adidas Campus 00s" } });
    await expect(mergeProducts(business.id, user.id, product.id, product.id)).rejects.toThrow();
  });
});
