import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { ImportWizard } from "./ImportWizard";
import type { ImportEntityType } from "@/lib/enums";

export default async function ImportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const { id } = await params;

  const imp = await prisma.import.findFirst({ where: { id, businessId: user.businessId } });
  if (!imp) notFound();

  const rows = await prisma.importRow.findMany({ where: { importId: id }, orderBy: { rowNumber: "asc" }, take: 5 });
  const headers = rows.length > 0 ? Object.keys(rows[0].rawData as Record<string, string>) : [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-text">{imp.filename}</h1>
        <p className="text-sm text-text-muted">
          {imp.entityType} · {imp.totalRows} rows
        </p>
      </div>
      <ImportWizard
        importId={imp.id}
        entityType={imp.entityType as ImportEntityType}
        headers={headers}
        initialMapping={(imp.columnMapping as { sourceColumn: string; targetField: string | null; confidence: number }[]) ?? []}
        previewRawRows={rows.map((r) => r.rawData as Record<string, string>)}
        totalRows={imp.totalRows}
      />
    </div>
  );
}
