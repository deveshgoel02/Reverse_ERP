"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { TARGET_FIELDS } from "@/lib/import/schema-fields";
import type { ImportEntityType } from "@/lib/enums";

interface MappingEntry {
  sourceColumn: string;
  targetField: string | null;
  confidence: number;
}

export function ImportWizard({
  importId,
  entityType,
  headers,
  initialMapping,
  previewRawRows,
  totalRows,
}: {
  importId: string;
  entityType: ImportEntityType;
  headers: string[];
  initialMapping: MappingEntry[];
  previewRawRows: Record<string, string>[];
  totalRows: number;
}) {
  const [step, setStep] = useState<"map" | "preview" | "done">("map");
  const [mapping, setMapping] = useState<MappingEntry[]>(initialMapping);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<{
    validCount: number;
    warningCount: number;
    rejectedCount: number;
    qualityIssues: { description: string; severity: string }[];
    preview: { rowNumber: number; normalized: Record<string, unknown>; errors: string[]; warnings: string[] }[];
  } | null>(null);
  const [commitResult, setCommitResult] = useState<{ imported: number; rejected: number } | null>(null);

  const fields = TARGET_FIELDS[entityType];

  function updateMapping(sourceColumn: string, targetField: string) {
    setMapping((prev) => prev.map((m) => (m.sourceColumn === sourceColumn ? { ...m, targetField: targetField || null } : m)));
  }

  async function onValidate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/import/${importId}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mapping }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Validation failed.");
        return;
      }
      setValidation(body);
      setStep("preview");
    } finally {
      setLoading(false);
    }
  }

  async function onCommit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/import/${importId}/commit`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Commit failed.");
        return;
      }
      setCommitResult(body);
      setStep("done");
    } finally {
      setLoading(false);
    }
  }

  const requiredFieldsMapped = fields
    .filter((f) => f.required)
    .every((f) => mapping.some((m) => m.targetField === f.key));

  return (
    <div className="space-y-4">
      {step === "map" && (
        <Card>
          <CardHeader
            title="Step 1: Confirm Column Mapping"
            subtitle={`${totalRows} rows detected. We've suggested a mapping below — review and adjust before validating.`}
          />
          <Table>
            <Thead>
              <Th>Your Column</Th>
              <Th>Sample Value</Th>
              <Th>Maps To</Th>
              <Th>Confidence</Th>
            </Thead>
            <Tbody>
              {headers.map((h) => {
                const entry = mapping.find((m) => m.sourceColumn === h);
                const sample = previewRawRows[0]?.[h] ?? "";
                return (
                  <Tr key={h}>
                    <Td className="font-medium text-text">{h}</Td>
                    <Td className="text-text-muted">{sample || "—"}</Td>
                    <Td>
                      <select
                        value={entry?.targetField ?? ""}
                        onChange={(e) => updateMapping(h, e.target.value)}
                        className="rounded-lg border border-border px-2 py-1 text-sm"
                      >
                        <option value="">Don&apos;t import</option>
                        {fields.map((f) => (
                          <option key={f.key} value={f.key}>
                            {f.label}
                            {f.required ? " *" : ""}
                          </option>
                        ))}
                      </select>
                    </Td>
                    <Td>
                      {entry && entry.confidence > 0 ? (
                        <Badge level={entry.confidence >= 0.7 ? "healthy" : entry.confidence >= 0.4 ? "watch" : "neutral"}>
                          {Math.round(entry.confidence * 100)}%
                        </Badge>
                      ) : (
                        <span className="text-xs text-text-muted">—</span>
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
          <p className="mt-3 text-xs text-text-muted">* Required field for this import type.</p>
          {!requiredFieldsMapped && (
            <p className="mt-2 text-sm text-[var(--status-warning-text)]">
              Map all required fields ({fields.filter((f) => f.required).map((f) => f.label).join(", ")}) before validating.
            </p>
          )}
          {error && <p className="mt-2 text-sm text-[var(--status-critical-text)]">{error}</p>}
          <div className="mt-4">
            <Button variant="primary" disabled={loading || !requiredFieldsMapped} onClick={onValidate}>
              {loading ? "Validating..." : "Validate"}
            </Button>
          </div>
        </Card>
      )}

      {step === "preview" && validation && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Card padding="p-4">
              <p className="text-xs text-text-muted">Valid</p>
              <p className="text-2xl font-semibold text-[var(--status-healthy-text)]">{validation.validCount}</p>
            </Card>
            <Card padding="p-4">
              <p className="text-xs text-text-muted">Warnings</p>
              <p className="text-2xl font-semibold text-[var(--status-watch-text)]">{validation.warningCount}</p>
            </Card>
            <Card padding="p-4">
              <p className="text-xs text-text-muted">Rejected</p>
              <p className="text-2xl font-semibold text-[var(--status-critical-text)]">{validation.rejectedCount}</p>
            </Card>
          </div>

          {validation.qualityIssues.length > 0 && (
            <Card>
              <CardHeader title={`Data Quality Issues (${validation.qualityIssues.length})`} />
              <ul className="space-y-1 text-sm">
                {validation.qualityIssues.map((issue, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Badge level={issue.severity === "HIGH" ? "critical" : issue.severity === "MEDIUM" ? "warning" : "watch"}>
                      {issue.severity}
                    </Badge>
                    <span className="text-text">{issue.description}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card padding="p-0">
            <div className="p-5 pb-0">
              <CardHeader title="Preview" subtitle="First 50 normalized rows" />
            </div>
            <Table>
              <Thead>
                <Th>Row</Th>
                <Th>Status</Th>
                <Th>Details</Th>
              </Thead>
              <Tbody>
                {validation.preview.map((row) => {
                  const status = row.errors.length > 0 ? "REJECTED" : row.warnings.length > 0 ? "WARNING" : "VALID";
                  return (
                    <Tr key={row.rowNumber}>
                      <Td className="text-text-muted">{row.rowNumber}</Td>
                      <Td>
                        <Badge level={status === "VALID" ? "healthy" : status === "WARNING" ? "watch" : "critical"}>{status}</Badge>
                      </Td>
                      <Td className="max-w-md text-xs text-text-muted">
                        {[...row.errors, ...row.warnings].join("; ") || "—"}
                      </Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          </Card>

          {error && <p className="text-sm text-[var(--status-critical-text)]">{error}</p>}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep("map")}>
              Back to Mapping
            </Button>
            <Button variant="primary" disabled={loading || validation.validCount + validation.warningCount === 0} onClick={onCommit}>
              {loading ? "Importing..." : `Import ${validation.validCount + validation.warningCount} Rows`}
            </Button>
          </div>
        </>
      )}

      {step === "done" && commitResult && (
        <Card>
          <CardHeader title="Import Complete" />
          <p className="text-sm text-text">
            Imported <strong>{commitResult.imported}</strong> rows successfully.
            {commitResult.rejected > 0 && ` ${commitResult.rejected} rows were rejected at commit time.`}
          </p>
          <p className="mt-2 text-sm text-text-muted">Dashboard, inventory, forecasts, and recommendations have been recalculated.</p>
          <div className="mt-4 flex gap-2">
            <Link href="/dashboard" className="rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-white">
              Go to Dashboard
            </Link>
            <Link href="/import" className="rounded-lg border border-border px-3.5 py-2 text-sm font-medium text-text">
              Import Another File
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}
