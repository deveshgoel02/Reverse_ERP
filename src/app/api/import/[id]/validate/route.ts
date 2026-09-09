import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import { normalizeRow } from "@/lib/import/normalize";
import { checkDataQuality } from "@/lib/import/quality-checks";
import type { ImportEntityType } from "@/lib/enums";

const bodySchema = z.object({
  mapping: z.array(z.object({ sourceColumn: z.string(), targetField: z.string().nullable(), confidence: z.number() })),
});

/** Module I STEP 6/7/8: apply the (owner-confirmed) mapping, validate every row, run cross-row data-quality checks, and store a preview-ready result — nothing is committed to real tables yet. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const imp = await prisma.import.findFirst({ where: { id, businessId: user.businessId } });
  if (!imp) return NextResponse.json({ error: "Import not found." }, { status: 404 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid mapping payload." }, { status: 400 });
  const { mapping } = parsed.data;

  const entityType = imp.entityType as ImportEntityType;
  const rows = await prisma.importRow.findMany({ where: { importId: id }, orderBy: { rowNumber: "asc" } });

  const normalizedRows = rows.map((row) => {
    const { normalized, errors, warnings } = normalizeRow(entityType, mapping, row.rawData as Record<string, string>);
    return { rowNumber: row.rowNumber, id: row.id, normalized, errors, warnings };
  });

  const qualityIssues = checkDataQuality(entityType, normalizedRows);
  const rowNumbersWithQualityIssues = new Map<number, string[]>();
  for (const issue of qualityIssues) {
    for (const rn of issue.rowNumbers) {
      rowNumbersWithQualityIssues.set(rn, [...(rowNumbersWithQualityIssues.get(rn) ?? []), issue.description]);
    }
  }

  let validCount = 0;
  let warningCount = 0;
  let rejectedCount = 0;

  await prisma.$transaction(
    normalizedRows.map((r) => {
      const qualityWarnings = rowNumbersWithQualityIssues.get(r.rowNumber) ?? [];
      const allWarnings = [...r.warnings, ...qualityWarnings];
      const status = r.errors.length > 0 ? "REJECTED" : allWarnings.length > 0 ? "WARNING" : "VALID";
      if (status === "VALID") validCount++;
      else if (status === "WARNING") warningCount++;
      else rejectedCount++;

      return prisma.importRow.update({
        where: { id: r.id },
        data: {
          normalizedData: r.normalized as never,
          errors: r.errors,
          warnings: allWarnings,
          status,
        },
      });
    }),
  );

  // Replace any previous quality-issue rows for this import (re-validation should be idempotent).
  await prisma.dataQualityIssue.deleteMany({ where: { importId: id } });
  if (qualityIssues.length > 0) {
    await prisma.dataQualityIssue.createMany({
      data: qualityIssues.map((issue) => ({
        businessId: user.businessId,
        importId: id,
        type: issue.type === "SUSPICIOUS_VALUE" ? "SUSPICIOUS_VALUE" : issue.type,
        severity: issue.severity,
        description: `${issue.description} (rows: ${issue.rowNumbers.join(", ")})`,
      })),
    });
  }

  await prisma.import.update({
    where: { id },
    data: {
      status: "VALIDATED",
      columnMapping: mapping as never,
      successfulRows: validCount,
      warningRows: warningCount,
      rejectedRows: rejectedCount,
    },
  });

  return NextResponse.json({
    validCount,
    warningCount,
    rejectedCount,
    qualityIssues,
    preview: normalizedRows.slice(0, 50),
  });
}
