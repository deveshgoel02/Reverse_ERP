import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Table, Thead, Tbody, Tr, Th, Td, EmptyRow } from "@/components/ui/Table";
import { stockStatusLabel, stockStatusLevel } from "@/lib/ui/status";
import { formatINR } from "@/lib/ui/format";
import type { StockStatus } from "@/lib/enums";

const STATUS_FILTERS: (StockStatus | "ALL")[] = [
  "ALL",
  "HEALTHY",
  "FAST_MOVING",
  "SLOW_MOVING",
  "AT_RISK",
  "DEAD_STOCK",
  "OVERSTOCKED",
  "UNDERSTOCKED",
  "OUT_OF_STOCK",
];

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; brand?: string; q?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const params = await searchParams;

  const brands = await prisma.brand.findMany({ where: { businessId: user.businessId }, orderBy: { name: "asc" } });

  const skus = await prisma.sku.findMany({
    where: {
      businessId: user.businessId,
      status: "ACTIVE",
      ...(params.brand ? { product: { brandId: params.brand } } : {}),
      ...(params.q
        ? {
            OR: [
              { code: { contains: params.q } },
              { product: { name: { contains: params.q } } },
            ],
          }
        : {}),
      ...(params.status && params.status !== "ALL" ? { inventory: { status: params.status } } : {}),
    },
    include: { product: { include: { brand: true, category: true } }, inventory: true },
    orderBy: { code: "asc" },
    take: 200,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-text">Inventory</h1>
        <p className="text-sm text-text-muted">Current stock, classification, and value for every active SKU.</p>
      </div>

      <Card padding="p-3">
        <form className="flex flex-wrap items-center gap-2" method="get">
          <input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Search product or SKU code..."
            className="w-64 rounded-lg border border-border px-3 py-1.5 text-sm outline-none focus:border-primary"
          />
          <select name="brand" defaultValue={params.brand ?? ""} className="rounded-lg border border-border px-3 py-1.5 text-sm">
            <option value="">All brands</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <select name="status" defaultValue={params.status ?? "ALL"} className="rounded-lg border border-border px-3 py-1.5 text-sm">
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {s === "ALL" ? "All statuses" : stockStatusLabel(s)}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-lg bg-primary px-3.5 py-1.5 text-sm font-medium text-white">
            Filter
          </button>
          {(params.q || params.brand || (params.status && params.status !== "ALL")) && (
            <Link href="/inventory" className="text-sm text-text-muted hover:text-text">
              Clear
            </Link>
          )}
        </form>
      </Card>

      <Card padding="p-0">
        <Table>
          <Thead>
            <Th>SKU</Th>
            <Th>Product</Th>
            <Th>Brand</Th>
            <Th className="text-right">On Hand</Th>
            <Th className="text-right">Value</Th>
            <Th className="text-right">Stock Age</Th>
            <Th>Status</Th>
          </Thead>
          <Tbody>
            {skus.length === 0 && <EmptyRow colSpan={7} message="No SKUs match these filters." />}
            {skus.map((sku) => (
              <Tr key={sku.id}>
                <Td className="font-mono text-xs text-text-muted">
                  <Link href={`/inventory/${sku.id}`} className="hover:text-primary">
                    {sku.code}
                  </Link>
                </Td>
                <Td>{sku.product.name}</Td>
                <Td>{sku.product.brand?.name ?? "—"}</Td>
                <Td className="text-right tabular-nums">{sku.inventory?.currentQuantity ?? 0}</Td>
                <Td className="text-right tabular-nums">{formatINR(sku.inventory ? Number(sku.inventory.inventoryValue) : 0)}</Td>
                <Td className="text-right tabular-nums text-text-muted">
                  {sku.inventory?.stockAgeDays !== null && sku.inventory?.stockAgeDays !== undefined ? `${sku.inventory.stockAgeDays}d` : "—"}
                </Td>
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
      <p className="text-xs text-text-muted">Showing up to 200 SKUs. Use filters to narrow results.</p>
    </div>
  );
}
