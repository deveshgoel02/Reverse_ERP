import { LEVEL_CLASSES, type UiStatusLevel } from "@/lib/ui/status";

export function Badge({ level, children }: { level: UiStatusLevel; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${LEVEL_CLASSES[level]}`}
    >
      {children}
    </span>
  );
}
