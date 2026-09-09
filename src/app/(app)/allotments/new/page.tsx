import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { NewAllotmentForm } from "./NewAllotmentForm";

export default async function NewAllotmentPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [salesmen, customers, brands] = await Promise.all([
    prisma.salesman.findMany({ where: { businessId: user.businessId, active: true }, orderBy: { name: "asc" } }),
    prisma.customer.findMany({ where: { businessId: user.businessId }, orderBy: { name: "asc" } }),
    prisma.brand.findMany({ where: { businessId: user.businessId }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-text">New Allotment</h1>
      </div>
      <NewAllotmentForm
        salesmen={salesmen.map((s) => ({ id: s.id, name: s.name }))}
        customers={customers.map((c) => ({ id: c.id, name: c.name }))}
        brands={brands.map((b) => ({ id: b.id, name: b.name }))}
      />
    </div>
  );
}
