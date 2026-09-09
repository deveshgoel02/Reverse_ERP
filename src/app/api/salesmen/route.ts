import { NextResponse } from "next/server";
import { requireUser, requireRole, AuthError } from "@/lib/auth/current-user";
import { createSalesmanSchema, createSalesman } from "@/lib/salesmen/create";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    requireRole(user, "MANAGER");

    const parsed = createSalesmanSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid salesman data." }, { status: 400 });
    }

    const salesman = await createSalesman(user.businessId, user.id, parsed.data);
    return NextResponse.json({ salesman });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}
