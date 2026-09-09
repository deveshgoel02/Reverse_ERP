import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import { commitImport } from "@/lib/import/commit";
import { runIntelligencePipeline } from "@/lib/analytics/run-all";
import { detectProductMatchCandidates } from "@/lib/catalog/product-matching";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const imp = await prisma.import.findFirst({ where: { id, businessId: user.businessId } });
  if (!imp) return NextResponse.json({ error: "Import not found." }, { status: 404 });
  if (imp.status !== "VALIDATED") {
    return NextResponse.json({ error: "Validate the import before committing." }, { status: 400 });
  }

  const summary = await commitImport(id, user.businessId, user.id);

  if (imp.entityType === "PRODUCTS") {
    await detectProductMatchCandidates(user.businessId);
  }

  // Recompute classification/forecasts/recommendations/alerts so the dashboard reflects the new data immediately.
  const pipelineResult = await runIntelligencePipeline(user.businessId);

  return NextResponse.json({ ...summary, pipelineResult });
}
