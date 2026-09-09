import { Card } from "./Card";
import { Badge } from "./Badge";
import type { UiStatusLevel } from "@/lib/ui/status";

export function StatTile({
  label,
  value,
  hint,
  level,
  levelLabel,
}: {
  label: string;
  value: string;
  hint?: string;
  level?: UiStatusLevel;
  levelLabel?: string;
}) {
  return (
    <Card padding="p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-text-muted">{label}</p>
        {level && levelLabel && <Badge level={level}>{levelLabel}</Badge>}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-text">{value}</p>
      {hint && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
    </Card>
  );
}
