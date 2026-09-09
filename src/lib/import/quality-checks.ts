import type { ImportEntityType } from "@/lib/enums";

export interface QualityIssue {
  type: "DUPLICATE" | "DUPLICATE_INVOICE" | "SUSPICIOUS_VALUE";
  severity: "LOW" | "MEDIUM" | "HIGH";
  description: string;
  rowNumbers: number[];
}

/**
 * Cross-row checks that a single row can't catch on its own — Module J.
 * Runs after per-row normalization (src/lib/import/normalize.ts), which
 * already handles missing fields, invalid dates and negative quantities.
 */
export function checkDataQuality(
  entityType: ImportEntityType,
  rows: { rowNumber: number; normalized: Record<string, string | number | Date | null> }[],
): QualityIssue[] {
  const issues: QualityIssue[] = [];

  if (entityType === "SALES" || entityType === "PURCHASES") {
    const skuKey = "skuCode";
    const qtyKey = entityType === "SALES" ? "quantity" : "quantityOrdered";
    const dateKey = entityType === "SALES" ? "saleDate" : "orderDate";

    const exactDupes = new Map<string, number[]>();
    const invoiceMap = new Map<string, number[]>();

    for (const row of rows) {
      const sku = row.normalized[skuKey];
      const qty = row.normalized[qtyKey];
      const date = row.normalized[dateKey];
      const invoiceRef = row.normalized["invoiceRef"];

      if (sku && qty !== null && date instanceof Date) {
        const key = `${sku}|${qty}|${date.toDateString()}`;
        exactDupes.set(key, [...(exactDupes.get(key) ?? []), row.rowNumber]);
      }
      if (invoiceRef && sku) {
        const key = `${invoiceRef}|${sku}`;
        invoiceMap.set(key, [...(invoiceMap.get(key) ?? []), row.rowNumber]);
      }
    }

    for (const [key, rowNumbers] of exactDupes) {
      if (rowNumbers.length > 1) {
        const [sku, qty, date] = key.split("|");
        issues.push({
          type: "DUPLICATE",
          severity: "MEDIUM",
          description: `${rowNumbers.length} rows look like duplicates: SKU ${sku}, qty ${qty}, date ${date}.`,
          rowNumbers,
        });
      }
    }
    for (const [key, rowNumbers] of invoiceMap) {
      if (rowNumbers.length > 1) {
        const [invoiceRef, sku] = key.split("|");
        issues.push({
          type: "DUPLICATE_INVOICE",
          severity: "LOW",
          description: `Invoice ${invoiceRef} appears ${rowNumbers.length} times for SKU ${sku} — confirm this isn't a duplicate entry.`,
          rowNumbers,
        });
      }
    }
  }

  if (entityType === "PRODUCTS" || entityType === "INVENTORY") {
    const seen = new Map<string, number[]>();
    for (const row of rows) {
      const sku = row.normalized["skuCode"];
      if (!sku) continue;
      seen.set(String(sku), [...(seen.get(String(sku)) ?? []), row.rowNumber]);
    }
    for (const [sku, rowNumbers] of seen) {
      if (rowNumbers.length > 1) {
        issues.push({
          type: "DUPLICATE",
          severity: "MEDIUM",
          description: `SKU code "${sku}" appears ${rowNumbers.length} times in this file.`,
          rowNumbers,
        });
      }
    }
  }

  return issues;
}
