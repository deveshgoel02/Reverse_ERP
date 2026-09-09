import { TARGET_FIELDS, type TargetField } from "./schema-fields";
import type { ImportEntityType } from "@/lib/enums";

export interface SuggestedMapping {
  sourceColumn: string;
  targetField: string | null; // null = "don't import this column"
  confidence: number; // 0..1
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[_\-./]+/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ");
}

/** Token-overlap similarity, 0..1 — good enough for short header phrases without pulling in an NLP dependency. */
function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;
  if (!na || !nb) return 0;
  if (na.includes(nb) || nb.includes(na)) return 0.85;

  const tokensA = new Set(na.split(" "));
  const tokensB = new Set(nb.split(" "));
  const intersection = [...tokensA].filter((t) => tokensB.has(t)).length;
  const union = new Set([...tokensA, ...tokensB]).size;
  return union === 0 ? 0 : intersection / union;
}

function bestMatchForColumn(column: string, fields: TargetField[]): { field: TargetField | null; confidence: number } {
  let best: { field: TargetField | null; confidence: number } = { field: null, confidence: 0 };
  for (const field of fields) {
    const labelScore = similarity(column, field.label);
    const aliasScore = Math.max(0, ...field.aliases.map((a) => similarity(column, a)));
    const score = Math.max(labelScore, aliasScore);
    if (score > best.confidence) best = { field, confidence: score };
  }
  return best;
}

/**
 * Suggests a target field for every uploaded column header — Module I,
 * STEP 4/5 ("suggest mappings", "show confidence"). Never auto-applies a
 * low-confidence guess as ground truth: the UI always shows the suggestion
 * for the owner to confirm, override, or ignore before anything is
 * validated or imported.
 */
export function suggestColumnMapping(headers: string[], entityType: ImportEntityType): SuggestedMapping[] {
  const fields = TARGET_FIELDS[entityType];
  const usedFields = new Set<string>();

  return headers.map((column) => {
    const { field, confidence } = bestMatchForColumn(column, fields);
    // Avoid mapping two source columns to the same target field — keep the stronger match.
    if (field && !usedFields.has(field.key) && confidence >= 0.4) {
      usedFields.add(field.key);
      return { sourceColumn: column, targetField: field.key, confidence };
    }
    return { sourceColumn: column, targetField: null, confidence };
  });
}
