import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/current-user";
import { getReportRows } from "@/lib/reports/queries";
import { toCsv } from "@/lib/reports/csv";

export async function GET(_request: Request, { params }: { params: Promise<{ type: string }> }) {
  const user = await requireUser();
  const { type } = await params;

  let rows;
  try {
    rows = await getReportRows(type, user.businessId);
  } catch {
    return NextResponse.json({ error: "Unknown report type." }, { status: 404 });
  }

  const csv = toCsv(rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${type}-report-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
