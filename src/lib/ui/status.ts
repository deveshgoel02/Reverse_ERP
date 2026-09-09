import type { AlertType, Severity, StockStatus } from "@/lib/enums";

/** Business-friendly 4-tier status the spec asks for (Module 9): HEALTHY, WATCH, WARNING, CRITICAL. */
export type UiStatusLevel = "healthy" | "watch" | "warning" | "critical" | "neutral";

const STOCK_STATUS_LEVEL: Record<StockStatus, UiStatusLevel> = {
  HEALTHY: "healthy",
  FAST_MOVING: "healthy",
  NORMAL: "neutral",
  SLOW_MOVING: "watch",
  UNDERSTOCKED: "watch",
  AT_RISK: "warning",
  OVERSTOCKED: "warning",
  DEAD_STOCK: "critical",
  OUT_OF_STOCK: "critical",
};

const STOCK_STATUS_LABEL: Record<StockStatus, string> = {
  HEALTHY: "Healthy",
  FAST_MOVING: "Fast Moving",
  NORMAL: "Normal",
  SLOW_MOVING: "Slow Moving",
  UNDERSTOCKED: "Understocked",
  AT_RISK: "At Risk",
  OVERSTOCKED: "Overstocked",
  DEAD_STOCK: "Dead Stock",
  OUT_OF_STOCK: "Out of Stock",
};

export function stockStatusLevel(status: StockStatus): UiStatusLevel {
  return STOCK_STATUS_LEVEL[status] ?? "neutral";
}
export function stockStatusLabel(status: StockStatus): string {
  return STOCK_STATUS_LABEL[status] ?? status;
}

const SEVERITY_LEVEL: Record<Severity, UiStatusLevel> = {
  LOW: "watch",
  MEDIUM: "warning",
  HIGH: "warning",
  CRITICAL: "critical",
};
export function severityLevel(severity: Severity): UiStatusLevel {
  return SEVERITY_LEVEL[severity] ?? "neutral";
}

export function alertTypeLabel(type: AlertType): string {
  return type
    .split("_")
    .map((w) => w[0] + w.slice(1).toLowerCase())
    .join(" ");
}

export const LEVEL_CLASSES: Record<UiStatusLevel, string> = {
  healthy: "bg-[var(--status-healthy-bg)] text-[var(--status-healthy-text)]",
  watch: "bg-[var(--status-watch-bg)] text-[var(--status-watch-text)]",
  warning: "bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]",
  critical: "bg-[var(--status-critical-bg)] text-[var(--status-critical-text)]",
  neutral: "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)]",
};
