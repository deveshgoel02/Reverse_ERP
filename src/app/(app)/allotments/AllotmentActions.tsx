"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { cancelAllotment } from "./actions";

export function CancelAllotmentButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button variant="ghost" disabled={pending} onClick={() => startTransition(() => cancelAllotment(id))}>
      Cancel
    </Button>
  );
}
