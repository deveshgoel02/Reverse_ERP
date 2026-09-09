"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Td, Tr } from "@/components/ui/Table";
import { decideRecommendation } from "./actions";

export function RecommendationRow({
  id,
  productLabel,
  type,
  recommendedQty,
  reason,
  confidence,
}: {
  id: string;
  productLabel: string;
  type: string;
  recommendedQty: number | null;
  reason: string;
  confidence: string;
}) {
  const [pending, startTransition] = useTransition();
  const [decided, setDecided] = useState<"ACCEPTED" | "REJECTED" | null>(null);
  const [expanded, setExpanded] = useState(false);

  function decide(decision: "ACCEPTED" | "REJECTED") {
    startTransition(async () => {
      await decideRecommendation(id, decision);
      setDecided(decision);
    });
  }

  return (
    <Tr>
      <Td className="max-w-xs">
        <button onClick={() => setExpanded((e) => !e)} className="block w-full text-left hover:text-primary">
          <p className="truncate font-medium text-text">{productLabel}</p>
          <p className={`text-xs text-text-muted ${expanded ? "whitespace-normal" : "truncate"}`}>{reason}</p>
        </button>
      </Td>
      <Td>{type.replace(/_/g, " ")}</Td>
      <Td className="text-right tabular-nums">{recommendedQty ?? "—"}</Td>
      <Td>
        <Badge level={confidence === "HIGH" ? "healthy" : confidence === "MEDIUM" ? "watch" : "neutral"}>{confidence}</Badge>
      </Td>
      <Td>
        {decided ? (
          <Badge level={decided === "ACCEPTED" ? "healthy" : "neutral"}>{decided}</Badge>
        ) : (
          <div className="flex gap-2">
            <Button variant="primary" disabled={pending} onClick={() => decide("ACCEPTED")}>
              Accept
            </Button>
            <Button variant="secondary" disabled={pending} onClick={() => decide("REJECTED")}>
              Reject
            </Button>
          </div>
        )}
      </Td>
    </Tr>
  );
}
