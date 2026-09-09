import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import { parseUploadedFile } from "@/lib/import/parse";
import { suggestColumnMapping } from "@/lib/import/mapping";
import { importEntityTypeSchema } from "@/lib/enums";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB — large files should go through background processing (see docs/ARCHITECTURE.md limitations)

export async function POST(request: Request) {
  const user = await requireUser();

  const formData = await request.formData();
  const file = formData.get("file");
  const entityTypeRaw = formData.get("entityType");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: `File too large (${Math.round(file.size / 1024 / 1024)}MB). Max 10MB for now.` }, { status: 400 });
  }
  const entityTypeParse = importEntityTypeSchema.safeParse(entityTypeRaw);
  if (!entityTypeParse.success) {
    return NextResponse.json({ error: "Invalid or missing entityType." }, { status: 400 });
  }
  const entityType = entityTypeParse.data;

  const isXlsx = file.name.toLowerCase().endsWith(".xlsx");
  const isCsv = file.name.toLowerCase().endsWith(".csv");
  if (!isXlsx && !isCsv) {
    return NextResponse.json({ error: "Only .csv and .xlsx files are supported." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let parsed;
  try {
    parsed = await parseUploadedFile(buffer, isXlsx ? "XLSX" : "CSV");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown parse error";
    return NextResponse.json({ error: `Could not read this file: ${message}` }, { status: 400 });
  }

  if (parsed.headers.length === 0 || parsed.rows.length === 0) {
    return NextResponse.json({ error: "The file has no recognizable header row or data rows." }, { status: 400 });
  }

  const suggestedMapping = suggestColumnMapping(parsed.headers, entityType);

  const imp = await prisma.import.create({
    data: {
      businessId: user.businessId,
      filename: file.name,
      fileType: isXlsx ? "XLSX" : "CSV",
      entityType,
      status: "UPLOADED",
      columnMapping: suggestedMapping as never,
      totalRows: parsed.rows.length,
      rawFileData: buffer.toString("base64"),
      uploadedById: user.id,
    },
  });

  await prisma.importRow.createMany({
    data: parsed.rows.map((row, i) => ({
      importId: imp.id,
      rowNumber: i + 1,
      rawData: row,
      status: "PENDING",
    })),
  });

  return NextResponse.json({
    importId: imp.id,
    headers: parsed.headers,
    suggestedMapping,
    totalRows: parsed.rows.length,
    previewRows: parsed.rows.slice(0, 5),
  });
}
