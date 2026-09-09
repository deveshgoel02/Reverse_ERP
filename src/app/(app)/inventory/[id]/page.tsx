import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StatTile } from "@/components/ui/StatTile";
import { Table, Thead, Tbody, Tr, Th, Td, EmptyRow } from "@/components/ui/Table";
import { stockStatusLabel, stockStatusLevel } from "@/lib/ui/status";
import { formatDate, formatINR } from "@/lib/ui/format";
import type { StockStatus } from "@/lib/enums";

export default async function SkuDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const { id } = await params;

  const sku = await prisma.sku.findFirst({
    where: { id, businessId: user.businessId },
    include: {
      product: { include: { brand: true, category: true, supplier: true } },
      inventory: true,
    },
  });
  if (!sku) notFound();

  const [movements, forecast, recommendation, deadlines] = await Promise.all([
    prisma.inventoryMovement.findMany({ where: { skuId: sku.id }, orderBy: { occurredAt: "desc" }, take: 30 }),
    prisma.forecast.findFirst({ where: { skuId: sku.id }, orderBy: { generatedAt: "desc" } }),
    prisma.recommendation.findFirst({ where: { skuId: sku.id, status: "PENDING" }, orderBy: { generatedAt: "desc" } }),
    prisma.stockDeadline.findMany({ where: { skuId: sku.id, status: "OPEN" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-text-muted">
          {sku.product.brand?.name} {sku.product.category ? `· ${sku.product.category.name}` : ""}
        </p>
        <h1 className="text-lg font-semibold text-text">
          {sku.product.name} <span className="font-mono text-sm text-text-muted">({sku.code})</span>
        </h1>
        <p className="text-sm text-text-muted">
          {sku.size ? `Size ${sku.size}` : ""} {sku.color ? `Colour ${sku.color}` : ""}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile
          label="Current Stock"
          value={String(sku.inventory?.currentQuantity ?? 0)}
          level={sku.inventory ? stockStatusLevel(sku.inventory.status as StockStatus) : undefined}
          levelLabel={sku.inventory ? stockStatusLabel(sku.inventory.status as StockStatus) : undefined}
        />
        <StatTile label="Inventory Value" value={formatINR(sku.inventory ? Number(sku.inventory.inventoryValue) : 0)} />
        <StatTile label="Units Sold (All Time)" value={String(sku.inventory?.quantitySold ?? 0)} />
        <StatTile label="Stock Age" value={sku.inventory?.stockAgeDays != null ? `${sku.inventory.stockAgeDays} days` : "—"} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Pricing" />
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-text-muted">Purchase Price</dt>
            <dd className="text-right">{sku.purchasePrice ? formatINR(Number(sku.purchasePrice)) : "—"}</dd>
            <dt className="text-text-muted">Selling Price</dt>
            <dd className="text-right">{sku.sellingPrice ? formatINR(Number(sku.sellingPrice)) : "—"}</dd>
            <dt className="text-text-muted">MRP</dt>
            <dd className="text-right">{sku.mrp ? formatINR(Number(sku.mrp)) : "—"}</dd>
            <dt className="text-text-muted">Supplier</dt>
            <dd className="text-right">{sku.product.supplier?.name ?? "—"}</dd>
          </dl>
        </Card>

        <Card>
          <CardHeader title="Latest Forecast" subtitle={forecast ? `Method: ${forecast.method.replace(/_/g, " ")}` : undefined} />
          {!forecast ? (
            <p className="text-sm text-text-muted">Insufficient sales history to forecast this SKU yet.</p>
          ) : (
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-text-muted">Expected Demand (next period)</dt>
              <dd className="text-right">{forecast.expectedDemand} units</dd>
              <dt className="text-text-muted">Range</dt>
              <dd className="text-right">
                {forecast.lowerBound}–{forecast.upperBound} units
              </dd>
              <dt className="text-text-muted">Trend</dt>
              <dd className="text-right">{forecast.trend}</dd>
              <dt className="text-text-muted">Confidence</dt>
              <dd className="text-right">
                <Badge level={forecast.confidence === "HIGH" ? "healthy" : forecast.confidence === "MEDIUM" ? "watch" : "neutral"}>
                  {forecast.confidence}
                </Badge>
              </dd>
            </dl>
          )}
        </Card>
      </div>

      {recommendation && (
        <Card>
          <CardHeader title="Current Recommendation" />
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-text">
                {recommendation.type.replace(/_/g, " ")}
                {recommendation.recommendedQty ? ` — ${recommendation.recommendedQty} units` : ""}
              </p>
              <p className="mt-1 text-sm text-text-muted">{recommendation.reason}</p>
            </div>
            <Badge level={recommendation.confidence === "HIGH" ? "healthy" : recommendation.confidence === "MEDIUM" ? "watch" : "neutral"}>
              {recommendation.confidence}
            </Badge>
          </div>
        </Card>
      )}

      {deadlines.length > 0 && (
        <Card>
          <CardHeader title="Open Stock Deadlines" />
          <ul className="space-y-1 text-sm">
            {deadlines.map((d) => (
              <li key={d.id} className="flex justify-between">
                <span>{d.quantity} units</span>
                <span className="text-text-muted">{formatDate(d.deadlineDate)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card padding="p-0">
        <div className="p-5 pb-0">
          <CardHeader title="Movement History" subtitle="Most recent 30 movements" />
        </div>
        <Table>
          <Thead>
            <Th>Date</Th>
            <Th>Type</Th>
            <Th className="text-right">Quantity</Th>
            <Th>Reference</Th>
            <Th>Note</Th>
          </Thead>
          <Tbody>
            {movements.length === 0 && <EmptyRow colSpan={5} message="No movements recorded." />}
            {movements.map((m) => (
              <Tr key={m.id}>
                <Td className="text-text-muted">{formatDate(m.occurredAt)}</Td>
                <Td>{m.type.replace(/_/g, " ")}</Td>
                <Td className={`text-right tabular-nums ${m.quantity < 0 ? "text-[var(--status-critical-text)]" : "text-[var(--status-healthy-text)]"}`}>
                  {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                </Td>
                <Td className="text-text-muted">{m.referenceType ?? "—"}</Td>
                <Td className="text-text-muted">{m.note ?? "—"}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Card>
    </div>
  );
}
