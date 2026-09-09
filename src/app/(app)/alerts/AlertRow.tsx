"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { dismissAlert } from "./actions";
import { severityLevel, alertTypeLabel } from "@/lib/ui/status";
import type { Severity, AlertType } from "@/lib/enums";

export function AlertRow({
  id,
  type,
  severity,
  message,
  createdAt,
}: {
  id: string;
  type: string;
  severity: string;
  message: string;
  createdAt: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <li className="flex items-start justify-between gap-4 border-b border-border py-3 last:border-0">
      <div className="flex items-start gap-3">
        <Badge level={severityLevel(severity as Severity)}>{severity}</Badge>
        <div>
          <p className="text-sm text-text">{message}</p>
          <p className="mt-0.5 text-xs text-text-muted">
            {alertTypeLabel(type as AlertType)} · {new Date(createdAt).toLocaleString("en-IN")}
          </p>
        </div>
      </div>
      <Button
        variant="ghost"
        disabled={pending}
        onClick={() => startTransition(() => dismissAlert(id))}
      >
        Dismiss
      </Button>
    </li>
  );
}
