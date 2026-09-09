import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/current-user";
import { createSaleSchema, createSale } from "@/lib/sales/create";
import { recalcInventoryForSkus } from "@/lib/inventory/recalc";
import { runIntelligencePipeline } from "@/lib/analytics/run-all";

export async function POST(request: Request) {
  const user = await requireUser();

  const parsed = createSaleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid sale data." }, { status: 400 });
  }

  let result;
  try {
    result = await createSale(user.businessId, user.id, parsed.data);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not create sale." }, { status: 400 });
  }

  await recalcInventoryForSkus(result.skuIds);
  await runIntelligencePipeline(user.businessId);

  return NextResponse.json(result);
}
