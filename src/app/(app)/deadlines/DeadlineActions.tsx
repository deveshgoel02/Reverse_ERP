"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { cancelStockDeadline } from "./actions";

export function CancelDeadlineButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button variant="ghost" disabled={pending} onClick={() => startTransition(() => cancelStockDeadline(id))}>
      Cancel
    </Button>
  );
}
