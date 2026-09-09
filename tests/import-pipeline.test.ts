import { describe, expect, it } from "vitest";
import { suggestColumnMapping } from "@/lib/import/mapping";
import { normalizeRow } from "@/lib/import/normalize";
import { checkDataQuality } from "@/lib/import/quality-checks";
import { parseFlexibleDate } from "@/lib/import/date-parse";

describe("suggestColumnMapping", () => {
  it("matches common real-world header aliases with high confidence", () => {
    const mapping = suggestColumnMapping(["Item Code", "Qty Sold", "Sale Dt", "Party Name"], "SALES");
    const byColumn = Object.fromEntries(mapping.map((m) => [m.sourceColumn, m]));

    expect(byColumn["Item Code"].targetField).toBe("skuCode");
    expect(byColumn["Qty Sold"].targetField).toBe("quantity");
    expect(byColumn["Sale Dt"].targetField).toBe("saleDate");
    expect(byColumn["Party Name"].targetField).toBe("customerName");
    expect(byColumn["Item Code"].confidence).toBeGreaterThan(0.7);
  });

  it("leaves an unrecognizable column unmapped rather than guessing", () => {
    const mapping = suggestColumnMapping(["Random Notes Column XYZ"], "SALES");
    expect(mapping[0].targetField).toBeNull();
  });

  it("never maps two source columns to the same target field", () => {
    const mapping = suggestColumnMapping(["SKU", "Item Code", "Product Code"], "SALES");
    const mappedTargets = mapping.filter((m) => m.targetField).map((m) => m.targetField);
    expect(new Set(mappedTargets).size).toBe(mappedTargets.length);
  });
});

describe("parseFlexibleDate", () => {
  it("parses ISO, DD-MM-YYYY, and DD/MM/YYYY", () => {
    expect(parseFlexibleDate("2024-09-15")?.getMonth()).toBe(8);
    expect(parseFlexibleDate("15-09-2024")?.getMonth()).toBe(8);
    expect(parseFlexibleDate("15/09/2024")?.getDate()).toBe(15);
  });

  it("returns null instead of throwing on garbage input", () => {
    expect(parseFlexibleDate("not a date")).toBeNull();
    expect(parseFlexibleDate("")).toBeNull();
    expect(parseFlexibleDate("32-13-2024")).toBeNull();
  });
});

describe("normalizeRow", () => {
  const mapping = [
    { sourceColumn: "Item Code", targetField: "skuCode", confidence: 1 },
    { sourceColumn: "Qty Sold", targetField: "quantity", confidence: 1 },
    { sourceColumn: "Sale Dt", targetField: "saleDate", confidence: 1 },
  ];

  it("produces a valid normalized row with no errors when data is clean", () => {
    const result = normalizeRow("SALES", mapping, { "Item Code": "ADI-001", "Qty Sold": "12", "Sale Dt": "15-09-2024" });
    expect(result.errors).toHaveLength(0);
    expect(result.normalized.skuCode).toBe("ADI-001");
    expect(result.normalized.quantity).toBe(12);
  });

  it("flags a missing required field", () => {
    const result = normalizeRow("SALES", mapping, { "Item Code": "", "Qty Sold": "12", "Sale Dt": "15-09-2024" });
    expect(result.errors.some((e) => e.includes("SKU Code"))).toBe(true);
  });

  it("flags a negative quantity as an error", () => {
    const result = normalizeRow("SALES", mapping, { "Item Code": "ADI-001", "Qty Sold": "-5", "Sale Dt": "15-09-2024" });
    expect(result.errors.some((e) => e.includes("negative"))).toBe(true);
  });

  it("flags an unparseable date as an error, not a crash", () => {
    const result = normalizeRow("SALES", mapping, { "Item Code": "ADI-001", "Qty Sold": "5", "Sale Dt": "garbage" });
    expect(result.errors.some((e) => e.includes("Sale Date"))).toBe(true);
  });

  it("warns (but doesn't error) on a non-integer quantity, rounding it", () => {
    const result = normalizeRow("SALES", mapping, { "Item Code": "ADI-001", "Qty Sold": "5.6", "Sale Dt": "15-09-2024" });
    expect(result.errors).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.normalized.quantity).toBe(6);
  });
});

describe("checkDataQuality", () => {
  it("detects exact-duplicate sales rows (same SKU, qty, date)", () => {
    const rows = [
      { rowNumber: 1, normalized: { skuCode: "A1", quantity: 5, saleDate: new Date("2024-09-15") } },
      { rowNumber: 2, normalized: { skuCode: "A1", quantity: 5, saleDate: new Date("2024-09-15") } },
      { rowNumber: 3, normalized: { skuCode: "A2", quantity: 3, saleDate: new Date("2024-09-16") } },
    ];
    const issues = checkDataQuality("SALES", rows);
    expect(issues.some((i) => i.type === "DUPLICATE" && i.rowNumbers.includes(1) && i.rowNumbers.includes(2))).toBe(true);
  });

  it("detects a duplicate SKU code within a PRODUCTS file", () => {
    const rows = [
      { rowNumber: 1, normalized: { skuCode: "A1" } },
      { rowNumber: 2, normalized: { skuCode: "A1" } },
    ];
    const issues = checkDataQuality("PRODUCTS", rows);
    expect(issues.some((i) => i.type === "DUPLICATE")).toBe(true);
  });

  it("reports no issues for clean data", () => {
    const rows = [
      { rowNumber: 1, normalized: { skuCode: "A1", quantity: 5, saleDate: new Date("2024-09-15") } },
      { rowNumber: 2, normalized: { skuCode: "A2", quantity: 3, saleDate: new Date("2024-09-16") } },
    ];
    expect(checkDataQuality("SALES", rows)).toHaveLength(0);
  });
});
