import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getDashboardData } from "@/lib/dashboard/queries";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { Badge } from "@/components/ui/Badge";
import { Table, Thead, Tbody, Tr, Th, Td, EmptyRow } from "@/components/ui/Table";
import { severityLevel, stockStatusLabel, stockStatusLevel } from "@/lib/ui/status";
import type { StockStatus } from "@/lib/enums";
import { formatINR, daysUntil } from "@/lib/ui/format";
import { SalesTrendChart } from "@/components/charts/SalesTrendChart";
import { BrandValueChart } from "@/components/charts/BrandValueChart";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const data = await getDashboardData(user.businessId);

  const statusMap = new Map(data.statusCounts.map((s) => [s.status as StockStatus, s]));
  const deadStock = statusMap.get("DEAD_STOCK");
  const atRisk = statusMap.get("AT_RISK");
  const stuckUnits = (deadStock?.units ?? 0) + (atRisk?.units ?? 0);
  const stuckValue = (deadStock?.value ?? 0) + (atRisk?.value ?? 0);

  const salesChange =
    data.salesPrior30 > 0 ? ((data.salesLast30 - data.salesPrior30) / data.salesPrior30) * 100 : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-text">Dashboard</h1>
        <p className="text-sm text-text-muted">What&apos;s happening in your business right now.</p>
      </div>

      {/* 1. How much stock do I have? */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Total Stock On Hand" value={data.totals.totalUnits.toLocaleString("en-IN")} hint={`${data.totals.skuCount} active SKUs`} />
        <StatTile label="Total Inventory Value" value={formatINR(data.totals.totalValue)} />
        <StatTile
          label="Stock Stuck (At Risk + Dead)"
          value={stuckUnits.toLocaleString("en-IN")}
          hint={formatINR(stuckValue)}
          level={stuckUnits > 0 ? "warning" : "healthy"}
          levelLabel={stuckUnits > 0 ? "Needs attention" : "Clear"}
        />
        <StatTile
          label="Sales, Last 30 Days"
          value={formatINR(data.salesLast30)}
          hint={salesChange !== null ? `${salesChange >= 0 ? "+" : ""}${salesChange.toFixed(0)}% vs. prior 30 days` : undefined}
          level={salesChange === null ? undefined : salesChange >= 0 ? "healthy" : "watch"}
          levelLabel={salesChange === null ? undefined : salesChange >= 0 ? "Up" : "Down"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Sales Trend" subtitle="Last 12 months" />
          <SalesTrendChart data={data.salesTrend} />
        </Card>
        <Card>
          <CardHeader title="Inventory Value by Brand" />
          <BrandValueChart data={data.brandValueBreakdown} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 5. What needs attention today? */}
        <Card className="lg:col-span-1">
          <CardHeader title="Needs Attention Today" subtitle={`${data.openAlerts.length} open alerts`} action={<Link href="/alerts" className="text-xs text-primary">View all</Link>} />
          <ul className="space-y-2">
            {data.openAlerts.length === 0 && <p className="text-sm text-text-muted">No open alerts.</p>}
            {data.openAlerts.map((alert) => (
              <li key={alert.id} className="flex items-start gap-2 text-sm">
                <Badge level={severityLevel(alert.severity as never)}>{alert.severity}</Badge>
                <span className="text-text">{alert.message}</span>
              </li>
            ))}
          </ul>
        </Card>

        {/* 2. What stock is stuck? */}
        <Card className="lg:col-span-1">
          <CardHeader title="Stock Classification" subtitle="Across all active SKUs" />
          <ul className="space-y-2">
            {data.statusCounts.map((s) => (
              <li key={s.status} className="flex items-center justify-between text-sm">
                <Badge level={stockStatusLevel(s.status as StockStatus)}>{stockStatusLabel(s.status as StockStatus)}</Badge>
                <span className="text-text-muted">
                  {s.count} SKUs · {s.units.toLocaleString("en-IN")} units
                </span>
              </li>
            ))}
          </ul>
        </Card>

        {/* Upcoming deadlines */}
        <Card className="lg:col-span-1">
          <CardHeader title="Upcoming Stock Deadlines" action={<Link href="/deadlines" className="text-xs text-primary">View all</Link>} />
          <ul className="space-y-2">
            {data.upcomingDeadlines.length === 0 && <p className="text-sm text-text-muted">No open deadlines.</p>}
            {data.upcomingDeadlines.map((d) => {
              const daysLeft = daysUntil(d.deadlineDate);
              return (
                <li key={d.id} className="flex items-center justify-between text-sm">
                  <span className="text-text">{d.sku.product.name} ({d.sku.code})</span>
                  <Badge level={daysLeft < 0 ? "critical" : daysLeft <= 7 ? "warning" : "watch"}>
                    {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 3. What's selling fastest? */}
        <Card>
          <CardHeader title="Fastest Moving (Last 60 Days)" />
          <Table>
            <Thead>
              <Th>Product</Th>
              <Th>Brand</Th>
              <Th className="text-right">Units Sold</Th>
            </Thead>
            <Tbody>
              {data.fastMoving.length === 0 && <EmptyRow colSpan={3} message="No sales in the last 60 days." />}
              {data.fastMoving.map((s) => (
                <Tr key={s.skuId}>
                  <Td>
                    {s.productName} <span className="text-text-muted">({s.code})</span>
                  </Td>
                  <Td>{s.brand}</Td>
                  <Td className="text-right font-medium">{s.unitsSold60d}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Card>

        {/* 4. What's selling slowest? */}
        <Card>
          <CardHeader title="Slowest Moving (Last 60 Days)" />
          <Table>
            <Thead>
              <Th>Product</Th>
              <Th>Brand</Th>
              <Th className="text-right">Units Sold</Th>
            </Thead>
            <Tbody>
              {data.slowest.length === 0 && <EmptyRow colSpan={3} message="No sales in the last 60 days." />}
              {data.slowest.map((s) => (
                <Tr key={s.skuId}>
                  <Td>
                    {s.productName} <span className="text-text-muted">({s.code})</span>
                  </Td>
                  <Td>{s.brand}</Td>
                  <Td className="text-right font-medium">{s.unitsSold60d}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 6. What should I order more of? */}
        <Card>
          <CardHeader title="Recommended: Order More" action={<Link href="/recommendations" className="text-xs text-primary">Review all</Link>} />
          <Table>
            <Thead>
              <Th>Product</Th>
              <Th className="text-right">Qty</Th>
              <Th>Confidence</Th>
            </Thead>
            <Tbody>
              {data.orderMore.length === 0 && <EmptyRow colSpan={3} message="No open order-more recommendations." />}
              {data.orderMore.map((r) => (
                <Tr key={r.id}>
                  <Td>
                    {r.sku.product.name} <span className="text-text-muted">({r.sku.code})</span>
                  </Td>
                  <Td className="text-right font-medium">{r.recommendedQty ?? "—"}</Td>
                  <Td>
                    <Badge level={r.confidence === "HIGH" ? "healthy" : r.confidence === "MEDIUM" ? "watch" : "neutral"}>{r.confidence}</Badge>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Card>

        {/* 7. What should I order less of? */}
        <Card>
          <CardHeader title="Recommended: Order Less / Do Not Order" action={<Link href="/recommendations" className="text-xs text-primary">Review all</Link>} />
          <Table>
            <Thead>
              <Th>Product</Th>
              <Th>Recommendation</Th>
              <Th>Confidence</Th>
            </Thead>
            <Tbody>
              {data.orderLess.length === 0 && <EmptyRow colSpan={3} message="No open order-less recommendations." />}
              {data.orderLess.map((r) => (
                <Tr key={r.id}>
                  <Td>
                    {r.sku.product.name} <span className="text-text-muted">({r.sku.code})</span>
                  </Td>
                  <Td>{r.type.replace("_", " ")}</Td>
                  <Td>
                    <Badge level={r.confidence === "HIGH" ? "healthy" : r.confidence === "MEDIUM" ? "watch" : "neutral"}>{r.confidence}</Badge>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
