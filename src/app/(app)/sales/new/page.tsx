import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { NewSaleForm } from "./NewSaleForm";

export default async function NewSalePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [customers, skus] = await Promise.all([
    prisma.customer.findMany({ where: { businessId: user.businessId }, orderBy: { name: "asc" } }),
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
        <h1 className="text-lg font-semibold text-text">Record a Sale</h1>
        <p className="text-sm text-text-muted">For one-off manual entries. Bulk historical sales should go through Import Data.</p>
      </div>
      <NewSaleForm
        customers={customers.map((c) => ({ id: c.id, name: c.name }))}
        skus={skus.map((s) => ({ id: s.id, label: `${s.product.name} (${s.code})`, sellingPrice: s.sellingPrice ? Number(s.sellingPrice) : 0 }))}
      />
    </div>
  );
}
