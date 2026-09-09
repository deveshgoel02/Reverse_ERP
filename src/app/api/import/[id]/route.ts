import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const imp = await prisma.import.findFirst({ where: { id, businessId: user.businessId } });
  if (!imp) return NextResponse.json({ error: "Import not found." }, { status: 404 });

  const rows = await prisma.importRow.findMany({ where: { importId: id }, orderBy: { rowNumber: "asc" }, take: 500 });
  const issues = await prisma.dataQualityIssue.findMany({ where: { importId: id } });

  return NextResponse.json({ import: imp, rows, issues });
}
