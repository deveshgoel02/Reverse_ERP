import { TARGET_FIELDS } from "./schema-fields";
import { parseFlexibleDate } from "./date-parse";
import type { ImportEntityType } from "@/lib/enums";
import type { SuggestedMapping } from "./mapping";

export interface NormalizeResult {
  normalized: Record<string, string | number | Date | null>;
  errors: string[];
  warnings: string[];
}

const QUANTITY_FIELDS = new Set(["quantity", "quantityOrdered", "quantityReceived"]);

/**
 * Applies a confirmed column mapping to one raw row and validates it —
 * Module I STEP 6 ("validate data") / STEP 7 ("detect problems"). Never
 * mutates rawRow; the caller keeps the original alongside this result so
 * raw and normalized data stay separate (Module I: "never silently destroy
 * or overwrite raw imported data").
 */
export function normalizeRow(
  entityType: ImportEntityType,
  mapping: SuggestedMapping[],
  rawRow: Record<string, string>,
): NormalizeResult {
  const fields = TARGET_FIELDS[entityType];
  const sourceForTarget = new Map(mapping.filter((m) => m.targetField).map((m) => [m.targetField as string, m.sourceColumn]));

  const normalized: Record<string, string | number | Date | null> = {};
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const field of fields) {
    const sourceColumn = sourceForTarget.get(field.key);
    const raw = sourceColumn ? (rawRow[sourceColumn] ?? "").trim() : "";

    if (!raw) {
      if (field.required) errors.push(`Missing required field: ${field.label}`);
      normalized[field.key] = null;
      continue;
    }

    if (field.type === "number") {
      const cleaned = raw.replace(/,/g, "").replace(/[₹$\s]/g, "");
      const num = Number(cleaned);
      if (Number.isNaN(num)) {
        errors.push(`Invalid ${field.label}: "${raw}" is not a number`);
        normalized[field.key] = null;
      } else {
        if (QUANTITY_FIELDS.has(field.key) && num < 0) {
          errors.push(`${field.label} cannot be negative (got ${num})`);
        }
        if (QUANTITY_FIELDS.has(field.key) && !Number.isInteger(num)) {
          warnings.push(`${field.label} "${raw}" is not a whole number — rounded to ${Math.round(num)}`);
        }
        normalized[field.key] = QUANTITY_FIELDS.has(field.key) ? Math.round(num) : num;
      }
    } else if (field.type === "date") {
      const date = parseFlexibleDate(raw);
      if (!date) {
        errors.push(`Invalid ${field.label}: "${raw}" could not be parsed as a date`);
        normalized[field.key] = null;
      } else {
        if (date.getFullYear() < 2000 || date.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
          warnings.push(`${field.label} "${raw}" looks unusual (${date.toDateString()}) — please double-check`);
        }
        normalized[field.key] = date;
      }
    } else {
      normalized[field.key] = raw;
    }
  }

  return { normalized, errors, warnings };
}
