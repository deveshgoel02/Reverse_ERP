import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { Card } from "@/components/ui/Card";
import { Table, Thead, Tbody, Th, EmptyRow } from "@/components/ui/Table";
import { RecommendationRow } from "./RecommendationRow";

const TYPE_FILTERS = ["ALL", "ORDER_MORE", "ORDER_LESS", "DO_NOT_ORDER", "MAINTAIN", "REVIEW_MANUALLY"];

export default async function RecommendationsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const params = await searchParams;
  const type = params.type && params.type !== "ALL" ? params.type : undefined;

  const recommendations = await prisma.recommendation.findMany({
    where: { businessId: user.businessId, status: "PENDING", ...(type ? { type } : {}) },
    include: { sku: { include: { product: { include: { brand: true } } } } },
    orderBy: { generatedAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-text">Recommendations</h1>
        <p className="text-sm text-text-muted">
          System-generated ordering advice. Nothing is ordered automatically — accept or reject each one; every decision is logged.
        </p>
      </div>

      <Card padding="p-3">
        <form className="flex flex-wrap gap-2" method="get">
          <select name="type" defaultValue={params.type ?? "ALL"} className="rounded-lg border border-border px-3 py-1.5 text-sm">
            {TYPE_FILTERS.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-lg bg-primary px-3.5 py-1.5 text-sm font-medium text-white">
            Filter
          </button>
        </form>
      </Card>

      <Card padding="p-0">
        <Table>
          <Thead>
            <Th>Product</Th>
            <Th>Recommendation</Th>
            <Th className="text-right">Qty</Th>
            <Th>Confidence</Th>
            <Th>Decision</Th>
          </Thead>
          <Tbody>
            {recommendations.length === 0 && <EmptyRow colSpan={5} message="No pending recommendations." />}
            {recommendations.map((r) => (
              <RecommendationRow
                key={r.id}
                id={r.id}
                productLabel={`${r.sku.product.name} (${r.sku.code})`}
                type={r.type}
                recommendedQty={r.recommendedQty}
                reason={r.reason}
                confidence={r.confidence}
              />
            ))}
          </Tbody>
        </Table>
      </Card>
    </div>
  );
}
