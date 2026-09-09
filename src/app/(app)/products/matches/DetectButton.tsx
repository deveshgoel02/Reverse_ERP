"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { runDetection } from "./actions";

export function DetectButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button variant="primary" disabled={pending} onClick={() => startTransition(() => runDetection())}>
      {pending ? "Scanning..." : "Scan for Possible Duplicates"}
    </Button>
  );
}
