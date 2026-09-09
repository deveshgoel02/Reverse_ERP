"use client";

import { useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { confirmMerge, rejectMatch } from "./actions";

export function MatchRow({
  suggestionId,
  productA,
  productB,
  confidence,
}: {
  suggestionId: string;
  productA: { id: string; name: string; skuCount: number };
  productB: { id: string; name: string; skuCount: number };
  confidence: number;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <li className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-0">
      <div>
        <p className="text-sm text-text">
          <strong>{productA.name}</strong> ({productA.skuCount} SKUs) vs. <strong>{productB.name}</strong> ({productB.skuCount} SKUs)
        </p>
        <Badge level={confidence >= 0.8 ? "healthy" : confidence >= 0.65 ? "watch" : "neutral"}>
          {Math.round(confidence * 100)}% confidence
        </Badge>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button
          variant="primary"
          disabled={pending}
          title={`Keep "${productA.name}", merge "${productB.name}" into it`}
          onClick={() => startTransition(() => confirmMerge(suggestionId, productA.id, productB.id))}
        >
          Merge into &quot;{productA.name}&quot;
        </Button>
        <Button variant="secondary" disabled={pending} onClick={() => startTransition(() => rejectMatch(suggestionId))}>
          Not a Match
        </Button>
      </div>
    </li>
  );
}
