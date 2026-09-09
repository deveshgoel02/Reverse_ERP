import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit/log";

/**
 * Merges mergeProductId into keepProductId: every SKU moves to the
 * surviving product, the losing product is marked MERGED (never deleted —
 * its history stays intact and traceable via mergedIntoId), and the merge
 * is written to the audit log. Only ever called from an explicit owner
 * confirmation (src/app/(app)/products/matches/actions.ts) — Module F:
 * "show possible matches... the owner should be able to confirm/merge/reject."
 */
export async function mergeProducts(businessId: string, actorId: string, keepProductId: string, mergeProductId: string) {
  if (keepProductId === mergeProductId) throw new Error("Cannot merge a product into itself.");

  const [keep, merge] = await Promise.all([
    prisma.product.findFirst({ where: { id: keepProductId, businessId } }),
    prisma.product.findFirst({ where: { id: mergeProductId, businessId } }),
  ]);
  if (!keep || !merge) throw new Error("Product not found.");

  await prisma.$transaction([
    prisma.sku.updateMany({ where: { productId: mergeProductId }, data: { productId: keepProductId } }),
    prisma.product.update({ where: { id: mergeProductId }, data: { status: "MERGED", mergedIntoId: keepProductId } }),
  ]);

  await writeAuditLog({
    businessId,
    actorId,
    action: "MERGE",
    entityType: "Product",
    entityId: mergeProductId,
    previousValue: { status: merge.status },
    newValue: { status: "MERGED", mergedIntoId: keepProductId },
    note: `Merged "${merge.name}" into "${keep.name}"`,
  });
}
