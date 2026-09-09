import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { NewPurchaseForm } from "./NewPurchaseForm";

export default async function NewPurchasePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [suppliers, skus] = await Promise.all([
    prisma.supplier.findMany({ where: { businessId: user.businessId }, orderBy: { name: "asc" } }),
    prisma.sku.findMany({
      where: { businessId: user.businessId, status: "ACTIVE" },
      include: { product: true },
      orderBy: { code: "asc" },
      take: 500,
    }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-text">Create Purchase Order</h1>
        <p className="text-sm text-text-muted">For one-off manual entries. Bulk historical purchases should go through Import Data.</p>
      </div>
      <NewPurchaseForm
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
        skus={skus.map((s) => ({ id: s.id, label: `${s.product.name} (${s.code})`, purchasePrice: s.purchasePrice ? Number(s.purchasePrice) : 0 }))}
      />
    </div>
  );
}
