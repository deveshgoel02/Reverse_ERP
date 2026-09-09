import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { Card, CardHeader } from "@/components/ui/Card";
import { MatchRow } from "./MatchRow";
import { DetectButton } from "./DetectButton";

export default async function ProductMatchesPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const suggestions = await prisma.productMatchSuggestion.findMany({
    where: { businessId: user.businessId, status: "PENDING" },
    orderBy: { confidence: "desc" },
    take: 100,
  });

  const productIds = [...new Set(suggestions.flatMap((s) => [s.productAId, s.productBId]))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: { _count: { select: { skus: true } } },
  });
  const productMap = new Map(products.map((p) => [p.id, { id: p.id, name: p.name, skuCount: p._count.skus }]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text">Possible Duplicate Products</h1>
          <p className="text-sm text-text-muted">
            Historical files often spell the same product differently. Nothing merges automatically — review each suggestion.
          </p>
        </div>
        <DetectButton />
      </div>

      <Card>
        <CardHeader title={`${suggestions.length} Pending Suggestions`} />
        {suggestions.length === 0 ? (
          <p className="py-6 text-center text-sm text-text-muted">
            No pending suggestions. Click &quot;Scan for Possible Duplicates&quot; to check the current catalog.
          </p>
        ) : (
          <ul>
            {suggestions.map((s) => {
              const a = productMap.get(s.productAId);
              const b = productMap.get(s.productBId);
              if (!a || !b) return null;
              return <MatchRow key={s.id} suggestionId={s.id} productA={a} productB={b} confidence={s.confidence} />;
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
