import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { Card } from "@/components/ui/Card";
import { Table, Thead, Tbody, Tr, Th, Td, EmptyRow } from "@/components/ui/Table";

export default async function ProductsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const products = await prisma.product.findMany({
    where: { businessId: user.businessId, status: "ACTIVE" },
    include: { brand: true, category: true, skus: { include: { inventory: true } } },
    orderBy: { name: "asc" },
    take: 200,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text">Products</h1>
          <p className="text-sm text-text-muted">{products.length} active products, grouped by SKU variants.</p>
        </div>
        <Link href="/products/matches" className="text-sm text-primary hover:underline">
          Review possible duplicates →
        </Link>
      </div>

      <Card padding="p-0">
        <Table>
          <Thead>
            <Th>Product</Th>
            <Th>Brand</Th>
            <Th>Category</Th>
            <Th>Gender</Th>
            <Th className="text-right">SKUs</Th>
            <Th className="text-right">Total Stock</Th>
          </Thead>
          <Tbody>
            {products.length === 0 && <EmptyRow colSpan={6} message="No products yet." />}
            {products.map((p) => {
              const totalStock = p.skus.reduce((sum, s) => sum + (s.inventory?.currentQuantity ?? 0), 0);
              return (
                <Tr key={p.id}>
                  <Td>
                    <Link href={`/products/${p.id}`} className="font-medium text-text hover:text-primary">
                      {p.name}
                    </Link>
                  </Td>
                  <Td>{p.brand?.name ?? "—"}</Td>
                  <Td>{p.category?.name ?? "—"}</Td>
                  <Td>{p.gender ?? "—"}</Td>
                  <Td className="text-right tabular-nums">{p.skus.length}</Td>
                  <Td className="text-right tabular-nums">{totalStock}</Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>
      </Card>
    </div>
  );
}
