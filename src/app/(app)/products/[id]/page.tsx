import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Table, Thead, Tbody, Tr, Th, Td, EmptyRow } from "@/components/ui/Table";
import { stockStatusLabel, stockStatusLevel } from "@/lib/ui/status";
import { formatINR } from "@/lib/ui/format";
import type { StockStatus } from "@/lib/enums";

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const { id } = await params;

  const product = await prisma.product.findFirst({
    where: { id, businessId: user.businessId },
    include: {
      brand: true,
      category: true,
      supplier: true,
      skus: { include: { inventory: true } },
    },
  });
  if (!product) notFound();

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-text-muted">
          {product.brand?.name} {product.category ? `· ${product.category.name}` : ""}
        </p>
        <h1 className="text-lg font-semibold text-text">{product.name}</h1>
        <p className="text-sm text-text-muted">Supplier: {product.supplier?.name ?? "—"}</p>
      </div>

      <Card padding="p-0">
        <div className="p-5 pb-0">
          <CardHeader title="SKU Variants" />
        </div>
        <Table>
          <Thead>
            <Th>SKU</Th>
            <Th>Size / Colour</Th>
            <Th className="text-right">On Hand</Th>
            <Th className="text-right">Value</Th>
            <Th>Status</Th>
          </Thead>
          <Tbody>
            {product.skus.length === 0 && <EmptyRow colSpan={5} message="No SKUs for this product." />}
            {product.skus.map((sku) => (
              <Tr key={sku.id}>
                <Td className="font-mono text-xs">
                  <Link href={`/inventory/${sku.id}`} className="text-text hover:text-primary">
                    {sku.code}
                  </Link>
                </Td>
                <Td>{sku.size ?? sku.color ?? "—"}</Td>
                <Td className="text-right tabular-nums">{sku.inventory?.currentQuantity ?? 0}</Td>
                <Td className="text-right tabular-nums">{formatINR(sku.inventory ? Number(sku.inventory.inventoryValue) : 0)}</Td>
                <Td>
                  {sku.inventory ? (
                    <Badge level={stockStatusLevel(sku.inventory.status as StockStatus)}>
                      {stockStatusLabel(sku.inventory.status as StockStatus)}
                    </Badge>
                  ) : (
                    "—"
                  )}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Card>
    </div>
  );
}
